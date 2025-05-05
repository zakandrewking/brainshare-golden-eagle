"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useSelf } from "@liveblocks/react";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

import { LiveTableContainer } from "@/components/live-table/LiveTableContainer";

// Type for awareness state (adjust based on what you store, e.g., user info)
interface AwarenessState {
  user?: { name: string; color: string }; // Example user info
  selectedCell?: { rowIndex: number; colIndex: number };
}

// Type for the map returned by awareness.getStates()
type AwarenessStates = Map<number, AwarenessState>;

// Type for cursor data passed to LiveTable
interface CursorDataForCell {
  rowIndex: number;
  colIndex: number;
  cursors: AwarenessState[]; // Pass the full AwarenessState for now
}

// Convert Y.Map to a plain JS object for rendering
function yMapToObject(yMap: Y.Map<unknown>): Record<string, unknown> {
  return Object.fromEntries(yMap.entries());
}

export default function PlanetEditor() {
  const room = useRoom();
  const self = useSelf();
  const yProvider = getYjsProviderForRoom(room);
  const yDoc = yProvider.getYDoc();
  const awareness = yProvider.awareness;
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  const [awarenessStates, setAwarenessStates] = useState<AwarenessStates>(
    () => new Map()
  );
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(
    null
  );
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>("");
  const [isTableLoaded, setIsTableLoaded] = useState<boolean>(false);
  const yTableRef = React.useRef<Y.Array<Y.Map<unknown>> | null>(null);
  const yHeadersRef = React.useRef<Y.Array<string> | null>(null);
  const awarenessRef = useRef(awareness);
  const yDocRef = useRef<Y.Doc | null>(yDoc); // Create ref for yDoc

  // Memoize Yjs types directly for UndoManager dependency
  const yTable = useMemo(
    () => yDoc.getArray<Y.Map<unknown>>("tableData"),
    [yDoc]
  );
  const yHeaders = useMemo(() => yDoc.getArray<string>("tableHeaders"), [yDoc]);

  const undoManager = useMemo(() => {
    if (!yTable || !yHeaders) return null;
    return new UndoManager([yTable, yHeaders], {
      captureTimeout: 500, // Group consecutive changes
    });
  }, [yTable, yHeaders]);

  useEffect(() => {
    // Assign Yjs types to refs (if needed elsewhere, otherwise might remove)
    yTableRef.current = yTable;
    yHeadersRef.current = yHeaders;

    // Function to update React state for table data
    const updateTableState = () => {
      // Use yTable directly
      const currentData = yTable.toArray().map(yMapToObject);
      setTableData(currentData);
    };

    // Function to update React state for headers
    const updateHeadersState = () => {
      // Use yHeaders directly
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

    // Initial state load
    updateTableState();
    updateHeadersState();

    // Observe changes
    const tableObserver = () => updateTableState();
    const headersObserver = () => updateHeadersState();

    yTable.observeDeep(tableObserver);
    yHeaders.observe(headersObserver);

    // Cleanup observers on unmount
    return () => {
      yTable.unobserveDeep(tableObserver);
      yHeaders.unobserve(headersObserver);
    };
  }, [yTable, yHeaders, yDoc]);

  useEffect(() => {
    if (!isTableLoaded && yTableRef.current && yHeadersRef.current) {
      const yTableIsEmpty = yTable.length === 0;
      const tableDataPopulated = tableData.length > 0;
      const headersPopulated = headers.length > 0;

      // Condition: Table is loaded if EITHER Yjs table is empty
      // OR the Yjs table has rows AND both tableData and headers React states are populated
      if (yTableIsEmpty || (tableDataPopulated && headersPopulated)) {
        setIsTableLoaded(true);
        console.log("Table marked as loaded based on state population.");
      }
    }
  }, [tableData, headers, isTableLoaded, yTable.length]);

  // Effect to set user info in awareness state when it changes
  useEffect(() => {
    awarenessRef.current.setLocalStateField("user", {
      name: self?.info?.name ?? "Anonymous",
      color: self?.info?.color ?? "#000000",
    });
  }, [self?.info?.name, self?.info?.color]); // Depend on specific fields

  // Memoized function to update React state with awareness changes
  const updateAwarenessStateCallback = useCallback(() => {
    // awarenessRef is stable, so safe to use here without dependency
    setAwarenessStates(
      new Map(awarenessRef.current.getStates() as Map<number, AwarenessState>)
    );
  }, []); // Empty dependency array ensures stable function reference

  // Effect to subscribe to awareness changes
  useEffect(() => {
    const currentAwareness = awarenessRef.current;

    // Initial load of awareness states
    updateAwarenessStateCallback();

    // Listen for awareness changes
    currentAwareness.on("update", updateAwarenessStateCallback);

    // Cleanup on unmount
    return () => {
      currentAwareness.off("update", updateAwarenessStateCallback);
      // Optional: Clear local state on unmount if desired
      // currentAwareness.setLocalStateField('selectedCell', null);
    };
  }, [updateAwarenessStateCallback]); // Empty dependency array: run only once on mount

  // Function to handle cell changes
  const handleCellChange = useCallback(
    (rowIndex: number, header: string, newValue: string) => {
      const yTable = yTableRef.current;
      if (!yTable || !yDocRef.current) return;

      yDocRef.current.transact(() => {
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
    []
  );

  // Function to handle cell focus
  const handleCellFocus = useCallback((rowIndex: number, colIndex: number) => {
    setSelectedCell({ rowIndex, colIndex });
    awarenessRef.current.setLocalStateField("selectedCell", {
      rowIndex,
      colIndex,
    });
    setEditingHeaderIndex(null); // Ensure header editing is stopped
  }, []);

  // Function to handle cell blur
  const handleCellBlur = useCallback(() => {
    setSelectedCell(null);
    awarenessRef.current.setLocalStateField("selectedCell", null);
    // No need to interact with header state on cell blur
  }, []);

  // --- Header Editing Handlers ---
  const handleHeaderDoubleClick = useCallback(
    (index: number) => {
      setEditingHeaderIndex(index);
      setEditingHeaderValue(headers[index] ?? "");
      // De-select any selected data cell when editing header
      setSelectedCell(null);
      awarenessRef.current.setLocalStateField("selectedCell", null);
    },
    [headers]
  );

  const handleHeaderInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEditingHeaderValue(e.target.value);
    },
    []
  );

  const saveHeaderChange = useCallback(() => {
    if (editingHeaderIndex === null) return;

    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    const yHeaders = yHeadersRef.current;
    const oldHeader = headers[editingHeaderIndex];
    const newHeader = editingHeaderValue.trim();

    if (!yDoc || !yTable || !yHeaders || oldHeader === undefined) {
      console.error(
        "Cannot save header change: Yjs refs missing or old header invalid."
      );
      setEditingHeaderIndex(null); // Cancel edit
      return;
    }

    // Basic Validations
    if (!newHeader) {
      alert("Header name cannot be empty.");
      // Optionally revert input value or keep editing?
      // For simplicity, we cancel the edit here.
      setEditingHeaderIndex(null);
      return;
    }

    // Check for uniqueness (case-insensitive, excluding self)
    if (
      headers.some(
        (h, idx) =>
          h.toLowerCase() === newHeader.toLowerCase() &&
          idx !== editingHeaderIndex
      )
    ) {
      alert(`Header "${newHeader}" already exists.`);
      setEditingHeaderIndex(null); // Cancel edit
      return;
    }

    // If name hasn't changed, just exit edit mode
    if (oldHeader === newHeader) {
      setEditingHeaderIndex(null);
      return;
    }

    yDoc.transact(() => {
      try {
        // 1. Update yHeaders array
        yHeaders.delete(editingHeaderIndex, 1);
        yHeaders.insert(editingHeaderIndex, [newHeader]);

        // 2. Update keys in yTable rows
        yTable.forEach((row: Y.Map<unknown>) => {
          if (row.has(oldHeader)) {
            const value = row.get(oldHeader);
            row.set(newHeader, value);
            row.delete(oldHeader);
          }
        });

        console.log("yStructures after inline header rename:", {
          headers: yHeaders.toArray(),
          table: yTable.toArray().map((r) => r.toJSON()),
        });
      } catch (error) {
        console.error("Error during inline header rename transaction:", error);
      }
    });

    setEditingHeaderIndex(null); // Finish editing
  }, [editingHeaderIndex, editingHeaderValue, headers]);

  const handleHeaderBlur = useCallback(() => {
    saveHeaderChange();
  }, [saveHeaderChange]);

  const handleHeaderKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        saveHeaderChange();
      } else if (e.key === "Escape") {
        setEditingHeaderIndex(null); // Cancel edit
        setEditingHeaderValue(""); // Reset value
      }
    },
    [saveHeaderChange]
  );
  // --- End Header Editing Handlers ---

  // --- Compute Cursors Data ---
  const cursorsData = useMemo(() => {
    const data: CursorDataForCell[] = [];
    const numRows = tableData.length;
    const numCols = headers.length;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const cellCursors: AwarenessState[] = [];
        awarenessStates.forEach((state, clientId) => {
          if (
            clientId !== self?.connectionId &&
            state.selectedCell?.rowIndex === r &&
            state.selectedCell?.colIndex === c
          ) {
            cellCursors.push(state);
          }
        });
        if (cellCursors.length > 0) {
          data.push({ rowIndex: r, colIndex: c, cursors: cellCursors });
        }
      }
    }
    return data;
  }, [awarenessStates, tableData.length, headers.length, self?.connectionId]);

  return (
    <div className="p-4 flex flex-col gap-4">
      <LiveTableContainer
        cursorsData={cursorsData}
        editingHeaderIndex={editingHeaderIndex}
        editingHeaderValue={editingHeaderValue}
        headers={headers}
        isTableLoaded={isTableLoaded}
        onCellBlur={handleCellBlur}
        onCellChange={handleCellChange}
        onCellFocus={handleCellFocus}
        onHeaderBlur={handleHeaderBlur}
        onHeaderChange={handleHeaderInputChange}
        onHeaderDoubleClick={handleHeaderDoubleClick}
        onHeaderKeyDown={handleHeaderKeyDown}
        selectedCell={selectedCell}
        selfColor={String(self?.info?.color ?? undefined)}
        tableData={tableData}
        undoManager={undoManager}
        yDocRef={yDocRef}
        yHeadersRef={yHeadersRef}
        yTableRef={yTableRef}
      />
    </div>
  );
}
