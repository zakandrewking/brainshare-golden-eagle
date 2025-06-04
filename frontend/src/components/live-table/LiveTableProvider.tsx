import React, { useMemo } from "react";

import { useRoom } from "@liveblocks/react/suspense";

import { DataStoreProvider } from "@/stores/data-store";
import {
  type CellPosition,
  type SelectionArea,
} from "@/stores/selection-store";

import { initializeLiveblocksRoom } from "./live-table-doc";
import Room from "./Room";

export type { CellPosition, SelectionArea };

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

/**
 * @param tableId - A unique, long-lived identifier that can be used as a cache
 * key for table data.
 */
const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
  documentTitle,
  documentDescription,
}) => {
  // TODO When we switch to multiple rooms per table, we'll drop the Room
  // component and move yDoc initialization into LiveTableProvider.
  const roomId = tableId;

  return (
    <Room roomId={roomId}>
      <LiveTableLiveBlocksProvider
        tableId={tableId}
        documentTitle={documentTitle}
        documentDescription={documentDescription}
      >
        {children}
      </LiveTableLiveBlocksProvider>
    </Room>
  );
};

interface LiveTableLiveBlocksProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTableLiveBlocksProvider: React.FC<
  LiveTableLiveBlocksProviderProps
> = ({ children, tableId, documentTitle, documentDescription }) => {
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );

  return (
    <DataStoreProvider
      tableId={tableId}
      liveTableDoc={liveTableDoc}
      yProvider={yProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      {children}
    </DataStoreProvider>
  );
};

export default LiveTableProvider;
