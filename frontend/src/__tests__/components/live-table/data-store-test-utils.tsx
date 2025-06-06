import React from "react";

import { vi } from "vitest";
import * as Y from "yjs";

import type { LiveblocksYjsProvider } from "@liveblocks/yjs";

import { LiveTableDoc } from "@/components/live-table/LiveTableDoc"; // Import the actual LiveTableDoc
import { DataStoreProvider } from "@/stores/dataStore";

// Test wrapper that provides DataStoreProvider context
export const TestDataStoreWrapper: React.FC<{
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
      {children}
    </DataStoreProvider>
  );
};
