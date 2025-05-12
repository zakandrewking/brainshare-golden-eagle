import "@testing-library/jest-dom";

import React from "react";

import type { MockedFunction } from "vitest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
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

describe("LiveTableDisplay", () => {
  const mockHandleCellChange = vi.fn();
  const mockHandleCellFocus = vi.fn();
  const mockHandleCellBlur = vi.fn();
  const mockHandleSelectionStart = vi.fn();

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
      handleSelectionEnd: vi.fn(),
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

  it("clicking on a cell allows editing the input element", () => {
    render(<LiveTableDisplay />);

    // Find a cell in the table
    const cell = screen.getByDisplayValue("John Doe");
    expect(cell).toBeInTheDocument();

    // Simulate mouse down on the cell
    fireEvent.mouseDown(cell.parentElement as HTMLElement);

    // Verify that handleSelectionStart was called with correct row and column indices
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);

    // Simulate focus on the input
    fireEvent.focus(cell);

    // Verify that handleCellFocus was called with correct row and column indices
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);

    // Change the value of the input
    fireEvent.change(cell, { target: { value: "New Name" } });

    // Verify that handleCellChange was called with correct parameters
    expect(mockHandleCellChange).toHaveBeenCalledWith(0, "name", "New Name");
  });
});
