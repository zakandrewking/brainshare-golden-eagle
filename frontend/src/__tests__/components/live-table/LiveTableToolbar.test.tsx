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
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import generateNewColumns
  from "@/components/live-table/actions/generateNewColumns";
import { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { useSelectedCell, useSelectedCells } from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/components/live-table/actions/generateNewColumns", () => ({
  default: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
}));

const mockGenerateAndInsertRowsReal = vi.fn();
const mockGenerateAndInsertColumnsReal = vi.fn();
const mockInsertEmptyColumnsReal = vi.fn();

vi.mock("@/stores/dataStore", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useLockedCells: () => new Set(),
    useLockSelectedRange: () => vi.fn(),
    useUnlockAll: () => vi.fn(),
    useUnlockRange: () => vi.fn(),
    useIsCellLocked: () => vi.fn(() => false),
    useUndoManager: () => ({
      undo: vi.fn(),
      redo: vi.fn(),
      undoStack: [],
      redoStack: [],
      on: vi.fn(),
      off: vi.fn(),
    }),
    useHandleCellFocus: () => vi.fn(),
    useHandleCellBlur: () => vi.fn(),
    useHandleHeaderDoubleClick: () => vi.fn(),
    useHandleHeaderChange: () => vi.fn(),
    useHandleHeaderBlur: () => vi.fn(),
    useHandleColumnResize: () => vi.fn(),
    useEditingHeaderIndex: () => null,
    useEditingHeaderValue: () => "",
    useHandleCellChange: () => vi.fn(),
    useSetEditingCell: () => vi.fn(),
    useEditingCell: () => null,
    useGenerateAndInsertRows: () => mockGenerateAndInsertRowsReal,
    useGenerateAndInsertColumns: () => mockGenerateAndInsertColumnsReal,
    useInsertEmptyColumns: () => mockInsertEmptyColumnsReal,
  };
});

describe("LiveTableToolbar - Add Column Buttons", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
    });

    vi.mocked(useLiveTable).mockReturnValue(mockData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call mockGenerateAndInsertColumns when add left button is clicked and AI succeeds", async () => {
    vi.mocked(generateNewColumns).mockResolvedValueOnce({
      generatedColumns: [
        {
          headerName: "AI Column",
          columnData: ["value1", "value2"],
        },
      ],
    });

    const testYDoc = new Y.Doc();
    const testYHeaders = testYDoc.getArray<string>("headers");
    const testYTable = testYDoc.getArray<Y.Map<unknown>>("table");
    const initialRow = new Y.Map<unknown>();
    testYTable.push([initialRow]);

    // Setup Yjs state for two columns
    testYHeaders.push(["A", "B"]);
    const rowMap = new Y.Map();
    rowMap.set("A", "foo");
    rowMap.set("B", "bar");
    testYTable.push([rowMap]);

    const baseMockData = getLiveTableMockValues();
    vi.mocked(useLiveTable).mockReturnValue({
      ...baseMockData,
      headers: [],
      tableData: testYTable.toArray().map((r) => r.toJSON()),
      columnWidths: baseMockData.columnWidths,
      isTableLoaded: baseMockData.isTableLoaded,
    });
    vi.mocked(useSelectedCell).mockReturnValue({
      rowIndex: 0,
      colIndex: 0,
    });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    render(
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(testYDoc)}
        headers={testYHeaders.toArray()}
        tableData={testYTable.toArray().map((r) => r.toJSON())}
      >
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

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledWith(
      expect.any(Number),
      1
    );
  });

  it("should call mockGenerateAndInsertColumns when AI returns an error for add right button (single column)", async () => {
    vi.mocked(generateNewColumns).mockResolvedValueOnce({
      error: "AI Error",
    });

    const testYDoc = new Y.Doc();
    const testYHeaders = testYDoc.getArray<string>("headers");
    const testYTable = testYDoc.getArray<Y.Map<unknown>>("table");
    testYTable.push([new Y.Map()]);

    const mockSelectedCell = { rowIndex: 0, colIndex: 0 };
    const mockData = getLiveTableMockValues({
      yDoc: testYDoc,
      yHeaders: testYHeaders,
      yTable: testYTable,
      selectedCells: [mockSelectedCell],
      headers: testYHeaders.toArray(),
      tableData: testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue(mockSelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([mockSelectedCell]);

    render(
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(testYDoc)}
        headers={testYHeaders.toArray()}
        tableData={testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON())}
      >
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

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledWith(
      expect.any(Number),
      1
    );
  });

  it("should call mockGenerateAndInsertColumns when add left button is clicked and AI promise rejects", async () => {
    vi.mocked(generateNewColumns).mockRejectedValueOnce(
      new Error("Network Error")
    );

    const testYDoc = new Y.Doc();
    const testYHeaders = testYDoc.getArray<string>("headers");
    const testYTable = testYDoc.getArray<Y.Map<unknown>>("table");
    const initialRow = new Y.Map<unknown>();
    testYTable.push([initialRow]);

    const mockData = getLiveTableMockValues({
      yDoc: testYDoc,
      yHeaders: testYHeaders,
      yTable: testYTable,
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
      headers: testYHeaders.toArray(),
      tableData: testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    render(
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(testYDoc)}
        headers={testYHeaders.toArray()}
        tableData={testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON())}
      >
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

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalled();
  });

  it("should call the API and handle pending state when add column operation starts", async () => {
    const neverResolvedPromise = new Promise<{
      newHeader?: string;
      newColumnData?: string[];
      error?: string;
    }>(() => {});
    vi.mocked(generateNewColumns).mockReturnValueOnce(neverResolvedPromise);

    const testYDoc = new Y.Doc();
    const testYHeaders = testYDoc.getArray<string>("headers");
    const testYTable = testYDoc.getArray<Y.Map<unknown>>("table");
    const initialRow = new Y.Map<unknown>();
    testYTable.push([initialRow]);

    const mockData = getLiveTableMockValues({
      yDoc: testYDoc,
      yHeaders: testYHeaders,
      yTable: testYTable,
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: ["A", "B"],
      tableData: [{ A: "foo", B: "bar" }],
      columnWidths: {},
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    render(
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(testYDoc)}
        headers={testYHeaders.toArray()}
        tableData={testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );

    const addColumnLeftButton = screen.getByRole("button", {
      name: "Add 2 Columns to the Left",
    });
    await act(async () => {
      fireEvent.mouseDown(addColumnLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalled();
  });
});

describe("LiveTableToolbar - Add Row Buttons", () => {
  let mockYDoc: Y.Doc;
  let mockLiveTable: LiveTableDoc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;

  const setupYjsData = (
    headers: string[],
    tableContent: Array<Record<string, unknown>>
  ) => {
    mockYHeaders.delete(0, mockYHeaders.length);
    mockYHeaders.push(headers);
    mockYTable.delete(0, mockYTable.length);
    const rowsToInsert = tableContent.map((rowContent) => {
      const yRow = new Y.Map<unknown>();
      headers.forEach((header) => {
        yRow.set(header, rowContent[header as keyof typeof rowContent]);
      });
      return yRow;
    });
    mockYTable.insert(0, rowsToInsert);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGenerateAndInsertRowsReal.mockReset();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
    mockLiveTable = new LiveTableDoc(mockYDoc);

    const initialHeaders = ["Name", "Age"];
    mockYHeaders.push(initialHeaders);
    const yRow = new Y.Map<unknown>();
    yRow.set("Name", "Alice");
    yRow.set("Age", 30);
    mockYTable.push([yRow]);

    const mockData = getLiveTableMockValues({});
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    mockGenerateAndInsertRowsReal.mockResolvedValue({
      aiRowsAdded: 0,
      defaultRowsAdded: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Add Row Above: 1 selected row, calls generateAndInsertRows correctly", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }, { H1: "R1" }]);
    const selectedCell = { rowIndex: 1, colIndex: 0 };
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    vi.mocked(useSelectedCell).mockReturnValue(selectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCell]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(
      <TestDataStoreWrapper
        liveTableDoc={mockLiveTable}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );

    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledWith(1, 1);
  });

  it("Add Row Below: 1 selected row, calls generateAndInsertRows correctly", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]);
    const selectedCell = { rowIndex: 0, colIndex: 0 };
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    vi.mocked(useSelectedCell).mockReturnValue(selectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCell]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(
      <TestDataStoreWrapper
        liveTableDoc={mockLiveTable}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add Row Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledWith(1, 1);
  });

  it("Add Row Above: 2 selected rows, calls generateAndInsertRows correctly", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }, { H1: "R1" }, { H1: "R2" }]);
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 };
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 0 },
    ];
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      selectedCells: selectedCellsData,
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue(primarySelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsData);

    render(
      <TestDataStoreWrapper
        liveTableDoc={mockLiveTable}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add 2 Rows Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledWith(0, 2);
  });

  it("Add Row Below: 3 selected rows (non-contiguous), calls generateAndInsertRows correctly", async () => {
    setupYjsData(
      ["H1"],
      [{ H1: "R0" }, { H1: "R1" }, { H1: "R2" }, { H1: "R3" }]
    );
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 };
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 0 },
      { rowIndex: 3, colIndex: 0 },
    ];
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      selectedCells: [],
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    vi.mocked(useSelectedCell).mockReturnValue(primarySelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsData);

    render(
      <TestDataStoreWrapper
        liveTableDoc={mockLiveTable}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add 3 Rows Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledWith(4, 3);
  });

  it("Add Row Above: selectedCell is set but selectedCells is empty, calls generateAndInsertRows", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]);
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      selectedCells: [],
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(
      <TestDataStoreWrapper
        liveTableDoc={mockLiveTable}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r) => r.toJSON())}
      >
        <LiveTableToolbar />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRowsReal).toHaveBeenCalledWith(0, 1);
  });
});

describe("LiveTableToolbar - Add Multiple Columns", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;

  const setupYjsBaseDoc = (
    initialHeaders: string[],
    initialTableData: Record<string, unknown>[],
    rowsPerInitialDataEntry = 1
  ) => {
    mockYHeaders.delete(0, mockYHeaders.length);
    if (initialHeaders.length > 0) mockYHeaders.push(initialHeaders);

    mockYTable.delete(0, mockYTable.length);
    if (initialTableData.length > 0) {
      const rowsToInsert: Y.Map<unknown>[] = [];
      initialTableData.forEach((rowData) => {
        for (let i = 0; i < rowsPerInitialDataEntry; i++) {
          const yRow = new Y.Map<unknown>();
          initialHeaders.forEach((header) => {
            if (Object.prototype.hasOwnProperty.call(rowData, header)) {
              yRow.set(header, rowData[header]);
            }
          });
          rowsToInsert.push(yRow);
        }
      });
      if (rowsToInsert.length > 0) {
        mockYTable.push(rowsToInsert);
      }
    }
    if (
      initialTableData.length > 0 &&
      mockYTable.length === 0 &&
      initialHeaders.length > 0
    ) {
      const emptyRow = new Y.Map<unknown>();
      initialHeaders.forEach((h) => emptyRow.set(h, undefined));
      mockYTable.push([emptyRow]);
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");

    setupYjsBaseDoc(["H1", "H2"], [{ H1: "r1v1", H2: "r1v2" }]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    vi.mocked(generateNewColumns).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should add 2 AI columns to the left when AI succeeds", async () => {
    const numColsToRequest = 2;
    setupYjsBaseDoc(["ExCol1", "ExCol2"], [{ ExCol1: "Val1", ExCol2: "Val2" }]);
    const currentTableDataJson = mockYTable
      .toArray()
      .map((r: Y.Map<unknown>) => r.toJSON());
    const currentHeadersArray = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

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
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(mockYDoc)}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON())}
      >
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

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledWith(
      expect.any(Number),
      numColsToRequest
    );
  });

  it("should add 2 default columns to the right when AI for multiple columns returns error", async () => {
    const numColsToRequest = 2;
    setupYjsBaseDoc(["ExCol1", "ExCol2"], [{ ExCol1: "Val1", ExCol2: "Val2" }]);
    const currentTableDataJson = mockYTable
      .toArray()
      .map((r: Y.Map<unknown>) => r.toJSON());
    const currentHeadersArray = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    vi.mocked(generateNewColumns).mockRejectedValueOnce(new Error("AI failed"));

    render(
      <TestDataStoreWrapper
        liveTableDoc={new LiveTableDoc(mockYDoc)}
        headers={mockYHeaders.toArray()}
        tableData={mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON())}
      >
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

    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumnsReal).toHaveBeenCalledWith(
      expect.any(Number),
      numColsToRequest
    );
  });
});
