"use client";

import React from "react";

import LiveTableContainer from "./LiveTableContainer";
import LiveTableDisplay from "./LiveTableDisplay";
import LiveTableProvider from "./LiveTableProvider";
import LiveTableToolbar from "./LiveTableToolbar";
import Room from "./Room";

interface LiveTableProps {
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTable: React.FC<LiveTableProps> = ({ tableId, documentTitle, documentDescription }) => {
  // TODO When we switch to multiple rooms per table, we'll drop the Room
  // component and move yDoc initialization into LiveTableProvider.
  const roomId = tableId;

  return (
    <Room roomId={roomId}>
      <LiveTableProvider tableId={tableId} documentTitle={documentTitle} documentDescription={documentDescription}>
        <LiveTableContainer>
          <LiveTableToolbar />
          <LiveTableDisplay />
        </LiveTableContainer>
      </LiveTableProvider>
    </Room>
  );
};

export default LiveTable;
