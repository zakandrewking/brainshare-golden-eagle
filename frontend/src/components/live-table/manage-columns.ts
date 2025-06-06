import { toast } from "sonner";

import generateNewColumns, {
  GeneratedColumn,
} from "./actions/generateNewColumns";
import { LiveTableDoc } from "./LiveTableDoc";

// Helper for unique default header names - copied from LiveTableProvider
export function generateUniqueDefaultHeader(
  base: string,
  existingHeaders: string[],
  columnsToInsert: { headerName: string }[]
): string {
  let counter = 1;
  let name = `${base} ${counter}`;
  const allHeaders = [
    ...existingHeaders.map((h) => h.toLowerCase()),
    ...columnsToInsert.map((c) => c.headerName.toLowerCase()),
  ];
  while (allHeaders.includes(name.toLowerCase())) {
    counter++;
    name = `${base} ${counter}`;
  }
  return name;
}

export async function generateAndInsertColumns(
  initialInsertIndex: number,
  numColsToAdd: number,
  headers: string[] | undefined,
  tableData: Record<string, unknown>[] | undefined,
  documentTitle: string,
  documentDescription: string,
  liveTableDoc: LiveTableDoc
): Promise<{
  aiColsAdded: number;
  defaultColsAdded: number;
}> {
  if (numColsToAdd <= 0) {
    toast.info("No columns were added as the number to add was zero.");
    return { aiColsAdded: 0, defaultColsAdded: 0 };
  }
  if (!headers || !tableData) {
    // This check is important. If called without headers/tableData (e.g. before table loads),
    // it should throw an error or handle gracefully.
    // The hook using this should ensure headers/tableData are available.
    throw new Error("Cannot add columns: table headers or data not loaded.");
  }
  const currentTableDataForAi = tableData.map((row) => ({ ...row }));
  const currentHeadersForAi = [...headers];
  let aiColsAddedCount = 0;
  let defaultColsAddedCount = 0;
  const columnsToInsert: {
    headerName: string;
    columnData: (string | null)[] | null;
  }[] = [];

  try {
    const result = await generateNewColumns(
      currentTableDataForAi,
      currentHeadersForAi,
      numColsToAdd,
      documentTitle,
      documentDescription
    );

    if (result.error) {
      for (let i = 0; i < numColsToAdd; i++) {
        columnsToInsert.push({
          headerName: generateUniqueDefaultHeader(
            "New Column",
            currentHeadersForAi,
            columnsToInsert
          ),
          columnData: null,
        });
        defaultColsAddedCount++;
      }
    } else if (
      !result.generatedColumns ||
      result.generatedColumns.length === 0
    ) {
      for (let i = 0; i < numColsToAdd; i++) {
        columnsToInsert.push({
          headerName: generateUniqueDefaultHeader(
            "New Column",
            currentHeadersForAi,
            columnsToInsert
          ),
          columnData: null,
        });
        defaultColsAddedCount++;
      }
    } else {
      result.generatedColumns.forEach((col: GeneratedColumn) => {
        columnsToInsert.push({
          headerName: col.headerName,
          columnData: col.columnData,
        });
        aiColsAddedCount++;
      });
      const remainingColsToFill = numColsToAdd - aiColsAddedCount;
      for (let i = 0; i < remainingColsToFill; i++) {
        columnsToInsert.push({
          headerName: generateUniqueDefaultHeader(
            "New Column",
            currentHeadersForAi,
            columnsToInsert
          ),
          columnData: null,
        });
        defaultColsAddedCount++;
      }
    }

    if (columnsToInsert.length === 0 && numColsToAdd > 0) {
      toast.info("Attempted to add columns, but no columns were prepared.");
      return { aiColsAdded: 0, defaultColsAdded: 0 };
    }

    if (columnsToInsert.length > 0) {
      liveTableDoc.insertColumns(initialInsertIndex, columnsToInsert);
    }

    if (result.error) {
      toast.error(
        `AI column generation failed: ${result.error}. Added ${defaultColsAddedCount} default column(s).`
      );
    } else if (aiColsAddedCount > 0 && defaultColsAddedCount === 0) {
      toast.success(
        `Successfully added ${aiColsAddedCount} AI-suggested column(s).`
      );
    } else if (aiColsAddedCount > 0 && defaultColsAddedCount > 0) {
      toast.info(
        `Added ${numColsToAdd} column(s): ${aiColsAddedCount} AI-suggested, ${defaultColsAddedCount} default.`
      );
    } else if (defaultColsAddedCount > 0 && aiColsAddedCount === 0) {
      toast.info(
        `Added ${defaultColsAddedCount} default column(s) as AI suggestions were not available or an issue occurred.`
      );
    }

    return {
      aiColsAdded: aiColsAddedCount,
      defaultColsAdded: defaultColsAddedCount,
    };
  } catch (error) {
    const fallbackColumns: { headerName: string; columnData: null }[] = [];
    for (let i = 0; i < numColsToAdd; i++) {
      fallbackColumns.push({
        headerName: generateUniqueDefaultHeader(
          "New Column",
          currentHeadersForAi, // Use currentHeadersForAi which is guaranteed to be string[]
          fallbackColumns
        ),
        columnData: null,
      });
    }
    if (fallbackColumns.length > 0) {
      try {
        liveTableDoc.insertColumns(initialInsertIndex, fallbackColumns);
        // If fallback succeeds, we still want to indicate an issue occurred with AI
        defaultColsAddedCount = fallbackColumns.length; // Update count based on what was actually attempted
        aiColsAddedCount = 0; // Reset AI count as AI part failed
        toast.error(
          `AI column generation failed. Added ${defaultColsAddedCount} default column(s) as a fallback.`
        );
        return {
          aiColsAdded: aiColsAddedCount,
          defaultColsAdded: defaultColsAddedCount,
        };
      } catch (yjsError) {
        // If even fallback fails, we throw the original error that led to this catch block.
        console.error("Fallback column insertion also failed:", yjsError);
      }
    }
    // Throw the original error to be caught by the toolbar or calling component
    throw error instanceof Error ? error : new Error(String(error));
  }
}

export async function deleteColumns(
  colIndices: number[],
  liveTableDoc: LiveTableDoc
): Promise<{ deletedCount: number }> {
  if (colIndices.length === 0) {
    toast.info("No columns selected for deletion.");
    return { deletedCount: 0 };
  }
  let deletedCount = 0;
  try {
    deletedCount = liveTableDoc.deleteColumns(colIndices);
    if (deletedCount > 0) {
      toast.success(`Successfully deleted ${deletedCount} column(s).`);
      if (colIndices.length > deletedCount) {
        toast.info(
          `${
            colIndices.length - deletedCount
          } column(s) could not be deleted (possibly out of bounds). Check console for details.`
        );
      }
    } else if (colIndices.length > 0 && deletedCount === 0) {
      toast.info(
        "No columns were deleted. They might have been out of bounds. Check console for details."
      );
    }
  } catch (error) {
    toast.error("An error occurred while deleting columns.");
    throw error instanceof Error ? error : new Error(String(error));
  }
  return { deletedCount };
}
