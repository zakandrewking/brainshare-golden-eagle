import { useEffect } from "react";

import {
  useEditingCell,
  useHandleCellChange,
  useHeaders,
  useIsCellLockedFn,
  useSetEditingCell,
  useTableData,
  useTableRef,
} from "@/stores/dataStore";
import {
  useClearSelection,
  useIsSelecting,
  useSelectedCell,
  useSelectedCells,
  useSelectionEnd,
  useSelectionStartOrMove,
} from "@/stores/selectionStore";

export default function SelectionListeners() {
  const selectedCell = useSelectedCell();
  const selectionStartOrMove = useSelectionStartOrMove();
  const endSelection = useSelectionEnd();
  const clearSelection = useClearSelection();
  const isSelecting = useIsSelecting();
  const selectedCells = useSelectedCells();

  const editingCell = useEditingCell();
  const headers = useHeaders();
  const tableData = useTableData();
  const setEditingCell = useSetEditingCell();
  const handleCellChange = useHandleCellChange();
  const isCellLockedFn = useIsCellLockedFn();
  const tableRef = useTableRef();

  useEffect(() => {
    if (!isSelecting) return;

    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!tableRef?.current) return;

      if (typeof document.elementFromPoint !== "function") {
        return;
      }

      const cellElement = document.elementFromPoint(
        event.clientX,
        event.clientY
      ) as HTMLElement;

      const cell = cellElement?.closest("td");
      if (!cell) return;

      const rowIndex = parseInt(
        cell.getAttribute("data-row-index") || "-1",
        10
      );
      const colIndex = parseInt(
        cell.getAttribute("data-col-index") || "-1",
        10
      );

      if (rowIndex >= 0 && colIndex >= 0) {
        selectionStartOrMove(rowIndex, colIndex, true);
      }
    };

    const handleGlobalMouseUp = () => {
      endSelection();
    };

    document.addEventListener("mousemove", handleGlobalMouseMove);
    document.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleGlobalMouseMove);
      document.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [isSelecting, selectionStartOrMove, endSelection, tableRef]);

  // Effect to handle clicks outside the table
  useEffect(() => {
    const handleInteractionOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      const isInsideTable =
        tableRef?.current && tableRef.current.contains(target);
      const shouldPreserveSelection = !!target.closest(
        '[data-preserve-selection="true"]'
      );

      if (!isInsideTable && selectedCell && !shouldPreserveSelection) {
        clearSelection();
      }
    };

    document.addEventListener("mousedown", handleInteractionOutside);
    return () => {
      document.removeEventListener("mousedown", handleInteractionOutside);
    };
  }, [selectedCell, clearSelection, tableRef]);

  //   Effect to handle keyboard input for immediate edit mode
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle if we have a single cell selected and not already editing
      if (!selectedCell || editingCell || !headers || !tableData) {
        return;
      }

      // Check if we have a single cell selection (not a range)
      const isSingleCellSelected =
        selectedCells &&
        selectedCells.length === 1 &&
        selectedCells[0].rowIndex === selectedCell.rowIndex &&
        selectedCells[0].colIndex === selectedCell.colIndex;

      if (!isSingleCellSelected) {
        return;
      }

      // Don't handle if the cell is locked
      if (isCellLockedFn(selectedCell.rowIndex, selectedCell.colIndex)) {
        return;
      }

      // Don't handle if focus is on an input or textarea element (like header editing or cell editing)
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA")
      ) {
        return;
      }

      // Don't handle modifier keys (except shift for characters)
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      const { key } = event;
      const header = headers[selectedCell.colIndex];
      const currentValue = String(
        tableData[selectedCell.rowIndex][header] ?? ""
      );

      // Handle backspace - remove the last character
      if (key === "Backspace") {
        event.preventDefault();
        const newValue = currentValue.slice(0, -1);
        setEditingCell({
          rowIndex: selectedCell.rowIndex,
          colIndex: selectedCell.colIndex,
        });
        handleCellChange(selectedCell.rowIndex, header, newValue);

        // Focus the textarea after a brief delay to ensure it's rendered
        setTimeout(() => {
          const cellElement = tableRef?.current?.querySelector(
            `td[data-row-index="${selectedCell.rowIndex}"][data-col-index="${selectedCell.colIndex}"] textarea`
          ) as HTMLTextAreaElement;
          if (cellElement) {
            cellElement.focus();
            // Set cursor to end of text
            cellElement.setSelectionRange(
              cellElement.value.length,
              cellElement.value.length
            );
          }
        }, 0);
        return;
      }

      // Handle printable characters (length 1 and not special keys)
      if (
        key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        const newValue = currentValue + key;
        setEditingCell({
          rowIndex: selectedCell.rowIndex,
          colIndex: selectedCell.colIndex,
        });
        handleCellChange(selectedCell.rowIndex, header, newValue);

        // Focus the textarea after a brief delay to ensure it's rendered
        setTimeout(() => {
          const cellElement = tableRef?.current?.querySelector(
            `td[data-row-index="${selectedCell.rowIndex}"][data-col-index="${selectedCell.colIndex}"] textarea`
          ) as HTMLTextAreaElement;
          if (cellElement) {
            cellElement.focus();
            // Set cursor to end of text
            cellElement.setSelectionRange(
              cellElement.value.length,
              cellElement.value.length
            );
          }
        }, 0);
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedCell,
    editingCell,
    headers,
    tableData,
    selectedCells,
    isCellLockedFn,
    setEditingCell,
    handleCellChange,
    tableRef,
  ]);

  return <></>;
}
