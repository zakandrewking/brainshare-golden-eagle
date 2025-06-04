import { CursorDataForCell } from "@/components/live-table/live-table-doc";

// Helper to find cursors for a specific cell from the pre-computed data
export function getCursorsForCell(
  rowIndex: number,
  colIndex: number,
  cursorsData: CursorDataForCell[]
): CursorDataForCell | undefined {
  return cursorsData?.find(
    (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
  );
}
