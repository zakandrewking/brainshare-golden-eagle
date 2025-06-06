/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { toast } from "sonner";
import { UndoManager } from "yjs";
import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";

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

// -----
// Types
// -----

interface DataState {
  // document info
  documentTitle: string;
  documentDescription: string;

  // editing
  editingHeaderIndex: number | null;
  editingHeaderValue: string;
  editingCell: { rowIndex: number; colIndex: number } | null;

  // columns
  columnWidths: Record<string, number> | undefined;

  // locked cells
  lockedCells: Set<string>;

  // table data
  tableData: Record<string, unknown>[];
  headers: string[];
  isTableLoaded: boolean;

  // refs
  tableRef: React.RefObject<HTMLTableElement | null> | undefined;
}

interface DataActions {
  // interactions
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
  handleCellBlur: () => void;
  handleHeaderDoubleClick: (colIndex: number) => void;
  handleHeaderChange: (value: string) => void;
  handleHeaderBlur: () => void;

  // editing
  handleCellChange: (
    rowIndex: number,
    header: string,
    newValue: string
  ) => void;
  setEditingCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
  setEditingHeaderIndex: (index: number | null) => void;

  // undo
  getUndoManager: () => UndoManager;

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
  handleColumnResize: (header: string, newWidth: number) => void;

  // locked cells
  lockSelectedRange: (selectedCells: CellPosition[]) => string | null;
  unlockRange: (lockId: string) => boolean;
  unlockAll: () => void;

  // refs
  setTableRef: (ref: React.RefObject<HTMLTableElement | null>) => void;
}

export type DataStore = DataState & DataActions;

// -----
// Store
// -----

const DataStoreContext = createContext<StoreApi<DataStore> | null>(null);

const initialState: DataState = {
  documentTitle: "",
  documentDescription: "",
  lockedCells: new Set<string>(),
  editingHeaderIndex: null,
  editingHeaderValue: "",
  editingCell: null,
  headers: [],
  tableData: [],
  isTableLoaded: false,
  columnWidths: undefined,
  tableRef: undefined,
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
  documentTitle,
  documentDescription,
}: {
  children: React.ReactNode;
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
  documentTitle: string;
  documentDescription: string;
}) => {
  const [store] = useState(() =>
    createStore<DataStore>()((set, get) => ({
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
      handleHeaderDoubleClick: (colIndex: number) => {
        const headers = get().headers;
        if (!headers) return;
        set({
          editingHeaderIndex: colIndex,
          editingHeaderValue: headers[colIndex],
        });
      },
      handleHeaderChange: (value: string) => {
        set({
          editingHeaderValue: value,
        });
      },
      handleHeaderBlur: () => {
        const state = get();
        if (state.editingHeaderIndex === null) return;
        const headers = state.headers;

        const oldHeader = headers[state.editingHeaderIndex];
        const newHeader = state.editingHeaderValue.trim();

        if (newHeader && newHeader !== oldHeader) {
          liveTableDoc.editHeader(state.editingHeaderIndex, newHeader);
        }

        set({
          editingHeaderIndex: null,
        });
      },
      handleCellChange: (
        rowIndex: number,
        header: string,
        newValue: string
      ) => {
        liveTableDoc.updateCell(rowIndex, header, newValue);
      },
      setEditingCell: (cell: { rowIndex: number; colIndex: number } | null) => {
        set({ editingCell: cell });
      },
      getUndoManager: () => liveTableDoc.undoManager,
      setEditingHeaderIndex: (index: number | null) => {
        set({ editingHeaderIndex: index });
      },
      generateAndInsertRows: (
        initialInsertIndex: number,
        numRowsToAdd: number
      ) => {
        const { headers, tableData } = get();
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
      insertEmptyRows: (initialInsertIndex: number, numRowsToAdd: number) =>
        insertEmptyRows(initialInsertIndex, numRowsToAdd, liveTableDoc),
      deleteRows: (rowIndices: number[]) =>
        deleteRows(rowIndices, liveTableDoc),
      generateAndInsertColumns: (
        initialInsertIndex: number,
        numColsToAdd: number
      ) => {
        const { headers, tableData } = get();
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
      insertEmptyColumns: (
        initialInsertIndex: number,
        numColsToAdd: number
      ) => {
        if (numColsToAdd <= 0) {
          return Promise.resolve({ count: 0 });
        }
        const columnsToInsert = Array.from({ length: numColsToAdd }).map(
          () => ({
            headerName: generateUniqueDefaultHeader(
              "New Column",
              get().headers,
              []
            ),
            columnData: null,
          })
        );
        const insertedCount = liveTableDoc.insertColumns(
          initialInsertIndex,
          columnsToInsert
        );
        return Promise.resolve({ count: insertedCount });
      },
      reorderColumn: (fromIndex: number, toIndex: number) => {
        liveTableDoc.reorderColumn(fromIndex, toIndex);
      },
      deleteColumns: (colIndices: number[]) =>
        deleteColumns(colIndices, liveTableDoc),
      handleColumnResize: (header: string, newWidth: number) => {
        liveTableDoc.updateColumnWidth(header, newWidth);
      },

      // refs
      setTableRef: (ref: React.RefObject<HTMLTableElement | null>) => {
        set({ tableRef: ref });
      },
    }))
  );

  // wire up yjs
  useEffect(() => {
    let synced = false;
    const handleHeadersUpdate = (newHeaders: string[]) => {
      store.setState({ headers: newHeaders });
    };

    // wire up callbacks
    liveTableDoc.headersUpdateCallback = handleHeadersUpdate;

    const handleTableDataUpdate = (newData: Record<string, unknown>[]) => {
      store.setState({ tableData: newData });
    };
    liveTableDoc.tableDataUpdateCallback = handleTableDataUpdate;

    const handleLockedCellsUpdate = (lockedCells: Set<string>) => {
      store.setState({ lockedCells });
    };
    liveTableDoc.lockedCellsUpdateCallback = handleLockedCellsUpdate;

    const handleColumnWidthsUpdate = (widths: Record<string, number>) => {
      store.setState({ columnWidths: widths });
    };
    liveTableDoc.columnWidthsUpdateCallback = handleColumnWidthsUpdate;

    yProvider.once("synced", () => {
      // this will also trigger the initial state propagation
      liveTableDoc.initializeObservers();
      store.setState({ isTableLoaded: true });
      synced = true;
    });
    return () => {
      liveTableDoc.headersUpdateCallback = undefined;
      liveTableDoc.tableDataUpdateCallback = undefined;
      liveTableDoc.lockedCellsUpdateCallback = undefined;
      liveTableDoc.columnWidthsUpdateCallback = undefined;

      if (synced) {
        liveTableDoc.cleanupObservers();
      }
    };
  }, [liveTableDoc, yProvider, store]);

  // TODO sync these with SWR instead of doing it like this
  useEffect(() => {
    store.setState({
      documentTitle,
      documentDescription,
    });
  }, [documentTitle, documentDescription, store]);

  return (
    <DataStoreContext.Provider value={store}>
      {children}
    </DataStoreContext.Provider>
  );
};

// -----
// Hooks
// -----

function useDataStore(): DataStore;
function useDataStore<T>(selector: (state: DataStore) => T): T;
function useDataStore<T>(selector?: (state: DataStore) => T) {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("DataStoreContext not found");
  }
  return useStore(store, selector!);
}

// document info
export const useDocumentTitle = () =>
  useDataStore((state) => state.documentTitle);
export const useDocumentDescription = () =>
  useDataStore((state) => state.documentDescription);

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

// undo
export const useUndoManager = () =>
  useDataStore((state) => state.getUndoManager());

// editing
export const useEditingHeaderIndex = () =>
  useDataStore((state) => state.editingHeaderIndex);
export const useEditingHeaderValue = () =>
  useDataStore((state) => state.editingHeaderValue);
export const useHandleCellChange = () =>
  useDataStore((state) => state.handleCellChange);
export const useSetEditingCell = () =>
  useDataStore((state) => state.setEditingCell);
export const useEditingCell = () => useDataStore((state) => state.editingCell);
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

// column widths
export const useColumnWidths = () =>
  useDataStore((state) => state.columnWidths);
export const useHandleColumnResize = () =>
  useDataStore((state) => state.handleColumnResize);

// locked cells
export const useLockedCells = () => useDataStore((state) => state.lockedCells);
export const useLockSelectedRange = () =>
  useDataStore((state) => state.lockSelectedRange);
export const useUnlockRange = () => useDataStore((state) => state.unlockRange);
export const useUnlockAll = () => useDataStore((state) => state.unlockAll);

export const useIsCellLocked = (rowIndex: number, colIndex: number) =>
  useDataStore((state) => state.lockedCells.has(`${rowIndex}-${colIndex}`));

export const useIsCellLockedFn = () => {
  // don't call useDataStore because we don't want to trigger a re-render
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("DataStoreContext not found");
  }
  return (rowIndex: number, colIndex: number) => {
    const lockedCells = store.getState().lockedCells;
    return lockedCells.has(`${rowIndex}-${colIndex}`);
  };
};

// table data
export const useHeaders = () => useDataStore((state) => state.headers);
export const useTableData = () => useDataStore((state) => state.tableData);
export const useIsTableLoaded = () =>
  useDataStore((state) => state.isTableLoaded);

// refs
export const useTableRef = () => useDataStore((state) => state.tableRef);
export const useSetTableRef = () => useDataStore((state) => state.setTableRef);
