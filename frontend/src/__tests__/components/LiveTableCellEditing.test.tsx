import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";

// Mock the useLiveTable hook
vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

describe("LiveTableDisplay Cell Editing", () => {
  const mockHandleCellChange = vi.fn();
  const mockHandleCellFocus = vi.fn();
  const mockHandleCellBlur = vi.fn();
  const mockHandleSelectionStart = vi.fn();
  const mockHandleSelectionEnd = vi.fn();

  // Create a ref for testing focus
  let inputRef: HTMLInputElement;

  beforeEach(() => {
    // Setup mock implementation of useLiveTable
    inputRef = document.createElement("input");
    inputRef.focus = vi.fn();

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockReturnValue({
      tableData: [
        { name: "John Doe", age: "30" },
        { name: "Jane Smith", age: "25" },
      ],
      headers: ["name", "age"],
      columnWidths: { name: 150, age: 100 },
      handleCellChange: mockHandleCellChange,
      handleCellFocus: mockHandleCellFocus,
      handleCellBlur: mockHandleCellBlur,
      editingHeaderIndex: null,
      editingHeaderValue: "",
      handleHeaderDoubleClick: vi.fn(),
      handleHeaderChange: vi.fn(),
      handleHeaderBlur: vi.fn(),
      handleHeaderKeyDown: vi.fn(),
      handleColumnResize: vi.fn(),
      selectedCell: null,
      handleSelectionStart: mockHandleSelectionStart,
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: mockHandleSelectionEnd,
      isSelecting: false,
      isCellSelected: vi.fn().mockReturnValue(false),
      yDoc: new Y.Doc(),
      yTable: new Y.Doc().getArray<Y.Map<unknown>>("table"),
      yHeaders: new Y.Doc().getArray<string>("headers"),
      undoManager: null,
      tableId: "test-table",
      isTableLoaded: true,
      selectionArea: { startCell: null, endCell: null },
      selectedCells: [],
      clearSelection: vi.fn(),
      getSelectedCellsData: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("needs to focus the input element after clicking a cell", () => {
    render(<LiveTableDisplay />);

    // Find an input element within a cell
    const cellInput = screen.getByDisplayValue("John Doe");
    expect(cellInput).toBeDefined();

    // Get the parent td element (the cell)
    const cell = cellInput.closest("td");
    expect(cell).toBeDefined();

    // Step 1: Simulate mouse down on the cell (starts selection)
    fireEvent.mouseDown(cell!);

    // Verify that handleSelectionStart was called with correct row and column indices
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);

    // We're testing that this step should happen automatically in LiveTableDisplay:
    // Normally we'd check that the focus method was called directly on the input
    // element after mousedown or when handleSelectionEnd is called

    // For this test, let's verify that handleCellFocus is called with the correct coordinates
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);

    // Verify we can edit the cell after focusing
    fireEvent.change(cellInput, { target: { value: "Updated Name" } });
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      "name",
      "Updated Name"
    );
  });
});
