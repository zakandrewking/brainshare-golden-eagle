/**
 * This is the top-level provider for the LiveTable component. It manages the
 * LiveTableDoc and the LiveTableContext.
 *
 * This component is primarily responsible for setting up the LiveTableDoc,
 * based on the lifecycle of page. It should NOT be used to manage state that
 * changes frequently, because that will cause the entire table to re-render.
 */

import React, { createContext, useContext, useMemo } from "react";

import { useRoom } from "@liveblocks/react/suspense";

import { DataStoreProvider } from "@/stores/dataStore";
import { type CellPosition, type SelectionArea } from "@/stores/selectionStore";

import AwarenessSync from "./awareness-sync";
import { initializeLiveblocksRoom } from "./LiveTableDoc";

export interface LiveTableContextType {
  tableId: string;
  documentTitle: string;
  documentDescription: string;
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
  // liveblocks
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
      <AwarenessSync liveTableDoc={liveTableDoc} yProvider={yProvider} />
      <LiveTableContext.Provider
        value={{
          tableId,
          documentTitle,
          documentDescription,
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
