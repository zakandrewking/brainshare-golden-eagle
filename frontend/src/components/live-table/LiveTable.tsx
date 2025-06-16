"use client";

import React from "react";

import LiveTableContainer from "./LiveTableContainer";
import LiveTableDisplay from "./LiveTableDisplay";
import LiveTableProvider from "./LiveTableProvider";
import LiveTableToolbar from "./LiveTableToolbar";
import Room from "./Room";
import YSweetLiveTableProvider from "./YSweetLiveTableProvider";

interface LiveTableProps {
  tableId: string;
  documentTitle: string;
  documentDescription: string;
  docId: string;
  backend?: LiveTableBackend;
}

export type LiveTableBackend = "ysweet" | "liveblocks";

const LiveTable: React.FC<LiveTableProps> = ({
  tableId,
  documentTitle,
  documentDescription,
  docId,
  backend = "liveblocks",
}) => {
  // TODO When we switch to multiple rooms per table, we'll drop the Room
  // component and move yDoc initialization into LiveTableProvider.
  const roomId = tableId;

  if (backend === "ysweet") {
    return (
      <YSweetLiveTableProvider
        tableId={tableId}
        documentTitle={documentTitle}
        documentDescription={documentDescription}
        docId={docId}
      >
        <LiveTableContainer>
          <LiveTableToolbar />
          <LiveTableDisplay />
        </LiveTableContainer>
      </YSweetLiveTableProvider>
    );
  }

  // liveblocks
  return (
    <Room roomId={roomId}>
      <LiveTableProvider
        tableId={tableId}
        documentTitle={documentTitle}
        documentDescription={documentDescription}
        docId={docId}
      >
        <LiveTableContainer>
          <LiveTableToolbar />
          <LiveTableDisplay />
        </LiveTableContainer>
      </LiveTableProvider>
    </Room>
  );
};

export default LiveTable;
