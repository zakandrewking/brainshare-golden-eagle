import { useState } from "react";

import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import generateSelectedCellsSuggestions from "./actions/generateSelectedCellsSuggestions";
import { useLiveTable } from "./LiveTableProvider";

export function AiFillSelectionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const {
    tableData,
    headers,
    selectedCells,
    getSelectedCellsData,
    handleCellChange,
  } = useLiveTable();

  const handleClick = async () => {
    if (selectedCells.length === 0) return;

    setIsLoading(true);

    // Get the current data for selected cells
    const selectedCellsData = getSelectedCellsData();

    toast.promise(
      async () => {
        try {
          // Ensure tableData and headers are not undefined
          const dataToUse = tableData || [];
          const headersToUse = headers || [];

          const result = await generateSelectedCellsSuggestions(
            dataToUse,
            headersToUse,
            selectedCells,
            selectedCellsData
          );

          if (result.error) {
            throw new Error(result.error);
          }

          if (result.suggestions && headersToUse.length > 0) {
            // Apply each suggestion to the table
            result.suggestions.forEach((suggestion) => {
              const { rowIndex, colIndex, suggestion: newValue } = suggestion;

              if (colIndex !== undefined) {
                // Now we can use the correct types as expected by handleCellChange
                handleCellChange(rowIndex, colIndex, newValue);
              }
            });
          }
        } catch (error) {
          if (error instanceof Error) {
            toast.error(error.message);
          } else {
            toast.error("An unknown error occurred");
          }
        } finally {
          setIsLoading(false);
        }
      },
      {
        loading: "Generating suggestions for selected cells...",
        success: "Cells updated with AI suggestions!",
        error: "Failed to generate suggestions",
      }
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={selectedCells.length === 0 || isLoading}
    >
      <Wand2 className="mr-2 h-4 w-4" />
      AI Fill Selection
    </Button>
  );
}
