import React, { useEffect, useState, useTransition } from "react";

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
    selectedCell,
    undoManager,
    isTableLoaded,
    selectedCells,
    generateAndInsertRows,
    deleteRows,
    generateAndInsertColumns,
    deleteColumns,
    headers,
    tableData,
  } = useLiveTable();

  const [isPending, startTransition] = useTransition();
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

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
    if (!isTableLoaded) return;
    if (!selectedCell) return;
    if (!selectedCells) return;

    let numRowsToAdd = 1;
    const uniqueSelectedRowIndices: number[] = [];

    if (selectedCells && selectedCells.length > 0) {
      const indices = selectedCells.map((cell) => cell.rowIndex);
      const uniqueSet = new Set(indices);
      uniqueSelectedRowIndices.push(...uniqueSet);
      uniqueSelectedRowIndices.sort((a, b) => a - b);
      numRowsToAdd =
        uniqueSelectedRowIndices.length > 0
          ? uniqueSelectedRowIndices.length
          : 1;
    } else if (selectedCell) {
      uniqueSelectedRowIndices.push(selectedCell.rowIndex);
      numRowsToAdd = 1;
    } else {
      console.error(
        "handleAddRowRelative: No selection information available."
      );
      toast.info("No cell selected to add rows relative to.");
      return;
    }

    if (numRowsToAdd === 0) {
      // Should not happen if buttons are correctly disabled
      toast.info("No rows were added as the selection was empty.");
      return;
    }

    let calculatedInitialInsertIndex: number;
    if (uniqueSelectedRowIndices.length > 0) {
      const minSelectedRowIndex = uniqueSelectedRowIndices[0];
      const maxSelectedRowIndex =
        uniqueSelectedRowIndices[uniqueSelectedRowIndices.length - 1];
      calculatedInitialInsertIndex =
        direction === "above" ? minSelectedRowIndex : maxSelectedRowIndex + 1;
    } else {
      console.warn(
        "handleAddRowRelative: Could not determine min/max selected rows, falling back to currentSelectedCell directly."
      );
      calculatedInitialInsertIndex =
        direction === "above"
          ? selectedCell.rowIndex
          : selectedCell.rowIndex + 1;
    }

    const initialInsertIndex = calculatedInitialInsertIndex;

    setPendingOperation(
      direction === "above" ? "add-row-above" : "add-row-below"
    );

    startTransition(async () => {
      try {
        await generateAndInsertRows(initialInsertIndex, numRowsToAdd);
      } catch (error) {
        // This catch block might be redundant because generateAndInsertRows
        // handles errors and toasting
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
      (a, b) => b - a // Sort descending for safe deletion
    );

    if (uniqueRowIndicesToDelete.length === 0) {
      // This case is already handled by deleteRowsFromDoc in the provider (toast.info)
      // but good to have a guard here too.
      return;
    }

    startTransition(async () => {
      try {
        await deleteRows(uniqueRowIndicesToDelete);
      } catch (error) {
        // This catch block is a backup as deleteRows also handles errors and toasting.
        console.error("Critical error in handleDeleteRows transition:", error);
        toast.error(
          "A critical error occurred while preparing to delete rows. Please try again."
        );
      }
      // pendingOperation state for delete was not used, so no need to reset it.
    });
  };

  const handleAddColumnRelative = (direction: "left" | "right") => {
    const currentSelectedCell = selectedCell;
    if (!isTableLoaded || !currentSelectedCell) return;

    const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();
    let numColsToAdd = 1;

    if (uniqueSelectedColIndices.length > 0) {
      const selectionIsConsideredMultiColumn =
        selectedCells.length > 1 &&
        new Set(selectedCells.map((s) => s.colIndex)).size > 1;
      if (selectionIsConsideredMultiColumn) {
        numColsToAdd = uniqueSelectedColIndices.length;
      } else if (selectedCells.length === 0 && selectedCell) {
        numColsToAdd = 1;
      } else if (
        selectedCells.length > 0 &&
        new Set(selectedCells.map((s) => s.colIndex)).size === 1
      ) {
        numColsToAdd = 1;
      } else if (selectedCells.length > 0) {
        numColsToAdd =
          uniqueSelectedColIndices.length > 0
            ? uniqueSelectedColIndices.length
            : 1;
      } else {
        numColsToAdd = 1;
      }
    } else if (selectedCell) {
      numColsToAdd = 1;
    } else {
      toast.info("No cell selected to add columns relative to.");
      return;
    }

    if (
      selectedCell &&
      numColsToAdd === 0 &&
      uniqueSelectedColIndices.length === 0
    )
      numColsToAdd = 1;
    if (numColsToAdd === 0) {
      toast.info(
        "No columns were added as the selection was effectively empty for columns."
      );
      return;
    }

    let calculatedInitialInsertIndex: number;
    if (uniqueSelectedColIndices.length > 0) {
      const minSelectedColIndex = uniqueSelectedColIndices[0];
      const maxSelectedColIndex =
        uniqueSelectedColIndices[uniqueSelectedColIndices.length - 1];
      calculatedInitialInsertIndex =
        direction === "left" ? minSelectedColIndex : maxSelectedColIndex + 1;
    } else {
      calculatedInitialInsertIndex =
        direction === "left"
          ? currentSelectedCell.colIndex
          : currentSelectedCell.colIndex + 1;
    }
    const initialInsertIndex = calculatedInitialInsertIndex;

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
      // This case is already handled by deleteColumns in the provider (toast.info)
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
  const canOperateOnSelection = !!selectedCell && isTableLoaded;

  const selectedRowIndices = getSelectedRowIndices();
  const numSelectedRows = selectedRowIndices.length;

  const canDeleteRow = numSelectedRows > 0 && isTableLoaded;

  const canDownload = isTableLoaded && headers && headers.length > 0;

  // For disabling buttons, check for any pending operations
  const isAnyOperationPending = isPending && pendingOperation !== null;

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
  }, [undoManager]); // Rerun if undoManager instance changes

  const addRowAboveButtonLabel =
    numSelectedRows === 1
      ? "Add Row Above"
      : `Add ${numSelectedRows} Rows Above`;
  const addRowBelowButtonLabel =
    numSelectedRows === 1
      ? "Add Row Below"
      : `Add ${numSelectedRows} Rows Below`;
  const deleteRowsButtonLabel =
    numSelectedRows === 0 // Check if no rows are selected
      ? "Delete Row" // Default singular label when disabled due to no selection
      : numSelectedRows === 1
      ? "Delete Row"
      : `Delete ${numSelectedRows} Rows`;

  const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();
  let numColsToModify = 1;
  if (
    selectedCells.length > 1 &&
    new Set(selectedCells.map((s) => s.colIndex)).size > 1
  ) {
    numColsToModify = uniqueSelectedColIndices.length;
  } else if (
    selectedCells.length > 0 &&
    new Set(selectedCells.map((s) => s.colIndex)).size === 1 &&
    uniqueSelectedColIndices.length === 1
  ) {
    numColsToModify = 1;
  } else if (
    uniqueSelectedColIndices.length > 0 &&
    uniqueSelectedColIndices.length !== 1
  ) {
    numColsToModify = uniqueSelectedColIndices.length;
  } else if (selectedCell && selectedCells.length <= 1) {
    numColsToModify = 1;
  }
  if (selectedCell && numColsToModify === 0) numColsToModify = 1;

  const addColLeftButtonLabel =
    numColsToModify === 1
      ? "Add Column to the Left"
      : `Add ${numColsToModify} Columns to the Left`;
  const addColRightButtonLabel =
    numColsToModify === 1
      ? "Add Column to the Right"
      : `Add ${numColsToModify} Columns to the Right`;
  const deleteColButtonLabel =
    uniqueSelectedColIndices.length === 0
      ? "Delete Selected Column"
      : uniqueSelectedColIndices.length === 1
      ? "Delete Selected Column"
      : `Delete ${uniqueSelectedColIndices.length} Columns`;

  const isAddColumnLeftPending =
    isPending && pendingOperation === "add-column-left";
  const isAddColumnRightPending =
    isPending && pendingOperation === "add-column-right";

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
              disabled={!canOperateOnSelection || isAnyOperationPending}
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
              disabled={!canOperateOnSelection || isAnyOperationPending}
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
              disabled={!canDeleteRow || isAnyOperationPending}
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
              disabled={
                isAddColumnLeftPending ||
                isAddColumnRightPending ||
                !isTableLoaded ||
                !selectedCell
              }
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
              disabled={
                isAddColumnRightPending ||
                isAddColumnLeftPending ||
                !isTableLoaded ||
                !selectedCell
              }
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
              disabled={
                isPending ||
                !isTableLoaded ||
                uniqueSelectedColIndices.length === 0
              }
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

        {/* Lock Button */}
        {/* <LockButton />

        <Separator orientation="vertical" className="h-6 mx-1" /> */}

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
