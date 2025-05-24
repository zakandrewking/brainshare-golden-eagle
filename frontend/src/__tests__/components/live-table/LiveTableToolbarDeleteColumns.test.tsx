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

import { getLiveTableMockValues } from "./liveTableTestUtils";

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

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
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
    vi.clearAllMocks();
    const mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    // This test needs to inspect liveTableDocInstance for assertions if mockDeleteColumns wasn't called
    // So we create it here and pass it to getLiveTableMockValues.
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
      liveTableDocInstance, // Pass the instance with V2 data
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
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
      selectedCell: selectedCellForTest,
      selectedCells: [selectedCellForTest],
      // isCellSelected might need adjustment if mocks were V1 specific
      isCellSelected: vi.fn(
        (rI, cI) =>
          rI === selectedCellForTest.rowIndex &&
          cI === selectedCellForTest.colIndex
      ),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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

    fireEvent.click(deleteButton!);

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
      selectedCell: selectedCellsForTest[0],
      selectedCells: selectedCellsForTest,
      isCellSelected: vi.fn((rI, cI) =>
        selectedCellsForTest.some(
          (cell) => cell.rowIndex === rI && cell.colIndex === cI
        )
      ),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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

    fireEvent.click(deleteButton!);

    expect(mockDeleteColumns).toHaveBeenCalledTimes(1);
    expect(mockDeleteColumns).toHaveBeenCalledWith(
      colIndicesToDelete.sort((a, b) => b - a)
    );
  });

  it("should not delete any column if no cell is selected and button should be disabled, with default aria-label", () => {
    const currentMockData = useLiveTable();
    vi.mocked(useLiveTable).mockReturnValue({
      ...currentMockData,
      selectedCell: null,
      selectedCells: [],
      isCellSelected: vi.fn(() => false),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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
});
