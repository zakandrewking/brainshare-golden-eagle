import React from "react";

import { vi } from "vitest";
import * as Y from "yjs";

import type { LiveblocksYjsProvider } from "@liveblocks/yjs";

import { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import SelectionListeners from "@/components/live-table/selection-listeners";
import { AwarenessStoreProvider } from "@/stores/awareness-store";
import { DataStoreProvider } from "@/stores/dataStore";

// Test wrapper that provides both DataStoreProvider and AwarenessStoreProvider context
export const TestLiveTableStoreWrapper: React.FC<{
  children: React.ReactNode;
  liveTableDoc?: LiveTableDoc;
  documentTitle?: string;
  documentDescription?: string;
}> = ({
  children,
  liveTableDoc,
  documentTitle = "Test Doc Title",
  documentDescription = "Test Doc Desc",
}) => {
  // Create a default LiveTableDoc if none provided
  const defaultDoc = React.useMemo(() => {
    if (liveTableDoc) return liveTableDoc;
    const yDoc = new Y.Doc();
    return new LiveTableDoc(yDoc);
  }, [liveTableDoc]);

  // Create a mock yProvider
  const mockYProvider = React.useMemo(
    () => ({
      awareness: {
        setLocalStateField: vi.fn(),
        getStates: vi.fn(() => new Map()),
        on: vi.fn(),
        off: vi.fn(),
      },
      getYDoc: vi.fn(() => defaultDoc.yDoc),
      once: vi.fn(),
    }),
    [defaultDoc]
  );

  return (
    <DataStoreProvider
      liveTableDoc={defaultDoc}
      yProvider={mockYProvider as unknown as LiveblocksYjsProvider}
      documentTitle={documentTitle}
      documentDescription={documentDescription}
    >
      <AwarenessStoreProvider
        liveTableDoc={defaultDoc}
        yProvider={mockYProvider as unknown as LiveblocksYjsProvider}
      >
        <SelectionListeners />
        {children}
      </AwarenessStoreProvider>
    </DataStoreProvider>
  );
};

// Backward compatibility - keep the old export name
export const TestDataStoreWrapper = TestLiveTableStoreWrapper;
