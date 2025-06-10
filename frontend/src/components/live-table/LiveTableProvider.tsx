/**
 * This is the top-level provider for the LiveTable component. Sets up the
 * stores and syncing.
 */

import React, { useMemo } from "react";

import { useRoom } from "@liveblocks/react/suspense";

import { AwarenessStoreProvider } from "@/stores/awareness-store";
import { DataStoreProvider } from "@/stores/dataStore";
import { type CellPosition, type SelectionArea } from "@/stores/selectionStore";

import { initializeLiveblocksRoom } from "./LiveTableDoc";
import SelectionListeners from "./selection-listeners";

export type { CellPosition, SelectionArea };

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  // TODO use this to reset stores
  tableId,
  documentTitle,
  documentDescription,
}) => {
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );

  return (
    <DataStoreProvider
      liveTableDoc={liveTableDoc}
      yProvider={yProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      <AwarenessStoreProvider liveTableDoc={liveTableDoc} yProvider={yProvider}>
        <SelectionListeners />
        {children}
      </AwarenessStoreProvider>
    </DataStoreProvider>
  );
};

export default LiveTableProvider;
