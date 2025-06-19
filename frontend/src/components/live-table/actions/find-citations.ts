"use server";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { encoding_for_model } from "tiktoken";
import { z } from "zod";

import { defaultModel } from "@/llm-config";

// TypeScript interfaces for citation data
export interface Citation {
  title: string;
  url: string;
  snippet: string;
  citedValue: string;
}

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
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
      cellIndex: z
        .number()
        .describe("The index of the cell that this citation supports"),
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
  selectedCells: CellPosition[],
  cellsData: string[][],
  headers: string[],
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

  if (!cellsData || cellsData.length === 0) {
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
      "cellIndex": 0,
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

Cells can be included multiple times if they are supported by multiple citations.

`;

  const userPrompt = `Find authoritative citations related to the following research topic and data:

=== RESEARCH CONTEXT ===
Document: "${documentTitle}"
Description: ${documentDescription}

=== COMPLETE TABLE DATA (For Context) ===
Headers: ${headers.join(" | ")}

${cellsData
  .map((row, rowIndex) => {
    const maskedRow = row.map((cell, colIndex) => {
      // Check if this cell is in the selected cells
      const isSelected = selectedCells.some(
        (selectedCell) =>
          selectedCell.rowIndex === rowIndex &&
          selectedCell.colIndex === colIndex
      );

      if (isSelected) {
        return "[SELECTED_CELL]"; // Mask the selected cell values
      }
      return cell; // Keep other cell values visible
    });

    return `Row ${rowIndex + 1}: ${maskedRow
      .map(
        (cell, colIndex) =>
          `${headers[colIndex] || `Col${colIndex + 1}`}: "${cell}"`
      )
      .join(" | ")}`;
  })
  .join("\n")}

=== SELECTED CELLS (Values Hidden) ===
The user has selected ${
    selectedCells.length
  } specific data points (marked as [SELECTED_CELL] above) for citation:

${selectedCells
  .map((cell, index) => {
    const colIndex = cell.colIndex;
    const rowIndex = cell.rowIndex;
    const headerName = headers[colIndex] || `Column ${colIndex + 1}`;
    return `${index + 1}. ${headerName} (Row ${rowIndex + 1}) - [HIDDEN VALUE]`;
  })
  .join("\n")}
`;

  try {
    // Create OpenAI client
    const openai = new OpenAI({
      dangerouslyAllowBrowser: debug,
    });

    if (debug) {
      console.log("--------------------------------");
      console.log("systemPrompt:", systemPrompt);
      console.log("--------------------------------");
      console.log("userPrompt:", userPrompt);
      console.log("--------------------------------");
    }

    // Calculate accurate input token count using tiktoken
    const encoding = encoding_for_model("gpt-4");

    const systemPromptTokens = encoding.encode(systemPrompt).length;
    const userPromptTokens = encoding.encode(userPrompt).length;
    const totalInputTokens = systemPromptTokens + userPromptTokens;

    if (debug) {
      console.log("--------------------------------");
      console.log(`- System Prompt Tokens: ${systemPromptTokens}`);
      console.log(`- User Prompt Tokens: ${userPromptTokens}`);
      console.log(`- Total Input Tokens: ${totalInputTokens}`);
      console.log("--------------------------------");
    }

    // Make the API call with structured output
    const response = await openai.responses.parse({
      model: defaultModel,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      text: {
        format: zodTextFormat(webSearchSchema, "webSearchResult"),
      },
      tools: [{ type: "web_search_preview" }],
      tool_choice: { type: "web_search_preview" },
    });

    const structuredOutput = response.output_parsed;

    // Handle null response
    if (!structuredOutput) {
      return {
        error: "Failed to parse structured response from API.",
      };
    }

    if (debug) {
      console.log("--------------------------------");
      console.log("response.output_parsed:", structuredOutput);
      console.log("--------------------------------");
    }

    // Log token usage information using tiktoken for accuracy
    const responseContent = JSON.stringify(structuredOutput);
    const actualOutputTokens = encoding.encode(responseContent).length;

    if (debug) {
      console.log("--------------------------------");
      console.log(`- Output Tokens: ${actualOutputTokens}`);

      // Log usage metadata if available in response
      if (response.usage) {
        console.log("- Actual Token Usage:", response.usage);
      }
      console.log("--------------------------------");
    }

    // Free the encoding to prevent memory leaks
    encoding.free();

    // Log citation relevance coverage for debugging
    if (debug) {
      const coveredCellIndices = new Set<number>();
      structuredOutput.citations.forEach((citation) => {
        coveredCellIndices.add(citation.cellIndex);
      });

      const expectedIndices = Array.from(
        { length: selectedCells.length },
        (_, i) => i
      );
      const uncoveredIndices = expectedIndices.filter(
        (index) => !coveredCellIndices.has(index)
      );

      console.log(
        `Found citations relevant to ${coveredCellIndices.size} out of ${selectedCells.length} data categories`
      );
      if (uncoveredIndices.length > 0) {
        console.log(
          `Data categories without relevant citations: ${uncoveredIndices.join(
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
        title: citation.citationTitle,
        url: citation.citationUrl,
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
    if (debug) console.error("Error calling OpenAI web search API:", error);

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
