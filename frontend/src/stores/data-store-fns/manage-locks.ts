import { toast } from "sonner";

import { LiveTableDoc } from "@/components/live-table/live-table-doc";
import { CellPosition } from "@/components/live-table/LiveTableProvider";

/**
 * Lock the selected range of cells.
 * @param selectedCells - The selected cells to lock.
 * @param liveTableDoc - The live table document.
 * @returns The lock ID if successful, null otherwise.
 */
export function lockSelectedRange(
  selectedCells: CellPosition[],
  liveTableDoc: LiveTableDoc
) {
  if (selectedCells.length === 0) {
    toast.info("No cells selected to lock.");
    return null;
  }

  // Find the bounds of the selection
  const rowIndices = selectedCells.map((cell) => cell.rowIndex);
  const colIndices = selectedCells.map((cell) => cell.colIndex);

  const minRowIndex = Math.min(...rowIndices);
  const maxRowIndex = Math.max(...rowIndices);
  const minColIndex = Math.min(...colIndices);
  const maxColIndex = Math.max(...colIndices);

  const lockId = liveTableDoc.lockCellRange(
    minRowIndex,
    maxRowIndex,
    minColIndex,
    maxColIndex
  );

  if (lockId) {
    toast.success(`Locked ${selectedCells.length} cell(s).`);
  } else {
    toast.error("Failed to lock the selected range.");
  }

  return lockId;
}

/**
 * Unlock a specific lock range.
 * @param lockId - The ID of the lock to remove.
 * @param liveTableDoc - The live table document.
 * @returns True if the lock was removed, false if not found.
 */
export function unlockRange(lockId: string, liveTableDoc: LiveTableDoc) {
  const success = liveTableDoc.unlockRange(lockId);
  if (success) {
    toast.success("Range unlocked successfully.");
  } else {
    toast.error("Failed to unlock range.");
  }
  return success;
}

/**
 * Unlock all locks.
 * @param liveTableDoc - The live table document.
 */
export function unlockAll(liveTableDoc: LiveTableDoc) {
  liveTableDoc.unlockAll();
  toast.success("All locks removed.");
}
