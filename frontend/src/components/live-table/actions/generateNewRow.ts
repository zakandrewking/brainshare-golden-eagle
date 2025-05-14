"use server";

import { ChatOpenAI } from "@langchain/openai";

import { MODEL } from "./config";

const newRowModel = new ChatOpenAI({
  model: MODEL,
});

export default async function generateNewRow(
  tableData: Record<string, unknown>[],
  headers: string[]
): Promise<{
  rowData?: Record<string, string>;
  error?: string;
}> {
  if (headers.length === 0) {
    return { error: "No headers available for row generation." };
  }

  const systemPrompt = `You are an AI assistant specializing in data enrichment for tables. You will be given existing table data (array of JSON objects) and its headers. Your task is to generate a new row with realistic and contextually appropriate values for each column. Return the new row data as a JSON object where keys are the column headers and values are the generated cell values. Make sure all values are strings.`;

  const userPrompt = `Here is the existing table data:
${JSON.stringify(tableData, null, 2)}

Table Headers: ${JSON.stringify(headers)}

Please generate a new row with values for each column header. Each value should be contextually appropriate based on the existing data. Return ONLY a valid JSON object with column headers as keys and values as strings, like this:
{
  "Header1": "value1",
  "Header2": "value2",
  ...
}`;

  try {
    const response = await newRowModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    // Extract the JSON from the response
    let jsonStr = response.content.toString();

    // Handle potential markdown code blocks
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.split("```json")[1].split("```")[0].trim();
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.split("```")[1].split("```")[0].trim();
    }

    // Parse the JSON
    try {
      const generatedRowData = JSON.parse(jsonStr) as Record<string, string>;

      // Validate that all headers are present in the response
      const missingHeaders = headers.filter(
        (header) => !(header in generatedRowData)
      );
      if (missingHeaders.length > 0) {
        console.warn(
          `LLM response missing values for headers: ${missingHeaders.join(
            ", "
          )}`
        );

        // Add empty values for any missing headers
        missingHeaders.forEach((header) => {
          generatedRowData[header] = "";
        });
      }

      return { rowData: generatedRowData };
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      return { error: "Failed to parse AI response" };
    }
  } catch (error) {
    console.error("Error calling LLM for new row generation:", error);
    if (error instanceof Error) {
      return { error: `Failed to generate new row: ${error.message}` };
    }
    return {
      error: "An unknown error occurred while generating new row data.",
    };
  }
}
