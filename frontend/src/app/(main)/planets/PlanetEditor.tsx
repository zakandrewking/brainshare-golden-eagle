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

import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [editingHeaderIndex, setEditingHeaderIndex] = useState<number | null>(
    null
  );
  const [editingHeaderValue, setEditingHeaderValue] = useState<string>("");
  const yTableRef = React.useRef<Y.Array<Y.Map<unknown>> | null>(null);
  const yHeadersRef = React.useRef<Y.Array<string> | null>(null);
  const awarenessRef = useRef(awareness);
  const yDocRef = useRef<Y.Doc | null>(yDoc); // Create ref for yDoc

  useEffect(() => {
    const yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    const yHeaders = yDoc.getArray<string>("tableHeaders");
    yTableRef.current = yTable;
    yHeadersRef.current = yHeaders;

    // Function to update React state for table data
    const updateTableState = () => {
      const currentData = yTable.toArray().map(yMapToObject);
      setTableData(currentData);
    };

    // Function to update React state for headers
    const updateHeadersState = () => {
      const currentHeaders = yHeaders.toArray();
      // Initialize headers if empty and table has data
      if (currentHeaders.length === 0 && yTable.length > 0) {
        const firstRowMap = yTable.get(0);
        if (firstRowMap) {
          const initialHeaders = Array.from(firstRowMap.keys()).sort();
          // Use transact to ensure atomicity if multiple users initialize
          yDoc.transact(() => {
            // Double check length inside transaction
            if (yHeaders.length === 0) {
              yHeaders.push(initialHeaders);
              setHeaders(initialHeaders); // Update state immediately
            } else {
              // Headers were set by another user concurrently
              setHeaders(yHeaders.toArray());
            }
          });
        } else {
          setHeaders([]); // No first row exists
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

  // --- Header Editing Handlers ---
  const handleHeaderDoubleClick = (index: number) => {
    setEditingHeaderIndex(index);
    setEditingHeaderValue(headers[index] ?? "");
    // De-select any selected data cell when editing header
    setSelectedCell(null);
    awarenessRef.current.setLocalStateField("selectedCell", null);
  };

  const handleHeaderInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingHeaderValue(e.target.value);
  };

  const saveHeaderChange = () => {
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

    // Perform Yjs transaction
    console.log(
      `Renaming header "${oldHeader}" to "${newHeader}" at index ${editingHeaderIndex}`
    );
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
  };

  const handleHeaderBlur = () => {
    saveHeaderChange();
  };

  const handleHeaderKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveHeaderChange();
    } else if (e.key === "Escape") {
      setEditingHeaderIndex(null); // Cancel edit
      setEditingHeaderValue(""); // Reset value
    }
  };
  // --- End Header Editing Handlers ---

  return (
    <TooltipProvider delayDuration={0}>
      <div className="p-4 flex flex-col gap-4">
        {/* Render the Toolbar */}
        <TableToolbar
          yTableRef={yTableRef}
          yDocRef={yDocRef}
          yHeadersRef={yHeadersRef}
          selectedCell={selectedCell}
          headers={headers}
        />

        <table className="table-auto w-full border-collapse border border-slate-400 relative">
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th
                  key={`${header}-${index}`}
                  className="border border-slate-300 p-0 text-left relative group"
                >
                  {editingHeaderIndex === index ? (
                    <Input
                      type="text"
                      value={editingHeaderValue}
                      onChange={handleHeaderInputChange}
                      onBlur={handleHeaderBlur}
                      onKeyDown={handleHeaderKeyDown}
                      autoFocus
                      className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-500 m-0 block bg-transparent"
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className="p-2 cursor-text truncate"
                          onDoubleClick={() => handleHeaderDoubleClick(index)}
                        >
                          {header}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Double-click to edit header</p>
                      </TooltipContent>
                    </Tooltip>
                  )}
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
    </TooltipProvider>
  );
}
