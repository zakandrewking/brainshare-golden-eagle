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
  selectedCellsData: string[][]
): Promise<{
  suggestions?: { rowIndex: number; colIndex: number; suggestion: string }[];
  error?: string;
}> {
  if (selectedCells.length === 0) {
    return { error: "No cells selected." };
  }

  const systemPrompt = `You are an AI assistant specializing in data enrichment. You will be given a table represented as an array of JSON objects, the table headers, and a set of selected cells with their current values. Your task is to provide concise and relevant suggestions for each of the selected cells, based on the overall table context and patterns in the data. Return the suggestions as a JSON object matching the provided schema.`;

  const userPrompt = `Here is the table data:
${JSON.stringify(tableData, null, 2)}

Table Headers: ${JSON.stringify(headers)}
Selected Cells: ${JSON.stringify(selectedCells)}
Selected Cells Data: ${JSON.stringify(selectedCellsData)}

Please provide suggestions for each of the selected cells. Generate improvements or enhancements based on the surrounding data and context.`;

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
