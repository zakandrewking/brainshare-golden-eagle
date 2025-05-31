/**
 * TODO move data, locks, editing, etc. to this store from LiveTableProvider
 */

import { createContext, useState } from "react";

import { createStore, StoreApi } from "zustand";
import { immer } from "zustand/middleware/immer";

import type { LiveTableDoc } from "@/components/live-table/LiveTableDoc";

// -----
// Types
// -----

interface DataState {
  id: string | null;
}

interface DataActions {
  setId: (id: string) => void;
}

export type DataStore = DataState & DataActions;

// -----
// Store
// -----

const DataStoreContext = createContext<StoreApi<DataStore> | null>(null);

const initialState: DataState = {
  id: null,
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
        setId: (id: string) => {
          set({ id });
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

// export interface LockState {
//   lockedCells: Set<string>;
//   liveTableDoc: LiveTableDoc | null;
//   setLiveTableDoc: (doc: LiveTableDoc) => void;
//   lockSelectedRange: (selectedCells: { rowIndex: number; colIndex: number }[]) => string | null;
//   unlockRange: (lockId: string) => boolean;
//   unlockAll: () => void;
//   isCellLocked: (rowIndex: number, colIndex: number) => boolean;
//   getActiveLocks: () => LockRange[];
//   updateLockedCells: (lockedCells: Set<string>) => void;
// }

// const initialState: Pick<LockState, "lockedCells" | "liveTableDoc"> = {
//   lockedCells: new Set<string>(),
//   liveTableDoc: null,
// };

// use this pattern for a parameterized store
// }: {
//   children: React.ReactNode;
//   user: User | null;
// }) => {
//   const [store] = React.useState(() =>
//     createStore<WidgetStore>()(
//       immer((set, get) => ({
//         ...initialState,
// and this one for standardized loading behavior
// loadWithPrefixedId: async (prefixedId: string) =>
//   loadDataByPrefixedId(
//     set,
//     get,
//     prefixedId,
//     loadTableIdentifications,
//     initialData,
//     "identificationStore"
//   ),
// See https://github.com/zakandrewking/brainshare

//   lockSelectedRange: (selectedCells: { rowIndex: number; colIndex: number }[]) => {
//     const { liveTableDoc } = get();

//     if (!liveTableDoc) {
//       toast.error("Table document not available.");
//       return null;
//     }

//     if (selectedCells.length === 0) {
//       toast.info("No cells selected to lock.");
//       return null;
//     }

//     // Find the bounds of the selection
//     const rowIndices = selectedCells.map(cell => cell.rowIndex);
//     const colIndices = selectedCells.map(cell => cell.colIndex);

//     const minRowIndex = Math.min(...rowIndices);
//     const maxRowIndex = Math.max(...rowIndices);
//     const minColIndex = Math.min(...colIndices);
//     const maxColIndex = Math.max(...colIndices);

//     const lockId = liveTableDoc.lockCellRange(
//       minRowIndex,
//       maxRowIndex,
//       minColIndex,
//       maxColIndex
//     );

//     if (lockId) {
//       toast.success(`Locked ${selectedCells.length} cell(s).`);
//     } else {
//       toast.error("Failed to lock the selected range.");
//     }

//     return lockId;
//   },

//   unlockRange: (lockId: string) => {
//     const { liveTableDoc } = get();

//     if (!liveTableDoc) {
//       toast.error("Table document not available.");
//       return false;
//     }

//     const success = liveTableDoc.unlockRange(lockId);
//     if (success) {
//       toast.success("Range unlocked successfully.");
//     } else {
//       toast.error("Failed to unlock range.");
//     }
//     return success;
//   },

//   unlockAll: () => {
//     const { liveTableDoc } = get();

//     if (!liveTableDoc) {
//       toast.error("Table document not available.");
//       return;
//     }

//     liveTableDoc.unlockAll();
//     toast.success("All locks removed.");
//   },

//   isCellLocked: (rowIndex: number, colIndex: number) => {
//     const { liveTableDoc } = get();

//     if (!liveTableDoc) {
//       return false;
//     }

//     return liveTableDoc.isCellLocked(rowIndex, colIndex);
//   },

//   getActiveLocks: () => {
//     const { liveTableDoc } = get();

//     if (!liveTableDoc) {
//       return [];
//     }

//     return liveTableDoc.getActiveLocks();
//   },

//   updateLockedCells: (lockedCells: Set<string>) => {
//     set({ lockedCells });
//   },
// }));

// // Simplified useLockStore hook

// export const useLockStore = <T>(selector?: (state: LockState) => T) => {
//   return useStore(lockStore, selector!);
// };

// // Selectors and hooks

// export const useLockedCells = () => useLockStore(state => state.lockedCells);

// export const useIsCellLocked = () => {
//   return useLockStore(useCallback((state: LockState) => state.isCellLocked, []));
// };

// export const useLockActions = () => useLockStore(useCallback((state: LockState) => ({
//   lockSelectedRange: state.lockSelectedRange,
//   unlockRange: state.unlockRange,
//   unlockAll: state.unlockAll,
// }), []));

// export const useHasAnySelectedCellLocked = () => {
//   const selectedCells = useSelectedCells();
//   const isCellLocked = useIsCellLocked();

//   return useMemo(() => {
//     if (!selectedCells || selectedCells.length === 0) {
//       return false;
//     }

//     return selectedCells.some((cell) =>
//       isCellLocked(cell.rowIndex, cell.colIndex)
//     );
//   }, [selectedCells, isCellLocked]);
// };

// export const useHasAnyLockedCells = () => {
//   const lockedCells = useLockedCells();
//   return lockedCells.size > 0;
// };
// };
