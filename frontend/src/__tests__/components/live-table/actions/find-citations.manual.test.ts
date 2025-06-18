import { existsSync, readFileSync } from "fs";
import JSON5 from "json5";
import { join } from "path";
import {
  describe,
  expect,
  it,
} from "vitest";

import findCitations from "@/components/live-table/actions/find-citations";

interface TestCase {
  title: string;
  description: string;
  tableData: Record<string, unknown>[];
  headers: string[];
  selectedCells: { rowIndex: number; colIndex: number }[];
  selectedCellsData: string[][];
  expectedCitationTypes: string[];
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
          testCase.description
        );

        console.log("\n📚 CITATION RESULTS:");
        if (result.error) {
          console.log(`❌ Error: ${result.error}`);
        } else if (result.citations && result.citations.length > 0) {
          console.log(`✅ Found ${result.citations.length} citations:`);

          result.citations.forEach((citation, index) => {
            console.log(`\n📖 Citation ${index + 1}:`);
            console.log(`   📋 Title: ${citation.title}`);
            console.log(`   🌐 URL: ${citation.url}`);
            console.log(`   🏠 Domain: ${citation.domain}`);
            console.log(`   ⭐ Relevance: ${citation.relevanceScore || "N/A"}`);
            console.log(`   📄 Snippet: "${citation.snippet}"`);

            // Evaluate domain credibility
            const domain = citation.domain.toLowerCase();
            let credibilityNote = "";
            if (domain.includes(".gov")) {
              credibilityNote = "🏛️ Government source";
            } else if (domain.includes(".edu")) {
              credibilityNote = "🎓 Academic institution";
            } else if (domain.includes("wikipedia")) {
              credibilityNote = "📖 Wikipedia (verify with primary sources)";
            } else if (
              ["reuters.com", "bloomberg.com", "wsj.com", "ft.com"].some(
                (site) => domain.includes(site)
              )
            ) {
              credibilityNote = "📰 Reputable financial news";
            } else if (
              ["cnn.com", "bbc.com", "nytimes.com"].some((site) =>
                domain.includes(site)
              )
            ) {
              credibilityNote = "📰 Major news outlet";
            } else {
              credibilityNote = "❓ Verify source credibility";
            }
            console.log(`   🏆 Source Type: ${credibilityNote}`);
          });

          if (result.searchContext) {
            console.log(`\n🔍 Search Context Used: "${result.searchContext}"`);
          }
        } else {
          console.log("❌ No citations found");
        }

        // Basic validation
        expect(result).toBeDefined();

        if (result.error) {
          console.log(`⚠️ Test completed with error: ${result.error}`);
        } else {
          expect(result.citations).toBeDefined();
          expect(Array.isArray(result.citations)).toBe(true);

          // Validate each citation has required properties
          result.citations?.forEach((citation) => {
            expect(citation.id).toBeTypeOf("string");
            expect(citation.title).toBeTypeOf("string");
            expect(citation.url).toBeTypeOf("string");
            expect(citation.snippet).toBeTypeOf("string");
            expect(citation.domain).toBeTypeOf("string");
            expect(citation.url).toMatch(/^https?:\/\//); // Valid URL format
          });

          console.log("✓ Basic validation passed");
        }
      }

      console.log("\n" + "🎉".repeat(20));
      console.log("🎉".repeat(20));
      console.log("\n🏁 Citation Finder Evaluation Complete! 🏁");
      console.log("\nManual Review Points:");
      console.log("- Verify citations are from authoritative sources");
      console.log("- Check if snippets directly relate to the selected data");
      console.log("- Ensure URLs are accessible and lead to relevant content");
      console.log(
        "- Look for appropriate mix of source types (gov, edu, news)"
      );
      console.log("- Assess whether citations would help fact-check the data");
      console.log("- Check for recent vs. historical sources as appropriate");
    }
  );
});
