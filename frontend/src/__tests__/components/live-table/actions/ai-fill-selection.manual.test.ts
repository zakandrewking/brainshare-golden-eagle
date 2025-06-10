import {
  describe,
  expect,
  it,
} from "vitest";

import generateSelectedCellsSuggestions
  from "@/components/live-table/actions/generateSelectedCellsSuggestions";

// This test suite calls a live AI model and is meant for manual evaluation.
// It is skipped by default. To run it, use the following command:
// OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/components/live-table/actions/ai-fill-selection.manual.test.ts
describe("generateSelectedCellsSuggestions AI Fill Selection", () => {
  const testCases = [
    {
      title: "Animal Registry",
      description: "A comprehensive database of animal species",
      tableData: [
        {
          "Common Name": "Tiger",
          "Scientific Name": "Panthera tigris",
          Habitat: "",
          Diet: "",
        },
        {
          "Common Name": "Eagle",
          "Scientific Name": "Aquila chrysaetos",
          Habitat: "",
          Diet: "Carnivore",
        },
        {
          "Common Name": "Dolphin",
          "Scientific Name": "",
          Habitat: "Ocean",
          Diet: "",
        },
        {
          "Common Name": "Panda",
          "Scientific Name": "Ailuropoda melanoleuca",
          Habitat: "",
          Diet: "",
        },
      ],
      headers: ["Common Name", "Scientific Name", "Habitat", "Diet"],
      selectedCells: [
        { rowIndex: 0, colIndex: 2 }, // Tiger habitat
        { rowIndex: 0, colIndex: 3 }, // Tiger diet
        { rowIndex: 2, colIndex: 1 }, // Dolphin scientific name
        { rowIndex: 3, colIndex: 2 }, // Panda habitat
        { rowIndex: 3, colIndex: 3 }, // Panda diet
      ],
      selectedCellsData: [
        [""], // Tiger habitat
        [""], // Tiger diet
        [""], // Dolphin scientific name
        [""], // Panda habitat
        [""], // Panda diet
      ],
      expectedPatterns: [
        "Should suggest appropriate habitats (e.g., 'Forest', 'Tropical rainforest')",
        "Should suggest correct diets (e.g., 'Carnivore', 'Fish and squid', 'Bamboo')",
        "Should provide accurate scientific names",
      ],
    },
    {
      title: "Country Information",
      description: "Geographic and demographic data about world countries",
      tableData: [
        {
          Country: "Japan",
          Capital: "Tokyo",
          Population: "125 million",
          Currency: "",
        },
        {
          Country: "Brazil",
          Capital: "",
          Population: "215 million",
          Currency: "Real",
        },
        { Country: "Egypt", Capital: "Cairo", Population: "", Currency: "" },
        { Country: "Canada", Capital: "", Population: "", Currency: "Dollar" },
      ],
      headers: ["Country", "Capital", "Population", "Currency"],
      selectedCells: [
        { rowIndex: 0, colIndex: 3 }, // Japan currency
        { rowIndex: 1, colIndex: 1 }, // Brazil capital
        { rowIndex: 2, colIndex: 2 }, // Egypt population
        { rowIndex: 2, colIndex: 3 }, // Egypt currency
        { rowIndex: 3, colIndex: 1 }, // Canada capital
        { rowIndex: 3, colIndex: 2 }, // Canada population
      ],
      selectedCellsData: [
        [""], // Japan currency
        [""], // Brazil capital
        [""], // Egypt population
        [""], // Egypt currency
        [""], // Canada capital
        [""], // Canada population
      ],
      expectedPatterns: [
        "Should provide accurate currencies (e.g., 'Yen', 'Pound')",
        "Should suggest correct capitals (e.g., 'Brasília', 'Ottawa')",
        "Should provide realistic population estimates",
      ],
    },
    {
      title: "Recipe Collection",
      description: "Personal cooking recipes with ingredients and instructions",
      tableData: [
        {
          Recipe: "Chocolate Cake",
          "Main Ingredient": "Chocolate",
          "Prep Time": "",
          Difficulty: "",
        },
        {
          Recipe: "Caesar Salad",
          "Main Ingredient": "",
          "Prep Time": "15 minutes",
          Difficulty: "Easy",
        },
        {
          Recipe: "Beef Stir Fry",
          "Main Ingredient": "Beef",
          "Prep Time": "",
          Difficulty: "",
        },
        {
          Recipe: "Vegetable Soup",
          "Main Ingredient": "",
          "Prep Time": "",
          Difficulty: "",
        },
      ],
      headers: ["Recipe", "Main Ingredient", "Prep Time", "Difficulty"],
      selectedCells: [
        { rowIndex: 0, colIndex: 2 }, // Chocolate Cake prep time
        { rowIndex: 0, colIndex: 3 }, // Chocolate Cake difficulty
        { rowIndex: 1, colIndex: 1 }, // Caesar Salad main ingredient
        { rowIndex: 2, colIndex: 2 }, // Beef Stir Fry prep time
        { rowIndex: 2, colIndex: 3 }, // Beef Stir Fry difficulty
        { rowIndex: 3, colIndex: 1 }, // Vegetable Soup main ingredient
        { rowIndex: 3, colIndex: 2 }, // Vegetable Soup prep time
        { rowIndex: 3, colIndex: 3 }, // Vegetable Soup difficulty
      ],
      selectedCellsData: [
        [""], // Chocolate Cake prep time
        [""], // Chocolate Cake difficulty
        [""], // Caesar Salad main ingredient
        [""], // Beef Stir Fry prep time
        [""], // Beef Stir Fry difficulty
        [""], // Vegetable Soup main ingredient
        [""], // Vegetable Soup prep time
        [""], // Vegetable Soup difficulty
      ],
      expectedPatterns: [
        "Should suggest realistic prep times based on recipe complexity",
        "Should provide appropriate difficulty levels (Easy, Medium, Hard)",
        "Should identify logical main ingredients",
      ],
    },
    {
      title: "Employee Directory",
      description: "Company staff information and contact details",
      tableData: [
        {
          Name: "Alice Johnson",
          Department: "Engineering",
          Role: "",
          Email: "",
        },
        {
          Name: "Bob Smith",
          Department: "",
          Role: "Marketing Manager",
          Email: "bob@company.com",
        },
        { Name: "Carol Davis", Department: "HR", Role: "", Email: "" },
        {
          Name: "David Wilson",
          Department: "",
          Role: "",
          Email: "david.wilson@company.com",
        },
      ],
      headers: ["Name", "Department", "Role", "Email"],
      selectedCells: [
        { rowIndex: 0, colIndex: 2 }, // Alice role
        { rowIndex: 0, colIndex: 3 }, // Alice email
        { rowIndex: 1, colIndex: 1 }, // Bob department
        { rowIndex: 2, colIndex: 2 }, // Carol role
        { rowIndex: 2, colIndex: 3 }, // Carol email
        { rowIndex: 3, colIndex: 1 }, // David department
        { rowIndex: 3, colIndex: 2 }, // David role
      ],
      selectedCellsData: [
        [""], // Alice role
        [""], // Alice email
        [""], // Bob department
        [""], // Carol role
        [""], // Carol email
        [""], // David department
        [""], // David role
      ],
      expectedPatterns: [
        "Should suggest appropriate roles based on department",
        "Should generate consistent email formats",
        "Should infer departments based on roles where possible",
      ],
    },
  ];

  it(
    "should generate contextually relevant suggestions for selected cells",
    {
      timeout: 120000, // Increase timeout for AI API calls
      skip: process.env.RUN_AI_TESTS !== "true",
    },
    async () => {
      console.log("--- Running AI Fill Selection Evaluation ---");
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
        console.log("📋 Expected patterns:");
        testCase.expectedPatterns.forEach((pattern) =>
          console.log(`   • ${pattern}`)
        );

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
                displayValue = suggestions ? `[${value}]` : `[EMPTY→?]`;
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

        console.log("\n🎯 SELECTED CELLS (marked with []):");
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
          testCase.selectedCellsData,
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

      console.log("\n" + "🎉".repeat(50));
      console.log("🎉".repeat(50));
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
