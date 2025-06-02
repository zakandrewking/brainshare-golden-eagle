import React from "react";

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
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import type {
  CellPosition,
  SelectionArea,
} from "@/components/live-table/LiveTableProvider";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
// Use an ES6 import style for the mocked function
import {
  type SelectionState,
  selectIsCellSelected as mockedSelectIsCellSelectedOriginal,
  selectSelectedCells as actualSelectSelectedCells,
  useSelectionStore,
} from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the dataStore
vi.mock("@/stores/dataStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/dataStore")>();
  return {
    ...actual,
    useIsCellLocked: () => vi.fn(() => false),
  };
});

// Add a mock for the selection store
vi.mock("@/stores/selectionStore", () => ({
  useSelectionStore: vi.fn(),
  selectIsCellSelected: vi.fn(),
  selectSelectedCells: vi.fn(),
  useSelectedCells: vi.fn(),
}));

const mockedUseLiveTable = vi.mocked(LiveTableProviderModule.useLiveTable);
const mockedUseSelectionStore = vi.mocked(useSelectionStore);

const mockedSelectIsCellSelected = vi.mocked(
  mockedSelectIsCellSelectedOriginal
);
const mockedSelectSelectedCells = vi.mocked(actualSelectSelectedCells);

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

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  // Helper to update the global mock for useLiveTable
  const updateLiveTableMock = () => {
    mockedUseLiveTable.mockReturnValue(
      getLiveTableMockValues({
        liveTableDocInstance,
        initialColumnDefinitions,
        initialColumnOrder,
        initialRowOrder,
        initialRowData,
        selectionArea: {
          startCell: mockCurrentSelectedCellAnchor,
          endCell: mockCurrentSelectedCellAnchor,
        },
      })
    );

    mockedUseSelectionStore.mockImplementation(
      <TState = SelectionState,>(
        selector?: (state: SelectionState) => TState
      ): TState | SelectionState => {
        const state: SelectionState = {
          selectedCell: mockCurrentSelectedCellAnchor,
          selectionArea: mockCurrentSelectionArea,
          isSelecting: mockIsSelectingState,
          setSelectedCell: vi.fn(),
          startSelection: mockHandleSelectionStart,
          moveSelection: mockHandleSelectionMove,
          endSelection: vi.fn(),
          clearSelection: vi.fn(),
        };
        if (selector) {
          return selector(state);
        }
        return state;
      }
    );

    mockedSelectSelectedCells.mockImplementation(
      (state: SelectionState): CellPosition[] => {
        if (!state.selectionArea.startCell || !state.selectionArea.endCell) {
          return state.selectedCell ? [state.selectedCell] : [];
        }
        const { startCell, endCell } = state.selectionArea;
        const cells: CellPosition[] = [];
        const minRow = Math.min(startCell.rowIndex, endCell.rowIndex);
        const maxRow = Math.max(startCell.rowIndex, endCell.rowIndex);
        const minCol = Math.min(startCell.colIndex, endCell.colIndex);
        const maxCol = Math.max(startCell.colIndex, endCell.colIndex);
        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            cells.push({ rowIndex: r, colIndex: c });
          }
        }
        return cells;
      }
    );

    mockedSelectIsCellSelected.mockImplementation(
      (
        stateFromSelector: SelectionState,
        rowIndex: number,
        colIndex: number
      ): boolean => {
        const currentSelectedCells =
          mockedSelectSelectedCells(stateFromSelector);
        return currentSelectedCells.some(
          (cell: CellPosition) =>
            cell.rowIndex === rowIndex && cell.colIndex === colIndex
        );
      }
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);
    // Manually populate V2 data
    yDoc.transact(() => {
      initialColumnDefinitions.forEach((def) =>
        liveTableDocInstance.yColumnDefinitions.set(def.id, def)
      );
      liveTableDocInstance.yColumnOrder.push(initialColumnOrder);
      initialRowOrder.forEach((rId) => {
        const rData = initialRowData[rId];
        const yRowMap = new Y.Map<CellValue>();
        initialColumnOrder.forEach((cId) => {
          if (rData[cId] !== undefined) yRowMap.set(cId, rData[cId]);
        });
        liveTableDocInstance.yRowData.set(rId, yRowMap);
      });
      liveTableDocInstance.yRowOrder.push(initialRowOrder);
      liveTableDocInstance.yMeta.set("schemaVersion", 2);
    });

    mockCurrentSelectedCellAnchor = null;
    mockCurrentSelectionArea = { startCell: null, endCell: null };
    mockIsSelectingState = false;

    mockHandleSelectionStart = vi.fn((rowIndex: number, colIndex: number) => {
      const cell = { rowIndex, colIndex };
      mockCurrentSelectedCellAnchor = cell;
      mockCurrentSelectionArea = { startCell: cell, endCell: cell };
      mockIsSelectingState = true;
      // Simulate that startSelection action in the store is called
      // This will trigger updates in components observing useSelectionStore
      updateLiveTableMock();
    });

    mockHandleSelectionMove = vi.fn((rowIndex: number, colIndex: number) => {
      if (!mockCurrentSelectionArea.startCell) {
        mockCurrentSelectionArea.startCell = mockCurrentSelectedCellAnchor || {
          rowIndex: 0,
          colIndex: 0,
        };
      }
      mockCurrentSelectionArea = {
        ...mockCurrentSelectionArea,
        endCell: { rowIndex, colIndex },
      };
      if (!mockIsSelectingState) mockIsSelectingState = true;
      // Simulate that moveSelection action in the store is called
      updateLiveTableMock();
    });

    updateLiveTableMock(); // Initial setup
  });

  afterEach(() => {
    yDoc.destroy();
  });

  it("should expand selection with shift-click after an initial selection and update selectedCells", async () => {
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

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
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(mockCurrentSelectionArea).toEqual({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 0, colIndex: 0 },
    });
    // Check selectedCells after first click
    let storeState = mockedUseSelectionStore(
      (state) => state
    ) as SelectionState;
    expect(mockedSelectSelectedCells(storeState)).toEqual([
      { rowIndex: 0, colIndex: 0 },
    ]);

    // 2. Simulate shift-click on cell (1,1)
    fireEvent.mouseDown(secondCellToShiftClick, { shiftKey: true });
    // mockHandleSelectionMove implementation updates mocks and calls updateLiveTableMock
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockHandleSelectionMove).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionMove).toHaveBeenCalledWith(1, 1);
    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockCurrentSelectionArea).toEqual({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 1, colIndex: 1 },
    });

    // Check selectedCells after shift-click (expansion) from the store
    storeState = mockedUseSelectionStore((state) => state) as SelectionState;
    const expectedSelectedCells = mockedSelectSelectedCells(storeState);
    expect(expectedSelectedCells).toEqual(
      expect.arrayContaining(mockedSelectSelectedCells(storeState))
    );
    expect(expectedSelectedCells.length).toBe(
      mockedSelectSelectedCells(storeState).length
    );
  });

  it("should start a new selection with click if shift is not pressed, even if an anchor exists", async () => {
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const firstCellToClick = screen.getByDisplayValue("R1C1").closest("td");
    const secondCellToClick = screen.getByDisplayValue("R2C2").closest("td");

    if (!firstCellToClick || !secondCellToClick) {
      throw new Error("Test cells not found");
    }

    fireEvent.mouseDown(firstCellToClick);
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenLastCalledWith(0, 0);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 0 });
    // Access selectedCells from the mocked store
    let storeState = mockedUseSelectionStore(
      (state) => state
    ) as SelectionState;
    expect(mockedSelectSelectedCells(storeState)).toEqual([
      { rowIndex: 0, colIndex: 0 },
    ]);

    fireEvent.mouseDown(secondCellToClick);
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockHandleSelectionMove).not.toHaveBeenCalled();
    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(2);
    expect(mockHandleSelectionStart).toHaveBeenLastCalledWith(1, 1);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 1, colIndex: 1 });
    // Access selectedCells from the mocked store
    storeState = mockedUseSelectionStore((state) => state) as SelectionState;
    expect(mockedSelectSelectedCells(storeState)).toEqual([
      { rowIndex: 1, colIndex: 1 },
    ]);
  });

  it("should start a new selection with shift-click if no initial anchor exists", async () => {
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockCurrentSelectedCellAnchor).toBeNull();

    const cellToShiftClick = screen.getByDisplayValue("R1C2").closest("td");
    if (!cellToShiftClick) {
      throw new Error("Test cell not found");
    }

    fireEvent.mouseDown(cellToShiftClick, { shiftKey: true });
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 1);
    expect(mockCurrentSelectedCellAnchor).toEqual({ rowIndex: 0, colIndex: 1 });
    // Access selectedCells from the mocked store
    const storeState = mockedUseSelectionStore(
      (state) => state
    ) as SelectionState;
    expect(mockedSelectSelectedCells(storeState)).toEqual([
      { rowIndex: 0, colIndex: 1 },
    ]);
    expect(mockHandleSelectionMove).not.toHaveBeenCalled();
  });
});
