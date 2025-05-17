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
import * as Y from "yjs";

import generateNewRows from "@/components/live-table/actions/generateNewRows";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import generateNewColumns, {
  GeneratedColumn,
} from "./actions/generateNewColumns";
import { AiFillSelectionButton } from "./AiFillSelectionButton";
import { useLiveTable } from "./LiveTableProvider";
import {
  applyDefaultColumnToYDocOnError,
  applyGeneratedColumnToYDoc,
  createDefaultYMapForRow,
  createYMapFromData,
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
    const currentSelectedCell = selectedCell;
    const currentSelectedCells = selectedCells;

    if (!yDoc || !yTable || !currentSelectedCell || !yHeaders) return;

    let numRowsToAdd = 1;
    const uniqueSelectedRowIndices: number[] = [];

    if (currentSelectedCells && currentSelectedCells.length > 0) {
      const indices = currentSelectedCells.map((cell) => cell.rowIndex);
      const uniqueSet = new Set(indices);
      uniqueSelectedRowIndices.push(...uniqueSet);
      uniqueSelectedRowIndices.sort((a, b) => a - b);
      numRowsToAdd =
        uniqueSelectedRowIndices.length > 0
          ? uniqueSelectedRowIndices.length
          : 1;
    } else if (currentSelectedCell) {
      uniqueSelectedRowIndices.push(currentSelectedCell.rowIndex);
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
          ? currentSelectedCell.rowIndex
          : currentSelectedCell.rowIndex + 1;
    }

    const initialInsertIndex = calculatedInitialInsertIndex;
    const yHeadersArray = yHeaders.toArray(); // Get headers once

    setPendingOperation(
      direction === "above" ? "add-row-above" : "add-row-below"
    );

    startTransition(async () => {
      let aiRowsAddedCount = 0;
      let defaultRowsAddedCount = 0;
      const rowsToInsertInYjs: Y.Map<unknown>[] = [];

      try {
        const result = await generateNewRows(
          yTable.toArray().map((row) => row.toJSON()),
          yHeadersArray,
          numRowsToAdd
        );

        if (result.error || !result.newRows || result.newRows.length === 0) {
          console.warn(
            `Failed to generate AI rows or no rows returned, falling back to default rows. Error: ${result.error}`
          );
          for (let i = 0; i < numRowsToAdd; i++) {
            rowsToInsertInYjs.push(createDefaultYMapForRow(yHeadersArray));
            defaultRowsAddedCount++;
          }
        } else {
          result.newRows.forEach((rowData: Record<string, string>) => {
            if (rowsToInsertInYjs.length < numRowsToAdd) {
              rowsToInsertInYjs.push(
                createYMapFromData(rowData, yHeadersArray)
              );
              aiRowsAddedCount++;
            }
          });
          const remainingRowsToFill = numRowsToAdd - aiRowsAddedCount;
          for (let i = 0; i < remainingRowsToFill; i++) {
            rowsToInsertInYjs.push(createDefaultYMapForRow(yHeadersArray));
            defaultRowsAddedCount++;
          }
        }

        if (rowsToInsertInYjs.length > 0) {
          yDoc.transact(() => {
            yTable.insert(initialInsertIndex, rowsToInsertInYjs);
          });
        }

        // Consolidated Toast Message Logic
        if (aiRowsAddedCount > 0 && defaultRowsAddedCount === 0) {
          toast.success(
            `Successfully added ${aiRowsAddedCount} AI-suggested row(s).`
          );
        } else if (aiRowsAddedCount > 0 && defaultRowsAddedCount > 0) {
          toast.info(
            `Added ${numRowsToAdd} row(s): ${aiRowsAddedCount} AI-suggested, ${defaultRowsAddedCount} default.`
          );
        } else if (defaultRowsAddedCount > 0) {
          // This implies aiRowsAddedCount is 0
          toast.info(
            `Added ${defaultRowsAddedCount} default row(s) as AI suggestions were not available or failed.`
          );
        } else if (numRowsToAdd > 0 && rowsToInsertInYjs.length === 0) {
          // This case should ideally not be hit if logic is correct, but acts as a fallback.
          toast.info("Attempted to add rows, but no rows were prepared.");
        }
        // If numRowsToAdd was 0, a toast might have already been shown.
        // If rowsToInsertInYjs.length is 0 and numRowsToAdd > 0, something went wrong.
      } catch (error) {
        console.error(`Error during add row operation:`, error);
        // Fallback: add default empty rows on catastrophic failure
        const fallbackRows: Y.Map<unknown>[] = [];
        for (let i = 0; i < numRowsToAdd; i++) {
          fallbackRows.push(createDefaultYMapForRow(yHeadersArray));
        }
        if (fallbackRows.length > 0) {
          yDoc.transact(() => {
            yTable.insert(initialInsertIndex, fallbackRows);
          });
        }
        toast.error(
          `Failed to add ${numRowsToAdd} row(s). ${
            fallbackRows.length > 0
              ? `${fallbackRows.length} default row(s) added as fallback.`
              : "No rows were added."
          }`
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

    if (uniqueRowIndicesToDelete.length === 0 || !yDoc || !yTable) {
      return;
    }

    yDoc.transact(() => {
      try {
        uniqueRowIndicesToDelete.forEach((rowIndex) => {
          yTable.delete(rowIndex, 1); // Delete 1 row at the specified index
        });
      } catch (error) {
        console.error("Error during row deletion transaction:", error);
      }
    });
  };

  const handleAddColumnRelative = (direction: "left" | "right") => {
    const currentSelectedCell = selectedCell;
    if (!yDoc || !yTable || !yHeaders || !currentSelectedCell) return;

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
      const initialYHeadersArray = yHeaders.toArray();
      const currentTableData = yTable
        .toArray()
        .map((r: Y.Map<unknown>) => r.toJSON());
      const headersAddedInThisTx: string[] = [...initialYHeadersArray];

      const generateUniqueDefaultHeader = (
        base: string,
        existingInTx: string[]
      ): string => {
        let counter = 1;
        let name = `${base} ${counter}`;
        while (
          existingInTx.map((h) => h.toLowerCase()).includes(name.toLowerCase())
        ) {
          counter++;
          name = `${base} ${counter}`;
        }
        return name;
      };

      let aiResults: GeneratedColumn[] = [];
      let operationError: string | undefined;

      try {
        const result = await generateNewColumns(
          currentTableData,
          initialYHeadersArray,
          numColsToAdd
        );
        if (result.error) {
          operationError = result.error;
        } else if (result.generatedColumns) {
          aiResults = result.generatedColumns;
        } else {
          operationError = "AI function for multiple columns returned no data.";
        }

        yDoc.transact(() => {
          let actualColsAdded = 0;
          let defaultColsAdded = 0;
          let aiColsSuccessfullyAdded = 0;

          if (operationError || aiResults.length === 0) {
            console.warn(
              `AI column generation failed or returned no columns. Error: ${operationError}. Adding ${numColsToAdd} default column(s).`
            );
            for (let i = 0; i < numColsToAdd; i++) {
              const insertIdx = initialInsertIndex + actualColsAdded;
              const newHeaderName = generateUniqueDefaultHeader(
                "New Column",
                headersAddedInThisTx
              );
              applyDefaultColumnToYDocOnError(
                yDoc,
                yHeaders,
                yTable,
                newHeaderName,
                insertIdx
              );
              headersAddedInThisTx.push(newHeaderName);
              actualColsAdded++;
              defaultColsAdded++;
            }
          } else {
            for (let i = 0; i < numColsToAdd; i++) {
              const insertIdx = initialInsertIndex + actualColsAdded;
              if (i < aiResults.length) {
                const col = aiResults[i];
                if (
                  headersAddedInThisTx
                    .map((h) => h.toLowerCase())
                    .includes(col.headerName.toLowerCase())
                ) {
                  console.warn(
                    `Header '${col.headerName}' from AI conflicts, adding default instead.`
                  );
                  const newHeaderName = generateUniqueDefaultHeader(
                    "New Column",
                    headersAddedInThisTx
                  );
                  applyDefaultColumnToYDocOnError(
                    yDoc,
                    yHeaders,
                    yTable,
                    newHeaderName,
                    insertIdx
                  );
                  headersAddedInThisTx.push(newHeaderName);
                  defaultColsAdded++;
                } else {
                  applyGeneratedColumnToYDoc(
                    yDoc,
                    yHeaders,
                    yTable,
                    col.headerName,
                    col.columnData,
                    insertIdx
                  );
                  headersAddedInThisTx.push(col.headerName);
                  aiColsSuccessfullyAdded++;
                }
              } else {
                const newHeaderName = generateUniqueDefaultHeader(
                  "New Column",
                  headersAddedInThisTx
                );
                applyDefaultColumnToYDocOnError(
                  yDoc,
                  yHeaders,
                  yTable,
                  newHeaderName,
                  insertIdx
                );
                headersAddedInThisTx.push(newHeaderName);
                defaultColsAdded++;
              }
              actualColsAdded++;
            }
          }

          if (aiColsSuccessfullyAdded > 0 && defaultColsAdded === 0) {
            toast.success(
              `Successfully added ${aiColsSuccessfullyAdded} AI-suggested column(s).`
            );
          } else if (aiColsSuccessfullyAdded > 0 && defaultColsAdded > 0) {
            toast.info(
              `Added ${actualColsAdded} column(s): ${aiColsSuccessfullyAdded} AI-suggested, ${defaultColsAdded} default.`
            );
          } else if (defaultColsAdded > 0 && aiColsSuccessfullyAdded === 0) {
            toast.info(
              `Added ${defaultColsAdded} default column(s) as AI suggestions were not available, failed, or conflicted.`
            );
          } else if (numColsToAdd > 0 && actualColsAdded === 0) {
            toast.error(
              "Attempted to add columns, but no columns were prepared or could be added."
            );
          }
        });
      } catch (error) {
        console.error("Error during add column operation:", error);
        yDoc.transact(() => {
          let fallbackAdded = 0;
          for (let i = 0; i < numColsToAdd; i++) {
            const insertIdx = initialInsertIndex + i;
            const newHeaderName = generateUniqueDefaultHeader(
              "New Column",
              headersAddedInThisTx
            );
            applyDefaultColumnToYDocOnError(
              yDoc,
              yHeaders,
              yTable,
              newHeaderName,
              insertIdx
            );
            headersAddedInThisTx.push(newHeaderName);
            fallbackAdded++;
          }
          toast.error(
            `Failed to add columns due to an unexpected error. ${fallbackAdded} default column(s) added as fallback.`
          );
        });
      } finally {
        setPendingOperation(null);
      }
    });
  };

  const handleDeleteColumns = () => {
    const uniqueColIndicesToDelete = getUniqueSelectedColumnIndices().sort(
      (a, b) => b - a
    );

    if (
      uniqueColIndicesToDelete.length === 0 ||
      !yDoc ||
      !yHeaders ||
      !yTable
    ) {
      return;
    }

    yDoc.transact(() => {
      try {
        uniqueColIndicesToDelete.forEach((colIndex) => {
          const headerToDelete = yHeaders.get(colIndex);
          if (headerToDelete !== undefined) {
            console.log(
              `Deleting header: "${headerToDelete}" at index ${colIndex}`
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

  const selectedRowIndices = getSelectedRowIndices();
  const numSelectedRows = selectedRowIndices.length;

  const canDeleteRow = numSelectedRows > 0 && isTableLoaded && !!yTable;

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
      ? "Add column to the left"
      : `Add ${numColsToModify} Columns to the left`;
  const addColRightButtonLabel =
    numColsToModify === 1
      ? "Add column to the right"
      : `Add ${numColsToModify} Columns to the right`;
  const deleteColButtonLabel =
    uniqueSelectedColIndices.length === 0
      ? "Delete selected column"
      : uniqueSelectedColIndices.length === 1
      ? "Delete selected column"
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
