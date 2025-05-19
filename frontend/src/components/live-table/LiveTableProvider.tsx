import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { toast } from "sonner";
import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react/suspense";

import generateNewColumns, {
  GeneratedColumn,
} from "./actions/generateNewColumns";
import generateNewRows from "./actions/generateNewRows";
import { initializeLiveblocksRoom } from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";
import { createDefaultYMapForRow, createYMapFromData } from "./yjs-operations";

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
  generateAndInsertRows: (
    initialInsertIndex: number,
    numRowsToAdd: number
  ) => Promise<{
    aiRowsAdded: number;
    defaultRowsAdded: number;
  }>;
  deleteRows: (rowIndices: number[]) => Promise<{
    deletedCount: number;
  }>;
  generateAndInsertColumns: (
    initialInsertIndex: number,
    numColsToAdd: number
  ) => Promise<{
    aiColsAdded: number;
    defaultColsAdded: number;
  }>;
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
  liveTableDoc.tableDataUpdateCallback = setTableData;
  liveTableDoc.headersUpdateCallback = setHeaders;
  liveTableDoc.columnWidthsUpdateCallback = setColumnWidths;
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
      liveTableDoc.editHeader(editingHeaderIndex, newHeader);
    }

    setEditingHeaderIndex(null);
  }, [editingHeaderIndex, headers, yHeaders, editingHeaderValue, liveTableDoc]);

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

  // wire up yjs observers
  useEffect(() => {
    liveTableDoc.initializeObservers();
    return () => {
      liveTableDoc.cleanupObservers();
    };
  }, [liveTableDoc]);

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

  const generateAndInsertRows = useCallback(
    async (initialInsertIndex: number, numRowsToAdd: number) => {
      if (numRowsToAdd <= 0) {
        toast.info("No rows were added as the number to add was zero.");
        return { aiRowsAdded: 0, defaultRowsAdded: 0 };
      }
      if (!headers || !tableData) {
        throw new Error("Cannot add rows: table headers or data not loaded.");
      }

      const currentTableDataForAi = tableData.map((row) => ({ ...row }));
      const currentHeadersForAi = [...headers];

      const rowsToInsertInYjs: Y.Map<unknown>[] = [];
      let aiRowsAddedCount = 0;
      let defaultRowsAddedCount = 0;

      try {
        const result = await generateNewRows(
          currentTableDataForAi,
          currentHeadersForAi,
          numRowsToAdd
        );

        if (result.error) {
          console.warn(
            `AI generation failed: ${result.error}. Falling back to default rows.`
          );
          for (let i = 0; i < numRowsToAdd; i++) {
            rowsToInsertInYjs.push(
              createDefaultYMapForRow(currentHeadersForAi)
            );
            defaultRowsAddedCount++;
          }
        } else if (!result.newRows || result.newRows.length === 0) {
          console.warn(`No AI rows returned, falling back to default rows.`);
          for (let i = 0; i < numRowsToAdd; i++) {
            rowsToInsertInYjs.push(
              createDefaultYMapForRow(currentHeadersForAi)
            );
            defaultRowsAddedCount++;
          }
        } else {
          result.newRows.forEach((rowData: Record<string, string>) => {
            if (rowsToInsertInYjs.length < numRowsToAdd) {
              rowsToInsertInYjs.push(
                createYMapFromData(rowData, currentHeadersForAi)
              );
              aiRowsAddedCount++;
            }
          });
          const remainingRowsToFill = numRowsToAdd - aiRowsAddedCount;
          for (let i = 0; i < remainingRowsToFill; i++) {
            rowsToInsertInYjs.push(
              createDefaultYMapForRow(currentHeadersForAi)
            );
            defaultRowsAddedCount++;
          }
        }

        if (rowsToInsertInYjs.length === 0 && numRowsToAdd > 0) {
          toast.info("Attempted to add rows, but no rows were prepared.");
          return { aiRowsAdded: 0, defaultRowsAdded: 0 };
        }

        if (rowsToInsertInYjs.length > 0) {
          liveTableDoc.insertRows(initialInsertIndex, rowsToInsertInYjs);
        }

        if (result.error) {
          toast.error(
            `AI row generation failed: ${result.error}. Added ${defaultRowsAddedCount} default row(s).`
          );
        } else if (aiRowsAddedCount > 0 && defaultRowsAddedCount === 0) {
          toast.success(
            `Successfully added ${aiRowsAddedCount} AI-suggested row(s).`
          );
        } else if (aiRowsAddedCount > 0 && defaultRowsAddedCount > 0) {
          toast.info(
            `Added ${numRowsToAdd} row(s): ${aiRowsAddedCount} AI-suggested, ${defaultRowsAddedCount} default.`
          );
        } else if (defaultRowsAddedCount > 0 && aiRowsAddedCount === 0) {
          toast.info(
            `Added ${defaultRowsAddedCount} default row(s) as AI suggestions were not available or an issue occurred.`
          );
        }

        return {
          aiRowsAdded: aiRowsAddedCount,
          defaultRowsAdded: defaultRowsAddedCount,
        };
      } catch (error) {
        // This catch is for errors during Yjs operations or other unexpected issues within the try block
        console.error(`Critical error in generateAndInsertRows:`, error);
        // Fallback: attempt to insert default rows directly into Yjs
        const fallbackYMaps: Y.Map<unknown>[] = [];
        for (let i = 0; i < numRowsToAdd; i++) {
          fallbackYMaps.push(createDefaultYMapForRow(currentHeadersForAi));
        }

        if (fallbackYMaps.length > 0) {
          try {
            liveTableDoc.insertRows(initialInsertIndex, fallbackYMaps);
          } catch (yjsError) {
            console.error("Failed to insert fallback rows into Yjs:", yjsError);
            // If even fallback fails, we throw the original error that led to this catch block.
            // No need to throw yjsError specifically, as the primary error is more relevant to the user action.
          }
        }
        // Throw the original error to be caught by the toolbar
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    [liveTableDoc, headers, tableData]
  );

  const deleteRows = useCallback(
    async (rowIndices: number[]) => {
      if (!liveTableDoc) {
        throw new Error("Table document not available. Cannot delete rows.");
      }
      if (rowIndices.length === 0) {
        toast.info("No rows selected for deletion.");
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      try {
        deletedCount = liveTableDoc.deleteRows(rowIndices);

        if (deletedCount > 0) {
          toast.success(`Successfully deleted ${deletedCount} row(s).`);
          if (rowIndices.length > deletedCount) {
            toast.info(
              `${
                rowIndices.length - deletedCount
              } row(s) could not be deleted (possibly out of bounds). Check console for details.`
            );
          }
        } else if (rowIndices.length > 0 && deletedCount === 0) {
          toast.info(
            "No rows were deleted. They might have been out of bounds. Check console for details."
          );
        }
      } catch (error) {
        console.error("Error during Yjs row deletion in Provider:", error);
        throw error instanceof Error ? error : new Error(String(error));
      }
      return { deletedCount };
    },
    [liveTableDoc]
  );

  const generateAndInsertColumns = useCallback(
    async (initialInsertIndex: number, numColsToAdd: number) => {
      if (numColsToAdd <= 0) {
        toast.info("No columns were added as the number to add was zero.");
        return { aiColsAdded: 0, defaultColsAdded: 0 };
      }
      if (!headers || !tableData) {
        throw new Error(
          "Cannot add columns: table headers or data not loaded."
        );
      }
      const currentTableDataForAi = tableData.map((row) => ({ ...row }));
      const currentHeadersForAi = [...headers];
      let aiColsAddedCount = 0;
      let defaultColsAddedCount = 0;
      const columnsToInsert: {
        headerName: string;
        columnData: (string | null)[] | null;
      }[] = [];
      try {
        const result = await generateNewColumns(
          currentTableDataForAi,
          currentHeadersForAi,
          numColsToAdd
        );
        if (result.error) {
          console.warn(
            `AI column generation failed: ${result.error}. Falling back to default columns.`
          );
          for (let i = 0; i < numColsToAdd; i++) {
            columnsToInsert.push({
              headerName: generateUniqueDefaultHeader(
                "New Column",
                currentHeadersForAi,
                columnsToInsert
              ),
              columnData: null,
            });
            defaultColsAddedCount++;
          }
        } else if (
          !result.generatedColumns ||
          result.generatedColumns.length === 0
        ) {
          console.warn(
            `No AI columns returned, falling back to default columns.`
          );
          for (let i = 0; i < numColsToAdd; i++) {
            columnsToInsert.push({
              headerName: generateUniqueDefaultHeader(
                "New Column",
                currentHeadersForAi,
                columnsToInsert
              ),
              columnData: null,
            });
            defaultColsAddedCount++;
          }
        } else {
          result.generatedColumns.forEach((col: GeneratedColumn) => {
            columnsToInsert.push({
              headerName: col.headerName,
              columnData: col.columnData,
            });
            aiColsAddedCount++;
          });
          const remainingColsToFill = numColsToAdd - aiColsAddedCount;
          for (let i = 0; i < remainingColsToFill; i++) {
            columnsToInsert.push({
              headerName: generateUniqueDefaultHeader(
                "New Column",
                currentHeadersForAi,
                columnsToInsert
              ),
              columnData: null,
            });
            defaultColsAddedCount++;
          }
        }
        if (columnsToInsert.length === 0 && numColsToAdd > 0) {
          toast.info("Attempted to add columns, but no columns were prepared.");
          return { aiColsAdded: 0, defaultColsAdded: 0 };
        }
        if (columnsToInsert.length > 0) {
          liveTableDoc.insertColumns(initialInsertIndex, columnsToInsert);
        }
        if (result.error) {
          toast.error(
            `AI column generation failed: ${result.error}. Added ${defaultColsAddedCount} default column(s).`
          );
        } else if (aiColsAddedCount > 0 && defaultColsAddedCount === 0) {
          toast.success(
            `Successfully added ${aiColsAddedCount} AI-suggested column(s).`
          );
        } else if (aiColsAddedCount > 0 && defaultColsAddedCount > 0) {
          toast.info(
            `Added ${numColsToAdd} column(s): ${aiColsAddedCount} AI-suggested, ${defaultColsAddedCount} default.`
          );
        } else if (defaultColsAddedCount > 0 && aiColsAddedCount === 0) {
          toast.info(
            `Added ${defaultColsAddedCount} default column(s) as AI suggestions were not available or an issue occurred.`
          );
        }
        return {
          aiColsAdded: aiColsAddedCount,
          defaultColsAdded: defaultColsAddedCount,
        };
      } catch (error) {
        console.error(`Critical error in generateAndInsertColumns:`, error);
        // Fallback: attempt to insert default columns directly into Yjs
        const fallbackColumns: { headerName: string; columnData: null }[] = [];
        for (let i = 0; i < numColsToAdd; i++) {
          fallbackColumns.push({
            headerName: generateUniqueDefaultHeader(
              "New Column",
              currentHeadersForAi,
              fallbackColumns
            ),
            columnData: null,
          });
        }
        if (fallbackColumns.length > 0) {
          try {
            liveTableDoc.insertColumns(initialInsertIndex, fallbackColumns);
          } catch (yjsError) {
            console.error(
              "Failed to insert fallback columns into Yjs:",
              yjsError
            );
          }
        }
        throw error instanceof Error ? error : new Error(String(error));
      }
    },
    [liveTableDoc, headers, tableData]
  );

  // Helper for unique default header names
  function generateUniqueDefaultHeader(
    base: string,
    existingHeaders: string[],
    columnsToInsert: { headerName: string }[]
  ): string {
    let counter = 1;
    let name = `${base} ${counter}`;
    const allHeaders = [
      ...existingHeaders.map((h) => h.toLowerCase()),
      ...columnsToInsert.map((c) => c.headerName.toLowerCase()),
    ];
    while (allHeaders.includes(name.toLowerCase())) {
      counter++;
      name = `${base} ${counter}`;
    }
    return name;
  }

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
        generateAndInsertRows,
        deleteRows,
        generateAndInsertColumns,
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
