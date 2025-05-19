import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react/suspense";

import { ColumnDefinition, initializeLiveblocksRoom } from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";

interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

interface SelectionArea {
  startCell: CellPosition | null;
  endCell: CellPosition | null;
}

export interface LiveTableContextType {
  tableId: string;
  tableData: Record<string, unknown>[] | undefined;
  headers: string[] | undefined;
  columnWidths: Record<string, number> | undefined;
  isTableLoaded: boolean;

  handleCellChange: (
    rowIndex: number,
    colIndex: number,
    newValue: string
  ) => void;
  handleHeaderDoubleClick: (colIndex: number) => void; // colIndex in yColumnOrder
  handleHeaderChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleHeaderBlur: () => void;
  handleHeaderKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleColumnResize: (colIndex: number, newWidth: number) => void; // colIndex in yColumnOrder

  handleInsertRows: (rows: string[][], rowInsertIndex: number) => void;
  handleInsertColumns: (columns: string[], columnInsertIndex: number) => void;

  undoManager: UndoManager | null;

  selectedCell: CellPosition | null;
  handleCellFocus: (rowIndex: number, colIndex: number) => void;
  handleCellBlur: () => void;
  editingHeaderIndex: number | null; // Display colIndex of header being edited
  editingHeaderValue: string; // Current value of header being edited

  selectionArea: SelectionArea;
  isSelecting: boolean;
  selectedCells: CellPosition[];
  handleSelectionStart: (rowIndex: number, colIndex: number) => void;
  handleSelectionMove: (rowIndex: number, colIndex: number) => void;
  handleSelectionEnd: () => void;
  isCellSelected: (rowIndex: number, colIndex: number) => boolean;
  clearSelection: () => void;
  getSelectedCellsData: () => string[][];
  editingCell: CellPosition | null;
  setEditingCell: (cell: CellPosition | null) => void;
}

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
}

const LiveTableContext = createContext<LiveTableContextType | undefined>(
  undefined
);

const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
}) => {
  // yTable & friends are not going to reactively update, so we need to observe
  // changes to them and create react state that will reactively update UI.
  // Downstream components should read table, headers, and colWidths for most
  // uses cases.

  const [tableData, setTableData] = useState<
    Record<string, unknown>[] | undefined
  >(undefined);
  const [headers, setHeaders] = useState<string[] | undefined>(undefined);
  const [columnWidths, setColumnWidths] = useState<
    Record<string, number> | undefined
  >(undefined);
  const [isTableLoaded, setIsTableLoaded] = useState<boolean>(false);

  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(
    null
  );
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>("");
  const [editingCell, setEditingCell] = useState<CellPosition | null>(null);

  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );

  liveTableDoc.tableDataUpdateCallback = setTableData;
  liveTableDoc.headersUpdateCallback = setHeaders;
  liveTableDoc.columnWidthsUpdateCallback = setColumnWidths;

  const yDoc = useMemo(() => liveTableDoc.yDoc, [liveTableDoc]);
  const undoManager = useMemo(() => liveTableDoc.undoManager, [liveTableDoc]);

  useUpdatedSelf(yProvider);

  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null);
  const [selectionArea, setSelectionArea] = useState<SelectionArea>({
    startCell: null,
    endCell: null,
  });
  const [isSelecting, setIsSelecting] = useState(false);

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

  const handleSelectionEnd = useCallback(() => {
    setIsSelecting(false);
  }, []);

  const isCellSelected = useCallback(
    (rowIndex: number, colIndex: number) => {
      return selectedCells.some(
        (cell) => cell.rowIndex === rowIndex && cell.colIndex === colIndex
      );
    },
    [selectedCells]
  );

  const clearSelection = useCallback(() => {
    setSelectionArea({ startCell: null, endCell: null });
    setSelectedCell(null);
  }, []);

  const getSelectedCellsData = useCallback(() => {
    if (!tableData || !headers || selectedCells.length === 0) {
      return [];
    }
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
    return Object.keys(rowGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((rowIndex) => {
        const row = rowGroups[rowIndex].sort((a, b) => a.colIndex - b.colIndex);
        return row.map((cell) => {
          const headerName = headers[cell.colIndex];
          const rowData = tableData[cell.rowIndex];
          return rowData && headerName ? String(rowData[headerName] ?? "") : "";
        });
      });
  }, [tableData, headers, selectedCells]);

  useEffect(() => {
    if (!isTableLoaded && tableData && headers && columnWidths) {
      console.log(
        `Table loaded: ${tableData.length} rows, ${headers.length} columns`
      );
      setIsTableLoaded(true);
    }
  }, [tableData, headers, columnWidths, isTableLoaded]);

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

  const handleCellBlur = useCallback(() => {
    // setSelectedCell(null); // This is handled by selection logic or explicit clearSelection
    yProvider.awareness.setLocalStateField("selectedCell", null);
  }, [yProvider.awareness]);

  const handleCellChange = useCallback(
    (rowIndex: number, colIndex: number, newValue: string) => {
      liveTableDoc.yDoc.transact(() => {
        const rowId = liveTableDoc.yRowOrder.get(rowIndex);
        const columnId = liveTableDoc.yColumnOrder.get(colIndex);
        if (rowId && columnId) {
          const rowMap = liveTableDoc.yRowData.get(rowId);
          if (rowMap) {
            if (newValue === "") {
              rowMap.set(columnId, "");
            } else {
              rowMap.set(columnId, newValue);
            }
          }
        } else {
          console.error(
            `handleCellChange: Could not find RowId for rowIndex ${rowIndex} or ColumnId for colIndex ${colIndex}`
          );
        }
      });
    },
    [liveTableDoc]
  );

  const handleHeaderDoubleClick = useCallback(
    (colIndex: number) => {
      const columnId = liveTableDoc.yColumnOrder.get(colIndex);
      if (columnId) {
        const definition = liveTableDoc.yColumnDefinitions.get(columnId);
        if (definition) {
          setEditingHeaderIndex(colIndex);
          setEditingHeaderValue(definition.name);
        } else {
          console.error(
            `handleHeaderDoubleClick: No definition for colId ${columnId}`
          );
        }
      } else {
        console.error(
          `handleHeaderDoubleClick: No colId at colIndex ${colIndex}`
        );
      }
    },
    [liveTableDoc]
  );

  const handleHeaderChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditingHeaderValue(event.target.value);
    },
    []
  );

  const handleHeaderBlur = useCallback(() => {
    if (editingHeaderIndex === null) return;

    const newHeaderName = editingHeaderValue.trim();
    const columnId = liveTableDoc.yColumnOrder.get(editingHeaderIndex);

    if (columnId) {
      const definition = liveTableDoc.yColumnDefinitions.get(columnId);
      if (definition && newHeaderName && newHeaderName !== definition.name) {
        liveTableDoc.editHeader(editingHeaderIndex, newHeaderName);
      }
    }
    setEditingHeaderIndex(null);
  }, [editingHeaderIndex, editingHeaderValue, liveTableDoc]);

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
    (colIndex: number, newWidth: number) => {
      liveTableDoc.yDoc.transact(() => {
        const columnId = liveTableDoc.yColumnOrder.get(colIndex);
        if (columnId) {
          const definition = liveTableDoc.yColumnDefinitions.get(columnId);
          if (definition) {
            const updatedDefinition: ColumnDefinition = {
              ...definition,
              width: newWidth,
            };
            liveTableDoc.yColumnDefinitions.set(columnId, updatedDefinition);
          } else {
            console.error(
              `handleColumnResize: No definition found for columnId ${columnId}`
            );
          }
        } else {
          console.error(
            `handleColumnResize: No columnId found at colIndex ${colIndex}`
          );
        }
      });
    },
    [liveTableDoc]
  );

  useEffect(() => {
    liveTableDoc.initializeObservers();
    return () => {
      liveTableDoc.cleanupObservers();
    };
  }, [liveTableDoc]);

  const handleInsertRows = useCallback(
    (rows: string[][], rowInsertIndex: number) => {
      liveTableDoc?.insertRows(rows, rowInsertIndex);
    },
    [liveTableDoc]
  );

  const handleInsertColumns = useCallback(
    (columns: string[], columnInsertIndex: number) => {
      liveTableDoc?.insertColumns(columns, columnInsertIndex);
    },
    [liveTableDoc]
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
        undoManager,
        selectedCell,
        handleCellFocus,
        handleCellBlur,
        editingHeaderIndex,
        editingHeaderValue,
        handleHeaderDoubleClick,
        handleHeaderChange,
        handleHeaderBlur,
        handleHeaderKeyDown,
        handleColumnResize,
        handleInsertRows,
        handleInsertColumns,
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
