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

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/live-table-doc";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import {
  useClearSelection,
  useIsSelecting,
  useSelectedCell,
  useSelectedCells,
  useSelectionArea,
  useSelectionStart,
} from "@/stores/selection-store";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the dataStore
vi.mock("@/stores/dataStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/data-store")>();
  return {
    ...actual,
    useIsCellLocked: () => vi.fn(() => false),
  };
});

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
  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  // V2 data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Column 1", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colId1];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "R1C1" },
    [rowId2]: { [colId1]: "R2C1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

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

    mockedUseLiveTable.mockReturnValue(
      getLiveTableMockValues({
        liveTableDocInstance,
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    yDoc.destroy();
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

    const captureClick = vi.fn();

    render(
      <div>
        <button data-testid="outside-element" onClick={captureClick}>
          Click Outside Here
        </button>
        <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
          <LiveTableDisplay />
        </TestDataStoreWrapper>
      </div>
    );

    const outsideElement = screen.getByTestId("outside-element");
    fireEvent.click(outsideElement);
    await vi.runAllTimersAsync();
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
    expect(captureClick).toHaveBeenCalledTimes(1);
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

    mockedUseLiveTable.mockReturnValueOnce(
      getLiveTableMockValues({
        liveTableDocInstance,
      })
    );

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
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
