"use client";

import React from "react";

import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CursorInfo {
  user?: { name: string; color: string };
}

interface CursorDataForCell {
  rowIndex: number;
  colIndex: number;
  cursors: CursorInfo[];
}

interface PlanetTableProps {
  /** The header labels for the table columns. */
  headers: string[];
  /** The data rows to display in the table. */
  tableData: Record<string, unknown>[];
  /** The currently selected cell coordinates (row and column index), or null if none. */
  selectedCell: { rowIndex: number; colIndex: number } | null;
  /** The index of the header currently being edited, or null if none. */
  editingHeaderIndex: number | null;
  /** The current value of the header being edited. */
  editingHeaderValue: string;
  /** The color associated with the current user for highlighting their selection. */
  selfColor: string | undefined;
  /** Pre-computed cursor data for each cell containing active cursors. */
  cursorsData: CursorDataForCell[];
  /** Callback triggered when a cell's value changes. */
  onCellChange: (rowIndex: number, header: string, newValue: string) => void;
  /** Callback triggered when a cell gains focus. */
  onCellFocus: (rowIndex: number, colIndex: number) => void;
  /** Callback triggered when a cell loses focus. */
  onCellBlur: () => void;
  /** Callback triggered when a table header is double-clicked. */
  onHeaderDoubleClick: (colIndex: number) => void;
  /** Callback triggered when the value of an editing header changes. */
  onHeaderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback triggered when an editing header loses focus. */
  onHeaderBlur: () => void;
  /** Callback triggered on key down event within an editing header input. */
  onHeaderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const LiveTable: React.FC<PlanetTableProps> = ({
  headers,
  tableData,
  selectedCell,
  editingHeaderIndex,
  editingHeaderValue,
  selfColor,
  cursorsData,
  onCellChange,
  onCellFocus,
  onCellBlur,
  onHeaderDoubleClick,
  onHeaderChange,
  onHeaderBlur,
  onHeaderKeyDown,
}) => {
  // Helper to find cursors for a specific cell from the pre-computed data
  const getCursorsForCell = (
    rowIndex: number,
    colIndex: number
  ): CursorInfo[] => {
    const cellCursors = cursorsData.find(
      (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
    );
    return cellCursors ? cellCursors.cursors : [];
  };

  return (
    <table className="table-auto w-full border-collapse border border-slate-400 relative">
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th
              key={`${header}-${index}`} // Use index for key stability during rename
              className="border border-slate-300 p-0 text-left relative group"
            >
              {editingHeaderIndex === index ? (
                <Input
                  type="text"
                  value={editingHeaderValue}
                  onChange={onHeaderChange} // Use callback prop
                  onBlur={onHeaderBlur} // Use callback prop
                  onKeyDown={onHeaderKeyDown} // Use callback prop
                  autoFocus
                  className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 m-0 block bg-transparent"
                />
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className="p-2 cursor-text truncate"
                      onDoubleClick={() => onHeaderDoubleClick(index)} // Use callback prop
                    >
                      {header}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Double-click to edit header</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {tableData.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {headers.map((header, colIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;
              const cursors = getCursorsForCell(rowIndex, colIndex);
              const isSelectedBySelf =
                selectedCell?.rowIndex === rowIndex &&
                selectedCell?.colIndex === colIndex;

              // Determine border color based on selection/cursors
              let borderColor = "transparent";
              if (isSelectedBySelf) {
                borderColor = String(selfColor ?? "blue"); // Use selfColor prop
              } else if (cursors.length > 0) {
                borderColor = String(cursors[0].user?.color ?? "gray");
              }

              return (
                <td
                  key={cellKey}
                  className="border p-0 relative"
                  style={{
                    boxShadow: `inset 0 0 0 2px ${borderColor}`,
                  }}
                >
                  {/* Render cursor labels */}
                  {cursors.map((cursor, index) => (
                    <div
                      key={index}
                      className="absolute text-xs px-1 rounded text-white"
                      style={{
                        backgroundColor: String(
                          cursor.user?.color ?? "#000000"
                        ),
                        top: `${index * 14}px`,
                        right: "0px",
                        zIndex: 10,
                        pointerEvents: "none",
                      }}
                    >
                      {cursor.user?.name ?? "Anonymous"}
                    </div>
                  ))}
                  <input
                    type="text"
                    value={String(row[header] ?? "")}
                    onChange={
                      (e) => onCellChange(rowIndex, header, e.target.value) // Use callback prop
                    }
                    onFocus={() => onCellFocus(rowIndex, colIndex)} // Use callback prop
                    onBlur={onCellBlur} // Use callback prop
                    className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LiveTable;
