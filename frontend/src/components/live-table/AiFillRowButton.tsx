import React, { useEffect, useRef, useState, useTransition } from "react";

import { Loader2, Rows3, Sparkles } from "lucide-react";
import { toast } from "sonner";
import * as Y from "yjs";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { generateRowSuggestions } from "./actions";

interface AiFillRowButtonProps {
  isDisabled: boolean;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  yDoc: Y.Doc | null;
  yTable: Y.Array<Y.Map<unknown>> | null;
  yHeaders: Y.Array<string> | null;
  withTooltipProvider?: boolean;
}

const AiFillRowButton: React.FC<AiFillRowButtonProps> = ({
  isDisabled,
  selectedCell,
  yDoc,
  yTable,
  yHeaders,
  withTooltipProvider = false,
}) => {
  const [isPending, startTransition] = useTransition();
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedCellForAiFill, setSelectedCellForAiFill] = useState<{
    rowIndex: number;
    colIndex: number;
  } | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  const handleAiFillRow = () => {
    if (!selectedCell) return;
    setSelectedCellForAiFill(selectedCell);
    setIsConfirmDialogOpen(true);
  };

  const confirmAiFillRow = () => {
    const targetCell = selectedCellForAiFill;

    if (!targetCell || !yDoc || !yTable || !yHeaders) {
      toast.error("Cannot perform AI fill: Missing required data.");
      return;
    }

    const currentTableData = yTable.toArray().map((row) => row.toJSON());
    const targetRowIndex = targetCell.rowIndex;

    startTransition(async () => {
      setSelectedCellForAiFill(null);
      const result = await generateRowSuggestions(
        currentTableData,
        yHeaders.toArray(),
        targetRowIndex
      );

      if (result.error) {
        toast.error(`AI Fill Error: ${result.error}`);
        return;
      }

      if (result.suggestions && result.suggestions.length > 0) {
        const suggestions = result.suggestions;
        yDoc.transact(() => {
          const rowMap = yTable.get(targetRowIndex);
          if (rowMap) {
            suggestions.forEach(({ header, suggestion }) => {
              rowMap.set(header, suggestion);
            });
          } else {
            console.warn(`Could not find row at index ${targetRowIndex}`);
          }
        });
        toast.success(`Row ${targetRowIndex + 1} updated with AI suggestions.`);
      } else {
        toast.warning(
          `AI returned no suggestions for row ${targetRowIndex + 1}.`
        );
      }
    });
  };

  // Effect to handle Enter key presses when dialog is open
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isConfirmDialogOpen) return;

      if (event.key === "Enter" && !isPending) {
        event.preventDefault();
        confirmButtonRef.current?.click();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isConfirmDialogOpen, isPending]);

  const tooltipButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onMouseDown={(e) => {
            e.preventDefault();
            handleAiFillRow();
          }}
          disabled={isDisabled || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="flex items-center justify-center">
              <Rows3 className="h-4 w-4 mr-1" />
              <Sparkles className="h-3 w-3" />
            </div>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>AI Fill Selected Row</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      {withTooltipProvider ? (
        <TooltipProvider>{tooltipButton}</TooltipProvider>
      ) : (
        tooltipButton
      )}

      <AlertDialog
        open={isConfirmDialogOpen}
        onOpenChange={(open) => {
          setIsConfirmDialogOpen(open);
          if (!open) {
            setSelectedCellForAiFill(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm AI Row Fill</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all existing data in the selected row with
              AI-generated suggestions based on the entire table. This action
              cannot be undone. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isPending}
              onClick={() => setSelectedCellForAiFill(null)}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              ref={confirmButtonRef}
              onClick={confirmAiFillRow}
              disabled={isPending || !selectedCellForAiFill}
            >
              {isPending ? "Generating..." : "Confirm & Generate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AiFillRowButton;
