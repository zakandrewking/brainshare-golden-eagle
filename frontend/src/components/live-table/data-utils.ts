export function getSelectedCellsData(
  tableData: Record<string, unknown>[],
  headers: string[],
  selectedCells: { rowIndex: number; colIndex: number }[]
): { rowIndex: number; colIndex: number; value: string }[] {
  if (!tableData || !headers || !selectedCells || selectedCells.length === 0) {
    return [];
  }

  return selectedCells.map((cell) => {
    const header = headers[cell.colIndex];
    const rowData = tableData[cell.rowIndex];
    const value = rowData && header ? String(rowData[header] ?? "") : "";

    return {
      rowIndex: cell.rowIndex,
      colIndex: cell.colIndex,
      value,
    };
  });
}
