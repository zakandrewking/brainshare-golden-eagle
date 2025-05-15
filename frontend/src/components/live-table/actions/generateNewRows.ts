"use server";

import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { MODEL } from "./config";

// Schema for a single generated row: an array of strings representing cell values.
const generatedRowSchema = z
  .array(z.string())
  .describe(
    "An array of cell values for a new row, in the same order as the provided headers."
  );

// Schema for the overall response from the LLM.
const newRowsSchema = z.object({
  newRows: z
    .array(generatedRowSchema)
    .describe(
      "An array of new rows. Each inner array contains cell values ordered by the headers."
    ),
});

const newRowsModel = new ChatOpenAI({
  model: MODEL,
}).withStructuredOutput(newRowsSchema);

export default async function generateNewRows(
  tableData: Record<string, unknown>[],
  headers: string[],
  numRowsToGenerate: number
): Promise<{
  newRows?: Record<string, string>[]; // Output remains Record<string, string>[]
  error?: string;
}> {
  if (numRowsToGenerate <= 0) {
    return { newRows: [] };
  }
  if (headers.length === 0) {
    return { error: "Cannot generate rows without headers." };
  }

  const systemPrompt = `You are an AI assistant specializing in data generation and table population. You will be given existing table data (if any), the table headers, and a specific number of new rows to generate. Your task is to generate realistic and contextually relevant data for these new rows, fitting the established pattern of the table. For each new row, return an array of string values. The order of these string values MUST correspond exactly to the order of the table headers provided. Return all new rows as a JSON object matching the provided schema.`;

  const userPrompt = `Existing table data:
${JSON.stringify(tableData, null, 2)}

Table Headers (in order): ${JSON.stringify(headers)}

Please generate ${numRowsToGenerate} new row(s). For each row, provide an array of cell values. The order of values in each array must strictly match the order of the Table Headers listed above.
`;

  try {
    const llmResponse = await newRowsModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    if (llmResponse.newRows.length !== numRowsToGenerate) {
      console.warn(
        `LLM was asked to generate ${numRowsToGenerate} rows but returned ${llmResponse.newRows.length} rows. Using the returned rows.`
      );
    }

    // Map string[][] from LLM to Record<string, string>[]
    const mappedNewRows: Record<string, string>[] = llmResponse.newRows.map(
      (rowArray) => {
        const rowObject: Record<string, string> = {};
        headers.forEach((header, index) => {
          rowObject[header] = rowArray[index] ?? ""; // Ensure value exists, default to empty string
        });
        return rowObject;
      }
    );

    return { newRows: mappedNewRows };
  } catch (error) {
    console.error("Error calling LLM for generating new rows:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate new rows: ${error.message}` };
    }
    return { error: "An unknown error occurred while generating new rows." };
  }
}
