"use server";

import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { GoogleGenAI } from "@google/genai";

import { geminiModel } from "@/llm-config";

// TypeScript interfaces for citation data
export interface Citation {
  rowIndex: number;
  colIndex: number;
  header: string;
  url: string;
  title: string;
  snippet: string;
  citedValue: string;
}

// Zod schema for structured web search output
const webSearchSchema = z.object({
  textSummary: z
    .string()
    .describe(
      "A comprehensive summary of the research findings that supports or provides context for the selected data points"
    ),
  citations: z.array(
    z.object({
      rowIndex: z
        .number()
        .describe("The row index of the cell that this citation supports"),
      columnIndex: z
        .number()
        .describe("The column index of the cell that this citation supports"),
      header: z
        .string()
        .describe(
          "The header name of the column that this citation supports (must match the header from COMPLETE TABLE DATA)"
        ),
      citationUrl: z.string().describe("The URL of the citation source"),
      citationTitle: z.string().describe("The title of the source"),
      citationSnippet: z
        .string()
        .describe(
          "A relevant excerpt from the source that supports the citedValue"
        ),
      citedValue: z.string().describe(
        `The specific value or data point mentioned in this source that
             relates to the data categories. If no specific value is mentioned,
             leave empty. ONLY return the core data value - no descriptions,
             explanations, or additional text`
      ),
    })
  ).describe(`A list of authoritative citation sources with their details.
        Cells can be included multiple times if they are supported by multiple
        citations.`),
});

// Type for the structured response from Gemini
type WebSearchResponse = z.infer<typeof webSearchSchema>;

// Rate limiting configuration
const RATE_LIMIT_DELAY = 1000; // 1 second between calls
let lastCallTime = 0;

const rateLimitDelay = async (): Promise<void> => {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;

  if (timeSinceLastCall < RATE_LIMIT_DELAY) {
    const delay = RATE_LIMIT_DELAY - timeSinceLastCall;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  lastCallTime = Date.now();
};

export default async function findCitations(
  tableData: Record<string, unknown>[],
  headers: string[],
  selectedCells: { rowIndex: number; colIndex: number; value: string }[],
  documentTitle: string,
  documentDescription: string,
  options?: {
    debug?: boolean;
  }
): Promise<{
  citations?: Citation[];
  searchContext?: string;
  error?: string;
}> {
  const debug = options?.debug ?? false;

  // Validate inputs
  if (!selectedCells || selectedCells.length === 0) {
    return { error: "No cells selected for citation search." };
  }

  if (!tableData || tableData.length === 0) {
    return { error: "No cell data provided for citation search." };
  }

  if (!headers || headers.length === 0) {
    return { error: "No headers provided for context." };
  }

  // Apply rate limiting
  try {
    await rateLimitDelay();
  } catch (error) {
    if (debug) console.error("Rate limiting error:", error);
    return { error: "Rate limiting failed. Please try again." };
  }

  // Create system prompt for citation finding with structured output
  const systemPrompt = `
You are an expert research assistant with web search capabilities
specializing in finding high-quality, authoritative citations for data
verification and fact-checking.
`;

  const userPrompt = `Find authoritative citations related to the following research topic and data:

=== RESEARCH CONTEXT ===
Document: "${documentTitle}"
Description: ${documentDescription}

=== COMPLETE TABLE DATA (Selected Values Hidden) ===
Headers: ${headers.join(" | ")}

${tableData
  .map((row, rowIndex) => {
    return Object.entries(row)
      .map(([colIndex, cell]) => {
        const colIndexNumber = parseInt(colIndex);
        // Check if this cell is in the selected cells
        const isSelected = selectedCells.some(
          (selectedCell) =>
            selectedCell.rowIndex === rowIndex &&
            selectedCell.colIndex === colIndexNumber
        );

        const value = isSelected ? "[HIDDEN VALUE]" : String(cell);
        const headerName =
          headers[colIndexNumber] || `Col${colIndexNumber + 1}`;

        return `rowIndex: ${rowIndex} columnIndex: ${colIndexNumber} header: "${headerName}" value: "${value}"`;
      })
      .join("\n");
  })
  .join("\n")}

=== SELECTED CELLS (Values Hidden) ===
The user has selected ${selectedCells.length} specific data points for citation:

${selectedCells
  .map((cell) => {
    const colIndexNumber = cell.colIndex;
    const rowIndex = cell.rowIndex;
    const headerName = headers[colIndexNumber] || `Col${colIndexNumber + 1}`;
    return `rowIndex: ${rowIndex} columnIndex: ${colIndexNumber} header: "${headerName}" value: "[HIDDEN VALUE]"`;
  })
  .join("\n")}

=== RESEARCH TASK ===
Your task is to search the web and find credible sources that support,
verify, or provide context for the selected data from a table.

SEARCH CRITERIA:
1. Prioritize academic papers, government sources, reputable news outlets, and official organizations
2. Look for sources that directly relate to the specific data points selected
3. Focus on recent, authoritative sources when possible
4. Avoid unreliable sources, opinion pieces without data backing, or potentially biased sources

CITATION QUALITY REQUIREMENTS:
- Each citation should include a specific, relevant excerpt (snippet) that relates to the data
- Citations should be from trustworthy domains (.edu, .gov, reputable news, academic journals)
- Provide context about why each source is relevant to the selected data
- Ensure citations are factual and support the data claims
- Extract specific values or data points from the source when available (for comparison with hidden values)

RELEVANCE REQUIREMENTS:
- Find citations that contain information, data, or context relevant to the selected data categories
- Citations should be topically relevant even if they don't contain the exact same data values
- Focus on authoritative sources that provide insights about the same domain or subject matter
- Quality and authenticity of sources is more important than exact data matching

Document Context: "${documentTitle}" - ${documentDescription}

You must return your response in the following JSON format wrapped in \`\`\`json and \`\`\` tags:

{
  "textSummary": \`A comprehensive summary of your research findings that
      supports or provides context for the selected data points\`,
  "citations": [
    {
      "rowIndex": 0,
      "columnIndex": 1,
      "header": "Industry",
      "citationUrl": "https://example.com/source1",
      "citationTitle": "Title of the source",
      "citationSnippet": "Relevant excerpt from the source that supports the citedValue",
      "citedValue": \`The specific value or data point mentioned in this source that
        relates to the data categories. If no specific value is mentioned,
        leave empty. ONLY return the core data value - no descriptions,
        explanations, or additional text\`
    }
  ]
}

IMPORTANT:
- Only provide citations for the selected cells.
- Cells can be included multiple times if they are supported by multiple citations.
`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  try {
    // Create Gemini client
    const ai = new GoogleGenAI({ apiKey });

    if (debug) {
      console.log("--------------------------------");
      console.log("systemPrompt:", systemPrompt);
      console.log("--------------------------------");
      console.log("userPrompt:", userPrompt);
      console.log("--------------------------------");
    }

    // Define the grounding tool for web search
    const groundingTool = {
      googleSearch: {},
    };

    // Convert Zod schema to JSON Schema for Gemini
    const responseSchema = zodToJsonSchema(webSearchSchema, {
      name: "webSearchResult",
      $refStrategy: "none", // Inline definitions instead of using $ref
    });

    // Configure generation settings with thinking, web search, and structured output
    const config = {
      tools: [groundingTool],
      thinkingConfig: {
        // Turn on dynamic thinking:
        thinkingBudget: -1,
      },
      // responseMimeType: "application/json" as const,
      responseJsonSchema: responseSchema,
    };

    // Combine system and user prompts for Gemini
    const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

    // Make the API call with structured output
    const response = await ai.models.generateContent({
      model: geminiModel,
      contents: combinedPrompt,
      config,
    });

    if (debug) {
      console.log("--------------------------------");
      if (response.usageMetadata?.thoughtsTokenCount) {
        console.log(
          `Thoughts tokens: ${response.usageMetadata.thoughtsTokenCount}`
        );
      }
      if (response.usageMetadata?.candidatesTokenCount) {
        console.log(
          `Output tokens: ${response.usageMetadata.candidatesTokenCount}`
        );
      }
      console.log("--------------------------------");
    }

    // Parse the structured output directly
    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response text received from API");
    }

    const strippedResponse = responseText
      .replace(/^```json/, "")
      .replace(/```\n*$/, "");

    const structuredOutput: WebSearchResponse = JSON.parse(strippedResponse);

    // Handle null response
    if (!structuredOutput) {
      return {
        error: "Failed to parse structured response from API.",
      };
    }

    if (debug) {
      console.log("--------------------------------");
      console.log("response.structuredOutput:", structuredOutput);
      console.log("--------------------------------");
    }

    // Log citation relevance coverage for debugging
    if (debug) {
      const coveredCells = new Set<string>();
      structuredOutput.citations.forEach((citation) => {
        coveredCells.add(`${citation.rowIndex}-${citation.columnIndex}`);
      });

      const selectedCellKeys = selectedCells.map(
        (cell) => `${cell.rowIndex}-${cell.colIndex}`
      );
      const uncoveredCells = selectedCellKeys.filter(
        (cellKey) => !coveredCells.has(cellKey)
      );

      console.log(
        `Found citations relevant to ${coveredCells.size} out of ${selectedCells.length} selected cells`
      );
      if (uncoveredCells.length > 0) {
        console.log(
          `Selected cells without relevant citations: ${uncoveredCells.join(
            ", "
          )}`
        );
      }
    }

    // Process the structured response into Citation objects
    const citations: Citation[] = [];

    structuredOutput.citations.forEach((citation) => {
      // Validate URL format (must start with http:// or https://)
      if (
        !citation.citationUrl.startsWith("http://") &&
        !citation.citationUrl.startsWith("https://")
      ) {
        if (debug)
          console.warn("Invalid URL format, skipping:", citation.citationUrl);
        return;
      }

      citations.push({
        rowIndex: citation.rowIndex,
        colIndex: citation.columnIndex,
        header: citation.header,
        url: citation.citationUrl,
        title: citation.citationTitle,
        snippet: citation.citationSnippet,
        citedValue: citation.citedValue,
      });
    });

    if (!citations || citations.length === 0) {
      return {
        error: "No relevant citations found for the selected data.",
        searchContext: structuredOutput.textSummary,
      };
    }

    return {
      citations: citations.slice(0, 10), // Limit to top 10 citations
      searchContext: structuredOutput.textSummary,
    };
  } catch (error) {
    if (debug) console.error("Error calling Gemini API:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message.includes("rate_limit")) {
        return {
          error: "Rate limit exceeded. Please wait a moment and try again.",
        };
      } else if (error.message.includes("timeout")) {
        return { error: "Search request timed out. Please try again." };
      } else if (
        error.message.includes("authentication") ||
        error.message.includes("API key")
      ) {
        return {
          error: "Authentication error. Please check API configuration.",
        };
      } else {
        return { error: `Failed to find citations: ${error.message}` };
      }
    }

    return {
      error: "An unknown error occurred while searching for citations.",
    };
  }
}
