"use server";

import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

// Define the expected structure for a single row suggestion
const suggestionSchema = z.object({
  index: z.number().describe("The original row index"),
  suggestion: z
    .string()
    .describe("The suggested value for the cell in this row"),
});

// Define the schema for the array of suggestions
const suggestionsSchema = z.object({
  suggestions: z
    .array(suggestionSchema)
    .describe(
      "An array of suggestions, one for each non-header row in the target column"
    ),
});

const model = new ChatOpenAI({
  model: "gpt-4-turbo",
  temperature: 0.7,
}).withStructuredOutput(suggestionsSchema);

export async function generateColumnSuggestions(
  tableData: Record<string, unknown>[],
  headers: string[],
  targetColumnIndex: number
): Promise<{
  suggestions?: z.infer<typeof suggestionsSchema>["suggestions"];
  error?: string;
}> {
  if (targetColumnIndex < 0 || targetColumnIndex >= headers.length) {
    return { error: "Invalid target column index." };
  }

  const targetHeader = headers[targetColumnIndex];
  if (!targetHeader) {
    return { error: "Target header not found." };
  }

  // Prepare data for the prompt, including only the relevant column's current values
  // const columnData = tableData.map((row, index) => ({
  //   index,
  //   value: row[targetHeader] ?? "", // Send current value for context
  // }));

  const systemPrompt = `You are an AI assistant specializing in data enrichment. You will be given a table represented as an array of JSON objects, the table headers, and a target column header. Your task is to provide a concise and relevant suggestion for the value of each cell in the target column, based on the other data in its row and the overall table context. Consider the existing value in the target cell, if any. Return the suggestions as a JSON object matching the provided schema.`;

  const userPrompt = `Here is the table data:
${JSON.stringify(tableData, null, 2)}

Table Headers: ${JSON.stringify(headers)}
Target Column Header: "${targetHeader}"

Please provide suggestions for each row in the "${targetHeader}" column.`;

  try {
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // Basic validation: ensure we got suggestions for the expected number of rows
    if (response.suggestions.length !== tableData.length) {
      console.warn(
        "LLM returned suggestions for a different number of rows than expected."
      );
      // Attempt to match by index if possible, otherwise might need more robust handling
    }

    return { suggestions: response.suggestions };
  } catch (error) {
    console.error("Error calling LLM for column suggestions:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate suggestions: ${error.message}` };
    }
    return { error: "An unknown error occurred while generating suggestions." };
  }
}
