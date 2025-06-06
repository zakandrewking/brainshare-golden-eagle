import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { act, renderHook } from "@testing-library/react";

import {
  type CellPosition,
  selectionStore,
  useSelectedCells,
  useSelectIsCellInSelection,
  useSelectIsCellSelected,
} from "@/stores/selectionStore";

describe("useSelectedCells", () => {
  beforeEach(() => {
    act(() => {
      selectionStore.getState().clearSelection();
    });
  });

  it("should return an empty array initially", () => {
    const callback = vi.fn(() => useSelectedCells());
    renderHook(callback);
    expect(callback).toHaveReturnedWith([]);
  });

  it("should return selected cells when selection is made", () => {
    const callback = vi.fn(() => useSelectedCells());
    renderHook(callback);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 0, false);
      selectionStore.getState().startOrMoveSelection(1, 1, true);
    });
    const expectedCells: CellPosition[] = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ];
    expect(callback).toHaveLastReturnedWith(
      expect.arrayContaining(expectedCells)
    );
  });

  it("should update when selection changes", () => {
    const callback = vi.fn(() => useSelectedCells());
    renderHook(callback);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 0, false);
    });
    expect(callback).toHaveReturnedWith([{ rowIndex: 0, colIndex: 0 }]);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 1, true);
    });
    expect(callback).toHaveReturnedWith(
      expect.arrayContaining([
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 1 },
      ])
    );
  });

  it("should return empty array when selection is cleared", () => {
    const { result } = renderHook(useSelectedCells);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 0, false);
      selectionStore.getState().clearSelection();
    });
    expect(result.current).toEqual([]);
  });

  it("should use shallow equality for comparison", () => {
    const callback = vi.fn(() => useSelectedCells());
    renderHook(callback);
    expect(callback).toHaveReturnedWith([]);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 0, false);
    });
    expect(callback).toHaveReturnedWith([{ rowIndex: 0, colIndex: 0 }]);
    act(() => {
      // No actual change in selected cells, just re-triggering selection logic
      selectionStore.getState().startOrMoveSelection(0, 0, false);
    });
    // only the initial render should be present
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

describe("useSelectIsCellSelected", () => {
  beforeEach(() => {
    act(() => {
      selectionStore.getState().clearSelection();
    });
  });

  it("returns false when no cell is selected", () => {
    const { result } = renderHook(() => useSelectIsCellSelected(1, 1));
    expect(result.current).toBe(false);
  });

  it("returns true only for the selected cell", () => {
    act(() => {
      selectionStore.getState().setSelectedCell({ rowIndex: 2, colIndex: 3 });
    });
    const { result: selected } = renderHook(() =>
      useSelectIsCellSelected(2, 3)
    );
    const { result: notSelected } = renderHook(() =>
      useSelectIsCellSelected(1, 1)
    );
    expect(selected.current).toBe(true);
    expect(notSelected.current).toBe(false);
  });

  it("only updates when the selected cell changes", () => {
    const callback = vi.fn(() => useSelectIsCellSelected(0, 0));
    renderHook(callback);
    expect(callback).toHaveReturnedWith(false);
    act(() => {
      selectionStore.getState().setSelectedCell({ rowIndex: 0, colIndex: 0 });
    });
    expect(callback).toHaveReturnedWith(true);
    act(() => {
      // Setting the same cell again should not trigger another update
      selectionStore.getState().setSelectedCell({ rowIndex: 0, colIndex: 0 });
    });
    expect(callback).toHaveBeenCalledTimes(2);
    act(() => {
      selectionStore.getState().setSelectedCell({ rowIndex: 1, colIndex: 1 });
    });
    expect(callback).toHaveReturnedWith(false);
  });
});

describe("useSelectIsCellInSelection", () => {
  beforeEach(() => {
    act(() => {
      selectionStore.getState().clearSelection();
    });
  });

  it("returns false when no selection area is set", () => {
    const { result } = renderHook(() => useSelectIsCellInSelection(0, 0));
    expect(result.current).toBe(false);
  });

  it("returns true for all cells in the selection area", () => {
    act(() => {
      selectionStore.getState().startOrMoveSelection(1, 1, false);
      selectionStore.getState().startOrMoveSelection(2, 2, true);
    });
    const inArea = renderHook(() => useSelectIsCellInSelection(1, 1));
    const inArea2 = renderHook(() => useSelectIsCellInSelection(2, 2));
    const inArea3 = renderHook(() => useSelectIsCellInSelection(1, 2));
    const outArea = renderHook(() => useSelectIsCellInSelection(0, 0));
    expect(inArea.result.current).toBe(true);
    expect(inArea2.result.current).toBe(true);
    expect(inArea3.result.current).toBe(true);
    expect(outArea.result.current).toBe(false);
  });

  it("only updates when the selection area changes", () => {
    const callback = vi.fn(() => useSelectIsCellInSelection(0, 0));
    renderHook(callback);
    expect(callback).toHaveReturnedWith(false);
    act(() => {
      selectionStore.getState().startOrMoveSelection(0, 0, false);
      selectionStore.getState().startOrMoveSelection(0, 0, true);
    });
    expect(callback).toHaveReturnedWith(true);
    act(() => {
      // Moving selection to the same area should not trigger another update
      selectionStore.getState().startOrMoveSelection(0, 0, true);
    });
    expect(callback).toHaveBeenCalledTimes(2);
    act(() => {
      selectionStore.getState().startOrMoveSelection(1, 1, true);
    });
    expect(callback).toHaveReturnedWith(false); // (0,0) is no longer in selection
  });
});
