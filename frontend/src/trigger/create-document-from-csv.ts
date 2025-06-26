import * as Y from "yjs";

import { task } from "@trigger.dev/sdk/v3";
import { DocConnection, DocumentManager } from "@y-sweet/sdk";

import { createClient } from "@/utils/supabase/server";

interface CreateDocumentFromCSVPayload {
  csvData: {
    headers: string[];
    rows: string[][];
    detectedTypes: Record<string, "string" | "number" | "date" | "boolean">;
  };
  documentName: string;
  documentDescription?: string;
}

interface CreateDocumentFromCSVResult {
  success: boolean;
  documentId?: string;
  ySweetDocId?: string;
  error?: string;
}

export const createDocumentFromCSV = task({
  id: "create-document-from-csv",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (
    payload: CreateDocumentFromCSVPayload
  ): Promise<CreateDocumentFromCSVResult> => {
    const { csvData, documentName, documentDescription } = payload;

    try {
      console.log(`Creating document from CSV: ${documentName}`);

      if (!process.env.Y_SWEET_CONNECTION_STRING) {
        throw new Error("Y_SWEET_CONNECTION_STRING is not set");
      }

      const documentManager = new DocumentManager(
        process.env.Y_SWEET_CONNECTION_STRING
      );
      const supabase = await createClient();

      // 1. Create Supabase document record
      const { data: dbData, error: dbError } = await supabase
        .from("document")
        .insert({
          liveblocks_id: documentName,
          title: documentName,
          type: "table",
          description: documentDescription,
        })
        .select("id, ysweet_id")
        .single();

      if (dbError || !dbData?.id) {
        throw new Error(
          `Failed to create document record: ${
            dbError?.message || "Unknown error"
          }`
        );
      }

      const supabaseDocId = dbData.id;
      const ySweetDocId = dbData.ysweet_id ?? undefined;

      if (!ySweetDocId) {
        throw new Error("Failed to get Y-Sweet document ID");
      }

      // 2. Create the Y-Sweet document
      await documentManager.createDoc(ySweetDocId);
      console.log(`Created Y-Sweet document: ${ySweetDocId}`);

      // 3. Initialize the document with CSV data
      const yDoc = new Y.Doc();

      // Use V2 schema for new tables
      const yMeta = yDoc.getMap<unknown>("metaData");
      const yColumnDefinitions = yDoc.getMap<{
        id: string;
        name: string;
        width: number;
      }>("columnDefinitions");
      const yColumnOrder = yDoc.getArray<string>("columnOrder");
      const yRowData = yDoc.getMap<Y.Map<string>>("rowData");
      const yRowOrder = yDoc.getArray<string>("rowOrder");

      // Create V2 schema data
      yDoc.transact(() => {
        // Set schema version
        yMeta.set("schemaVersion", 2);

        // Create column definitions from CSV headers
        const columnIds: string[] = [];
        csvData.headers.forEach((header, index) => {
          const colId = crypto.randomUUID();
          columnIds.push(colId);

          yColumnDefinitions.set(colId, {
            id: colId,
            name: header,
            width: 150,
          });
        });

        // Set column order
        yColumnOrder.push(columnIds);

        // Create rows from CSV data
        const rowIds: string[] = [];
        csvData.rows.forEach((row, rowIndex) => {
          const rowId = crypto.randomUUID();
          rowIds.push(rowId);

          const rowMap = new Y.Map<string>();
          row.forEach((cellValue, colIndex) => {
            if (colIndex < columnIds.length) {
              // Convert cell value based on detected type
              const columnName = csvData.headers[colIndex];
              const detectedType = csvData.detectedTypes[columnName];
              const convertedValue = convertCellValue(cellValue, detectedType);
              rowMap.set(columnIds[colIndex], convertedValue);
            }
          });

          yRowData.set(rowId, rowMap);
        });

        // Set row order
        yRowOrder.push(rowIds);
      });

      // 4. Apply the document to Y-Sweet
      const token = await documentManager.getClientToken(ySweetDocId);
      const newToken = {
        ...token,
        url: token.url.replace("ws://", "wss://"),
        baseUrl: token.baseUrl.replace("http://", "https://"),
      };
      const connection = new DocConnection(newToken);
      const yUpdate = Y.encodeStateAsUpdate(yDoc);
      await connection.updateDoc(yUpdate);

      console.log(
        `Successfully populated Y-Sweet document with ${csvData.rows.length} rows and ${csvData.headers.length} columns`
      );

      return {
        success: true,
        documentId: supabaseDocId,
        ySweetDocId: ySweetDocId,
      };
    } catch (error) {
      console.error("Document creation error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during document creation",
      };
    }
  },
});

function convertCellValue(
  value: string,
  type: "string" | "number" | "date" | "boolean"
): string {
  if (!value || value.trim() === "") {
    return "";
  }

  switch (type) {
    case "number":
      const num = parseFloat(value);
      return isNaN(num) ? value : num.toString();

    case "boolean":
      const lowerValue = value.toLowerCase();
      if (["true", "yes", "1"].includes(lowerValue)) return "true";
      if (["false", "no", "0"].includes(lowerValue)) return "false";
      return value;

    case "date":
      const date = new Date(value);
      return isNaN(date.getTime()) ? value : date.toISOString().split("T")[0];

    default:
      return value.toString();
  }
}
