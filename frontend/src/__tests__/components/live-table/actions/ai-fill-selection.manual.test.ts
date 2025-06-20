import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  describe,
  expect,
  it,
} from "vitest";

import generateSelectedCellsSuggestions
  from "@/components/live-table/actions/generateSelectedCellsSuggestions";

interface TestCase {
  title: string;
  description: string;
  tableData: Record<string, unknown>[];
  headers: string[];
  selectedCells: { rowIndex: number; colIndex: number; value: string }[];
}

function loadTestCasesFromJSON(): TestCase[] {
  const testCasesPath = join(
    process.cwd(),
    "src/__tests__/components/live-table/actions/ai-fill-selection-test-cases.json"
  );

  if (!existsSync(testCasesPath)) {
    console.log("ℹ️  No additional test cases file found at:", testCasesPath);
    return [];
  }

  try {
    const fileContent = readFileSync(testCasesPath, "utf-8");
    const loadedCases = JSON.parse(fileContent);

    if (!Array.isArray(loadedCases)) {
      console.warn("⚠️  Test cases file should contain an array of test cases");
      return [];
    }

    console.log(
      `✅ Loaded ${loadedCases.length} additional test cases from JSON file`
    );
    return loadedCases;
  } catch (error) {
    console.warn("⚠️  Failed to load test cases from JSON file:", error);
    return [];
  }
}

// This test suite calls a live AI model and is meant for manual evaluation.
// It is skipped by default. To run it, use the following command:
// OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/components/live-table/actions/ai-fill-selection.manual.test.ts
describe("generateSelectedCellsSuggestions AI Fill Selection", () => {
  // Load test cases from JSON file (if exists) and combine with hardcoded ones
  const hardcodedTestCases: TestCase[] = [
    {
      title: "Planet Data",
      description: "Solar system planets with astronomical information",
      tableData: [
        {
          "Planet Name": "Mars",
          "Order from the Sun": "4",
          "Number of Moons": "2",
        },
        {
          "Planet Name": "Jupiter",
          "Order from the Sun": "5",
          "Number of Moons": "79",
        },
        {
          "Planet Name": "Saturn",
          "Order from the Sun": "6",
          "Number of Moons": "83",
        },
      ],
      headers: ["Planet Name", "Order from the Sun", "Number of Moons"],
      selectedCells: [
        { rowIndex: 0, colIndex: 2, value: "2" },
        { rowIndex: 1, colIndex: 2, value: "79" },
        { rowIndex: 2, colIndex: 2, value: "83" },
      ],
    },
  ];

  const loadedTestCases = loadTestCasesFromJSON();
  const testCases = [...hardcodedTestCases, ...loadedTestCases];

  it(
    "should generate contextually relevant suggestions for selected cells",
    {
      timeout: 120000, // Increase timeout for AI API calls
      skip: process.env.RUN_AI_TESTS !== "true",
    },
    async () => {
      console.log("--- Running AI Fill Selection Evaluation ---");
      console.log(
        `📊 Total test cases: ${testCases.length} (${hardcodedTestCases.length} hardcoded + ${loadedTestCases.length} from JSON)`
      );
      console.log("\nWhat to look for in good AI Fill Selection suggestions:");
      console.log(
        "- Suggestions should be contextually relevant to the document theme"
      );
      console.log("- Should maintain consistency with existing data patterns");
      console.log("- Should provide accurate and realistic values");
      console.log(
        "- Should respect the data type and format of existing cells"
      );
      console.log("- Should consider relationships between columns");
      console.log("- Should return suggestions for all selected cells");

      for (const [index, testCase] of testCases.entries()) {
        // Add separator before each test case
        console.log("\n" + "🔹".repeat(50));
        console.log("🔹".repeat(50));

        console.log(
          `\n🧪 Testing: "${testCase.title}" (${index + 1}/${testCases.length})`
        );
        console.log(`📝 Description: ${testCase.description}`);
        console.log(`🎯 Selected cells: ${testCase.selectedCells.length}`);

        // Helper function to visualize the table
        const visualizeTable = (
          data: Record<string, unknown>[],
          suggestions?: {
            rowIndex: number;
            colIndex: number;
            suggestion: string;
          }[]
        ) => {
          const selectedCellsSet = new Set(
            testCase.selectedCells.map(
              (cell) => `${cell.rowIndex}-${cell.colIndex}`
            )
          );

          // Calculate column widths for padding
          const columnWidths = testCase.headers.map((header, colIndex) => {
            let maxWidth = header.length;

            // Check all data rows
            data.forEach((row, rowIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;
              let value = String(row[header] || "");

              // If this cell was selected and we have suggestions, show the suggestion
              if (suggestions) {
                const suggestion = suggestions.find(
                  (s) => s.rowIndex === rowIndex && s.colIndex === colIndex
                );
                if (suggestion) {
                  value = suggestion.suggestion;
                }
              }

              // Mark selected cells and calculate display width
              let displayValue;
              if (selectedCellsSet.has(cellKey)) {
                displayValue = suggestions ? `[${value}]` : `[EMPTY→?]`;
              } else {
                displayValue = value || "(empty)";
              }

              maxWidth = Math.max(maxWidth, displayValue.length);
            });

            // Add some padding and ensure minimum width
            return Math.max(maxWidth + 2, 12);
          });

          const totalWidth =
            columnWidths.reduce((sum, width) => sum + width, 0) +
            (columnWidths.length - 1) * 3; // 3 for " | "

          console.log("\n" + "=".repeat(totalWidth));

          // Print headers with padding
          const paddedHeaders = testCase.headers.map((header, index) =>
            header.padEnd(columnWidths[index])
          );
          console.log(paddedHeaders.join(" | "));
          console.log("-".repeat(totalWidth));

          // Print data rows with padding
          data.forEach((row, rowIndex) => {
            const rowValues = testCase.headers.map((header, colIndex) => {
              const cellKey = `${rowIndex}-${colIndex}`;
              let value = String(row[header] || "");

              // If this cell was selected and we have suggestions, show the suggestion
              if (suggestions) {
                const suggestion = suggestions.find(
                  (s) => s.rowIndex === rowIndex && s.colIndex === colIndex
                );
                if (suggestion) {
                  value = suggestion.suggestion;
                }
              }

              // Mark selected cells
              let displayValue;
              if (selectedCellsSet.has(cellKey)) {
                displayValue = `[${value || "(empty)"}]`;
              } else {
                displayValue = value || "(empty)";
              }

              return displayValue.padEnd(columnWidths[colIndex]);
            });

            console.log(rowValues.join(" | "));
          });
          console.log("=".repeat(totalWidth));
        };

        console.log("\n📋 ORIGINAL TABLE:");
        visualizeTable(testCase.tableData);

        console.log("\n🎯 SELECTED CELLS (marked with [] in table):");
        testCase.selectedCells.forEach((cell, index) => {
          const header = testCase.headers[cell.colIndex];
          const row = testCase.tableData[cell.rowIndex] as Record<
            string,
            unknown
          >;
          const currentValue = String(row[header] || "(empty)");
          console.log(
            `  ${index + 1}. Row ${
              cell.rowIndex
            }, Column "${header}": "${currentValue}"`
          );
        });

        const result = await generateSelectedCellsSuggestions(
          testCase.tableData,
          testCase.headers,
          testCase.selectedCells,
          testCase.title,
          testCase.description
        );

        console.log("\n🤖 AI SUGGESTIONS:");
        if (result.suggestions) {
          result.suggestions.forEach((suggestion, index) => {
            const header = testCase.headers[suggestion.colIndex];
            console.log(
              `  ${index + 1}. Row ${
                suggestion.rowIndex
              }, Column "${header}": "${suggestion.suggestion}"`
            );
          });
        } else {
          console.log("  No suggestions returned");
        }

        console.log("\n✨ TABLE WITH AI SUGGESTIONS APPLIED:");
        if (result.suggestions) {
          visualizeTable(testCase.tableData, result.suggestions);
        }

        // Basic validation
        expect(result).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.suggestions).toBeDefined();
        expect(result.suggestions).toHaveLength(testCase.selectedCells.length);

        // Validate each suggestion has required properties
        result.suggestions?.forEach((suggestion, index) => {
          expect(suggestion.rowIndex).toBeTypeOf("number");
          expect(suggestion.colIndex).toBeTypeOf("number");
          expect(suggestion.suggestion).toBeTypeOf("string");
          expect(suggestion.suggestion.length).toBeGreaterThan(0);

          // Verify the suggestion is for one of the selected cells
          const matchingCell = testCase.selectedCells[index];
          expect(suggestion.rowIndex).toBe(matchingCell.rowIndex);
          expect(suggestion.colIndex).toBe(matchingCell.colIndex);
        });

        console.log("✓ Basic validation passed");
      }

      console.log("\n" + "🎉".repeat(20));
      console.log("🎉".repeat(20));
      console.log("\n🏁 AI Fill Selection Evaluation Complete! 🏁");
      console.log("\nManual Review Points:");
      console.log("- Check if suggestions are factually accurate");
      console.log("- Verify suggestions match the expected data type");
      console.log("- Ensure suggestions are contextually appropriate");
      console.log("- Look for consistency in formatting and style");
      console.log(
        "- Check if the AI understands relationships between columns"
      );
    }
  );
});
