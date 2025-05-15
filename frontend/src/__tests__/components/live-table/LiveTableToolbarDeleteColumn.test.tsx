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

const mockedUseLiveTable = vi.mocked(useLiveTable);

describe("LiveTableToolbar - Delete Column", () => {
  let ydoc: Y.Doc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;
  let yColWidthsMap: Y.Map<number>;
  let mockStartTransition: React.TransitionStartFunction;

  const initialHeadersData = ["Header1", "Header2", "Header3"];
  const initialColWidthsData = {
    Header1: 100,
    Header2: 150,
    Header3: 200,
  };
  const initialTableContentData = [
    { Header1: "R1C1", Header2: "R1C2", Header3: "R1C3" },
    { Header1: "R2C1", Header2: "R2C2", Header3: "R2C3" },
  ];

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
    mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    ydoc = new Y.Doc();
    yTable = ydoc.getArray<Y.Map<unknown>>("tableData");
    yHeaders = ydoc.getArray<string>("tableHeaders");
    yColWidthsMap = ydoc.getMap<number>("colWidths");

    yHeaders.insert(0, initialHeadersData);
    initialHeadersData.forEach((header) => {
      if (initialColWidthsData[header as keyof typeof initialColWidthsData]) {
        yColWidthsMap.set(
          header,
          initialColWidthsData[header as keyof typeof initialColWidthsData]
        );
      }
    });

    const rowsToInsert = initialTableContentData.map((rowContent) => {
      const yRow = new Y.Map<unknown>();
      initialHeadersData.forEach((header) => {
        yRow.set(header, rowContent[header as keyof typeof rowContent]);
      });
      return yRow;
    });
    yTable.insert(0, rowsToInsert);
  });

  afterEach(() => {
    ydoc.destroy();
  });

  it("should delete the selected column when the delete button is clicked", () => {
    const colIndexToDelete = 1; // Delete "Header2"
    const headerToDelete = initialHeadersData[colIndexToDelete];
    const selectedCellForTest = { rowIndex: 0, colIndex: colIndexToDelete };

    const mockUndoManager = {
      undo: vi.fn(),
      redo: vi.fn(),
      stopCapturing: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      undoStack: [],
      redoStack: [],
    } as unknown as Y.UndoManager;

    const yHeadersDeleteSpy = vi.spyOn(yHeaders, "delete");
    // We will check row.delete() by its effect, not by spying on each row's map instance directly.

    mockedUseLiveTable.mockReturnValue({
      yDoc: ydoc,
      yTable,
      yHeaders,
      selectedCell: selectedCellForTest,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: yHeaders.toArray(),
      tableData: yTable.toArray().map((row) => row.toJSON()),
      columnWidths: Object.fromEntries(yColWidthsMap.entries()),
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
      isCellSelected: vi.fn(
        (rI, cI) =>
          rI === selectedCellForTest.rowIndex &&
          cI === selectedCellForTest.colIndex
      ),
      editingCell: null,
      setEditingCell: vi.fn(),
      clearSelection: vi.fn(),
      tableId: "test-delete-col-table",
      selectedCells: [selectedCellForTest],
      getSelectedCellsData: vi.fn(() => [["R1C2"]]), // Example data for selected cell
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();

    expect(yHeaders.length).toBe(initialHeadersData.length);
    expect(yTable.get(0).get(headerToDelete)).toBe("R1C2");

    fireEvent.click(deleteButton!);

    expect(yHeadersDeleteSpy).toHaveBeenCalledTimes(1);
    expect(yHeadersDeleteSpy).toHaveBeenCalledWith(colIndexToDelete, 1);

    expect(yHeaders.length).toBe(initialHeadersData.length - 1);
    expect(yHeaders.toArray()).toEqual(["Header1", "Header3"]);

    // Verify column is removed from each row in yTable
    yTable.forEach((row) => {
      expect(row.has(headerToDelete)).toBe(false);
    });
    expect(yTable.get(0).get("Header1")).toBe("R1C1"); // Check remaining data integrity

    // Check that yColWidthsMap (the Y.Map) itself has not been modified by this operation
    // because handleDeleteColumn in the component does not touch it.
    // The derived `columnWidths` in the context would be stale if not for a separate observer,
    // but the underlying Y.Map for widths is what we check here.
    expect(Object.fromEntries(yColWidthsMap.entries())).toEqual(
      initialColWidthsData
    );
  });

  it("should not delete any column if no cell is selected and button should be disabled", () => {
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
      selectedCell: null, // No cell selected
      undoManager: mockUndoManager,
      isTableLoaded: true,
      headers: yHeaders.toArray(),
      tableData: yTable.toArray().map((row) => row.toJSON()),
      columnWidths: Object.fromEntries(yColWidthsMap.entries()),
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
      tableId: "test-no-delete-col-table",
      selectedCells: [],
      getSelectedCellsData: vi.fn(() => []),
    });

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    const deleteButton = findDeleteColumnButton();
    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).toBeDisabled();

    expect(yHeaders.length).toBe(initialHeadersData.length);
    expect(yTable.toArray().map((r) => r.toJSON())).toEqual(
      initialTableContentData
    );
  });
});
