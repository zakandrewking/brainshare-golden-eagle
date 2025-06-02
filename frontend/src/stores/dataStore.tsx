/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import {
  createContext,
  useContext,
  useState,
} from "react";

import { toast } from "sonner";
import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";
import { immer } from "zustand/middleware/immer";

import type { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import type { CellPosition } from "@/stores/selectionStore";

// -----
// Types
// -----

interface DataState {
  lockedCells: Set<string>;
}

interface DataActions {
  setLockedCells: (lockedCells: Set<string>) => void;
  lockSelectedRange: (selectedCells: CellPosition[]) => string | null;
}

export type DataStore = DataState & DataActions;

// -----
// Store
// -----

const DataStoreContext = createContext<StoreApi<DataStore> | null>(null);

const initialState: DataState = {
  lockedCells: new Set<string>(),
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

export const DataStoreProvider = ({
  children,
  liveTableDoc,
}: {
  children: React.ReactNode;
  liveTableDoc: LiveTableDoc;
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
export function useDataStore(): DataStore;
export function useDataStore<T>(selector: (state: DataStore) => T): T;
export function useDataStore<T>(selector?: (state: DataStore) => T) {
  const store = useContext(DataStoreContext);
  if (!store) {
    throw new Error("DataStoreContext not found");
  }
  return useStore(store, selector!);
}

// selector hooks
export const useLockedCells = () => useDataStore((state) => state.lockedCells);
export const useLockSelectedRange = () =>
  useDataStore((state) => state.lockSelectedRange);
