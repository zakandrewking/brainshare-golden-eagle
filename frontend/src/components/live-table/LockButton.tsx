import React from "react";

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

export function LockButton() {
  const unlockAll = useUnlockAll();
  const lockSelectedRange = useLockSelectedRange();
  const selectedCells = useSelectedCells();
  const lockedCells = useLockedCells();

  const handleClick = () => {
    lockSelectedRange(selectedCells);
  };

  const handleClearAllLocks = () => {
    unlockAll();
  };

  const isLockDisabled = !selectedCells || selectedCells.length === 0;
  const isClearAllDisabled = !lockedCells || lockedCells.size === 0;

  return (
    <TooltipProvider delayDuration={0}>
      <ButtonGroup orientation="horizontal">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClick}
              disabled={isLockDisabled}
              aria-label="Lock Selected Cells"
              className="rounded-r-none p-2" // Ensure padding for icon
            >
              <Lock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {isLockDisabled ? "Select cells to lock" : "Lock Selected Cells"}
          </TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="More lock options" // More specific aria-label
                  className="rounded-l-none border-l-0 px-2" // Standard styling for dropdown trigger in a group
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={handleClearAllLocks}
              disabled={isClearAllDisabled}
            >
              Clear All Locks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    </TooltipProvider>
  );
}

export default LockButton;
