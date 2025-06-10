import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { CellPosition } from "@/stores/selectionStore";

interface LockWithNoteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLock: (note?: string) => void;
  selectedCells: CellPosition[];
}

export function LockWithNoteDialog({
  isOpen,
  onOpenChange,
  onLock,
  selectedCells,
}: LockWithNoteDialogProps) {
  const [note, setNote] = useState("");

  const handleLock = () => {
    onLock(note.trim() || undefined);
    setNote("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setNote("");
    onOpenChange(false);
  };

  const cellCount = selectedCells.length;
  const cellText = cellCount === 1 ? "cell" : "cells";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lock with Note</DialogTitle>
          <DialogDescription>
            You are about to lock {cellCount} {cellText}. Optionally, add a note
            to explain why these cells are locked.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="lock-note"
              className="text-sm font-medium mb-2 block"
            >
              Note (optional)
            </label>
            <Textarea
              id="lock-note"
              placeholder="Enter a reason for locking these cells..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-20"
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleLock}>
            Lock {cellCount} {cellText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LockWithNoteDialog;
