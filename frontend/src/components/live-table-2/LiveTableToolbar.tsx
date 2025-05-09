import React, { useEffect, useRef, useState, useTransition } from "react";

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
  Sparkles,
  Trash2,
  Undo,
} from "lucide-react";
import { toast } from "sonner";
import * as Y from "yjs";

import {
  generateColumnSuggestions,
  generateNewColumn,
} from "@/app/(main)/planets/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useLiveTable } from "./LiveTableProvider";

// Helper function to create a new row map initialized with headers
const createNewRowMap = (yHeaders: Y.Array<string> | null): Y.Map<unknown> => {
  const newRow = new Y.Map<unknown>();
  if (yHeaders) {
    yHeaders.toArray().forEach((header) => newRow.set(header, ""));
  }
  return newRow;
};

const LiveTableToolbar: React.FC = () => {
  const { yDoc, yTable, yHeaders, selectedCell, undoManager, isTableLoaded } =
    useLiveTable();

  const [isPending, startTransition] = useTransition();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedCellForAiFill, setSelectedCellForAiFill] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const handleAddRowRelative = (direction: "above" | "below") => {
    if (!yDoc || !yTable || !selectedCell) return; // Require selection

    const insertIndex =
      direction === "above" ? selectedCell.rowIndex : selectedCell.rowIndex + 1;

    yDoc.transact(() => {
      const newRow = createNewRowMap(yHeaders);
      yTable.insert(insertIndex, [newRow]);
    });
  };

  const handleDeleteRow = () => {
    console.log("handleDeleteRow called", { selectedCell });
    if (!yDoc || !yTable || !selectedCell) {
      console.log("Delete row aborted: missing doc, table, or selection");
      return;
    }

    const rowIndexToDelete = selectedCell.rowIndex;
    console.log(`Attempting to delete row at index: ${rowIndexToDelete}`);

    yDoc.transact(() => {
      try {
        console.log(
          "yTable before delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
        yTable.delete(rowIndexToDelete, 1); // Delete 1 row at the selected index
        console.log(
          "yTable after delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
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
            // Use default header and signal to use empty data
          } else {
            finalHeader = result.newHeader;
            finalData = result.newColumnData;
            console.log(
              `[handleAddColumnRelative] AI generated header: "${finalHeader}"`
            );
          }

          // Perform the Yjs transaction within the transition callback *after* the async call
          yDoc.transact(() => {
            console.log(
              `[handleAddColumnRelative] Transaction Start: Inserting header "${finalHeader}" at index ${insertIndex}`
            );

            // 1. Add header to yHeaders array at the correct index
            yHeaders.insert(insertIndex, [finalHeader]);

            console.log(
              `[handleAddColumnRelative] yHeaders after insert: ${JSON.stringify(
                yHeaders.toArray()
              )}`
            );

            // 2. Add the new key and AI/default value to each existing row in yTable
            yTable.forEach((row: Y.Map<unknown>, rowIndex) => {
              const valueToAdd = finalData ? finalData[rowIndex] ?? "" : "";
              if (!row.has(finalHeader)) {
                row.set(finalHeader, valueToAdd);
              }
            });

            // If the table was empty, handle this case
            if (yTable.length === 0 && finalData && finalData.length > 0) {
              console.warn(
                "[handleAddColumnRelative] AI generated data for an empty table, adding first row."
              );
              // This case needs careful consideration. Should we add rows based on AI data?
              // For now, let's just add one row if data exists, otherwise, stick to the original logic.
              // If finalData is not null/empty, it implies AI succeeded.
              const newRow = new Y.Map<unknown>();
              const valueToAdd = finalData[0] ?? ""; // Use first data item
              newRow.set(finalHeader, valueToAdd);
              yTable.push([newRow]);
            } else if (yTable.length === 0) {
              // Original logic for empty table with default header
              const newRow = new Y.Map<unknown>();
              newRow.set(finalHeader, "");
              yTable.push([newRow]);
            }

            console.log(
              `[handleAddColumnRelative] Transaction End: Header "${finalHeader}" added.`
            );
          });
        })
        .catch((error) => {
          // Handle errors during the generateNewColumn call itself
          console.error("Error calling generateNewColumn:", error);
          toast.error("Failed to generate AI column suggestion.");
          // Fallback to default behavior within a transaction just in case
          yDoc.transact(() => {
            console.log(
              `[handleAddColumnRelative] Fallback Transaction: Inserting default header "${headerToAdd}" at index ${insertIndex}`
            );
            yHeaders.insert(insertIndex, [headerToAdd]);
            yTable.forEach((row: Y.Map<unknown>) => {
              if (!row.has(headerToAdd)) {
                row.set(headerToAdd, "");
              }
            });
            if (yTable.length === 0) {
              const newRow = new Y.Map<unknown>();
              newRow.set(headerToAdd, "");
              yTable.push([newRow]);
            }
          });
        });
    });
  };

  const handleDeleteColumn = () => {
    if (!selectedCell) {
      console.log("Delete column aborted: missing selection.");
      return;
    }

    const colIndexToDelete = selectedCell.colIndex;
    const headerToDelete = yHeaders.get(colIndexToDelete); // Get header from yHeaders

    if (headerToDelete === undefined) {
      // Extra safety check
      console.error(
        "Could not find header to delete at index",
        colIndexToDelete
      );
      return;
    }

    console.log(
      `Attempting to delete column: "${headerToDelete}" at index ${colIndexToDelete}`
    );

    yDoc.transact(() => {
      try {
        // 1. Delete header from yHeaders array
        yHeaders.delete(colIndexToDelete, 1);

        // 2. Delete the corresponding key from each row in yTable
        yTable.forEach((row: Y.Map<unknown>) => {
          row.delete(headerToDelete);
        });
      } catch (error) {
        console.error("Error during column deletion transaction:", error);
      }
    });
  };

  const handleAiFillColumn = () => {
    // Use the selectedCell prop *here* when the button is clicked
    if (!selectedCell) return;
    setSelectedCellForAiFill(selectedCell); // Store the current selection
    setIsConfirmDialogOpen(true); // Open confirmation dialog
  };

  const confirmAiFillColumn = () => {
    // Use the *stored* selected cell from state for the logic
    const targetCell = selectedCellForAiFill;

    if (!targetCell) {
      toast.error("Cannot perform AI fill: Missing selection.");
      return;
    }

    const currentTableData = yTable.toArray().map((row) => row.toJSON());
    const targetColIndex = targetCell.colIndex; // Use stored cell's colIndex
    const targetHeader = yHeaders.get(targetColIndex);

    startTransition(async () => {
      // Clear stored cell once action starts
      setSelectedCellForAiFill(null);
      const result = await generateColumnSuggestions(
        currentTableData,
        yHeaders.toArray(),
        targetColIndex
      );

      if (result.error) {
        toast.error(`AI Fill Error: ${result.error}`);
        return;
      }

      if (result.suggestions && result.suggestions.length > 0) {
        const suggestions = result.suggestions; // Assign to new variable after check
        yDoc.transact(() => {
          suggestions.forEach(({ index, suggestion }) => {
            // Use the new variable
            // Ensure suggestion index is valid
            if (index >= 0 && index < yTable.length) {
              const rowMap = yTable.get(index);
              if (rowMap) {
                rowMap.set(targetHeader, suggestion);
              } else {
                console.warn(
                  `Could not find rowMap for suggestion at index ${index}`
                );
              }
            } else {
              console.warn(`Invalid suggestion index received: ${index}`);
            }
          });
        });
        toast.success(`Column "${targetHeader}" updated with AI suggestions.`);
      } else {
        toast.warning(
          `AI returned no suggestions for column "${targetHeader}".`
        );
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
  const canAddColumn = canOperateOnSelection || yTable.length === 0;

  const canDeleteColumn =
    canOperateOnSelection &&
    yHeaders.length > 0 &&
    !!yHeaders.get(selectedCell?.colIndex) &&
    isTableLoaded;
  const canDownload = isTableLoaded && yHeaders.length > 0; // Can download if loaded and has headers

  // Effect to handle Enter/Escape key presses when dialog is open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isConfirmDialogOpen) return; // Only act if dialog is open

      if (event.key === "Enter" && !isPending) {
        event.preventDefault(); // Prevent default Enter behavior (like submitting a form)
        // Directly click the confirm button if it exists
        confirmButtonRef.current?.click();
      }
      // Escape is handled by AlertDialog's default onOpenChange triggering setIsConfirmDialogOpen(false)
    };

    // Add listener when the dialog is open
    document.addEventListener("keydown", handleKeyDown);

    // Cleanup: Remove listener when the effect re-runs or component unmounts
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // Rerun effect if dialog state or pending state changes
  }, [isConfirmDialogOpen, isPending]);

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
              disabled={!canUndo || isPending}
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
              disabled={!canRedo || isPending}
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
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddRowRelative("above");
              }}
              disabled={!canOperateOnSelection} // Disable if no cell selected
            >
              <ArrowUpFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Row Above</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddRowRelative("below");
              }}
              disabled={!canOperateOnSelection} // Disable if no cell selected
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Row Below</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDeleteRow();
              }}
              disabled={!canOperateOnSelection} // Updated condition
              className="text-destructive hover:bg-destructive/10"
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
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddColumnRelative("left");
              }}
              disabled={!canAddColumn}
            >
              <ArrowLeftFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Left</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddColumnRelative("right");
              }}
              disabled={!canAddColumn}
            >
              <ArrowRightFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Right</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDeleteColumn();
              }}
              disabled={!canDeleteColumn} // Updated condition
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Columns3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Column</TooltipContent>
        </Tooltip>

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
              disabled={!canDownload} // Use the download condition
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download CSV</TooltipContent>
        </Tooltip>

        {/* --- NEW AI Fill Button --- */}
        <Separator orientation="vertical" className="h-6 mx-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAiFillColumn();
              }}
              disabled={!selectedCell || !isTableLoaded || isPending} // Disable if no cell selected or pending
            >
              {/* Conditionally render Spinner or Sparkles */}
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>AI Fill Selected Column</TooltipContent>
        </Tooltip>
        {/* --- End NEW AI Fill Button --- */}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsConfirmDialogOpen(open);
          if (!open) {
            setSelectedCellForAiFill(null); // Clear stored cell on cancel/close
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm AI Column Fill</AlertDialogTitle>
            <AlertDialogDescription>
              {/* Add target column name to description? */}
              This will replace all existing data in the selected column
              (excluding the header) with AI-generated suggestions based on the
              entire table. This action cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isPending}
              onClick={() => setSelectedCellForAiFill(null)} // Clear on explicit cancel
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              ref={confirmButtonRef}
              onClick={confirmAiFillColumn}
              disabled={isPending || !selectedCellForAiFill}
            >
              {isPending ? "Generating..." : "Confirm & Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default LiveTableToolbar;
