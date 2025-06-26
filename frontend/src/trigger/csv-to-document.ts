import { fileTypeFromBuffer } from "file-type";
import Papa from "papaparse";
import * as Y from "yjs";

import { task } from "@trigger.dev/sdk/v3";
import { DocConnection, DocumentManager } from "@y-sweet/sdk";

import { createClient } from "@/utils/supabase/server";

interface CSVToDocumentPayload {
  fileData: string; // base64 encoded
  fileName: string;
  documentName: string;
  documentDescription?: string;
}

interface CSVToDocumentResult {
  success: boolean;
  documentId?: string;
  ySweetDocId?: string;
  csvStats?: {
    headers: string[];
    rowCount: number;
    columnCount: number;
    detectedTypes: Record<string, "string" | "number" | "date" | "boolean">;
  };
  error?: string;
}

export const csvToDocument = task({
  id: "csv-to-document",
  maxDuration: 600, // 10 minutes
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: CSVToDocumentPayload): Promise<CSVToDocumentResult> => {
    try {
      console.log(
        `Processing CSV file ${payload.fileName} and creating document: ${payload.documentName}`
      );

      // Step 1: Parse CSV
      const csvData = await parseCSVFile(payload.fileData, payload.fileName);
      if (!csvData.success || !csvData.data) {
        return {
          success: false,
          error: `CSV parsing failed: ${csvData.error}`,
        };
      }

      console.log(
        `CSV parsed: ${csvData.data.rowCount} rows, ${csvData.data.columnCount} columns`
      );

      // Step 2: Create document and populate with CSV data
      const documentResult = await createDocumentWithCSVData(
        csvData.data,
        payload.documentName,
        payload.documentDescription
      );

      if (!documentResult.success) {
        return {
          success: false,
          error: `Document creation failed: ${documentResult.error}`,
        };
      }

      console.log(
        `Document created successfully: ${documentResult.documentId}`
      );

      return {
        success: true,
        documentId: documentResult.documentId,
        ySweetDocId: documentResult.ySweetDocId,
        csvStats: {
          headers: csvData.data.headers,
          rowCount: csvData.data.rowCount,
          columnCount: csvData.data.columnCount,
          detectedTypes: csvData.data.detectedTypes,
        },
      };
    } catch (error) {
      console.error("CSV to document error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  },
});

async function parseCSVFile(fileData: string, fileName: string) {
  try {
    // Decode base64 file data
    const fileBuffer = Buffer.from(fileData, "base64");

    // Validate file type
    const fileType = await fileTypeFromBuffer(fileBuffer);
    if (
      fileType &&
      !["text/csv", "text/plain"].includes(fileType.mime) &&
      !fileName.toLowerCase().endsWith(".csv")
    ) {
      return {
        success: false,
        error: `Invalid file type. Expected CSV file, got: ${
          fileType?.mime || "unknown"
        }`,
      };
    }

    // Convert buffer to string with encoding detection
    let csvText: string;
    try {
      // Try UTF-8 first
      csvText = fileBuffer.toString("utf-8");

      // Basic check if UTF-8 decoding worked (no replacement characters)
      if (csvText.includes("�")) {
        // Try UTF-16 if UTF-8 failed
        csvText = fileBuffer.toString("utf-16le");
        if (csvText.includes("�")) {
          // Fallback to latin1
          csvText = fileBuffer.toString("latin1");
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to decode file: ${
          error instanceof Error ? error.message : "Unknown encoding error"
        }`,
      };
    }

    // Parse CSV with papaparse
    const parseResult = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      delimiter: ",", // Force comma delimiter for Phase 1
      quoteChar: '"',
      escapeChar: '"',
      transformHeader: (header: string) => header.trim(),
      transform: (value: string) => value.trim(),
    });

    if (parseResult.errors.length > 0) {
      const criticalErrors = parseResult.errors.filter(
        (error) => error.type === "Delimiter"
      );
      if (criticalErrors.length > 0) {
        return {
          success: false,
          error: `CSV parsing failed: ${criticalErrors
            .map((e) => e.message)
            .join(", ")}`,
        };
      }
      // Log non-critical errors but continue
      console.warn("CSV parsing warnings:", parseResult.errors);
    }

    const rows = parseResult.data as string[][];

    if (rows.length === 0) {
      return {
        success: false,
        error: "CSV file appears to be empty",
      };
    }

    // Extract headers (first row) and data rows
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    if (headers.length === 0) {
      return {
        success: false,
        error: "CSV file has no columns",
      };
    }

    // Detect column data types
    const detectedTypes = detectColumnTypes(headers, dataRows);

    return {
      success: true,
      data: {
        headers,
        rows: dataRows,
        rowCount: dataRows.length,
        columnCount: headers.length,
        detectedTypes,
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Unknown CSV parsing error",
    };
  }
}

async function createDocumentWithCSVData(
  csvData: {
    headers: string[];
    rows: string[][];
    detectedTypes: Record<string, "string" | "number" | "date" | "boolean">;
  },
  documentName: string,
  documentDescription?: string
) {
  try {
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
      csvData.headers.forEach((header) => {
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
      csvData.rows.forEach((row) => {
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
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown document creation error",
    };
  }
}

function detectColumnTypes(
  headers: string[],
  rows: string[][]
): Record<string, "string" | "number" | "date" | "boolean"> {
  const types: Record<string, "string" | "number" | "date" | "boolean"> = {};

  headers.forEach((header, columnIndex) => {
    const columnValues = rows
      .map((row) => row[columnIndex])
      .filter((val) => val && val.trim() !== "");

    if (columnValues.length === 0) {
      types[header] = "string";
      return;
    }

    // Check for boolean values
    const booleanValues = columnValues.filter((val) =>
      ["true", "false", "yes", "no", "1", "0"].includes(val.toLowerCase())
    );
    if (booleanValues.length / columnValues.length > 0.8) {
      types[header] = "boolean";
      return;
    }

    // Check for numeric values
    const numericValues = columnValues.filter(
      (val) => !isNaN(Number(val)) && !isNaN(parseFloat(val))
    );
    if (numericValues.length / columnValues.length > 0.8) {
      types[header] = "number";
      return;
    }

    // Check for date values
    const dateValues = columnValues.filter((val) => {
      const date = new Date(val);
      return (
        !isNaN(date.getTime()) &&
        val.match(/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/)
      );
    });
    if (dateValues.length / columnValues.length > 0.6) {
      types[header] = "date";
      return;
    }

    // Default to string
    types[header] = "string";
  });

  return types;
}

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
