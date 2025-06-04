import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { UndoManager } from "yjs";
import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";
import { immer } from "zustand/middleware/immer";

import { LiveblocksYjsProvider } from "@liveblocks/yjs";

import type {
  AwarenessState,
  CursorDataForCell,
  LiveTableDoc,
} from "@/components/live-table/live-table-doc";
import type { CellPosition } from "@/stores/selection-store";

import {
  deleteColumns,
  generateAndInsertColumns,
  reorderColumn,
} from "./data-store-fns/manage-columns";
import { getCursorsForCell } from "./data-store-fns/manage-cursors";
import {
  lockSelectedRange,
  unlockAll,
  unlockRange,
} from "./data-store-fns/manage-locks";
import {
  deleteRows,
  generateAndInsertRows,
} from "./data-store-fns/manage-rows";
import SyncDocumentTitleAndDescription from "./sync-doc";

// -----
// Types
// -----

interface DataState {
  lockedCells: Set<string>;
  editingHeaderIndex: number | null;
  editingHeaderValue: string;
  editingCell: { rowIndex: number; colIndex: number } | null;
  headers: string[] | undefined;
  columnWidths: Record<string, number> | undefined;
  tableData: Record<string, unknown>[] | undefined;
  cursorsData: CursorDataForCell[] | undefined;
  awarenessStates: Map<number, AwarenessState | null> | undefined;
  documentTitle: string | undefined;
  documentDescription: string | undefined;
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
  generateAndInsertRows: (
    initialInsertIndex: number,
    numRowsToAdd: number
  ) => Promise<{ aiRowsAdded: number; defaultRowsAdded: number }>;
  deleteRows: (rowIndices: number[]) => Promise<{ deletedCount: number }>;
  generateAndInsertColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{ aiColsAdded: number; defaultColsAdded: number }>;
  deleteColumns: (colIndices: number[]) => Promise<{ deletedCount: number }>;
  reorderColumn: (fromIndex: number, toIndex: number) => void;
  getCursorsForCell: (
    rowIndex: number,
    colIndex: number
  ) => CursorDataForCell | undefined;
  setDocumentTitle: (title: string) => void;
  setDocumentDescription: (description: string) => void;
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
  headers: undefined,
  columnWidths: undefined,
  tableData: undefined,
  cursorsData: undefined,
  awarenessStates: undefined,
  documentTitle: undefined,
  documentDescription: undefined,
};

function createDataStore(
  liveTableDoc: LiveTableDoc,
  yProvider: LiveblocksYjsProvider,
  documentTitle: string,
  documentDescription: string
) {
  return createStore<DataStore>()(
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
        liveTableDoc.isCellLocked(rowIndex, colIndex),

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
        set((state) => {
          state.editingHeaderIndex = colIndex;
          state.editingHeaderValue = state.headers?.[colIndex] || "";
        });
      },

      handleHeaderChange: (value: string) => {
        set((state) => {
          state.editingHeaderValue = value;
        });
      },

      handleHeaderBlur: () => {
        const state = get();
        if (state.editingHeaderIndex === null || !state.headers) return;

        const oldHeader = state.headers[state.editingHeaderIndex];
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

      setEditingCell: (cell: { rowIndex: number; colIndex: number } | null) => {
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

      generateAndInsertRows: (
        initialInsertIndex: number,
        numRowsToAdd: number
      ) => {
        const { headers, tableData,, documentDescription } =
          get();
        if (!headers || !tableData || !documentTitle || !documentDescription) {
          throw new Error(
            "Headers or table data not available. Cannot generate rows."
          );
        }
        return generateAndInsertRows(
          initialInsertIndex,
          numRowsToAdd,
          liveTableDoc,
          headers,
          tableData,
          documentTitle,
          documentDescription
        );
      },

      deleteRows: (rowIndices: number[]) =>
        deleteRows(rowIndices, liveTableDoc),

      generateAndInsertColumns: (
        initialInsertIndex: number,
        numColsToAdd: number
      ) => {
        const { headers, tableData, documentTitle, documentDescription } =
          get();
        if (!headers || !tableData || !documentTitle || !documentDescription) {
          throw new Error(
            "Headers or table data not available. Cannot generate columns."
          );
        }
        return generateAndInsertColumns(
          initialInsertIndex,
          numColsToAdd,
          liveTableDoc,
          headers,
          tableData,
          documentTitle,
          documentDescription
        );
      },

      deleteColumns: (colIndices: number[]) =>
        deleteColumns(colIndices, liveTableDoc),

      reorderColumn: (fromIndex: number, toIndex: number) =>
        reorderColumn(fromIndex, toIndex, liveTableDoc),

      getCursorsForCell: (rowIndex: number, colIndex: number) => {
        const { cursorsData } = get();
        if (!cursorsData) throw Error("Cursors data not available.");
        return getCursorsForCell(rowIndex, colIndex, cursorsData);
      },

      setDocumentTitle: (title: string) => {
        set((state) => {
          state.documentTitle = title;
        });
      },

      setDocumentDescription: (description: string) => {
        set((state) => {
          state.documentDescription = description;
        });
      },
    }))
  );
}


// --------
// Provider
// --------

/**
 * A provider for the data store.
 * @param tableId - A unique, long-lived identifier that can be used as a cache key
 * for the store.
 * @param liveTableDoc - The live table document.
 * @param yProvider - The Liveblocks Yjs provider.
 * @param documentTitle - The title of the document.
 * @param documentDescription - The description of the document.
 * @param children - The children to render.
 *
 * TODO cache the store on ID when possible, but clear the cache if a new one
 * comes along.
 */
export const DataStoreProvider = ({
  tableId,
  liveTableDoc,
  yProvider,
  documentTitle,
  documentDescription,
  children,
}: {
  tableId: string;
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
  documentTitle: string;
  documentDescription: string;
  children: React.ReactNode;
}) => {
  return (
    <DataStoreProviderChild
      // using key to force a new store instance when the id changes
      key={tableId}
      liveTableDoc={liveTableDoc}
      yProvider={yProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      {children}
    </DataStoreProviderChild>
  );
};

function DataStoreProviderChild({
  liveTableDoc,
  yProvider,
  documentTitle,
  documentDescription,
  children,
}: {
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
  documentTitle: string;
  documentDescription: string;
  children: React.ReactNode;
}) {
  // create the store once
  const [store] = useState(() =>
    createDataStore(liveTableDoc, yProvider, documentTitle, documentDescription)
  );

  // Wire up the store to the liveTableDoc
  useEffect(() => {
    liveTableDoc.headersUpdateCallback = (headers: string[]) => {
      store.setState((state) => {
        state.headers = headers;
      });
    };
    liveTableDoc.tableDataUpdateCallback = (
      tableData: Record<string, unknown>[]
    ) => {
      store.setState((state) => {
        state.tableData = tableData;
      });
    };
    liveTableDoc.columnWidthsUpdateCallback = (
      columnWidths: Record<string, number>
    ) => {
      store.setState((state) => {
        state.columnWidths = columnWidths;
      });
    };
    liveTableDoc.lockedCellsUpdateCallback = (lockedCells: Set<string>) => {
      store.setState((state) => {
        state.lockedCells = lockedCells;
      });
    };
    liveTableDoc.awarenessStatesUpdateCallback = (
      awarenessStates: Map<number, AwarenessState | null>
    ) => {
      store.setState((state) => {
        state.awarenessStates = awarenessStates;
      });
    };
    liveTableDoc.cursorsDataUpdateCallback = (
      cursorsData: CursorDataForCell[]
    ) => {
      store.setState((state) => {
        state.cursorsData = cursorsData;
      });
    };
  }, [liveTableDoc, store]);

  // wire up yjs observers
  useEffect(() => {
    liveTableDoc.initializeObservers();
    return () => {
      liveTableDoc.cleanupObservers();
    };
  }, [liveTableDoc]);

  /**
   *  TODO connect to the awareness provider:
   *
   *  // Update awareness when local selection changes
   *  useEffect(() => {
   *  yProvider.awareness.setLocalStateField("selectionArea", {
   *  startCell: selectionArea.startCell
   *  ? { ...selectionArea.startCell }
   *  : null,
   *  endCell: selectionArea.endCell ? { ...selectionArea.endCell } : null,
   *  });
   *  }, [selectedCells, yProvider.awareness, selectionArea]);
   */
  // // Memoized function to update React state with awareness changes
  // const updateAwarenessStateCallback = useCallback(() => {
  //   const currentStates = new Map(
  //     yProvider.awareness.getStates() as Map<number, AwarenessState | null>
  //   );
  //   liveTableDoc.updateAwarenessState(currentStates);
  // }, [yProvider.awareness, liveTableDoc]);

  // // Set up the awareness observer
  // useEffect(() => {
  //   liveTableDoc.updateAwarenessStateObserver = updateAwarenessStateCallback;
  // }, [liveTableDoc, updateAwarenessStateCallback]);

  // // Effect to subscribe to awareness changes
  // useEffect(() => {
  //   // Initial load of awareness states
  //   updateAwarenessStateCallback();

  //   // Listen for awareness changes
  //   yProvider.awareness.on("update", updateAwarenessStateCallback);

  //   // Cleanup on unmount
  //   return () => {
  //     yProvider.awareness.off("update", updateAwarenessStateCallback);
  //   };
  // }, [updateAwarenessStateCallback, yProvider.awareness]);

  // // update self info in awareness
  // useUpdatedSelf(yProvider);

  return (
    <DataStoreContext.Provider value={store}>
      {/* Sync with SWR without causing re-renders */}
      <SyncDocumentTitleAndDescription />
      {children}
    </DataStoreContext.Provider>
  );
}

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
export const useHeaders = () => useDataStore((state) => state.headers);
export const useTableData = () => useDataStore((state) => state.tableData);
export const useColumnWidths = () =>
  useDataStore((state) => state.columnWidths);
export const useGenerateAndInsertRows = () =>
  useDataStore((state) => state.generateAndInsertRows);
export const useDeleteRows = () => useDataStore((state) => state.deleteRows);
export const useGenerateAndInsertColumns = () =>
  useDataStore((state) => state.generateAndInsertColumns);
export const useDeleteColumns = () =>
  useDataStore((state) => state.deleteColumns);
export const useReorderColumn = () =>
  useDataStore((state) => state.reorderColumn);
export const useAwarenessStates = () =>
  useDataStore((state) => state.awarenessStates);
export const useDocumentTitle = () =>
  useDataStore((state) => state.documentTitle);
export const useDocumentDescription = () =>
  useDataStore((state) => state.documentDescription);
export const useSetDocumentTitle = () =>
  useDataStore((state) => state.setDocumentTitle);
export const useSetDocumentDescription = () =>
  useDataStore((state) => state.setDocumentDescription);

// derived
// TODO fix the fact that headers will come
// in as empty array at first, so isTableLoaded is hard to calculate
// precisely.
export const useIsTableLoaded = () =>
  useDataStore(
    (state) => state.headers && state.tableData && state.columnWidths
  );
