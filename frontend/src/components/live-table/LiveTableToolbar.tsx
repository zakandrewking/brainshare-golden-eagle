import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  ChevronDownIcon,
  Columns3,
  Download,
  Eraser,
  Loader2,
  MoreVertical,
  Redo,
  Rows3,
  Trash2,
  Undo,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDeleteColumns,
  useDeleteRows,
  useGenerateAndInsertColumns,
  useGenerateAndInsertRows,
  useHandleCellChange,
  useHeaders,
  useInsertEmptyColumns,
  useInsertEmptyRows,
  useIsCellLockedFn,
  useIsTableLoaded,
  useTableData,
  useUndoManager,
} from "@/stores/dataStore";
import { useSelectedCell, useSelectedCells } from "@/stores/selectionStore";

import { AiFillSelectionButton } from "./AiFillSelectionButton";
import LockButton from "./LockButton";

// Define the possible pending operations
type PendingOperation =
  | "add-row-above"
  | "add-row-below"
  | "add-empty-row-above"
  | "add-empty-row-below"
  | "add-column-left"
  | "add-empty-column-left"
  | "add-column-right"
  | "add-empty-column-right"
  | null;

// Button type constants
const BUTTON_TYPES = {
  UNDO: "undo",
  REDO: "redo",
  ADD_ROW_ABOVE: "add-row-above",
  ADD_ROW_BELOW: "add-row-below",
  ADD_EMPTY_ROW_ABOVE: "add-empty-row-above",
  ADD_EMPTY_ROW_BELOW: "add-empty-row-below",
  DELETE_ROWS: "delete-rows",
  ADD_ROW_GROUP: "add-row-group",
  ADD_COLUMN_GROUP: "add-column-group",
  ADD_COL_LEFT: "add-column-left",
  ADD_EMPTY_COL_LEFT: "add-empty-column-left",
  ADD_COL_RIGHT: "add-column-right",
  ADD_EMPTY_COL_RIGHT: "add-empty-column-right",
  DELETE_COLS: "delete-columns",
  CLEAR_CELLS: "clear-cells",
  AI_FILL: "ai-fill",
  LOCK: "lock",
  DOWNLOAD: "download",
} as const;

// Static button configuration
const BUTTON_ORDER = [
  BUTTON_TYPES.UNDO,
  BUTTON_TYPES.REDO,
  "separator-1",
  BUTTON_TYPES.ADD_ROW_GROUP,
  BUTTON_TYPES.DELETE_ROWS,
  "separator-2",
  BUTTON_TYPES.ADD_COLUMN_GROUP,
  BUTTON_TYPES.DELETE_COLS,
  "separator-2.5",
  BUTTON_TYPES.CLEAR_CELLS,
  "separator-3",
  BUTTON_TYPES.AI_FILL,
  BUTTON_TYPES.LOCK,
  "separator-4",
  BUTTON_TYPES.DOWNLOAD,
];

const ESTIMATED_WIDTHS: Record<string, number> = {
  [BUTTON_TYPES.UNDO]: 36,
  [BUTTON_TYPES.REDO]: 36,
  [BUTTON_TYPES.ADD_ROW_ABOVE]: 36,
  [BUTTON_TYPES.ADD_ROW_BELOW]: 36,
  [BUTTON_TYPES.ADD_ROW_GROUP]: 220,
  [BUTTON_TYPES.DELETE_ROWS]: 52,
  [BUTTON_TYPES.ADD_COLUMN_GROUP]: 220,
  [BUTTON_TYPES.DELETE_COLS]: 64,
  [BUTTON_TYPES.CLEAR_CELLS]: 36,
  [BUTTON_TYPES.AI_FILL]: 100,
  [BUTTON_TYPES.LOCK]: 83,
  [BUTTON_TYPES.DOWNLOAD]: 36,
  "separator-1": 16,
  "separator-2": 16,
  "separator-2.5": 16,
  "separator-3": 16,
  "separator-4": 16,
  [BUTTON_TYPES.ADD_COL_LEFT]: 36,
  [BUTTON_TYPES.ADD_COL_RIGHT]: 36,
};

const LiveTableToolbar: React.FC = () => {
  const isTableLoaded = useIsTableLoaded();
  const headers = useHeaders();
  const tableData = useTableData();

  const isCellLockedFn = useIsCellLockedFn();
  const undoManager = useUndoManager();
  const selectedCell = useSelectedCell();
  const selectedCells = useSelectedCells();
  const generateAndInsertRows = useGenerateAndInsertRows();
  const insertEmptyRows = useInsertEmptyRows();
  const deleteRows = useDeleteRows();
  const generateAndInsertColumns = useGenerateAndInsertColumns();
  const insertEmptyColumns = useInsertEmptyColumns();
  const deleteColumns = useDeleteColumns();
  const handleCellChange = useHandleCellChange();

  const [isPending, startTransition] = useTransition();
  const [pendingOperation, setPendingOperation] =
    useState<PendingOperation>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [visibleButtonIds, setVisibleButtonIds] =
    useState<string[]>(BUTTON_ORDER);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);

  const toolbarRef = useRef<HTMLDivElement>(null);
  const measuredWidthsRef = useRef<Record<string, number>>({});
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isTableEmptyOfRows = !tableData || tableData.length === 0;
  const isAnyOperationPending = isPending && pendingOperation !== null;

  const getUniqueSelectedColumnIndices = useCallback((): number[] => {
    if (!selectedCells || selectedCells.length === 0) {
      if (selectedCell) return [selectedCell.colIndex];
      return [];
    }
    const uniqueIndices = [
      ...new Set(selectedCells.map((cell) => cell.colIndex)),
    ];
    return uniqueIndices.sort((a, b) => a - b);
  }, [selectedCells, selectedCell]);

  const getSelectedRowIndices = useCallback((): number[] => {
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
  }, [selectedCells, selectedCell]);

  const hasLockedCellsInSelectedRows = useCallback((): boolean => {
    const rows = getSelectedRowIndices();
    if (rows.length === 0 || !headers) {
      return false;
    }
    const numCols = headers.length;
    for (const rowIndex of rows) {
      for (let colIndex = 0; colIndex < numCols; colIndex++) {
        if (isCellLockedFn(rowIndex, colIndex)) {
          return true;
        }
      }
    }
    return false;
  }, [getSelectedRowIndices, headers, isCellLockedFn]);

  const hasLockedCellsInSelectedColumns = useCallback((): boolean => {
    const cols = getUniqueSelectedColumnIndices();
    if (cols.length === 0 || !tableData) {
      return false;
    }
    const numRows = tableData.length;
    for (const colIndex of cols) {
      for (let rowIndex = 0; rowIndex < numRows; rowIndex++) {
        if (isCellLockedFn(rowIndex, colIndex)) {
          return true;
        }
      }
    }
    return false;
  }, [getUniqueSelectedColumnIndices, tableData, isCellLockedFn]);

  const handleAddRowRelative = useCallback(
    (direction: "above" | "below") => {
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
        numRowsToAdd =
          uniqueSelectedRowIndices.length > 0
            ? uniqueSelectedRowIndices.length
            : 1;

        if (uniqueSelectedRowIndices.length > 0) {
          const minSelectedRowIndex = uniqueSelectedRowIndices[0];
          const maxSelectedRowIndex =
            uniqueSelectedRowIndices[uniqueSelectedRowIndices.length - 1];
          initialInsertIndex =
            direction === "above"
              ? minSelectedRowIndex
              : maxSelectedRowIndex + 1;
        } else {
          initialInsertIndex =
            direction === "above"
              ? selectedCell.rowIndex
              : selectedCell.rowIndex + 1;
        }
      } else if (currentIsTableEmptyOfRows) {
        numRowsToAdd = 1;
        initialInsertIndex = 0;
      } else {
        toast.info(
          "Please select a cell to add rows relative to, or the table must be empty of rows."
        );
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
    },
    [
      isTableLoaded,
      isAnyOperationPending,
      headers,
      tableData,
      selectedCell,
      getSelectedRowIndices,
      generateAndInsertRows,
    ]
  );

  const handleAddEmptyRowRelative = useCallback(
    (direction: "above" | "below") => {
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
        numRowsToAdd =
          uniqueSelectedRowIndices.length > 0
            ? uniqueSelectedRowIndices.length
            : 1;

        if (uniqueSelectedRowIndices.length > 0) {
          const minSelectedRowIndex = uniqueSelectedRowIndices[0];
          const maxSelectedRowIndex =
            uniqueSelectedRowIndices[uniqueSelectedRowIndices.length - 1];
          initialInsertIndex =
            direction === "above"
              ? minSelectedRowIndex
              : maxSelectedRowIndex + 1;
        } else {
          initialInsertIndex =
            direction === "above"
              ? selectedCell.rowIndex
              : selectedCell.rowIndex + 1;
        }
      } else if (currentIsTableEmptyOfRows) {
        numRowsToAdd = 1;
        initialInsertIndex = 0;
      } else {
        toast.info(
          "Please select a cell to add rows relative to, or the table must be empty of rows."
        );
        return;
      }

      setPendingOperation(
        direction === "above" ? "add-empty-row-above" : "add-empty-row-below"
      );

      startTransition(async () => {
        try {
          await insertEmptyRows(initialInsertIndex, numRowsToAdd);
        } catch (error) {
          console.error(
            `Critical error in handleAddEmptyRowRelative transition:`,
            error
          );
          toast.error(
            "A critical error occurred while preparing to add empty rows. Please try again."
          );
        } finally {
          setPendingOperation(null);
        }
      });
    },
    [
      isTableLoaded,
      isAnyOperationPending,
      headers,
      tableData,
      selectedCell,
      getSelectedRowIndices,
      insertEmptyRows,
    ]
  );

  const handleDeleteRows = useCallback(() => {
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
  }, [deleteRows, getSelectedRowIndices]);

  const handleAddColumnRelative = useCallback(
    (direction: "left" | "right") => {
      if (!isTableLoaded || isAnyOperationPending) return;

      let numColsToAdd = 1;
      let initialInsertIndex: number;
      const currentHeaders = headers || [];

      if (currentHeaders.length === 0) {
        numColsToAdd = 1;
        initialInsertIndex = 0;
      } else if (selectedCell) {
        const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();
        const isMultiColumnSelection =
          selectedCells.length > 1 &&
          new Set(selectedCells.map((s) => s.colIndex)).size > 1;

        numColsToAdd =
          isMultiColumnSelection && uniqueSelectedColIndices.length > 0
            ? uniqueSelectedColIndices.length
            : 1;

        if (uniqueSelectedColIndices.length > 0) {
          const minSelectedColIndex = uniqueSelectedColIndices[0];
          const maxSelectedColIndex =
            uniqueSelectedColIndices[uniqueSelectedColIndices.length - 1];
          initialInsertIndex =
            direction === "left"
              ? minSelectedColIndex
              : maxSelectedColIndex + 1;
        } else {
          initialInsertIndex =
            direction === "left"
              ? selectedCell.colIndex
              : selectedCell.colIndex + 1;
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
    },
    [
      isTableLoaded,
      isAnyOperationPending,
      headers,
      selectedCell,
      getUniqueSelectedColumnIndices,
      selectedCells,
      generateAndInsertColumns,
    ]
  );

  const handleAddEmptyColumn = useCallback(
    (direction: "left" | "right") => {
      if (!isTableLoaded || isAnyOperationPending) return;

      let numColsToAdd = 1;
      let initialInsertIndex: number;
      const currentHeaders = headers || [];

      if (currentHeaders.length === 0) {
        numColsToAdd = 1;
        initialInsertIndex = 0;
      } else if (selectedCell) {
        const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();
        const isMultiColumnSelection =
          selectedCells.length > 1 &&
          new Set(selectedCells.map((s) => s.colIndex)).size > 1;

        numColsToAdd =
          isMultiColumnSelection && uniqueSelectedColIndices.length > 0
            ? uniqueSelectedColIndices.length
            : 1;

        if (uniqueSelectedColIndices.length > 0) {
          const minSelectedColIndex = uniqueSelectedColIndices[0];
          const maxSelectedColIndex =
            uniqueSelectedColIndices[uniqueSelectedColIndices.length - 1];
          initialInsertIndex =
            direction === "left"
              ? minSelectedColIndex
              : maxSelectedColIndex + 1;
        } else {
          initialInsertIndex =
            direction === "left"
              ? selectedCell.colIndex
              : selectedCell.colIndex + 1;
        }
      } else {
        numColsToAdd = 1;
        initialInsertIndex = direction === "left" ? 0 : currentHeaders.length;
      }

      setPendingOperation(
        direction === "left"
          ? "add-empty-column-left"
          : "add-empty-column-right"
      );
      startTransition(async () => {
        try {
          await insertEmptyColumns(initialInsertIndex, numColsToAdd);
        } catch (error) {
          console.error("Error in handleAddEmptyColumn transition:", error);
          toast.error(
            "A critical error occurred while adding empty columns. Please try again."
          );
        } finally {
          setPendingOperation(null);
        }
      });
    },
    [
      isTableLoaded,
      isAnyOperationPending,
      headers,
      selectedCell,
      getUniqueSelectedColumnIndices,
      selectedCells,
      insertEmptyColumns,
    ]
  );

  const handleDeleteColumns = useCallback(() => {
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
  }, [deleteColumns, getUniqueSelectedColumnIndices]);

  const handleClearSelectedCells = useCallback(() => {
    if (!isTableLoaded || !headers || headers.length === 0) {
      return;
    }

    const cellsToClear =
      selectedCells.length > 0
        ? selectedCells
        : selectedCell
        ? [selectedCell]
        : [];

    if (cellsToClear.length === 0) {
      toast.info("No cells selected to clear.");
      return;
    }

    const lockedCells = cellsToClear.filter((cell) =>
      isCellLockedFn(cell.rowIndex, cell.colIndex)
    );
    if (lockedCells.length > 0) {
      toast.error("Cannot clear locked cells.");
      return;
    }

    try {
      cellsToClear.forEach((cell) => {
        const header = headers[cell.colIndex];
        if (header) {
          handleCellChange(cell.rowIndex, header, "");
        }
      });

      const cellCount = cellsToClear.length;
      toast.success(`Cleared ${cellCount} cell${cellCount === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error("Error clearing cells:", error);
      toast.error("Failed to clear cells. Please try again.");
    }
  }, [
    isTableLoaded,
    headers,
    selectedCells,
    selectedCell,
    isCellLockedFn,
    handleCellChange,
  ]);

  const handleDownloadCsv = useCallback(() => {
    if (!isTableLoaded || !headers || headers.length === 0 || !tableData) {
      console.warn("CSV Download aborted: No headers or table data.");
      return;
    }
    const escapeCsvCell = (cellData: unknown): string => {
      const stringValue = String(cellData ?? "");
      if (
        stringValue.includes(",") ||
        stringValue.includes("\n") ||
        stringValue.includes('"')
      ) {
        const escapedValue = stringValue.replace(/"/g, '""');
        return `"${escapedValue}"`;
      }
      return stringValue;
    };
    const csvHeader = headers.map(escapeCsvCell).join(",");
    const csvRows = tableData.map((row) => {
      return headers
        .map((header) => {
          const cellValue = row[header];
          return escapeCsvCell(cellValue);
        })
        .join(",");
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");
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
  }, [isTableLoaded, headers, tableData]);

  const handleUndo = useCallback(() => {
    if (undoManager && canUndo) {
      undoManager.undo();
    }
  }, [undoManager, canUndo]);

  const handleRedo = useCallback(() => {
    if (undoManager && canRedo) {
      undoManager.redo();
    }
  }, [undoManager, canRedo]);

  const selectedRowIndices = getSelectedRowIndices();
  const uniqueSelectedColIndices = getUniqueSelectedColumnIndices();

  let numSelectedRowsForLabel = 1;
  if (isTableEmptyOfRows && !selectedCell) {
    numSelectedRowsForLabel = 1;
  } else if (selectedRowIndices.length > 0) {
    numSelectedRowsForLabel = selectedRowIndices.length;
  } else if (selectedCell) {
    numSelectedRowsForLabel = 1;
  } else if (!isTableEmptyOfRows && !selectedCell) {
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
  const addEmptyRowAboveButtonLabel =
    numSelectedRowsForLabel <= 1
      ? "Add Empty Row Above"
      : `Add ${numSelectedRowsForLabel} Empty Rows Above`;
  const addEmptyRowBelowButtonLabel =
    numSelectedRowsForLabel <= 1
      ? "Add Empty Row Below"
      : `Add ${numSelectedRowsForLabel} Empty Rows Below`;
  const deleteRowsButtonLabel =
    selectedRowIndices.length <= 1
      ? "Delete Row"
      : `Delete ${selectedRowIndices.length} Rows`;

  const isTableEmptyOfColumns = !headers || headers.length === 0;
  let numColsForLabel = 1;
  if (isTableEmptyOfColumns && !selectedCell) {
    numColsForLabel = 1;
  } else if (
    uniqueSelectedColIndices.length > 0 &&
    new Set(selectedCells.map((s) => s.colIndex)).size > 1
  ) {
    numColsForLabel = uniqueSelectedColIndices.length;
  } else if (selectedCell) {
    numColsForLabel = 1;
  } else if (!isTableEmptyOfColumns && !selectedCell) {
    numColsForLabel = 1;
  }

  const addColLeftButtonLabel =
    numColsForLabel <= 1
      ? "Add Column to the Left"
      : `Add ${numColsForLabel} Columns to the Left`;
  const addEmptyColLeftButtonLabel =
    numColsForLabel <= 1
      ? "Add Empty Column Left"
      : `Add ${numColsForLabel} Empty Columns Left`;
  const addColRightButtonLabel =
    numColsForLabel <= 1
      ? "Add Column to the Right"
      : `Add ${numColsForLabel} Columns to the Right`;
  const addEmptyColRightButtonLabel =
    numColsForLabel <= 1
      ? "Add Empty Column Right"
      : `Add ${numColsForLabel} Empty Columns Right`;
  const deleteColButtonLabel =
    uniqueSelectedColIndices.length <= 1
      ? "Delete Selected Column"
      : `Delete ${uniqueSelectedColIndices.length} Columns`;

  const cellsToClear =
    selectedCells.length > 0
      ? selectedCells
      : selectedCell
      ? [selectedCell]
      : [];
  const clearCellsButtonLabel =
    cellsToClear.length <= 1
      ? "Clear Selected Cell"
      : `Clear ${cellsToClear.length} Selected Cells`;

  const canAddRows =
    isTableLoaded && !isAnyOperationPending && headers && headers.length > 0;
  const canAddColumns = isTableLoaded && !isAnyOperationPending;
  const canDeleteRow =
    isTableLoaded &&
    !isAnyOperationPending &&
    selectedRowIndices.length > 0 &&
    !hasLockedCellsInSelectedRows();
  const canDeleteColumn =
    isTableLoaded &&
    !isAnyOperationPending &&
    uniqueSelectedColIndices.length > 0 &&
    !hasLockedCellsInSelectedColumns();
  const canClearCells =
    isTableLoaded &&
    !isAnyOperationPending &&
    cellsToClear.length > 0 &&
    !cellsToClear.some((cell) => isCellLockedFn(cell.rowIndex, cell.colIndex));
  const canDownload =
    isTableLoaded &&
    headers &&
    headers.length > 0 &&
    tableData &&
    tableData.length > 0;

  const isAddColumnLeftPending =
    isPending && pendingOperation === "add-column-left";
  const isAddEmptyColumnLeftPending =
    isPending && pendingOperation === "add-empty-column-left";
  const isAddColumnRightPending =
    isPending && pendingOperation === "add-column-right";
  const isAddEmptyColumnRightPending =
    isPending && pendingOperation === "add-empty-column-right";
  const isAddRowAbovePending =
    isPending && pendingOperation === "add-row-above";
  const isAddEmptyRowAbovePending =
    isPending && pendingOperation === "add-empty-row-above";
  const isAddRowBelowPending =
    isPending && pendingOperation === "add-row-below";
  const isAddEmptyRowBelowPending =
    isPending && pendingOperation === "add-empty-row-below";

  const buttonConfigs = useMemo(
    () => ({
      [BUTTON_TYPES.UNDO]: {
        icon: <Undo className="h-4 w-4" />,
        label: "Undo (Ctrl+Z)",
        onClick: handleUndo,
        disabled: !canUndo || isAnyOperationPending,
      },
      [BUTTON_TYPES.REDO]: {
        icon: <Redo className="h-4 w-4" />,
        label: "Redo (Ctrl+Y / Ctrl+Shift+Z)",
        onClick: handleRedo,
        disabled: !canRedo || isAnyOperationPending,
      },
      [BUTTON_TYPES.ADD_ROW_ABOVE]: {
        icon: isAddRowAbovePending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpFromLine className="h-4 w-4" />
        ),
        label: addRowAboveButtonLabel,
        onClick: () => handleAddRowRelative("above"),
        disabled:
          !canAddRows ||
          isAddRowBelowPending ||
          isAddEmptyRowBelowPending ||
          isAddEmptyRowAbovePending,
      },
      [BUTTON_TYPES.ADD_EMPTY_ROW_ABOVE]: {
        icon: isAddEmptyRowAbovePending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowUpFromLine className="h-4 w-4" />
        ),
        label: addEmptyRowAboveButtonLabel,
        onClick: () => handleAddEmptyRowRelative("above"),
        disabled:
          !canAddRows ||
          isAddRowBelowPending ||
          isAddEmptyRowBelowPending ||
          isAddRowAbovePending,
      },
      [BUTTON_TYPES.ADD_ROW_BELOW]: {
        icon: isAddRowBelowPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowDownToLine className="h-4 w-4" />
        ),
        label: addRowBelowButtonLabel,
        onClick: () => handleAddRowRelative("below"),
        disabled:
          !canAddRows ||
          isAddRowAbovePending ||
          isAddEmptyRowAbovePending ||
          isAddEmptyRowBelowPending,
      },
      [BUTTON_TYPES.ADD_EMPTY_ROW_BELOW]: {
        icon: isAddEmptyRowBelowPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowDownToLine className="h-4 w-4" />
        ),
        label: addEmptyRowBelowButtonLabel,
        onClick: () => handleAddEmptyRowRelative("below"),
        disabled:
          !canAddRows ||
          isAddRowAbovePending ||
          isAddEmptyRowAbovePending ||
          isAddRowBelowPending,
      },
      [BUTTON_TYPES.DELETE_ROWS]: {
        icon: (
          <>
            <Trash2 className="h-4 w-4 mr-1" />
            <Rows3 className="h-4 w-4" />
          </>
        ),
        label: deleteRowsButtonLabel,
        onClick: handleDeleteRows,
        disabled: !canDeleteRow,
      },
      [BUTTON_TYPES.ADD_COL_LEFT]: {
        icon: isAddColumnLeftPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowLeftFromLine className="h-4 w-4" />
        ),
        label: addColLeftButtonLabel,
        onClick: () => handleAddColumnRelative("left"),
        disabled:
          !canAddColumns ||
          isAddColumnRightPending ||
          isAddEmptyColumnRightPending ||
          isAddEmptyColumnLeftPending,
      },
      [BUTTON_TYPES.ADD_EMPTY_COL_LEFT]: {
        icon: isAddEmptyColumnLeftPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowLeftFromLine className="h-4 w-4" />
        ),
        label: addEmptyColLeftButtonLabel,
        onClick: () => handleAddEmptyColumn("left"),
        disabled:
          !canAddColumns ||
          isAddColumnRightPending ||
          isAddEmptyColumnRightPending ||
          isAddColumnLeftPending,
      },
      [BUTTON_TYPES.ADD_COL_RIGHT]: {
        icon: isAddColumnRightPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightFromLine className="h-4 w-4" />
        ),
        label: addColRightButtonLabel,
        onClick: () => handleAddColumnRelative("right"),
        disabled:
          !canAddColumns ||
          isAddColumnLeftPending ||
          isAddEmptyColumnLeftPending ||
          isAddEmptyColumnRightPending,
      },
      [BUTTON_TYPES.ADD_EMPTY_COL_RIGHT]: {
        icon: isAddEmptyColumnRightPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightFromLine className="h-4 w-4" />
        ),
        label: addEmptyColRightButtonLabel,
        onClick: () => handleAddEmptyColumn("right"),
        disabled:
          !canAddColumns ||
          isAddColumnLeftPending ||
          isAddEmptyColumnLeftPending ||
          isAddColumnRightPending,
      },
      [BUTTON_TYPES.DELETE_COLS]: {
        icon: (
          <>
            <Trash2 className="h-4 w-4 mr-1" />
            <Columns3 className="h-4 w-4" />
          </>
        ),
        label: deleteColButtonLabel,
        onClick: handleDeleteColumns,
        disabled: !canDeleteColumn,
      },
      [BUTTON_TYPES.CLEAR_CELLS]: {
        icon: <Eraser className="h-4 w-4" />,
        label: clearCellsButtonLabel,
        onClick: handleClearSelectedCells,
        disabled: !canClearCells,
      },
      [BUTTON_TYPES.DOWNLOAD]: {
        icon: <Download className="h-4 w-4" />,
        label: "Download CSV",
        onClick: handleDownloadCsv,
        disabled: !canDownload || isAnyOperationPending,
      },
    }),
    [
      handleUndo,
      canUndo,
      isAnyOperationPending,
      handleRedo,
      canRedo,
      isAddRowAbovePending,
      addRowAboveButtonLabel,
      canAddRows,
      isAddRowBelowPending,
      isAddEmptyRowBelowPending,
      isAddEmptyRowAbovePending,
      addEmptyRowAboveButtonLabel,
      addRowBelowButtonLabel,
      addEmptyRowBelowButtonLabel,
      deleteRowsButtonLabel,
      handleDeleteRows,
      canDeleteRow,
      isAddColumnLeftPending,
      addColLeftButtonLabel,
      canAddColumns,
      isAddColumnRightPending,
      isAddEmptyColumnRightPending,
      isAddEmptyColumnLeftPending,
      addEmptyColLeftButtonLabel,
      addColRightButtonLabel,
      addEmptyColRightButtonLabel,
      deleteColButtonLabel,
      handleDeleteColumns,
      canDeleteColumn,
      clearCellsButtonLabel,
      handleDownloadCsv,
      canDownload,
      handleAddRowRelative,
      handleAddEmptyRowRelative,
      handleAddColumnRelative,
      handleAddEmptyColumn,
      handleClearSelectedCells,
      canClearCells,
    ]
  );

  const calculateVisibleButtons = useCallback(() => {
    if (!toolbarRef.current) return;

    const toolbarWidth = toolbarRef.current.offsetWidth;
    const overflowButtonWidth = 48;
    const padding = 16;
    const gapWidth = 4;

    let currentWidth = 0;
    const visible: string[] = [];
    let hasHiddenButtons = false;

    let totalWidthNeeded = 0;
    for (let i = 0; i < BUTTON_ORDER.length; i++) {
      const buttonId = BUTTON_ORDER[i];
      const buttonWidth =
        measuredWidthsRef.current[buttonId] || ESTIMATED_WIDTHS[buttonId] || 36;
      totalWidthNeeded += buttonWidth;
      if (i > 0) totalWidthNeeded += gapWidth;
    }

    if (totalWidthNeeded + padding <= toolbarWidth) {
      setShowOverflowMenu(false);
      setVisibleButtonIds(BUTTON_ORDER);
      return;
    }

    const availableWidth =
      toolbarWidth - padding - overflowButtonWidth - gapWidth;

    for (let i = 0; i < BUTTON_ORDER.length; i++) {
      const buttonId = BUTTON_ORDER[i];
      const buttonWidth =
        measuredWidthsRef.current[buttonId] || ESTIMATED_WIDTHS[buttonId] || 36;
      const widthWithGap = buttonWidth + (i > 0 ? gapWidth : 0);

      if (currentWidth + widthWithGap <= availableWidth) {
        visible.push(buttonId);
        currentWidth += widthWithGap;
      } else {
        hasHiddenButtons = true;
        break;
      }
    }
    setShowOverflowMenu((prev) => {
      if (prev !== hasHiddenButtons) return hasHiddenButtons;
      return prev;
    });

    setVisibleButtonIds((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(visible)) return visible;
      return prev;
    });
  }, []);

  useEffect(() => {
    const measureButtons = () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.visibility = "hidden";
      tempContainer.style.display = "flex";
      tempContainer.style.gap = "4px";
      tempContainer.style.padding = "4px";
      tempContainer.className = "rounded-md border border-input bg-transparent";
      document.body.appendChild(tempContainer);

      BUTTON_ORDER.forEach((buttonId) => {
        if (buttonId.startsWith("separator-")) {
          measuredWidthsRef.current[buttonId] = 17;
        } else if (buttonId === BUTTON_TYPES.AI_FILL) {
          measuredWidthsRef.current[buttonId] = 120;
        } else if (buttonId === BUTTON_TYPES.LOCK) {
          measuredWidthsRef.current[buttonId] = 40;
        } else {
          const tempButton = document.createElement("button");
          tempButton.className =
            "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3";

          if (buttonId === BUTTON_TYPES.ADD_COLUMN_GROUP) {
            measuredWidthsRef.current[buttonId] =
              ESTIMATED_WIDTHS[buttonId] || 120;
            return;
          }

          const iconSpan = document.createElement("span");
          iconSpan.style.width = "16px";
          iconSpan.style.height = "16px";
          iconSpan.style.display = "inline-block";
          tempButton.appendChild(iconSpan);

          tempContainer.appendChild(tempButton);
          void tempContainer.offsetHeight;

          const computedStyle = window.getComputedStyle(tempButton);
          const width =
            tempButton.offsetWidth +
            parseFloat(computedStyle.marginLeft) +
            parseFloat(computedStyle.marginRight);

          measuredWidthsRef.current[buttonId] = Math.ceil(width);
          tempContainer.removeChild(tempButton);
        }
      });

      document.body.removeChild(tempContainer);
      calculateVisibleButtons();
    };
    const timeoutId = setTimeout(measureButtons, 100);
    return () => clearTimeout(timeoutId);
  }, [calculateVisibleButtons]);

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") {
      setVisibleButtonIds(BUTTON_ORDER);
      setShowOverflowMenu(false);
      return;
    }
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = setTimeout(() => {
        calculateVisibleButtons();
      }, 100);
    };
    const observer = new ResizeObserver(handleResize);
    if (toolbarRef.current) {
      observer.observe(toolbarRef.current);
    }
    return () => {
      observer.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [calculateVisibleButtons]);

  useEffect(() => {
    if (!undoManager) return;
    const updateUndoRedoState = () => {
      setCanUndo(undoManager.undoStack.length > 0);
      setCanRedo(undoManager.redoStack.length > 0);
    };
    updateUndoRedoState();
    undoManager.on("stack-item-added", updateUndoRedoState);
    undoManager.on("stack-item-popped", updateUndoRedoState);
    return () => {
      undoManager.off("stack-item-added", updateUndoRedoState);
      undoManager.off("stack-item-popped", updateUndoRedoState);
    };
  }, [undoManager]);

  const renderButton = (buttonId: string, isInDropdown = false) => {
    if (buttonId.startsWith("separator-")) {
      if (isInDropdown) {
        return <DropdownMenuSeparator key={buttonId} />;
      }
      return (
        <Separator key={buttonId} orientation="vertical" className="h-6 mx-1" />
      );
    }

    if (buttonId === BUTTON_TYPES.AI_FILL) {
      if (isInDropdown) {
        return (
          <div key={buttonId} className="px-2 py-1.5">
            <AiFillSelectionButton />
          </div>
        );
      }
      return <AiFillSelectionButton key={buttonId} />;
    }

    if (buttonId === BUTTON_TYPES.LOCK) {
      if (isInDropdown) {
        return (
          <div key={buttonId} className="px-2 py-1.5">
            <LockButton />
          </div>
        );
      }
      return <LockButton key={buttonId} />;
    }

    if (buttonId === BUTTON_TYPES.ADD_COLUMN_GROUP) {
      const aiLeftConfig = buttonConfigs[BUTTON_TYPES.ADD_COL_LEFT];
      const aiRightConfig = buttonConfigs[BUTTON_TYPES.ADD_COL_RIGHT];
      const emptyLeftConfig = buttonConfigs[BUTTON_TYPES.ADD_EMPTY_COL_LEFT];
      const emptyRightConfig = buttonConfigs[BUTTON_TYPES.ADD_EMPTY_COL_RIGHT];

      if (
        !aiLeftConfig ||
        !aiRightConfig ||
        !emptyLeftConfig ||
        !emptyRightConfig
      )
        return null;

      const anySubActionPending =
        isPending &&
        (pendingOperation === "add-column-left" ||
          pendingOperation === "add-empty-column-left" ||
          pendingOperation === "add-column-right" ||
          pendingOperation === "add-empty-column-right");

      if (isInDropdown) {
        return (
          <React.Fragment key={buttonId}>
            <DropdownMenuItem
              onClick={aiLeftConfig.onClick}
              disabled={aiLeftConfig.disabled || anySubActionPending}
            >
              {aiLeftConfig.icon}{" "}
              <span className="ml-2">{aiLeftConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={aiRightConfig.onClick}
              disabled={aiRightConfig.disabled || anySubActionPending}
            >
              {aiRightConfig.icon}{" "}
              <span className="ml-2">{aiRightConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={emptyLeftConfig.onClick}
              disabled={emptyLeftConfig.disabled || anySubActionPending}
            >
              {emptyLeftConfig.icon}{" "}
              <span className="ml-2">{emptyLeftConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={emptyRightConfig.onClick}
              disabled={emptyRightConfig.disabled || anySubActionPending}
            >
              {emptyRightConfig.icon}{" "}
              <span className="ml-2">{emptyRightConfig.label}</span>
            </DropdownMenuItem>
          </React.Fragment>
        );
      } else {
        return (
          <ButtonGroup key={buttonId} orientation="horizontal">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={aiLeftConfig.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aiLeftConfig.onClick();
                  }}
                  disabled={
                    aiLeftConfig.disabled ||
                    isAddColumnRightPending ||
                    isAddEmptyColumnRightPending ||
                    isAddEmptyColumnLeftPending
                  }
                  className="rounded-r-none"
                >
                  {aiLeftConfig.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{aiLeftConfig.label}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={aiRightConfig.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aiRightConfig.onClick();
                  }}
                  disabled={
                    aiRightConfig.disabled ||
                    isAddColumnLeftPending ||
                    isAddEmptyColumnLeftPending ||
                    isAddEmptyColumnRightPending
                  }
                  className="rounded-none border-l-0"
                >
                  {aiRightConfig.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{aiRightConfig.label}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="More add column options"
                      disabled={
                        !canAddColumns ||
                        anySubActionPending ||
                        isAddColumnLeftPending ||
                        isAddColumnRightPending
                      }
                      className="rounded-l-none border-l-0 px-2"
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" data-preserve-selection="true">
                <DropdownMenuItem
                  onClick={emptyLeftConfig.onClick}
                  disabled={emptyLeftConfig.disabled || anySubActionPending}
                >
                  {emptyLeftConfig.icon}{" "}
                  <span className="ml-2">{emptyLeftConfig.label}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={emptyRightConfig.onClick}
                  disabled={emptyRightConfig.disabled || anySubActionPending}
                >
                  {emptyRightConfig.icon}{" "}
                  <span className="ml-2">{emptyRightConfig.label}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        );
      }
    }

    if (buttonId === BUTTON_TYPES.ADD_ROW_GROUP) {
      const aiAboveConfig = buttonConfigs[BUTTON_TYPES.ADD_ROW_ABOVE];
      const aiBelowConfig = buttonConfigs[BUTTON_TYPES.ADD_ROW_BELOW];
      const emptyAboveConfig = buttonConfigs[BUTTON_TYPES.ADD_EMPTY_ROW_ABOVE];
      const emptyBelowConfig = buttonConfigs[BUTTON_TYPES.ADD_EMPTY_ROW_BELOW];

      if (
        !aiAboveConfig ||
        !aiBelowConfig ||
        !emptyAboveConfig ||
        !emptyBelowConfig
      )
        return null;

      const anySubActionPending =
        isPending &&
        (pendingOperation === "add-row-above" ||
          pendingOperation === "add-empty-row-above" ||
          pendingOperation === "add-row-below" ||
          pendingOperation === "add-empty-row-below");

      if (isInDropdown) {
        return (
          <React.Fragment key={buttonId}>
            <DropdownMenuItem
              onClick={aiAboveConfig.onClick}
              disabled={aiAboveConfig.disabled || anySubActionPending}
            >
              {aiAboveConfig.icon}{" "}
              <span className="ml-2">{aiAboveConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={aiBelowConfig.onClick}
              disabled={aiBelowConfig.disabled || anySubActionPending}
            >
              {aiBelowConfig.icon}{" "}
              <span className="ml-2">{aiBelowConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={emptyAboveConfig.onClick}
              disabled={emptyAboveConfig.disabled || anySubActionPending}
            >
              {emptyAboveConfig.icon}{" "}
              <span className="ml-2">{emptyAboveConfig.label}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={emptyBelowConfig.onClick}
              disabled={emptyBelowConfig.disabled || anySubActionPending}
            >
              {emptyBelowConfig.icon}{" "}
              <span className="ml-2">{emptyBelowConfig.label}</span>
            </DropdownMenuItem>
          </React.Fragment>
        );
      } else {
        return (
          <ButtonGroup key={buttonId} orientation="horizontal">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={aiAboveConfig.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aiAboveConfig.onClick();
                  }}
                  disabled={
                    aiAboveConfig.disabled ||
                    isAddRowBelowPending ||
                    isAddEmptyRowBelowPending ||
                    isAddEmptyRowAbovePending
                  }
                  className="rounded-r-none"
                >
                  {aiAboveConfig.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{aiAboveConfig.label}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={aiBelowConfig.label}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    aiBelowConfig.onClick();
                  }}
                  disabled={
                    aiBelowConfig.disabled ||
                    isAddRowAbovePending ||
                    isAddEmptyRowAbovePending ||
                    isAddEmptyRowBelowPending
                  }
                  className="rounded-none border-l-0"
                >
                  {aiBelowConfig.icon}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{aiBelowConfig.label}</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="More add row options"
                      disabled={
                        !canAddRows ||
                        anySubActionPending ||
                        isAddRowAbovePending ||
                        isAddRowBelowPending
                      }
                      className="rounded-l-none border-l-0 px-2"
                    >
                      <ChevronDownIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>More options</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" data-preserve-selection="true">
                <DropdownMenuItem
                  onClick={emptyAboveConfig.onClick}
                  disabled={emptyAboveConfig.disabled || anySubActionPending}
                >
                  {emptyAboveConfig.icon}{" "}
                  <span className="ml-2">{emptyAboveConfig.label}</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={emptyBelowConfig.onClick}
                  disabled={emptyBelowConfig.disabled || anySubActionPending}
                >
                  {emptyBelowConfig.icon}{" "}
                  <span className="ml-2">{emptyBelowConfig.label}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        );
      }
    }

    const config = buttonConfigs[buttonId as keyof typeof buttonConfigs];
    if (!config) {
      if (
        !isInDropdown &&
        (buttonId === BUTTON_TYPES.ADD_COL_LEFT ||
          buttonId === BUTTON_TYPES.ADD_COL_RIGHT ||
          buttonId === BUTTON_TYPES.ADD_ROW_ABOVE ||
          buttonId === BUTTON_TYPES.ADD_ROW_BELOW)
      ) {
        return null;
      }
      console.warn(`Config not found for buttonId: ${buttonId}`);
      return null;
    }

    if (isInDropdown) {
      return (
        <DropdownMenuItem
          key={buttonId}
          onClick={config.onClick}
          disabled={config.disabled}
        >
          {config.icon}
          <span className="ml-2">{config.label}</span>
        </DropdownMenuItem>
      );
    }

    return (
      <Tooltip key={buttonId}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={config.label}
            onMouseDown={(e) => {
              e.preventDefault();
              config.onClick();
            }}
            disabled={config.disabled}
          >
            {config.icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{config.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        ref={toolbarRef}
        data-preserve-selection="true"
        className="relative flex overflow-hidden items-center gap-1 rounded-md border border-input bg-transparent p-1 mb-2"
      >
        <div className="flex items-center gap-1 flex-1">
          {visibleButtonIds.map((buttonId) => renderButton(buttonId))}
        </div>

        {showOverflowMenu && (
          <div className="absolute right-1 top-1 bottom-1 bg-inherit">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="More options"
                  className="h-full"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" data-preserve-selection="true">
                {BUTTON_ORDER.filter(
                  (buttonId) => !visibleButtonIds.includes(buttonId)
                ).map((buttonId) => renderButton(buttonId, true))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default LiveTableToolbar;
