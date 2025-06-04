"use client";

import React from "react";

import LiveTableContainer from "./LiveTableContainer";
import LiveTableDisplay from "./LiveTableDisplay";
import LiveTableProvider from "./LiveTableProvider";
import LiveTableToolbar from "./LiveTableToolbar";

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
    <LiveTableProvider
      tableId={tableId}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      <LiveTableContainer>
        <LiveTableToolbar />
        <LiveTableDisplay />
      </LiveTableContainer>
    </LiveTableProvider>
  );
};

export default LiveTable;
