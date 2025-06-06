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

import { fireEvent, render, screen } from "@testing-library/react";

import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsCellLockedFn } from "@/stores/dataStore";
import { useSelectedCell, useSelectedCells } from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

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

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCells: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionEnd: vi.fn(),
  useSelectionRange: vi.fn(),
  useSelection: vi.fn(),
  useSelectedCell: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
  useUnlockAll: vi.fn(),
  useUnlockRange: vi.fn(),
  useIsCellLockedFn: vi.fn(() => () => false),
  useUndoManager: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    undoStack: [],
    redoStack: [],
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock("lucide-react", async () => {
  const actual = (await vi.importActual(
    "lucide-react"
  )) as typeof import("lucide-react");
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

describe("LiveTableToolbar - Delete Column", () => {
  let liveTableDocInstance: LiveTableDoc;
  let mockDeleteColumns: Mock;

  // Initial V2 data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const colId3 = crypto.randomUUID() as ColumnId;
  const colId4 = crypto.randomUUID() as ColumnId;

  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Header1", width: 100 },
    { id: colId2, name: "Header2", width: 150 },
    { id: colId3, name: "Header3", width: 200 },
    { id: colId4, name: "Header4", width: 120 },
  ];
  const initialColumnOrder: ColumnId[] = [colId1, colId2, colId3, colId4];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: {
      [colId1]: "R1C1",
      [colId2]: "R1C2",
      [colId3]: "R1C3",
      [colId4]: "R1C4",
    },
    [rowId2]: {
      [colId1]: "R2C1",
      [colId2]: "R2C2",
      [colId3]: "R2C3",
      [colId4]: "R2C4",
    },
    [rowId3]: {
      [colId1]: "R3C1",
      [colId2]: "R3C2",
      [colId3]: "R3C3",
      [colId4]: "R3C4",
    },
  };

  function findDeleteColumnButton(): HTMLElement | null {
    const buttons = screen.getAllByRole("button");
    for (const button of buttons) {
      const hasTrashIcon = button.querySelector('[data-testid="trash-icon"]');
      const hasColsIcon = button.querySelector('[data-testid="columns3-icon"]');
      if (hasTrashIcon && hasColsIcon) {
        return button;
      }
    }
    return null;
  }

  beforeEach(() => {
    vi.resetAllMocks();

    const mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    const yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);

    // Manually populate V2 data for the instance
    yDoc.transact(() => {
      initialColumnDefinitions.forEach((def) =>
        liveTableDocInstance.yColumnDefinitions.set(def.id, def)
      );
      liveTableDocInstance.yColumnOrder.push(initialColumnOrder);
      initialRowOrder.forEach((rId) => {
        const rData = initialRowData[rId];
        const yRowMap = new Y.Map<CellValue>();
        initialColumnOrder.forEach((cId) => {
          if (rData[cId]) yRowMap.set(cId, rData[cId]);
        });
        liveTableDocInstance.yRowData.set(rId, yRowMap);
      });
      liveTableDocInstance.yRowOrder.push(initialRowOrder);
      liveTableDocInstance.yMeta.set("schemaVersion", 2);
    });

    mockDeleteColumns = vi.fn().mockResolvedValue({ deletedCount: 0 });

    const mockData = getLiveTableMockValues({
      liveTableDocInstance,
      deleteColumns: mockDeleteColumns,
    });

    vi.mocked(useLiveTable).mockReturnValue(mockData);
  });

  afterEach(() => {
    liveTableDocInstance.yDoc.destroy();
  });

  it("should delete the selected column when a single column is selected and update aria-label", () => {
    const colIndexToDelete = 1; // Corresponds to "Header2" (colId2)
    const selectedCellForTest = { rowIndex: 0, colIndex: colIndexToDelete };

    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue(currentMockData);
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellForTest);
    vi.mocked(useSelectedCells).mockReturnValue([selectedCellForTest]);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute(
      "aria-label",
      "Delete Selected Column"
    );

    const initialColCount = liveTableDocInstance.yColumnOrder.length;
    expect(initialColCount).toBe(initialColumnDefinitions.length);

    const columnIdToDelete = initialColumnOrder[colIndexToDelete];
    expect(liveTableDocInstance.yColumnDefinitions.has(columnIdToDelete)).toBe(
      true
    );
    liveTableDocInstance.yRowData.forEach((rowMap) => {
      expect(rowMap.has(columnIdToDelete)).toBe(true);
    });

    fireEvent.mouseDown(deleteButton!);

    expect(mockDeleteColumns).toHaveBeenCalledTimes(1);
    expect(mockDeleteColumns).toHaveBeenCalledWith([colIndexToDelete]);
  });

  it("should delete multiple selected columns and update aria-label", () => {
    const colIndicesToDelete = [0, 2]; // Header1, Header3 (colId1, colId3)
    const selectedCellsForTest = colIndicesToDelete.map((colIndex) => ({
      rowIndex: 0,
      colIndex,
    }));

    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
    });
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellsForTest[0]);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsForTest);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute(
      "aria-label",
      `Delete ${colIndicesToDelete.length} Columns`
    );

    const columnIdsToDelete = colIndicesToDelete.map(
      (idx) => initialColumnOrder[idx]
    );
    columnIdsToDelete.forEach((id) =>
      expect(liveTableDocInstance.yColumnDefinitions.has(id)).toBe(true)
    );

    fireEvent.mouseDown(deleteButton!);

    expect(mockDeleteColumns).toHaveBeenCalledTimes(1);
    expect(mockDeleteColumns).toHaveBeenCalledWith(
      colIndicesToDelete.sort((a, b) => b - a)
    );
  });

  it("should not delete any column if no cell is selected and button should be disabled, with default aria-label", () => {
    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
    });
    vi.mocked(useSelectedCell).mockReturnValue(null);
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute(
      "aria-label",
      "Delete Selected Column"
    );

    const initialColCount = liveTableDocInstance.yColumnOrder.length;
    expect(liveTableDocInstance.yColumnOrder.length).toBe(initialColCount);
    expect(mockDeleteColumns).not.toHaveBeenCalled();
  });

  it("should not delete any column if cells are locked", () => {
    const colIndicesToDelete = [0, 2];
    const selectedCellsForTest = colIndicesToDelete.map((colIndex) => ({
      rowIndex: 0,
      colIndex,
    }));
    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue(currentMockData);
    vi.mocked(useSelectedCell).mockReturnValue(selectedCellsForTest[0]);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsForTest);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => true);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const deleteButton = findDeleteColumnButton();
    fireEvent.mouseDown(deleteButton!);

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete 2 Columns");

    const initialColCount = liveTableDocInstance.yColumnOrder.length;
    expect(liveTableDocInstance.yColumnOrder.length).toBe(initialColCount);
    expect(mockDeleteColumns).not.toHaveBeenCalled();
  });

  it("should not delete column if any cell in the column is locked, even if not selected", () => {
    const selectedCellForTest = { rowIndex: 0, colIndex: 0 }; // Selecting unlocked cell
    const lockedCellPosition = { rowIndex: 1, colIndex: 0 }; // Another cell in same column is locked

    const mockIsCellLocked = (r: number, c: number) =>
      r === lockedCellPosition.rowIndex && c === lockedCellPosition.colIndex;

    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue(currentMockData);
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

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();

    fireEvent.mouseDown(deleteButton!);
    expect(mockDeleteColumns).not.toHaveBeenCalled();
  });
});
