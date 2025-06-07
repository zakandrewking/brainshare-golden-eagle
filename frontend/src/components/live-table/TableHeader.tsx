import React from "react";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useEditingHeaderValue } from "@/stores/dataStore";

interface TableHeaderProps {
  header: string;
  index: number;
  width: number;
  isEditing: boolean;
  handleHeaderChange: (value: string) => void;
  handleHeaderBlur: () => void;
  handleHeaderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleHeaderDoubleClick: (index: number) => void;
  lastTapTimeRef: React.RefObject<number>;
  lastTapTargetRef: React.RefObject<EventTarget | null>;
  sortByColumn: (header: string, direction: "asc" | "desc") => void;
  handleColumnDragStart: (event: React.DragEvent, columnIndex: number) => void;
  handleColumnDragEnd: (event: React.DragEvent) => void;
  handleColumnDragOver: (event: React.DragEvent, columnIndex: number) => void;
  handleColumnDragLeave: (event: React.DragEvent) => void;
  handleColumnDrop: (event: React.DragEvent) => void;
  isDragging: boolean;
  showInsertBefore: boolean;
  showInsertAfter: boolean;
  resizingHeader: string | null;
  handleMouseDown: (
    event: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
    header: string
  ) => void;
}

const TableHeader: React.FC<TableHeaderProps> = ({
  header,
  index,
  width,
  isEditing,
  handleHeaderChange,
  handleHeaderBlur,
  handleHeaderKeyDown,
  handleHeaderDoubleClick,
  lastTapTimeRef,
  lastTapTargetRef,
  sortByColumn,
  handleColumnDragStart,
  handleColumnDragEnd,
  handleColumnDragOver,
  handleColumnDragLeave,
  handleColumnDrop,
  isDragging,
  showInsertBefore,
  showInsertAfter,
  resizingHeader,
  handleMouseDown,
}) => {
  const editingHeaderValue = useEditingHeaderValue(index);

  return (
    <th
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
            onChange={(e) => {
              handleHeaderChange(e.target.value);
            }}
            onBlur={handleHeaderBlur}
            onKeyDown={handleHeaderKeyDown}
            autoFocus
            className="flex-grow h-full p-2 border-none focus:outline-none m-0 block bg-transparent"
            data-testid={`${header}-editing`}
          />
        ) : (
          <div
            className="p-2 cursor-text flex-grow break-words flex items-center"
            onDoubleClick={() => {
              handleHeaderDoubleClick(index);
            }}
            onTouchEnd={(e) => {
              const currentTime = new Date().getTime();
              const tapLength = currentTime - lastTapTimeRef.current;
              if (
                tapLength < 300 && // Double tap threshold (300ms)
                tapLength > 0 &&
                lastTapTargetRef.current === e.currentTarget // Ensure taps are on the same element
              ) {
                handleHeaderDoubleClick(index);
                // Prevent zoom on double tap
                e.preventDefault();
              }
              lastTapTimeRef.current = currentTime;
              lastTapTargetRef.current = e.currentTarget;
            }}
            style={{ cursor: "grab" }}
            onMouseDown={(e) => {
              // Prevent drag when clicking on resize handle
              if ((e.target as HTMLElement).closest(".cursor-col-resize")) {
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
            <DropdownMenuItem onSelect={() => sortByColumn(header, "asc")}>
              Sort Ascending
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => sortByColumn(header, "desc")}>
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
};

export default TableHeader;
