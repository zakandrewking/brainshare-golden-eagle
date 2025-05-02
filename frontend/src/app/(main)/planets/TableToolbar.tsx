import React, { useState } from "react";

import {
  Columns3,
  Download,
  PlusSquare,
  Rows3,
  Trash2,
} from "lucide-react";
import * as Y from "yjs";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TableToolbarProps {
  yTableRef: React.RefObject<Y.Array<Y.Map<unknown>> | null>;
  yDocRef: React.RefObject<Y.Doc | null>; // Pass yDoc for transactions
  yHeadersRef: React.RefObject<Y.Array<string> | null>; // Add yHeadersRef prop
  selectedCell: { rowIndex: number; colIndex: number } | null;
  headers: string[]; // Keep headers derived from yHeaders for display/validation
  isTableLoaded: boolean; // Add the loading state prop
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  yTableRef,
  yDocRef,
  yHeadersRef, // Destructure the new prop
  selectedCell,
  headers,
  isTableLoaded, // Destructure the prop
}) => {
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const handleAddRow = () => {
    console.log("Add Row clicked");
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    // Get yHeaders to initialize new row correctly
    const yHeaders = yHeadersRef.current;
    if (!yDoc || !yTable || !yHeaders) return;

    yDoc.transact(() => {
      const newRow = new Y.Map<unknown>();
      // Initialize new row with current headers from yHeaders
      yHeaders.toArray().forEach((header) => newRow.set(header, ""));
      yTable.push([newRow]);
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

  const handleConfirmAddColumn = () => {
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    const yHeaders = yHeadersRef.current; // Get yHeaders ref
    const headerToAdd = newColumnName.trim();

    if (!yDoc || !yTable || !yHeaders || !headerToAdd) return;

    // Check if header already exists in yHeaders (case-insensitive check)
    if (
      yHeaders
        .toArray()
        .some((h) => h.toLowerCase() === headerToAdd.toLowerCase())
    ) {
      alert(`Column header "${headerToAdd}" already exists.`);
      return; // Prevent adding
    }

    yDoc.transact(() => {
      // 1. Add header to yHeaders array
      yHeaders.push([headerToAdd]);

      // 2. Add the new key to each existing row in yTable
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

    // Close dialog and reset state
    setNewColumnName("");
    setIsAddColumnDialogOpen(false);
  };

  const handleAddColumn = () => {
    setIsAddColumnDialogOpen(true);
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
  const canDeleteRow = !!selectedCell && isTableLoaded;
  const canDeleteColumn =
    !!selectedCell &&
    headers.length > 0 &&
    !!headers[selectedCell.colIndex] &&
    isTableLoaded;
  const canAddOrDelete = isTableLoaded;
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
                handleAddRow();
              }}
              disabled={!canAddOrDelete} // Use combined condition
            >
              <PlusSquare className="h-4 w-4 mr-1" />
              <Rows3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Add Row</TooltipContent>
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
              disabled={!canDeleteRow} // Updated condition
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
        <Dialog
          open={isAddColumnDialogOpen}
          onOpenChange={(isOpen) => {
            if (!isOpen && !isTableLoaded) return; // Prevent opening if not loaded
            setIsAddColumnDialogOpen(isOpen);
            if (!isOpen) setNewColumnName(""); // Reset name on close
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAddColumn}
                  disabled={!canAddOrDelete} // Updated condition
                >
                  <PlusSquare className="h-4 w-4 mr-1" />
                  <Columns3 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Add Column</TooltipContent>
          </Tooltip>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New Column</DialogTitle>
              <DialogDescription>
                Enter a unique name for the new column.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault(); // Prevent default form submission
                handleConfirmAddColumn(); // Use the refactored handler
              }}
            >
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="new-column-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="new-column-name"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    className="col-span-3"
                    autoFocus
                    required
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                {/* Disable button if name is empty or just whitespace */}
                <Button type="submit" disabled={!newColumnName.trim()}>
                  Add Column
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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

export default TableToolbar;
