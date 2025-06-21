import React, { useState } from "react";

import { ChevronDownIcon, FileText, Lock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useLockAndSaveSelectedRange,
  useLockedCells,
  useLockSelectedRange,
  useUnlockAll,
} from "@/stores/dataStore";
import { useSelectedCells } from "@/stores/selectionStore";

import { ButtonGroup } from "../ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import CitationFinderDialog from "./CitationFinderDialog";
import LockWithNoteDialog from "./LockWithNoteDialog";

export function LockButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCitationDialogOpen, setIsCitationDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const unlockAll = useUnlockAll();
  const lockSelectedRange = useLockSelectedRange();
  const lockAndSaveSelectedRange = useLockAndSaveSelectedRange();
  const selectedCells = useSelectedCells();
  const lockedCells = useLockedCells();

  const isLockDisabled = !selectedCells || selectedCells.length === 0;
  const isClearAllDisabled = !lockedCells || lockedCells.size === 0;

  const handleClick = () => {
    lockSelectedRange(selectedCells);
  };

  const handleLockWithNote = () => {
    // We get this error, but i'm going to accept it for now: Blocked
    // aria-hidden on an element because its descendant retained focus.
    // ... already spend > 1 hour messing around with this.
    setIsDropdownOpen(false);
    requestAnimationFrame(() => {
      setIsDialogOpen(true);
    });
  };

  const handleFindCitations = () => {
    setIsDropdownOpen(false);
    requestAnimationFrame(() => {
      setIsCitationDialogOpen(true);
    });
  };

  const handleDialogLock = (note?: string) => {
    lockSelectedRange(selectedCells, note);
  };

  const handleClearAllLocks = () => {
    unlockAll();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <ButtonGroup orientation="horizontal" data-preserve-selection="true">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={isLockDisabled}
              aria-label="Lock Selected Cells"
              className="rounded-r-none p-2"
            >
              <Lock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLockDisabled ? "Select cells to lock" : "Lock Selected Cells"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="More lock options"
                  className="rounded-l-none border-l-0 px-2"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end" data-preserve-selection="true">
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                handleLockWithNote();
              }}
              disabled={isLockDisabled}
            >
              <Lock className="h-4 w-4 mr-2" />
              Lock with Note...
            </DropdownMenuItem>
            {process.env.NODE_ENV === "development" && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  handleFindCitations();
                }}
                disabled={isLockDisabled}
              >
                <FileText className="h-4 w-4 mr-2" />
                Find Citations...
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={handleClearAllLocks}
              disabled={isClearAllDisabled}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Locks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>

      <LockWithNoteDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onLock={handleDialogLock}
        selectedCells={selectedCells || []}
      />

      <CitationFinderDialog
        isOpen={isCitationDialogOpen}
        onOpenChange={setIsCitationDialogOpen}
        onLockAndSave={lockAndSaveSelectedRange}
        selectedCells={selectedCells || []}
      />
    </TooltipProvider>
  );
}

export default LockButton;
