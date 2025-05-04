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
  model: "gpt-4.1",
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

// Schema for the new column generation output
const newColumnSchema = z.object({
  newHeader: z
    .string()
    .describe("A concise, interesting, and unique header for a new column."),
  newColumnData: z
    .array(z.string())
    .describe(
      "An array of suggested values for the new column, one for each row in the original table."
    ),
});

// New model instance for generating a new column
const newColumnModel = new ChatOpenAI({
  model: "gpt-4.1",
}).withStructuredOutput(newColumnSchema);

export async function generateNewColumn(
  tableData: Record<string, unknown>[],
  headers: string[]
): Promise<{
  newHeader?: string;
  newColumnData?: string[];
  error?: string;
}> {
  const existingHeadersLower = headers.map((h) => h.toLowerCase());

  const systemPrompt = `You are an AI assistant specializing in data enrichment for tables. You will be given existing table data (array of JSON objects) and its headers. Your task is to invent a new, interesting, and relevant column header that does not already exist in the provided headers. Then, for each row in the original table, generate a corresponding value for this new column based on the data in that row and the overall table context. Return the new header and the array of generated cell values for the new column as a JSON object matching the provided schema. Ensure the generated header is not present in the existing headers (case-insensitive check).`;

  const userPrompt = `Here is the existing table data:\n${JSON.stringify(
    tableData,
    null,
    2
  )}\n\nExisting Headers: ${JSON.stringify(
    headers
  )}\n\nPlease suggest a new column header and generate the data for each row in this new column.`;

  try {
    // Add retries or checks to ensure the header is unique
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      const response = await newColumnModel.invoke([
        new SystemMessage(systemPrompt),
        new HumanMessage(userPrompt),
      ]);

      const generatedHeaderLower = response.newHeader.toLowerCase();
      if (!existingHeadersLower.includes(generatedHeaderLower)) {
        // Basic validation: ensure we got data for the expected number of rows
        if (response.newColumnData.length !== tableData.length) {
          console.warn(
            "LLM returned data for a different number of rows than expected for the new column."
          );
          // Handle mismatch - maybe return error or try to pad/truncate? For now, return error.
          return {
            error: "LLM returned incorrect number of rows for the new column.",
          };
        }
        return {
          newHeader: response.newHeader,
          newColumnData: response.newColumnData,
        };
      }
      attempts++;
      console.warn(
        `Attempt ${attempts}: Generated header '${response.newHeader}' already exists. Retrying...`
      );
      // Optionally, add the rejected header to the prompt for the next attempt
    }
    return {
      error: `Failed to generate a unique column header after ${maxAttempts} attempts.`,
    };
  } catch (error) {
    console.error("Error calling LLM for new column generation:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate new column: ${error.message}` };
    }
    return { error: "An unknown error occurred while generating new column." };
  }
}
