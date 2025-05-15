import "@testing-library/jest-dom";

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
import { useLiveTable } from "@/components/live-table/LiveTableProvider";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

const mockedUseLiveTable = vi.mocked(useLiveTable);

describe("LiveTableDisplay (referred to as LiveTable in its own file)", () => {
  const mockClearSelection = vi.fn();
  const mockSetSelectedCell = vi.fn();
  const mockSetEditingCell = vi.fn();
  const mockResizeColumn = vi.fn();
  const mockHandleCellChange = vi.fn();

  let ydoc: Y.Doc;
  let yTableForMock: Y.Array<Y.Map<unknown>>;
  let yHeadersForMock: Y.Array<string>;
  let yColWidthsForMock: Y.Map<number>;

  const initialTableData = {
    headers: [{ id: "col1", width: 100, label: "Column 1" }],
    rows: [
      { id: "row1", cells: [{ id: "cell1", value: "R1C1" }] },
      { id: "row2", cells: [{ id: "cell2", value: "R2C1" }] },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    ydoc = new Y.Doc();
    yTableForMock = ydoc.getArray<Y.Map<unknown>>("tableData");
    yHeadersForMock = ydoc.getArray<string>("tableHeaders");
    yColWidthsForMock = ydoc.getMap<number>("colWidths");

    const headerConfig = initialTableData.headers[0];
    yHeadersForMock.insert(0, [headerConfig.label]);
    yColWidthsForMock.set(headerConfig.label, headerConfig.width);

    const rowsToInsert = initialTableData.rows.map((rowDef) => {
      const yRow = new Y.Map<unknown>();
      rowDef.cells.forEach((cell) => {
        yRow.set(headerConfig.label, cell.value);
      });
      return yRow;
    });
    yTableForMock.insert(0, rowsToInsert);

    const jsHeaders = yHeadersForMock.toArray();
    const jsTableData = yTableForMock.toArray().map((yrow) => {
      const rowObj: Record<string, unknown> = {};
      yrow.forEach((value, key) => {
        rowObj[key] = value;
      });
      return rowObj;
    });
    const jsColumnWidths = Object.fromEntries(yColWidthsForMock.entries());

    mockedUseLiveTable.mockReturnValue({
      headers: jsHeaders,
      tableData: jsTableData,
      columnWidths: jsColumnWidths,
      yDoc: ydoc,
      yTable: yTableForMock,
      yHeaders: yHeadersForMock,
      yColWidths: yColWidthsForMock,
      handleCellChange: mockHandleCellChange,
      handleCellFocus: mockSetSelectedCell,
      handleCellBlur: vi.fn(),
      editingHeaderIndex: null,
      editingHeaderValue: "",
      handleHeaderDoubleClick: vi.fn(),
      handleHeaderChange: vi.fn(),
      handleHeaderBlur: vi.fn(),
      handleHeaderKeyDown: vi.fn(),
      handleColumnResize: mockResizeColumn,
      selectedCell: null,
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isSelecting: false,
      isCellSelected: vi.fn((_rowIndex, _colIndex) => {
        if (typeof _rowIndex === "number" && typeof _colIndex === "number") {
          return false;
        }
        return false;
      }),
      editingCell: null,
      setEditingCell: mockSetEditingCell,
      clearSelection: mockClearSelection,
      tableId: "test-table",
      isTableLoaded: true,
      undoManager: null,
      selectedCells: [],
      getSelectedCellsData: vi.fn(() => []),
      provider: { awareness: new Map() },
      selectedHeader: null,
      setSelectedHeader: vi.fn(),
      isHeaderSelected: vi.fn(() => false),
      isUndoPossible: false,
      isRedoPossible: false,
    } as unknown as ReturnType<typeof useLiveTable>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should clear selection when clicking outside the table", async () => {
    const baseMockValues = mockedUseLiveTable();

    mockedUseLiveTable.mockReturnValueOnce({
      ...(baseMockValues as object),
      selectedCell: { rowIndex: 0, colIndex: 0 },
      isCellSelected: vi.fn(
        (rowIndex, colIndex) => rowIndex === 0 && colIndex === 0
      ),
    } as unknown as ReturnType<typeof useLiveTable>);

    const captureClick = vi.fn();

    render(
      <div>
        <button data-testid="outside-element" onClick={captureClick}>
          Click Outside Here
        </button>
        <LiveTableDisplay />
      </div>
    );

    const outsideElement = screen.getByTestId("outside-element");
    fireEvent.click(outsideElement);
    // external elements should also receive the click event
    await vi.runAllTimersAsync();
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
    expect(captureClick).toHaveBeenCalledTimes(1);
  });

  it("should not clear selection when clicking inside the table", () => {
    const baseMockValues = mockedUseLiveTable();

    mockedUseLiveTable.mockReturnValueOnce({
      ...(baseMockValues as object),
      selectedCell: { rowIndex: 0, colIndex: 0 },
      isCellSelected: vi.fn(
        (rowIndex, colIndex) => rowIndex === 0 && colIndex === 0
      ),
    } as unknown as ReturnType<typeof useLiveTable>);

    render(<LiveTableDisplay />);
    const inputElement = screen.getByDisplayValue("R1C1");
    const cellElement = inputElement.closest("td");
    expect(cellElement).toBeInTheDocument();

    if (cellElement) {
      fireEvent.mouseDown(cellElement);
    } else {
      throw new Error("Could not find parent TD for input with value R1C1");
    }

    expect(mockClearSelection).not.toHaveBeenCalled();
  });
});
