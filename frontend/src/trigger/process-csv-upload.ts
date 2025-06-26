import { fileTypeFromBuffer } from "file-type";
import Papa from "papaparse";

import { task } from "@trigger.dev/sdk/v3";

interface CSVProcessingPayload {
  fileData: string; // base64 encoded
  fileName: string;
  documentName: string;
  documentDescription?: string;
}

interface CSVProcessingResult {
  success: boolean;
  data?: {
    headers: string[];
    rows: string[][];
    rowCount: number;
    columnCount: number;
    detectedTypes: Record<string, "string" | "number" | "date" | "boolean">;
  };
  error?: string;
}

export const processCSVUpload = task({
  id: "process-csv-upload",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: CSVProcessingPayload): Promise<CSVProcessingResult> => {
    try {
      console.log(`Processing CSV file: ${payload.fileName}`);

      // Decode base64 file data
      const fileBuffer = Buffer.from(payload.fileData, "base64");

      // Validate file type
      const fileType = await fileTypeFromBuffer(fileBuffer);
      if (
        fileType &&
        !["text/csv", "text/plain"].includes(fileType.mime) &&
        !payload.fileName.toLowerCase().endsWith(".csv")
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

      console.log(
        `Successfully processed CSV: ${headers.length} columns, ${dataRows.length} rows`
      );

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
      console.error("CSV processing error:", error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error occurred during CSV processing",
      };
    }
  },
});

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
