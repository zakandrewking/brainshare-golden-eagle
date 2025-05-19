import { vi } from "vitest";
import * as Y from "yjs";

import type {
  CellValue,
  ColumnDefinition,
  ColumnId,
  RowId,
} from "@/components/live-table/LiveTableDoc";
import { LiveTableDoc } from "@/components/live-table/LiveTableDoc"; // Import the actual LiveTableDoc
import * as LiveTableProvider from "@/components/live-table/LiveTableProvider";

// Define a more specific type for overrides that allows yColWidths (Y.Map)
// and other context properties.
type LiveTableMockOverrides = Partial<
  ReturnType<typeof LiveTableProvider.useLiveTable>
> & {
  // Allow providing a fully initialized LiveTableDoc instance
  liveTableDocInstance?: LiveTableDoc;
  // Or, allow providing initial V2 data structures for auto-initialization
  initialColumnDefinitions?: ColumnDefinition[];
  initialColumnOrder?: ColumnId[];
  initialRowOrder?: RowId[];
  initialRowData?: Record<RowId, Record<ColumnId, CellValue>>;
  // For tests that might still want to simulate V1 migration
  initialV1Headers?: string[];
  initialV1TableData?: Record<string, unknown>[];
  initialV1ColWidths?: Record<string, number>;
};

export const getLiveTableMockValues = (
  overrides: LiveTableMockOverrides = {}
) => {
  let liveTableDoc: LiveTableDoc;
  let yDoc: Y.Doc;

  if (overrides.liveTableDocInstance) {
    liveTableDoc = overrides.liveTableDocInstance;
    yDoc = liveTableDoc.yDoc;
  } else {
    yDoc = new Y.Doc();

    // Handle V1 data for migration testing if provided
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

    liveTableDoc = new LiveTableDoc(yDoc); // This will run migration if V1 data was added

    // If no V1 data and specific V2 data is provided, populate V2 structures directly
    // This assumes an already migrated state or fresh V2 doc
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
          // Infer column order from definitions if not explicitly provided
          liveTableDoc.yColumnOrder.push(
            overrides.initialColumnDefinitions.map((d) => d.id)
          );
        }

        if (overrides.initialRowData) {
          const rowIds =
            overrides.initialRowOrder ||
            (Object.keys(overrides.initialRowData) as RowId[]);
          if (overrides.initialRowOrder) {
            // if rowOrder is specified, push it.
            liveTableDoc.yRowOrder.push(overrides.initialRowOrder);
          } else {
            // if not, infer from initialRowData keys
            liveTableDoc.yRowOrder.push(
              Object.keys(overrides.initialRowData) as RowId[]
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

  // Derive tableData, headers, columnWidths from the liveTableDoc's V2 state
  // by calling its update methods and capturing their output.
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
    undoManager: liveTableDoc.undoManager,
    isTableLoaded: true,
    selectedCell: null,
    tableId: "test-table",
    tableData: currentTableData,
    headers: currentHeaders,
    columnWidths: currentColWidths,
    handleCellChange: vi.fn(),
    handleCellFocus: vi.fn(),
    handleCellBlur: vi.fn(),
    editingHeaderIndex: null,
    editingHeaderValue: "",
    handleHeaderDoubleClick: vi.fn(),
    handleHeaderChange: vi.fn(),
    handleHeaderBlur: vi.fn(),
    handleHeaderKeyDown: vi.fn(),
    handleColumnResize: vi.fn(),
    selectionArea: { startCell: null, endCell: null },
    isSelecting: false,
    selectedCells: [],
    handleSelectionStart: vi.fn(),
    handleSelectionMove: vi.fn(),
    handleSelectionEnd: vi.fn(),
    isCellSelected: vi.fn().mockReturnValue(false),
    clearSelection: vi.fn(),
    getSelectedCellsData: vi.fn().mockReturnValue([]),
    editingCell: null,
    setEditingCell: vi.fn(),
    generateAndInsertRows: vi
      .fn()
      .mockResolvedValue({ aiRowsAdded: 0, defaultRowsAdded: 0 }),
    deleteRows: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    generateAndInsertColumns: vi
      .fn()
      .mockResolvedValue({ aiColsAdded: 0, defaultColsAdded: 0 }),
    deleteColumns: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    ...overrides,
  };

  return defaultMockValue;
};
