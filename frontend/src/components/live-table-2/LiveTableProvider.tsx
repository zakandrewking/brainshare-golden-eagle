import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as Y from "yjs";

import { useRoom, useSelf } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

interface LiveTableContextType {
  tableId: string;
  tableData: Record<string, unknown>[];
  headers: string[];
  columnWidths: Record<string, number>;
  handleCellChange: (
    rowIndex: number,
    header: string,
    newValue: string
  ) => void;
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
  // react state
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

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

  // Effect to set user info in awareness state when it changes
  useEffect(() => {
    yProvider.awareness.setLocalStateField("user", {
      name: self?.info?.name ?? "Anonymous",
      color: self?.info?.color ?? "#000000",
    });
  }, [self?.info?.name, self?.info?.color, yProvider.awareness]);

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
      value={{ tableId, tableData, headers, columnWidths, handleCellChange }}
    >
      {children}
    </LiveTableContext.Provider>
  );
};

export default LiveTableProvider;

export const useLiveTable = () => {
  const context = useContext(LiveTableContext);
  if (!context) {
    throw new Error("useLiveTable must be used within a LiveTableProvider");
  }
  return context;
};
