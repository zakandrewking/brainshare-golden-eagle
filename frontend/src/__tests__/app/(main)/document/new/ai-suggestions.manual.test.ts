import {
  describe,
  expect,
  it,
} from "vitest";

import {
  generateTableInitialization,
} from "@/app/(main)/document/new/ai-suggestions";

// This test suite calls a live AI model and is meant for manual evaluation.
// It is skipped by default. To run it, use the following command:
// OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/app/\(main\)/document/new/ai-suggestions.test.ts
describe("generateTableInitialization AI Suggestions", () => {
  const testCases = [
    { title: "Animals", description: "A list of animals." },
    { title: "Countries", description: "Information about various nations." },
    { title: "Car Parts", description: "Inventory for an auto repair shop." },
    {
      title: "Book Inventory",
      description: "A collection of books in a library.",
    },
    {
      title: "Employee Directory",
      description: "Contact information for company employees.",
    },
    { title: "Recipe Book", description: "A collection of personal recipes." },
  ];

  it(
    "should generate relevant and human-friendly column names",
    {
      timeout: 60000, // Increase timeout for AI API calls
      skip: process.env.RUN_AI_TESTS !== "true",
    },
    async () => {
      console.log("--- Running AI Suggestion Evaluation ---");
      console.log("\nWhat to look for in good suggestions:");
      console.log("- Column names should be human-friendly and intuitive");
      console.log(
        "- Primary column should work as a good identifier (e.g., 'Common Name' for Animals)"
      );
      console.log(
        "- Secondary column should complement the primary (e.g., 'Scientific Name' for Animals)"
      );
      console.log(
        "- Sample data should be realistic and demonstrate expected content"
      );
      console.log(
        "- Avoid generic names like 'Column 1', 'Name', 'Title' when more specific options exist"
      );

      for (const { title, description } of testCases) {
        console.log(`\n--- Testing Title: "${title}" ---`);
        const result = await generateTableInitialization(title, description);

        console.log(result);

        expect(result).toBeDefined();
        expect(result.error).toBeUndefined();
        expect(result.primaryColumnName).toBeTypeOf("string");
        expect(result.secondaryColumnName).toBeTypeOf("string");
        expect(result.sampleRow).toBeDefined();
      }
      console.log("\n--- AI Suggestion Evaluation Complete ---");
    }
  );
});
