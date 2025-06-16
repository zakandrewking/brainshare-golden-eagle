/**
 * This is the top-level provider for the LiveTable component with the YSweet
 * backend. Sets up the stores and syncing.
 */

import React, { useMemo } from "react";

import { useYDoc, useYjsProvider, YDocProvider } from "@y-sweet/react";

import { AwarenessStoreProvider } from "@/stores/awareness-store";
import { DataStoreProvider } from "@/stores/dataStore";

import { LiveTableDoc } from "./LiveTableDoc";
import SelectionListeners from "./selection-listeners";

function YSweetLiveTableProviderChild({
  children,
  documentTitle,
  documentDescription,
  docId,
}: {
  children: React.ReactNode;
  documentTitle: string;
  documentDescription: string;
  docId: string;
}) {
  const ySweetProvider = useYjsProvider();
  const yDoc = useYDoc();
  const liveTableDoc = useMemo(() => {
    return new LiveTableDoc(yDoc);
  }, [yDoc]);

  return (
    <DataStoreProvider
      liveTableDoc={liveTableDoc}
      yProvider={ySweetProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
      docId={docId}
    >
      <AwarenessStoreProvider
        liveTableDoc={liveTableDoc}
        yProvider={ySweetProvider}
      >
        <SelectionListeners />
        {children}
      </AwarenessStoreProvider>
    </DataStoreProvider>
  );
}

export default function YSweetLiveTableProvider({
  children,
  // TODO use this to reset stores
  tableId,
  documentTitle,
  documentDescription,
  docId,
}: {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
  docId: string;
}) {
  return (
    <YDocProvider docId={docId} authEndpoint="/api/my-auth-endpoint">
      <YSweetLiveTableProviderChild
        documentTitle={documentTitle}
        documentDescription={documentDescription}
        docId={docId}
      >
        {children}
      </YSweetLiveTableProviderChild>
    </YDocProvider>
  );
}
