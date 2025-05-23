import {
  useMemo,
  useState,
} from "react";

import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useSelectedCells } from "@/stores/selectionStore";

import generateSelectedCellsSuggestions
  from "./actions/generateSelectedCellsSuggestions";
import { useLiveTable } from "./LiveTableProvider";

export function AiFillSelectionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const {
    tableData,
    headers,
    handleCellChange,
  } = useLiveTable();

  const selectedCells = useSelectedCells();

  const selectedCellsData = useMemo(() => {
    if (!tableData || !headers || selectedCells.length === 0) {
      return [];
    }

    // Group cells by row
    const rowGroups = selectedCells.reduce<Record<number, typeof selectedCells[0][]>>(
      (acc, cell) => {
        if (!acc[cell.rowIndex]) {
          acc[cell.rowIndex] = [];
        }
        acc[cell.rowIndex].push(cell);
        return acc;
      },
      {}
    );

    // For each row, extract the cell data in order
    return Object.keys(rowGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .map((rowIndex) => {
        const row = rowGroups[rowIndex].sort((a, b) => a.colIndex - b.colIndex);
        return row.map((cell) => {
          const header = headers[cell.colIndex];
          const rowData = tableData[cell.rowIndex];
          return rowData && header ? String(rowData[header] ?? "") : "";
        });
      });
  }, [selectedCells, tableData, headers]);

  const handleClick = async () => {
    if (selectedCells.length === 0) return;

    setIsLoading(true);

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

              // Get the header name for the column index
              const header = headersToUse[colIndex];
              if (header) {
                // Now we can use the correct types as expected by handleCellChange
                handleCellChange(rowIndex, header, newValue);
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
