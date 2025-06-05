import React from "react";

import { vi } from "vitest";
import * as Y from "yjs";

import type { LiveblocksYjsProvider } from "@liveblocks/yjs";

import type {
  CellValue,
  ColumnDefinition,
  ColumnId,
  RowId,
} from "@/components/live-table/LiveTableDoc";
import { LiveTableDoc } from "@/components/live-table/LiveTableDoc"; // Import the actual LiveTableDoc
import * as LiveTableProvider from "@/components/live-table/LiveTableProvider";
import { DataStoreProvider } from "@/stores/dataStore";

// Define a more specific type for overrides that allows yColWidths (Y.Map)
// and other context properties.
export interface LiveTableMockOverrides
  extends Partial<ReturnType<typeof LiveTableProvider.useLiveTable>> {
  yDoc?: Y.Doc;
  yHeaders?: Y.Array<string>;
  yTable?: Y.Array<Y.Map<unknown>>;
  liveTableDocInstance?: LiveTableDoc;
  initialColumnDefinitions?: ColumnDefinition[];
  initialColumnOrder?: ColumnId[];
  initialRowOrder?: RowId[];
  initialRowData?: Record<RowId, Record<ColumnId, CellValue>>;
  initialV1Headers?: string[];
  initialV1TableData?: Record<string, unknown>[];
  initialV1ColWidths?: Record<string, number>;
  // Explicitly include selectionArea and selectedCells for clarity if they are overridden
  selectionArea?: LiveTableProvider.SelectionArea;
  selectedCells?: LiveTableProvider.CellPosition[];
  // Add header editing handlers
  editingHeaderIndex?: number | null;
  editingHeaderValue?: string;
  handleHeaderDoubleClick?: (index: number) => void;
  handleHeaderChange?: (value: string) => void;
  handleHeaderBlur?: () => void;
  handleHeaderKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const getLiveTableMockValues = (
  overrides: LiveTableMockOverrides = {},
) => {
  let liveTableDoc: LiveTableDoc;
  let yDoc: Y.Doc;

  if (overrides.liveTableDocInstance) {
    liveTableDoc = overrides.liveTableDocInstance;
    yDoc = liveTableDoc.yDoc;
  } else {
    yDoc = new Y.Doc();

    if (overrides.initialV1Headers) {
      const yV1Headers = yDoc.getArray<string>("tableHeaders");
      yV1Headers.push(overrides.initialV1Headers);
      if (overrides.initialV1ColWidths) {
        const yV1ColWidths = yDoc.getMap<number>("colWidths");
        for (const [h, w] of Object.entries(overrides.initialV1ColWidths)) {
          yV1ColWidths.set(h, w);
        }
      }
      if (overrides.initialV1TableData) {
        const yV1Table = yDoc.getArray<Y.Map<unknown>>("tableData");
        overrides.initialV1TableData.forEach((row) => {
          const yRow = new Y.Map<unknown>();
          for (const [key, val] of Object.entries(row)) {
            yRow.set(key, val);
          }
          yV1Table.push([yRow]);
        });
      }
    }

    liveTableDoc = new LiveTableDoc(yDoc);

    if (
      !overrides.initialV1Headers &&
      (overrides.initialColumnDefinitions || overrides.initialRowData)
    ) {
      yDoc.transact(() => {
        if (overrides.initialColumnDefinitions) {
          overrides.initialColumnDefinitions.forEach((def) => {
            liveTableDoc.yColumnDefinitions.set(def.id, def);
          });
        }
        if (overrides.initialColumnOrder) {
          liveTableDoc.yColumnOrder.push(overrides.initialColumnOrder);
        } else if (overrides.initialColumnDefinitions) {
          liveTableDoc.yColumnOrder.push(
            overrides.initialColumnDefinitions.map((d) => d.id),
          );
        }

        if (overrides.initialRowData) {
          const rowIds =
            overrides.initialRowOrder ||
            (Object.keys(overrides.initialRowData) as RowId[]);
          if (overrides.initialRowOrder) {
            liveTableDoc.yRowOrder.push(overrides.initialRowOrder);
          } else {
            liveTableDoc.yRowOrder.push(
              Object.keys(overrides.initialRowData) as RowId[],
            );
          }

          rowIds.forEach((rowId) => {
            const rowData = overrides.initialRowData![rowId];
            const yRowMap = new Y.Map<CellValue>();
            for (const [colId, cellVal] of Object.entries(rowData)) {
              yRowMap.set(colId as ColumnId, cellVal);
            }
            liveTableDoc.yRowData.set(rowId, yRowMap);
          });
        }
        liveTableDoc.yMeta.set("schemaVersion", 2);
      });
    }
  }

  let currentTableData: Record<string, unknown>[] = [];
  let currentHeaders: string[] = [];
  let currentColWidths: Record<string, number> = {};

  liveTableDoc.tableDataUpdateCallback = (data) => {
    currentTableData = data;
  };
  liveTableDoc.headersUpdateCallback = (h) => {
    currentHeaders = h;
  };
  liveTableDoc.columnWidthsUpdateCallback = (w) => {
    currentColWidths = w;
  };

  liveTableDoc.updateTableState();
  liveTableDoc.updateHeadersState();
  liveTableDoc.updateColWidthsState();

  const defaultMockValue: ReturnType<typeof LiveTableProvider.useLiveTable> = {
    isTableLoaded: true,
    tableId: "test-table",
    documentTitle: "Test Document",
    documentDescription: "Test Description",
    tableData: currentTableData,
    headers: currentHeaders,
    columnWidths: currentColWidths,
    deleteRows: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    deleteColumns: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    reorderColumn: vi.fn(),
    // awareness
    awarenessStates: new Map(),
    cursorsData: [],
    getCursorsForCell: vi.fn().mockReturnValue(undefined),
    ...overrides,
  };

  return defaultMockValue;
};

// Test wrapper that provides DataStoreProvider context
export const TestDataStoreWrapper: React.FC<{
  children: React.ReactNode;
  liveTableDoc?: LiveTableDoc;
  headers?: string[];
}> = ({ children, liveTableDoc, headers = [] }) => {
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
    }),
    [defaultDoc],
  );

  return (
    <DataStoreProvider
      liveTableDoc={defaultDoc}
      yProvider={mockYProvider as unknown as LiveblocksYjsProvider}
      headers={headers}
    >
      {children}
    </DataStoreProvider>
  );
};
