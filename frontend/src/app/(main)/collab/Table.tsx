import React, {
  useCallback,
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
  const yTableRef = React.useRef<Y.Array<Y.Map<unknown>> | null>(null);

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
      // Note: The updateTableState function will be triggered by the observer
    },
    [yDoc] // Depend on yDoc for transaction capability
  );

  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">Collaborative Table</h1>
      <table className="table-auto w-full border-collapse border border-slate-400">
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
              {headers.map((header) => (
                <td key={`${rowIndex}-${header}`} className="border p-0">
                  <input
                    type="text"
                    value={String(row[header] ?? "")}
                    onChange={(e) =>
                      handleCellChange(rowIndex, header, e.target.value)
                    }
                    className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
