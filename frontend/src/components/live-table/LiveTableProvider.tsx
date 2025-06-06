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

import { useRoom } from "@liveblocks/react/suspense";

import { DataStoreProvider } from "@/stores/dataStore";
import {
  type CellPosition,
  type SelectionArea,
  useSelectedCells,
  useSelectionArea,
} from "@/stores/selectionStore";

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
  // awareness
  awarenessStates: Map<number, AwarenessState | null> | undefined;
  cursorsData: CursorDataForCell[] | undefined;
  getCursorsForCell: (
    rowIndex: number,
    colIndex: number
  ) => CursorDataForCell | undefined;
}

export type { CellPosition, SelectionArea };

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTableContext = createContext<LiveTableContextType | undefined>(
  undefined
);

const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
  documentTitle,
  documentDescription,
}) => {
  // Awareness state
  const [awarenessStates, setAwarenessStates] = useState<
    Map<number, AwarenessState | null> | undefined
  >(undefined);
  const [cursorsData, setCursorsData] = useState<
    CursorDataForCell[] | undefined
  >(undefined);

  // liveblocks
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );
  liveTableDoc.awarenessStatesUpdateCallback = setAwarenessStates;
  liveTableDoc.cursorsDataUpdateCallback = setCursorsData;

  // update self info in awareness
  useUpdatedSelf(yProvider);

  // selection store
  const selectedCells = useSelectedCells();
  const selectionArea = useSelectionArea();

  // --- Awareness Management ---

  // Memoized function to update React state with awareness changes
  const updateAwarenessStateCallback = useCallback(() => {
    const currentStates = new Map(
      yProvider.awareness.getStates() as Map<number, AwarenessState | null>
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
    },
    [cursorsData]
  );

  return (
    <DataStoreProvider
      liveTableDoc={liveTableDoc}
      yProvider={yProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      <LiveTableContext.Provider
        value={{
          tableId,
          documentTitle,
          documentDescription,
          awarenessStates,
          cursorsData,
          getCursorsForCell,
        }}
      >
        {children}
      </LiveTableContext.Provider>
    </DataStoreProvider>
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
