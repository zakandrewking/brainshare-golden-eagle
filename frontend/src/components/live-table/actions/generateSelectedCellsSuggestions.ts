"use server";

import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { MODEL } from "./config";

const selectedCellSuggestionSchema = z.object({
  rowIndex: z.number().describe("The row index of this cell"),
  colIndex: z.number().describe("The column index of this cell"),
  suggestion: z.string().describe("The suggested value for this cell"),
});

const selectedCellsSuggestionsSchema = z.object({
  suggestions: z
    .array(selectedCellSuggestionSchema)
    .describe("An array of suggestions, one for each selected cell"),
});

const selectedCellsModel = new ChatOpenAI({
  model: MODEL,
}).withStructuredOutput(selectedCellsSuggestionsSchema);

export default async function generateSelectedCellsSuggestions(
  tableData: Record<string, unknown>[],
  headers: string[],
  selectedCells: { rowIndex: number; colIndex: number }[],
  selectedCellsData: string[][],
  documentTitle: string,
  documentDescription: string
): Promise<{
  suggestions?: { rowIndex: number; colIndex: number; suggestion: string }[];
  error?: string;
}> {
  if (selectedCells.length === 0) {
    return { error: "No cells selected." };
  }

  const systemPrompt = `You are an AI assistant specializing in data enrichment and fact-checking for tables.

Your task: You will be given a table represented as an array of JSON objects,
the table headers, and a set of selected cells with their current values. Your
task is to provide accurate, fact-checked suggestions for each of the selected
cells, based on real-world knowledge and data accuracy.

CRITICAL ANALYSIS STEPS:
1. Examine the column header carefully to understand what type of data is expected
2. Fact-check the current values against real-world knowledge for the specific entities
3. Verify data accuracy using your knowledge of the subject matter
4. If data is factually incorrect or inconsistent with real-world facts, provide the correct value
5. Consider the context provided by other columns in the same row

CRITICAL RULES:
1. ONLY return the core data value - no descriptions, explanations, or additional text
2. Fact-check values against real-world specifications and correct if wrong
3. Match the existing data format exactly (numbers as numbers, text as text)
4. Do not add parenthetical information, examples, or elaborations
5. Return only what should appear in the cell itself
6. If the current value is accurate, return it unchanged

The document is titled "${documentTitle}" and described as: "${documentDescription}".

FACT-CHECKING EXAMPLES:
- For geographic data, verify against authoritative sources
- For scientific data, ensure accuracy based on established knowledge
- For product information, check against official specifications

FORMAT EXAMPLES:
Good: "2" (just the number)
Bad: "2 (Phobos, Deimos)" (added description)
Good: "Tokyo" (just the city)
Bad: "Tokyo (capital of Japan)" (added description)
`;

  const userPrompt = `Table Data:
${JSON.stringify(tableData, null, 2)}

Headers: ${JSON.stringify(headers)}
Selected Cells: ${JSON.stringify(selectedCells)}
Current Values: ${JSON.stringify(selectedCellsData)}

ANALYSIS REQUIRED:
For each selected cell, carefully analyze:
1. What type of data does the column header expect?
2. Are the current values factually accurate for the specific entities?
3. Do the values make sense in the context of the other columns in the same row?
4. Do any values need corrections based on real-world knowledge?

RESPONSE INSTRUCTIONS:
For each selected cell, provide ONLY the correct value that should appear in that cell:
- If the current value is factually accurate, return it unchanged
- If it's factually incorrect, return the correct value based on real-world knowledge
- If it's empty and needs data, return the appropriate value
- NO descriptions, explanations, or additional context - just the raw value

Return suggestions that match the existing data format (numbers as numbers, text as text) and are factually accurate.`;

  try {
    const response = await selectedCellsModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    if (response.suggestions.length !== selectedCells.length) {
      console.warn(
        "LLM returned suggestions for a different number of cells than expected."
      );
    }

    return { suggestions: response.suggestions };
  } catch (error) {
    console.error("Error calling LLM for selected cells suggestions:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate suggestions: ${error.message}` };
    }
    return { error: "An unknown error occurred while generating suggestions." };
  }
}
