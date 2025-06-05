/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import {
  createContext,
  useContext,
  useState,
} from "react";

import { toast } from "sonner";
import { UndoManager } from "yjs";
import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";
import { immer } from "zustand/middleware/immer";

import { LiveblocksYjsProvider } from "@liveblocks/yjs";

import type { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import {
  generateAndInsertColumns,
} from "@/components/live-table/manage-columns";
import { generateAndInsertRows } from "@/components/live-table/manage-rows";
import type { CellPosition } from "@/stores/selectionStore";

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
  setLockedCells: (lockedCells: Set<string>) => void;
  lockSelectedRange: (selectedCells: CellPosition[]) => string | null;
  unlockRange: (lockId: string) => boolean;
  unlockAll: () => void;
  isCellLocked: (rowIndex: number, colIndex: number) => boolean;
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
  handleCellBlur: () => void;
  handleHeaderDoubleClick: (colIndex: number) => void;
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
  // columns
  generateAndInsertColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{ aiColsAdded: number; defaultColsAdded: number }>;
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

/**
 * Check if a cell is locked.
 * @param rowIndex - The row index.
 * @param colIndex - The column index.
 * @param liveTableDoc - The live table document.
 * @returns True if the cell is locked, false otherwise.
 */
function isCellLocked(
  rowIndex: number,
  colIndex: number,
  liveTableDoc: LiveTableDoc
) {
  return liveTableDoc.isCellLocked(rowIndex, colIndex);
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
        setLockedCells: (lockedCells: Set<string>) => {
          set({ lockedCells });
          liveTableDoc.lockedCellsUpdateCallback?.(lockedCells);
        },
        lockSelectedRange: (selectedCells: CellPosition[]) =>
          lockSelectedRange(selectedCells, liveTableDoc),
        unlockRange: (lockId: string) => unlockRange(lockId, liveTableDoc),
        unlockAll: () => unlockAll(liveTableDoc),
        isCellLocked: (rowIndex: number, colIndex: number) =>
          isCellLocked(rowIndex, colIndex, liveTableDoc),
        handleCellFocus: (rowIndex: number, colIndex: number) => {
          yProvider.awareness.setLocalStateField("selectedCell", {
            rowIndex,
            colIndex,
          });
        },
        handleCellBlur: () => {
          yProvider.awareness.setLocalStateField("selectedCell", null);
        },
        handleHeaderDoubleClick: (colIndex: number) => {
          if (!headers) return;
          set((state) => {
            state.editingHeaderIndex = colIndex;
            state.editingHeaderValue = headers[colIndex];
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
          set((state) => {
            state.editingCell = cell;
          });
        },
        getUndoManager: () => liveTableDoc.undoManager,
        setEditingHeaderIndex: (index: number | null) => {
          set((state) => {
            state.editingHeaderIndex = index;
          });
        },

        generateAndInsertRows: async (
          initialInsertIndex: number,
          numRowsToAdd: number
        ) => {
          if (!headers || !tableData || !liveTableDoc) {
            toast.error(
              "Table data or document not available. Cannot add rows."
            );
            return { aiRowsAdded: 0, defaultRowsAdded: 0 };
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

        generateAndInsertColumns: async (
          initialInsertIndex: number,
          numColsToAdd: number
        ) => {
          if (!headers || !tableData || !liveTableDoc) {
            toast.error(
              "Table data or document not available. Cannot add columns."
            );
            return { aiColsAdded: 0, defaultColsAdded: 0 };
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
      }))
    )
  );
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

export const useLockedCells = () => useDataStore((state) => state.lockedCells);
export const useLockSelectedRange = () =>
  useDataStore((state) => state.lockSelectedRange);
export const useUnlockRange = () => useDataStore((state) => state.unlockRange);
export const useUnlockAll = () => useDataStore((state) => state.unlockAll);
export const useIsCellLocked = () =>
  useDataStore((state) => state.isCellLocked);
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
export const useGenerateAndInsertColumns = () =>
  useDataStore((state) => state.generateAndInsertColumns);
