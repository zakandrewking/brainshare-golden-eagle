"use server";

import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

const MODEL = "gpt-4.1";

const tableInitializationSchema = z.object({
  primaryColumnName: z
    .string()
    .describe(
      "A human-friendly, descriptive column name that would serve as a primary identifier for items in the table. For example, for a table about Animals, this might be 'Common Name'."
    ),
  secondaryColumnName: z
    .string()
    .describe(
      "A second column name that complements the primary column and is relevant to the document theme. For example, for a table about Animals, this might be 'Scientific Name'."
    ),
  sampleRow: z
    .object({
      primaryValue: z
        .string()
        .describe(
          "A sample value for the primary column that demonstrates what kind of data would go there"
        ),
      secondaryValue: z
        .string()
        .describe(
          "A sample value for the secondary column that complements the primary value"
        ),
    })
    .describe("A sample row of data to seed the table"),
});

const tableInitModel = new ChatOpenAI({
  model: MODEL,
}).withStructuredOutput(tableInitializationSchema);

export async function generateTableInitialization(
  documentTitle: string,
  documentDescription: string
): Promise<{
  primaryColumnName?: string;
  secondaryColumnName?: string;
  sampleRow?: {
    primaryValue: string;
    secondaryValue: string;
  };
  error?: string;
}> {
  if (!documentTitle || documentTitle.trim().length === 0) {
    return { error: "Document title is required for generating suggestions." };
  }

  const systemPrompt = `You are an AI assistant specializing in table design and data structure creation.
You will be given a document title and an optional description. Your task is to suggest two appropriate column names and one sample row of data for a new table.

The column names should be:
- Human-friendly and intuitive.
- Relevant to the document title and theme.
- Suitable as table headers for a general audience.
- The first column should be a good candidate for a primary identifier for items in the table.
- The second column should provide complementary information.

For example, if the document title is "Animals", good column names would be "Common Name" and "Scientific Name". A sample row could be "Lion" and "Panthera leo".

The sample data should be:
- Realistic and contextually appropriate.
- Demonstrate the expected data type and format.
- Help users understand what kind of information belongs in each column.`;

  const userPrompt = `Document Title: "${documentTitle}". Document Description: ${documentDescription}"

Please suggest appropriate column names and sample data for a table related to this document. The primary column should work well as a unique identifier, and the secondary column should provide complementary information that's relevant to the document's theme.`;

  try {
    const response = await tableInitModel.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    return {
      primaryColumnName: response.primaryColumnName,
      secondaryColumnName: response.secondaryColumnName,
      sampleRow: response.sampleRow,
    };
  } catch (error) {
    console.error("Error calling LLM for table initialization:", error);
    if (error instanceof Error) {
      return {
        error: `Failed to generate table suggestions: ${error.message}`,
      };
    }
    return {
      error: "An unknown error occurred while generating table suggestions.",
    };
  }
}
