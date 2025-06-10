import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createStore,
  StoreApi,
  useStore,
} from "zustand";

import { useSelf } from "@liveblocks/react";
import { LiveblocksYjsProvider } from "@liveblocks/yjs";

import type {
  AwarenessState,
  CursorDataForCell,
  LiveTableDoc,
} from "@/components/live-table/LiveTableDoc";
import { useSelectedCells, useSelectionArea } from "@/stores/selectionStore";

// -----
// Types
// -----

interface AwarenessStoreState {
  awarenessStates: Map<number, AwarenessState | null> | undefined;
  cursorsData: CursorDataForCell[] | undefined;
}

interface AwarenessStoreActions {
  setAwarenessStates: (states: Map<number, AwarenessState | null>) => void;
  setCursorsData: (data: CursorDataForCell[]) => void;
  getCursorsForCell: (
    rowIndex: number,
    colIndex: number
  ) => CursorDataForCell | undefined;
}

export type AwarenessStore = AwarenessStoreState & AwarenessStoreActions;

// -----
// Store
// -----

const AwarenessStoreContext = createContext<StoreApi<AwarenessStore> | null>(
  null
);

const initialState: AwarenessStoreState = {
  awarenessStates: undefined,
  cursorsData: undefined,
};

export const AwarenessStoreProvider = ({
  children,
  liveTableDoc,
  yProvider,
}: {
  children: React.ReactNode;
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
}) => {
  const [store] = useState(() =>
    createStore<AwarenessStore>()((set, get) => ({
      ...initialState,
      setAwarenessStates: (states: Map<number, AwarenessState | null>) => {
        set({ awarenessStates: states });
      },
      setCursorsData: (data: CursorDataForCell[]) => {
        set({ cursorsData: data });
      },
      getCursorsForCell: (rowIndex: number, colIndex: number) => {
        const { cursorsData } = get();
        return cursorsData?.find(
          (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
        );
      },
    }))
  );

  // Get user info and selection state for awareness
  const self = useSelf();
  const selectedCells = useSelectedCells();
  const selectionArea = useSelectionArea();

  // Memoized function to update React state with awareness changes
  const updateAwarenessStateCallback = useCallback(() => {
    const currentStates = new Map(
      yProvider.awareness.getStates() as Map<number, AwarenessState | null>
    );
    liveTableDoc.updateAwarenessState(currentStates);
  }, [yProvider.awareness, liveTableDoc]);

  // Wire up callbacks to the liveTableDoc
  useEffect(() => {
    liveTableDoc.awarenessStatesUpdateCallback = (states) => {
      store.getState().setAwarenessStates(states);
    };
    liveTableDoc.cursorsDataUpdateCallback = (data) => {
      store.getState().setCursorsData(data);
    };

    return () => {
      liveTableDoc.awarenessStatesUpdateCallback = undefined;
      liveTableDoc.cursorsDataUpdateCallback = undefined;
    };
  }, [liveTableDoc, store]);

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

  // Update self info in awareness
  useEffect(() => {
    yProvider.awareness.setLocalStateField("user", {
      name: self?.info?.name ?? "Anonymous",
      color: self?.info?.color ?? "#000000",
    });
  }, [self?.info?.name, self?.info?.color, yProvider.awareness]);

  // Update awareness when local selection changes
  useEffect(() => {
    yProvider.awareness.setLocalStateField("selectionArea", {
      startCell: selectionArea.startCell
        ? { ...selectionArea.startCell }
        : null,
      endCell: selectionArea.endCell ? { ...selectionArea.endCell } : null,
    });
  }, [selectedCells, yProvider.awareness, selectionArea]);

  return (
    <AwarenessStoreContext.Provider value={store}>
      {children}
    </AwarenessStoreContext.Provider>
  );
};

// -----
// Hooks
// -----

function useAwarenessStore(): AwarenessStore;
function useAwarenessStore<T>(selector: (state: AwarenessStore) => T): T;
function useAwarenessStore<T>(selector?: (state: AwarenessStore) => T) {
  const store = useContext(AwarenessStoreContext);
  if (!store) {
    throw new Error("AwarenessStoreContext not found");
  }
  return useStore(store, selector!);
}

// General awareness hooks
export const useAwarenessStates = () =>
  useAwarenessStore((state) => state.awarenessStates);

export const useCursorsData = () =>
  useAwarenessStore((state) => state.cursorsData);

// Optimized hook for getting cursors for a specific cell
// This prevents re-renders when cursorsData changes but this specific cell's cursors don't
export const useCursorsForCell = (rowIndex: number, colIndex: number) =>
  useAwarenessStore((state) => {
    return state.cursorsData?.find(
      (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
    );
  });

// Non-reactive function to get cursors for a cell (useful for event handlers)
export const useGetCursorsForCellFn = () => {
  const store = useContext(AwarenessStoreContext);
  if (!store) {
    throw new Error(
      "useGetCursorsForCellFn must be used within an AwarenessStoreProvider"
    );
  }

  return (rowIndex: number, colIndex: number) => {
    return store.getState().getCursorsForCell(rowIndex, colIndex);
  };
};

// Hook to check if a cell has other user cursors (optimized to prevent unnecessary re-renders)
export const useHasOtherUserCursors = (rowIndex: number, colIndex: number) =>
  useAwarenessStore((state) => {
    const cursorsForCell = state.cursorsData?.find(
      (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
    );
    return cursorsForCell && cursorsForCell.cursors.length > 0;
  });

// Hook to get the first user's color for a cell (optimized)
export const useFirstUserColorForCell = (rowIndex: number, colIndex: number) =>
  useAwarenessStore((state) => {
    const cursorsForCell = state.cursorsData?.find(
      (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
    );
    return cursorsForCell?.cursors[0]?.user?.color;
  });
