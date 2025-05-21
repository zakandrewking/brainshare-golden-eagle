import React from 'react';
// Remove Input import if no longer directly used here
// import { Input } from "@/components/ui/input"; 
import TableCell from './TableCell'; // Import TableCell
import { CellPosition } from './LiveTableProvider';

// Props remain largely the same, but some might be passed directly to TableCell
interface TableRowProps {
  rowData: Record<string, unknown>;
  rowIndex: number;
  headers: string[];
  columnWidths: Record<string, number> | undefined;
  selectedCell: CellPosition | null;
  editingCell: CellPosition | null;
  isCellSelected: (rowIndex: number, colIndex: number) => boolean; // To determine if cell is in selection area
  handleCellMouseDown: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
  handleCellDoubleClick: (rowIndex: number, colIndex: number, event: React.MouseEvent) => void;
  handleCellChange: (rowIndex: number, header: string, newValue: string) => void;
  handleCellBlur: () => void;
  setEditingCell: (cell: CellPosition | null) => void;
  // Constants for styling, assuming these might be dynamic or from config later
  ROW_NUMBER_COL_WIDTH: number;
  DEFAULT_COL_WIDTH: number;
}

const TableRow: React.FC<TableRowProps> = React.memo(({
  rowData,
  rowIndex,
  headers,
  columnWidths,
  selectedCell,
  editingCell,
  isCellSelected, // This prop helps determine if a cell is part of the general selection area
  handleCellMouseDown,
  handleCellDoubleClick,
  handleCellChange,
  handleCellBlur,
  setEditingCell,
  ROW_NUMBER_COL_WIDTH,
  DEFAULT_COL_WIDTH,
}) => {
  return (
    <tr key={`row-${rowIndex}`}> {/* Added prefix to key for clarity */}
      <td
        className="border border-slate-300 p-0 text-center"
        style={{
          width: `${ROW_NUMBER_COL_WIDTH}px`,
          minWidth: `${ROW_NUMBER_COL_WIDTH}px`,
          maxWidth: `${ROW_NUMBER_COL_WIDTH}px`,
        }}
        data-testid="row-number"
      >
        <div className="p-2 h-full flex items-center justify-center">
          {rowIndex + 1}
        </div>
      </td>
      {headers?.map((header, colIndex) => {
        // Determine if this cell is THE selected cell (for primary selection indication)
        const isPrimarySelected =
          selectedCell?.rowIndex === rowIndex &&
          selectedCell?.colIndex === colIndex;
        // Determine if this cell is being edited
        const isCurrentlyEditing =
          editingCell?.rowIndex === rowIndex &&
          editingCell?.colIndex === colIndex;
        // Determine if this cell is within the general selection area
        const isInSelectionArea = isCellSelected(rowIndex, colIndex);
        const cellWidth = columnWidths?.[header] ?? DEFAULT_COL_WIDTH;

        return (
          <TableCell
            key={`cell-${rowIndex}-${colIndex}`} // Added prefix to key
            cellData={rowData[header]}
            rowIndex={rowIndex}
            colIndex={colIndex}
            header={header}
            columnWidth={cellWidth}
            isSelected={isPrimarySelected}
            isEditing={isCurrentlyEditing}
            isInSelectionArea={isInSelectionArea}
            handleCellMouseDown={handleCellMouseDown}
            handleCellDoubleClick={handleCellDoubleClick}
            handleCellChange={handleCellChange}
            handleCellBlur={handleCellBlur}
            setEditingCell={setEditingCell}
          />
        );
      })}
    </tr>
  );
});

TableRow.displayName = 'TableRow';
export default TableRow;
