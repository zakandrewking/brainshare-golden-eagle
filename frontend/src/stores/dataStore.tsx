/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import { createContext, useContext, useEffect, useState } from "react";

import { enableMapSet } from "immer";
import { toast } from "sonner";
import { UndoManager } from "yjs";
import { createStore, StoreApi, useStore } from "zustand";
import { immer } from "zustand/middleware/immer";

import { LiveblocksYjsProvider } from "@liveblocks/yjs";

import type { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import {
  deleteColumns,
  generateAndInsertColumns,
  generateUniqueDefaultHeader,
} from "@/components/live-table/manage-columns";
import {
  deleteRows,
  generateAndInsertRows,
  insertEmptyRows,
} from "@/components/live-table/manage-rows";
import type { CellPosition } from "@/stores/selectionStore";

enableMapSet();

// -----
// Types
// -----

interface DataState {
  lockedCells: Set<string>;
  editingHeaderIndex: number | null;
  editingHeaderValue: string;
  editingCell: { rowIndex: number; colIndex: number } | null;
}

interface DataActions {
  lockSelectedRange: (selectedCells: CellPosition[]) => string | null;
  unlockRange: (lockId: string) => boolean;
  unlockAll: () => void;
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
  handleCellBlur: () => void;
  handleHeaderDoubleClick: (colIndex: number, currentHeaders: string[]) => void;
  handleHeaderChange: (value: string) => void;
  handleHeaderBlur: () => void;
  handleColumnResize: (header: string, newWidth: number) => void;
  handleCellChange: (
    rowIndex: number,
    header: string,
    newValue: string
  ) => void;
  setEditingCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
  getUndoManager: () => UndoManager;
  setEditingHeaderIndex: (index: number | null) => void;
  // rows
  generateAndInsertRows: (
    initialInsertIndex: number,
    numRowsToAdd: number
  ) => Promise<{ aiRowsAdded: number; defaultRowsAdded: number }>;
  insertEmptyRows: (
    initialInsertIndex: number,
    numRowsToAdd: number
  ) => Promise<{ defaultRowsAdded: number }>;
  deleteRows: (rowIndices: number[]) => Promise<{ deletedCount: number }>;
  // columns
  generateAndInsertColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{ aiColsAdded: number; defaultColsAdded: number }>;
  insertEmptyColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{ count: number }>;
  reorderColumn: (fromIndex: number, toIndex: number) => void;
  deleteColumns: (colIndices: number[]) => Promise<{ deletedCount: number }>;
}

export type DataStore = DataState & DataActions;

// -----
// Store
// -----

const DataStoreContext = createContext<StoreApi<DataStore> | null>(null);

const initialState: DataState = {
  lockedCells: new Set<string>(),
  editingHeaderIndex: null,
  editingHeaderValue: "",
  editingCell: null,
};

/**
 * Lock the selected range of cells.
 * @param selectedCells - The selected cells to lock.
 * @param liveTableDoc - The live table document.
 * @returns The lock ID if successful, null otherwise.
 */
function lockSelectedRange(
  selectedCells: CellPosition[],
  liveTableDoc: LiveTableDoc
) {
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
}

/**
 * Unlock a specific lock range.
 * @param lockId - The ID of the lock to remove.
 * @param liveTableDoc - The live table document.
 * @returns True if the lock was removed, false if not found.
 */
function unlockRange(lockId: string, liveTableDoc: LiveTableDoc) {
  const success = liveTableDoc.unlockRange(lockId);
  if (success) {
    toast.success("Range unlocked successfully.");
  } else {
    toast.error("Failed to unlock range.");
  }
  return success;
}

/**
 * Unlock all locks.
 * @param liveTableDoc - The live table document.
 */
function unlockAll(liveTableDoc: LiveTableDoc) {
  liveTableDoc.unlockAll();
  toast.success("All locks removed.");
}

export const DataStoreProvider = ({
  children,
  liveTableDoc,
  yProvider,
  headers,
  tableData,
  documentTitle,
  documentDescription,
}: {
  children: React.ReactNode;
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
  headers: string[] | undefined;
  tableData: Record<string, unknown>[] | undefined;
  documentTitle: string;
  documentDescription: string;
}) => {
  const [store] = useState(() =>
    createStore<DataStore>()(
      immer((set, get) => ({
        ...initialState,
        lockSelectedRange: (selectedCells: CellPosition[]) =>
          lockSelectedRange(selectedCells, liveTableDoc),
        unlockRange: (lockId: string) => unlockRange(lockId, liveTableDoc),
        unlockAll: () => unlockAll(liveTableDoc),
        handleCellFocus: (rowIndex: number, colIndex: number) => {
          yProvider.awareness.setLocalStateField("selectedCell", {
            rowIndex,
            colIndex,
          });
        },
        handleCellBlur: () => {
          yProvider.awareness.setLocalStateField("selectedCell", null);
        },
        handleHeaderDoubleClick: (
          colIndex: number,
          currentHeaders: string[]
        ) => {
          if (!currentHeaders) return;
          set((state) => {
            state.editingHeaderIndex = colIndex;
            state.editingHeaderValue = currentHeaders[colIndex];
          });
        },
        handleHeaderChange: (value: string) => {
          set((state) => {
            state.editingHeaderValue = value;
          });
        },
        handleHeaderBlur: () => {
          const state = get();
          if (state.editingHeaderIndex === null || !headers) return;

          const oldHeader = headers[state.editingHeaderIndex];
          const newHeader = state.editingHeaderValue.trim();

          if (newHeader && newHeader !== oldHeader) {
            liveTableDoc.editHeader(state.editingHeaderIndex, newHeader);
          }

          set((state) => {
            state.editingHeaderIndex = null;
          });
        },
        handleColumnResize: (header: string, newWidth: number) => {
          liveTableDoc.updateColumnWidth(header, newWidth);
        },
        handleCellChange: (
          rowIndex: number,
          header: string,
          newValue: string
        ) => {
          liveTableDoc.updateCell(rowIndex, header, newValue);
        },
        setEditingCell: (
          cell: { rowIndex: number; colIndex: number } | null
        ) => {
          set({ editingCell: cell });
        },
        getUndoManager: () => liveTableDoc.undoManager,
        setEditingHeaderIndex: (index: number | null) => {
          set({ editingHeaderIndex: index });
        },

        generateAndInsertRows: async (
          initialInsertIndex: number,
          numRowsToAdd: number
        ) => {
          if (!liveTableDoc || !headers || !tableData) {
            toast.error("Table data not fully loaded.");
            throw new Error("Table data not fully loaded.");
          }
          return generateAndInsertRows(
            initialInsertIndex,
            numRowsToAdd,
            headers,
            tableData,
            documentTitle,
            documentDescription,
            liveTableDoc
          );
        },

        insertEmptyRows: async (
          initialInsertIndex: number,
          numRowsToAdd: number
        ) => {
          if (!liveTableDoc) {
            toast.error("Table data not fully loaded.");
            throw new Error("Table data not fully loaded.");
          }
          return insertEmptyRows(
            initialInsertIndex,
            numRowsToAdd,
            liveTableDoc
          );
        },

        deleteRows: async (rowIndices: number[]) => {
          if (!liveTableDoc) {
            toast.error("Table document not available.");
            throw new Error("Table document not available.");
          }
          return deleteRows(rowIndices, liveTableDoc);
        },

        generateAndInsertColumns: async (
          initialInsertIndex: number,
          numColsToAdd: number
        ) => {
          if (!liveTableDoc || !headers || !tableData) {
            toast.error("Table data not fully loaded.");
            throw new Error("Table data not fully loaded.");
          }
          return generateAndInsertColumns(
            initialInsertIndex,
            numColsToAdd,
            headers,
            tableData,
            documentTitle,
            documentDescription,
            liveTableDoc
          );
        },

        insertEmptyColumns: async (
          initialInsertIndex: number,
          numColsToAdd: number
        ) => {
          if (!liveTableDoc) {
            toast.error("Table document not available.");
            throw new Error("Table document not available.");
          }
          if (numColsToAdd <= 0) {
            toast.info("Number of columns to add must be positive.");
            return { count: 0 };
          }

          const currentHeaders = headers || [];

          const columnsToInsert: {
            headerName: string;
            columnData: null;
          }[] = [];

          for (let i = 0; i < numColsToAdd; i++) {
            const headerName = generateUniqueDefaultHeader(
              "Column",
              currentHeaders,
              columnsToInsert
            );
            columnsToInsert.push({
              headerName,
              columnData: null,
            });
          }

          try {
            const insertedCount = liveTableDoc.insertColumns(
              initialInsertIndex,
              columnsToInsert
            );
            if (insertedCount > 0) {
              toast.success(
                `Successfully added ${insertedCount} empty column(s).`
              );
            } else if (numColsToAdd > 0 && insertedCount === 0) {
              toast.info(
                "No empty columns were added. This might be an internal issue."
              );
            }
            return { count: insertedCount };
          } catch (error) {
            console.error("Error inserting empty columns:", error);
            const errorMessage =
              error instanceof Error
                ? error.message
                : "An unknown error occurred.";
            toast.error(`Failed to add empty columns: ${errorMessage}`);
            throw error;
          }
        },

        reorderColumn: (fromIndex: number, toIndex: number) => {
          liveTableDoc.reorderColumn(fromIndex, toIndex);
        },

        deleteColumns: async (colIndices: number[]) => {
          if (!liveTableDoc) {
            toast.error("Table document not available.");
            throw new Error("Table document not available.");
          }
          return deleteColumns(colIndices, liveTableDoc);
        },
      }))
    )
  );

  useEffect(() => {
    // wire up callbacks
    liveTableDoc.lockedCellsUpdateCallback = (lockedCells: Set<string>) =>
      store.setState({ lockedCells });
    liveTableDoc.updateLockedCellsState();
  }, [liveTableDoc, store]);

  return (
    <DataStoreContext.Provider value={store}>
      {children}
    </DataStoreContext.Provider>
  );
};

// hooks
function useDataStore(): DataStore;
function useDataStore<T>(selector: (state: DataStore) => T): T;
function useDataStore<T>(selector?: (state: DataStore) => T) {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("DataStoreContext not found");
  }
  return useStore(store, selector!);
}

export const useUnlockRange = () => useDataStore((state) => state.unlockRange);
export const useUnlockAll = () => useDataStore((state) => state.unlockAll);
export const useHandleCellFocus = () =>
  useDataStore((state) => state.handleCellFocus);
export const useHandleCellBlur = () =>
  useDataStore((state) => state.handleCellBlur);
export const useHandleHeaderDoubleClick = () =>
  useDataStore((state) => state.handleHeaderDoubleClick);
export const useHandleHeaderChange = () =>
  useDataStore((state) => state.handleHeaderChange);
export const useHandleHeaderBlur = () =>
  useDataStore((state) => state.handleHeaderBlur);
export const useHandleColumnResize = () =>
  useDataStore((state) => state.handleColumnResize);
export const useEditingHeaderIndex = () =>
  useDataStore((state) => state.editingHeaderIndex);
export const useEditingHeaderValue = () =>
  useDataStore((state) => state.editingHeaderValue);
export const useHandleCellChange = () =>
  useDataStore((state) => state.handleCellChange);
export const useSetEditingCell = () =>
  useDataStore((state) => state.setEditingCell);
export const useEditingCell = () => useDataStore((state) => state.editingCell);
export const useUndoManager = () =>
  useDataStore((state) => state.getUndoManager());
export const useSetEditingHeaderIndex = () =>
  useDataStore((state) => state.setEditingHeaderIndex);
export const useGenerateAndInsertRows = () =>
  useDataStore((state) => state.generateAndInsertRows);
export const useInsertEmptyRows = () =>
  useDataStore((state) => state.insertEmptyRows);
export const useDeleteRows = () => useDataStore((state) => state.deleteRows);
export const useDeleteColumns = () =>
  useDataStore((state) => state.deleteColumns);
export const useGenerateAndInsertColumns = () =>
  useDataStore((state) => state.generateAndInsertColumns);
export const useInsertEmptyColumns = () =>
  useDataStore((state) => state.insertEmptyColumns);
export const useReorderColumn = () =>
  useDataStore((state) => state.reorderColumn);

// locked cells
export const useLockedCells = () => useDataStore((state) => state.lockedCells);
export const useLockSelectedRange = () =>
  useDataStore((state) => state.lockSelectedRange);

export const useIsCellLocked = (rowIndex: number, colIndex: number) =>
  useDataStore((state) => state.lockedCells.has(`${rowIndex}-${colIndex}`));

export const useIsCellLockedFn = () => {
  // don't call useDataStore because we don't want to trigger a re-render
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("DataStoreContext not found");
  }
  return (rowIndex: number, colIndex: number) =>
    store.getState().lockedCells.has(`${rowIndex}-${colIndex}`);
};
