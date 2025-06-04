import { toast } from "sonner";

import generateNewColumns, {
  GeneratedColumn,
} from "@/components/live-table/actions/generateNewColumns";
import { LiveTableDoc } from "@/components/live-table/live-table-doc";

export function reorderColumn(
  fromIndex: number,
  toIndex: number,
  liveTableDoc: LiveTableDoc
) {
  liveTableDoc.reorderColumn(fromIndex, toIndex);
}

export async function deleteColumns(
  colIndices: number[],
  liveTableDoc: LiveTableDoc
) {
  if (!liveTableDoc) {
    throw new Error("Table document not available. Cannot delete columns.");
  }
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
    throw error instanceof Error ? error : new Error(String(error));
  }
  return { deletedCount };
}

// Helper for unique default header names
function generateUniqueDefaultHeader(
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
  liveTableDoc: LiveTableDoc,
  headers: string[],
  tableData: Record<string, unknown>[],
  documentTitle: string,
  documentDescription: string
) {
  if (numColsToAdd <= 0) {
    toast.info("No columns were added as the number to add was zero.");
    return { aiColsAdded: 0, defaultColsAdded: 0 };
  }
  if (!headers || !tableData) {
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
    // This catch is for errors during Yjs operations or other unexpected issues within the try block
    // Fallback: attempt to insert default columns directly into Yjs
    const fallbackColumns: { headerName: string; columnData: null }[] = [];
    for (let i = 0; i < numColsToAdd; i++) {
      fallbackColumns.push({
        headerName: generateUniqueDefaultHeader(
          "New Column",
          currentHeadersForAi,
          fallbackColumns
        ),
        columnData: null,
      });
    }
    if (fallbackColumns.length > 0) {
      try {
        liveTableDoc.insertColumns(initialInsertIndex, fallbackColumns);
      } catch {
        // If even fallback fails, we throw the original error that led to this catch block.
        // No need to throw yjsError specifically, as the primary error is more relevant to the user action.
      }
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}
