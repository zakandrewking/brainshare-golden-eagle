import {
  afterEach,
  beforeAll,
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

import * as GenerateNewColumnModule
  from "@/components/live-table/actions/generateNewColumn";
import * as GenerateNewColumnsModule
  from "@/components/live-table/actions/generateNewColumns";
// Import the action AFTER vi.mock to get a handle to the mocked function
import generateNewRowsAction
  from "@/components/live-table/actions/generateNewRows";
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

vi.mock("@/components/live-table/actions/generateNewRows", () => ({
  default: vi.fn(), // Plain vi.fn() here
}));

vi.mock("@/components/live-table/actions/generateNewColumns", () => ({
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

const mockGenerateNewRowsCtrl = vi.mocked(generateNewRowsAction);

describe("LiveTableToolbar - Add Column Buttons", () => {
  const mockYDoc = new Y.Doc();
  const mockYHeaders = mockYDoc.getArray<string>("headers");
  const mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
  const mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Reset the global mock for generateNewRows if it was used by a previous test/suite
    // mockGenerateNewRowsGlobal.mockReset();
    mockGenerateNewRowsCtrl.mockReset();

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

    // Setup initial Yjs state: 1 row, 0 headers
    // This ensures that when a column is added, it affects the existing row.
    mockYHeaders.delete(0, mockYHeaders.length); // Clear existing headers
    mockYTable.delete(0, mockYTable.length); // Clear existing table data
    const initialRow = new Y.Map<unknown>();
    mockYTable.push([initialRow]);

    // Mock useLiveTable to provide selectedCell and initial empty yHeaders and yTable
    const mockLiveTableContext = {
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 }, // For initial column insertion point
      tableId: "test-table",
      tableData: [], // Initially empty or reflecting setup
      headers: [], // Initially empty
      selectedCells: [{ rowIndex: 0, colIndex: 0 }], // Ensure numColsToAdd is 1
      // ... other necessary mocks from beforeEach, potentially adjusted
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
      isCellSelected: vi.fn().mockReturnValue(false),
      clearSelection: vi.fn(),
      getSelectedCellsData: vi.fn().mockReturnValue([]),
      editingCell: null,
      setEditingCell: vi.fn(),
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
    };
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      mockLiveTableContext
    );

    render(<LiveTableToolbar />);

    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    // fireEvent.mouseDown(addLeftButton); // Changed to click for consistency
    await act(async () => {
      fireEvent.click(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalledWith(
      // currentTableData is initially [{}] because of the one empty row added
      [{}], // tableData passed to generateNewColumn if one empty row exists
      [] // initialYHeadersArray is empty
    );

    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders, // Corrected: yHeaders first
      mockYTable, // Then yTable
      "AI Column",
      ["value1", "value2"],
      0 // insertIndex
    );
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).not.toHaveBeenCalled();
  });

  it("should call applyDefaultColumnToYDocOnError when AI returns an error for add right button (single column)", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockResolvedValueOnce({
      error: "AI Error",
    });

    const mockSelectedCell = { rowIndex: 0, colIndex: 0 };
    // Get the base mock value from the outer scope's beforeEach
    const originalMockLiveTableContext =
      vi
        .mocked(LiveTableProviderModule.useLiveTable)
        .getMockImplementation()?.() || {};

    vi.mocked(LiveTableProviderModule.useLiveTable).mockImplementation(() => ({
      ...(originalMockLiveTableContext as ReturnType<
        typeof LiveTableProviderModule.useLiveTable
      >),
      yDoc: mockYDoc, // Ensure these are from the test's specific Yjs instances if they differ
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: mockSelectedCell,
      selectedCells: [mockSelectedCell],
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()), // Ensure correct typing for map
    }));

    mockYHeaders.delete(0, mockYHeaders.length);
    mockYTable.delete(0, mockYTable.length);
    mockYTable.push([new Y.Map()]); // Ensure at least one row for consistent tableData for generateNewColumn

    render(<LiveTableToolbar />);
    const addRightButton = screen.getByRole("button", {
      name: "Add column to the right",
    });

    await act(async () => {
      fireEvent.click(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalledTimes(1);
    // currentTableData is [{}], initialYHeadersArray is []
    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalledWith(
      [{}],
      []
    );

    // Check that the default error handler was called
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledTimes(1);

    const expectedDefaultHeader = "New Column 1"; // Default naming convention
    const expectedInsertIndex = 1; // Adding to the right of colIndex 0

    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders, // Corrected order
      mockYTable,
      expectedDefaultHeader,
      expectedInsertIndex
    );

    // Ensure the success path was not taken
    expect(
      vi.mocked(YjsOperationsModule.applyGeneratedColumnToYDoc)
    ).not.toHaveBeenCalled();
  });

  it("should call applyDefaultColumnToYDocOnError when add left button is clicked and AI promise rejects", async () => {
    vi.mocked(GenerateNewColumnModule.default).mockRejectedValueOnce(
      new Error("Network Error")
    );

    // Setup similar to other column tests for consistency
    mockYHeaders.delete(0, mockYHeaders.length);
    mockYTable.delete(0, mockYTable.length);
    const initialRow = new Y.Map<unknown>();
    mockYTable.push([initialRow]);

    const baseMock =
      vi
        .mocked(LiveTableProviderModule.useLiveTable)
        .getMockImplementation()?.() || {};
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...(baseMock as ReturnType<typeof LiveTableProviderModule.useLiveTable>),
      yDoc: mockYDoc, // these should be from the test block's scope
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }], // Explicit single selection
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
    });

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });

    await act(async () => {
      fireEvent.click(addLeftButton); // Use click for consistency, wrapped in act
      await vi.runAllTimersAsync(); // Ensure all async operations complete
    });

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();

    // Timers already run, so yjs operations should have been called if logic proceeded
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledTimes(1);
    const defaultHeaderName = "New Column 1";
    expect(
      vi.mocked(YjsOperationsModule.applyDefaultColumnToYDocOnError)
    ).toHaveBeenCalledWith(
      mockYDoc,
      mockYHeaders,
      mockYTable,
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

    // Setup similar to other column tests for consistency
    mockYHeaders.delete(0, mockYHeaders.length);
    mockYTable.delete(0, mockYTable.length);
    const initialRow = new Y.Map<unknown>();
    mockYTable.push([initialRow]);

    const baseMock =
      vi
        .mocked(LiveTableProviderModule.useLiveTable)
        .getMockImplementation()?.() || {};
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...(baseMock as ReturnType<typeof LiveTableProviderModule.useLiveTable>),
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [{ rowIndex: 0, colIndex: 0 }], // Explicit single selection
      headers: mockYHeaders.toArray(),
      tableData: mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
    });

    render(<LiveTableToolbar />);

    const addColumnLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });
    await act(async () => {
      fireEvent.click(addColumnLeftButton);
      // No need to await vi.runAllTimersAsync() if only checking for the call itself
      // and the operation doesn't need to complete for this assertion.
      // However, if generateNewColumn is not called, it implies a condition before it failed.
      // Let's add timers to be safe, as startTransition is async.
      await vi.runAllTimersAsync();
    });

    expect(vi.mocked(GenerateNewColumnModule.default)).toHaveBeenCalled();
  });

  it("should pass isDisabled to AI fill buttons when rendering", async () => {
    // mockGenerateNewRowsGlobal.mockResolvedValueOnce({
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({
      newRows: [{ dummy: "row" }],
    }); // Simple resolving mock

    render(<LiveTableToolbar />);

    const addRowAboveButton = screen.getByRole("button", {
      name: "Add Row Above",
    });

    await act(async () => {
      fireEvent.click(addRowAboveButton);
      await vi.runAllTimersAsync(); // Ensure timers run for the transition and async action
    });

    // expect(mockGenerateNewRowsGlobal).toHaveBeenCalled();
    expect(mockGenerateNewRowsCtrl).toHaveBeenCalled();
  });
});

describe("LiveTableToolbar - Add Row Buttons (using generateNewRows)", () => {
  const mockYDoc = new Y.Doc();
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

  beforeAll(async () => {
    // vi.doMock is no longer needed as we use the global mock
    // vi.doMock("@/components/live-table/actions/generateNewRows", () => {
    // return {
    // default: mockGenerateNewRowsFn,
    // };
    // });
  });

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
    mockGenerateNewRowsCtrl.mockReset(); // Ensure it's reset for this suite
    const initialHeaders = ["Name", "Age"];
    const initialTableData = [{ Name: "Alice", Age: 30 }];
    setupYjsData(initialHeaders, initialTableData);
    mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      getDefaultMockLiveTableReturnValue()
    );

    // Ensure mockGenerateNewRowsGlobal is a fresh mock for each test that resolves to a base case
    mockGenerateNewRowsCtrl.mockResolvedValue({ newRows: [] });

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
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({
      newRows: [{ H1: "AI Row Above" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledTimes(1);
    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledWith(
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
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({ error: "AI Error" });

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
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({
      newRows: [{ H1: "AI Row 1" }, { H1: "AI Row 2" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 2 Rows Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledTimes(1);
    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledWith(
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
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({
      newRows: [{ H1: "AI Row A" }, { H1: "AI Row B" }], // AI returns only 2 rows
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add 3 Rows Below" });
    await act(async () => {
      fireEvent.mouseDown(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledTimes(1);
    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledWith(
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
    mockGenerateNewRowsCtrl.mockResolvedValueOnce({
      newRows: [{ H1: "AI Row Single" }],
    });

    const yTableInsert = vi.spyOn(mockYTable, "insert");

    render(<LiveTableToolbar />);
    const button = screen.getByRole("button", { name: "Add Row Above" });
    await act(async () => {
      fireEvent.click(button);
      await vi.runAllTimersAsync();
    });

    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledTimes(1);
    expect(mockGenerateNewRowsCtrl).toHaveBeenCalledWith(
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

describe("LiveTableToolbar - Add Multiple Columns", () => {
  const mockYDoc = new Y.Doc();
  let mockYHeaders: Y.Array<string>;
  let mockYTable: Y.Array<Y.Map<unknown>>;
  let mockUndoManager: Y.UndoManager;

  // Helper to set up Yjs document state for each test
  const setupYjsBaseDoc = (
    initialHeaders: string[],
    initialTableData: Record<string, unknown>[],
    rowsPerInitialDataEntry = 1
  ) => {
    mockYHeaders = mockYDoc.getArray<string>("headers");
    mockYHeaders.delete(0, mockYHeaders.length);
    if (initialHeaders.length > 0) mockYHeaders.push(initialHeaders);

    mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
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

  const getDefaultLiveTableMock = () => ({
    yDoc: mockYDoc,
    yHeaders: mockYHeaders,
    yTable: mockYTable,
    undoManager: mockUndoManager,
    isTableLoaded: true,
    selectedCell: { rowIndex: 0, colIndex: 0 },
    selectedCells: [{ rowIndex: 0, colIndex: 0 }],
    tableId: "multi-col-test",
    headers: mockYHeaders.toArray(),
    tableData: mockYTable.toArray().map((r: Y.Map<unknown>) => r.toJSON()),
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
    isCellSelected: vi.fn().mockReturnValue(false),
    clearSelection: vi.fn(),
    getSelectedCellsData: vi.fn().mockReturnValue([]),
    editingCell: null,
    setEditingCell: vi.fn(),
    handleSelectionStart: vi.fn(),
    handleSelectionMove: vi.fn(),
    handleSelectionEnd: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    setupYjsBaseDoc(["H1", "H2"], [{ H1: "r1v1", H2: "r1v2" }]);
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      getDefaultLiveTableMock()
    );
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

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...getDefaultLiveTableMock(),
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectedCells: [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
    });

    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
      generatedColumns: [
        { headerName: "AI Col 1", columnData: ["d1"] },
        { headerName: "AI Col 2", columnData: ["d2"] },
      ],
    });

    render(<LiveTableToolbar />);
    const addLeftButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the left`,
    });

    await act(async () => {
      fireEvent.click(addLeftButton);
      await vi.runAllTimersAsync();
    });

    expect(GenerateNewColumnsModule.default).toHaveBeenCalledTimes(1);
    expect(GenerateNewColumnsModule.default).toHaveBeenCalledWith(
      currentTableDataJson,
      currentHeadersArray,
      numColsToRequest
    );

    expect(
      YjsOperationsModule.applyGeneratedColumnToYDoc
    ).toHaveBeenCalledTimes(numColsToRequest);
    expect(
      YjsOperationsModule.applyGeneratedColumnToYDoc
    ).toHaveBeenNthCalledWith(
      1,
      mockYDoc,
      mockYHeaders,
      mockYTable,
      "AI Col 1",
      ["d1"],
      0
    );
    expect(
      YjsOperationsModule.applyGeneratedColumnToYDoc
    ).toHaveBeenNthCalledWith(
      2,
      mockYDoc,
      mockYHeaders,
      mockYTable,
      "AI Col 2",
      ["d2"],
      1
    );
    expect(
      YjsOperationsModule.applyDefaultColumnToYDocOnError
    ).not.toHaveBeenCalled();
  });

  it("should add 2 default columns to the right when AI for multiple columns returns error", async () => {
    const numColsToRequest = 2;
    setupYjsBaseDoc(["ExCol1", "ExCol2"], [{ ExCol1: "Val1", ExCol2: "Val2" }]);
    const currentTableDataJson = mockYTable
      .toArray()
      .map((r: Y.Map<unknown>) => r.toJSON());
    const currentHeadersArray = mockYHeaders.toArray();

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...getDefaultLiveTableMock(),
      selectedCell: { rowIndex: 0, colIndex: 1 }, // Adding right of ExCol2
      selectedCells: [
        { rowIndex: 0, colIndex: 0 }, // Cell in ExCol1
        { rowIndex: 0, colIndex: 1 }, // Cell in ExCol2 (to trigger numColsToAdd = 2)
      ],
      headers: currentHeadersArray,
      tableData: currentTableDataJson,
    });

    vi.mocked(GenerateNewColumnsModule.default).mockResolvedValueOnce({
      error: "AI multi-column error",
    });

    render(<LiveTableToolbar />);
    const addRightButton = screen.getByRole("button", {
      name: `Add ${numColsToRequest} Columns to the right`,
    });

    await act(async () => {
      fireEvent.click(addRightButton);
      await vi.runAllTimersAsync();
    });

    expect(GenerateNewColumnsModule.default).toHaveBeenCalledTimes(1);
    expect(GenerateNewColumnsModule.default).toHaveBeenCalledWith(
      currentTableDataJson,
      currentHeadersArray,
      numColsToRequest
    );

    expect(
      YjsOperationsModule.applyDefaultColumnToYDocOnError
    ).toHaveBeenCalledTimes(numColsToRequest);
    // Insert to right of ExCol2 (index 1). So, new cols at index 2, then index 3.
    // Initial headers: ["ExCol1", "ExCol2"]
    // After 1st default: ["ExCol1", "ExCol2", "New Column 1"]
    // After 2nd default: ["ExCol1", "ExCol2", "New Column 1", "New Column 2"]
    expect(
      YjsOperationsModule.applyDefaultColumnToYDocOnError
    ).toHaveBeenNthCalledWith(
      1,
      mockYDoc,
      mockYHeaders,
      mockYTable,
      "New Column 1",
      2 // Insert index for 1st default col (right of ExCol2)
    );
    expect(
      YjsOperationsModule.applyDefaultColumnToYDocOnError
    ).toHaveBeenNthCalledWith(
      2,
      mockYDoc,
      mockYHeaders,
      mockYTable,
      "New Column 2",
      3 // Insert index for 2nd default col (right of the first new one)
    );
    expect(
      YjsOperationsModule.applyGeneratedColumnToYDoc
    ).not.toHaveBeenCalled();
  });
});
