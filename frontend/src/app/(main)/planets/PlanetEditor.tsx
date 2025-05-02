"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import * as Y from "yjs";

import { useSelf } from "@liveblocks/react";
import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

import TableToolbar from "./TableToolbar";

// Type for awareness state (adjust based on what you store, e.g., user info)
interface AwarenessState {
  user?: { name: string; color: string }; // Example user info
  selectedCell?: { rowIndex: number; colIndex: number };
}

// Type for the map returned by awareness.getStates()
type AwarenessStates = Map<number, AwarenessState>;

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
  const yTableRef = React.useRef<Y.Array<Y.Map<unknown>> | null>(null);
  const awarenessRef = useRef(awareness);
  const yDocRef = useRef<Y.Doc | null>(yDoc); // Create ref for yDoc

  useEffect(() => {
    const yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    yTableRef.current = yTable;

    // Function to update React state from Yjs state
    const updateTableState = () => {
      const currentData = yTable.toArray().map(yMapToObject);
      setTableData(currentData);

      // Dynamically generate headers from all keys in all rows
      const allKeys = new Set<string>();
      currentData.forEach((row: Record<string, unknown>) => {
        Object.keys(row).forEach((key) => allKeys.add(key));
      });
      // Sort headers for consistent column order (e.g., alphabetically or by col index)
      const sortedHeaders = Array.from(allKeys).sort();
      setHeaders(sortedHeaders);
    };

    // Initial state load
    updateTableState();

    // Observe changes
    const observer = () => {
      updateTableState();
    };
    yTable.observeDeep(observer);

    // Cleanup observer on unmount
    return () => {
      yTable.unobserveDeep(observer);
    };
  }, [room, yDoc]);

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
      if (!yTable) return;

      // Yjs transactions ensure atomicity
      yDoc.transact(() => {
        const yRow = yTable.get(rowIndex);
        if (yRow) {
          // Treat empty string as deletion for simplicity, or handle based on needs
          if (newValue === "") {
            yRow.delete(header);
          } else {
            yRow.set(header, newValue);
          }
        }
      });
    },
    [yDoc]
  );

  // Function to handle cell focus
  const handleCellFocus = useCallback(
    (rowIndex: number, colIndex: number) => {
      setSelectedCell({ rowIndex, colIndex });
      awarenessRef.current.setLocalStateField("selectedCell", {
        rowIndex,
        colIndex,
      });
    },
    [] // awarenessRef ensures stability
  );

  // Function to handle cell blur
  const handleCellBlur = useCallback(() => {
    setSelectedCell(null);
    awarenessRef.current.setLocalStateField("selectedCell", null);
  }, []); // awarenessRef ensures stability

  // Helper to get cursors for a specific cell
  const getCursorsForCell = (
    rowIndex: number,
    colIndex: number
  ): AwarenessState[] => {
    const cursors: AwarenessState[] = [];
    awarenessStates.forEach((state, clientId) => {
      // Exclude self
      if (
        clientId !== self?.connectionId &&
        state.selectedCell?.rowIndex === rowIndex &&
        state.selectedCell?.colIndex === colIndex
      ) {
        cursors.push(state);
      }
    });
    return cursors;
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Render the Toolbar */}
      <TableToolbar
        yTableRef={yTableRef}
        yDocRef={yDocRef}
        selectedCell={selectedCell}
        headers={headers}
      />

      <table className="table-auto w-full border-collapse border border-slate-400 relative">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border border-slate-300 p-2 text-left"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header, colIndex) => {
                const cellKey = `${rowIndex}-${colIndex}`;
                const cursors = getCursorsForCell(rowIndex, colIndex);
                const isSelectedBySelf =
                  selectedCell?.rowIndex === rowIndex &&
                  selectedCell?.colIndex === colIndex;

                // Determine border color based on selection/cursors
                let borderColor = "transparent"; // Default or border-slate-300?
                if (isSelectedBySelf) {
                  borderColor = String(self?.info?.color ?? "blue"); // Use self color
                } else if (cursors.length > 0) {
                  borderColor = String(cursors[0].user?.color ?? "gray"); // Use first cursor's color
                }

                return (
                  <td
                    key={cellKey}
                    className="border p-0 relative" // Added relative positioning
                    style={{
                      boxShadow: `inset 0 0 0 2px ${borderColor}`, // Visual indicator
                    }}
                  >
                    {/* Render cursor labels */}
                    {cursors.map((cursor, index) => (
                      <div
                        key={index}
                        className="absolute text-xs px-1 rounded text-white"
                        style={{
                          backgroundColor: String(
                            cursor.user?.color ?? "#000000"
                          ),
                          top: `${index * 14}px`, // Stack labels
                          right: "0px",
                          zIndex: 10, // Ensure labels are above input
                          pointerEvents: "none", // Don't interfere with input focus
                        }}
                      >
                        {cursor.user?.name ?? "Anonymous"}
                      </div>
                    ))}
                    <input
                      type="text"
                      value={String(row[header] ?? "")}
                      onChange={(e) =>
                        handleCellChange(rowIndex, header, e.target.value)
                      }
                      onFocus={() => handleCellFocus(rowIndex, colIndex)}
                      onBlur={handleCellBlur}
                      className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
