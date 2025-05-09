"use client";

import React from "react";

import { useLiveTable } from "./LiveTableProvider";

export interface CursorInfo {
  user?: { name: string; color: string };
}

export interface CursorDataForCell {
  rowIndex: number;
  colIndex: number;
  cursors: CursorInfo[];
}

const DEFAULT_COL_WIDTH = 150;

const LiveTable: React.FC = () => {
  const { tableData, headers, columnWidths, handleCellChange } = useLiveTable();

  return (
    <table className="table-fixed border-collapse border border-slate-400 relative w-full">
      <thead>
        <tr>
          {headers?.map((header, index) => {
            const width = columnWidths?.[header] ?? DEFAULT_COL_WIDTH;
            return (
              <th
                key={`${header}-${index}`}
                data-header={header} // Add data attribute for querying
                className="border border-slate-300 p-0 text-left relative group overflow-hidden"
                style={{
                  width: `${width}px`,
                  minWidth: `${width}px`,
                  maxWidth: `${width}px`,
                  verticalAlign: "top",
                }}
              >
                <div className="flex items-start justify-between">
                  {
                    <div className="p-2 cursor-text flex-grow break-words">
                      {header}
                    </div>
                  }
                  <div
                    className={`absolute top-0 right-0 bottom-0 w-2 cursor-col-resize bg-transparent group-hover:bg-blue-200`}
                  />
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {tableData?.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {headers?.map((header, colIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;
              return (
                <td key={cellKey} className="border p-0 relative">
                  <input
                    type="text"
                    value={String(row[header] ?? "")}
                    onChange={(e) =>
                      handleCellChange(rowIndex, header, e.target.value)
                    }
                    className="w-full h-full p-2 border-none focus:outline-none focus:ring-2 focus:ring-blue-300 bg-transparent"
                  />
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default LiveTable;
