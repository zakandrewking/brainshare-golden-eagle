"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
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

// Parse image data from cell value (URL or URL|WIDTHxHEIGHT format)
function parseImageData(str: string): {
  url: string;
  width?: number;
  height?: number;
} | null {
  if (!str || typeof str !== "string") return null;

  // Check for URL|dimensions format
  const dimensionMatch = str.match(/^(.+)\|(\d+)x(\d+)$/);
  if (dimensionMatch) {
    const [, url, width, height] = dimensionMatch;
    return {
      url: url.trim(),
      width: parseInt(width, 10),
      height: parseInt(height, 10),
    };
  }

  // Just a URL without dimensions
  return { url: str.trim() };
}

// Utility function to detect if a string is likely an image URL
function isImageUrl(str: string): boolean {
  const parsed = parseImageData(str);
  if (!parsed) return false;

  const url = parsed.url;

  // Check for URL pattern first
  const urlPattern = /^https?:\/\/.+/i;
  if (!urlPattern.test(url)) return false;

  // Check for common image extensions (handles query params and fragments)
  const imageExtensions =
    /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)(\?[^#]*)?(\#.*)?$/i;

  // For direct image URLs
  if (imageExtensions.test(url)) return true;

  // For Wikipedia media URLs (special case)
  const wikipediaMediaPattern =
    /\/wiki\/.*#\/media\/File:.*\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)/i;
  if (wikipediaMediaPattern.test(url)) return true;

  return false;
}

// Utility function to convert URLs to direct image URLs when possible
function getDirectImageUrl(str: string): string {
  const parsed = parseImageData(str);
  if (!parsed) return str;

  const url = parsed.url;

  // Handle Wikipedia media URLs
  const wikipediaMediaMatch = url.match(
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

  return url;
}

// Format image data back to string format
function formatImageData(url: string, width?: number, height?: number): string {
  if (width && height) {
    return `${url}|${width}x${height}`;
  }
  return url;
}

interface ResizableImageProps {
  src: string;
  alt: string;
  initialWidth?: number;
  initialHeight?: number;
  onDoubleClick: (event: React.MouseEvent) => void;
  onError: () => void;
  onLoad: () => void;
  onDimensionsChange: (width: number, height: number) => void;
}

const ResizableImage: React.FC<ResizableImageProps> = ({
  src,
  alt,
  initialWidth,
  initialHeight,
  onDoubleClick,
  onError,
  onLoad,
  onDimensionsChange,
}) => {
  const [dimensions, setDimensions] = useState({
    width: initialWidth || 150,
    height: initialHeight || 100,
  });
  const [isResizing, setIsResizing] = useState(false);
  const [hasLoadedNaturalSize, setHasLoadedNaturalSize] = useState(
    !!initialWidth && !!initialHeight
  );
  const imageRef = useRef<HTMLImageElement>(null);
  const currentDimensionsRef = useRef(dimensions);

  // Keep ref in sync with state
  currentDimensionsRef.current = dimensions;

  // Update dimensions when props change (from other users' updates)
  useEffect(() => {
    if (initialWidth && initialHeight) {
      setDimensions({
        width: initialWidth,
        height: initialHeight,
      });
      setHasLoadedNaturalSize(true);
    }
  }, [initialWidth, initialHeight]);

  // Calculate default dimensions based on natural image size
  const handleImageLoad = useCallback(() => {
    if (!hasLoadedNaturalSize && imageRef.current) {
      const img = imageRef.current;
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;

      if (naturalWidth && naturalHeight) {
        // Calculate dimensions that maintain aspect ratio while fitting in reasonable bounds
        const maxWidth = 200;
        const maxHeight = 150;

        let newWidth = naturalWidth;
        let newHeight = naturalHeight;

        // Scale down if too large, maintaining aspect ratio
        if (newWidth > maxWidth || newHeight > maxHeight) {
          const widthRatio = maxWidth / newWidth;
          const heightRatio = maxHeight / newHeight;
          const ratio = Math.min(widthRatio, heightRatio);

          newWidth = Math.round(newWidth * ratio);
          newHeight = Math.round(newHeight * ratio);
        }

        // Ensure minimum size
        const minWidth = 50;
        const minHeight = 30;
        if (newWidth < minWidth || newHeight < minHeight) {
          const widthRatio = minWidth / newWidth;
          const heightRatio = minHeight / newHeight;
          const ratio = Math.max(widthRatio, heightRatio);

          newWidth = Math.round(newWidth * ratio);
          newHeight = Math.round(newHeight * ratio);
        }

        setDimensions({ width: newWidth, height: newHeight });
        setHasLoadedNaturalSize(true);

        // If this is the initial load without stored dimensions, save the calculated size
        if (!initialWidth && !initialHeight) {
          onDimensionsChange(newWidth, newHeight);
        }
      }
    }
    onLoad();
  }, [
    hasLoadedNaturalSize,
    initialWidth,
    initialHeight,
    onLoad,
    onDimensionsChange,
  ]);

  const handleResizeStart = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const startPosition = { x: event.clientX, y: event.clientY };
      const startDims = dimensions;

      setIsResizing(true);

      const handleMouseMove = (e: MouseEvent) => {
        const deltaX = e.clientX - startPosition.x;

        // Calculate new dimensions maintaining aspect ratio
        const aspectRatio = startDims.width / startDims.height;
        let newWidth = Math.max(50, startDims.width + deltaX);
        let newHeight = newWidth / aspectRatio;

        // Apply constraints
        newWidth = Math.min(400, Math.max(50, newWidth));
        newHeight = Math.min(300, Math.max(30, newHeight));

        const newDimensions = { width: newWidth, height: newHeight };
        currentDimensionsRef.current = newDimensions;
        setDimensions(newDimensions);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        // Call the callback with final dimensions from ref (rounded to avoid decimals)
        onDimensionsChange(
          Math.round(currentDimensionsRef.current.width),
          Math.round(currentDimensionsRef.current.height)
        );
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [dimensions, onDimensionsChange]
  );

  return (
    <div className="relative inline-block group">
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        className="object-contain rounded cursor-pointer"
        style={{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
        onError={onError}
        onLoad={handleImageLoad}
        onDoubleClick={onDoubleClick}
        draggable={false}
      />
      {/* Resize handle */}
      <div
        className={`absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity ${
          isResizing ? "opacity-100" : ""
        }`}
        style={{
          background:
            "linear-gradient(-45deg, transparent 30%, #3b82f6 30%, #3b82f6 70%, transparent 70%)",
          borderRadius: "0 0 4px 0",
        }}
        onMouseDown={handleResizeStart}
        title="Drag to resize"
      />
      {/* Visual feedback during resize */}
      {isResizing && (
        <div className="absolute -top-8 left-0 bg-black text-white text-xs px-2 py-1 rounded pointer-events-none">
          {Math.round(dimensions.width)}×{Math.round(dimensions.height)}
        </div>
      )}
    </div>
  );
};

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
  const imageData = isImage ? parseImageData(stringValue) : null;

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

      // Find and focus the textarea inside the current cell
      const cell = event.currentTarget as HTMLElement;
      if (cell) {
        const textareaElement = cell.querySelector("textarea");
        if (textareaElement) {
          textareaElement.focus();
          // Position cursor at the end of the text
          textareaElement.setSelectionRange(
            textareaElement.value.length,
            textareaElement.value.length
          );
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

  const handleImageDimensionsChange = useCallback(
    (width: number, height: number) => {
      if (!isCellLocked && imageData) {
        const newValue = formatImageData(imageData.url, width, height);
        handleCellChange(rowIndex, header, newValue);
      }
    },
    [isCellLocked, imageData, handleCellChange, rowIndex, header]
  );

  const cellContentElement = isEditing ? (
    <textarea
      value={stringValue}
      onChange={(e) => {
        // Don't allow changes to locked cells
        if (!isCellLocked) {
          handleCellChange(rowIndex, header, e.target.value);
        }
      }}
      onBlur={() => {
        setEditingCell(null);
      }}
      className={`w-full h-full p-2 border-none focus:outline-none text-base resize-none ${
        isCellLocked
          ? "bg-gray-300 dark:bg-gray-700"
          : "focus:ring-2 focus:ring-yellow-400"
      } bg-transparent`}
      style={{
        minHeight: "2.5rem",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        whiteSpace: "pre-wrap",
      }}
      autoFocus
    />
  ) : (
    <div
      className={`w-full h-full p-2 text-base break-words whitespace-pre-wrap cursor-text ${
        isCellLocked
          ? "bg-gray-300 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
          : "bg-transparent"
      }`}
      style={{
        minHeight: "2.5rem",
        wordBreak: "break-word",
        overflowWrap: "break-word",
      }}
    >
      {stringValue || "\u00A0"}
    </div>
  );

  const imageElement = (
    <div className="w-full h-full p-2 flex items-center justify-center">
      <ResizableImage
        src={getDirectImageUrl(stringValue)}
        alt="Cell content"
        initialWidth={imageData?.width}
        initialHeight={imageData?.height}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onDoubleClick={handleCellDoubleClick}
        onDimensionsChange={handleImageDimensionsChange}
      />
    </div>
  );

  const cellContent = isImage ? imageElement : cellContentElement;

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
        minHeight: isImage ? "120px" : "auto",
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
