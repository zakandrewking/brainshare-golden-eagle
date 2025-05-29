"use server";

import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { MODEL } from "./config";

const generatedColumnSchema = z.object({
  headerName: z
    .string()
    .describe("A concise, interesting, and unique header for the new column."),
  columnData: z
    .array(z.string())
    .describe(
      "An array of suggested values for the new column, one for each row in the original table."
    ),
});

const newColumnsResponseSchema = z.object({
  generatedColumns: z
    .array(generatedColumnSchema)
    .describe(
      "An array of generated columns, each with a header and its data."
    ),
});

const newColumnsModel = new ChatOpenAI({
  model: MODEL,
}).withStructuredOutput(newColumnsResponseSchema);

export type GeneratedColumn = z.infer<typeof generatedColumnSchema>;

/**
 * Generates multiple new columns with data based on existing table content.
 * @param tableData The current data of the table.
 * @param headers The current headers of the table.
 * @param numCols The number of new columns to generate.
 * @param documentTitle The title of the document.
 * @param documentDescription The description of the document.
 * @returns A promise that resolves to an object containing an array of generated columns or an error message.
 */
export default async function generateNewColumns(
  tableData: Record<string, unknown>[],
  headers: string[],
  numCols: number,
  documentTitle: string,
  documentDescription: string
): Promise<{
  generatedColumns?: GeneratedColumn[];
  error?: string;
}> {
  if (numCols <= 0) {
    return { error: "Number of columns to generate must be positive." };
  }

  const existingHeadersLower = headers.map((h) => h.toLowerCase());

  const systemPrompt = `You are an AI assistant specializing in data enrichment for tables.
The current document is titled "${documentTitle}" and described as: "${documentDescription}".
You will be given existing table data (array of JSON objects), its headers, and a specific number of new columns to generate.
For each of the ${numCols} new columns, your task is to invent a new, interesting, and relevant column header that does not already exist in the provided headers or among the other headers you are generating in this batch. The new column should be relevant to the document's title and description.
Then, for each row in the original table, generate a corresponding value for this new column based on the data in that row and the overall table context, keeping the document's theme in mind.
Return an array of ${numCols} generated columns, where each element in the array is an object containing the 'headerName' and its 'columnData' (an array of values, one for each row).
Ensure all generated headers are unique (case-insensitive) among themselves and with respect to existing headers.
The 'columnData' array for each generated column must have the same length as the input 'tableData'.`;

  const userPrompt = `Here is the existing table data:
${JSON.stringify(
    tableData,
    null,
    2
  )}\n\nExisting Headers: ${JSON.stringify(
    headers
  )}\n\nPlease generate ${numCols} new column(s) with their corresponding data.`;

  try {
    const response = await newColumnsModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    if (!response.generatedColumns || response.generatedColumns.length === 0) {
      return { error: "LLM did not return any generated columns." };
    }

    // Validate the returned columns
    const finalGeneratedColumns: GeneratedColumn[] = [];
    const allAttemptedHeadersLowerInThisBatch: string[] = [];

    for (const col of response.generatedColumns) {
      // Check for row count mismatch (only if tableData is not empty)
      if (tableData.length > 0 && col.columnData.length !== tableData.length) {
        return {
          error: `LLM returned column '${col.headerName}' with ${col.columnData.length} data rows, but expected ${tableData.length}.`,
        };
      }
      // Check for header uniqueness against existing headers AND headers generated in this same batch
      const currentHeaderLower = col.headerName.toLowerCase();
      if (
        existingHeadersLower.includes(currentHeaderLower) ||
        allAttemptedHeadersLowerInThisBatch.includes(currentHeaderLower)
      ) {
        // This indicates the LLM didn't follow instructions for uniqueness.
        // For a more robust solution, one might retry or ask the LLM to fix this specific column.
        // For now, we'll treat it as an error for the batch.
        return {
          error: `LLM generated a duplicate or conflicting header: '${col.headerName}'.`,
        };
      }
      finalGeneratedColumns.push(col);
      allAttemptedHeadersLowerInThisBatch.push(currentHeaderLower);
    }

    // If LLM returns more columns than requested, we can choose to truncate or use all.
    // Here, we'll truncate to the number requested to be strict.
    if (finalGeneratedColumns.length > numCols) {
      console.warn(
        `LLM returned ${finalGeneratedColumns.length} columns but ${numCols} were requested. Truncating.`
      );
      return { generatedColumns: finalGeneratedColumns.slice(0, numCols) };
    }

    return { generatedColumns: finalGeneratedColumns };
  } catch (error) {
    console.error("Error calling LLM for new columns generation:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate new columns: ${error.message}` };
    }
    return { error: "An unknown error occurred while generating new columns." };
  }
}
