import { vi } from "vitest";
import * as Y from "yjs";

import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";

// Define a more specific type for overrides that allows yColWidths (Y.Map)
// and other context properties.
type LiveTableMockOverrides = Partial<
  ReturnType<typeof LiveTableProviderModule.useLiveTable>
> & {
  yColWidths?: Y.Map<number>; // Allow explicitly passing a Y.Map for yColWidths
};

export const mockUseLiveTable = (overrides: LiveTableMockOverrides = {}) => {
  const yDoc = overrides.yDoc || new Y.Doc();
  const yHeaders = overrides.yHeaders || yDoc.getArray<string>("tableHeaders");
  const yTable = overrides.yTable || yDoc.getArray<Y.Map<unknown>>("tableData");

  // If overrides.yColWidths (the Y.Map) is provided, use it.
  // Otherwise, create/get the Y.Map from yDoc.
  const yColWidthsMapSource =
    overrides.yColWidths || yDoc.getMap<number>("colWidths");

  const undoManager =
    overrides.undoManager ||
    new Y.UndoManager([yHeaders, yTable, yColWidthsMapSource]);

  // If overrides.columnWidths (the plain object) is provided, it takes precedence.
  // Otherwise, derive the plain object from the yColWidthsMapSource.
  const plainColumnWidthsSource =
    overrides.columnWidths || Object.fromEntries(yColWidthsMapSource.entries());

  const defaultMockValue: ReturnType<
    typeof LiveTableProviderModule.useLiveTable
  > = {
    // Start with all required Yjs instances and default values
    yDoc,
    yHeaders,
    yTable,
    yColWidths: yColWidthsMapSource, // This is the Y.Map instance for the context
    undoManager,
    isTableLoaded: true,
    selectedCell: null,
    tableId: "test-table",
    tableData: [],
    headers: [],
    columnWidths: plainColumnWidthsSource, // This is the plain object for the context
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
    // Apply all overrides last to ensure they take precedence
    ...overrides,
  };

  // Final check: if overrides had columnWidths, ensure it's used.
  // If yColWidths was overridden, its derived plain object is already set unless columnWidths itself was also overridden.
  if (overrides.columnWidths) {
    defaultMockValue.columnWidths = overrides.columnWidths;
  }
  // If yColWidths was in overrides, defaultMockValue.yColWidths already has it from yColWidthsMapSource.
  // And defaultMockValue.columnWidths would be derived from it, unless overrides.columnWidths was also present.

  vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
    defaultMockValue
  );
  return defaultMockValue;
};
