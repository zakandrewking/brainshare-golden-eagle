import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen } from "@testing-library/react";

import * as ActionsModule from "@/components/live-table/actions";
import * as AiFillColumnButtonModule from "@/components/live-table/AiFillColumnButton";
import * as AiFillRowButtonModule from "@/components/live-table/AiFillRowButton";
import * as LiveTableProviderModule from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import * as YjsOperationsModule from "@/components/live-table/yjs-operations";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/components/live-table/actions", () => ({
  generateNewColumn: vi.fn(),
  generateColumnSuggestions: vi.fn(),
  generateRowSuggestions: vi.fn(),
  generateNewRow: vi.fn(),
}));

const mockAiFillColumnButton = AiFillColumnButtonModule.default;
vi.mock("@/components/live-table/AiFillColumnButton", () => ({
  default: vi.fn(() => {
    return <div data-testid="mock-ai-fill-column-button" />;
  }),
}));

const mockAiFillRowButton = AiFillRowButtonModule.default;
vi.mock("@/components/live-table/AiFillRowButton", () => ({
  default: vi.fn(() => {
    return <div data-testid="mock-ai-fill-row-button" />;
  }),
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
    };

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockUseLiveTableReturnValue
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call applyGeneratedColumnToYDoc when add left button is clicked and AI succeeds", async () => {
    vi.mocked(ActionsModule.generateNewColumn).mockResolvedValueOnce({
      newHeader: "AI Column",
      newColumnData: ["value1", "value2"],
    });

    render(<LiveTableToolbar />);

    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    fireEvent.mouseDown(addLeftButton);

    expect(vi.mocked(ActionsModule.generateNewColumn)).toHaveBeenCalled();

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
    vi.mocked(ActionsModule.generateNewColumn).mockResolvedValueOnce({
      error: "AI Error",
    });

    render(<LiveTableToolbar />); // yHeaders is empty initially
    const addRightButton = screen.getByRole("button", {
      name: "Add column to the right",
    });
    fireEvent.mouseDown(addRightButton);

    expect(vi.mocked(ActionsModule.generateNewColumn)).toHaveBeenCalled();

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
    vi.mocked(ActionsModule.generateNewColumn).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    fireEvent.mouseDown(addLeftButton);

    expect(vi.mocked(ActionsModule.generateNewColumn)).toHaveBeenCalled();

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

  it("should render the AiFillColumnButton with correct props", () => {
    render(<LiveTableToolbar />);

    expect(mockAiFillColumnButton).toHaveBeenCalledWith(
      expect.objectContaining({
        isDisabled: false,
        selectedCell: { rowIndex: 0, colIndex: 0 },
        yDoc: mockYDoc,
        yTable: mockYTable,
        yHeaders: mockYHeaders,
      }),
      undefined
    );
  });

  it("should render the AiFillRowButton with correct props", () => {
    render(<LiveTableToolbar />);

    expect(mockAiFillRowButton).toHaveBeenCalledWith(
      expect.objectContaining({
        isDisabled: false,
        selectedCell: { rowIndex: 0, colIndex: 0 },
        yDoc: mockYDoc,
        yTable: mockYTable,
        yHeaders: mockYHeaders,
      }),
      undefined
    );
  });

  it("should render both AI fill buttons", () => {
    render(<LiveTableToolbar />);

    // Just check that both buttons are rendered
    const rowButton = screen.getByTestId("mock-ai-fill-row-button");
    const columnButton = screen.getByTestId("mock-ai-fill-column-button");

    expect(rowButton).toBeDefined();
    expect(columnButton).toBeDefined();
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
    };

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockUseLiveTableReturnValue
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should call applyGeneratedRowToYDoc when add row above button is clicked and AI succeeds", async () => {
    vi.mocked(ActionsModule.generateNewRow).mockResolvedValueOnce({
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

    expect(vi.mocked(ActionsModule.generateNewRow)).toHaveBeenCalled();

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
    vi.mocked(ActionsModule.generateNewRow).mockResolvedValueOnce({
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

    expect(vi.mocked(ActionsModule.generateNewRow)).toHaveBeenCalled();

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
    vi.mocked(ActionsModule.generateNewRow).mockResolvedValueOnce({
      error: "AI Error",
    });

    render(<LiveTableToolbar />);
    const addRowAboveButton = screen.getByRole("button", {
      name: "Add row above",
    });
    fireEvent.mouseDown(addRowAboveButton);

    expect(vi.mocked(ActionsModule.generateNewRow)).toHaveBeenCalled();

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
    vi.mocked(ActionsModule.generateNewRow).mockRejectedValueOnce(
      new Error("Network Error")
    );

    render(<LiveTableToolbar />);
    const addRowBelowButton = screen.getByRole("button", {
      name: "Add row below",
    });
    fireEvent.mouseDown(addRowBelowButton);

    expect(vi.mocked(ActionsModule.generateNewRow)).toHaveBeenCalled();

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
});
