"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";

import { useLiveTable } from "./LiveTableProvider";

export interface CursorInfo {
  user?: { name: string; color: string };
}

export interface CursorDataForCell {
  rowIndex: number;
  colIndex: number;
  cursors: CursorInfo[];
}

const DEFAULT_COL_WIDTH = 150;
const MIN_COL_WIDTH = 50;

const LiveTable: React.FC = () => {
  const {
    tableData,
    headers,
    columnWidths,
    handleCellChange,
    handleCellFocus,
    handleCellBlur,
    editingHeaderIndex,
    editingHeaderValue,
    handleHeaderDoubleClick,
    handleHeaderChange,
    handleHeaderBlur,
    handleHeaderKeyDown,
    handleColumnResize,
    selectedCell,
    handleSelectionStart,
    handleSelectionMove,
    handleSelectionEnd,
    isSelecting,
    isCellSelected,
    editingCell,
    setEditingCell,
  } = useLiveTable();

  const [resizingHeader, setResizingHeader] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleMouseDown = useCallback(
    (
      event:
        | React.MouseEvent<HTMLDivElement>
        | React.TouchEvent<HTMLDivElement>,
      header: string
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const currentWidth = columnWidths?.[header] ?? DEFAULT_COL_WIDTH;
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

      newWidth = Math.max(MIN_COL_WIDTH, newWidth);

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

    const thElement = tableRef.current?.querySelector(
      `th[data-header="${resizingHeader}"]`
    );
    if (thElement) {
      const finalWidth = Math.max(
        MIN_COL_WIDTH,
        parseInt((thElement as HTMLElement).style.width, 10)
      );
      handleColumnResize(resizingHeader, finalWidth);
    }

    setResizingHeader(null);
  }, [resizingHeader, handleColumnResize]);

  useEffect(() => {
    if (!resizingHeader) return;

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleMouseMove);
    document.addEventListener("touchend", handleMouseUp);

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

  useEffect(() => {
    if (!isSelecting) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!tableRef.current) return;

      if (typeof document.elementFromPoint !== "function") {
        return;
      }

      const cellElement = document.elementFromPoint(
        event.clientX,
        event.clientY
      ) as HTMLElement;

      const cell = cellElement?.closest("td");
      if (!cell) return;

      const rowIndex = parseInt(
        cell.getAttribute("data-row-index") || "-1",
        10
      );
      const colIndex = parseInt(
        cell.getAttribute("data-col-index") || "-1",
        10
      );

      if (rowIndex >= 0 && colIndex >= 0) {
        handleSelectionMove(rowIndex, colIndex);
      }
    };

    const handleGlobalMouseUp = () => {
      handleSelectionEnd();
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isSelecting, handleSelectionMove, handleSelectionEnd]);

  const handleCellMouseDown = (
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent
  ) => {
    const isCurrentlyEditing =
      editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

    if (isCurrentlyEditing) {
      return;
    }

    event.preventDefault();

    handleSelectionStart(rowIndex, colIndex);
  };

  const handleCellDoubleClick = (
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent
  ) => {
    // First, set the editing state
    setEditingCell({ rowIndex, colIndex });

    // notify that the cell has focus
    handleCellFocus(rowIndex, colIndex);

    // Find and focus the input inside the current cell
    const cell = event.currentTarget as HTMLElement;
    if (cell) {
      const inputElement = cell.querySelector("input");
      if (inputElement) {
        setTimeout(() => {
          inputElement.focus();
        }, 0);
      }
    }
  };

  const handleInputMouseDown = (
    event: React.MouseEvent<HTMLInputElement>,
    rowIndex: number,
    colIndex: number
  ) => {
    const isEditingThisCell =
      editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

    if (isEditingThisCell) {
      return; // Allow default behavior when already editing the cell
    }

    // Prevent event bubbling to td element
    event.stopPropagation();
    // Prevent default focus behavior
    event.preventDefault();

    // Call both handlers directly since we're stopping propagation
    handleSelectionStart(rowIndex, colIndex);
  };

  return (
    <div className="overflow-x-auto h-full">
      <div className="w-max min-w-full">
        <table
          ref={tableRef}
          className="table-fixed border-collapse border border-slate-400 relative"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr>
              {headers?.map((header, index) => {
                const width = columnWidths?.[header] ?? DEFAULT_COL_WIDTH;
                return (
                  <th
                    key={`${header}-${index}`}
                    data-header={header}
                    className="border border-slate-300 p-0 text-left relative group overflow-hidden"
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      verticalAlign: "top",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      {editingHeaderIndex === index ? (
                        <Input
                          type="text"
                          value={editingHeaderValue}
                          onChange={handleHeaderChange}
                          onBlur={handleHeaderBlur}
                          onKeyDown={handleHeaderKeyDown}
                          autoFocus
                          className="flex-grow h-full p-2 border-none focus:outline-none m-0 block bg-transparent"
                        />
                      ) : (
                        <div
                          className="p-2 cursor-text flex-grow break-words"
                          onDoubleClick={() => handleHeaderDoubleClick(index)}
                        >
                          {header}
                        </div>
                      )}
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
            {tableData?.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {headers?.map((header, colIndex) => {
                  const cellKey = `${rowIndex}-${colIndex}`;
                  const isSelected =
                    selectedCell?.rowIndex === rowIndex &&
                    selectedCell?.colIndex === colIndex;
                  const isEditing =
                    editingCell?.rowIndex === rowIndex &&
                    editingCell?.colIndex === colIndex;
                  const isInSelection = isCellSelected(rowIndex, colIndex);

                  return (
                    <td
                      key={cellKey}
                      className="border p-0 relative"
                      data-row-index={rowIndex}
                      data-col-index={colIndex}
                      data-selected={isInSelection ? "true" : "false"}
                      data-editing={isEditing ? "true" : "false"}
                      style={{
                        boxShadow: isSelected
                          ? "inset 0 0 0 2px blue"
                          : isInSelection
                          ? "inset 0 0 0 1px rgba(59, 130, 246, 0.5)"
                          : undefined,
                        backgroundColor: isEditing
                          ? "rgba(255, 255, 200, 0.2)"
                          : isInSelection
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
                        value={String(row[header] ?? "")}
                        onChange={(e) =>
                          handleCellChange(rowIndex, header, e.target.value)
                        }
                        onBlur={() => {
                          handleCellBlur();
                          if (isEditing) {
                            setEditingCell(null);
                          }
                        }}
                        onMouseDown={(e) =>
                          handleInputMouseDown(e, rowIndex, colIndex)
                        }
                        className={`w-full h-full p-2 border-none focus:outline-none ${
                          isEditing
                            ? "focus:ring-2 focus:ring-yellow-400"
                            : "focus:ring-2 focus:ring-blue-300"
                        } bg-transparent`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LiveTable;
