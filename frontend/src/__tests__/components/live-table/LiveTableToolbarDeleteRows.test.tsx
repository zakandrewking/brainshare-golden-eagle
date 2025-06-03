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
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsCellLocked } from "@/stores/dataStore";
import { useSelectedCells, useSelectionStore } from "@/stores/selectionStore";

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
    ...(await importOriginal<
      typeof import("@/components/live-table/LiveTableProvider")
    >()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selectionStore")>()),
  useSelectionStore: vi.fn(),
  useSelectedCells: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/dataStore")>()),
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
  useUnlockAll: vi.fn(),
  useUnlockRange: vi.fn(),
  useIsCellLocked: vi.fn(() => () => false),
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
    vi.clearAllMocks();
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
    const mockData = getLiveTableMockValues({
      liveTableDocInstance,
      deleteRows: mockDeleteRows,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
  });

  afterEach(() => {
    liveTableDocInstance.yDoc.destroy();
  });

  it("should delete the selected row when a single row is selected and update aria-label", () => {
    const selectedRowIndex = 1;
    const selectedCellForTest = { rowIndex: selectedRowIndex, colIndex: 0 };

    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue(currentMockData);
    vi.mocked(useSelectionStore).mockReturnValue(selectedCellForTest);
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

    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
    });
    vi.mocked(useSelectionStore).mockReturnValue(selectedCellsForTest[0]);
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
    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue(currentMockData);
    vi.mocked(useSelectionStore).mockReturnValue(null);
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
    const rowIndicesToDelete = [0, 2];
    const selectedCellsForTest = rowIndicesToDelete.map((rowIndex) => ({
      rowIndex,
      colIndex: 0,
    }));
    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
    });
    vi.mocked(useSelectionStore).mockReturnValue(selectedCellsForTest[0]);
    vi.mocked(useSelectedCells).mockReturnValue(selectedCellsForTest);
    vi.mocked(useIsCellLocked).mockReturnValue(() => true);

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
    expect(deleteButton).toHaveAttribute("aria-label", "Delete 2 Rows");

    const initialRowCount = liveTableDocInstance.yRowOrder.length;
    expect(liveTableDocInstance.yRowOrder.length).toBe(initialRowCount);
    expect(mockDeleteRows).not.toHaveBeenCalled();
  });
});
