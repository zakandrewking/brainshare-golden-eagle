import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { act, fireEvent, render, screen } from "@testing-library/react";

import * as GenerateNewColumnModule from "@/components/live-table/actions/generateNewColumn";
import * as generateNewRowsModule from "@/components/live-table/actions/generateNewRows";
import * as LiveTableProviderModule from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import * as YjsOperationsModule from "@/components/live-table/yjs-operations";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/components/live-table/actions/generateNewColumn", () => ({
  default: vi.fn(),
}));

vi.mock("@/components/live-table/actions/generateNewRows", () => ({
  default: vi.fn(),
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

    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      "AI Column",
      ["value1", "value2"],
      0
    );
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).not.toHaveBeenCalled();
  });

  it("should call applyGeneratedColumnToYDoc with fallback values when AI resolves with an error for the right button", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockResolvedValueOnce({
      error: "AI Error",
    });

    render(<LiveTableToolbar />); // yHeaders is empty initially
    const addRightButton = screen.getByRole("button", {
      name: "Add column to the right",
    });
    fireEvent.click(addRightButton);

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    // Determine the expected default header name when yHeaders is empty
    const expectedDefaultHeader = "New Column 1";
    const expectedInsertIndex = 1; // For 'right' when selectedCell.colIndex is 0

    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      expectedDefaultHeader,
      null,
      expectedInsertIndex
    );
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).not.toHaveBeenCalled();
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

    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledTimes(1);
    const defaultHeaderName = "New Column 1";
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYTable,
      mockYHeaders,
      defaultHeaderName,
      0
    );
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).not.toHaveBeenCalled();
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
      newRows?: Record<string, string>[];
      error?: string;
    }>(() => {});
    vi.mocked(generateNewRowsModule.default).mockReturnValueOnce(
      neverResolvedPromise
    );

    render(<LiveTableToolbar />);

    const addRowAboveButton = screen.getByRole("button", {
      name: "Add Row Above",
    });

    // Click to trigger isPendingRow state
    fireEvent.click(addRowAboveButton);

    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalled();
  });
});

describe("LiveTableToolbar - Add Row Buttons (using generateNewRows)", () => {
  const mockYDoc = new Y.Doc();
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

  const setupYjsData = (
    headers: string[],
    tableContent: Array<Record<string, unknown>>
  ) => {
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYHeaders.delete(0, mockYHeaders.length);
    mockYHeaders.push(headers);
    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
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

  const getDefaultMockLiveTableReturnValue = (): ReturnType<
    typeof LiveTableProviderModule.useLiveTable
  > => ({
    yDoc: mockYDoc,
    yHeaders: mockYHeaders,
    yTable: mockYTable,
    undoManager: mockUndoManager,
    isTableLoaded: true,
    selectedCell: { rowIndex: 0, colIndex: 0 },
    selectedCells: [{ rowIndex: 0, colIndex: 0 }],
    tableId: "test-row-ops-table",
    tableData: mockYTable.toArray().map((r) => r.toJSON()),
    headers: mockYHeaders.toArray(),
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
    selectionArea: {
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 0, colIndex: 0 },
    },
    isSelecting: false,
    isCellSelected: vi
      .fn()
      .mockImplementation((rI, cI) => rI === 0 && cI === 0),
    clearSelection: vi.fn(),
    getSelectedCellsData: vi.fn().mockReturnValue([["Alice"]]),
    editingCell: null,
    setEditingCell: vi.fn(),
    handleSelectionStart: vi.fn(),
    handleSelectionMove: vi.fn(),
    handleSelectionEnd: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    const initialHeaders = ["Name", "Age"];
    const initialTableData = [{ Name: "Alice", Age: 30 }];
    setupYjsData(initialHeaders, initialTableData);
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      getDefaultMockLiveTableReturnValue()
    );
    vi.mocked(generateNewRowsModule.default).mockReset();
    vi.mocked(YjsOperationsModule.applyGeneratedRowToYDoc).mockReset();
    vi.mocked(YjsOperationsModule.applyDefaultRowToYDocOnError).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("Add Row Above: 1 selected row, AI succeeds, adds 1 row", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }, { H1: "R1" }]); // R0, R1
    const selectedCell = { rowIndex: 1, colIndex: 0 }; // Select R1 (index 1)
    const testSpecificMockValue = {
      ...getDefaultMockLiveTableReturnValue(),
      selectedCell,
      selectedCells: [selectedCell], // Simulate selection of 1 row
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      testSpecificMockValue
    );
    vi.mocked(generateNewRowsModule.default).mockResolvedValueOnce({
      newRows: [{ H1: "AI Row Above" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledWith(
      expect.any(Array), // tableData
      ["H1"], // headers
      1 // numRowsToAdd
    );
    expect(yTableInsert).toHaveBeenCalledTimes(1);
    expect(yTableInsert).toHaveBeenCalledWith(1, [expect.any(Y.Map)]);
  });

  it("Add Row Below: 1 selected row, AI fails, adds 1 default row", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]); // R0
    const selectedCell = { rowIndex: 0, colIndex: 0 }; // Select R0
    const testSpecificMockValue = {
      ...getDefaultMockLiveTableReturnValue(),
      selectedCell,
      selectedCells: [selectedCell],
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      testSpecificMockValue
    );
    vi.mocked(generateNewRowsModule.default).mockResolvedValueOnce({
      error: "AI Error",
    });
    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(yTableInsert).toHaveBeenCalledTimes(1);
    expect(yTableInsert).toHaveBeenCalledWith(1, [expect.any(Y.Map)]);
  });

  it("Add Row Above: 2 selected rows, AI succeeds, adds 2 rows", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }, { H1: "R1" }, { H1: "R2" }]); // R0, R1, R2
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 }; // Anchor on R1 for consistency, though new logic uses min/max
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 2, colIndex: 0 },
    ]; // Select R0 and R2
    const testSpecificMockValue = {
      ...getDefaultMockLiveTableReturnValue(),
      selectedCell: primarySelectedCell,
      selectedCells: selectedCellsData,
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      testSpecificMockValue
    );
    vi.mocked(generateNewRowsModule.default).mockResolvedValueOnce({
      newRows: [{ H1: "AI Row 1" }, { H1: "AI Row 2" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 2 Rows Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledWith(
      expect.any(Array),
      ["H1"],
      2
    ); // numRowsToAdd = 2
    expect(yTableInsert).toHaveBeenCalledTimes(1);
    expect(yTableInsert).toHaveBeenCalledWith(0, [
      expect.any(Y.Map),
      expect.any(Y.Map),
    ]);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedRowToYDoc)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultRowToYDocOnError)
    ).not.toHaveBeenCalled();
  });

  it("Add Row Below: 3 selected rows, AI returns 2, adds 2 AI + 1 default row", async () => {
    setupYjsData(
      ["H1"],
      [{ H1: "R0" }, { H1: "R1" }, { H1: "R2" }, { H1: "R3" }]
    ); // R0,R1,R2,R3
    const primarySelectedCell = { rowIndex: 1, colIndex: 0 }; // Anchor on R1 for consistency
    const selectedCellsData = [
      { rowIndex: 0, colIndex: 0 }, // R0
      { rowIndex: 2, colIndex: 0 }, // R2
      { rowIndex: 3, colIndex: 0 }, // R3 (3 unique rows, max index 3)
    ];
    const testSpecificMockValue = {
      ...getDefaultMockLiveTableReturnValue(),
      selectedCell: primarySelectedCell,
      selectedCells: selectedCellsData,
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      testSpecificMockValue
    );
    vi.mocked(generateNewRowsModule.default).mockResolvedValueOnce({
      newRows: [{ H1: "AI Row A" }, { H1: "AI Row B" }], // AI returns only 2 rows
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 3 Rows Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledWith(
      expect.any(Array),
      ["H1"],
      3
    ); // numRowsToAdd = 3

    expect(yTableInsert).toHaveBeenCalledTimes(1);
    expect(yTableInsert).toHaveBeenCalledWith(4, [
      expect.any(Y.Map),
      expect.any(Y.Map),
      expect.any(Y.Map),
    ]);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedRowToYDoc)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultRowToYDocOnError)
    ).not.toHaveBeenCalled();
  });

  it("Add Row Above: selectedCell is set but selectedCells is empty, adds 1 AI row", async () => {
    setupYjsData(["H1"], [{ H1: "R0" }]);
    const selectedCell = { rowIndex: 0, colIndex: 0 };
    const testSpecificMockValue = {
      ...getDefaultMockLiveTableReturnValue(),
      selectedCell,
      selectedCells: [], // selectedCells is empty
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r) => r.toJSON()),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      testSpecificMockValue
    );
    vi.mocked(generateNewRowsModule.default).mockResolvedValueOnce({
      newRows: [{ H1: "AI Row Single" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(generateNewRowsModule.default)).toHaveBeenCalledWith(
      expect.any(Array),
      ["H1"],
      1
    );
    expect(yTableInsert).toHaveBeenCalledTimes(1);
    expect(yTableInsert).toHaveBeenCalledWith(0, [expect.any(Y.Map)]);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedRowToYDoc)
    ).not.toHaveBeenCalled();
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultRowToYDocOnError)
    ).not.toHaveBeenCalled();
  });
});
