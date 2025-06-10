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

  const systemPrompt = `You are an AI assistant specializing in data enrichment for tables.

Your task: You will be given a table represented as an array of JSON objects,
the table headers, and a set of selected cells with their current values. Your
task is to provide concise and relevant suggestions for each of the selected
cells, based on the overall table context, patterns in the data, and the
document's theme.

CRITICAL RULES:
1. ONLY return the core data value - no descriptions, explanations, or additional text
2. If existing data appears accurate, return the EXACT same value unchanged
3. Match the existing data format exactly (numbers as numbers, text as text)
4. Do not add parenthetical information, examples, or elaborations
5. Return only what should appear in the cell itself

The document is titled "${documentTitle}" and described as: "${documentDescription}".

EXAMPLES:
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

For each selected cell, provide ONLY the value that should appear in that cell:
- If the current value is accurate, return it unchanged
- If it needs correction, return only the corrected value
- If it's empty and needs data, return only the missing value
- NO descriptions, explanations, or additional context

Return suggestions that match the existing data format and style exactly.`;

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
