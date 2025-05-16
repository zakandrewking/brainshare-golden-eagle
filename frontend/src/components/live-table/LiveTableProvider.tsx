import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react/suspense";

import { initializeLiveblocksRoom } from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

interface SelectionArea {
  startCell: CellPosition | null;
  endCell: CellPosition | null;
}

interface LiveTableContextType {
  tableId: string;
  tableData: Record<string, unknown>[] | undefined;
  headers: string[] | undefined;
  columnWidths: Record<string, number> | undefined;
  isTableLoaded: boolean;
  handleCellChange: (
    rowIndex: number,
    header: string,
    newValue: string
  ) => void;
  yDoc: Y.Doc;
  yTable: Y.Array<Y.Map<unknown>>;
  yHeaders: Y.Array<string>;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  undoManager: UndoManager | null;
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
  handleCellBlur: () => void;
  editingHeaderIndex: number | null;
  editingHeaderValue: string;
  handleHeaderDoubleClick: (colIndex: number) => void;
  handleHeaderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleHeaderBlur: () => void;
  handleHeaderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleColumnResize: (header: string, newWidth: number) => void;
  selectionArea: SelectionArea;
  isSelecting: boolean;
  selectedCells: CellPosition[];
  handleSelectionStart: (rowIndex: number, colIndex: number) => void;
  handleSelectionMove: (rowIndex: number, colIndex: number) => void;
  handleSelectionEnd: () => void;
  isCellSelected: (rowIndex: number, colIndex: number) => boolean;
  clearSelection: () => void;
  getSelectedCellsData: () => string[][];
  editingCell: { rowIndex: number; colIndex: number } | null;
  setEditingCell: (cell: { rowIndex: number; colIndex: number } | null) => void;
}

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
}

const LiveTableContext = createContext<LiveTableContextType | undefined>(
  undefined
);

function yMapToObject(yMap: Y.Map<unknown>): Record<string, unknown> {
  return Object.fromEntries(yMap.entries());
}
const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
}) => {
  // yTable & friends are not going to reactively update, so we need to observe
  // changes to them and create react state that will reactively update UI.
  // Downstream components should read table, headers, and colWidths for most
  // uses cases.

  // TODO table/setTable is keyed by Column ID, a unique, non-meaningful identifier for each
  // column.
  // TODO headers/setHeaders is a map of Column ID to human-readable header name.
  // TODO colWidths/setColumnWidths is keyed by Column ID

  const [tableData, setTableData] = useState<
    Record<string, unknown>[] | undefined
  >(undefined);
  const [headers, setHeaders] = useState<string[] | undefined>(undefined);
  const [columnWidths, setColumnWidths] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [isTableLoaded, setIsTableLoaded] = useState<boolean>(false);

  // Header editing state
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(
    null
  );
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>("");

  // State for tracking the cell being edited
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // liveblocks
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );
  const yDoc = useMemo(() => liveTableDoc.yDoc, [liveTableDoc]);
  const yHeaders = useMemo(() => liveTableDoc.yHeaders, [liveTableDoc]);
  const yTable = useMemo(() => liveTableDoc.yTable, [liveTableDoc]);
  const yColWidths = useMemo(() => liveTableDoc.yColWidths, [liveTableDoc]);
  const undoManager = useMemo(() => liveTableDoc.undoManager, [liveTableDoc]);

  // update self info in awareness
  useUpdatedSelf(yProvider);

  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  // multiple cell selection
  const [selectionArea, setSelectionArea] = useState<SelectionArea>({
    startCell: null,
    endCell: null,
  });
  const [isSelecting, setIsSelecting] = useState(false);

  // Calculate all selected cells based on the selection area
  const selectedCells = useMemo(() => {
    if (!selectionArea.startCell || !selectionArea.endCell) {
      return [];
    }

    const startRow = Math.min(
      selectionArea.startCell.rowIndex,
      selectionArea.endCell.rowIndex
    );
    const endRow = Math.max(
      selectionArea.startCell.rowIndex,
      selectionArea.endCell.rowIndex
    );
    const startCol = Math.min(
      selectionArea.startCell.colIndex,
      selectionArea.endCell.colIndex
    );
    const endCol = Math.max(
      selectionArea.startCell.colIndex,
      selectionArea.endCell.colIndex
    );

    const cells: CellPosition[] = [];
    for (let rowIndex = startRow; rowIndex <= endRow; rowIndex++) {
      for (let colIndex = startCol; colIndex <= endCol; colIndex++) {
        cells.push({ rowIndex, colIndex });
      }
    }

    return cells;
  }, [selectionArea]);

  // Start selection process when a cell is clicked
  const handleSelectionStart = useCallback(
    (rowIndex: number, colIndex: number) => {
      setSelectionArea({
        startCell: { rowIndex, colIndex },
        endCell: { rowIndex, colIndex },
      });
      setIsSelecting(true);
      setSelectedCell({ rowIndex, colIndex });
    },
    []
  );

  // Update selection as mouse moves
  const handleSelectionMove = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!isSelecting || !selectionArea.startCell) return;

      setSelectionArea((prev) => ({
        ...prev,
        endCell: { rowIndex, colIndex },
      }));
    },
    [isSelecting, selectionArea.startCell]
  );

  // End selection process when mouse is released
  const handleSelectionEnd = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Check if a specific cell is within the current selection
  const isCellSelected = useCallback(
    (rowIndex: number, colIndex: number) => {
      return selectedCells.some(
        (cell) => cell.rowIndex === rowIndex && cell.colIndex === colIndex
      );
    },
    [selectedCells]
  );

  // Clear the current selection
  const clearSelection = useCallback(() => {
    setSelectionArea({ startCell: null, endCell: null });
    setSelectedCell(null);
  }, []);

  // Get data from all selected cells (useful for copy operations)
  const getSelectedCellsData = useCallback(() => {
    if (!tableData || !headers || selectedCells.length === 0) {
      return [];
    }

    // Group cells by row
    const rowGroups = selectedCells.reduce<Record<number, CellPosition[]>>(
      (acc, cell) => {
        if (!acc[cell.rowIndex]) {
          acc[cell.rowIndex] = [];
        }
        acc[cell.rowIndex].push(cell);
        return acc;
      },
      {}
    );

    // For each row, extract the cell data in order
    return Object.keys(rowGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((rowIndex) => {
        const row = rowGroups[rowIndex].sort((a, b) => a.colIndex - b.colIndex);
        return row.map((cell) => {
          const header = headers[cell.colIndex];
          const rowData = tableData[cell.rowIndex];
          return rowData && header ? String(rowData[header] ?? "") : "";
        });
      });
  }, [tableData, headers, selectedCells]);

  // --- Load status ---

  useEffect(() => {
    if (!isTableLoaded && tableData && headers && columnWidths) {
      console.log(
        `Table loaded: ${tableData.length} rows, ${headers.length} columns`
      );
      setIsTableLoaded(true);
    }
  }, [tableData, headers, isTableLoaded, yTable.length, columnWidths]);

  // --- Awareness & Focus ---

  const handleCellFocus = useCallback(
    (rowIndex: number, colIndex: number) => {
      setSelectedCell({ rowIndex, colIndex });
      yProvider.awareness.setLocalStateField("selectedCell", {
        rowIndex,
        colIndex,
      });
    },
    [yProvider.awareness]
  );

  // Function to handle cell blur
  const handleCellBlur = useCallback(() => {
    setSelectedCell(null);
    yProvider.awareness.setLocalStateField("selectedCell", null);
  }, [yProvider.awareness]);

  // Header editing functions
  const handleHeaderDoubleClick = useCallback(
    (colIndex: number) => {
      if (!headers) return;
      setEditingHeaderIndex(colIndex);
      setEditingHeaderValue(headers[colIndex]);
    },
    [headers]
  );

  const handleHeaderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditingHeaderValue(event.target.value);
    },
    []
  );

  const handleHeaderBlur = useCallback(() => {
    if (editingHeaderIndex === null || !headers || !yHeaders) return;

    const oldHeader = headers[editingHeaderIndex];
    const newHeader = editingHeaderValue.trim();

    if (newHeader && newHeader !== oldHeader) {
      yDoc.transact(() => {
        // Update the header in the yHeaders array
        yHeaders.delete(editingHeaderIndex, 1);
        yHeaders.insert(editingHeaderIndex, [newHeader]);

        // Update all rows to use the new header key
        yTable.forEach((row: Y.Map<unknown>) => {
          if (row.has(oldHeader)) {
            const value = row.get(oldHeader);
            row.delete(oldHeader);
            row.set(newHeader, value);
          }
        });

        // Update column width map if needed
        if (yColWidths.has(oldHeader)) {
          const width = yColWidths.get(oldHeader);
          if (width !== undefined) {
            yColWidths.delete(oldHeader);
            yColWidths.set(newHeader, width);
          }
        }
      });
    }

    setEditingHeaderIndex(null);
  }, [
    editingHeaderIndex,
    editingHeaderValue,
    headers,
    yHeaders,
    yDoc,
    yTable,
    yColWidths,
  ]);

  const handleHeaderKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleHeaderBlur();
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditingHeaderIndex(null);
      }
    },
    [handleHeaderBlur]
  );

  const handleColumnResize = useCallback(
    (header: string, newWidth: number) => {
      if (!yColWidths) return;

      yDoc.transact(() => {
        yColWidths.set(header, newWidth);
      });
    },
    [yDoc, yColWidths]
  );

  // map yjs entities to react state
  useEffect(() => {
    const updateTableState = () => {
      const currentData = yTable.toArray().map(yMapToObject);
      setTableData(currentData);
    };

    // Function to update React state for headers
    const updateHeadersState = () => {
      const currentHeaders = yHeaders.toArray();
      if (currentHeaders.length === 0 && yTable.length > 0) {
        const firstRowMap = yTable.get(0);
        if (firstRowMap) {
          const initialHeaders = Array.from(firstRowMap.keys()).sort();
          yDoc.transact(() => {
            if (yHeaders.length === 0) {
              yHeaders.push(initialHeaders);
              setHeaders(initialHeaders);
            } else {
              setHeaders(yHeaders.toArray());
            }
          });
        } else {
          setHeaders([]);
        }
      } else {
        setHeaders(currentHeaders);
      }
    };

    // Function to update React state for column widths
    const updateColWidthsState = () => {
      const currentWidths = Object.fromEntries(yColWidths.entries());
      setColumnWidths(currentWidths);
    };

    // Initial state load
    updateTableState();
    updateHeadersState();
    updateColWidthsState();

    // Observe changes
    const tableObserver = () => updateTableState();
    const headersObserver = () => updateHeadersState();
    const widthsObserver = () => updateColWidthsState();

    // yTable is not going to reactively update, so we need to observe changes
    // to it and create react state that will reactively update UI. Downstream
    // components should read table, headers, and colWidths for most uses cases.
    yTable.observeDeep(tableObserver);
    yHeaders.observe(headersObserver);
    yColWidths.observe(widthsObserver);

    // Cleanup observers on unmount
    return () => {
      yTable.unobserveDeep(tableObserver);
      yHeaders.unobserve(headersObserver);
      yColWidths.unobserve(widthsObserver);
    };
  }, [yTable, yHeaders, yColWidths, yDoc]);

  // Function to handle cell changes
  const handleCellChange = useCallback(
    (rowIndex: number, header: string, newValue: string) => {
      yDoc.transact(() => {
        const yRow = yTable.get(rowIndex);
        if (yRow) {
          if (newValue === "") {
            yRow.delete(header);
          } else {
            yRow.set(header, newValue);
          }
        }
      });
    },
    [yDoc, yTable]
  );

  return (
    <LiveTableContext.Provider
      value={{
        tableId,
        tableData,
        headers,
        columnWidths,
        isTableLoaded,
        handleCellChange,
        yDoc,
        yTable,
        yHeaders,
        selectedCell,
        undoManager,
        handleCellFocus,
        handleCellBlur,
        editingHeaderIndex,
        editingHeaderValue,
        handleHeaderDoubleClick,
        handleHeaderChange,
        handleHeaderBlur,
        handleHeaderKeyDown,
        handleColumnResize,
        // New exports for multiple cell selection
        selectionArea,
        isSelecting,
        selectedCells,
        handleSelectionStart,
        handleSelectionMove,
        handleSelectionEnd,
        isCellSelected,
        clearSelection,
        getSelectedCellsData,
        editingCell,
        setEditingCell,
      }}
    >
      {children}
    </LiveTableContext.Provider>
  );
};

export const useLiveTable = () => {
  const context = useContext(LiveTableContext);
  if (context === undefined) {
    throw new Error("useLiveTable must be used within a LiveTableProvider");
  }
  return context;
};

export default LiveTableProvider;
