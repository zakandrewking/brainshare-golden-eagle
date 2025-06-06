import "@testing-library/jest-dom";

import React from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen } from "@testing-library/react";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import {
  useHeaders,
  useIsCellLocked,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";
import {
  useClearSelection,
  useIsSelecting,
  useSelectedCell,
  useSelectedCells,
  useSelectionArea,
  useSelectionStart,
} from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the dataStore
vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useIsCellLocked: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
  useSelectionArea: vi.fn(),
  useIsSelecting: vi.fn(),
  useClearSelection: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionMove: vi.fn(),
  useSelectionEnd: vi.fn(),
}));

const mockedUseLiveTable = vi.mocked(useLiveTable);

describe("LiveTableDisplay (referred to as LiveTable in its own file)", () => {
  const initialHeaders = ["Column 1"];
  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [initialHeaders[0]]: "R1C1" },
    [rowId2]: { [initialHeaders[0]]: "R2C1" },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLocked).mockImplementation(() => false);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));
    vi.mocked(useSelectionStart).mockImplementation(() => vi.fn());

    mockedUseLiveTable.mockReturnValue({
      documentTitle: "",
      documentDescription: "",
      tableId: "",
      awarenessStates: new Map(),
      cursorsData: [],
      getCursorsForCell: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should clear selection when clicking outside the table", async () => {
    const mockClearSelection = vi.fn();
    vi.mocked(useClearSelection).mockImplementation(() => mockClearSelection);
    vi.mocked(useSelectionStart).mockImplementation(() => vi.fn());

    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    vi.mocked(useSelectionArea).mockReturnValue({
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 0, colIndex: 0 },
    });
    vi.mocked(useIsSelecting).mockReturnValue(false);

    render(
      <div>
        <TestDataStoreWrapper>
          <LiveTableDisplay />
        </TestDataStoreWrapper>
      </div>
    );

    fireEvent.mouseDown(document.body);

    expect(mockClearSelection).toHaveBeenCalledTimes(1);
  });

  it("should not clear selection when clicking inside the table", () => {
    const mockCurrentSelectedCell = { rowIndex: 0, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(mockCurrentSelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([mockCurrentSelectedCell]);
    vi.mocked(useSelectionArea).mockReturnValue({
      startCell: mockCurrentSelectedCell,
      endCell: mockCurrentSelectedCell,
    });

    const mockClearSelection = vi.fn();
    vi.mocked(useClearSelection).mockImplementation(() => mockClearSelection);

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
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
