import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import type {
  CellPosition,
  SelectionArea,
} from "@/components/live-table/LiveTableProvider";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

const mockedUseLiveTable = vi.mocked(LiveTableProviderModule.useLiveTable);

describe("LiveTableDisplay - Shift-Click Selection", () => {
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Col1", width: 150 },
    { id: colId2, name: "Col2", width: 150 },
  ];
  const initialColumnOrder: ColumnId[] = [colId1, colId2];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "R1C1", [colId2]: "R1C2" },
    [rowId2]: { [colId1]: "R2C1", [colId2]: "R2C2" },
  };

  let mockHandleSelectionStart: ReturnType<typeof vi.fn>;
  let mockHandleSelectionMove: ReturnType<typeof vi.fn>;
  let mockCurrentSelectedCellAnchor: CellPosition | null = null;
  let mockCurrentSelectionArea: SelectionArea = {
    startCell: null,
    endCell: null,
  };
  let mockIsSelectingState = false;

  // Helper to update the global mock for useLiveTable
  const updateLiveTableMock = () => {
    mockedUseLiveTable.mockReturnValue(
      getLiveTableMockValues({
        initialColumnDefinitions,
        initialColumnOrder,
        initialRowOrder,
        initialRowData,
        selectedCell: mockCurrentSelectedCellAnchor,
        selectionArea: mockCurrentSelectionArea,
        isSelecting: mockIsSelectingState,
        // Pass the mock functions themselves, not new vi.fn() each time
        handleSelectionStart: mockHandleSelectionStart,
        handleSelectionMove: mockHandleSelectionMove,
        // Add other necessary mocks if getLiveTableMockValues doesn't provide them by default
        // or if they need to be specific to this test suite
      })
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentSelectedCellAnchor = null;
    mockCurrentSelectionArea = { startCell: null, endCell: null };
    mockIsSelectingState = false;

    // Define mock implementations here where they can access and modify test-scoped variables
    mockHandleSelectionStart = vi.fn((rowIndex: number, colIndex: number) => {
      const cell = { rowIndex, colIndex };
      mockCurrentSelectedCellAnchor = cell;
      mockCurrentSelectionArea = { startCell: cell, endCell: cell };
      mockIsSelectingState = true;
      updateLiveTableMock(); // Update the global mock with new states
    });

    mockHandleSelectionMove = vi.fn((rowIndex: number, colIndex: number) => {
      mockCurrentSelectionArea = {
        ...mockCurrentSelectionArea,
        endCell: { rowIndex, colIndex },
      };
      // isSelecting state should ideally remain true during a move
      if (!mockIsSelectingState) mockIsSelectingState = true;
      updateLiveTableMock(); // Update the global mock with new states
    });

    updateLiveTableMock(); // Initial setup of the mock for useLiveTable
  });

  it("should expand selection with shift-click after an initial selection and update selectedCells", async () => {
    const { rerender } = render(<LiveTableDisplay />);

    const firstCellToClick = screen.getByDisplayValue("R1C1").closest("td");
    const secondCellToShiftClick = screen
      .getByDisplayValue("R2C2")
      .closest("td");

    if (!firstCellToClick || !secondCellToShiftClick) {
      throw new Error("Test cells not found");
    }

    // 1. Simulate initial click on cell (0,0)
    fireEvent.mouseDown(firstCellToClick);
    // mockHandleSelectionStart implementation updates mocks and calls updateLiveTableMock
    rerender(<LiveTableDisplay />);

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(mockCurrentSelectionArea).toEqual({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 0, colIndex: 0 },
    });
    // Check selectedCells after first click
    let currentContext = mockedUseLiveTable();
    expect(currentContext.selectedCells).toEqual([
      { rowIndex: 0, colIndex: 0 },
    ]);

    // 2. Simulate shift-click on cell (1,1)
    fireEvent.mouseDown(secondCellToShiftClick, { shiftKey: true });
    // mockHandleSelectionMove implementation updates mocks and calls updateLiveTableMock
    rerender(<LiveTableDisplay />);

    expect(mockHandleSelectionMove).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionMove).toHaveBeenCalledWith(1, 1);
    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockCurrentSelectionArea).toEqual({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 1, colIndex: 1 },
    });

    // Check selectedCells after shift-click (expansion)
    currentContext = mockedUseLiveTable();
    const expectedSelectedCells = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ];
    expect(currentContext.selectedCells).toEqual(
      expect.arrayContaining(expectedSelectedCells)
    );
    expect(expectedSelectedCells).toEqual(
      expect.arrayContaining(currentContext.selectedCells)
    );
    expect(currentContext.selectedCells.length).toBe(
      expectedSelectedCells.length
    );

    // console.log("mockSelectedCell at end of test:", mockCurrentSelectedCellAnchor);
    // if (mockHandleSelectionMove.mock.calls.length > 0) {
    //   console.log("mockHandleSelectionMove was called with:", mockHandleSelectionMove.mock.calls[0]);
    // }
  });

  it("should start a new selection with click if shift is not pressed, even if an anchor exists", async () => {
    const { rerender } = render(<LiveTableDisplay />);

    const firstCellToClick = screen.getByDisplayValue("R1C1").closest("td");
    const secondCellToClick = screen.getByDisplayValue("R2C2").closest("td");

    if (!firstCellToClick || !secondCellToClick) {
      throw new Error("Test cells not found");
    }

    fireEvent.mouseDown(firstCellToClick);
    rerender(<LiveTableDisplay />);

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenLastCalledWith(0, 0);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 0 });
    let currentContext = mockedUseLiveTable();
    expect(currentContext.selectedCells).toEqual([
      { rowIndex: 0, colIndex: 0 },
    ]);

    fireEvent.mouseDown(secondCellToClick);
    rerender(<LiveTableDisplay />);

    expect(mockHandleSelectionMove).not.toHaveBeenCalled();
    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(2);
    expect(mockHandleSelectionStart).toHaveBeenLastCalledWith(1, 1);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 1, colIndex: 1 });
    currentContext = mockedUseLiveTable();
    expect(currentContext.selectedCells).toEqual([
      { rowIndex: 1, colIndex: 1 },
    ]);
  });

  it("should start a new selection with shift-click if no initial anchor exists", async () => {
    const { rerender } = render(<LiveTableDisplay />);

    expect(mockCurrentSelectedCellAnchor).toBeNull();

    const cellToShiftClick = screen.getByDisplayValue("R1C2").closest("td");
    if (!cellToShiftClick) {
      throw new Error("Test cell not found");
    }

    fireEvent.mouseDown(cellToShiftClick, { shiftKey: true });
    rerender(<LiveTableDisplay />);

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 1);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 1 });
    const currentContext = mockedUseLiveTable();
    expect(currentContext.selectedCells).toEqual([
      { rowIndex: 0, colIndex: 1 },
    ]);
    expect(mockHandleSelectionMove).not.toHaveBeenCalled();
  });
});
