import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { act, fireEvent, render, screen } from "@testing-library/react";

import generateNewColumns from "@/components/live-table/actions/generateNewColumns";
import { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import {
  useHeaders,
  useIsCellLockedFn,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";
import { useSelectedCell, useSelectedCells } from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal<typeof importOriginal>()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/components/live-table/actions/generateNewColumns", () => ({
  default: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof importOriginal>()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
}));

const mockGenerateAndInsertRows = vi.fn();
const mockGenerateAndInsertColumns = vi.fn();
const mockInsertEmptyColumns = vi.fn();
const mockInsertEmptyRows = vi.fn();
const mockDeleteRows = vi.fn();
const mockDeleteColumns = vi.fn();
const mockUndoManager = {
  undo: vi.fn(),
  redo: vi.fn(),
  undoStack: [],
  redoStack: [],
  on: vi.fn(),
  off: vi.fn(),
  stopCapturing: vi.fn(),
};

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
  useIsCellLockedFn: vi.fn(),
  useGenerateAndInsertRows: vi.fn(() => mockGenerateAndInsertRows),
  useGenerateAndInsertColumns: vi.fn(() => mockGenerateAndInsertColumns),
  useInsertEmptyColumns: vi.fn(() => mockInsertEmptyColumns),
  useInsertEmptyRows: vi.fn(() => mockInsertEmptyRows),
  useDeleteRows: vi.fn(() => mockDeleteRows),
  useDeleteColumns: vi.fn(() => mockDeleteColumns),
  useUndoManager: vi.fn(() => mockUndoManager),
}));

describe("LiveTableToolbar - Add Column Buttons", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);

    const mockData = getLiveTableMockValues({});
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call generateAndInsertColumns when add left button is clicked and AI succeeds", async () => {
    vi.mocked(generateNewColumns).mockResolvedValueOnce({
      generatedColumns: [
        {
          headerName: "AI Column",
          columnData: ["value1", "value2"],
        },
      ],
    });

    const testYDoc = new Y.Doc();
    const liveTableDoc = new LiveTableDoc(testYDoc);
    vi.mocked(useHeaders).mockReturnValue(["A", "B"]);
    vi.mocked(useTableData).mockReturnValue([{ A: "foo", B: "bar" }]);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );

    const addLeftButton = screen.getByRole("button", {
      name: "Add Column to the Left",
    });
    await act(async () => {
      fireEvent.mouseDown(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(0, 1);
  });

  it("should call generateAndInsertColumns when AI returns an error for add right button (single column)", async () => {
    vi.mocked(generateNewColumns).mockResolvedValueOnce({
      error: "AI Error",
    });
    const testYDoc = new Y.Doc();
    const liveTableDoc = new LiveTableDoc(testYDoc);

    const mockSelectedCell = { rowIndex: 0, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(mockSelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([mockSelectedCell]);

    vi.mocked(useHeaders).mockReturnValue(["A"]);
    vi.mocked(useTableData).mockReturnValue([{ A: "test" }]);
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const addRightButton = screen.getByRole("button", {
      name: "Add Column to the Right",
    });

    await act(async () => {
      fireEvent.mouseDown(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(1, 1);
  });

  it("should call generateAndInsertColumns when add left button is clicked and AI promise rejects", async () => {
    vi.mocked(generateNewColumns).mockRejectedValueOnce(
      new Error("Network Error")
    );

    const testYDoc = new Y.Doc();
    const liveTableDoc = new LiveTableDoc(testYDoc);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    vi.mocked(useHeaders).mockReturnValue(["A"]);
    vi.mocked(useTableData).mockReturnValue([{ A: "test" }]);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const addLeftButton = screen.getByRole("button", {
      name: "Add Column to the Left",
    });

    await act(async () => {
      fireEvent.mouseDown(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalled();
  });

  it("should call the API and handle pending state when add column operation starts", async () => {
    const neverResolvedPromise = new Promise<{
      newHeader?: string;
      newColumnData?: string[];
      error?: string;
    }>(() => {});
    vi.mocked(generateNewColumns).mockReturnValueOnce(neverResolvedPromise);
    const testYDoc = new Y.Doc();
    const liveTableDoc = new LiveTableDoc(testYDoc);

    const mockData = getLiveTableMockValues({
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);
    vi.mocked(useHeaders).mockReturnValue(["A", "B"]);
    vi.mocked(useTableData).mockReturnValue([{ A: "test" }]);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );

    const addColumnLeftButton = screen.getByRole("button", {
      name: "Add 2 Columns to the Left",
    });
    await act(async () => {
      fireEvent.mouseDown(addColumnLeftButton);
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalled();
    // Flush promises
    await act(async () => {
      await vi.runAllTimersAsync();
    });
  });
});

describe("LiveTableToolbar - Add Row Buttons", () => {
  let mockLiveTable: LiveTableDoc;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGenerateAndInsertRows.mockReset();

    const mockYDoc = new Y.Doc();
    mockLiveTable = new LiveTableDoc(mockYDoc);
    mockLiveTable.insertColumns(0, [
      { headerName: "Name", columnData: ["Alice"] },
      { headerName: "Age", columnData: ["30"] },
    ]);

    const mockData = getLiveTableMockValues({});
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    vi.mocked(useHeaders).mockReturnValue(["Name", "Age"]);
    vi.mocked(useTableData).mockReturnValue([{ Name: "Alice", Age: 30 }]);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);

    mockGenerateAndInsertRows.mockResolvedValue({
      aiRowsAdded: 0,
      defaultRowsAdded: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Add Row Above: 1 selected row, calls generateAndInsertRows correctly", async () => {
    mockLiveTable.insertRows(1, [{ Name: "Bob", Age: "40" }]);
    const selectedCell = { rowIndex: 1, colIndex: 0 };

    vi.mocked(useSelectedCell).mockReturnValue(selectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCell]);
    vi.mocked(useTableData).mockReturnValue([
      { Name: "Alice", Age: 30 },
      { Name: "Bob", Age: 40 },
    ]);

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );

    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(1, 1);
  });

  it("Add Row Below: 1 selected row, calls generateAndInsertRows correctly", async () => {
    const selectedCell = { rowIndex: 0, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(selectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCell]);

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add Row Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(1, 1);
  });

  it("Add Row Above: 2 selected rows, calls generateAndInsertRows correctly", async () => {
    mockLiveTable.insertRows(1, [
      { Name: "Bob", Age: "40" },
      { Name: "Charlie", Age: "50" },
    ]);
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 };
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 0 },
    ];
    vi.mocked(useSelectedCell).mockReturnValue(primarySelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsData);

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add 2 Rows Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(0, 2);
  });

  it("Add Row Below: 3 selected rows (non-contiguous), calls generateAndInsertRows correctly", async () => {
    mockLiveTable.insertRows(1, [
      { Name: "B", Age: "1" },
      { Name: "C", Age: "2" },
      { Name: "D", Age: "3" },
    ]);
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 };
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 0 },
      { rowIndex: 3, colIndex: 0 },
    ];

    vi.mocked(useSelectedCell).mockReturnValue(primarySelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsData);

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add 3 Rows Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(4, 3);
  });

  it("Add Row Above: selectedCell is set but selectedCells is empty, calls generateAndInsertRows", async () => {
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(0, 1);
  });
});

describe("LiveTableToolbar - Add Multiple Columns", () => {
  let mockLiveTable: LiveTableDoc;
  const setupYjsBaseDoc = (
    initialHeaders: string[],
    initialTableData: Record<string, unknown>[]
  ) => {
    const liveTableDoc = new LiveTableDoc(new Y.Doc());
    const columnsToInsert = initialHeaders.map((header) => ({
      headerName: header,
      columnData: initialTableData.map((row) => row[header] as string),
    }));
    if (columnsToInsert.length > 0) {
      liveTableDoc.insertColumns(0, columnsToInsert);
    } else if (initialTableData.length > 0) {
      liveTableDoc.insertEmptyRows(0, initialTableData.length);
    }
    return liveTableDoc;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(generateNewColumns).mockReset();
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should add 2 AI columns to the left when AI succeeds", async () => {
    const numColsToRequest = 2;
    mockLiveTable = setupYjsBaseDoc(
      ["ExCol1", "ExCol2"],
      [{ ExCol1: "Val1", ExCol2: "Val2" }]
    );

    vi.mocked(useHeaders).mockReturnValue(["ExCol1", "ExCol2"]);
    vi.mocked(useTableData).mockReturnValue([
      { ExCol1: "Val1", ExCol2: "Val2" },
    ]);
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    vi.mocked(generateNewColumns).mockResolvedValueOnce({
      generatedColumns: [
        { headerName: "AI Col 1", columnData: ["d1"] },
        { headerName: "AI Col 2", columnData: ["d2"] },
      ],
    });

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const addLeftButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the Left`,
    });

    await act(async () => {
      fireEvent.mouseDown(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
      0,
      numColsToRequest
    );
  });

  it("should add 2 default columns to the right when AI for multiple columns returns error", async () => {
    const numColsToRequest = 2;
    mockLiveTable = setupYjsBaseDoc(
      ["ExCol1", "ExCol2"],
      [{ ExCol1: "Val1", ExCol2: "Val2" }]
    );

    vi.mocked(useHeaders).mockReturnValue(["ExCol1", "ExCol2"]);
    vi.mocked(useTableData).mockReturnValue([
      { ExCol1: "Val1", ExCol2: "Val2" },
    ]);
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    vi.mocked(generateNewColumns).mockRejectedValueOnce(new Error("AI failed"));

    render(
      <TestDataStoreWrapper liveTableDoc={mockLiveTable}>
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const addRightButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the Right`,
    });

    await act(async () => {
      fireEvent.mouseDown(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
      2,
      numColsToRequest
    );
  });
});
