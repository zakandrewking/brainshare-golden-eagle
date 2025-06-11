import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  useIsSelectingMock,
  useIsSelectingPush,
} from "@/__tests__/test-utils/useIsSelecting";
import {
  useSelectedCellMock,
  useSelectedCellPush,
} from "@/__tests__/test-utils/useSelectedCell";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useHeaders,
  useIsCellLocked,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";
import {
  useSelectedCells,
  useSelectionEnd,
  useSelectionStartOrMove,
} from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

vi.mock("@liveblocks/react", () => ({
  useSelf: vi.fn(() => ({
    info: {
      name: "Test User",
      color: "#FF0000",
    },
  })),
  useRoom: vi.fn(() => ({})),
  RoomProvider: vi.fn(({ children }) => children),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useIsCellLocked: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  selectIsCellSelected: vi.fn(),
  selectSelectedCells: vi.fn(),
  useSelectedCells: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionStartOrMove: vi.fn(),
  useSelectionEnd: vi.fn(),
  useIsSelecting: useIsSelectingMock,
  useSelectedCell: useSelectedCellMock,
  useSelectionArea: vi.fn(() => ({
    startCell: null,
    endCell: null,
  })),
}));

describe("LiveTableDisplay - Shift-Click Selection", () => {
  const initialHeaders = ["Col1", "Col2"];
  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { Col1: "R1C1", Col2: "R1C2" },
    [rowId2]: { Col1: "R2C1", Col2: "R2C2" },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLocked).mockReturnValue(false);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));
  });

  it("should expand selection with shift-click after an initial selection and update selectedCells", async () => {
    const mockHandleSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockHandleSelectionStartOrMove
    );

    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const firstCellToClick = screen.getByText("R1C1").closest("td");
    const secondCellToShiftClick = screen.getByText("R2C2").closest("td");

    if (!firstCellToClick || !secondCellToShiftClick) {
      throw new Error("Test cells not found");
    }

    // 1. Simulate initial click on cell (0,0)
    fireEvent.mouseDown(firstCellToClick);

    expect(mockHandleSelectionStartOrMove).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);

    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(firstCellToClick);

    await act(async () => {
      useIsSelectingPush(false);
      useSelectedCellPush({
        rowIndex: 0,
        colIndex: 0,
      });
    });

    // 2. Simulate shift-click on cell (1,1)
    fireEvent.mouseDown(secondCellToShiftClick, { shiftKey: true });

    expect(mockHandleSelectionStartOrMove).toHaveBeenCalledTimes(2);
    expect(mockHandleSelectionStartOrMove).toHaveBeenCalledWith(1, 1, true);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(secondCellToShiftClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(2);
  });

  it("should start a new selection with click if shift is not pressed, even if an anchor exists", async () => {
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockSelectionStartOrMove
    );
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    const { rerender } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const firstCellToClick = screen.getByText("R1C1").closest("td");
    const secondCellToClick = screen.getByText("R2C2").closest("td");

    if (!firstCellToClick || !secondCellToClick) {
      throw new Error("Test cells not found");
    }

    fireEvent.mouseDown(firstCellToClick);

    rerender(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionStartOrMove).toHaveBeenCalledTimes(1);
    expect(mockSelectionStartOrMove).toHaveBeenLastCalledWith(0, 0, false);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(firstCellToClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(1);

    await act(async () => {
      useIsSelectingPush(false);
    });

    fireEvent.mouseDown(secondCellToClick);

    rerender(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionStartOrMove).toHaveBeenCalledTimes(2);
    expect(mockSelectionStartOrMove).toHaveBeenLastCalledWith(1, 1, false);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(secondCellToClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(2);
  });

  it("should start a new selection with shift-click if no initial anchor exists", async () => {
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockSelectionStartOrMove
    );
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    const { rerender } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const cellToShiftClick = screen.getByText("R1C2").closest("td");
    if (!cellToShiftClick) {
      throw new Error("Test cell not found");
    }

    fireEvent.mouseDown(cellToShiftClick, { shiftKey: true });

    rerender(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionStartOrMove).toHaveBeenCalledTimes(1);
    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 1, true);

    // simulate the updated hook
    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(cellToShiftClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(1);
  });
});
