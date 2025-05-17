import React from "react";

import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function LockButton() {
  const handleClick = () => {
    // Placeholder for opening the modal
    console.log("Lock button clicked, modal should open.");
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClick}
            aria-label="Table Lock Options"
          >
            <Lock className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Table Lock Options</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default LockButton;
