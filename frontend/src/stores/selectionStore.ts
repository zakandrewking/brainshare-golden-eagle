import { createStore, useStore } from "zustand";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export interface SelectionArea {
  startCell: CellPosition | null;
  endCell: CellPosition | null;
}

export interface SelectionState {
  selectedCell: CellPosition | null;
  selectionArea: SelectionArea;
  // true if the user is currently dragging to select cells
  isSelecting: boolean;
  setSelectedCell: (cell: CellPosition | null) => void;
  setSelectionRange: (startCell: CellPosition, endCell: CellPosition) => void;
  startOrMoveSelection: (
    rowIndex: number,
    colIndex: number,
    shiftKey: boolean
  ) => void;
  endSelection: () => void;
  clearSelection: () => void;
}

const initialState: Pick<
  SelectionState,
  "selectedCell" | "selectionArea" | "isSelecting"
> = {
  selectedCell: null,
  selectionArea: { startCell: null, endCell: null },
  isSelecting: false,
};

export const selectionStore = createStore<SelectionState>((set, get) => ({
  ...initialState,
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  setSelectionRange: (startCell, endCell) =>
    set({
      selectedCell: startCell,
      selectionArea: { startCell, endCell },
      isSelecting: false,
    }),
  startOrMoveSelection: (rowIndex, colIndex, shiftKeyOrDrag) => {
    const { selectionArea } = get();
    if (shiftKeyOrDrag && selectionArea !== null) {
      // move selection
      if (!selectionArea.startCell) {
        // If move is called without a start, initiate selection from this point.
        // This can happen if a drag starts outside a designated "start" area but still within a selectable zone.
        set({
          selectedCell: { rowIndex, colIndex },
          selectionArea: {
            startCell: { rowIndex, colIndex },
            endCell: { rowIndex, colIndex },
          },
          isSelecting: true,
        });
        return;
      }
      set({
        selectionArea: {
          ...selectionArea,
          endCell: { rowIndex, colIndex },
        },
      });
    } else {
      // start
      set({
        selectedCell: { rowIndex, colIndex },
        selectionArea: {
          startCell: { rowIndex, colIndex },
          endCell: { rowIndex, colIndex },
        },
        isSelecting: true,
      });
    }
  },
  endSelection: () => set({ isSelecting: false }),
  clearSelection: () => set({ ...initialState }),
}));

function useSelectionStore(): SelectionState;
function useSelectionStore<T>(selector: (state: SelectionState) => T): T;
function useSelectionStore<T>(selector?: (state: SelectionState) => T) {
  return useStore(selectionStore, selector!);
}

// Selectors

export const useSelectionStartOrMove = () =>
  useSelectionStore((state) => state.startOrMoveSelection);

export const useSelectionEnd = () =>
  useSelectionStore((state) => state.endSelection);

export const useIsSelecting = () =>
  useSelectionStore((state) => state.isSelecting);

export const useSetSelectionRange = () =>
  useSelectionStore((state) => state.setSelectionRange);

export const useSelectedCell = () =>
  useSelectionStore((state) => state.selectedCell);

export const useClearSelection = () =>
  useSelectionStore((state) => state.clearSelection);

export const useSelectionArea = () =>
  useSelectionStore((state) => state.selectionArea);

export const selectSelectedCells = (state: SelectionState): CellPosition[] => {
  const { selectionArea } = state;
  if (!selectionArea.startCell || !selectionArea.endCell) {
    return [];
  }

  const startRow = Math.min(
    selectionArea.startCell.rowIndex,
    selectionArea.endCell.rowIndex
  );
  const endRow = Math.max(
    selectionArea.startCell.rowIndex,
    selectionArea.endCell.rowIndex
  );
  const startCol = Math.min(
    selectionArea.startCell.colIndex,
    selectionArea.endCell.colIndex
  );
  const endCol = Math.max(
    selectionArea.startCell.colIndex,
    selectionArea.endCell.colIndex
  );

  const cells: CellPosition[] = [];
  for (let rIndex = startRow; rIndex <= endRow; rIndex++) {
    for (let cIndex = startCol; cIndex <= endCol; cIndex++) {
      cells.push({ rowIndex: rIndex, colIndex: cIndex });
    }
  }
  return cells;
};

export const useSelectedCells = () =>
  useStoreWithEqualityFn(selectionStore, selectSelectedCells, (a, b) => {
    const makeSet = (cells: CellPosition[]) => {
      const set = new Set();
      cells.forEach((cell) => {
        set.add(`${cell.rowIndex}-${cell.colIndex}`);
      });
      return set;
    };
    return shallow(makeSet(a), makeSet(b));
  });

export const useSelectIsCellSelected = (
  rowIndex: number,
  colIndex: number
): boolean => {
  return useSelectionStore((state) => {
    const cell = state.selectedCell;
    if (!cell) return false;
    return cell.rowIndex === rowIndex && cell.colIndex === colIndex;
  });
};

export const useSelectIsCellInSelection = (
  rowIndex: number,
  colIndex: number
): boolean => {
  return useSelectionStore((state) => {
    const { selectionArea } = state;
    if (!selectionArea.startCell || !selectionArea.endCell) return false;
    const startRow = Math.min(
      selectionArea.startCell.rowIndex,
      selectionArea.endCell.rowIndex
    );
    const endRow = Math.max(
      selectionArea.startCell.rowIndex,
      selectionArea.endCell.rowIndex
    );
    const startCol = Math.min(
      selectionArea.startCell.colIndex,
      selectionArea.endCell.colIndex
    );
    const endCol = Math.max(
      selectionArea.startCell.colIndex,
      selectionArea.endCell.colIndex
    );
    return (
      rowIndex >= startRow &&
      rowIndex <= endRow &&
      colIndex >= startCol &&
      colIndex <= endCol
    );
  });
};
