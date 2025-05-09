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

import { useRoom, useSelf } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

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

  // yjs
  const room = useRoom();
  const yProvider = getYjsProviderForRoom(room);
  const yDoc = yProvider.getYDoc();
  const self = useSelf();

  // yjs entities
  const yTable = useMemo(
    () => yDoc.getArray<Y.Map<unknown>>("tableData"),
    [yDoc]
  );
  const yHeaders = useMemo(() => yDoc.getArray<string>("tableHeaders"), [yDoc]);
  const yColWidths = useMemo(() => yDoc.getMap<number>("colWidths"), [yDoc]);

  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);

  const undoManager = useMemo(() => {
    if (!yTable || !yHeaders || !yColWidths) return null;
    return new UndoManager([yTable, yHeaders, yColWidths], {
      captureTimeout: 500,
    });
  }, [yTable, yHeaders, yColWidths]);

  // --- Load status ---

  useEffect(() => {
    if (!isTableLoaded && tableData && headers && columnWidths) {
      setIsTableLoaded(true);
    }
  }, [tableData, headers, isTableLoaded, yTable.length, columnWidths]);

  // --- Awareness & Focus ---

  useEffect(() => {
    yProvider.awareness.setLocalStateField("user", {
      name: self?.info?.name ?? "Anonymous",
      color: self?.info?.color ?? "#000000",
    });
  }, [self?.info?.name, self?.info?.color, yProvider.awareness]);

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
