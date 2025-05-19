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
  let ydoc: Y.Doc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;
  let mockStartTransition: React.TransitionStartFunction;
  let mockDeleteRows: Mock;

  const initialHeaders = ["Header1", "Header2"];
  const initialTableContent = [
    { Header1: "R0C1", Header2: "R0C2" },
    { Header1: "R1C1", Header2: "R1C2" },
    { Header1: "R2C1", Header2: "R2C2" },
    { Header1: "R3C1", Header2: "R3C2" },
  ];

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
    mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    ydoc = new Y.Doc();
    yTable = ydoc.getArray<Y.Map<unknown>>("tableData");
    yHeaders = ydoc.getArray<string>("tableHeaders");

    yHeaders.insert(0, initialHeaders);

    const rowsToInsert = initialTableContent.map((rowContent) => {
      const yRow = new Y.Map<unknown>();
      initialHeaders.forEach((header) => {
        yRow.set(header, rowContent[header as keyof typeof rowContent]);
      });
      return yRow;
    });
    yTable.insert(0, rowsToInsert);

    const mockData = getLiveTableMockValues({
      yDoc: ydoc,
      yTable: yTable,
      yHeaders: yHeaders,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    mockDeleteRows = mockData.deleteRows as Mock;
  });

  afterEach(() => {
    ydoc.destroy();
  });

  it("should delete the selected row when a single row is selected and update aria-label", () => {
    const selectedRowIndex = 1;
    const selectedCellForTest = { rowIndex: selectedRowIndex, colIndex: 0 };
    const mockUndoManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      stopCapturing: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      undoStack: [],
      redoStack: [],
    } as unknown as Y.UndoManager;

    const mockData = getLiveTableMockValues({
      yDoc: ydoc,
      yTable: yTable,
      yHeaders: yHeaders,
      selectedCell: selectedCellForTest,
      selectedCells: [selectedCellForTest],
      undoManager: mockUndoManager,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
      isCellSelected: vi.fn((rI) => rI === selectedRowIndex),
      getSelectedCellsData: vi.fn(() => [
        [initialTableContent[selectedRowIndex].Header1],
      ]),
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    mockDeleteRows = mockData.deleteRows as Mock;

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete Row");

    expect(yTable.length).toBe(initialTableContent.length);
    expect(yTable.get(selectedRowIndex).toJSON()).toEqual(
      initialTableContent[selectedRowIndex]
    );

    fireEvent.click(deleteButton!);

    expect(mockDeleteRows).toHaveBeenCalledTimes(1);
    expect(mockDeleteRows).toHaveBeenCalledWith([selectedRowIndex]);
  });

  it("should delete multiple selected rows and update aria-label", () => {
    const rowIndicesToDelete = [0, 2];
    const selectedCellsForTest = rowIndicesToDelete.map((rowIndex) => ({
      rowIndex,
      colIndex: 0,
    }));

    const mockUndoManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      stopCapturing: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      undoStack: [],
      redoStack: [],
    } as unknown as Y.UndoManager;

    const mockData = getLiveTableMockValues({
      yDoc: ydoc,
      yTable: yTable,
      yHeaders: yHeaders,
      selectedCell: selectedCellsForTest[0],
      selectedCells: selectedCellsForTest,
      undoManager: mockUndoManager,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
      isCellSelected: vi.fn((rI, cI) =>
        selectedCellsForTest.some(
          (cell) => cell.rowIndex === rI && cell.colIndex === cI
        )
      ),
      getSelectedCellsData: vi.fn(() => [["R0C1"], ["R2C1"]]),
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    mockDeleteRows = mockData.deleteRows as Mock;

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete 2 Rows");

    expect(yTable.length).toBe(initialTableContent.length);

    fireEvent.click(deleteButton!);

    expect(mockDeleteRows).toHaveBeenCalledTimes(1);
    expect(mockDeleteRows).toHaveBeenCalledWith(
      rowIndicesToDelete.sort((a, b) => b - a)
    );
  });

  it("should not delete any row if no cells are selected and button should be disabled", () => {
    const mockUndoManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      stopCapturing: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      undoStack: [],
      redoStack: [],
    } as unknown as Y.UndoManager;

    const mockData = getLiveTableMockValues({
      yDoc: ydoc,
      yTable: yTable,
      yHeaders: yHeaders,
      selectedCell: null,
      selectedCells: [],
      undoManager: mockUndoManager,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
      isCellSelected: vi.fn(() => false),
      getSelectedCellsData: vi.fn(() => []),
      isTableLoaded: true,
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
    mockDeleteRows = mockData.deleteRows as Mock;

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete Row");

    const initialLength = yTable.length;
    expect(yTable.length).toBe(initialLength);
    expect(yTable.toArray().map((r) => r.toJSON())).toEqual(
      initialTableContent
    );
  });
});
