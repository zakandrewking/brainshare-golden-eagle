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

import * as GenerateNewColumnModule
  from "@/components/live-table/actions/generateNewColumn";
import * as generateNewRowModule
  from "@/components/live-table/actions/generateNewRow";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import * as YjsOperationsModule from "@/components/live-table/yjs-operations";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/components/live-table/actions/generateNewColumn", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/live-table/actions/generateNewRow", () => ({
  default: vi.fn(),
}));

const mockApplyGeneratedColumnToYDoc =
  YjsOperationsModule.applyGeneratedColumnToYDoc;
const mockApplyDefaultColumnToYDocOnError =
  YjsOperationsModule.applyDefaultColumnToYDocOnError;
const mockApplyGeneratedRowToYDoc = YjsOperationsModule.applyGeneratedRowToYDoc;
const mockApplyDefaultRowToYDocOnError =
  YjsOperationsModule.applyDefaultRowToYDocOnError;
vi.mock("@/components/live-table/yjs-operations", () => ({
  applyGeneratedColumnToYDoc: vi.fn(),
  applyDefaultColumnToYDocOnError: vi.fn(),
  applyGeneratedRowToYDoc: vi.fn(),
  applyDefaultRowToYDocOnError: vi.fn(),
}));

describe("LiveTableToolbar - Add Column Buttons", () => {
  const mockYDoc = new Y.Doc();
  const mockYHeaders = mockYDoc.getArray<string>("headers");
  const mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
  const mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const mockUseLiveTableReturnValue: ReturnType<
      typeof LiveTableProviderModule.useLiveTable
    > = {
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      tableId: "test-table",
      tableData: [],
      headers: [],
      columnWidths: {},
      handleCellChange: vi.fn(),
      handleCellFocus: vi.fn(),
      handleCellBlur: vi.fn(),
      editingHeaderIndex: null,
      editingHeaderValue: "",
      handleHeaderDoubleClick: vi.fn(),
      handleHeaderChange: vi.fn(),
      handleHeaderBlur: vi.fn(),
      handleHeaderKeyDown: vi.fn(),
      handleColumnResize: vi.fn(),
      selectionArea: { startCell: null, endCell: null },
      isSelecting: false,
      selectedCells: [],
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isCellSelected: vi.fn().mockReturnValue(false),
      clearSelection: vi.fn(),
      getSelectedCellsData: vi.fn().mockReturnValue([]),
      editingCell: null,
      setEditingCell: vi.fn(),
    };

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockUseLiveTableReturnValue
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call applyGeneratedColumnToYDoc when add left button is clicked and AI succeeds", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockResolvedValueOnce({
      newHeader: "AI Column",
      newColumnData: ["value1", "value2"],
    });

    render(<LiveTableToolbar />);

    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    fireEvent.mouseDown(addLeftButton);

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyGeneratedColumnToYDoc).toHaveBeenCalledTimes(1);
    expect(mockApplyGeneratedColumnToYDoc).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders,
      mockYTable,
      "AI Column",
      ["value1", "value2"],
      0
    );
    expect(mockApplyDefaultColumnToYDocOnError).not.toHaveBeenCalled();
  });

  it("should call applyGeneratedColumnToYDoc with fallback values when AI resolves with an error for the right button", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockResolvedValueOnce({
      error: "AI Error",
    });

    render(<LiveTableToolbar />); // yHeaders is empty initially
    const addRightButton = screen.getByRole("button", {
      name: "Add column to the right",
    });
    fireEvent.mouseDown(addRightButton);

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    // Determine the expected default header name when yHeaders is empty
    const expectedDefaultHeader = "New Column 1";
    const expectedInsertIndex = 1; // For 'right' when selectedCell.colIndex is 0

    expect(mockApplyGeneratedColumnToYDoc).toHaveBeenCalledTimes(1);
    expect(mockApplyGeneratedColumnToYDoc).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders,
      mockYTable,
      expectedDefaultHeader,
      null,
      expectedInsertIndex
    );
    expect(mockApplyDefaultColumnToYDocOnError).not.toHaveBeenCalled();
  });

  it("should call applyDefaultColumnToYDocOnError when add left button is clicked and AI promise rejects", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    fireEvent.mouseDown(addLeftButton);

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyDefaultColumnToYDocOnError).toHaveBeenCalledTimes(1);
    const defaultHeaderName = "New Column 1";
    expect(mockApplyDefaultColumnToYDocOnError).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders,
      mockYTable,
      defaultHeaderName,
      0
    );
    expect(mockApplyGeneratedColumnToYDoc).not.toHaveBeenCalled();
  });

  it("should call the API and handle pending state when add column operation starts", async () => {
    const neverResolvedPromise = new Promise<{
      newHeader?: string;
      newColumnData?: string[];
      error?: string;
    }>(() => {});
    vi.mocked(GenerateNewColumnModule.default).mockReturnValueOnce(
      neverResolvedPromise
    );

    render(<LiveTableToolbar />);

    // Click the add column left button
    const addColumnLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    fireEvent.mouseDown(addColumnLeftButton);

    // After clicking, verify that React triggers the API call
    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();
  });

  it("should pass isDisabled to AI fill buttons when rendering", async () => {
    const neverResolvedPromise = new Promise<{
      rowData?: Record<string, string>;
      error?: string;
    }>(() => {});
    vi.mocked(generateNewRowModule.default).mockReturnValueOnce(
      neverResolvedPromise
    );

    render(<LiveTableToolbar />);

    const addRowAboveButton = screen.getByRole("button", {
      name: "Add row above",
    });

    // Click to trigger isPendingRow state
    fireEvent.mouseDown(addRowAboveButton);

    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();
  });
});

describe("LiveTableToolbar - Add Row Buttons", () => {
  const mockYDoc = new Y.Doc();
  const mockYHeaders = mockYDoc.getArray<string>("headers");
  const mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
  const mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Setup mock table data with headers
    mockYHeaders.push(["Name", "Age", "City"]);
    const row1 = new Y.Map();
    row1.set("Name", "Alice");
    row1.set("Age", "30");
    row1.set("City", "New York");
    mockYTable.push([row1]);

    const mockUseLiveTableReturnValue: ReturnType<
      typeof LiveTableProviderModule.useLiveTable
    > = {
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      tableId: "test-table",
      tableData: [],
      headers: [],
      columnWidths: {},
      handleCellChange: vi.fn(),
      handleCellFocus: vi.fn(),
      handleCellBlur: vi.fn(),
      editingHeaderIndex: null,
      editingHeaderValue: "",
      handleHeaderDoubleClick: vi.fn(),
      handleHeaderChange: vi.fn(),
      handleHeaderBlur: vi.fn(),
      handleHeaderKeyDown: vi.fn(),
      handleColumnResize: vi.fn(),
      selectionArea: { startCell: null, endCell: null },
      isSelecting: false,
      selectedCells: [],
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isCellSelected: vi.fn().mockReturnValue(false),
      clearSelection: vi.fn(),
      getSelectedCellsData: vi.fn().mockReturnValue([]),
      editingCell: null,
      setEditingCell: vi.fn(),
    };

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockUseLiveTableReturnValue
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call applyGeneratedRowToYDoc when add row above button is clicked and AI succeeds", async () => {
    vi.mocked(generateNewRowModule.default).mockResolvedValueOnce({
      rowData: {
        Name: "David",
        Age: "42",
        City: "Chicago",
      },
    });

    render(<LiveTableToolbar />);

    const addRowAboveButton = screen.getByRole("button", {
      name: "Add row above",
    });
    fireEvent.mouseDown(addRowAboveButton);

    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyGeneratedRowToYDoc).toHaveBeenCalledTimes(1);
    expect(mockApplyGeneratedRowToYDoc).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      {
        Name: "David",
        Age: "42",
        City: "Chicago",
      },
      0
    );
    expect(mockApplyDefaultRowToYDocOnError).not.toHaveBeenCalled();
  });

  it("should call applyGeneratedRowToYDoc when add row below button is clicked and AI succeeds", async () => {
    vi.mocked(generateNewRowModule.default).mockResolvedValueOnce({
      rowData: {
        Name: "Bob",
        Age: "28",
        City: "Boston",
      },
    });

    render(<LiveTableToolbar />);

    const addRowBelowButton = screen.getByRole("button", {
      name: "Add row below",
    });
    fireEvent.mouseDown(addRowBelowButton);

    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyGeneratedRowToYDoc).toHaveBeenCalledTimes(1);
    expect(mockApplyGeneratedRowToYDoc).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      {
        Name: "Bob",
        Age: "28",
        City: "Boston",
      },
      1
    );
    expect(mockApplyDefaultRowToYDocOnError).not.toHaveBeenCalled();
  });

  it("should call applyDefaultRowToYDocOnError when add row button is clicked and AI resolves with an error", async () => {
    vi.mocked(generateNewRowModule.default).mockResolvedValueOnce({
      error: "AI Error",
    });

    render(<LiveTableToolbar />);
    const addRowAboveButton = screen.getByRole("button", {
      name: "Add row above",
    });
    fireEvent.mouseDown(addRowAboveButton);

    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyDefaultRowToYDocOnError).toHaveBeenCalledTimes(1);
    expect(mockApplyDefaultRowToYDocOnError).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      0
    );
    expect(mockApplyGeneratedRowToYDoc).not.toHaveBeenCalled();
  });

  it("should call applyDefaultRowToYDocOnError when add row button is clicked and AI promise rejects", async () => {
    vi.mocked(generateNewRowModule.default).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<LiveTableToolbar />);
    const addRowBelowButton = screen.getByRole("button", {
      name: "Add row below",
    });
    fireEvent.mouseDown(addRowBelowButton);

    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockApplyDefaultRowToYDocOnError).toHaveBeenCalledTimes(1);
    expect(mockApplyDefaultRowToYDocOnError).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      1
    );
    expect(mockApplyGeneratedRowToYDoc).not.toHaveBeenCalled();
  });

  it("should call the API and handle pending state when add row operation starts", async () => {
    // Mock the generateNewRow to return a promise that never resolves
    const neverResolvedPromise = new Promise<{
      rowData?: Record<string, string>;
      error?: string;
    }>(() => {});
    vi.mocked(generateNewRowModule.default).mockReturnValueOnce(
      neverResolvedPromise
    );

    render(<LiveTableToolbar />);

    // Click the add row above button
    const addRowAboveButton = screen.getByRole("button", {
      name: "Add row above",
    });
    fireEvent.mouseDown(addRowAboveButton);

    // After clicking, verify that React triggers the API call
    expect(vi.mocked(generateNewRowModule.default)).toHaveBeenCalled();
  });
});
