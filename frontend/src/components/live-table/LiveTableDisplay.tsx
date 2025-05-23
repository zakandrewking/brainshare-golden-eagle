"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

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
  } = useLiveTable();

  const selectedCell = useSelectionStore((state) => state.selectedCell);
  const moveSelection = useSelectionStore((state) => state.moveSelection);
  const endSelection = useSelectionStore((state) => state.endSelection);
  const clearSelection = useSelectionStore((state) => state.clearSelection);
  const isSelecting = useSelectionStore((state) => state.isSelecting);

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
            <tr>
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
                        >
                          {header}
                          {/* {sortConfig?.key === header && (
                            <span className="ml-2">
                              {sortConfig.direction === "asc" ? (
                                <ArrowUp className="h-4 w-4" />
                              ) : (
                                <ArrowDown className="h-4 w-4" />
                              )}
                            </span>
                          )} */}
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
