/**
 * This is the top-level provider for the LiveTable component. It manages the
 * LiveTableDoc and the LiveTableContext.
 *
 * This component is primarily responsible for setting up the LiveTableDoc,
 * based on the lifecycle of page. It should NOT be used to manage state that
 * changes frequently, because that will cause the entire table to re-render.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { toast } from "sonner";

import { useRoom } from "@liveblocks/react/suspense";

import { DataStoreProvider } from "@/stores/dataStore";
import {
  type CellPosition,
  type SelectionArea,
  useSelectedCells,
  useSelectionArea,
} from "@/stores/selectionStore";

import {
  type AwarenessState,
  type CursorDataForCell,
  initializeLiveblocksRoom,
} from "./LiveTableDoc";
import { useUpdatedSelf } from "./useUpdatedSelf";

export interface LiveTableContextType {
  // data
  tableId: string;
  documentTitle: string;
  documentDescription: string;
  tableData: Record<string, unknown>[] | undefined;
  headers: string[] | undefined;
  columnWidths: Record<string, number> | undefined;
  isTableLoaded: boolean;
  deleteRows: (rowIndices: number[]) => Promise<{
    deletedCount: number;
  }>;
  // column operations
  deleteColumns: (colIndices: number[]) => Promise<{ deletedCount: number }>;
  // column reordering
  reorderColumn: (fromIndex: number, toIndex: number) => void;
  // awareness
  awarenessStates: Map<number, AwarenessState | null> | undefined;
  cursorsData: CursorDataForCell[] | undefined;
  getCursorsForCell: (
    rowIndex: number,
    colIndex: number
  ) => CursorDataForCell | undefined;
}

export type { CellPosition, SelectionArea };

interface LiveTableProviderProps {
  children: React.ReactNode;
  tableId: string;
  documentTitle: string;
  documentDescription: string;
}

const LiveTableContext = createContext<LiveTableContextType | undefined>(
  undefined
);

const LiveTableProvider: React.FC<LiveTableProviderProps> = ({
  children,
  tableId,
  documentTitle,
  documentDescription,
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

  // Awareness state
  const [awarenessStates, setAwarenessStates] = useState<
    Map<number, AwarenessState | null> | undefined
  >(undefined);
  const [cursorsData, setCursorsData] = useState<
    CursorDataForCell[] | undefined
  >(undefined);

  // liveblocks
  const room = useRoom();
  const { liveTableDoc, yProvider } = useMemo(
    () => initializeLiveblocksRoom(room),
    [room]
  );
  liveTableDoc.tableDataUpdateCallback = setTableData;
  liveTableDoc.headersUpdateCallback = setHeaders;
  liveTableDoc.columnWidthsUpdateCallback = setColumnWidths;
  liveTableDoc.awarenessStatesUpdateCallback = setAwarenessStates;
  liveTableDoc.cursorsDataUpdateCallback = setCursorsData;

  // update self info in awareness
  useUpdatedSelf(yProvider);

  // selection store
  const selectedCells = useSelectedCells();
  const selectionArea = useSelectionArea();

  // --- Awareness Management ---

  // Memoized function to update React state with awareness changes
  const updateAwarenessStateCallback = useCallback(() => {
    const currentStates = new Map(
      yProvider.awareness.getStates() as Map<number, AwarenessState | null>
    );
    liveTableDoc.updateAwarenessState(currentStates);
  }, [yProvider.awareness, liveTableDoc]);

  // Set up the awareness observer
  useEffect(() => {
    liveTableDoc.updateAwarenessStateObserver = updateAwarenessStateCallback;
  }, [liveTableDoc, updateAwarenessStateCallback]);

  // Effect to subscribe to awareness changes
  useEffect(() => {
    // Initial load of awareness states
    updateAwarenessStateCallback();

    // Listen for awareness changes
    yProvider.awareness.on("update", updateAwarenessStateCallback);

    // Cleanup on unmount
    return () => {
      yProvider.awareness.off("update", updateAwarenessStateCallback);
    };
  }, [updateAwarenessStateCallback, yProvider.awareness]);

  // Update awareness when local selection changes
  useEffect(() => {
    yProvider.awareness.setLocalStateField("selectionArea", {
      startCell: selectionArea.startCell
        ? { ...selectionArea.startCell }
        : null,
      endCell: selectionArea.endCell ? { ...selectionArea.endCell } : null,
    });
  }, [selectedCells, yProvider.awareness, selectionArea]);

  // Helper to find cursors for a specific cell from the pre-computed data
  const getCursorsForCell = useCallback(
    (rowIndex: number, colIndex: number): CursorDataForCell | undefined => {
      return cursorsData?.find(
        (data) => data.rowIndex === rowIndex && data.colIndex === colIndex
      );
    },
    [cursorsData]
  );

  // wire up yjs observers
  useEffect(() => {
    let synced = false;
    yProvider.once("synced", () => {
      liveTableDoc.initializeObservers();
      setIsTableLoaded(true);
      synced = true;
    });
    return () => {
      if (synced) {
        liveTableDoc.cleanupObservers();
      }
    };
  }, [liveTableDoc, yProvider]);

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
        throw error instanceof Error ? error : new Error(String(error));
      }
      return { deletedCount };
    },
    [liveTableDoc]
  );

  const deleteColumns = useCallback(
    async (colIndices: number[]) => {
      if (!liveTableDoc) {
        throw new Error("Table document not available. Cannot delete columns.");
      }
      if (colIndices.length === 0) {
        toast.info("No columns selected for deletion.");
        return { deletedCount: 0 };
      }
      let deletedCount = 0;
      try {
        deletedCount = liveTableDoc.deleteColumns(colIndices);
        if (deletedCount > 0) {
          toast.success(`Successfully deleted ${deletedCount} column(s).`);
          if (colIndices.length > deletedCount) {
            toast.info(
              `${
                colIndices.length - deletedCount
              } column(s) could not be deleted (possibly out of bounds). Check console for details.`
            );
          }
        } else if (colIndices.length > 0 && deletedCount === 0) {
          toast.info(
            "No columns were deleted. They might have been out of bounds. Check console for details."
          );
        }
      } catch (error) {
        throw error instanceof Error ? error : new Error(String(error));
      }
      return { deletedCount };
    },
    [liveTableDoc]
  );

  const reorderColumn = useCallback(
    (fromIndex: number, toIndex: number) => {
      liveTableDoc.reorderColumn(fromIndex, toIndex);
    },
    [liveTableDoc]
  );

  return (
    <LiveTableContext.Provider
      value={{
        tableId,
        documentTitle,
        documentDescription,
        tableData,
        headers,
        columnWidths,
        isTableLoaded,
        deleteRows,
        deleteColumns,
        reorderColumn,
        awarenessStates,
        cursorsData,
        getCursorsForCell,
      }}
    >
      <DataStoreProvider
        liveTableDoc={liveTableDoc}
        yProvider={yProvider}
        headers={headers}
        tableData={tableData}
        documentTitle={documentTitle}
        documentDescription={documentDescription}
      >
        {children}
      </DataStoreProvider>
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
