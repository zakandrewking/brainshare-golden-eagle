"use client";

import { useEffect } from "react";
import { useSelectionArea, useSelectionStartOrMove, useSelectionEnd } from "@/stores/selectionStore";
import { useTableRef } from "@/stores/dataStore";

export default function SelectionHandles() {
  const selectionArea = useSelectionArea();
  const tableRef = useTableRef();
  const startOrMove = useSelectionStartOrMove();
  const endSelection = useSelectionEnd();

  useEffect(() => {
    const handleTouchEnd = () => {
      endSelection();
    };
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [endSelection]);

  if (!selectionArea || !selectionArea.startCell || !selectionArea.endCell || !tableRef?.current) {
    return null;
  }

  const startCellEl = tableRef.current.querySelector(
    `td[data-row-index="${selectionArea.startCell.rowIndex}"][data-col-index="${selectionArea.startCell.colIndex}"]`
  ) as HTMLElement | null;
  const endCellEl = tableRef.current.querySelector(
    `td[data-row-index="${selectionArea.endCell.rowIndex}"][data-col-index="${selectionArea.endCell.colIndex}"]`
  ) as HTMLElement | null;

  if (!startCellEl || !endCellEl) return null;

  const tableRect = tableRef.current.getBoundingClientRect();
  const startRect = startCellEl.getBoundingClientRect();
  const endRect = endCellEl.getBoundingClientRect();

  const left = Math.min(startRect.left, endRect.left) - tableRect.left;
  const top = Math.min(startRect.top, endRect.top) - tableRect.top;
  const right = Math.max(startRect.right, endRect.right) - tableRect.left;
  const bottom = Math.max(startRect.bottom, endRect.bottom) - tableRect.top;

  const handleSize = 12;

  const startStyle: React.CSSProperties = {
    position: "absolute",
    width: handleSize,
    height: handleSize,
    left: left - handleSize / 2,
    top: top - handleSize / 2,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    touchAction: "none",
  };

  const endStyle: React.CSSProperties = {
    position: "absolute",
    width: handleSize,
    height: handleSize,
    left: right - handleSize / 2,
    top: bottom - handleSize / 2,
    backgroundColor: "#3b82f6",
    borderRadius: 4,
    touchAction: "none",
  };


  return (
    <div className="pointer-events-none absolute inset-0" data-testid="selection-handles">
      <div
        style={startStyle}
        className="pointer-events-auto"
        onTouchStart={() =>
          startOrMove(
            selectionArea.startCell!.rowIndex,
            selectionArea.startCell!.colIndex,
            true
          )
        }
      />
      <div
        style={endStyle}
        className="pointer-events-auto"
        onTouchStart={() =>
          startOrMove(selectionArea.endCell!.rowIndex, selectionArea.endCell!.colIndex, true)
        }
      />
    </div>
  );
}
