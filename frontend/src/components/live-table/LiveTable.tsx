"use client";

import React from "react";

import LiveTableContainer from "./LiveTableContainer";
import LiveTableDisplay from "./LiveTableDisplay";
import LiveTableProvider, { Backend } from "./LiveTableProvider";
import LiveTableToolbar from "./LiveTableToolbar";
import YSweetDocProvider from "./YSweetDocProvider";

interface LiveTableProps {
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTable: React.FC<LiveTableProps> = ({
  tableId,
  documentTitle,
  documentDescription,
}) => {
  return (
    <YSweetDocProvider docId={tableId}>
      <LiveTableProvider
        tableId={tableId}
        documentTitle={documentTitle}
        documentDescription={documentDescription}
        backend={Backend.Y_SWEET}
      >
        <LiveTableContainer>
          <LiveTableToolbar />
          <LiveTableDisplay />
        </LiveTableContainer>
      </LiveTableProvider>
    </YSweetDocProvider>
  );
};

export default LiveTable;
