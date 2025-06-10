import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { CommandShortcut } from "@/components/ui/command";
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

  // Detect platform for keyboard shortcut display
  const isMac =
    typeof navigator !== "undefined" &&
    navigator.userAgent.toUpperCase().indexOf("MAC") >= 0;
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  const handleLock = useCallback(() => {
    onLock(note.trim() || undefined);
    setNote("");
    onOpenChange(false);
  }, [note, onLock, onOpenChange]);

  const handleCancel = useCallback(() => {
    setNote("");
    onOpenChange(false);
  }, [onOpenChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleLock();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleCancel();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleLock, handleCancel]);

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      setNote("");
    }
    onOpenChange(open);
  };

  const cellCount = selectedCells.length;
  const cellText = cellCount === 1 ? "cell" : "cells";

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        data-testid="lock-with-note-dialog"
        data-preserve-selection="true"
      >
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
              autoFocus
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleLock} className="flex items-center gap-3">
            Lock {cellCount} {cellText}
            <CommandShortcut>{shortcutKey}+Enter</CommandShortcut>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LockWithNoteDialog;
