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
} from "@/stores/selection-store";

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
