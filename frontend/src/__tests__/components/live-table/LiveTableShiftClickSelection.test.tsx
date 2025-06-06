import React from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { act, fireEvent, render, screen } from "@testing-library/react";

import {
  useIsSelectingMock,
  useIsSelectingPush,
} from "@/__tests__/test-utils/useIsSelecting";
import {
  useSelectedCellMock,
  useSelectedCellPush,
} from "@/__tests__/test-utils/useSelectedCell";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useHeaders,
  useIsCellLocked,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";
import {
  useSelectedCells,
  useSelectionEnd,
  useSelectionMove,
  useSelectionStart,
} from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./data-store-test-utils";

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useIsCellLocked: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  selectIsCellSelected: vi.fn(),
  selectSelectedCells: vi.fn(),
  useSelectedCells: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionMove: vi.fn(),
  useSelectionEnd: vi.fn(),
  useIsSelecting: useIsSelectingMock,
  useSelectedCell: useSelectedCellMock,
}));

describe("LiveTableDisplay - Shift-Click Selection", () => {
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Col1", width: 150 },
    { id: colId2, name: "Col2", width: 150 },
  ];
  const initialHeaders = [colId1, colId2];
  const initialColumnOrder: ColumnId[] = [colId1, colId2];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "R1C1", [colId2]: "R1C2" },
    [rowId2]: { [colId1]: "R2C1", [colId2]: "R2C2" },
  };

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  beforeEach(async () => {
    vi.resetAllMocks();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLocked).mockReturnValue(false);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));

    // reset the selected cell
    await act(async () => {
      useSelectedCellPush(null);
    });

    yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);

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
  });

  afterEach(() => {
    yDoc.destroy();
  });

  it("should expand selection with shift-click after an initial selection and update selectedCells", async () => {
    const mockHandleSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(
      () => mockHandleSelectionStart
    );
    const mockHandleSelectionMove = vi.fn();
    vi.mocked(useSelectionMove).mockImplementation(
      () => mockHandleSelectionMove
    );

    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const firstCellToClick = screen.getByDisplayValue("R1C1").closest("td");
    const secondCellToShiftClick = screen
      .getByDisplayValue("R2C2")
      .closest("td");

    if (!firstCellToClick || !secondCellToShiftClick) {
      throw new Error("Test cells not found");
    }

    // 1. Simulate initial click on cell (0,0)
    fireEvent.mouseDown(firstCellToClick);

    expect(mockHandleSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionStart).toHaveBeenCalledWith(0, 0);

    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(firstCellToClick);

    await act(async () => {
      useIsSelectingPush(false);
      useSelectedCellPush({
        rowIndex: 0,
        colIndex: 0,
      });
    });

    // 2. Simulate shift-click on cell (1,1)
    fireEvent.mouseDown(secondCellToShiftClick, { shiftKey: true });

    expect(mockHandleSelectionMove).toHaveBeenCalledTimes(1);
    expect(mockHandleSelectionMove).toHaveBeenCalledWith(1, 1);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(secondCellToShiftClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(2);
  });

  it("should start a new selection with click if shift is not pressed, even if an anchor exists", async () => {
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(() => mockSelectionStart);
    const mockSelectionMove = vi.fn();
    vi.mocked(useSelectionMove).mockImplementation(() => mockSelectionMove);
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const firstCellToClick = screen.getByDisplayValue("R1C1").closest("td");
    const secondCellToClick = screen.getByDisplayValue("R2C2").closest("td");

    if (!firstCellToClick || !secondCellToClick) {
      throw new Error("Test cells not found");
    }

    fireEvent.mouseDown(firstCellToClick);

    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockSelectionStart).toHaveBeenLastCalledWith(0, 0);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(firstCellToClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(1);

    await act(async () => {
      useIsSelectingPush(false);
    });

    fireEvent.mouseDown(secondCellToClick);

    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionMove).not.toHaveBeenCalled();
    expect(mockSelectionStart).toHaveBeenCalledTimes(2);
    expect(mockSelectionStart).toHaveBeenLastCalledWith(1, 1);

    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(secondCellToClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(2);
  });

  it("should start a new selection with shift-click if no initial anchor exists", async () => {
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(() => mockSelectionStart);
    const mockSelectionMove = vi.fn();
    vi.mocked(useSelectionMove).mockImplementation(() => mockSelectionMove);
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const cellToShiftClick = screen.getByDisplayValue("R1C2").closest("td");
    if (!cellToShiftClick) {
      throw new Error("Test cell not found");
    }

    fireEvent.mouseDown(cellToShiftClick, { shiftKey: true });

    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    expect(mockSelectionStart).toHaveBeenCalledTimes(1);
    expect(mockSelectionStart).toHaveBeenCalledWith(0, 1);

    // simulate the updated hook
    await act(async () => {
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(cellToShiftClick);

    expect(mockSelectionEnd).toHaveBeenCalledTimes(1);
    expect(mockSelectionMove).not.toHaveBeenCalled();
  });
});
