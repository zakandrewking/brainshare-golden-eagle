import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  act,
  renderHook,
} from "@testing-library/react";

import {
  type CellPosition,
  selectIsCellSelected,
  selectSelectedCells,
  useSelectionStore,
} from "@/stores/selectionStore";

describe('useSelectionStore', () => {
  beforeEach(() => {
    act(() => {
      useSelectionStore.getState().clearSelection();
    });
  });

  it('should initialize with the correct initial state', () => {
    const { result } = renderHook(() => useSelectionStore());
    const { selectedCell, selectionArea, isSelecting } = result.current;
    expect(selectedCell).toBeNull();
    expect(selectionArea).toEqual({ startCell: null, endCell: null });
    expect(isSelecting).toBe(false);
  });

  it('setSelectedCell should update selectedCell', () => {
    const { result } = renderHook(() => useSelectionStore());
    const newCell = { rowIndex: 1, colIndex: 1 };
    act(() => {
      result.current.setSelectedCell(newCell);
    });
    expect(result.current.selectedCell).toEqual(newCell);
  });

  it('startSelection should update selectionArea, selectedCell, and isSelecting', () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
    });
    const { selectedCell, selectionArea, isSelecting } = result.current;
    const expectedCell = { rowIndex: 1, colIndex: 1 };
    expect(selectedCell).toEqual(expectedCell);
    expect(selectionArea).toEqual({ startCell: expectedCell, endCell: expectedCell });
    expect(isSelecting).toBe(true);
  });

  it('moveSelection should update selectionArea.endCell', () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
      result.current.moveSelection(2, 2);
    });
    const { selectionArea } = result.current;
    expect(selectionArea.endCell).toEqual({ rowIndex: 2, colIndex: 2 });
  });

  it('moveSelection should start selection if not already started', () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.moveSelection(2, 2); // Called without startSelection
    });
    const { selectedCell, selectionArea, isSelecting } = result.current;
    const expectedCell = { rowIndex: 2, colIndex: 2 };
    expect(selectedCell).toEqual(expectedCell);
    expect(selectionArea).toEqual({ startCell: expectedCell, endCell: expectedCell });
    expect(isSelecting).toBe(true);
  });

  it('endSelection should set isSelecting to false', () => {
    const { result } = renderHook(() => useSelectionStore());
    act(() => {
      result.current.startSelection(1, 1);
      result.current.endSelection();
    });
    expect(result.current.isSelecting).toBe(false);
  });

  it('clearSelection should reset the state', () => {
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

describe('Selection Selectors', () => {
  beforeEach(() => {
    useSelectionStore.setState({
      selectedCell: null,
      selectionArea: { startCell: null, endCell: null },
      isSelecting: false,
    });
  });

  it('selectSelectedCells should return empty array for initial state', () => {
    const selectedCells = selectSelectedCells(useSelectionStore.getState());
    expect(selectedCells).toEqual([]);
  });

  it('selectSelectedCells should return correct cells for a given selection area', () => {
    const state = {
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectionArea: {
        startCell: { rowIndex: 0, colIndex: 0 },
        endCell: { rowIndex: 1, colIndex: 1 },
      },
      isSelecting: true,
      // dummy actions for type compatibility
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    const selectedCells = selectSelectedCells(state);
    const expectedCells: CellPosition[] = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ];
    expect(selectedCells).toEqual(expect.arrayContaining(expectedCells));
    expect(expectedCells).toEqual(expect.arrayContaining(selectedCells));
  });

  it('selectSelectedCells should handle reversed selection (end before start)', () => {
    const state = {
      selectedCell: { rowIndex: 1, colIndex: 1 },
      selectionArea: {
        startCell: { rowIndex: 1, colIndex: 1 },
        endCell: { rowIndex: 0, colIndex: 0 },
      },
      isSelecting: true,
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    const selectedCells = selectSelectedCells(state);
    const expectedCells: CellPosition[] = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ];
    expect(selectedCells).toEqual(expect.arrayContaining(expectedCells));
    expect(expectedCells).toEqual(expect.arrayContaining(selectedCells));
  });

  it('selectIsCellSelected should return false if cell is not selected', () => {
    const state = {
      selectedCell: null,
      selectionArea: { startCell: null, endCell: null },
      isSelecting: false,
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    expect(selectIsCellSelected(state, 0, 0)).toBe(false);
  });

  it('selectIsCellSelected should return true if cell is selected', () => {
    const state = {
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectionArea: {
        startCell: { rowIndex: 0, colIndex: 0 },
        endCell: { rowIndex: 0, colIndex: 0 },
      },
      isSelecting: true,
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    expect(selectIsCellSelected(state, 0, 0)).toBe(true);
  });

  it('selectIsCellSelected should return true for a cell within a larger selection area', () => {
    const state = {
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectionArea: {
        startCell: { rowIndex: 0, colIndex: 0 },
        endCell: { rowIndex: 2, colIndex: 2 },
      },
      isSelecting: true,
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    expect(selectIsCellSelected(state, 1, 1)).toBe(true);
  });

  it('selectIsCellSelected should return false for a cell outside a larger selection area', () => {
    const state = {
      selectedCell: { rowIndex: 0, colIndex: 0 },
      selectionArea: {
        startCell: { rowIndex: 0, colIndex: 0 },
        endCell: { rowIndex: 2, colIndex: 2 },
      },
      isSelecting: true,
      setSelectedCell: () => {},
      startSelection: () => {},
      moveSelection: () => {},
      endSelection: () => {},
      clearSelection: () => {},
    };
    expect(selectIsCellSelected(state, 3, 3)).toBe(false);
  });
});
