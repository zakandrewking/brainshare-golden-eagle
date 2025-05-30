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
  Columns3,
  Download,
  Loader2,
  MoreVertical,
  Redo,
  Rows3,
  Trash2,
  Undo,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import { useSelectedCells, useSelectionStore } from "@/stores/selectionStore";

import { AiFillSelectionButton } from "./AiFillSelectionButton";
import { useLiveTable } from "./LiveTableProvider";
import LockButton from "./LockButton";

// Define the possible pending operations
type PendingOperation =
  | "add-row-above"
  | "add-row-below"
  | "add-column-left"
  | "add-column-right"
  | null;

// Button type constants
const BUTTON_TYPES = {
  UNDO: "undo",
  REDO: "redo",
  ADD_ROW_ABOVE: "add-row-above",
  ADD_ROW_BELOW: "add-row-below",
  DELETE_ROWS: "delete-rows",
  ADD_COL_LEFT: "add-column-left",
  ADD_COL_RIGHT: "add-column-right",
  DELETE_COLS: "delete-columns",
  AI_FILL: "ai-fill",
  LOCK: "lock",
  DOWNLOAD: "download",
} as const;

// Static button configuration
const BUTTON_ORDER = [
  BUTTON_TYPES.UNDO,
  BUTTON_TYPES.REDO,
  "separator-1",
  BUTTON_TYPES.ADD_ROW_ABOVE,
  BUTTON_TYPES.ADD_ROW_BELOW,
  BUTTON_TYPES.DELETE_ROWS,
  "separator-2",
  BUTTON_TYPES.ADD_COL_LEFT,
  BUTTON_TYPES.ADD_COL_RIGHT,
  BUTTON_TYPES.DELETE_COLS,
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
  [BUTTON_TYPES.DELETE_ROWS]: 52,
  [BUTTON_TYPES.ADD_COL_LEFT]: 48,
  [BUTTON_TYPES.ADD_COL_RIGHT]: 48,
  [BUTTON_TYPES.DELETE_COLS]: 64,
  [BUTTON_TYPES.AI_FILL]: 100,
  [BUTTON_TYPES.LOCK]: 83,
  [BUTTON_TYPES.DOWNLOAD]: 36,
  "separator-1": 16,
  "separator-2": 16,
  "separator-3": 16,
  "separator-4": 16,
};

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
    isCellLocked,
  } = useLiveTable();

  const selectedCell = useSelectionStore((state) => state.selectedCell);
  const selectedCells = useSelectedCells();

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
  // For disabling buttons, check for any pending operations
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

  const hasAnySelectedCellLocked = useCallback((): boolean => {
    if (!selectedCells || selectedCells.length === 0) {
      if (selectedCell) {
        return isCellLocked(selectedCell.rowIndex, selectedCell.colIndex);
      }
      return false;
    }
    return selectedCells.some((cell) =>
      isCellLocked(cell.rowIndex, cell.colIndex)
    );
  }, [selectedCells, selectedCell, isCellLocked]);

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
        // Table has columns, rows, but no cell selected
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

  // --- CSV Download Handler ---
  const handleDownloadCsv = useCallback(() => {
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

  let numSelectedRowsForLabel = 1; // Default for adding a single row
  if (isTableEmptyOfRows && !selectedCell) {
    numSelectedRowsForLabel = 1;
  } else if (selectedRowIndices.length > 0) {
    numSelectedRowsForLabel = selectedRowIndices.length;
  } else if (selectedCell) {
    // Single cell selected, not part of a multi-row selection for adding
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
  } else if (
    uniqueSelectedColIndices.length > 0 &&
    new Set(selectedCells.map((s) => s.colIndex)).size > 1
  ) {
    // Multiple distinct columns selected
    numColsForLabel = uniqueSelectedColIndices.length;
  } else if (selectedCell) {
    // Single cell or single column selection
    numColsForLabel = 1;
  } else if (!isTableEmptyOfColumns && !selectedCell) {
    // Has columns, no selection
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
  const canAddRows =
    isTableLoaded && !isAnyOperationPending && headers && headers.length > 0;
  const canAddColumns = isTableLoaded && !isAnyOperationPending;
  const canDeleteRow =
    isTableLoaded &&
    !isAnyOperationPending &&
    selectedRowIndices.length > 0 &&
    !hasAnySelectedCellLocked();
  const canDeleteColumn =
    isTableLoaded &&
    !isAnyOperationPending &&
    uniqueSelectedColIndices.length > 0 &&
    !hasAnySelectedCellLocked();
  const canDownload =
    isTableLoaded &&
    headers &&
    headers.length > 0 &&
    tableData &&
    tableData.length > 0;

  const isAddColumnLeftPending =
    isPending && pendingOperation === "add-column-left";
  const isAddColumnRightPending =
    isPending && pendingOperation === "add-column-right";

  // Memoize button configurations
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
        icon:
          isPending && pendingOperation === "add-row-above" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUpFromLine className="h-4 w-4" />
          ),
        label: addRowAboveButtonLabel,
        onClick: () => handleAddRowRelative("above"),
        disabled: !canAddRows,
      },
      [BUTTON_TYPES.ADD_ROW_BELOW]: {
        icon:
          isPending && pendingOperation === "add-row-below" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDownToLine className="h-4 w-4" />
          ),
        label: addRowBelowButtonLabel,
        onClick: () => handleAddRowRelative("below"),
        disabled: !canAddRows,
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
        disabled: !canAddColumns || isAddColumnRightPending,
      },
      [BUTTON_TYPES.ADD_COL_RIGHT]: {
        icon: isAddColumnRightPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ArrowRightFromLine className="h-4 w-4" />
        ),
        label: addColRightButtonLabel,
        onClick: () => handleAddColumnRelative("right"),
        disabled: !canAddColumns || isAddColumnLeftPending,
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
      [BUTTON_TYPES.DOWNLOAD]: {
        icon: <Download className="h-4 w-4" />,
        label: "Download CSV",
        onClick: handleDownloadCsv,
        disabled: !canDownload || isAnyOperationPending,
      },
    }),
    [canUndo, canRedo, isAnyOperationPending, isPending, pendingOperation, addRowAboveButtonLabel, addRowBelowButtonLabel, deleteRowsButtonLabel, addColLeftButtonLabel, addColRightButtonLabel, deleteColButtonLabel, canAddRows, canAddColumns, canDeleteRow, canDeleteColumn, canDownload, isAddColumnLeftPending, isAddColumnRightPending, handleUndo, handleRedo, handleAddRowRelative, handleDeleteRows, handleAddColumnRelative, handleDeleteColumns, handleDownloadCsv]
  );

  // Calculate which buttons should be visible
  const calculateVisibleButtons = useCallback(() => {
    if (!toolbarRef.current) return;

    const toolbarWidth = toolbarRef.current.offsetWidth;
    const overflowButtonWidth = 48; // Width of the overflow button
    const padding = 16; // Toolbar padding (8px on each side)
    const gapWidth = 4; // Gap between buttons

    let currentWidth = 0;
    const visible: string[] = [];
    let hasHiddenButtons = false;

    // Calculate total width needed for all buttons
    let totalWidthNeeded = 0;
    for (let i = 0; i < BUTTON_ORDER.length; i++) {
      const buttonId = BUTTON_ORDER[i];
      const buttonWidth =
        measuredWidthsRef.current[buttonId] || ESTIMATED_WIDTHS[buttonId] || 36;
      totalWidthNeeded += buttonWidth;
      if (i > 0) totalWidthNeeded += gapWidth; // Add gap except for first button
    }

    // If all buttons fit, show them all
    if (totalWidthNeeded + padding <= toolbarWidth) {
      setShowOverflowMenu(false);
      setVisibleButtonIds(BUTTON_ORDER);
      return;
    }

    // Otherwise, calculate which buttons can fit with overflow button
    const availableWidth =
      toolbarWidth - padding - overflowButtonWidth - gapWidth; // Reserve space for overflow button and gap

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

    // Only update state if values have changed
    setShowOverflowMenu((prev) => {
      if (prev !== hasHiddenButtons) return hasHiddenButtons;
      return prev;
    });

    setVisibleButtonIds((prev) => {
      if (JSON.stringify(prev) !== JSON.stringify(visible)) return visible;
      return prev;
    });
  }, []);

  // Initial measurement of button widths
  useEffect(() => {
    const measureButtons = () => {
      const toolbar = toolbarRef.current;
      if (!toolbar) return;

      const tempContainer = document.createElement("div");
      tempContainer.style.position = "absolute";
      tempContainer.style.visibility = "hidden";
      tempContainer.style.display = "flex";
      tempContainer.style.gap = "4px";
      tempContainer.style.padding = "4px"; // Match toolbar padding
      tempContainer.className = "rounded-md border border-input bg-transparent";
      document.body.appendChild(tempContainer);

      BUTTON_ORDER.forEach((buttonId) => {
        if (buttonId.startsWith("separator-")) {
          // Separators: 1px width + 8px margin (4px on each side)
          measuredWidthsRef.current[buttonId] = 17; // 1 + 8 + 8
        } else if (buttonId === BUTTON_TYPES.AI_FILL) {
          // AI Fill button is wider - measure more accurately
          measuredWidthsRef.current[buttonId] = 120;
        } else if (buttonId === BUTTON_TYPES.LOCK) {
          // Lock button
          measuredWidthsRef.current[buttonId] = 40;
        } else {
          // Regular buttons - create a temporary button to measure
          const tempButton = document.createElement("button");
          tempButton.className =
            "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-9 px-3";

          // Add icon placeholder
          const iconSpan = document.createElement("span");
          iconSpan.style.width = "16px";
          iconSpan.style.height = "16px";
          iconSpan.style.display = "inline-block";
          tempButton.appendChild(iconSpan);

          tempContainer.appendChild(tempButton);

          // Force layout calculation
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

    // Delay measurement to ensure styles are loaded
    const timeoutId = setTimeout(measureButtons, 100);
    return () => clearTimeout(timeoutId);
  }, [calculateVisibleButtons]);

  // Set up ResizeObserver with debouncing
  useEffect(() => {
    // Check if ResizeObserver is available (not available in some test environments)
    if (typeof ResizeObserver === "undefined") {
      // Fallback: show all buttons if ResizeObserver is not available
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

    const config = buttonConfigs[buttonId as keyof typeof buttonConfigs];
    if (!config) return null;

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
        className="relative flex overflow-hidden items-center gap-1 rounded-md border border-input bg-transparent p-1 mb-2"
      >
        {/* Visible buttons */}
        <div className="flex items-center gap-1 flex-1">
          {visibleButtonIds.map((buttonId) => renderButton(buttonId))}
        </div>

        {/* Overflow menu - positioned absolutely to the right */}
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
              <DropdownMenuContent align="end">
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
