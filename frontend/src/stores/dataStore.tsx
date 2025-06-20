import { createContext, useContext, useEffect, useState } from "react";

import { toast } from "sonner";
import { UndoManager } from "yjs";
import { createStore, StoreApi, useStore } from "zustand";

import { type LiveblocksYjsProvider } from "@liveblocks/yjs";
import { type YSweetProvider } from "@y-sweet/react";

import type {
  DataType,
  LiveTableDoc,
} from "@/components/live-table/LiveTableDoc";
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
import type { CellPosition, SelectedCell } from "@/stores/selectionStore";

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
  lockedCells: Map<string, string | undefined>;

  // table data
  tableData: Record<string, unknown>[];
  headers: string[];
  isTableLoaded: boolean;

  // refs
  tableRef: React.RefObject<HTMLTableElement | null> | undefined;
}

interface DataActions {
  // interactions
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
  sortByColumn: (header: string, direction: "asc" | "desc") => void;
  deleteColumns: (colIndices: number[]) => Promise<{ deletedCount: number }>;
  handleColumnResize: (header: string, newWidth: number) => void;

  // column data types
  updateColumnDataType: (
    headerName: string,
    dataType: DataType,
    enumValues?: string[]
  ) => void;
  getColumnDataType: (headerName: string) => DataType;
  getColumnEnumValues: (headerName: string) => string[] | undefined;

  // locked cells
  lockSelectedRange: (
    selectedCells: CellPosition[],
    note?: string
  ) => string | null;
  lockAndSaveSelectedRange: (
    note: string,
    selectedCellsNewValues: SelectedCell[]
  ) => string | null;
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
const DocumentIdContext = createContext<string | null>(null);

const initialState: DataState = {
  documentTitle: "",
  documentDescription: "",
  lockedCells: new Map<string, string | undefined>(),
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
 * @param note - Optional note to associate with the lock.
 * @returns The lock ID if successful, null otherwise.
 */
function lockSelectedRange(
  selectedCells: CellPosition[],
  liveTableDoc: LiveTableDoc,
  note?: string
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
    maxColIndex,
    note
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
  docId,
}: {
  children: React.ReactNode;
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider | YSweetProvider;
  documentTitle: string;
  documentDescription: string;
  docId: string;
}) => {
  const [store] = useState(() =>
    createStore<DataStore>()((set, get) => ({
      ...initialState,
      lockSelectedRange: (selectedCells: CellPosition[], note?: string) =>
        lockSelectedRange(selectedCells, liveTableDoc, note),

      lockAndSaveSelectedRange: (
        note: string,
        selectedCellsNewValues: SelectedCell[]
      ) => liveTableDoc.lockAndSaveSelectedRange(note, selectedCellsNewValues),

      unlockRange: (lockId: string) => unlockRange(lockId, liveTableDoc),
      unlockAll: () => unlockAll(liveTableDoc),
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
      sortByColumn: (header: string, direction: "asc" | "desc") => {
        liveTableDoc.sortRowsByColumn(header, direction);
      },
      deleteColumns: (colIndices: number[]) =>
        deleteColumns(colIndices, liveTableDoc),
      handleColumnResize: (header: string, newWidth: number) => {
        liveTableDoc.updateColumnWidth(header, newWidth);
      },

      // column data types
      updateColumnDataType: (
        headerName: string,
        dataType: DataType,
        enumValues?: string[]
      ) => {
        liveTableDoc.updateColumnDataType(headerName, dataType, enumValues);
      },
      getColumnDataType: (headerName: string) => {
        return liveTableDoc.getColumnDataType(headerName);
      },
      getColumnEnumValues: (headerName: string) => {
        return liveTableDoc.getColumnEnumValues(headerName);
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
      store.setState({ tableData: newData, isTableLoaded: true });
    };
    liveTableDoc.tableDataUpdateCallback = handleTableDataUpdate;

    const handleLockedCellsUpdate = (
      lockedCells: Map<string, string | undefined>
    ) => {
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
      <DocumentIdContext.Provider value={docId}>
        {children}
      </DocumentIdContext.Provider>
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
export const useEditingHeaderValue = (index: number) =>
  useDataStore((state) => {
    // only update if this cell is being edited. ("" === "")
    if (state.editingHeaderIndex !== index) return "";
    return state.editingHeaderValue;
  });
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
export const useSortByColumn = () =>
  useDataStore((state) => state.sortByColumn);

// column widths
export const useColumnWidths = () =>
  useDataStore((state) => state.columnWidths);
export const useHandleColumnResize = () =>
  useDataStore((state) => state.handleColumnResize);

// column data types
export const useUpdateColumnDataType = () =>
  useDataStore((state) => state.updateColumnDataType);
export const useGetColumnDataType = () =>
  useDataStore((state) => state.getColumnDataType);
export const useGetColumnEnumValues = () =>
  useDataStore((state) => state.getColumnEnumValues);

// locked cells
export const useLockedCells = () => useDataStore((state) => state.lockedCells);
export const useLockSelectedRange = () =>
  useDataStore((state) => state.lockSelectedRange);
export const useLockAndSaveSelectedRange = () =>
  useDataStore((state) => state.lockAndSaveSelectedRange);
export const useUnlockRange = () => useDataStore((state) => state.unlockRange);
export const useUnlockAll = () => useDataStore((state) => state.unlockAll);

export const useIsCellLocked = (rowIndex: number, colIndex: number) =>
  useDataStore((state) => state.lockedCells.has(`${rowIndex}-${colIndex}`));

export const useLockNoteForCell = (rowIndex: number, colIndex: number) =>
  useDataStore((state) => state.lockedCells.get(`${rowIndex}-${colIndex}`));

export const useIsCellLockedFn = () => {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error(
      "useIsCellLockedFn must be used within a DataStoreProvider"
    );
  }
  // This hook provides a non-reactive function to check if a cell is locked.
  // It's useful for event handlers where you don't want to re-render the component
  // every time the lockedCells set changes, but you need the latest state.
  const isCellLocked = (rowIndex: number, colIndex: number) => {
    return store.getState().lockedCells.has(`${rowIndex}-${colIndex}`);
  };
  return isCellLocked;
};

// table data
export const useHeaders = () => useDataStore((state) => state.headers);
export const useTableData = () => useDataStore((state) => state.tableData);
export const useIsTableLoaded = () =>
  useDataStore((state) => state.isTableLoaded);

// refs
export const useTableRef = () => useDataStore((state) => state.tableRef);
export const useSetTableRef = () => useDataStore((state) => state.setTableRef);

export const useDocumentId = (): string => {
  const context = useContext(DocumentIdContext);
  if (!context) {
    throw new Error("useDocumentId must be used within a DocumentIdContext");
  }
  return context;
};
