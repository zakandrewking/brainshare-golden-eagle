import React from "react";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSelectedCells } from "@/stores/selectionStore";

import { useLiveTable } from "./LiveTableProvider";

export function LockButton() {
  const { lockSelectedRange } = useLiveTable();
  const selectedCells = useSelectedCells();

  const handleClick = () => {
    lockSelectedRange();
  };

  const isDisabled = !selectedCells || selectedCells.length === 0;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            disabled={isDisabled}
            aria-label="Lock Selected Cells"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isDisabled ? "Select cells to lock" : "Lock Selected Cells"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default LockButton;
