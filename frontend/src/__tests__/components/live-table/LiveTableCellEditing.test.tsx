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

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
  const mockSetEditingCell = vi.fn();

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
      undoManager: null,
      tableId: "test-table",
      isTableLoaded: true,
      selectionArea: { startCell: null, endCell: null },
      selectedCells: [],
      clearSelection: vi.fn(),
      getSelectedCellsData: vi.fn(),
      editingCell: null,
      setEditingCell: mockSetEditingCell,
      generateAndInsertRows: vi
        .fn()
        .mockResolvedValue({ aiRowsAdded: 0, defaultRowsAdded: 0 }),
      deleteRows: vi.fn().mockResolvedValue({ deletedCount: 0 }),
      generateAndInsertColumns: vi
        .fn()
        .mockResolvedValue({ aiColsAdded: 0, defaultColsAdded: 0 }),
      deleteColumns: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("handles cell interactions correctly - click behavior and edit mode", async () => {
    const user = userEvent.setup();

    render(<LiveTableDisplay />);

    // Find an input element within a cell
    const cellInput = screen.getByDisplayValue("John Doe");
    expect(cellInput).toBeDefined();

    // Single click should only select the cell, not put it in edit mode
    await user.click(cellInput);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(mockSetEditingCell).not.toHaveBeenCalled();
    expect(cellInput).not.toHaveFocus();

    // Double-click should put the cell into edit mode
    await user.dblClick(cellInput);
    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });

    // Instead of asserting focus, which is problematic in JSDOM,
    // verify that the necessary conditions for edit mode are satisfied
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);

    // Change the value of the input
    fireEvent.change(cellInput, { target: { value: "New Name" } });

    // Verify that handleCellChange was called with correct parameters
    expect(mockHandleCellChange).toHaveBeenCalledWith(0, "name", "New Name");

    // Verify that the input is not focused after next selection
    const nextCellInput = screen.getByDisplayValue("Jane Smith");
    await user.click(nextCellInput);
    expect(cellInput).not.toHaveFocus();
    expect(mockHandleCellBlur).toHaveBeenCalled();
  });
});
