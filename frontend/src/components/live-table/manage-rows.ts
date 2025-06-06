import { toast } from "sonner";

import generateNewRows from "./actions/generateNewRows";
import { LiveTableDoc } from "./LiveTableDoc";

export async function generateAndInsertRows(
  initialInsertIndex: number,
  numRowsToAdd: number,
  headers: string[],
  tableData: Record<string, unknown>[],
  documentTitle: string,
  documentDescription: string,
  liveTableDoc: LiveTableDoc
) {
  if (numRowsToAdd <= 0) {
    toast.info("No rows were added as the number to add was zero.");
    return { aiRowsAdded: 0, defaultRowsAdded: 0 };
  }
  if (!headers || !tableData) {
    throw new Error("Cannot add rows: table headers or data not loaded.");
  }

  const currentTableDataForAi = tableData.map((row) => ({ ...row }));
  const currentHeadersForAi = [...headers];

  const rowsToInsertPlain: Record<string, unknown>[] = [];
  let aiRowsAddedCount = 0;
  let defaultRowsAddedCount = 0;

  try {
    const result = await generateNewRows(
      currentTableDataForAi,
      currentHeadersForAi,
      numRowsToAdd,
      documentTitle,
      documentDescription
    );

    if (result.error) {
      for (let i = 0; i < numRowsToAdd; i++) {
        const defaultRow: Record<string, string> = {};
        currentHeadersForAi.forEach((header) => {
          defaultRow[header] = "";
        });
        rowsToInsertPlain.push(defaultRow);
        defaultRowsAddedCount++;
      }
    } else if (!result.newRows || result.newRows.length === 0) {
      for (let i = 0; i < numRowsToAdd; i++) {
        const defaultRow: Record<string, string> = {};
        currentHeadersForAi.forEach((header) => {
          defaultRow[header] = "";
        });
        rowsToInsertPlain.push(defaultRow);
        defaultRowsAddedCount++;
      }
    } else {
      result.newRows.forEach((rowData: Record<string, string>) => {
        if (rowsToInsertPlain.length < numRowsToAdd) {
          rowsToInsertPlain.push(rowData);
          aiRowsAddedCount++;
        }
      });
      const remainingRowsToFill = numRowsToAdd - aiRowsAddedCount;
      for (let i = 0; i < remainingRowsToFill; i++) {
        const defaultRow: Record<string, string> = {};
        currentHeadersForAi.forEach((header) => {
          defaultRow[header] = "";
        });
        rowsToInsertPlain.push(defaultRow);
        defaultRowsAddedCount++;
      }
    }

    if (rowsToInsertPlain.length === 0 && numRowsToAdd > 0) {
      toast.info("Attempted to add rows, but no rows were prepared.");
      return { aiRowsAdded: 0, defaultRowsAdded: 0 };
    }

    if (rowsToInsertPlain.length > 0) {
      const stringifiedRowsToInsert = rowsToInsertPlain.map((row) => {
        const stringifiedRow: Record<string, string> = {};
        for (const key in row) {
          if (Object.prototype.hasOwnProperty.call(row, key)) {
            stringifiedRow[key] = String(row[key] ?? "");
          }
        }
        return stringifiedRow;
      });
      liveTableDoc.insertRows(initialInsertIndex, stringifiedRowsToInsert);
    }

    if (result.error) {
      toast.error(
        `AI row generation failed: ${result.error}. Added ${defaultRowsAddedCount} default row(s).`
      );
    } else if (aiRowsAddedCount > 0 && defaultRowsAddedCount === 0) {
      toast.success(
        `Successfully added ${aiRowsAddedCount} AI-suggested row(s).`
      );
    } else if (aiRowsAddedCount > 0 && defaultRowsAddedCount > 0) {
      toast.info(
        `Added ${numRowsToAdd} row(s): ${aiRowsAddedCount} AI-suggested, ${defaultRowsAddedCount} default.`
      );
    } else if (defaultRowsAddedCount > 0 && aiRowsAddedCount === 0) {
      toast.info(
        `Added ${defaultRowsAddedCount} default row(s) as AI suggestions were not available or an issue occurred.`
      );
    }

    return {
      aiRowsAdded: aiRowsAddedCount,
      defaultRowsAdded: defaultRowsAddedCount,
    };
  } catch (error) {
    // This catch is for errors during Yjs operations or other unexpected issues within the try block
    // Fallback: attempt to insert default rows directly into Yjs
    const fallbackRowsPlain: Record<string, string>[] = [];
    for (let i = 0; i < numRowsToAdd; i++) {
      const defaultRow: Record<string, string> = {};
      currentHeadersForAi.forEach((header) => {
        defaultRow[header] = "";
      });
      fallbackRowsPlain.push(defaultRow);
    }

    if (fallbackRowsPlain.length > 0) {
      try {
        liveTableDoc.insertRows(initialInsertIndex, fallbackRowsPlain);
      } catch {
        // If even fallback fails, we throw the original error that led to this catch block.
        // No need to throw yjsError specifically, as the primary error is more relevant to the user action.
      }
    }
    // Throw the original error to be caught by the toolbar
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function insertEmptyRows(
  initialInsertIndex: number,
  numRowsToAdd: number,
  liveTableDoc: LiveTableDoc
) {
  if (numRowsToAdd <= 0) {
    toast.info("No rows were added as the number to add was zero.");
    return { defaultRowsAdded: 0 };
  }

  try {
    const insertedCount = liveTableDoc.insertEmptyRows(
      initialInsertIndex,
      numRowsToAdd
    );
    if (insertedCount > 0) {
      toast.success(`Successfully added ${insertedCount} empty row(s).`);
    }
    return { defaultRowsAdded: insertedCount };
  } catch (error) {
    toast.error("An error occurred while adding empty rows.");
    throw error;
  }
}

export async function deleteRows(
  rowIndices: number[],
  liveTableDoc: LiveTableDoc
): Promise<{ deletedCount: number }> {
  if (rowIndices.length === 0) {
    toast.info("No rows selected for deletion.");
    return { deletedCount: 0 };
  }

  try {
    const deletedCount = liveTableDoc.deleteRows(rowIndices);

    if (deletedCount > 0) {
      toast.success(`Successfully deleted ${deletedCount} row(s).`);
      if (rowIndices.length > deletedCount) {
        toast.info(
          `${
            rowIndices.length - deletedCount
          } row(s) could not be deleted (possibly out of bounds). Check console for details.`
        );
      }
    } else if (rowIndices.length > 0 && deletedCount === 0) {
      toast.info(
        "No rows were deleted. They might have been out of bounds. Check console for details."
      );
    }
    return { deletedCount };
  } catch (error) {
    toast.error("An error occurred while deleting rows.");
    throw error instanceof Error ? error : new Error(String(error));
  }
}
