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
import * as Y from "yjs";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import generateNewColumn from "./actions/generateNewColumn";
import generateNewRow from "./actions/generateNewRow";
import { AiFillSelectionButton } from "./AiFillSelectionButton";
import { useLiveTable } from "./LiveTableProvider";
import {
  applyDefaultColumnToYDocOnError,
  applyDefaultRowToYDocOnError,
  applyGeneratedColumnToYDoc,
  applyGeneratedRowToYDoc,
} from "./yjs-operations";

// Define the possible pending operations
type PendingOperation =
  | "add-row-above"
  | "add-row-below"
  | "add-column-left"
  | "add-column-right"
  | null;

const LiveTableToolbar: React.FC = () => {
  const {
    yDoc,
    yTable,
    yHeaders,
    selectedCell,
    undoManager,
    isTableLoaded,
    selectedCells,
  } = useLiveTable();

  const [isPending, startTransition] = useTransition();
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const getSelectedColumnIndices = (): number[] => {
    if (!selectedCells || selectedCells.length === 0) {
      return [];
    }
    const uniqueIndices = [
      ...new Set(selectedCells.map((cell) => cell.colIndex)),
    ];
    return uniqueIndices.sort((a, b) => a - b); // Sort ascending for consistent display/aria-label order
  };

  const handleAddRowRelative = (direction: "above" | "below") => {
    if (!yDoc || !yTable || !selectedCell || !yHeaders) return; // Require selection and headers

    const insertIndex =
      direction === "above" ? selectedCell.rowIndex : selectedCell.rowIndex + 1;

    console.log(
      `[handleAddRowRelative] Adding row ${direction}, at index: ${insertIndex}`
    );

    // Set the pending operation
    setPendingOperation(
      direction === "above" ? "add-row-above" : "add-row-below"
    );

    startTransition(() => {
      // Asynchronously attempt to generate row data
      generateNewRow(
        yTable.toArray().map((row) => row.toJSON()),
        yHeaders.toArray()
      )
        .then((result) => {
          if (result.error || !result.rowData) {
            console.warn(
              "Failed to generate AI row data, falling back to default:",
              result.error
            );
            applyDefaultRowToYDocOnError(yDoc, yTable, yHeaders, insertIndex);
          } else {
            console.log(`[handleAddRowRelative] AI generated row data`);
            applyGeneratedRowToYDoc(
              yDoc,
              yTable,
              yHeaders,
              result.rowData,
              insertIndex
            );
          }
          // Clear the pending operation when done
          setPendingOperation(null);
        })
        .catch((error) => {
          console.error("Error calling generateNewRow:", error);
          toast.error("Failed to generate AI row suggestion.");
          applyDefaultRowToYDocOnError(yDoc, yTable, yHeaders, insertIndex);
          // Clear the pending operation when done
          setPendingOperation(null);
        });
    });
  };

  const handleDeleteRow = () => {
    if (!yDoc || !yTable || !selectedCell) {
      console.log("Delete row aborted: missing doc, table, or selection");
      return;
    }

    const rowIndexToDelete = selectedCell.rowIndex;
    console.log(`Attempting to delete row at index: ${rowIndexToDelete}`);

    yDoc.transact(() => {
      try {
        yTable.delete(rowIndexToDelete, 1); // Delete 1 row at the selected index
      } catch (error) {
        console.error("Error during row deletion transaction:", error);
      }
    });
  };

  const handleAddColumnRelative = (direction: "left" | "right") => {
    if (!yDoc || !yTable || !yHeaders) {
      console.log(
        "handleAddColumnRelative aborted: missing doc, table, or headers"
      );
      return;
    }

    // Allow adding a column if table is empty, even without selection
    if (!selectedCell && yTable.length > 0) {
      console.log(
        "handleAddColumnRelative aborted: no cell selected in non-empty table"
      );
      return;
    }

    const baseName = "New Column";
    let counter = 1;
    let defaultHeaderName = `${baseName} ${counter}`;
    const existingHeadersLower = yHeaders.toArray().map((h) => h.toLowerCase());

    while (existingHeadersLower.includes(defaultHeaderName.toLowerCase())) {
      counter++;
      defaultHeaderName = `${baseName} ${counter}`;
    }

    const headerToAdd = defaultHeaderName; // Start with default

    console.log(
      `[handleAddColumnRelative] Determined default header: "${headerToAdd}", direction: ${direction}`
    );

    // Determine insertion index based on direction and selection
    let insertIndex = yHeaders.length; // Default to end if no selection/direction

    // Only use selectedCell for index if it exists
    if (selectedCell) {
      insertIndex =
        direction === "left"
          ? selectedCell.colIndex
          : selectedCell.colIndex + 1;
    }

    // Set the pending operation
    setPendingOperation(
      direction === "left" ? "add-column-left" : "add-column-right"
    );

    startTransition(() => {
      // Asynchronously attempt to generate a better header and data
      generateNewColumn(
        yTable.toArray().map((row) => row.toJSON()),
        yHeaders.toArray()
      )
        .then((result) => {
          let finalHeader = headerToAdd;
          let finalData: (string | undefined)[] | null = null; // Use null to signify default empty strings

          if (result.error || !result.newHeader || !result.newColumnData) {
            console.warn(
              "Failed to generate AI column name or data, falling back to default:",
              result.error
            );
          } else {
            finalHeader = result.newHeader;
            finalData = result.newColumnData;
            console.log(
              `[handleAddColumnRelative] AI generated header: "${finalHeader}"`
            );
          }

          applyGeneratedColumnToYDoc(
            yDoc,
            yHeaders,
            yTable,
            finalHeader,
            finalData,
            insertIndex
          );

          // Clear the pending operation when done
          setPendingOperation(null);
        })
        .catch((error) => {
          console.error("Error calling generateNewColumn:", error);
          toast.error("Failed to generate AI column suggestion.");
          applyDefaultColumnToYDocOnError(
            yDoc,
            yHeaders,
            yTable,
            headerToAdd,
            insertIndex
          );

          // Clear the pending operation when done
          setPendingOperation(null);
        });
    });
  };

  const handleDeleteColumns = () => {
    const uniqueColIndicesToDelete = getSelectedColumnIndices().sort(
      (a, b) => b - a
    );

    if (
      uniqueColIndicesToDelete.length === 0 ||
      !yDoc ||
      !yHeaders ||
      !yTable
    ) {
      console.log(
        "Delete column aborted: missing selection, yDoc, yHeaders, or yTable."
      );
      return;
    }

    yDoc.transact(() => {
      try {
        uniqueColIndicesToDelete.forEach((colIndex) => {
          const headerToDelete = yHeaders.get(colIndex);
          if (headerToDelete !== undefined) {
            console.log(
              `Deleting header: \"${headerToDelete}\" at index ${colIndex}`
            );
            yHeaders.delete(colIndex, 1);
            yTable.forEach((row: Y.Map<unknown>) => {
              row.delete(headerToDelete);
            });
          } else {
            console.warn(
              `Header at index ${colIndex} not found during deletion.`
            );
          }
        });
      } catch (error) {
        console.error("Error during column deletion transaction:", error);
      }
    });
  };

  // --- CSV Download Handler ---
  const handleDownloadCsv = () => {
    if (!yTable || yHeaders.length === 0) {
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
    const csvHeader = yHeaders.toArray().map(escapeCsvCell).join(",");

    // Create Data Rows
    const tableRows = yTable.toArray();
    const csvRows = tableRows.map((rowMap: Y.Map<unknown>) => {
      return yHeaders
        .toArray()
        .map((header) => {
          const cellValue = rowMap.get(header); // Get value using the current header
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

  // Can add column if there is a selection or the table is empty
  const canAddColumn =
    ((selectedCell || (selectedCells && selectedCells.length > 0)) &&
      isTableLoaded) ||
    (yTable && yTable.length === 0);

  const selectedColumnIndices = getSelectedColumnIndices();
  const numSelectedCols = selectedColumnIndices.length;

  const canDeleteRow = canOperateOnSelection && isTableLoaded; // Keep original logic for canDeleteRow

  const canDeleteColumn =
    numSelectedCols > 0 &&
    isTableLoaded &&
    yHeaders &&
    yHeaders.length > 0 &&
    selectedColumnIndices.every((index) => index < yHeaders.length);

  const canDownload = isTableLoaded && yHeaders && yHeaders.length > 0;

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

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent p-1 mb-2">
        {/* Undo/Redo Buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
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
              aria-label="Add row above"
              onMouseDown={(e) => {
                e.preventDefault();
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
          <TooltipContent>Add Row Above</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Add row below"
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
          <TooltipContent>Add Row Below</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteRow}
              disabled={!canDeleteRow || isAnyOperationPending}
              aria-label="Delete selected row"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Rows3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Row</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Column Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Add column to the left"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddColumnRelative("left");
              }}
              disabled={!canAddColumn || isAnyOperationPending}
            >
              {isPending && pendingOperation === "add-column-left" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeftFromLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Left</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Add column to the right"
              onClick={() => {
                handleAddColumnRelative("right");
              }}
              disabled={!canAddColumn || isAnyOperationPending}
            >
              {isPending && pendingOperation === "add-column-right" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRightFromLine className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Right</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteColumns}
              disabled={!canDeleteColumn || isAnyOperationPending}
              aria-label={
                numSelectedCols > 1
                  ? "Delete selected columns"
                  : "Delete selected column"
              }
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Columns3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {numSelectedCols > 1
              ? `Delete ${numSelectedCols} Columns`
              : "Delete Column"}
          </TooltipContent>
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
