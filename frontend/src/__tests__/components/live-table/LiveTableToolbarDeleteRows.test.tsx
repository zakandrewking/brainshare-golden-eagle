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

import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

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

const mockedUseLiveTable = vi.mocked(useLiveTable);

describe("LiveTableToolbar - Delete Rows", () => {
  let ydoc: Y.Doc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;
  let mockStartTransition: React.TransitionStartFunction;

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
    // Now use the imported useTransition directly
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

    // Spy on yTable.delete
    const yTableDeleteSpy = vi.spyOn(yTable, "delete");

    mockedUseLiveTable.mockReturnValue({
      yDoc: ydoc,
      yTable,
      yHeaders,
      selectedCell: selectedCellForTest,
      selectedCells: [selectedCellForTest],
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
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
        startCell: selectedCellForTest,
        endCell: selectedCellForTest,
      },
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isSelecting: false,
      isCellSelected: vi.fn((rI) => rI === selectedRowIndex),
      editingCell: null,
      setEditingCell: vi.fn(),
      clearSelection: vi.fn(),
      tableId: "test-delete-table",
      getSelectedCellsData: vi.fn(() => [
        [initialTableContent[selectedRowIndex].Header1],
      ]),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete selected row");

    expect(yTable.length).toBe(initialTableContent.length);
    expect(yTable.get(selectedRowIndex).toJSON()).toEqual(
      initialTableContent[selectedRowIndex]
    );

    fireEvent.click(deleteButton!);

    expect(yTableDeleteSpy).toHaveBeenCalledTimes(1);
    expect(yTableDeleteSpy).toHaveBeenCalledWith(selectedRowIndex, 1);

    expect(yTable.length).toBe(initialTableContent.length - 1);
    const remainingRows = yTable.toArray().map((row) => row.toJSON());
    const expectedRemainingContent = initialTableContent.filter(
      (_, index) => index !== selectedRowIndex
    );
    expect(remainingRows).toEqual(expectedRemainingContent);

    let foundDeletedContent = false;
    remainingRows.forEach((row) => {
      if (
        JSON.stringify(row) ===
        JSON.stringify(initialTableContent[selectedRowIndex])
      ) {
        foundDeletedContent = true;
      }
    });
    expect(foundDeletedContent).toBe(false);
  });

  it("should delete multiple selected rows and update aria-label", () => {
    const rowIndicesToDelete = [0, 2]; // Delete R0 and R2
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

    const yTableDeleteSpy = vi.spyOn(yTable, "delete");

    mockedUseLiveTable.mockReturnValue({
      yDoc: ydoc,
      yTable,
      yHeaders,
      selectedCell: selectedCellsForTest[0], // e.g., primary selected cell
      selectedCells: selectedCellsForTest,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
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
        startCell: selectedCellsForTest[0],
        endCell: selectedCellsForTest[selectedCellsForTest.length - 1],
      },
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isSelecting: false,
      isCellSelected: vi.fn((rI, cI) =>
        selectedCellsForTest.some(
          (cell) => cell.rowIndex === rI && cell.colIndex === cI
        )
      ),
      editingCell: null,
      setEditingCell: vi.fn(),
      clearSelection: vi.fn(),
      tableId: "test-delete-multi-row-table",
      getSelectedCellsData: vi.fn(() => [["R0C1"], ["R2C1"]]), // Example data
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete selected rows");

    expect(yTable.length).toBe(initialTableContent.length);

    fireEvent.click(deleteButton!);

    // Deletion happens in descending order of indices
    expect(yTableDeleteSpy).toHaveBeenCalledTimes(rowIndicesToDelete.length);
    // R2 (index 2) is deleted first, then R0 (index 0)
    expect(yTableDeleteSpy).toHaveBeenNthCalledWith(1, 2, 1); // Deletes initialTableContent[2]
    expect(yTableDeleteSpy).toHaveBeenNthCalledWith(2, 0, 1); // Deletes initialTableContent[0]

    expect(yTable.length).toBe(
      initialTableContent.length - rowIndicesToDelete.length
    );
    const remainingRows = yTable.toArray().map((row) => row.toJSON());
    const expectedRemainingContent = [
      initialTableContent[1], // R1 was not deleted
      initialTableContent[3], // R3 was not deleted
    ];
    expect(remainingRows).toEqual(expectedRemainingContent);
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

    mockedUseLiveTable.mockReturnValue({
      yDoc: ydoc,
      yTable,
      yHeaders,
      selectedCell: null,
      selectedCells: [],
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: initialHeaders,
      tableData: yTable.toArray().map((row) => row.toJSON()),
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
      handleSelectionStart: vi.fn(),
      handleSelectionMove: vi.fn(),
      handleSelectionEnd: vi.fn(),
      isSelecting: false,
      isCellSelected: vi.fn(() => false),
      editingCell: null,
      setEditingCell: vi.fn(),
      clearSelection: vi.fn(),
      tableId: "test-no-delete-table",
      getSelectedCellsData: vi.fn(() => []),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteRowButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();
    expect(deleteButton).toHaveAttribute("aria-label", "Delete selected row");

    const initialLength = yTable.length;
    expect(yTable.length).toBe(initialLength);
    expect(yTable.toArray().map((r) => r.toJSON())).toEqual(
      initialTableContent
    );
  });
});
