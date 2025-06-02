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
    <ButtonGroup orientation="horizontal">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isLockDisabled}
        aria-label="Lock Selected Cells"
        className="p-0" // to enable tooltip to work
      >
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-center w-full h-full p-3">
                <Lock className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {isLockDisabled ? "Select cells to lock" : "Lock Selected Cells"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Button>
      <Button variant="outline" size="sm" className="p-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="flex items-center justify-center w-full h-full p-3">
              <ChevronDownIcon className="h-4 w-4" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={handleClearAllLocks}
              disabled={isClearAllDisabled}
            >
              Clear All Locks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Button>
    </ButtonGroup>
  );
}

export default LockButton;
