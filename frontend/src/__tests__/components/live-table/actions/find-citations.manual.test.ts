import { existsSync, readFileSync } from "fs";
import JSON5 from "json5";
import { join } from "path";
import { describe, it } from "vitest";

import findCitations from "@/components/live-table/actions/find-citations";

interface TestCase {
  title: string;
  description: string;
  tableData: Record<string, unknown>[];
  headers: string[];
  selectedCells: { rowIndex: number; colIndex: number }[];
  selectedCellsData: string[][];
  expectedCitationTypes: string[];
  expectedCitedValues: { rowIndex: number; colIndex: number; value: string }[];
}

function loadTestCasesFromJSON(): TestCase[] {
  const testCasesPath = join(
    process.cwd(),
    "src/__tests__/components/live-table/actions/find-citations-test-cases.json5"
  );

  if (!existsSync(testCasesPath)) {
    console.log("ℹ️  No additional test cases file found at:", testCasesPath);
    return [];
  }

  try {
    const fileContent = readFileSync(testCasesPath, "utf-8");
    const loadedCases = JSON5.parse(fileContent);

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
// OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/components/live-table/actions/find-citations.manual.test.ts
describe("findCitations Manual Testing", () => {
  // Load test cases from JSON file
  const loadedTestCases = loadTestCasesFromJSON();

  const testCases = loadedTestCases;

  it(
    "should find authoritative citations for selected cells",
    {
      timeout: 180000, // Increase timeout for citation search API calls
      skip: process.env.RUN_AI_TESTS !== "true",
    },
    async () => {
      console.log("--- Running Citation Finder Evaluation ---");
      console.log(`📊 Total test cases: ${testCases.length}`);
      console.log("\nWhat to look for in good citation results:");
      console.log("- Citations should be from authoritative, credible sources");
      console.log(
        "- URLs should be from reputable domains (.edu, .gov, major news)"
      );
      console.log("- Snippets should be relevant to the selected data");
      console.log(
        "- Citations should help verify or provide context for the data"
      );
      console.log("- Should prioritize recent, accurate sources");
      console.log("- Domain names should indicate source credibility");

      for (const [index, testCase] of testCases.entries()) {
        // Add separator before each test case
        console.log("\n" + "🔍".repeat(20));
        console.log("🔍".repeat(20));

        console.log(
          `\n📋 Testing: "${testCase.title}" (${index + 1}/${testCases.length})`
        );
        console.log(`📝 Description: ${testCase.description}`);
        console.log(`🎯 Selected cells: ${testCase.selectedCells.length}`);
        console.log("🏛️ Expected citation types:");
        testCase.expectedCitationTypes.forEach((type) =>
          console.log(`   • ${type}`)
        );

        // Helper function to visualize the table
        const visualizeTable = (data: Record<string, unknown>[]) => {
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
              const value = String(row[header] || "");

              // Mark selected cells and calculate display width
              const displayValue = selectedCellsSet.has(cellKey)
                ? `[${value}]`
                : value || "(empty)";

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
              const value = String(row[header] || "");

              // Mark selected cells
              const displayValue = selectedCellsSet.has(cellKey)
                ? `[${value}]`
                : value || "(empty)";

              return displayValue.padEnd(columnWidths[colIndex]);
            });

            console.log(rowValues.join(" | "));
          });
          console.log("=".repeat(totalWidth));
        };

        console.log("\n📋 TABLE WITH SELECTED CELLS (marked with []):");
        visualizeTable(testCase.tableData);

        console.log("\n🎯 SELECTED CELLS DETAILS:");
        testCase.selectedCells.forEach((cell, index) => {
          const header = testCase.headers[cell.colIndex];
          const row = testCase.tableData[cell.rowIndex] as Record<
            string,
            unknown
          >;
          const currentValue = String(row[header] || "(empty)");
          console.log(
            `  ${index + 1}. Row ${
              cell.rowIndex + 1
            }, Column "${header}": "${currentValue}"`
          );
        });

        console.log("\n🔍 Searching for citations...");

        const result = await findCitations(
          testCase.selectedCells,
          testCase.tableData.map((row) =>
            testCase.headers.map((header) => String(row[header] || ""))
          ),
          testCase.headers,
          testCase.title,
          testCase.description,
          { debug: true }
        );

        // Validate expected cited values
        console.log("\n✅ VALIDATION: Expected Cited Values");
        if (
          testCase.expectedCitedValues &&
          testCase.expectedCitedValues.length > 0
        ) {
          const resultText = JSON.stringify(result).toLowerCase();
          const foundValues: {
            rowIndex: number;
            colIndex: number;
            value: string;
          }[] = [];
          const missingValues: {
            rowIndex: number;
            colIndex: number;
            value: string;
          }[] = [];

          testCase.expectedCitedValues.forEach((expectedCitedValue) => {
            const normalizedExpected = expectedCitedValue.value.toLowerCase();
            const isFound = resultText.includes(normalizedExpected);
            const header = testCase.headers[expectedCitedValue.colIndex];

            if (isFound) {
              foundValues.push(expectedCitedValue);
              console.log(
                `   ✅ Found: "${expectedCitedValue.value}" at Row ${
                  expectedCitedValue.rowIndex + 1
                }, Column "${header}"`
              );
            } else {
              missingValues.push(expectedCitedValue);
              console.log(
                `   ❌ Missing: "${expectedCitedValue.value}" at Row ${
                  expectedCitedValue.rowIndex + 1
                }, Column "${header}"`
              );
            }
          });
        } else {
          console.log(
            "   ℹ️  No expected cited values defined for this test case"
          );
        }
      }
    }
  );
});
