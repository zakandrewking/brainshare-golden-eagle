import React from "react";

import {
  ArrowDownToLine,
  ArrowLeftFromLine,
  ArrowRightFromLine,
  ArrowUpFromLine,
  Columns3,
  Download,
  Rows3,
  Trash2,
} from "lucide-react";
import * as Y from "yjs";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface LiveTableToolbarProps {
  yTableRef: React.RefObject<Y.Array<Y.Map<unknown>> | null>;
  yDocRef: React.RefObject<Y.Doc | null>;
  yHeadersRef: React.RefObject<Y.Array<string> | null>;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  headers: string[];
  isTableLoaded: boolean;
}

// Helper function to create a new row map initialized with headers
const createNewRowMap = (yHeaders: Y.Array<string> | null): Y.Map<unknown> => {
  const newRow = new Y.Map<unknown>();
  if (yHeaders) {
    yHeaders.toArray().forEach((header) => newRow.set(header, ""));
  }
  return newRow;
};

const LiveTableToolbar: React.FC<LiveTableToolbarProps> = ({
  yTableRef,
  yDocRef,
  yHeadersRef,
  selectedCell,
  headers,
  isTableLoaded,
}) => {
  const handleAddRowRelative = (direction: "above" | "below") => {
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    const yHeaders = yHeadersRef.current; // Need headers for initialization
    if (!yDoc || !yTable || !selectedCell) return; // Require selection

    const insertIndex =
      direction === "above" ? selectedCell.rowIndex : selectedCell.rowIndex + 1;

    yDoc.transact(() => {
      const newRow = createNewRowMap(yHeaders);
      yTable.insert(insertIndex, [newRow]);
    });
  };

  const handleDeleteRow = () => {
    console.log("handleDeleteRow called", { selectedCell });
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    if (!yDoc || !yTable || !selectedCell) {
      console.log("Delete row aborted: missing doc, table, or selection");
      return;
    }

    const rowIndexToDelete = selectedCell.rowIndex;
    console.log(`Attempting to delete row at index: ${rowIndexToDelete}`);

    yDoc.transact(() => {
      try {
        console.log(
          "yTable before delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
        yTable.delete(rowIndexToDelete, 1); // Delete 1 row at the selected index
        console.log(
          "yTable after delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
      } catch (error) {
        console.error("Error during row deletion transaction:", error);
      }
    });
  };

  const handleAddColumnRelative = (direction: "left" | "right") => {
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    const yHeaders = yHeadersRef.current; // Get yHeaders ref

    if (!yDoc || !yTable || !yHeaders || !selectedCell) {
      console.log(
        "handleAddColumnRelative aborted: missing doc, table, headers, or selection"
      );
      return;
    }

    // Generate a unique default header name
    const baseName = "New Column";
    let counter = 1;
    let headerToAdd = `${baseName} ${counter}`;
    const existingHeadersLower = yHeaders.toArray().map((h) => h.toLowerCase());

    while (existingHeadersLower.includes(headerToAdd.toLowerCase())) {
      counter++;
      headerToAdd = `${baseName} ${counter}`;
    }

    console.log(
      `[handleAddColumnRelative] Adding column "${headerToAdd}" to the ${direction}`
    );

    yDoc.transact(() => {
      // 1. Determine insertion index based on direction and selection
      let insertIndex = yHeaders.length; // Default to end if no selection/direction
      // Selection is guaranteed by the check above
      insertIndex =
        direction === "left"
          ? selectedCell.colIndex
          : selectedCell.colIndex + 1;

      console.log(
        `[handleAddColumnRelative] Determined insert index: ${insertIndex}`
      );

      // 2. Add header to yHeaders array at the correct index
      yHeaders.insert(insertIndex, [headerToAdd]);

      console.log(
        `[handleAddColumnRelative] yHeaders after insert: ${JSON.stringify(
          yHeaders.toArray()
        )}`
      );

      // 3. Add the new key to each existing row in yTable
      yTable.forEach((row: Y.Map<unknown>) => {
        if (!row.has(headerToAdd)) {
          row.set(headerToAdd, "");
        }
      });
      // If the table was empty, handleAddRow might be better, but this ensures consistency
      if (yTable.length === 0) {
        const newRow = new Y.Map<unknown>();
        newRow.set(headerToAdd, "");
        yTable.push([newRow]);
      }
    });
  };

  const handleDeleteColumn = () => {
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    const yHeaders = yHeadersRef.current; // Get yHeaders ref

    if (
      !yDoc ||
      !yTable ||
      !yHeaders ||
      !selectedCell ||
      !headers[selectedCell.colIndex]
    ) {
      console.log("Delete column aborted: missing dependencies or selection.");
      return;
    }

    const colIndexToDelete = selectedCell.colIndex;
    const headerToDelete = yHeaders.get(colIndexToDelete); // Get header from yHeaders

    if (headerToDelete === undefined) {
      // Extra safety check
      console.error(
        "Could not find header to delete at index",
        colIndexToDelete
      );
      return;
    }

    console.log(
      `Attempting to delete column: "${headerToDelete}" at index ${colIndexToDelete}`
    );

    yDoc.transact(() => {
      try {
        // 1. Delete header from yHeaders array
        yHeaders.delete(colIndexToDelete, 1);

        // 2. Delete the corresponding key from each row in yTable
        yTable.forEach((row: Y.Map<unknown>) => {
          row.delete(headerToDelete);
        });

        console.log("yStructures after column delete:", {
          headers: yHeaders.toArray(),
          table: yTable.toArray().map((r) => r.toJSON()),
        });
      } catch (error) {
        console.error("Error during column deletion transaction:", error);
      }
    });
  };

  // --- CSV Download Handler ---
  const handleDownloadCsv = () => {
    const yTable = yTableRef.current;
    if (!yTable || headers.length === 0) {
      console.warn("CSV Download aborted: No headers or table data.");
      return;
    }

    // Function to escape CSV special characters (comma, quote, newline)
    const escapeCsvCell = (cellData: unknown): string => {
      const stringValue = String(cellData ?? ""); // Handle null/undefined
      // If the value contains a comma, newline, or double quote, enclose it in double quotes
      if (
        stringValue.includes(",") ||
        stringValue.includes("\n") ||
        stringValue.includes('"')
      ) {
        // Escape existing double quotes by doubling them
        const escapedValue = stringValue.replace(/"/g, '""');
        return `"${escapedValue}"`;
      }
      return stringValue;
    };

    // Create Header Row
    const csvHeader = headers.map(escapeCsvCell).join(",");

    // Create Data Rows
    const tableRows = yTable.toArray();
    const csvRows = tableRows.map((rowMap: Y.Map<unknown>) => {
      return headers
        .map((header) => {
          const cellValue = rowMap.get(header); // Get value using the current header
          return escapeCsvCell(cellValue);
        })
        .join(",");
    });

    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join("\n");

    // Create Blob and Trigger Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "planets.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  // --- End CSV Download Handler ---

  // Update conditions based on isTableLoaded
  const canOperateOnSelection = !!selectedCell && isTableLoaded;
  const canDeleteColumn =
    canOperateOnSelection &&
    headers.length > 0 &&
    !!headers[selectedCell.colIndex] &&
    isTableLoaded;
  const canDownload = isTableLoaded && headers.length > 0; // Can download if loaded and has headers

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-transparent p-1 mb-2">
        {/* Row Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddRowRelative("above");
              }}
              disabled={!canOperateOnSelection} // Disable if no cell selected
            >
              <ArrowUpFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Row Above</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddRowRelative("below");
              }}
              disabled={!canOperateOnSelection} // Disable if no cell selected
            >
              <ArrowDownToLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Row Below</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDeleteRow();
              }}
              disabled={!canOperateOnSelection} // Updated condition
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Rows3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Row</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Column Operations */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddColumnRelative("left");
              }}
              disabled={!canOperateOnSelection} // Disable if no selection
            >
              <ArrowLeftFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Left</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleAddColumnRelative("right");
              }}
              disabled={!canOperateOnSelection} // Disable if no selection
            >
              <ArrowRightFromLine className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Column Right</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                e.preventDefault();
                handleDeleteColumn();
              }}
              disabled={!canDeleteColumn} // Updated condition
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Columns3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Column</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-1" />

        {/* Download Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(e) => {
                // Use onMouseDown to prevent focus issues
                e.preventDefault();
                handleDownloadCsv();
              }}
              disabled={!canDownload} // Use the download condition
            >
              <Download className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download CSV</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default LiveTableToolbar;
