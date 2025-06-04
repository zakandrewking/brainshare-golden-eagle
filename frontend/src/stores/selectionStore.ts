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
  isSelecting: boolean;
  setSelectedCell: (cell: CellPosition | null) => void;
  startSelection: (rowIndex: number, colIndex: number) => void;
  moveSelection: (rowIndex: number, colIndex: number) => void;
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

export const selectionStore = createStore<SelectionState>((set) => ({
  ...initialState,
  setSelectedCell: (cell) => set({ selectedCell: cell }),
  startSelection: (rowIndex, colIndex) =>
    set({
      selectedCell: { rowIndex, colIndex },
      selectionArea: {
        startCell: { rowIndex, colIndex },
        endCell: { rowIndex, colIndex },
      },
      isSelecting: true,
    }),
  moveSelection: (rowIndex, colIndex) =>
    set((state) => {
      if (!state.selectionArea.startCell) {
        // If move is called without a start, initiate selection from this point.
        // This can happen if a drag starts outside a designated "start" area but still within a selectable zone.
        return {
          selectedCell: { rowIndex, colIndex },
          selectionArea: {
            startCell: { rowIndex, colIndex },
            endCell: { rowIndex, colIndex },
          },
          isSelecting: true,
        };
      }
      return {
        selectionArea: {
          ...state.selectionArea,
          endCell: { rowIndex, colIndex },
        },
      };
    }),
  endSelection: () => set({ isSelecting: false }),
  clearSelection: () => set({ ...initialState }),
}));

function useSelectionStore(): SelectionState;
function useSelectionStore<T>(selector: (state: SelectionState) => T): T;
function useSelectionStore<T>(selector?: (state: SelectionState) => T) {
  return useStore(selectionStore, selector!);
}

// Selectors

export const useSelectionStart = () =>
  useSelectionStore((state) => state.startSelection);

export const useSelectionMove = () =>
  useSelectionStore((state) => state.moveSelection);

export const useSelectionEnd = () =>
  useSelectionStore((state) => state.endSelection);

export const useIsSelecting = () =>
  useSelectionStore((state) => state.isSelecting);

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

const selectIsCellSelected = (
  state: SelectionState,
  rowIndex: number,
  colIndex: number
): boolean => {
  const selectedCells = selectSelectedCells(state);
  return selectedCells.some(
    (cell) => cell.rowIndex === rowIndex && cell.colIndex === colIndex
  );
};

export const useSelectIsCellSelected = (
  rowIndex: number,
  colIndex: number
): boolean => {
  return useSelectionStore((state) =>
    selectIsCellSelected(state, rowIndex, colIndex)
  );
};

/**
 * @param rowIndex
 * @param colIndex
 * @returns true if the cell is the selected cell (not just in the selection
 * area)
 */
export const useIsSelectedCell = (
  rowIndex: number,
  colIndex: number
): boolean =>
  useSelectionStore(
    (state) =>
      state.selectedCell?.rowIndex === rowIndex &&
      state.selectedCell?.colIndex === colIndex
  );
