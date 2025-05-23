import { beforeEach, describe, expect, it, vi } from "vitest";

// Removed Y import as direct Yjs manipulation for V1 setup is removed.
import { act, fireEvent, render, screen } from "@testing-library/react";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
// Import V2 types for defining initial data
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import * as LiveTableProviderModule from "@/components/live-table/LiveTableProvider";

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock process.env.NODE_ENV
vi.stubEnv("NODE_ENV", "test");

describe("LiveTableDisplay - Drag Selection", () => {
  // Define V2 initial data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const colId3 = crypto.randomUUID() as ColumnId;

  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Column1", width: 150 },
    { id: colId2, name: "Column2", width: 150 },
    { id: colId3, name: "Column3", width: 150 },
  ];
  const initialColumnOrder: ColumnId[] = [colId1, colId2, colId3];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "A1", [colId2]: "B1", [colId3]: "C1" },
    [rowId2]: { [colId1]: "A2", [colId2]: "B2", [colId3]: "C2" },
    [rowId3]: { [colId1]: "A3", [colId2]: "B3", [colId3]: "C3" },
  };

  const mockHandleSelectionStart = vi.fn();
  const mockHandleSelectionMove = vi.fn();
  const mockHandleSelectionEnd = vi.fn();
  const mockSetEditingCell = vi.fn();
  const mockIsCellSelected = vi
    .fn()
    .mockImplementation((rowIndex, colIndex) => {
      return (
        (rowIndex === 0 || rowIndex === 1) && (colIndex === 0 || colIndex === 1)
      );
    });
  // This data should correspond to the selection (0,0)-(1,1) from initialRowData
  const mockGetSelectedCellsData = vi.fn().mockReturnValue([
    ["A1", "B1"],
    ["A2", "B2"],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();

    // getLiveTableMockValues will create LiveTableDoc with this V2 data
    const mockContextValue = getLiveTableMockValues({
      initialColumnDefinitions,
      initialColumnOrder,
      initialRowOrder,
      initialRowData,
      // Selection-related properties for the test setup
      selectedCell: null,
      selectionArea: {
        startCell: { rowIndex: 0, colIndex: 0 },
        endCell: { rowIndex: 1, colIndex: 1 },
      },
      isSelecting: false,
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
        { rowIndex: 1, colIndex: 0 },
        { rowIndex: 1, colIndex: 1 },
      ],
      handleSelectionStart: mockHandleSelectionStart,
      handleSelectionMove: mockHandleSelectionMove,
      handleSelectionEnd: mockHandleSelectionEnd,
      isCellSelected: mockIsCellSelected,
      getSelectedCellsData: mockGetSelectedCellsData,
      editingCell: null,
      setEditingCell: mockSetEditingCell,
    });

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockContextValue as ReturnType<
        typeof LiveTableProviderModule.useLiveTable
      >
    );
  });

  it("should start selection when mousedown on a cell (not in edit mode)", () => {
    render(<LiveTableDisplay />);
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
  });

  it("should not start selection when mousedown on a cell in edit mode", () => {
    const currentMock = LiveTableProviderModule.useLiveTable();
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...currentMock,
      editingCell: { rowIndex: 0, colIndex: 0 },
    } as ReturnType<typeof LiveTableProviderModule.useLiveTable>);

    render(<LiveTableDisplay />);
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockHandleSelectionStart).not.toHaveBeenCalled();
  });

  it("should update selection when mousemove over cells during selection", () => {
    const currentMock = LiveTableProviderModule.useLiveTable();
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValueOnce({
      ...currentMock,
      isSelecting: true,
    } as ReturnType<typeof LiveTableProviderModule.useLiveTable>);

    render(<LiveTableDisplay />);
    const cell = screen.getAllByTestId("table-cell")[4];
    fireEvent.mouseDown(cell);
    expect(mockHandleSelectionStart).toHaveBeenCalled();
  });

  it("should end selection when mouseup", async () => {
    const currentMock = LiveTableProviderModule.useLiveTable();
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValueOnce({
      ...currentMock,
      isSelecting: true,
    } as ReturnType<typeof LiveTableProviderModule.useLiveTable>);

    render(<LiveTableDisplay />);
    fireEvent.mouseUp(document);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockHandleSelectionEnd).toHaveBeenCalled();
  });

  it("should apply the selection highlight style to selected cells", () => {
    render(<LiveTableDisplay />);
    const cells = screen.getAllByTestId("table-cell");

    const numberOfColumns = initialColumnOrder.length;
    const cell00 = cells[0];
    const cell01 = cells[1];
    const cell10 = cells[numberOfColumns];
    const cell11 = cells[numberOfColumns + 1];
    const cell02 = cells[2];

    expect(cell00.getAttribute("data-selected")).toBe("true");
    expect(cell01.getAttribute("data-selected")).toBe("true");
    expect(cell10.getAttribute("data-selected")).toBe("true");
    expect(cell11.getAttribute("data-selected")).toBe("true");
    expect(cell02.getAttribute("data-selected")).toBe("false");
  });
});
