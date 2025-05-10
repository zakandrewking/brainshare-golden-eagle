import { toast } from "sonner";
import * as Y from "yjs";

/**
 * Applies a generated column (header and data) to the Yjs document.
 * Modifies yHeaders and yTable in place within a single transaction.
 */
export const applyGeneratedColumnToYDoc = (
  yDoc: Y.Doc,
  yHeaders: Y.Array<string>,
  yTable: Y.Array<Y.Map<unknown>>,
  finalHeader: string,
  finalData: (string | undefined)[] | null,
  insertIndex: number
): void => {
  yDoc.transact(() => {
    console.log(
      `[applyGeneratedColumnToYDoc] Transaction Start: Inserting header "${finalHeader}" at index ${insertIndex}`
    );

    yHeaders.insert(insertIndex, [finalHeader]);

    console.log(
      `[applyGeneratedColumnToYDoc] yHeaders after insert: ${JSON.stringify(
        yHeaders.toArray()
      )}`
    );

    yTable.forEach((row: Y.Map<unknown>, rowIndex) => {
      const valueToAdd = finalData ? finalData[rowIndex] ?? "" : "";
      if (!row.has(finalHeader)) {
        row.set(finalHeader, valueToAdd);
      }
    });

    if (yTable.length === 0 && finalData && finalData.length > 0) {
      console.warn(
        "[applyGeneratedColumnToYDoc] AI generated data for an empty table, adding first row."
      );
      const newRow = new Y.Map<unknown>();
      const valueToAdd = finalData[0] ?? "";
      newRow.set(finalHeader, valueToAdd);
      yTable.push([newRow]);
    } else if (yTable.length === 0) {
      const newRow = new Y.Map<unknown>();
      newRow.set(finalHeader, "");
      yTable.push([newRow]);
    }

    console.log(
      `[applyGeneratedColumnToYDoc] Transaction End: Header "${finalHeader}" added.`
    );
  });
};

/**
 * Applies a default column (header with empty data) to the Yjs document in case of an error.
 * Modifies yHeaders and yTable in place within a single transaction.
 */
export const applyDefaultColumnToYDocOnError = (
  yDoc: Y.Doc,
  yHeaders: Y.Array<string>,
  yTable: Y.Array<Y.Map<unknown>>,
  headerToAdd: string,
  insertIndex: number
): void => {
  yDoc.transact(() => {
    console.log(
      `[applyDefaultColumnToYDocOnError] Fallback Transaction: Inserting default header "${headerToAdd}" at index ${insertIndex}`
    );
    yHeaders.insert(insertIndex, [headerToAdd]);
    yTable.forEach((row: Y.Map<unknown>) => {
      if (!row.has(headerToAdd)) {
        row.set(headerToAdd, "");
      }
    });
    if (yTable.length === 0) {
      const newRow = new Y.Map<unknown>();
      newRow.set(headerToAdd, "");
      yTable.push([newRow]);
    }
  });
};

export function applyGeneratedRowToYDoc(
  yDoc: Y.Doc,
  yTable: Y.Array<Y.Map<unknown>>,
  yHeaders: Y.Array<string>,
  rowData: Record<string, string>,
  insertIndex: number
): void {
  try {
    yDoc.transact(() => {
      // Create a new row map
      const newRow = new Y.Map<unknown>();

      // For each header, set the corresponding value from rowData or empty string
      yHeaders.toArray().forEach((header) => {
        newRow.set(header, rowData[header] || "");
      });

      // Insert the new row at the specified index
      yTable.insert(insertIndex, [newRow]);
    });

    // Show success toast
    toast.success("Added new row with AI suggestions");
  } catch (error) {
    console.error("Error applying generated row to Y.Doc:", error);
    toast.error("Failed to add row. Please try again.");

    // Fallback to empty row
    applyDefaultRowToYDocOnError(yDoc, yTable, yHeaders, insertIndex);
  }
}

export function applyDefaultRowToYDocOnError(
  yDoc: Y.Doc,
  yTable: Y.Array<Y.Map<unknown>>,
  yHeaders: Y.Array<string>,
  insertIndex: number
): void {
  try {
    yDoc.transact(() => {
      // Create a new row map with empty values
      const newRow = new Y.Map<unknown>();

      // Set empty strings for all headers
      yHeaders.toArray().forEach((header) => {
        newRow.set(header, "");
      });

      // Insert the new row at the specified index
      yTable.insert(insertIndex, [newRow]);
    });
  } catch (error) {
    console.error("Error applying default row to Y.Doc:", error);
    toast.error("Failed to add row. Please try again.");
  }
}
