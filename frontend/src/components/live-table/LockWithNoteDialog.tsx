import React, {
  useEffect,
  useState,
} from "react";

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

  // Manage dialog open/close effects
  useEffect(() => {
    if (isOpen) {
      // When dialog opens, ensure focus goes to the textarea
      setTimeout(() => {
        const textarea = document.getElementById("lock-note");
        if (textarea) {
          textarea.focus();
        }
      }, 100);
    }

    if (!isOpen) {
      // Force reset body styles that might be left over from modal
      setTimeout(() => {
        // Reset body styles
        document.body.style.overflow = "";
        document.body.style.pointerEvents = "";
        document.body.style.userSelect = "";
        document.body.style.webkitUserSelect = "";

        // Remove any leftover modal classes
        document.body.classList.remove("overflow-hidden");

        // Only manage focus if it's problematic
        if (
          document.activeElement &&
          !document.body.contains(document.activeElement)
        ) {
          // Focus is on an element that no longer exists, focus body
          document.body.focus();
          document.body.blur();
        }
      }, 50);
    }
  }, [isOpen]);

  const handleLock = () => {
    onLock(note.trim() || undefined);
    setNote("");
    forcePageResponsiveness();
    onOpenChange(false);
  };

  const forcePageResponsiveness = () => {
    // Aggressive cleanup to ensure page remains responsive
    setTimeout(() => {
      document.body.style.overflow = "";
      document.body.style.pointerEvents = "";
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
      document.body.style.cursor = "";
      document.body.classList.remove("overflow-hidden");

      // Remove any potential modal-related attributes
      document.body.removeAttribute("data-scroll-locked");
      document.body.removeAttribute("data-radix-scroll-area-viewport");

      // Only blur focus if it's on a non-existent element
      if (
        document.activeElement &&
        !document.body.contains(document.activeElement)
      ) {
        (document.activeElement as HTMLElement).blur?.();
      }

      // Force a repaint to ensure styles are applied
      void document.body.offsetHeight;
    }, 10);

    // Additional cleanup after a slightly longer delay
    setTimeout(() => {
      // Make sure body is definitely interactive
      document.body.style.pointerEvents = "";
      document.body.style.userSelect = "";
    }, 100);
  };

  const handleCancel = () => {
    setNote("");
    forcePageResponsiveness();
    onOpenChange(false);
  };

  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      // Clear note when dialog closes
      setNote("");
      forcePageResponsiveness();
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
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
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
          <Button onClick={handleLock}>
            Lock {cellCount} {cellText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default LockWithNoteDialog;
