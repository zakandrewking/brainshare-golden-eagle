"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  useColumnWidths,
  useEditingHeaderIndex,
  useHandleColumnResize,
  useHandleHeaderBlur,
  useHandleHeaderChange,
  useHandleHeaderDoubleClick,
  useHeaders,
  useIsTableLoaded,
  useReorderColumn,
  useSetEditingHeaderIndex,
  useSetTableRef,
  useSortByColumn,
  useTableData,
} from "@/stores/dataStore";

import { DelayedLoadingSpinner } from "../ui/loading";
import TableCell from "./TableCell";
import TableHeader from "./TableHeader";

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
  const isTableLoaded = useIsTableLoaded();
  const tableData = useTableData();
  const headers = useHeaders();
  const columnWidths = useColumnWidths();

  const editingHeaderIndex = useEditingHeaderIndex();
  const handleHeaderChange = useHandleHeaderChange();
  const handleHeaderBlur = useHandleHeaderBlur();
  const handleHeaderDoubleClick = useHandleHeaderDoubleClick();
  const setEditingHeaderIndex = useSetEditingHeaderIndex();
  const handleColumnResize = useHandleColumnResize();
  const setTableRef = useSetTableRef();

  const reorderColumn = useReorderColumn();
  const sortByColumn = useSortByColumn();

  const [resizingHeader, setResizingHeader] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(
    null
  );
  const [dragInsertPosition, setDragInsertPosition] = useState<number | null>(
    null
  );
  const tableRef = useRef<HTMLTableElement>(null);
  const lastTapTimeRef = useRef(0);
  const lastTapTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    setTableRef(tableRef);
  }, [setTableRef, tableRef]);

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

  const handleColumnDragEnd = useCallback((event: React.DragEvent) => {
    setDraggedColumnIndex(null);
    setDragInsertPosition(null);

    // Reset visual feedback
    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.style.opacity = "1";
    }
  }, []);

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

  const handleColumnDragLeave = useCallback((event: React.DragEvent) => {
    // Only clear if we're leaving the header entirely
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragInsertPosition(null);
    }
  }, []);

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

  const handleHeaderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleHeaderBlur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditingHeaderIndex(null);
        handleHeaderBlur();
      }
    },
    [handleHeaderBlur, setEditingHeaderIndex]
  );

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
                  if (mouseX > rect.right - 50) {
                    // 50px buffer
                    setDragInsertPosition(headers.length);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();

                // Only handle drops that are specifically on the header row itself, not on column headers
                // Check if the drop target is a column header (th element with data-header attribute)
                const isColumnHeaderDrop = (e.target as HTMLElement).closest(
                  "th[data-header]"
                );
                if (isColumnHeaderDrop) {
                  return;
                }

                // Handle drop on the header row (for end position)
                if (
                  draggedColumnIndex !== null &&
                  dragInsertPosition !== null
                ) {
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
                  <TableHeader
                    key={`${header}-${index}`}
                    header={header}
                    index={index}
                    width={width}
                    isEditing={isEditing}
                    handleHeaderChange={handleHeaderChange}
                    handleHeaderBlur={handleHeaderBlur}
                    handleHeaderKeyDown={handleHeaderKeyDown}
                    handleHeaderDoubleClick={handleHeaderDoubleClick}
                    lastTapTimeRef={lastTapTimeRef}
                    lastTapTargetRef={lastTapTargetRef}
                    sortByColumn={sortByColumn}
                    handleColumnDragStart={handleColumnDragStart}
                    handleColumnDragEnd={handleColumnDragEnd}
                    handleColumnDragOver={handleColumnDragOver}
                    handleColumnDragLeave={handleColumnDragLeave}
                    handleColumnDrop={handleColumnDrop}
                    isDragging={isDragging}
                    showInsertBefore={showInsertBefore}
                    showInsertAfter={showInsertAfter}
                    resizingHeader={resizingHeader}
                    handleMouseDown={handleMouseDown}
                  />
                );
              })}
            </tr>
          </thead>
          {/* Insert indicator after the last column */}
          {dragInsertPosition === headers?.length && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-blue-500 z-20"
              style={{
                right: "0px",
                height: "100%",
                pointerEvents: "none",
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
