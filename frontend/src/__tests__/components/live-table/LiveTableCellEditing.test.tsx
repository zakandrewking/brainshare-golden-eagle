import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  LiveTableContextType,
  useLiveTable,
} from "@/components/live-table/LiveTableProvider";
import {
  type SelectionState,
  useSelectionStore,
} from "@/stores/selectionStore";

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the entire store module
vi.mock("@/stores/selectionStore");

describe("LiveTableDisplay Cell Editing", () => {
  const mockHandleCellChange = vi.fn();
  const mockHandleCellFocus = vi.fn();
  const mockHandleCellBlur = vi.fn();
  const mockStartSelection = vi.fn();
  let currentEditingCell: { rowIndex: number; colIndex: number } | null = null;

  const mockSetEditingCell = vi.fn((cell) => {
    currentEditingCell = cell;
  });

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  // V2 data structures
  const colIdN = crypto.randomUUID() as ColumnId;
  const colIdA = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colIdN, name: "name", width: DEFAULT_COL_WIDTH },
    { id: colIdA, name: "age", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colIdN, colIdA];

  const rowIdJD = crypto.randomUUID() as RowId;
  const rowIdJS = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowIdJD, rowIdJS];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowIdJD]: { [colIdN]: "John Doe", [colIdA]: "30" },
    [rowIdJS]: { [colIdN]: "Jane Smith", [colIdA]: "25" },
  };

  const setupUseLiveTableMock = () => {
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockReturnValue(
      getLiveTableMockValues({
        liveTableDocInstance,
        handleCellChange: mockHandleCellChange,
        handleCellFocus: mockHandleCellFocus,
        handleCellBlur: mockHandleCellBlur,
        setEditingCell: mockSetEditingCell,
        editingCell: currentEditingCell,
      }) as LiveTableContextType
    );

    // Use vi.mocked to correctly type the mocked store hook
    vi.mocked(useSelectionStore).mockImplementation(
      <TState = SelectionState,>(
        selector?: (state: SelectionState) => TState
      ): TState | SelectionState => {
        const state: SelectionState = {
          selectedCell: null,
          selectionArea: { startCell: null, endCell: null },
          isSelecting: false,
          setSelectedCell: vi.fn(),
          startSelection: mockStartSelection,
          moveSelection: vi.fn(),
          endSelection: vi.fn(),
          clearSelection: vi.fn(),
        };
        if (selector) {
          return selector(state);
        }
        return state;
      }
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    currentEditingCell = null;

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

    setupUseLiveTableMock();
  });

  afterEach(() => {
    yDoc.destroy();
  });

  it("handles cell interactions correctly - click behavior and edit mode", async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<LiveTableDisplay />);

    const cellInputJohnDoe = screen.getByDisplayValue("John Doe");
    expect(cellInputJohnDoe).toBeInTheDocument();

    await user.click(cellInputJohnDoe);
    expect(mockStartSelection).toHaveBeenCalledWith(0, 0);
    expect(cellInputJohnDoe).not.toHaveFocus();

    const tdJohnDoe = cellInputJohnDoe.closest("td");
    expect(tdJohnDoe).toBeInTheDocument();
    await user.dblClick(tdJohnDoe!);

    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(currentEditingCell).toEqual({ rowIndex: 0, colIndex: 0 });
    setupUseLiveTableMock();
    rerender(<LiveTableDisplay />);

    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);

    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
    const editingInput = editingTd!.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement | null;
    expect(editingInput).toBeInTheDocument();
    expect(editingInput!.value).toBe("John Doe");

    fireEvent.change(editingInput!, { target: { value: "New Name" } });
    const headerNameForFirstCol = initialColumnDefinitions[0].name; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "New Name"
    );

    const cellInputJaneSmith = screen.getByDisplayValue("Jane Smith");
    await user.click(cellInputJaneSmith.closest("td")!);

    expect(mockHandleCellBlur).toHaveBeenCalled();
    expect(mockStartSelection).toHaveBeenCalledWith(1, 0);
  });
});
