/**
 * This is the top-level provider for the LiveTable component. It manages the
 * LiveTableDoc and the LiveTableContext.
 *
 * This component is primarily responsible for setting up the LiveTableDoc,
 * based on the lifecycle of page. It should NOT be used to manage state that
 * changes frequently, because that will cause the entire table to re-render.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { toast } from "sonner";

import { DataStoreProvider } from "@/stores/dataStore";
import {
  type CellPosition,
  type SelectionArea,
  useSelectedCells,
  useSelectionArea,
} from "@/stores/selectionStore";

import generateNewColumns, {
  GeneratedColumn,
} from "./actions/generateNewColumns";
import generateNewRows from "./actions/generateNewRows";
import {
  type AwarenessState,
  type CursorDataForCell,
  initializeLiveblocksRoom,
} from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";

export interface LiveTableContextType {
  // data
  tableId: string;
  documentTitle: string;
  documentDescription: string;
  tableData: Record<string, unknown>[] | undefined;
  headers: string[] | undefined;
  columnWidths: Record<string, number> | undefined;
  isTableLoaded: boolean;
  // row operations
  generateAndInsertRows: (
    initialInsertIndex: number,
    numRowsToAdd: number
  ) => Promise<{
    aiRowsAdded: number;
    defaultRowsAdded: number;
  }>;
  deleteRows: (rowIndices: number[]) => Promise<{
    deletedCount: number;
  }>;
  // column operations
  generateAndInsertColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{
    aiColsAdded: number;
    defaultColsAdded: number;
  }>;
  deleteColumns: (colIndices: number[]) => Promise<{ deletedCount: number }>;
  // column reordering
  reorderColumn: (fromIndex: number, toIndex: number) => void;
  // awareness
  awarenessStates: Map<number, AwarenessState | null> | undefined;
  cursorsData: CursorDataForCell[] | undefined;
  getCursorsForCell: (
    rowIndex: number,
    colIndex: number
  ) => CursorDataForCell | undefined;
}

export type { CellPosition, SelectionArea };

export enum Backend {
  Y_SWEET = "y-sweet",
  LIVEBLOCKS = "liveblocks",
}

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
  backend: Backend;
}

const LiveTableContext = createContext<LiveTableContextType | undefined>(
  undefined
);

/**
 * @param backend - If Backend.Y_SWEET, must have a parent component that is
 * YSweetDocProvider. If Backend.LIVEBLOCKS, must have a parent component that
 * is Room.
 */
const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
  documentTitle,
  documentDescription,
  backend,
}) => {
  // yTable & friends are not going to reactively update, so we need to observe
  // changes to them and create react state that will reactively update UI.
  // Downstream components should read table, headers, and colWidths for most
  // uses cases.

  // TODO table/setTable is keyed by Column ID, a unique, non-meaningful identifier for each
  // column.
  // TODO headers/setHeaders is a map of Column ID to human-readable header name.
  // TODO colWidths/setColumnWidths is keyed by Column ID

  const [tableData, setTableData] = useState<
    Record<string, unknown>[] | undefined
  >(undefined);
  const [headers, setHeaders] = useState<string[] | undefined>(undefined);
  const [columnWidths, setColumnWidths] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [isTableLoaded, setIsTableLoaded] = useState<boolean>(false);

  // Awareness state
  const [awarenessStates, setAwarenessStates] = useState<
    Map<number, AwarenessState | null> | undefined
  >(undefined);
  const [cursorsData, setCursorsData] = useState<
    CursorDataForCell[] | undefined
  >(undefined);

  // liveblocks
  // TODO move to a different component so we can selectively use liveblocks or y-sweet
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );
  liveTableDoc.tableDataUpdateCallback = setTableData;
  liveTableDoc.headersUpdateCallback = setHeaders;
  liveTableDoc.columnWidthsUpdateCallback = setColumnWidths;
  liveTableDoc.awarenessStatesUpdateCallback = setAwarenessStates;
  liveTableDoc.cursorsDataUpdateCallback = setCursorsData;

  // update self info in awareness
  useUpdatedSelf(yProvider);

  // selection store
  const selectedCells = useSelectedCells();
  const selectionArea = useSelectionArea();

  // --- Load status ---

  useEffect(() => {
    if (!isTableLoaded && tableData && headers && columnWidths) {
      setIsTableLoaded(true);
    }
  }, [tableData, headers, isTableLoaded, columnWidths]);

  // --- Awareness Management ---

  // Memoized function to update React state with awareness changes
  const updateAwarenessStateCallback = useCallback(() => {
    const currentStates = new Map(
<<<<<<< Updated upstream
      yProvider.awareness.getStates() as Map<number, AwarenessState | null>
=======
      yProvider.awareness.getStates() as Map<number, AwarenessState>
>>>>>>> Stashed changes
    );
    liveTableDoc.updateAwarenessState(currentStates);
  }, [yProvider.awareness, liveTableDoc]);

  // Set up the awareness observer
  useEffect(() => {
    liveTableDoc.updateAwarenessStateObserver = updateAwarenessStateCallback;
  }, [liveTableDoc, updateAwarenessStateCallback]);

  // Effect to subscribe to awareness changes
  useEffect(() => {
    // Initial load of awareness states
    updateAwarenessStateCallback();

    // Listen for awareness changes
    yProvider.awareness.on("update", updateAwarenessStateCallback);

    // Cleanup on unmount
    return () => {
      yProvider.awareness.off("update", updateAwarenessStateCallback);
    };
  }, [updateAwarenessStateCallback, yProvider.awareness]);

  // Update awareness when local selection changes
  useEffect(() => {
    yProvider.awareness.setLocalStateField("selectionArea", {
      startCell: selectionArea.startCell
        ? { ...selectionArea.startCell }
        : null,
      endCell: selectionArea.endCell ? { ...selectionArea.endCell } : null,
    });
  }, [selectedCells, yProvider.awareness, selectionArea]);

  // Helper to find cursors for a specific cell from the pre-computed data
  const getCursorsForCell = useCallback(
    (rowIndex: number, colIndex: number): CursorDataForCell | undefined => {
      return cursorsData?.find(
        (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
      );
<<<<<<< Updated upstream
=======
    },
    [cursorsData]
  );

  // --- Awareness & Focus ---

  const handleCellFocus = useCallback(
    (rowIndex: number, colIndex: number) => {
      yProvider.awareness.setLocalStateField("selectedCell", {
        rowIndex,
        colIndex,
      });
>>>>>>> Stashed changes
    },
    [cursorsData]
  );

  // wire up yjs observers
  useEffect(() => {
    liveTableDoc.initializeObservers();
    return () => {
      liveTableDoc.cleanupObservers();
    };
  }, [liveTableDoc]);

  const generateAndInsertRows = useCallback(
    async (initialInsertIndex: number, numRowsToAdd: number) => {
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
    },
    [liveTableDoc, headers, tableData, documentTitle, documentDescription]
  );

  const deleteRows = useCallback(
    async (rowIndices: number[]) => {
      if (!liveTableDoc) {
        throw new Error("Table document not available. Cannot delete rows.");
      }
      if (rowIndices.length === 0) {
        toast.info("No rows selected for deletion.");
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      try {
        deletedCount = liveTableDoc.deleteRows(rowIndices);

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
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
      return { deletedCount };
    },
    [liveTableDoc]
  );

  const generateAndInsertColumns = useCallback(
    async (initialInsertIndex: number, numColsToAdd: number) => {
      if (numColsToAdd <= 0) {
        toast.info("No columns were added as the number to add was zero.");
        return { aiColsAdded: 0, defaultColsAdded: 0 };
      }
      if (!headers || !tableData) {
        throw new Error(
          "Cannot add columns: table headers or data not loaded."
        );
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
    },
    [liveTableDoc, headers, tableData, documentTitle, documentDescription]
  );

  const deleteColumns = useCallback(
    async (colIndices: number[]) => {
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
    },
    [liveTableDoc]
  );

  const reorderColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      liveTableDoc.reorderColumn(fromIndex, toIndex);
    },
    [liveTableDoc]
  );

<<<<<<< Updated upstream
=======
  // Lock-related methods
  const lockSelectedRange = useCallback(() => {
    if (selectedCells.length === 0) {
      toast.info("No cells selected to lock.");
      return null;
    }

    // Find the bounds of the selection
    const rowIndices = selectedCells.map((cell) => cell.rowIndex);
    const colIndices = selectedCells.map((cell) => cell.colIndex);

    const minRowIndex = Math.min(...rowIndices);
    const maxRowIndex = Math.max(...rowIndices);
    const minColIndex = Math.min(...colIndices);
    const maxColIndex = Math.max(...colIndices);

    const lockId = liveTableDoc.lockCellRange(
      minRowIndex,
      maxRowIndex,
      minColIndex,
      maxColIndex
    );

    if (lockId) {
      toast.success(`Locked ${selectedCells.length} cell(s).`);
    } else {
      toast.error("Failed to lock the selected range.");
    }

    return lockId;
  }, [selectedCells, liveTableDoc]);

  const unlockRange = useCallback(
    (lockId: string) => {
      const success = liveTableDoc.unlockRange(lockId);
      if (success) {
        toast.success("Range unlocked successfully.");
      } else {
        toast.error("Failed to unlock range.");
      }
      return success;
    },
    [liveTableDoc]
  );

  const unlockAll = useCallback(() => {
    liveTableDoc.unlockAll();
    toast.success("All locks removed.");
  }, [liveTableDoc]);

  const isCellLocked = useCallback(
    (rowIndex: number, colIndex: number) => {
      return liveTableDoc.isCellLocked(rowIndex, colIndex);
    },
    [liveTableDoc]
  );

>>>>>>> Stashed changes
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

  return (
    <LiveTableContext.Provider
      value={{
        tableId,
        documentTitle,
        documentDescription,
        tableData,
        headers,
        columnWidths,
        isTableLoaded,
        generateAndInsertRows,
        deleteRows,
        generateAndInsertColumns,
        deleteColumns,
        reorderColumn,
        awarenessStates,
        cursorsData,
        getCursorsForCell,
      }}
    >
      <DataStoreProvider
        liveTableDoc={liveTableDoc}
        yProvider={yProvider}
        headers={headers}
      >
        {children}
      </DataStoreProvider>
    </LiveTableContext.Provider>
  );
};

export const useLiveTable = () => {
  const context = useContext(LiveTableContext);
  if (context === undefined) {
    throw new Error("useLiveTable must be used within a LiveTableProvider");
  }
  return context;
};

export default LiveTableProvider;
