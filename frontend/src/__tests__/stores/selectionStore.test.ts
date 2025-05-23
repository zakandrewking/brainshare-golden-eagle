import { beforeEach, describe, expect, it, vi } from "vitest";

import { act, renderHook } from "@testing-library/react";

import {
  type CellPosition,
  selectionStore,
  useSelectedCells,
  useSelectionStore,
} from "@/stores/selectionStore";

describe("useSelectionStore", () => {
  beforeEach(() => {
    act(() => {
      selectionStore.getState().clearSelection();
    });
  });

  it("should initialize with the correct initial state", () => {
    const { result } = renderHook(() => useSelectionStore((state) => state));
    const { selectedCell, selectionArea, isSelecting } = result.current;
    expect(selectedCell).toBeNull();
    expect(selectionArea).toEqual({ startCell: null, endCell: null });
    expect(isSelecting).toBe(false);
  });

  it("setSelectedCell should update selectedCell", () => {
    const { result } = renderHook(() => useSelectionStore());
    const newCell = { rowIndex: 1, colIndex: 1 };
    act(() => {
      result.current.setSelectedCell(newCell);
    });
    expect(result.current.selectedCell).toEqual(newCell);
  });

  it("startSelection should update selectionArea, selectedCell, and isSelecting", () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
    });
    const { selectedCell, selectionArea, isSelecting } = result.current;
    const expectedCell = { rowIndex: 1, colIndex: 1 };
    expect(selectedCell).toEqual(expectedCell);
    expect(selectionArea).toEqual({
      startCell: expectedCell,
      endCell: expectedCell,
    });
    expect(isSelecting).toBe(true);
  });

  it("moveSelection should start selection if not already started", () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.moveSelection(2, 2);
    });
    const { selectedCell, selectionArea, isSelecting } = result.current;
    const expectedCell = { rowIndex: 2, colIndex: 2 };
    expect(selectedCell).toEqual(expectedCell);
    expect(selectionArea).toEqual({
      startCell: expectedCell,
      endCell: expectedCell,
    });
    expect(isSelecting).toBe(true);
  });

  it("endSelection should set isSelecting to false", () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
      result.current.endSelection();
    });
    expect(result.current.isSelecting).toBe(false);
  });

  it("clearSelection should reset the state", () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
      result.current.moveSelection(2, 2);
      result.current.clearSelection();
    });
    const { selectedCell, selectionArea, isSelecting } = result.current;
    expect(selectedCell).toBeNull();
    expect(selectionArea).toEqual({ startCell: null, endCell: null });
    expect(isSelecting).toBe(false);
  });
});

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
      selectionStore.getState().startSelection(0, 0);
      selectionStore.getState().moveSelection(1, 1);
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
      selectionStore.getState().startSelection(0, 0);
    });
    expect(callback).toHaveReturnedWith([{ rowIndex: 0, colIndex: 0 }]);
    act(() => {
      selectionStore.getState().moveSelection(0, 1);
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
      selectionStore.getState().startSelection(0, 0);
      selectionStore.getState().clearSelection();
    });
    expect(result.current).toEqual([]);
  });

  it("should use shallow equality for comparison", () => {
    const callback = vi.fn(() => useSelectedCells());
    renderHook(callback);
    expect(callback).toHaveReturnedWith([]);
    act(() => {
      selectionStore.getState().startSelection(0, 0);
    });
    expect(callback).toHaveReturnedWith([{ rowIndex: 0, colIndex: 0 }]);
    act(() => {
      // No actual change in selected cells, just re-triggering selection logic
      selectionStore.getState().startSelection(0, 0);
    });
    // only the initial render should be present
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
