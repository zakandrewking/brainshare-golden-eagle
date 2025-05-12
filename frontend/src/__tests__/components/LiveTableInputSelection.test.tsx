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

describe("LiveTableDisplay Input Text Selection", () => {
  const mockHandleCellChange = vi.fn();
  const mockHandleCellFocus = vi.fn();
  const mockHandleCellBlur = vi.fn();
  const mockHandleSelectionStart = vi.fn();
  const mockHandleSelectionEnd = vi.fn();
  const mockSetEditingCell = vi.fn();

  // Mock window.getSelection
  const mockGetSelection = vi.fn();
  const originalGetSelection = window.getSelection;

  beforeEach(() => {
    // Setup mock implementation of useLiveTable
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
      // Initially not in edit mode
      editingCell: null,
      setEditingCell: mockSetEditingCell,
    });

    // Mock window.getSelection
    const mockSelectionObject = {
      removeAllRanges: vi.fn(),
      addRange: vi.fn(),
      getRangeAt: vi.fn(),
      rangeCount: 0,
      toString: vi.fn().mockReturnValue(""),
    };
    mockGetSelection.mockReturnValue(mockSelectionObject);
    window.getSelection = mockGetSelection;
  });

  afterEach(() => {
    vi.clearAllMocks();
    window.getSelection = originalGetSelection;
  });

  it("should allow text selection in the input element after entering edit mode", () => {
    render(<LiveTableDisplay />);

    // Find the input element and its parent cell
    const cellInput = screen.getByDisplayValue("John Doe");
    const cell = cellInput.closest("td");

    // Double-click to enter edit mode
    fireEvent.doubleClick(cell!);

    // Verify edit mode was entered
    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });

    // Now update the mock to simulate being in edit mode
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockReturnValue({
      ...(useLiveTable as MockedFunction<typeof useLiveTable>)(),
      editingCell: { rowIndex: 0, colIndex: 0 },
    });

    // Simulate mousedown inside the input (for text selection start)
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });

    // Spy on preventDefault to check if it's called
    const preventDefaultSpy = vi.spyOn(mouseDownEvent, "preventDefault");

    // Dispatch the event on the input
    cellInput.dispatchEvent(mouseDownEvent);

    // Check that preventDefault was NOT called
    // If it is being called, that would prevent text selection
    expect(preventDefaultSpy).not.toHaveBeenCalled();

    // And verify selection start was NOT called (since we're in edit mode)
    expect(mockHandleSelectionStart).not.toHaveBeenCalled();
  });
});
