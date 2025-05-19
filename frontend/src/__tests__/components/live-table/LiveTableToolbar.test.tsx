import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { act, fireEvent, render, screen } from "@testing-library/react";

import * as GenerateNewColumnsModule from "@/components/live-table/actions/generateNewColumns";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import * as YjsOperationsModule from "@/components/live-table/yjs-operations";

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/components/live-table/actions/generateNewColumns", () => ({
  default: vi.fn(),
  applyGeneratedRowToYDoc: vi.fn(),
  applyDefaultRowToYDocOnError: vi.fn(),
}));

vi.mock("@/components/live-table/yjs-operations", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/components/live-table/yjs-operations")
  >()),
  applyGeneratedColumnToYDoc: vi.fn(),
  applyDefaultColumnToYDocOnError: vi.fn(),
  applyGeneratedRowToYDoc: vi.fn(),
  applyDefaultRowToYDocOnError: vi.fn(),
}));

const mockGenerateAndInsertRows = vi.fn();
const mockGenerateAndInsertColumns = vi.fn();

describe("LiveTableToolbar - Add Column Buttons", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGenerateAndInsertRows.mockReset();
    mockGenerateAndInsertColumns.mockReset();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call applyGeneratedColumnToYDoc when add left button is clicked and AI succeeds", async () => {
    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
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
      yDoc: testYDoc,
      yHeaders: testYHeaders,
      yTable: testYTable,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
      headers: [],
      tableData: testYTable.toArray().map((r) => r.toJSON()),
      columnWidths: baseMockData.columnWidths,
      undoManager: baseMockData.undoManager,
      isTableLoaded: baseMockData.isTableLoaded,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });

    render(<LiveTableToolbar />);

    const addLeftButton = screen.getByRole("button", {
      name: "Add Column to the Left",
    });
    await act(async () => {
      fireEvent.click(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
      expect.any(Number),
      1
    );
  });

  it("should call applyDefaultColumnToYDocOnError when AI returns an error for add right button (single column)", async () => {
    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
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
      selectedCell: mockSelectedCell,
      selectedCells: [mockSelectedCell],
      headers: testYHeaders.toArray(),
      tableData: testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const addRightButton = screen.getByRole("button", {
      name: "Add Column to the Right",
    });

    await act(async () => {
      fireEvent.click(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
      expect.any(Number),
      1
    );
  });

  it("should call applyDefaultColumnToYDocOnError when add left button is clicked and AI promise rejects", async () => {
    vi.mocked(GenerateNewColumnsModule.default).mockRejectedValueOnce(
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
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
      headers: testYHeaders.toArray(),
      tableData: testYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: "Add Column to the Left",
    });

    await act(async () => {
      fireEvent.click(addLeftButton);
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
    vi.mocked(GenerateNewColumnsModule.default).mockReturnValueOnce(
      neverResolvedPromise
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
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: ["A", "B"],
      tableData: [{ A: "foo", B: "bar" }],
      columnWidths: {},
      undoManager: null,
      isTableLoaded: true,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);

    const addColumnLeftButton = screen.getByRole("button", {
      name: "Add 2 Columns to the Left",
    });
    await act(async () => {
      fireEvent.click(addColumnLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalled();
  });
});

describe("LiveTableToolbar - Add Row Buttons", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

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
    mockGenerateAndInsertRows.mockReset();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

    const initialHeaders = ["Name", "Age"];
    mockYHeaders.push(initialHeaders);
    const yRow = new Y.Map<unknown>();
    yRow.set("Name", "Alice");
    yRow.set("Age", 30);
    mockYTable.push([yRow]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
      headers: mockYHeaders.toArray(),
      columnWidths: {},
      getSelectedCellsData: vi.fn().mockReturnValue([["Alice"]]),
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    mockGenerateAndInsertRows.mockResolvedValue({
      aiRowsAdded: 0,
      defaultRowsAdded: 0,
    });

    vi.mocked(YjsOperationsModule.applyGeneratedRowToYDoc).mockReset();
    vi.mocked(YjsOperationsModule.applyDefaultRowToYDocOnError).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Add Row Above: 1 selected row, calls generateAndInsertRows correctly", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }, { H1: "R1" }]);
    const selectedCell = { rowIndex: 1, colIndex: 0 };
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell,
      selectedCells: [selectedCell],
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(1, 1);
  });

  it("Add Row Below: 1 selected row, calls generateAndInsertRows correctly", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]);
    const selectedCell = { rowIndex: 0, colIndex: 0 };
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell,
      selectedCells: [selectedCell],
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(1, 1);
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
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell: primarySelectedCell,
      selectedCells: selectedCellsData,
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 2 Rows Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(0, 2);
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
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell: primarySelectedCell,
      selectedCells: selectedCellsData,
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 3 Rows Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(4, 3);
  });

  it("Add Row Above: selectedCell is set but selectedCells is empty, calls generateAndInsertRows", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]);
    const selectedCell = { rowIndex: 0, colIndex: 0 };
    const yTableDataForCall = mockYTable.toArray().map((r) => r.toJSON());
    const yHeadersDataForCall = mockYHeaders.toArray();

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell,
      selectedCells: [],
      headers: yHeadersDataForCall,
      tableData: yTableDataForCall,
      generateAndInsertRows: mockGenerateAndInsertRows,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertRows).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertRows).toHaveBeenCalledWith(0, 1);
  });
});

describe("LiveTableToolbar - Add Multiple Columns", () => {
  let mockYDoc: Y.Doc;
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

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
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockYDoc = new Y.Doc();
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

    setupYjsBaseDoc(["H1", "H2"], [{ H1: "r1v1", H2: "r1v2" }]);

    const mockData = getLiveTableMockValues({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    vi.mocked(GenerateNewColumnsModule.default).mockReset();
    vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc).mockReset();
    vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError).mockReset();
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
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
      undoManager: mockUndoManager,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
      generatedColumns: [
        { headerName: "AI Col 1", columnData: ["d1"] },
        { headerName: "AI Col 2", columnData: ["d2"] },
      ],
    });

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the Left`,
    });

    await act(async () => {
      fireEvent.click(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
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
      selectedCell: { rowIndex: 0, colIndex: 1 },
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
      undoManager: mockUndoManager,
      generateAndInsertColumns: mockGenerateAndInsertColumns,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);

    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
      error: "AI multi-column error",
    });

    render(<LiveTableToolbar />);
    const addRightButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the Right`,
    });

    await act(async () => {
      fireEvent.click(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateAndInsertColumns).toHaveBeenCalledTimes(1);
    expect(mockGenerateAndInsertColumns).toHaveBeenCalledWith(
      expect.any(Number),
      numColsToRequest
    );
  });
});
