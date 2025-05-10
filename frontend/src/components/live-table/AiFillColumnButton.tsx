import React, { useEffect, useRef, useState, useTransition } from "react";

import { Loader2, Sparkles } from "lucide-react";
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

import { generateColumnSuggestions } from "./actions";

interface AiFillColumnButtonProps {
  isDisabled: boolean;
  selectedCell: { rowIndex: number; colIndex: number } | null;
  yDoc: Y.Doc | null;
  yTable: Y.Array<Y.Map<unknown>> | null;
  yHeaders: Y.Array<string> | null;
  withTooltipProvider?: boolean;
}

const AiFillColumnButton: React.FC<AiFillColumnButtonProps> = ({
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

  const handleAiFillColumn = () => {
    if (!selectedCell) return;
    setSelectedCellForAiFill(selectedCell);
    setIsConfirmDialogOpen(true);
  };

  const confirmAiFillColumn = () => {
    const targetCell = selectedCellForAiFill;

    if (!targetCell || !yDoc || !yTable || !yHeaders) {
      toast.error("Cannot perform AI fill: Missing required data.");
      return;
    }

    const currentTableData = yTable.toArray().map((row) => row.toJSON());
    const targetColIndex = targetCell.colIndex;
    const targetHeader = yHeaders.get(targetColIndex);

    startTransition(async () => {
      setSelectedCellForAiFill(null);
      const result = await generateColumnSuggestions(
        currentTableData,
        yHeaders.toArray(),
        targetColIndex
      );

      if (result.error) {
        toast.error(`AI Fill Error: ${result.error}`);
        return;
      }

      if (result.suggestions && result.suggestions.length > 0) {
        const suggestions = result.suggestions;
        yDoc.transact(() => {
          suggestions.forEach(({ index, suggestion }) => {
            if (index >= 0 && index < yTable.length) {
              const rowMap = yTable.get(index);
              if (rowMap) {
                rowMap.set(targetHeader, suggestion);
              } else {
                console.warn(
                  `Could not find rowMap for suggestion at index ${index}`
                );
              }
            } else {
              console.warn(`Invalid suggestion index received: ${index}`);
            }
          });
        });
        toast.success(`Column "${targetHeader}" updated with AI suggestions.`);
      } else {
        toast.warning(
          `AI returned no suggestions for column "${targetHeader}".`
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
            handleAiFillColumn();
          }}
          disabled={isDisabled || isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>AI Fill Selected Column</TooltipContent>
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
            <AlertDialogTitle>Confirm AI Column Fill</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all existing data in the selected column
              (excluding the header) with AI-generated suggestions based on the
              entire table. This action cannot be undone. Are you sure?
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
              onClick={confirmAiFillColumn}
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

export default AiFillColumnButton;
