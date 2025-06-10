import React, { useState } from "react";

import { ChevronDownIcon, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
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
import LockWithNoteDialog from "./LockWithNoteDialog";

export function LockButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const unlockAll = useUnlockAll();
  const lockSelectedRange = useLockSelectedRange();
  const selectedCells = useSelectedCells();
  const lockedCells = useLockedCells();

  const isLockDisabled = !selectedCells || selectedCells.length === 0;
  const isClearAllDisabled = !lockedCells || lockedCells.size === 0;

  const handleClick = () => {
    lockSelectedRange(selectedCells);
  };

  const handleLockWithNote = () => {
    // Close dropdown and blur focused element to prevent aria-hidden conflicts
    setIsDropdownOpen(false);
    if (
      document.activeElement &&
      document.activeElement instanceof HTMLElement
    ) {
      document.activeElement.blur();
    }

    setIsDialogOpen(true);
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
              Lock with Note...
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleClearAllLocks}
              disabled={isClearAllDisabled}
            >
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
    </TooltipProvider>
  );
}

export default LockButton;
