"use client";

import React, { useCallback } from "react";

import {
  selectIsCellSelected,
  useSelectionStore,
} from "@/stores/selectionStore";

import { useLiveTable } from "./LiveTableProvider";

interface TableCellProps {
  rowIndex: number;
  colIndex: number;
  header: string;
  value: string | unknown;
}

const TableCell: React.FC<TableCellProps> = ({
  rowIndex,
  colIndex,
  header,
  value,
}) => {
  const {
    editingCell,
    handleCellChange,
    handleCellBlur,
    setEditingCell,
    handleCellFocus,
    isCellLocked,
    getCursorsForCell,
  } = useLiveTable();

  const selectedCell = useSelectionStore((state) => state.selectedCell);
  const startSelection = useSelectionStore((state) => state.startSelection);
  const moveSelection = useSelectionStore((state) => state.moveSelection);
  const isInSelection = useSelectionStore((state) =>
    selectIsCellSelected(state, rowIndex, colIndex)
  );

  const isSelected =
    selectedCell?.rowIndex === rowIndex && selectedCell?.colIndex === colIndex;
  const isEditing =
    editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;
  const isLocked = isCellLocked(rowIndex, colIndex);

  // Get cursors for this cell (other users' selections)
  const cursorsForCell = getCursorsForCell(rowIndex, colIndex);
  const hasOtherUserCursors = cursorsForCell && cursorsForCell.cursors.length > 0;

  // Determine border color based on selection/cursors
  let borderColor = "transparent";
  let borderWidth = "1px";

  if (isSelected) {
    borderColor = "blue";
    borderWidth = "2px";
  } else if (isInSelection) {
    borderColor = "rgba(59, 130, 246, 0.5)";
    borderWidth = "1px";
  } else if (hasOtherUserCursors) {
    // Use the first user's color for the border
    const firstUserColor = cursorsForCell.cursors[0]?.user?.color ?? "gray";
    borderColor = firstUserColor;
    borderWidth = "2px";
  }

  const handleCellMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const isCurrentlyEditing =
        editingCell?.rowIndex === rowIndex &&
        editingCell?.colIndex === colIndex;

      if (isCurrentlyEditing) {
        return;
      }
      event.preventDefault();

      if (editingCell) {
        setEditingCell(null);
      }
      if (
        document.activeElement instanceof HTMLElement &&
        !event.currentTarget.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }

      if (event.shiftKey && selectedCell) {
        moveSelection(rowIndex, colIndex);
      } else {
        startSelection(rowIndex, colIndex);
      }
    },
    [
      editingCell,
      rowIndex,
      colIndex,
      selectedCell,
      setEditingCell,
      moveSelection,
      startSelection,
    ]
  );

  const handleCellDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't allow editing locked cells
      if (isLocked) {
        return;
      }

      // First, set the editing state
      setEditingCell({ rowIndex, colIndex });

      // notify that the cell has focus
      handleCellFocus(rowIndex, colIndex);

      // Find and focus the input inside the current cell
      const cell = event.currentTarget as HTMLElement;
      if (cell) {
        const inputElement = cell.querySelector("input");
        if (inputElement) {
          inputElement.focus();
        }
      }
    },
    [rowIndex, colIndex, setEditingCell, handleCellFocus, isLocked]
  );

  return (
    <td
      className="border p-0 relative"
      data-row-index={rowIndex}
      data-col-index={colIndex}
      data-selected={isInSelection ? "true" : "false"}
      data-editing={isEditing ? "true" : "false"}
      data-locked={isLocked ? "true" : "false"}
      data-testid="table-cell"
      style={{
        boxShadow: `inset 0 0 0 ${borderWidth} ${borderColor}`,
        backgroundColor: isLocked
          ? "rgba(128, 128, 128, 0.2)"
          : isEditing
          ? "rgba(255, 255, 200, 0.2)"
          : isInSelection
          ? "rgba(59, 130, 246, 0.1)"
          : hasOtherUserCursors
          ? `${cursorsForCell.cursors[0]?.user?.color}20` // 20 for low opacity
          : undefined,
      }}
      onMouseDown={handleCellMouseDown}
      onDoubleClick={handleCellDoubleClick}
    >
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => {
          // Don't allow changes to locked cells
          if (!isLocked) {
            handleCellChange(rowIndex, header, e.target.value);
          }
        }}
        onBlur={() => {
          handleCellBlur();
          if (isEditing) {
            setEditingCell(null);
          }
        }}
        className={`w-full h-full p-2 border-none focus:outline-none ${
          isLocked
            ? "bg-gray-300 dark:bg-gray-700"
            : isEditing
            ? "focus:ring-2 focus:ring-yellow-400"
            : "focus:ring-2 focus:ring-blue-300"
        } bg-transparent`}
      />
    </td>
  );
};

export default TableCell;
