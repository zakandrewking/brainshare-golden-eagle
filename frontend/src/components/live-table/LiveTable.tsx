"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";

export interface CursorInfo {
  user?: { name: string; color: string };
}

export interface CursorDataForCell {
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
  /** A map of header names to their desired widths in pixels. */
  columnWidths: Record<string, number>;
  /** Callback triggered when a column is resized. */
  onColumnResize: (header: string, newWidth: number) => void;
}

const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 50;

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
  columnWidths,
  onColumnResize,
}) => {
  const [resizingHeader, setResizingHeader] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null); // Ref for the table element

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

  const handleMouseDown = useCallback(
    (
      event:
        | React.MouseEvent<HTMLDivElement>
        | React.TouchEvent<HTMLDivElement>,
      header: string
    ) => {
      event.preventDefault();
      event.stopPropagation(); // Prevent text selection/other interactions

      const currentWidth = columnWidths[header] ?? DEFAULT_COL_WIDTH;
      const pageX = "touches" in event ? event.touches[0].pageX : event.pageX;

      setResizingHeader(header);
      setStartX(pageX);
      setStartWidth(currentWidth);
    },
    [columnWidths]
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (!resizingHeader) return;

      const pageX = "touches" in event ? event.touches[0].pageX : event.pageX;
      const deltaX = pageX - startX;
      let newWidth = startWidth + deltaX;

      newWidth = Math.max(MIN_COL_WIDTH, newWidth); // Enforce minimum width

      // Update visual width directly for smoothness (optional, could use state)
      const thElement = tableRef.current?.querySelector(
        `th[data-header="${resizingHeader}"]`
      );
      if (thElement) {
        (thElement as HTMLElement).style.width = `${newWidth}px`;
        (thElement as HTMLElement).style.minWidth = `${newWidth}px`;
        (thElement as HTMLElement).style.maxWidth = `${newWidth}px`;
      }
    },
    [resizingHeader, startX, startWidth]
  );

  const handleMouseUp = useCallback(() => {
    if (!resizingHeader) return;

    // Calculate final width based on the visually updated element
    const thElement = tableRef.current?.querySelector(
      `th[data-header="${resizingHeader}"]`
    );
    if (thElement) {
      const finalWidth = Math.max(
        MIN_COL_WIDTH,
        parseInt((thElement as HTMLElement).style.width, 10)
      );
      onColumnResize(resizingHeader, finalWidth);
    }

    setResizingHeader(null);
  }, [resizingHeader, onColumnResize]);

  // Add/Remove global listeners for mouse move and up during resize
  useEffect(() => {
    if (!resizingHeader) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove);
    document.addEventListener("touchend", handleMouseUp);

    // Style body to prevent text selection during drag
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleMouseMove);
      document.removeEventListener("touchend", handleMouseUp);

      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [resizingHeader, handleMouseMove, handleMouseUp]);

  return (
    <table
      ref={tableRef}
      className="table-fixed border-collapse border border-slate-400 relative w-full"
      style={{ tableLayout: "fixed" }} // Use fixed layout for predictable width control
    >
      <thead>
        <tr>
          {headers.map((header, index) => {
            const width = columnWidths[header] ?? DEFAULT_COL_WIDTH;
            return (
              <th
                key={`${header}-${index}`}
                data-header={header} // Add data attribute for querying
                className="border border-slate-300 p-0 text-left relative group overflow-hidden whitespace-nowrap"
                style={{
                  width: `${width}px`,
                  minWidth: `${width}px`, // Set min/max to prevent unexpected wrapping/shrinking
                  maxWidth: `${width}px`,
                }}
              >
                <div className="flex items-center justify-between h-full">
                  {editingHeaderIndex === index ? (
                    <Input
                      type="text"
                      value={editingHeaderValue}
                      onChange={onHeaderChange}
                      onBlur={onHeaderBlur}
                      onKeyDown={onHeaderKeyDown}
                      autoFocus
                      className="flex-grow h-full p-2 border-none focus:outline-none m-0 block bg-transparent"
                    />
                  ) : (
                    <div
                      className="p-2 cursor-text truncate flex-grow"
                      onDoubleClick={() => onHeaderDoubleClick(index)} // Change to double click
                    >
                      {header}
                    </div>
                  )}
                  {/* Resize Handle */}
                  <div
                    className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize bg-transparent group-hover:bg-blue-200 ${
                      resizingHeader === header ? "bg-blue-400" : ""
                    }`}
                    onMouseDown={(e) => handleMouseDown(e, header)}
                    onTouchStart={(e) => handleMouseDown(e, header)}
                  />
                </div>
              </th>
            );
          })}
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
                    onChange={(e) =>
                      onCellChange(rowIndex, header, e.target.value)
                    }
                    onFocus={() => onCellFocus(rowIndex, colIndex)}
                    onBlur={onCellBlur}
                    className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-transparent"
                    style={{ width: "100%" }} // Ensure input fills the td
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
