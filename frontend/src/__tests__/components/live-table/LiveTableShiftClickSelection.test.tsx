import React from "react";

import type { MockedFunction } from "vitest";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

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
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
import {
  type SelectionState,
  selectionStore,
  useSelectedCells,
  useSelectionEnd,
  useSelectionMove,
  useSelectionStart,
} from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsCellLocked: () => vi.fn(() => false),
}));

let actualSelectionStoreModule: any; // Use any type for the stored original module

vi.mock("@/stores/selectionStore", async (importOriginal) => {
  actualSelectionStoreModule = await importOriginal(); // Assign original module
  return {
    ...(actualSelectionStoreModule as object), // Spread as object
    // Override specific exports with mocks.
    selectIsCellSelected: vi.fn(), // This is the function we will mock
    selectSelectedCells: vi.fn().mockReturnValue([]),
    useSelectedCells: vi.fn().mockReturnValue([]),
    useSelectionStart: vi.fn(),
    useSelectionMove: vi.fn(),
    useSelectionEnd: vi.fn(),
    useIsSelecting: useIsSelectingMock,
    useSelectedCell: useSelectedCellMock,
    // selectionStore instance should be preserved from the original module via spread
  };
});

describe("LiveTableDisplay - Shift-Click Selection", () => {
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Col1", width: 150 },
    { id: colId2, name: "Col2", width: 150 },
  ];
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

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue(
      getLiveTableMockValues({
        liveTableDocInstance,
        initialColumnDefinitions,
        initialColumnOrder,
        initialRowOrder,
        initialRowData,
      })
    );
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

  it("should only update selection status for cells whose selection state changed during shift-click", async () => {
    // This test verifies that selectIsCellSelected reflects changes correctly,
    // which is a proxy for components re-rendering due to selection status change.

    const cellLastSelectedValue: Record<string, boolean> = {};
    const cellSelectionStatusChangedInStep: Record<string, boolean> = {};

    const selectionStoreMockedAPIs = await vi.importMock(
      "@/stores/selectionStore"
    );
    // Cast to access the mocked function, then type it as MockedFunction with an explicit signature
    const mockedPureSelectIsCellSelectedFn = (selectionStoreMockedAPIs as any)
      .selectIsCellSelected as MockedFunction<
      (state: SelectionState, rowIndex: number, colIndex: number) => boolean
    >;

    mockedPureSelectIsCellSelectedFn.mockImplementation(
      (state: SelectionState, rowIndex: number, colIndex: number) => {
        // Call the original function from the stored module, casting actualSelectionStoreModule to any
        const isSelected = (
          actualSelectionStoreModule as any
        ).selectIsCellSelected(state, rowIndex, colIndex);
        const key = `${rowIndex}-${colIndex}`;
        if (
          cellLastSelectedValue[key] !== undefined &&
          cellLastSelectedValue[key] !== isSelected
        ) {
          cellSelectionStatusChangedInStep[key] = true;
        }
        cellLastSelectedValue[key] = isSelected;
        return isSelected;
      }
    );

    // Mock store actions
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

    // Initial render - no selection
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // At this point, all cells should have been checked and recorded as 'false' for selected.
    // cellLastSelectedValue will be populated, cellSelectionStatusChangedInStep is empty.
    expect(cellLastSelectedValue["0-0"]).toBe(false);
    expect(cellLastSelectedValue["0-1"]).toBe(false);
    expect(cellLastSelectedValue["1-0"]).toBe(false);
    expect(cellLastSelectedValue["1-1"]).toBe(false);
    expect(Object.keys(cellSelectionStatusChangedInStep).length).toBe(0);

    const r0c0 = screen.getByDisplayValue("R1C1").closest("td");
    const r1c1 = screen.getByDisplayValue("R2C2").closest("td");
    if (!r0c0 || !r1c1) throw new Error("Test cells not found");

    // --- 1. Click on cell (0,0) ---
    Object.keys(cellSelectionStatusChangedInStep).forEach(
      (k) => delete cellSelectionStatusChangedInStep[k]
    ); // Reset for this step

    fireEvent.mouseDown(r0c0);
    // Simulate store update for (0,0) selection
    act(() => {
      selectionStore.setState({
        selectedCell: { rowIndex: 0, colIndex: 0 },
        selectionArea: {
          startCell: { rowIndex: 0, colIndex: 0 },
          endCell: { rowIndex: 0, colIndex: 0 },
        },
        isSelecting: true,
      });
      useSelectedCellPush({ rowIndex: 0, colIndex: 0 }); // For components using the direct hook value
      useIsSelectingPush(true);
    });
    fireEvent.mouseUp(r0c0);
    act(() => {
      selectionStore.setState({ isSelecting: false });
      useIsSelectingPush(false);
    });

    // Assertions after first click (0,0 selected)
    expect(cellSelectionStatusChangedInStep["0-0"]).toBe(true); // Changed from false to true
    expect(cellSelectionStatusChangedInStep["0-1"]).toBeUndefined();
    expect(cellSelectionStatusChangedInStep["1-0"]).toBeUndefined();
    expect(cellSelectionStatusChangedInStep["1-1"]).toBeUndefined();

    // --- 2. Shift-click on cell (1,1) ---
    Object.keys(cellSelectionStatusChangedInStep).forEach(
      (k) => delete cellSelectionStatusChangedInStep[k]
    ); // Reset for this step

    // Prerequisite: selectedCell is the anchor for shift-click
    expect(selectionStore.getState().selectedCell).toEqual({
      rowIndex: 0,
      colIndex: 0,
    });

    fireEvent.mouseDown(r1c1, { shiftKey: true });
    // Simulate store update for shift-selection to (1,1)
    act(() => {
      selectionStore.setState((state) => ({
        selectionArea: {
          ...state.selectionArea,
          endCell: { rowIndex: 1, colIndex: 1 },
        },
        isSelecting: true,
      }));
      useIsSelectingPush(true);
    });

    fireEvent.mouseUp(r1c1);
    act(() => {
      selectionStore.setState({ isSelecting: false });
      useIsSelectingPush(false);
    });

    // Assertions after shift-click (0,0)-(1,1) selected area
    // (0,0) was true, remains true. So its status didn't change *in this step*.
    expect(cellSelectionStatusChangedInStep["0-0"]).toBeUndefined();
    // (0,1), (1,0), (1,1) changed from false to true.
    expect(cellSelectionStatusChangedInStep["0-1"]).toBe(true);
    expect(cellSelectionStatusChangedInStep["1-0"]).toBe(true);
    expect(cellSelectionStatusChangedInStep["1-1"]).toBe(true);

    // Cleanup mock for other tests
    mockedPureSelectIsCellSelectedFn.mockImplementation(vi.fn());
  });
});
