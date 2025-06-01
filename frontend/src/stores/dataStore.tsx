/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import {
  createContext,
  useContext,
  useState,
} from "react";

import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";
import { immer } from "zustand/middleware/immer";

import type { LiveTableDoc } from "@/components/live-table/LiveTableDoc";

// -----
// Types
// -----

interface DataState {
  lockedCells: Set<string>;
}

interface DataActions {
  setLockedCells: (lockedCells: Set<string>) => void;
}

export type DataStore = DataState & DataActions;

// -----
// Store
// -----

const DataStoreContext = createContext<StoreApi<DataStore> | null>(null);

const initialState: DataState = {
  lockedCells: new Set<string>(),
};

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
