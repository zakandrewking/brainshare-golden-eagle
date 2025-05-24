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
export interface LiveTableMockOverrides
  extends Partial<ReturnType<typeof LiveTableProvider.useLiveTable>> {
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
}

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
            overrides.initialColumnDefinitions.map((d) => d.id)
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

  // Calculate selectedCells if selectionArea is provided and selectedCells is not directly overridden
  let calculatedSelectedCells: LiveTableProvider.CellPosition[] =
    overrides.selectedCells || [];
  const areaForSelectedCellsCalculation = overrides.selectionArea || {
    startCell: null,
    endCell: null,
  };

  if (
    !overrides.selectedCells &&
    areaForSelectedCellsCalculation.startCell &&
    areaForSelectedCellsCalculation.endCell
  ) {
    const cells: LiveTableProvider.CellPosition[] = [];
    const startRow = Math.min(
      areaForSelectedCellsCalculation.startCell.rowIndex,
      areaForSelectedCellsCalculation.endCell.rowIndex
    );
    const endRow = Math.max(
      areaForSelectedCellsCalculation.startCell.rowIndex,
      areaForSelectedCellsCalculation.endCell.rowIndex
    );
    const startCol = Math.min(
      areaForSelectedCellsCalculation.startCell.colIndex,
      areaForSelectedCellsCalculation.endCell.colIndex
    );
    const endCol = Math.max(
      areaForSelectedCellsCalculation.startCell.colIndex,
      areaForSelectedCellsCalculation.endCell.colIndex
    );
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      for (let colIndex = startCol; colIndex <= endCol; colIndex++) {
        cells.push({ rowIndex, colIndex });
      }
    }
    calculatedSelectedCells = cells;
  }

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
    selectionArea: areaForSelectedCellsCalculation, // Use the same area used for calculation or the default
    isSelecting: false,
    selectedCells: calculatedSelectedCells, // Use calculated or directly overridden
    handleSelectionStart: vi.fn(),
    handleSelectionMove: vi.fn(),
    handleSelectionEnd: vi.fn(),
    isCellSelected: vi.fn().mockReturnValue(false),
    clearSelection: vi.fn(),
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
