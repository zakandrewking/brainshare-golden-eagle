import React, { useTransition } from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
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
} from "@/components/live-table/LiveTableDoc";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  useDeleteRows,
  useHeaders,
  useIsCellLockedFn,
  useIsTableLoaded,
} from "@/stores/dataStore";
import { useSelectedCell, useSelectedCells } from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

// Mock Liveblocks to avoid RoomProvider error
vi.mock("@liveblocks/react", () => ({
  useSelf: vi.fn(() => ({
    info: {
      name: "Test User",
      color: "#FF0000",
    },
  })),
  useRoom: vi.fn(() => ({})),
  RoomProvider: vi.fn(({ children }) => children),
}));

vi.mock("react", async () => {
  const actualReact = await vi.importActual<typeof import("react")>("react");
  return {
    ...actualReact,
    default: actualReact,
    useTransition: vi.fn(() => [
      false,
      vi.fn((callback) => {
        if (callback) callback();
      }),
    ]),
  };
});

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useDeleteRows: vi.fn(),
  useUndoManager: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    undoStack: [],
    redoStack: [],
    on: vi.fn(),
    off: vi.fn(),
  }),
  useIsCellLockedFn: vi.fn(),
  useHeaders: vi.fn(),
}));

vi.mock("lucide-react", async () => {
  const actual = await vi.importActual("lucide-react");
  return {
    ...actual,
    Trash2: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="trash-icon" {...props} />
    ),
    ArrowDownToLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowLeftFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowRightFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowUpFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    Columns3: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="columns3-icon" {...props} />
    ),
    Download: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Redo: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Rows3: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="rows3-icon" {...props} />
    ),
    Undo: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  };
});

describe("LiveTableToolbar - Delete Rows", () => {
  let liveTableDocInstance: LiveTableDoc;
  let mockDeleteRows: Mock;

  // Initial V2 data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Header1", width: DEFAULT_COL_WIDTH },
    { id: colId2, name: "Header2", width: DEFAULT_COL_WIDTH },
  ];
  const initialHeaders = [colId1, colId2];
  const initialColumnOrder: ColumnId[] = [colId1, colId2];

  const rowId0 = crypto.randomUUID() as RowId;
  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId0, rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId0]: { [colId1]: "R0C1", [colId2]: "R0C2" },
    [rowId1]: { [colId1]: "R1C1", [colId2]: "R1C2" },
    [rowId2]: { [colId1]: "R2C1", [colId2]: "R2C2" },
    [rowId3]: { [colId1]: "R3C1", [colId2]: "R3C2" },
  };

  function findDeleteRowButton(): HTMLElement | null {
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      const hasTrashIcon = button.querySelector('[data-testid="trash-icon"]');
      const hasRowsIcon = button.querySelector('[data-testid="rows3-icon"]');
      if (hasTrashIcon && hasRowsIcon) {
        return button;
      }
    }
    return null;
  }

  beforeEach(() => {
    vi.resetAllMocks();

    // table loaded
    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);

    const mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    const yDoc = new Y.Doc();
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

    mockDeleteRows = vi.fn().mockResolvedValue({ deletedCount: 0 });
    vi.mocked(useDeleteRows).mockReturnValue(mockDeleteRows);
  });

  afterEach(() => {
    liveTableDocInstance.yDoc.destroy();
  });

  it("should delete the selected row when a single row is selected and update aria-label", () => {
    const selectedRowIndex = 1;
    const selectedCellForTest = { rowIndex: selectedRowIndex, colIndex: 0 };

    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete Row");

    const initialRowCount = liveTableDocInstance.yRowOrder.length;
    expect(initialRowCount).toBe(initialRowOrder.length);
    const rowIdShouldExist = initialRowOrder[selectedRowIndex]; // rowId1
    expect(liveTableDocInstance.yRowData.has(rowIdShouldExist)).toBe(true);

    fireEvent.mouseDown(deleteButton!);

    expect(mockDeleteRows).toHaveBeenCalledTimes(1);
    expect(mockDeleteRows).toHaveBeenCalledWith([selectedRowIndex]);
  });

  it("should delete multiple selected rows and update aria-label", () => {
    const rowIndicesToDelete = [0, 2]; // Delete R0 (rowId0) and R2 (rowId2)
    const selectedCellsForTest = rowIndicesToDelete.map((rowIndex) => ({
      rowIndex,
      colIndex: 0,
    }));

    vi.mocked(useSelectedCell).mockReturnValue(selectedCellsForTest[0]);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsForTest);

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete 2 Rows");

    const initialRowCount = liveTableDocInstance.yRowOrder.length;
    expect(initialRowCount).toBe(initialRowOrder.length);

    fireEvent.mouseDown(deleteButton!);

    expect(mockDeleteRows).toHaveBeenCalledTimes(1);
    expect(mockDeleteRows).toHaveBeenCalledWith(
      rowIndicesToDelete.sort((a, b) => b - a)
    );
  });

  it("should not delete any row if no cells are selected and button should be disabled", () => {
    vi.mocked(useSelectedCell).mockReturnValue(null);
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    fireEvent.mouseDown(deleteButton!);

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete Row");

    const initialRowCount = liveTableDocInstance.yRowOrder.length;
    expect(liveTableDocInstance.yRowOrder.length).toBe(initialRowCount);
    expect(mockDeleteRows).not.toHaveBeenCalled();
  });

  it("should not delete any row if cells are locked", () => {
    const lockedCellPositions = [
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 2, colIndex: 1 },
    ];
    const selectedCellsForTest = [{ rowIndex: 0, colIndex: 0 }];
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellsForTest[0]);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsForTest);
    vi.mocked(useIsCellLockedFn).mockReturnValue(
      (rowIndex: number, colIndex: number) => {
        return lockedCellPositions.some(
          (position) =>
            position.rowIndex === rowIndex && position.colIndex === colIndex
        );
      }
    );

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete Row");

    fireEvent.mouseDown(deleteButton!);

    const initialRowCount = liveTableDocInstance.yRowOrder.length;
    expect(liveTableDocInstance.yRowOrder.length).toBe(initialRowCount);
    expect(mockDeleteRows).not.toHaveBeenCalled();
  });

  it("should not delete any row if any cell in the row is locked, even if not selected", () => {
    const selectedCellForTest = { rowIndex: 0, colIndex: 0 }; // Selecting unlocked cell
    const lockedCellPosition = { rowIndex: 0, colIndex: 1 }; // Another cell in same row is locked

    const mockIsCellLocked = (r: number, c: number) =>
      r === lockedCellPosition.rowIndex && c === lockedCellPosition.colIndex;

    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);
    vi.mocked(useIsCellLockedFn).mockReturnValue(mockIsCellLocked);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();

    fireEvent.mouseDown(deleteButton!);
    expect(mockDeleteRows).not.toHaveBeenCalled();
  });

  it("should update locked cell positions after deleting rows", () => {
    // Lock a cell in row 2 (index 2)
    const lockId = liveTableDocInstance.lockCellRange(2, 2, 0, 0, "test lock");
    expect(lockId).toBeTruthy();

    // Verify initial lock state
    liveTableDocInstance.updateLockedCellsState();
    let lockedCellsMap = new Map<string, string | undefined>();
    const mockCallback = vi.fn((map) => {
      lockedCellsMap = map;
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(lockedCellsMap.has("2-0")).toBe(true);
    expect(lockedCellsMap.get("2-0")).toBe("test lock");

    // Delete row 1 (which should shift row 2 to index 1)
    const rowIndexToDelete = 1;
    const selectedCellForTest = { rowIndex: rowIndexToDelete, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);

    // Mock the actual deletion
    mockDeleteRows.mockImplementation(async (rowIndices) => {
      const deletedCount = liveTableDocInstance.deleteRows(rowIndices);
      return { deletedCount };
    });

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    fireEvent.mouseDown(deleteButton!);

    // Verify that the locked cell has been moved to the correct new position
    // Original row 2 should now be at row 1 after deleting row 1
    expect(lockedCellsMap.has("1-0")).toBe(true);
    expect(lockedCellsMap.get("1-0")).toBe("test lock");
    expect(lockedCellsMap.has("2-0")).toBe(false);
  });

  it("should remove locked cells when their row is deleted", () => {
    // Lock a cell in row 1 (index 1)
    const lockId = liveTableDocInstance.lockCellRange(1, 1, 0, 0, "test lock");
    expect(lockId).toBeTruthy();

    // Verify initial lock state
    let lockedCellsMap = new Map<string, string | undefined>();
    const mockCallback = vi.fn((map) => {
      lockedCellsMap = map;
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(lockedCellsMap.has("1-0")).toBe(true);

    // Delete row 1 (the locked row)
    const rowIndexToDelete = 1;
    const selectedCellForTest = { rowIndex: rowIndexToDelete, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);

    // Mock the actual deletion
    mockDeleteRows.mockImplementation(async (rowIndices) => {
      const deletedCount = liveTableDocInstance.deleteRows(rowIndices);
      return { deletedCount };
    });

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    fireEvent.mouseDown(deleteButton!);

    // Verify that the locked cell has been removed since its row was deleted
    expect(lockedCellsMap.has("1-0")).toBe(false);
  });

  it("should handle multiple locked cells correctly when deleting rows", () => {
    // Lock cells in multiple rows
    const lockId1 = liveTableDocInstance.lockCellRange(0, 0, 0, 0, "lock 1");
    const lockId2 = liveTableDocInstance.lockCellRange(2, 2, 1, 1, "lock 2");
    const lockId3 = liveTableDocInstance.lockCellRange(3, 3, 0, 0, "lock 3");
    expect(lockId1).toBeTruthy();
    expect(lockId2).toBeTruthy();
    expect(lockId3).toBeTruthy();

    // Verify initial lock state
    let lockedCellsMap = new Map<string, string | undefined>();
    const mockCallback = vi.fn((map) => {
      lockedCellsMap = map;
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(lockedCellsMap.has("0-0")).toBe(true); // lock 1
    expect(lockedCellsMap.has("2-1")).toBe(true); // lock 2
    expect(lockedCellsMap.has("3-0")).toBe(true); // lock 3

    // Delete row 1 (should shift rows 2,3 to positions 1,2)
    const rowIndexToDelete = 1;
    const selectedCellForTest = { rowIndex: rowIndexToDelete, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);

    // Mock the actual deletion
    mockDeleteRows.mockImplementation(async (rowIndices) => {
      const deletedCount = liveTableDocInstance.deleteRows(rowIndices);
      return { deletedCount };
    });

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteRowButton();
    fireEvent.mouseDown(deleteButton!);

    // Verify that locked cells have been updated to correct positions
    expect(lockedCellsMap.has("0-0")).toBe(true); // lock 1 unchanged
    expect(lockedCellsMap.has("1-1")).toBe(true); // lock 2 shifted from row 2 to 1
    expect(lockedCellsMap.has("2-0")).toBe(true); // lock 3 shifted from row 3 to 2

    // Old positions should no longer exist
    expect(lockedCellsMap.has("2-1")).toBe(false);
    expect(lockedCellsMap.has("3-0")).toBe(false);
  });
});
