import React, {
  useEffect,
  useState,
} from "react";

import * as Y from "yjs";

import { useRoom } from "@liveblocks/react/suspense";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

// Convert Y.Map to a plain JS object for rendering
function yMapToObject(yMap: Y.Map<unknown>): Record<string, unknown> {
  return Object.fromEntries(yMap.entries());
}

export default function Table() {
  const room = useRoom();
  const yProvider = getYjsProviderForRoom(room);
  const yDoc = yProvider.getYDoc();
  const [tableData, setTableData] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  useEffect(() => {
    const yTable = yDoc.getArray<Y.Map<unknown>>("tableData");

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

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Collaborative Table</h1>
      <table className="table-auto w-full border-collapse border border-slate-400">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border border-slate-300 p-2 bg-slate-100 text-left"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {headers.map((header) => (
                <td
                  key={`${rowIndex}-${header}`}
                  className="border border-slate-300 p-2"
                >
                  {/* Render cell data, handle potential undefined if a row doesn't have a specific header */}
                  {String(row[header] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {/* TODO: Add functionality to add/edit rows/columns */}
    </div>
  );
}
