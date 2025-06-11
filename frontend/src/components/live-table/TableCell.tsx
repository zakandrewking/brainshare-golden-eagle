"use client";

import React, {
  useCallback,
  useState,
} from "react";

import { TextTooltip } from "@/components/ui/tooltip";
import {
  useFirstUserColorForCell,
  useHasOtherUserCursors,
} from "@/stores/awareness-store";
import {
  useEditingCell,
  useHandleCellChange,
  useIsCellLocked,
  useLockNoteForCell,
  useSetEditingCell,
} from "@/stores/dataStore";
import {
  useSelectionStartOrMove,
  useSelectIsCellInSelection,
  useSelectIsCellSelected,
} from "@/stores/selectionStore";

interface TableCellProps {
  rowIndex: number;
  colIndex: number;
  header: string;
  value: string | unknown;
}

// Utility function to detect if a string is likely an image URL
function isImageUrl(str: string): boolean {
  if (!str || typeof str !== "string") return false;

  // Check for URL pattern first
  const urlPattern = /^https?:\/\/.+/i;
  if (!urlPattern.test(str)) return false;

  // Check for common image extensions (handles query params and fragments)
  const imageExtensions =
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)(\?[^#]*)?(\#.*)?$/i;

  // For direct image URLs
  if (imageExtensions.test(str)) return true;

  // For Wikipedia media URLs (special case)
  const wikipediaMediaPattern =
    /\/wiki\/.*#\/media\/File:.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)/i;
  if (wikipediaMediaPattern.test(str)) return true;

  return false;
}

// Utility function to convert URLs to direct image URLs when possible
function getDirectImageUrl(str: string): string {
  // Handle Wikipedia media URLs
  const wikipediaMediaMatch = str.match(
    /\/wiki\/.*#\/media\/File:(.+\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff))/i
  );
  if (wikipediaMediaMatch) {
    const fileName = wikipediaMediaMatch[1];
    // Note: This is a best-effort approach. Wikipedia's actual image URLs require API calls
    // to get the exact path, but this provides a fallback that often works
    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${fileName.charAt(
      0
    )}/${fileName.substring(0, 2)}/${fileName}/800px-${fileName}`;
  }

  return str;
}

const TableCell: React.FC<TableCellProps> = ({
  rowIndex,
  colIndex,
  header,
  value,
}) => {
  const isCellLocked = useIsCellLocked(rowIndex, colIndex);
  const lockNote = useLockNoteForCell(rowIndex, colIndex);
  const [imageError, setImageError] = useState(false);

  const editingCell = useEditingCell();
  const handleCellChange = useHandleCellChange();
  const setEditingCell = useSetEditingCell();

  const startOrMoveSelection = useSelectionStartOrMove();
  const isSelected = useSelectIsCellSelected(rowIndex, colIndex);
  const isInSelection = useSelectIsCellInSelection(rowIndex, colIndex);

  const hasOtherUserCursors = useHasOtherUserCursors(rowIndex, colIndex);
  const firstUserColor = useFirstUserColorForCell(rowIndex, colIndex);

  const isEditing =
    editingCell?.rowIndex === rowIndex && editingCell?.colIndex === colIndex;

  const stringValue = String(value ?? "");
  const isImage = !isEditing && !imageError && isImageUrl(stringValue);

  // Determine border color based on selection/cursors
  let borderColor = "transparent";
  let borderWidth = "1px";

  if (isSelected) {
    borderColor = "blue";
    borderWidth = "2px";
  } else if (isInSelection) {
    borderColor = "rgba(59, 130, 246, 0.5)";
    borderWidth = "1px";
  } else if (hasOtherUserCursors) {
    // Use the first user's color for the border
    borderColor = firstUserColor ?? "gray";
    borderWidth = "2px";
  }

  const handleCellMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const isCurrentlyEditing =
        editingCell?.rowIndex === rowIndex &&
        editingCell?.colIndex === colIndex;

      if (isCurrentlyEditing) {
        return;
      }
      event.preventDefault();

      if (editingCell) {
        setEditingCell(null);
      }
      if (
        document.activeElement instanceof HTMLElement &&
        !event.currentTarget.contains(document.activeElement)
      ) {
        document.activeElement.blur();
      }

      startOrMoveSelection(rowIndex, colIndex, event.shiftKey);
    },
    [editingCell, rowIndex, colIndex, setEditingCell, startOrMoveSelection]
  );

  const handleCellDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      // Don't allow editing locked cells
      if (isCellLocked) {
        return;
      }

      // First, set the editing state
      setEditingCell({ rowIndex, colIndex });

      // Find and focus the input inside the current cell
      const cell = event.currentTarget as HTMLElement;
      if (cell) {
        const inputElement = cell.querySelector("input");
        if (inputElement) {
          inputElement.focus();
        }
      }
    },
    [rowIndex, colIndex, setEditingCell, isCellLocked]
  );

  const handleImageError = useCallback(() => {
    setImageError(true);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageError(false);
  }, []);

  const inputElement = (
    <input
      type="text"
      value={stringValue}
      onChange={(e) => {
        // Don't allow changes to locked cells
        if (!isCellLocked) {
          handleCellChange(rowIndex, header, e.target.value);
        }
      }}
      onBlur={() => {
        if (isEditing) {
          setEditingCell(null);
        }
      }}
      className={`w-full h-full p-2 border-none focus:outline-none text-base ${
        isCellLocked
          ? "bg-gray-300 dark:bg-gray-700"
          : isEditing
          ? "focus:ring-2 focus:ring-yellow-400"
          : "focus:ring-2 focus:ring-blue-300"
      } bg-transparent`}
    />
  );

  const imageElement = (
    <div className="w-full h-full p-2 flex items-center justify-center">
      <img
        src={getDirectImageUrl(stringValue)}
        alt="Cell content"
        className="max-w-full max-h-full object-contain rounded"
        style={{
          maxHeight: "100px",
          maxWidth: "150px",
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onDoubleClick={handleCellDoubleClick}
      />
    </div>
  );

  const cellContent = isImage ? imageElement : inputElement;

  return (
    <td
      className="border p-0 relative"
      data-row-index={rowIndex}
      data-col-index={colIndex}
      data-selected={isInSelection ? "true" : "false"}
      data-editing={isEditing ? "true" : "false"}
      data-locked={isCellLocked ? "true" : "false"}
      data-testid="table-cell"
      style={{
        boxShadow: `inset 0 0 0 ${borderWidth} ${borderColor}`,
        backgroundColor: isCellLocked
          ? "rgba(128, 128, 128, 0.2)"
          : isEditing
          ? "rgba(255, 255, 200, 0.2)"
          : isInSelection
          ? "rgba(59, 130, 246, 0.1)"
          : hasOtherUserCursors
          ? `${firstUserColor}20` // 20 for low opacity
          : undefined,
        minHeight: isImage ? "80px" : "auto",
      }}
      onMouseDown={handleCellMouseDown}
      onDoubleClick={handleCellDoubleClick}
    >
      {/* If cell is locked and has a note, wrap content with tooltip */}
      {isCellLocked && lockNote ? (
        <TextTooltip text={lockNote}>{cellContent}</TextTooltip>
      ) : (
        cellContent
      )}
    </td>
  );
};

export default TableCell;
