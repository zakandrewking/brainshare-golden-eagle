"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useSelectionStore } from "@/stores/selectionStore";

import { DelayedLoadingSpinner } from "../ui/loading";
import { useLiveTable } from "./LiveTableProvider";
import TableCell from "./TableCell";

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
const ROW_NUMBER_COL_WIDTH = 50;

const LiveTable: React.FC = () => {
  const {
    isTableLoaded,
    tableData,
    headers,
    columnWidths,
    editingHeaderIndex,
    editingHeaderValue,
    handleHeaderDoubleClick,
    handleHeaderChange,
    handleHeaderBlur,
    handleHeaderKeyDown,
    handleColumnResize,
    reorderColumn,
  } = useLiveTable();

  const selectedCell = useSelectionStore((state) => state.selectedCell);
  const moveSelection = useSelectionStore((state) => state.moveSelection);
  const endSelection = useSelectionStore((state) => state.endSelection);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const isSelecting = useSelectionStore((state) => state.isSelecting);

  const [resizingHeader, setResizingHeader] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [dragInsertPosition, setDragInsertPosition] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleColumnDragStart = useCallback(
    (event: React.DragEvent, columnIndex: number) => {
      setDraggedColumnIndex(columnIndex);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", columnIndex.toString());

      // Add visual feedback
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.style.opacity = "0.5";
      }
    },
    []
  );

  const handleColumnDragEnd = useCallback(
    (event: React.DragEvent) => {
      setDraggedColumnIndex(null);
      setDragInsertPosition(null);

      // Reset visual feedback
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.style.opacity = "1";
      }
    },
    []
  );

  const handleColumnDragOver = useCallback(
    (event: React.DragEvent, columnIndex: number) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";

      if (draggedColumnIndex === null || draggedColumnIndex === columnIndex) {
        return;
      }

      // Calculate which side of the column we're closer to
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const mouseX = event.clientX;
      const columnCenter = rect.left + rect.width / 2;

      let insertPosition: number;
      if (mouseX < columnCenter) {
        // Insert before this column
        insertPosition = columnIndex;
      } else {
        // Insert after this column
        insertPosition = columnIndex + 1;
      }

      setDragInsertPosition(insertPosition);
    },
    [draggedColumnIndex]
  );

  const handleColumnDragLeave = useCallback(
    (event: React.DragEvent) => {
      // Only clear if we're leaving the header entirely
      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
        setDragInsertPosition(null);
      }
    },
    []
  );

  const handleColumnDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const draggedIndex = draggedColumnIndex;

      if (draggedIndex !== null && dragInsertPosition !== null) {
        // Convert insertion position to final position index
        // dragInsertPosition is where we want to insert in the current array
        // But reorderColumn expects the final position after the move
        let targetIndex = dragInsertPosition;

        // If we're moving to the right and the insertion position is after the dragged element,
        // we need to subtract 1 because after removing the dragged element,
        // all positions to the right shift left by 1
        if (dragInsertPosition > draggedIndex) {
          targetIndex = dragInsertPosition - 1;
        }

        // Only reorder if the target position is different from current position
        if (targetIndex !== draggedIndex && targetIndex >= 0) {
          reorderColumn(draggedIndex, targetIndex);
        }
      }

      setDraggedColumnIndex(null);
      setDragInsertPosition(null);
    },
    [draggedColumnIndex, dragInsertPosition, reorderColumn]
  );

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
        moveSelection(rowIndex, colIndex);
      }
    };

    const handleGlobalMouseUp = () => {
      endSelection();
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isSelecting, moveSelection, endSelection]);

  // Effect to handle clicks outside the table
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableRef.current &&
        !tableRef.current.contains(event.target as Node) &&
        selectedCell
      ) {
        clearSelection();
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [selectedCell, clearSelection, tableRef]);

  if (!isTableLoaded) {
    return <DelayedLoadingSpinner />;
  }

  return (
    <div className="overflow-x-auto overscroll-none h-full">
      <div className="w-max min-w-full">
        <table
          ref={tableRef}
          className="table-fixed border-collapse border border-slate-400 relative"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr
              onDragOver={(e) => {
                e.preventDefault();
                // Handle drag over the header row itself (for dropping at the end)
                if (draggedColumnIndex !== null && headers) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const mouseX = e.clientX;

                  // If we're past the last column, set insert position to end
                  if (mouseX > rect.right - 50) { // 50px buffer
                    setDragInsertPosition(headers.length);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();

                // Only handle drops that are specifically on the header row itself, not on column headers
                // Check if the drop target is a column header (th element with data-header attribute)
                const isColumnHeaderDrop = (e.target as HTMLElement).closest('th[data-header]');
                if (isColumnHeaderDrop) {
                  return;
                }

                // Handle drop on the header row (for end position)
                if (draggedColumnIndex !== null && dragInsertPosition !== null) {
                  const targetIndex = dragInsertPosition;

                  if (targetIndex !== draggedColumnIndex && targetIndex >= 0) {
                    reorderColumn(draggedColumnIndex, targetIndex);
                  }
                }

                setDraggedColumnIndex(null);
                setDragInsertPosition(null);
              }}
            >
              <th
                className="border border-slate-300 p-0 text-center"
                style={{
                  width: `${ROW_NUMBER_COL_WIDTH}px`,
                  minWidth: `${ROW_NUMBER_COL_WIDTH}px`,
                  maxWidth: `${ROW_NUMBER_COL_WIDTH}px`,
                  verticalAlign: "top",
                }}
              ></th>
              {headers?.map((header, index) => {
                const width = columnWidths?.[header] ?? DEFAULT_COL_WIDTH;
                const isEditing = editingHeaderIndex === index;
                const isDragging = draggedColumnIndex === index;
                const showInsertBefore = dragInsertPosition === index;
                const showInsertAfter = dragInsertPosition === index + 1;
                return (
                  <th
                    key={`${header}-${index}`}
                    data-header={header}
                    draggable={!isEditing}
                    onDragStart={(e) => handleColumnDragStart(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDragLeave={handleColumnDragLeave}
                    onDrop={handleColumnDrop}
                    className={`border border-slate-300 p-0 text-left relative group overflow-hidden ${
                      isDragging ? "opacity-50" : ""
                    }`}
                    style={{
                      width: `${width}px`,
                      minWidth: `${width}px`,
                      maxWidth: `${width}px`,
                      verticalAlign: "top",
                      cursor: isEditing ? "text" : "grab",
                    }}
                  >
                    {/* Insert indicator before column */}
                    {showInsertBefore && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 z-10" />
                    )}
                    {/* Insert indicator after column */}
                    {showInsertAfter && (
                      <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 z-10" />
                    )}
                    <div className="flex items-start justify-between">
                      {isEditing ? (
                        <Input
                          type="text"
                          value={editingHeaderValue}
                          onChange={handleHeaderChange}
                          onBlur={handleHeaderBlur}
                          onKeyDown={handleHeaderKeyDown}
                          autoFocus
                          className="flex-grow h-full p-2 border-none focus:outline-none m-0 block bg-transparent"
                          data-testid={`${header}-editing`}
                        />
                      ) : (
                        <div
                          className="p-2 cursor-text flex-grow break-words flex items-center"
                          onDoubleClick={() => handleHeaderDoubleClick(index)}
                          style={{ cursor: "grab" }}
                          onMouseDown={(e) => {
                            // Prevent drag when clicking on resize handle
                            if ((e.target as HTMLElement).closest('.cursor-col-resize')) {
                              e.stopPropagation();
                            }
                          }}
                        >
                          {header}
                        </div>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-50 hover:opacity-100 focus:opacity-100 flex-shrink-0"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Header options</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled>
                            Sort Ascending
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            Sort Descending
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          {/* Insert indicator after the last column */}
          {dragInsertPosition === headers?.length && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-blue-500 z-20"
              style={{
                right: '0px',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          )}
          <tbody>
            {tableData?.map((row, rowIndex) => (
              <tr key={rowIndex}>
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
                  const cellKey = `${rowIndex}-${colIndex}`;
                  return (
                    <TableCell
                      key={cellKey}
                      rowIndex={rowIndex}
                      colIndex={colIndex}
                      header={header}
                      value={row[header]}
                    />
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
