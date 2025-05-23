import React, {
  memo,
  useCallback,
} from "react";

import {
  selectIsCellSelected,
  useSelectionStore,
} from "@/stores/selectionStore";

import { useLiveTable } from "./LiveTableProvider";

interface TableCellProps {
  rowIndex: number;
  colIndex: number;
  header: string;
  value: unknown;
  isSelectedCell: boolean;
  isEditingCell: boolean;
  onMouseDown: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
  onDoubleClick: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
}

const TableCell: React.FC<TableCellProps> = memo(({
  rowIndex,
  colIndex,
  header,
  value,
  isSelectedCell,
  isEditingCell,
  onMouseDown,
  onDoubleClick,
}) => {
  const isInSelectionFromStore = useSelectionStore((state) =>
    selectIsCellSelected(state, rowIndex, colIndex)
  );

  const { handleCellChange, handleCellBlur, handleCellFocus, setEditingCell } = useLiveTable();

  const isInSelection = isInSelectionFromStore;

  const handleMouseDownEvent = useCallback((event: React.MouseEvent) => {
    onMouseDown(rowIndex, colIndex, event);
  }, [rowIndex, colIndex, onMouseDown]);

  const handleDoubleClickEvent = useCallback((event: React.MouseEvent) => {
    onDoubleClick(rowIndex, colIndex, event);
  }, [rowIndex, colIndex, onDoubleClick]);

  const handleBlur = useCallback(() => {
    handleCellBlur();
    if (isEditingCell) {
      setEditingCell(null);
    }
  }, [handleCellBlur, isEditingCell, setEditingCell]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleCellChange(rowIndex, header, e.target.value);
  }, [handleCellChange, rowIndex, header]);

  const handleFocus = useCallback(() => {
    handleCellFocus(rowIndex, colIndex);
  }, [handleCellFocus, rowIndex, colIndex]);

  const cellKey = `${rowIndex}-${colIndex}`;

  return (
    <td
      key={cellKey}
      className="border p-0 relative"
      data-row-index={rowIndex}
      data-col-index={colIndex}
      data-selected={isInSelection ? "true" : "false"}
      data-editing={isEditingCell ? "true" : "false"}
      data-testid="table-cell"
      style={{
        boxShadow: isSelectedCell
          ? "inset 0 0 0 2px blue"
          : isInSelection
          ? "inset 0 0 0 1px rgba(59, 130, 246, 0.5)"
          : undefined,
        backgroundColor: isEditingCell
          ? "rgba(255, 255, 200, 0.2)"
          : isInSelection
          ? "rgba(59, 130, 246, 0.1)"
          : undefined,
      }}
      onMouseDown={handleMouseDownEvent}
      onDoubleClick={handleDoubleClickEvent}
    >
      <input
        type="text"
        value={String(value ?? "")}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        className={`w-full h-full p-2 border-none focus:outline-none ${
          isEditingCell
            ? "focus:ring-2 focus:ring-yellow-400"
            : "focus:ring-2 focus:ring-blue-300"
        } bg-transparent`}
      />
    </td>
  );
});

TableCell.displayName = "TableCell";

export default TableCell;
