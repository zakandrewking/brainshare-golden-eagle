import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

// Removed Y import as direct Yjs manipulation for V1 setup is removed.
import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
// Import V2 types for defining initial data
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
// Import selection store and related types/selectors
import {
  type CellPosition,
  type SelectionState,
  useSelectionStore,
} from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the dataStore
vi.mock("@/stores/dataStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/dataStore")>();
  return {
    ...actual,
    useIsCellLocked: () => vi.fn(() => false),
  };
});

// Mock the selection store
vi.mock("@/stores/selectionStore", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/stores/selectionStore")
  >();
  return {
    ...actual,
    selectIsCellSelected: actual.selectIsCellSelected,
    selectSelectedCells: actual.selectSelectedCells,
    useSelectionStore: vi.fn(), // The hook itself is mocked
  };
});

vi.stubEnv("NODE_ENV", "test");

describe("LiveTableDisplay - Drag Selection", () => {
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const colId3 = crypto.randomUUID() as ColumnId;

  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Column1", width: 150 },
    { id: colId2, name: "Column2", width: 150 },
    { id: colId3, name: "Column3", width: 150 },
  ];
  const initialColumnOrder: ColumnId[] = [colId1, colId2, colId3];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "A1", [colId2]: "B1", [colId3]: "C1" },
    [rowId2]: { [colId1]: "A2", [colId2]: "B2", [colId3]: "C2" },
    [rowId3]: { [colId1]: "A3", [colId2]: "B3", [colId3]: "C3" },
  };

  let mockHandleSelectionStart: ReturnType<typeof vi.fn>;
  let mockHandleSelectionMove: ReturnType<typeof vi.fn>;
  let mockHandleSelectionEnd: ReturnType<typeof vi.fn>;
  let mockSetEditingCell: ReturnType<typeof vi.fn>;

  let currentSelectedCellState: CellPosition | null;
  let currentSelectionAreaState: SelectionState["selectionArea"];
  let currentIsSelectingState: boolean;
  let currentEditingCellForTest: CellPosition | null;

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  beforeEach(() => {
    vi.clearAllMocks();

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

    mockHandleSelectionStart = vi.fn();
    mockHandleSelectionMove = vi.fn();
    mockHandleSelectionEnd = vi.fn();
    mockSetEditingCell = vi.fn();

    currentSelectedCellState = null;
    currentSelectionAreaState = { startCell: null, endCell: null };
    currentIsSelectingState = false;
    currentEditingCellForTest = null;

    const setSelectedCellMock = vi.fn((cell) => {
      currentSelectedCellState = cell;
    });
    const startSelectionMock = vi.fn((rowIndex, colIndex) => {
      mockHandleSelectionStart(rowIndex, colIndex);
      currentSelectedCellState = { rowIndex, colIndex };
      currentSelectionAreaState = {
        startCell: { rowIndex, colIndex },
        endCell: { rowIndex, colIndex },
      };
      currentIsSelectingState = true;
    });

    // This is the key change: define moveSelectionMock once with the spy
    const moveSelectionMock = vi.fn((rowIndex, colIndex) => {
      mockHandleSelectionMove(rowIndex, colIndex); // This is the spy we are checking
      if (currentSelectionAreaState.startCell) {
        currentSelectionAreaState.endCell = { rowIndex, colIndex };
      }
      currentIsSelectingState = true; // Should remain true or become true
    });

    const endSelectionMock = vi.fn(() => {
      mockHandleSelectionEnd();
      currentIsSelectingState = false;
    });
    const clearSelectionMock = vi.fn(() => {
      currentSelectedCellState = null;
      currentSelectionAreaState = { startCell: null, endCell: null };
      currentIsSelectingState = false;
    });

    const baseLiveTableContext = getLiveTableMockValues({
      liveTableDocInstance,
      initialColumnDefinitions,
      initialColumnOrder,
      initialRowOrder,
      initialRowData,
      setEditingCell: mockSetEditingCell,
    });

    vi.mocked(LiveTableProviderModule.useLiveTable).mockImplementation(() => ({
      ...(baseLiveTableContext as ReturnType<
        typeof LiveTableProviderModule.useLiveTable
      >),
      editingCell: currentEditingCellForTest,
    }));

    vi.mocked(useSelectionStore).mockImplementation(
      <TState = SelectionState,>(
        selector?: (state: SelectionState) => TState
      ): TState | SelectionState => {
        // Construct the state dynamically for each call to the hook
        const stateForSelector: SelectionState = {
          selectedCell: currentSelectedCellState,
          selectionArea: currentSelectionAreaState,
          isSelecting: currentIsSelectingState,
          setSelectedCell: setSelectedCellMock,
          startSelection: startSelectionMock,
          moveSelection: moveSelectionMock, // Use the stable mock reference
          endSelection: endSelectionMock,
          clearSelection: clearSelectionMock,
        };
        if (selector) {
          return selector(stateForSelector);
        }
        return stateForSelector;
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    yDoc.destroy();
  });

  it("should start selection when mousedown on a cell (not in edit mode)", () => {
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(currentIsSelectingState).toBe(true);
    expect(currentSelectedCellState).toEqual({ rowIndex: 0, colIndex: 0 });
    expect(currentSelectionAreaState.startCell).toEqual({
      rowIndex: 0,
      colIndex: 0,
    });
  });

  it("should not start selection when mousedown on a cell in edit mode", () => {
    currentEditingCellForTest = { rowIndex: 0, colIndex: 0 };
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockHandleSelectionStart).not.toHaveBeenCalled();
  });

  it("should update selection when mousemove over cells during selection", async () => {
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    ); // Capture rerender
    const firstCell = screen.getAllByTestId("table-cell")[0];
    const targetCell = screen.getAllByTestId("table-cell")[4];

    expect(targetCell.getAttribute("data-row-index")).toBe("1");
    expect(targetCell.getAttribute("data-col-index")).toBe("1");

    await act(async () => {
      fireEvent.mouseDown(firstCell);
    });
    // Explicitly rerender after mousedown state change
    act(() => {
      rerender(
        <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
          <LiveTableDisplay />
        </TestDataStoreWrapper>
      );
    });

    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(currentIsSelectingState).toBe(true); // Confirm state after mousedown

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = vi.fn((x, y) => {
      if (x === 123 && y === 456) {
        if (targetCell && targetCell.tagName === "TD") {
          return targetCell;
        }
        return null;
      }
      return null;
    });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 123, clientY: 456 });
    });

    expect(mockHandleSelectionMove).toHaveBeenCalled();
    expect(mockHandleSelectionMove).toHaveBeenCalledWith(1, 1);
    expect(currentSelectionAreaState.endCell).toEqual({
      rowIndex: 1,
      colIndex: 1,
    });

    document.elementFromPoint = originalElementFromPoint;
  });

  it("should end selection when mouseup", async () => {
    currentIsSelectingState = true;
    currentSelectedCellState = { rowIndex: 0, colIndex: 0 };
    currentSelectionAreaState = {
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 1, colIndex: 1 },
    };

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    fireEvent.mouseUp(document);

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockHandleSelectionEnd).toHaveBeenCalled();
    expect(currentIsSelectingState).toBe(false);
  });

  it("should apply the selection highlight style to selected cells", () => {
    currentSelectedCellState = { rowIndex: 0, colIndex: 0 };
    currentSelectionAreaState = {
      startCell: { rowIndex: 0, colIndex: 0 },
      endCell: { rowIndex: 1, colIndex: 1 },
    };
    currentIsSelectingState = false;

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cells = screen.getAllByTestId("table-cell");

    const cell00 = cells[0];
    const cell01 = cells[1];
    const cell10 = cells[3];
    const cell11 = cells[4];
    const cell02 = cells[2];

    expect(cell00.getAttribute("data-selected")).toBe("true");
    expect(cell01.getAttribute("data-selected")).toBe("true");
    expect(cell10.getAttribute("data-selected")).toBe("true");
    expect(cell11.getAttribute("data-selected")).toBe("true");
    expect(cell02.getAttribute("data-selected")).toBe("false");
    if (cells.length > 6) {
      const cell20 = cells[6];
      expect(cell20.getAttribute("data-selected")).toBe("false");
    }
  });
});
