import { useCallback, useEffect, useState } from "react";

import { LiveblocksYjsProvider } from "@liveblocks/yjs";

import { useSelectedCells, useSelectionArea } from "@/stores/selectionStore";

import {
  AwarenessState,
  CursorDataForCell,
  LiveTableDoc,
} from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";

export default function AwarenessSync({
  liveTableDoc,
  yProvider,
}: {
  liveTableDoc: LiveTableDoc;
  yProvider: LiveblocksYjsProvider;
}) {
  // Awareness state
  const [_, setAwarenessStates] = useState<
    Map<number, AwarenessState | null> | undefined
  >(undefined);

  const [cursorsData, setCursorsData] = useState<
    CursorDataForCell[] | undefined
  >(undefined);
  liveTableDoc.awarenessStatesUpdateCallback = setAwarenessStates;
  liveTableDoc.cursorsDataUpdateCallback = setCursorsData;

  // update self info in awareness
  useUpdatedSelf(yProvider);

  // selection store
  const selectedCells = useSelectedCells();
  const selectionArea = useSelectionArea();

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
  const _getCursorsForCell = useCallback(
    (rowIndex: number, colIndex: number): CursorDataForCell | undefined => {
      return cursorsData?.find(
        (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
      );
    },
    [cursorsData]
  );

  return <></>;
}
