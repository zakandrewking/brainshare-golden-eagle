import React, { useState } from "react";

import {
  Columns3,
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
  selectedCell: { rowIndex: number; colIndex: number } | null;
  headers: string[];
}

const TableToolbar: React.FC<TableToolbarProps> = ({
  yTableRef,
  yDocRef,
  selectedCell,
  headers,
}) => {
  const [isAddColumnDialogOpen, setIsAddColumnDialogOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  const handleAddRow = () => {
    // TODO: Implement Yjs logic to add a row
    console.log("Add Row clicked");
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    if (!yDoc || !yTable) return;

    yDoc.transact(() => {
      const newRow = new Y.Map<unknown>();
      // Initialize new row with existing headers set to empty string
      headers.forEach((header) => newRow.set(header, ""));
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
    const headerToAdd = newColumnName.trim();

    if (!yDoc || !yTable || !headerToAdd) return;

    // Check if header already exists (case-insensitive check?)
    if (headers.some((h) => h.toLowerCase() === headerToAdd.toLowerCase())) {
      alert(`Column header "${headerToAdd}" already exists.`);
      // Keep dialog open maybe? Or close and clear?
      return; // Prevent adding
    }

    yDoc.transact(() => {
      // Add the new header with an empty string to each existing row
      yTable.forEach((row: Y.Map<unknown>) => {
        if (!row.has(headerToAdd)) {
          // Avoid overwriting if somehow exists
          row.set(headerToAdd, "");
        }
      });
      // If the table is empty, add a first row with the new header
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
    console.log("handleDeleteColumn called", { selectedCell, headers });
    const yDoc = yDocRef.current;
    const yTable = yTableRef.current;
    if (!yDoc || !yTable || !selectedCell || !headers[selectedCell.colIndex]) {
      console.log(
        "Delete column aborted: missing doc, table, selection, or header index invalid",
        {
          hasDoc: !!yDoc,
          hasTable: !!yTable,
          hasSelectedCell: !!selectedCell,
          colIndex: selectedCell?.colIndex,
          headerExists: !!headers[selectedCell?.colIndex ?? -1],
        }
      );
      return;
    }

    const headerToDelete = headers[selectedCell.colIndex];
    const colIndexToDelete = selectedCell.colIndex; // For logging
    console.log(
      `Attempting to delete column: "${headerToDelete}" at index ${colIndexToDelete}`
    );

    yDoc.transact(() => {
      try {
        console.log(
          "yTable before column delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
        yTable.forEach((row: Y.Map<unknown>) => {
          row.delete(headerToDelete);
        });
        console.log(
          "yTable after column delete:",
          yTable.toArray().map((r) => r.toJSON())
        );
      } catch (error) {
        console.error("Error during column deletion transaction:", error);
      }
    });
  };

  const canDeleteRow = !!selectedCell;
  const canDeleteColumn =
    !!selectedCell && headers.length > 0 && !!headers[selectedCell.colIndex];

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
              disabled={!canDeleteRow}
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
          onOpenChange={setIsAddColumnDialogOpen}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" onClick={handleAddColumn}>
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
                handleConfirmAddColumn();
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
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
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
              disabled={!canDeleteColumn}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              <Columns3 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete Column</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default TableToolbar;
