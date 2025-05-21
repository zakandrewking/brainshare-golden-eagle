import React from 'react';
import { Input } from "@/components/ui/input";
import { CellPosition } from './LiveTableProvider'; // Assuming CellPosition is exported from LiveTableProvider

// Define props for TableCell
interface TableCellProps {
  cellData: unknown; // Data for this specific cell
  rowIndex: number;
  colIndex: number;
  header: string; // The header key for this cell's column
  columnWidth: number;
  isSelected: boolean; // Is this cell the primary selected cell (e.g., for focus ring)
  isEditing: boolean;
  isInSelectionArea: boolean; // Is this cell part of the broader selection area
  handleCellMouseDown: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
  handleCellDoubleClick: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
  handleCellChange: (rowIndex: number, header: string, newValue: string) => void;
  handleCellBlur: () => void;
  setEditingCell: (cell: CellPosition | null) => void;
}

const TableCell: React.FC<TableCellProps> = React.memo(({
  cellData,
  rowIndex,
  colIndex,
  header,
  columnWidth,
  isSelected,
  isEditing,
  isInSelectionArea,
  handleCellMouseDown,
  handleCellDoubleClick,
  handleCellChange,
  handleCellBlur,
  setEditingCell,
}) => {
  return (
    <td
      className="border p-0 relative"
      data-row-index={rowIndex}
      data-col-index={colIndex}
      data-selected={isInSelectionArea ? "true" : "false"}
      data-editing={isEditing ? "true" : "false"}
      data-testid="table-cell"
      style={{
        width: `${columnWidth}px`,
        minWidth: `${columnWidth}px`,
        maxWidth: `${columnWidth}px`,
        boxShadow: isSelected // Primary selected cell for focus
          ? "inset 0 0 0 2px blue"
          : isInSelectionArea // Part of a selected area
          ? "inset 0 0 0 1px rgba(59, 130, 246, 0.5)"
          : undefined,
        backgroundColor: isEditing
          ? "rgba(255, 255, 200, 0.2)"
          : isInSelectionArea
          ? "rgba(59, 130, 246, 0.1)"
          : undefined,
      }}
      onMouseDown={(e) =>
        handleCellMouseDown(rowIndex, colIndex, e)
      }
      onDoubleClick={(e) =>
        handleCellDoubleClick(rowIndex, colIndex, e)
      }
    >
      <input
        type="text"
        value={String(cellData ?? "")}
        onChange={(e) =>
          handleCellChange(rowIndex, header, e.target.value)
        }
        onBlur={() => {
          handleCellBlur();
          if (isEditing) {
            setEditingCell(null);
          }
        }}
        className={`w-full h-full p-2 border-none focus:outline-none ${
          isEditing
            ? "focus:ring-2 focus:ring-yellow-400" // Editing takes precedence for styling
            : isSelected // Then primary selection
            ? "focus:ring-2 focus:ring-blue-500" // Example: slightly different focus for primary selected
            : "focus:ring-2 focus:ring-blue-300" // Default focus for non-selected/non-editing
        } bg-transparent`}
      />
    </td>
  );
});

TableCell.displayName = 'TableCell';

export default TableCell;
