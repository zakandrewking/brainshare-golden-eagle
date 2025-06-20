import { useMemo, useState } from "react";

import { Wand2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  useDocumentDescription,
  useDocumentTitle,
  useHandleCellChange,
  useHeaders,
  useTableData,
} from "@/stores/dataStore";
import { useIsAiFillSelectionDebugEnabled } from "@/stores/debugSettingsStore";
import { useSelectedCells } from "@/stores/selectionStore";

import generateSelectedCellsSuggestions
  from "./actions/generateSelectedCellsSuggestions";
import { getSelectedCellsData } from "./data-utils";

function outputDebugTestCase(
  tableData: Record<string, unknown>[],
  headers: string[],
  selectedCells: { rowIndex: number; colIndex: number; value: string }[],
  documentTitle: string,
  documentDescription: string
) {
  const testCase = {
    title: documentTitle,
    description: documentDescription,
    tableData,
    headers,
    selectedCells,
  };

  console.log("\n" + "=".repeat(20));
  console.log("🔍 AI FILL SELECTION DEBUG - TEST CASE DATA");
  console.log("=".repeat(20));
  console.log("Copy the JSON below to add as a new test case:");
  console.log("=".repeat(20));
  console.log(JSON.stringify(testCase, null, 2));
  console.log("=".repeat(20));
  console.log("📝 Instructions:");
  console.log("1. Copy the JSON above");
  console.log(
    "2. Add it to the testCases array in src/__tests__/components/live-table/actions/ai-fill-selection-test-cases.json"
  );
  console.log(
    "3. Run the test with: OPENAI_API_KEY=your_key RUN_AI_TESTS=true npm test -- ai-fill-selection.manual.test.ts"
  );
  console.log("=".repeat(20) + "\n");
}

export function AiFillSelectionButton() {
  const [isLoading, setIsLoading] = useState(false);
  const documentTitle = useDocumentTitle();
  const documentDescription = useDocumentDescription();
  const tableData = useTableData();
  const headers = useHeaders();
  const handleCellChange = useHandleCellChange();
  const isDebugEnabled = useIsAiFillSelectionDebugEnabled();

  const selectedCells = useSelectedCells();

  const selectedCellsData = useMemo(() => {
    return getSelectedCellsData(tableData, headers, selectedCells);
  }, [tableData, headers, selectedCells]);

  const handleClick = async () => {
    if (!selectedCells || selectedCells.length === 0) return;

    setIsLoading(true);

    // Debug mode: output test case data to browser console
    if (isDebugEnabled) {
      outputDebugTestCase(
        tableData,
        headers,
        selectedCellsData,
        documentTitle,
        documentDescription
      );
    }

    toast.promise(
      async () => {
        try {
          // Ensure tableData and headers are not undefined
          const dataToUse = tableData || [];
          const headersToUse = headers || [];

          const result = await generateSelectedCellsSuggestions(
            dataToUse,
            headersToUse,
            selectedCellsData,
            documentTitle,
            documentDescription
          );

          if (result.error) {
            console.error(result.error);
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
        } finally {
          setIsLoading(false);
        }
      },
      {
        loading: "Generating suggestions for selected cells...",
        success: "Cells updated with AI suggestions",
        error: "Failed to generate suggestions",
      }
    );
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={!selectedCells || selectedCells.length === 0 || isLoading}
    >
      <Wand2 className="mr-2 h-4 w-4" />
      AI Fill Selection
    </Button>
  );
}
