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
  numRowsToGenerate: number,
  documentTitle: string,
  documentDescription: string
): Promise<{
  newRows?: Record<string, string>[];
  error?: string;
}> {
  if (numRowsToGenerate <= 0) {
    return { newRows: [] };
  }
  if (headers.length === 0) {
    return { error: "Cannot generate rows without headers." };
  }

  const systemPrompt = `You are an AI assistant specializing in data generation and fact-checking for table population.
The current document is titled "${documentTitle}" and described as: "${documentDescription}".
You will be given existing table data (if any), the table headers, and a specific number of new rows to generate.
Your task is to generate factually accurate and contextually relevant data for these new rows, based on real-world knowledge and fitting the established pattern of the table.

CRITICAL ANALYSIS STEPS:
1. Examine the column headers carefully to understand what type of data is expected
2. Generate data that is factually accurate based on real-world knowledge
3. Ensure all values are consistent with the document theme and existing data patterns
4. Verify generated data makes sense in the context of other columns in the same row
5. Use your knowledge of the subject matter to provide accurate information

CRITICAL RULES:
1. Generate factually accurate data based on real-world knowledge
2. Match the existing data format exactly (numbers as numbers, text as text)
3. Ensure consistency with the document theme and existing patterns
4. Do not generate fictional or inaccurate information
5. For each new row, return an array of string values in the exact order of table headers

FACT-CHECKING EXAMPLES:
- For geographic data, use accurate real-world information
- For scientific data, ensure accuracy based on established knowledge
- For product information, use real specifications
- For historical data, verify against known facts

For each new row, return an array of string values. The order of these string values MUST correspond exactly to the order of the table headers provided.
Return all new rows as a JSON object matching the provided schema.`;

  const userPrompt = `Existing table data:
${JSON.stringify(tableData, null, 2)}

Table Headers (in order): ${JSON.stringify(headers)}
Document Title: ${documentTitle}
Document Description: ${documentDescription}

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
