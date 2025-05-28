import React, {
  useEffect,
  useState,
  useTransition,
} from "react";

import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  Columns3,
  Download,
  Loader2,
  Redo,
  Rows3,
  Trash2,
  Undo,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectedCells, useSelectionStore } from "@/stores/selectionStore";

import { AiFillSelectionButton } from "./AiFillSelectionButton";
import { useLiveTable } from "./LiveTableProvider";

// Define the possible pending operations
type PendingOperation =
  | "add-row-above"
  | "add-row-below"
  | "add-column-left"
  | "add-column-right"
  | null;

const LiveTableToolbar: React.FC = () => {
  const {
    undoManager,
    isTableLoaded,
    generateAndInsertRows,
    deleteRows,
    generateAndInsertColumns,
    deleteColumns,
    headers,
    tableData,
  } = useLiveTable();

  const selectedCell = useSelectionStore((state) => state.selectedCell);
  const selectedCells = useSelectedCells();

  const [isPending, startTransition] = useTransition();
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const isTableEmptyOfRows = !tableData || tableData.length === 0;
  // For disabling buttons, check for any pending operations
  const isAnyOperationPending = isPending && pendingOperation !== null;

  const getUniqueSelectedColumnIndices = (): number[] => {
    if (!selectedCells || selectedCells.length === 0) {
      if (selectedCell) return [selectedCell.colIndex];
      return [];
    }
    const uniqueIndices = [
      ...new Set(selectedCells.map((cell) => cell.colIndex)),
    ];
    return uniqueIndices.sort((a, b) => a - b);
  };

  const getSelectedRowIndices = (): number[] => {
    if (!selectedCells || selectedCells.length === 0) {
      if (selectedCell) {
        return [selectedCell.rowIndex];
      }
      return [];
    }
    const uniqueIndices = [
      ...new Set(selectedCells.map((cell) => cell.rowIndex)),
    ];
    return uniqueIndices.sort((a, b) => a - b);
  };

  const handleAddRowRelative = (direction: "above" | "below") => {
    if (!isTableLoaded || isAnyOperationPending) return;
    if (!headers || headers.length === 0) {
      toast.info("Cannot add rows: No columns are defined yet.");
      return;
    }

    let numRowsToAdd = 1;
    let initialInsertIndex: number;

    const currentIsTableEmptyOfRows = !tableData || tableData.length === 0;

    if (!currentIsTableEmptyOfRows && selectedCell) {
      const uniqueSelectedRowIndices = getSelectedRowIndices();
      numRowsToAdd = uniqueSelectedRowIndices.length > 0 ? uniqueSelectedRowIndices.length : 1;

      if (uniqueSelectedRowIndices.length > 0) {
        const minSelectedRowIndex = uniqueSelectedRowIndices[0];
        const maxSelectedRowIndex =
          uniqueSelectedRowIndices[uniqueSelectedRowIndices.length - 1];
        initialInsertIndex =
          direction === "above" ? minSelectedRowIndex : maxSelectedRowIndex + 1;
      } else {
        initialInsertIndex =
          direction === "above"
            ? selectedCell.rowIndex
            : selectedCell.rowIndex + 1;
      }
    } else if (currentIsTableEmptyOfRows) {
      numRowsToAdd = 1;
      initialInsertIndex = 0;
    } else { // Table has columns, rows, but no cell selected
      toast.info("Please select a cell to add rows relative to, or the table must be empty of rows.");
      return;
    }

    setPendingOperation(
      direction === "above" ? "add-row-above" : "add-row-below"
    );

    startTransition(async () => {
      try {
        await generateAndInsertRows(initialInsertIndex, numRowsToAdd);
      } catch (error) {
        console.error(
          `Critical error in handleAddRowRelative transition:`,
          error
        );
        toast.error(
          "A critical error occurred while preparing to add rows. Please try again."
        );
      } finally {
        setPendingOperation(null);
      }
    });
  };

  const handleDeleteRows = () => {
    const uniqueRowIndicesToDelete = getSelectedRowIndices().sort(
      (a, b) => b - a
    );

    if (uniqueRowIndicesToDelete.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteRows(uniqueRowIndicesToDelete);
      } catch (error) {
        console.error("Critical error in handleDeleteRows transition:", error);
        toast.error(
          "A critical error occurred while preparing to delete rows. Please try again."
        );
      }
    });
  };

  const handleAddColumnRelative = (direction: "left" | "right") => {
    if (!isTableLoaded || isAnyOperationPending) return;

    let numColsToAdd = 1;
    let initialInsertIndex: number;
    const currentHeaders = headers || [];

    if (currentHeaders.length === 0) {
      numColsToAdd = 1;
      initialInsertIndex = 0;
    } else if (selectedCell) {
      const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();
      const isMultiColumnSelection = selectedCells.length > 1 && new Set(selectedCells.map(s => s.colIndex)).size > 1;

      numColsToAdd = isMultiColumnSelection && uniqueSelectedColIndices.length > 0 ? uniqueSelectedColIndices.length : 1;

      if (uniqueSelectedColIndices.length > 0) {
        const minSelectedColIndex = uniqueSelectedColIndices[0];
        const maxSelectedColIndex = uniqueSelectedColIndices[uniqueSelectedColIndices.length - 1];
        initialInsertIndex = direction === "left" ? minSelectedColIndex : maxSelectedColIndex + 1;
      } else {
        initialInsertIndex = direction === "left" ? selectedCell.colIndex : selectedCell.colIndex + 1;
      }
    } else {
      numColsToAdd = 1;
      initialInsertIndex = direction === "left" ? 0 : currentHeaders.length;
    }

    setPendingOperation(
      direction === "left" ? "add-column-left" : "add-column-right"
    );

    startTransition(async () => {
      try {
        await generateAndInsertColumns(initialInsertIndex, numColsToAdd);
      } catch (error) {
        console.error(
          "Critical error in handleAddColumnRelative transition:",
          error
        );
        toast.error(
          "A critical error occurred while preparing to add columns. Please try again."
        );
      } finally {
        setPendingOperation(null);
      }
    });
  };

  const handleDeleteColumns = () => {
    const uniqueColIndicesToDelete = getUniqueSelectedColumnIndices().sort(
      (a, b) => b - a
    );

    if (uniqueColIndicesToDelete.length === 0) {
      return;
    }

    startTransition(async () => {
      try {
        await deleteColumns(uniqueColIndicesToDelete);
      } catch (error) {
        console.error(
          "Critical error in handleDeleteColumns transition:",
          error
        );
        toast.error(
          "A critical error occurred while preparing to delete columns. Please try again."
        );
      }
    });
  };

  // --- CSV Download Handler ---
  const handleDownloadCsv = () => {
    if (!isTableLoaded || !headers || headers.length === 0 || !tableData) {
      console.warn("CSV Download aborted: No headers or table data.");
      return;
    }

    // Function to escape CSV special characters (comma, quote, newline)
    const escapeCsvCell = (cellData: unknown): string => {
      const stringValue = String(cellData ?? ""); // Handle null/undefined
      // If the value contains a comma, newline, or double quote, enclose it in double quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes("\n") ||
        stringValue.includes('"')
      ) {
        // Escape existing double quotes by doubling them
        const escapedValue = stringValue.replace(/"/g, '""');
        return `"${escapedValue}"`;
      }
      return stringValue;
    };

    // Create Header Row
    const csvHeader = headers.map(escapeCsvCell).join(",");

    // Create Data Rows
    const csvRows = tableData.map((row) => {
      return headers
        .map((header) => {
          const cellValue = row[header];
          return escapeCsvCell(cellValue);
        })
        .join(",");
    });

    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join("\n");

    // Create Blob and Trigger Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "planets.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUndo = () => {
    if (undoManager && canUndo) {
      undoManager.undo();
    }
  };

  const handleRedo = () => {
    if (undoManager && canRedo) {
      undoManager.redo();
    }
  };

  // Update conditions based on isTableLoaded
  // const canOperateOnSelection = !!selectedCell && isTableLoaded; Removed as it's unused

  const selectedRowIndices = getSelectedRowIndices();
  const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();

  let numSelectedRowsForLabel = 1; // Default for adding a single row
  if (isTableEmptyOfRows && !selectedCell) {
    numSelectedRowsForLabel = 1;
  } else if (selectedRowIndices.length > 0) {
    numSelectedRowsForLabel = selectedRowIndices.length;
  } else if (selectedCell) { // Single cell selected, not part of a multi-row selection for adding
    numSelectedRowsForLabel = 1;
  } else if (!isTableEmptyOfRows && !selectedCell) {
    // Table has rows, but nothing selected. Label will imply adding 'a' row.
    // The button's action handler (handleAddRowRelative) will toast if this state is problematic for an action.
    numSelectedRowsForLabel = 1;
  }

  const addRowAboveButtonLabel =
    numSelectedRowsForLabel <= 1
      ? "Add Row Above"
      : `Add ${numSelectedRowsForLabel} Rows Above`;
  const addRowBelowButtonLabel =
    numSelectedRowsForLabel <= 1
      ? "Add Row Below"
      : `Add ${numSelectedRowsForLabel} Rows Below`;
  const deleteRowsButtonLabel =
    selectedRowIndices.length <= 1
      ? "Delete Row"
      : `Delete ${selectedRowIndices.length} Rows`;

  const isTableEmptyOfColumns = !headers || headers.length === 0;
  let numColsForLabel = 1; // Default for adding a single column
  if (isTableEmptyOfColumns && !selectedCell) {
     numColsForLabel = 1;
  } else if (uniqueSelectedColIndices.length > 0 && new Set(selectedCells.map(s => s.colIndex)).size > 1) {
    // Multiple distinct columns selected
    numColsForLabel = uniqueSelectedColIndices.length;
  } else if (selectedCell) { // Single cell or single column selection
    numColsForLabel = 1;
  } else if (!isTableEmptyOfColumns && !selectedCell){ // Has columns, no selection
    numColsForLabel = 1;
  }

  const addColLeftButtonLabel =
    numColsForLabel <= 1
      ? "Add Column to the Left"
      : `Add ${numColsForLabel} Columns to the Left`;
  const addColRightButtonLabel =
    numColsForLabel <= 1
      ? "Add Column to the Right"
      : `Add ${numColsForLabel} Columns to the Right`;
  const deleteColButtonLabel =
    uniqueSelectedColIndices.length <= 1
      ? "Delete Selected Column"
      : `Delete ${uniqueSelectedColIndices.length} Columns`;

  // Button enable/disable conditions
  const canAddRows = isTableLoaded && !isAnyOperationPending && headers && headers.length > 0;
  const canAddColumns = isTableLoaded && !isAnyOperationPending;
  const canDeleteRow = isTableLoaded && !isAnyOperationPending && selectedRowIndices.length > 0;
  const canDeleteColumn = isTableLoaded && !isAnyOperationPending && uniqueSelectedColIndices.length > 0;
  const canDownload = isTableLoaded && headers && headers.length > 0 && tableData && tableData.length > 0;

  const isAddColumnLeftPending = isPending && pendingOperation === "add-column-left";
  const isAddColumnRightPending = isPending && pendingOperation === "add-column-right";

  // Effect to listen to UndoManager stack changes
  useEffect(() => {
    if (!undoManager) return;

    const updateUndoRedoState = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };

    // Initial check
    updateUndoRedoState();

    // Listen for changes that affect the stacks
    undoManager.on("stack-item-added", updateUndoRedoState);
    undoManager.on("stack-item-popped", updateUndoRedoState); // Popped during undo/redo

    // Cleanup
    return () => {
      undoManager.off("stack-item-added", updateUndoRedoState);
      undoManager.off("stack-item-popped", updateUndoRedoState);
    };
  }, [undoManager]);

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent p-1 mb-2">
        {/* Undo/Redo Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Undo"
              onMouseDown={(e) => {
                e.preventDefault();
                handleUndo();
              }}
              disabled={!canUndo || isAnyOperationPending}
            >
              <Undo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Redo"
              onMouseDown={(e) => {
                e.preventDefault();
                handleRedo();
              }}
              disabled={!canRedo || isAnyOperationPending}
            >
              <Redo className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Y / Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Row Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={addRowAboveButtonLabel}
              onClick={() => {
                handleAddRowRelative("above");
              }}
              disabled={!canAddRows}
            >
              {isPending && pendingOperation === "add-row-above" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpFromLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addRowAboveButtonLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label={addRowBelowButtonLabel}
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddRowRelative("below");
              }}
              disabled={!canAddRows}
            >
              {isPending && pendingOperation === "add-row-below" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addRowBelowButtonLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteRows}
              disabled={!canDeleteRow}
              aria-label={deleteRowsButtonLabel}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Rows3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{deleteRowsButtonLabel}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Column Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAddColumnRelative("left")}
              aria-label={addColLeftButtonLabel}
              disabled={!canAddColumns || isAddColumnRightPending}
              className="h-9 rounded-md px-3"
            >
              {isAddColumnLeftPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftFromLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addColLeftButtonLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleAddColumnRelative("right")}
              aria-label={addColRightButtonLabel}
              disabled={!canAddColumns || isAddColumnLeftPending}
              className="h-9 rounded-md px-3"
            >
              {isAddColumnRightPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightFromLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{addColRightButtonLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteColumns}
              disabled={!canDeleteColumn}
              aria-label={deleteColButtonLabel}
              className="h-9 rounded-md px-3"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Columns3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{deleteColButtonLabel}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* AI Fill Selection Button */}
        <AiFillSelectionButton />

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Download Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                // Use onMouseDown to prevent focus issues
                e.preventDefault();
                handleDownloadCsv();
              }}
              disabled={!canDownload || isAnyOperationPending}
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download CSV</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default LiveTableToolbar;
