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
import { Input } from "@/components/ui/input"; // Keep for header editing
import { DelayedLoadingSpinner } from "../ui/loading";
import { useLiveTable } from "./LiveTableProvider";
import TableRow from "./TableRow"; // Import TableRow

// CursorInfo and CursorDataForCell interfaces remain if used by other parts or for future use
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

const LiveTableDisplay: React.FC = React.memo(() => { // Changed name to LiveTableDisplay
  const {
    isTableLoaded,
    tableData,
    headers,
    columnWidths,
    handleCellChange,
    handleCellFocus, // Keep for cell double click -> focus notification
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
    isCellSelected, // Prop for TableRow
    editingCell, // Prop for TableRow
    setEditingCell, // Prop for TableRow
    clearSelection,
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node) && selectedCell) {
        clearSelection();
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [selectedCell, clearSelection, tableRef]);

  // Cell specific handlers are now passed to TableRow -> TableCell
  // This specific handleCellMouseDown is for initiating selection on the table
  const handleCellMouseDownForSelection = (
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent
  ) => {
    const isCurrentlyEditing =
      editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

    if (isCurrentlyEditing) {
      return;
    }
    event.preventDefault(); // Keep this for selection initiation

    if (editingCell) { // If another cell is being edited, commit/blur it
      setEditingCell(null); 
    }
    // Blur active element if it's not within the clicked cell (now handled in TableCell's own input onBlur)
    // However, we might still want to blur a general active element if it's outside the table input context
    if (
      document.activeElement instanceof HTMLElement &&
      !event.currentTarget.contains(document.activeElement) 
    ) {
       // Potentially problematic if currentTarget is not what's expected,
       // this logic might need refinement or be handled differently with focus scopes.
       // For now, let's assume onBlur on inputs within TableCell handles most cases.
    }

    if (event.shiftKey && selectedCell) {
      handleSelectionMove(rowIndex, colIndex); // Extends selection
    } else {
      handleSelectionStart(rowIndex, colIndex); // Starts new selection
    }
  };
  
  // This specific handleCellDoubleClick is for initiating editing
  const handleCellDoubleClickForEditing = ( 
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent // event is passed but might not be directly used if input focusing is handled in TableCell
  ) => {
    setEditingCell({ rowIndex, colIndex });
    handleCellFocus(rowIndex, colIndex); // Notify provider/context about focus

    // Focusing the input is now primarily handled within TableCell's onDoubleClick or a useEffect based on isEditing
    // However, ensuring the cell is editable and focus is set can be initiated here.
    // The actual input focusing might be better handled in TableCell after it re-renders in editing mode.
  };


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
              <TableRow
                key={`table-row-${rowIndex}`} // Added prefix to key
                rowData={row}
                rowIndex={rowIndex}
                headers={headers}
                columnWidths={columnWidths}
                selectedCell={selectedCell}
                editingCell={editingCell}
                isCellSelected={isCellSelected}
                handleCellMouseDown={handleCellMouseDownForSelection} // Renamed for clarity
                handleCellDoubleClick={handleCellDoubleClickForEditing} // Renamed for clarity
                handleCellChange={handleCellChange} // Passed directly
                handleCellBlur={handleCellBlur} // Passed directly
                setEditingCell={setEditingCell} // Passed directly
                ROW_NUMBER_COL_WIDTH={ROW_NUMBER_COL_WIDTH}
                DEFAULT_COL_WIDTH={DEFAULT_COL_WIDTH}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

LiveTableDisplay.displayName = "LiveTableDisplay"; // Ensure correct component name used for displayName
export default LiveTableDisplay; // Ensure correct component name used for export
