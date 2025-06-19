"use server";

import { encoding_for_model } from "tiktoken";
import { z } from "zod";

import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";

import { MODEL } from "./config";

// TypeScript interfaces for citation data
export interface Citation {
  id: string;
  title: string;
  url: string;
  snippet: string;
  domain: string;
  relevanceScore?: number;
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
  citationUrls: z
    .array(
      z.object({
        url: z.string().describe("The URL of the citation source"),
        title: z.string().describe("The title of the source"),
        snippet: z
          .string()
          .describe(
            "A relevant excerpt from the source that relates to the data"
          ),
        domain: z.string().describe("The domain name of the source"),
        cellIndices: z
          .array(z.number())
          .describe(
            "Array of cell indices (0-based) that this citation supports"
          ),
      })
    )
    .describe(
      "A list of authoritative citation sources with their details - must include at least one citation for each selected cell"
    ),
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

// Create ChatOpenAI instance for web search
const createWebSearchModel = () => {
  return new ChatOpenAI({
    model: MODEL,
    temperature: 0.1, // Low temperature for more consistent results
    maxTokens: 4000,
  });
};

// Parse structured output from the model response
function parseStructuredOutput(
  responseText: string | undefined,
  debug = false
): {
  textSummary: string;
  citationUrls: Array<{
    url: string;
    title: string;
    snippet: string;
    domain: string;
    cellIndices: number[];
  }>;
} {
  try {
    // Handle undefined or null input
    if (!responseText || typeof responseText !== "string") {
      if (debug) console.warn("Invalid response text:", responseText);
      return {
        textSummary:
          "Unable to parse structured response. Invalid response format.",
        citationUrls: [],
      };
    }

    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return webSearchSchema.parse(parsed);
    }

    // Fallback: Try to parse the entire response as JSON
    const parsed = JSON.parse(responseText);
    return webSearchSchema.parse(parsed);
  } catch (error) {
    if (debug) console.error("Error parsing structured output:", error);

    // Ultimate fallback: Create a basic structure
    return {
      textSummary:
        "Unable to parse structured response. Raw response: " +
        (responseText || "undefined"),
      citationUrls: [],
    };
  }
}

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
  const systemPrompt = `You are an expert research assistant with web search capabilities specializing in finding high-quality, authoritative citations for data verification and fact-checking.

Your task is to search the web and find credible sources that support, verify, or provide context for the selected data from a table.

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

COMPLETENESS REQUIREMENTS:
- Every data point must be fully supported by a citation by exact match or by logical inference.
- If logical inference is used, explain the reasoning in the citation.
- If a data point is not fully supported, mention that in the text summary.
- CRITICAL: You must provide at least one citation for EACH selected cell. If multiple cells have the same data, you can reuse citations but each cell must be covered.

Document Context: "${documentTitle}" - ${documentDescription}

You must return your response in the following JSON format wrapped in \`\`\`json and \`\`\` tags:

{
  "textSummary": "A comprehensive summary of your research findings that supports or provides context for the selected data points",
  "citationUrls": [
    {
      "url": "https://example.com/source1",
      "title": "Title of the source",
      "snippet": "Relevant excerpt from the source that relates to the data",
      "domain": "example.com",
      "cellIndices": [0, 1]
    }
  ]
}`;

  const userPrompt = `Find authoritative citations for the following data:

=== SELECTED CELLS (Primary Focus) ===
${selectedCells
  .map((cell, index) => {
    const rowIndex = cell.rowIndex;
    const colIndex = cell.colIndex;
    const cellValue = cellsData[rowIndex]?.[colIndex] || "N/A";
    const headerName = headers[colIndex] || `Column ${colIndex + 1}`;
    return `${index + 1}. ${headerName}: "${cellValue}" (Row ${rowIndex + 1})`;
  })
  .join("\n")}

=== TABLE CONTEXT (For Reference) ===
Document: "${documentTitle}"
Description: ${documentDescription}

Complete Table Data:
Headers: ${headers.join(" | ")}
${cellsData
  .map(
    (row, rowIndex) =>
      `Row ${rowIndex + 1}: ${row
        .map(
          (cell, colIndex) =>
            `${headers[colIndex] || `Col${colIndex + 1}`}: "${cell}"`
        )
        .join(" | ")}`
  )
  .join("\n")}

Table Summary:
- Total Rows: ${cellsData.length}
- Total Columns: ${headers.length}
- Selected Cells Count: ${selectedCells.length}

Please search the web for high-quality, authoritative sources that can verify, support, or provide context for the SELECTED CELLS data above. Focus on:
1. Academic or research sources for scientific claims
2. Government or official statistics for numerical data
3. Reputable news sources for current events or facts
4. Professional or industry sources for specialized information

IMPORTANT: Your citations should directly relate to the specific data values in the SELECTED CELLS section, not just the general table topic. Use the complete table context above to understand the broader dataset and find more relevant citations.

Provide a comprehensive text summary of your research findings and include specific citation details with:
- Clear, relevant titles
- Source URLs
- Specific snippets that relate to the selected data
- Domain names for credibility assessment
- Cell indices array indicating which selected cells (0-based index) each citation supports

CRITICAL REQUIREMENT: Each citation must include a "cellIndices" array that lists which selected cells it supports. You must ensure that every selected cell (indices 0 through ${
    selectedCells.length - 1
  }) appears in at least one citation's cellIndices array.

For reference, the selected cells are indexed as follows:
${selectedCells
  .map((cell, index) => {
    const rowIndex = cell.rowIndex;
    const colIndex = cell.colIndex;
    const cellValue = cellsData[rowIndex]?.[colIndex] || "N/A";
    const headerName = headers[colIndex] || `Column ${colIndex + 1}`;
    return `- Index ${index}: ${headerName}: "${cellValue}" (Row ${
      rowIndex + 1
    })`;
  })
  .join("\n")}

Return your response in the exact JSON format specified above, wrapped in \`\`\`json and \`\`\` tags.

You may reuse citations for multiple cells if they support the same or related data, but every cell index (0-${
    selectedCells.length - 1
  }) must appear in at least one citation's cellIndices array.`;

  try {
    // Create model
    const model = createWebSearchModel();

    if (debug) {
      console.log("--------------------------------");
      console.log("systemPrompt:", systemPrompt);
      console.log("--------------------------------");
      console.log("userPrompt:", userPrompt);
      console.log("--------------------------------");
    }

    // Calculate accurate input token count using tiktoken
    const encoding = encoding_for_model("gpt-4");
    const systemPromptLength = systemPrompt.length;
    const userPromptLength = userPrompt.length;
    const totalInputLength = systemPromptLength + userPromptLength;

    const systemPromptTokens = encoding.encode(systemPrompt).length;
    const userPromptTokens = encoding.encode(userPrompt).length;
    const totalInputTokens = systemPromptTokens + userPromptTokens;

    if (debug) {
      console.log("TOKEN COUNTS - INPUT:");
      console.log(`- System Prompt Length: ${systemPromptLength} chars`);
      console.log(`- User Prompt Length: ${userPromptLength} chars`);
      console.log(`- Total Input Length: ${totalInputLength} chars`);
      console.log(`- System Prompt Tokens: ${systemPromptTokens}`);
      console.log(`- User Prompt Tokens: ${userPromptTokens}`);
      console.log(`- Total Input Tokens: ${totalInputTokens}`);
      console.log("--------------------------------");
    }

    // Make the API call
    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ]);

    if (debug) {
      console.log("--------------------------------");
      console.log("response.content:", response.content);
      console.log("--------------------------------");
    }

    // Log token usage information using tiktoken for accuracy
    const responseContent = (response.content as string) || "";
    const responseLength = responseContent.length;
    const actualOutputTokens = encoding.encode(responseContent).length;

    if (debug) {
      console.log("TOKEN COUNTS - OUTPUT:");
      console.log(`- Response Length: ${responseLength} chars`);
      console.log(`- Actual Output Tokens: ${actualOutputTokens}`);
      console.log(
        `- Total Actual Tokens: ${totalInputTokens + actualOutputTokens}`
      );

      // Log usage metadata if available in response
      if (response.response_metadata?.tokenUsage) {
        console.log(
          "- Actual Token Usage:",
          response.response_metadata.tokenUsage
        );
      } else if (response.usage_metadata) {
        console.log("- Actual Token Usage:", response.usage_metadata);
      } else if (
        "additional_kwargs" in response &&
        response.additional_kwargs &&
        typeof response.additional_kwargs === "object" &&
        "usage" in response.additional_kwargs
      ) {
        console.log("- Actual Token Usage:", response.additional_kwargs.usage);
      }
      console.log("--------------------------------");
    }

    // Free the encoding to prevent memory leaks
    encoding.free();

    // Parse the structured response
    const structuredOutput = parseStructuredOutput(
      response.content as string | undefined,
      debug
    );

    if (debug) {
      console.log("--------------------------------");
      console.log(
        "structuredOutput.textSummary:",
        structuredOutput.textSummary
      );
      console.log("--------------------------------");
      console.log(
        "structuredOutput.citationUrls:",
        structuredOutput.citationUrls
      );
      console.log("--------------------------------");
    }

    // Validate that all selected cells are covered by citations
    const coveredCellIndices = new Set<number>();
    structuredOutput.citationUrls.forEach((citation) => {
      if (citation.cellIndices && Array.isArray(citation.cellIndices)) {
        citation.cellIndices.forEach((index) => coveredCellIndices.add(index));
      }
    });

    const expectedIndices = Array.from(
      { length: selectedCells.length },
      (_, i) => i
    );
    const uncoveredIndices = expectedIndices.filter(
      (index) => !coveredCellIndices.has(index)
    );

    if (uncoveredIndices.length > 0) {
      if (debug) {
        console.warn(
          `Warning: The following cell indices are not covered by citations: ${uncoveredIndices.join(
            ", "
          )}`
        );
        console.warn("Expected indices:", expectedIndices);
        console.warn("Covered indices:", Array.from(coveredCellIndices));
      }
    }

    // Process the structured response into Citation objects
    const citations = processCitationUrls(
      structuredOutput.citationUrls,
      debug,
      selectedCells.length
    );

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

// Helper function to process citation URLs into Citation objects
function processCitationUrls(
  citationUrls: {
    url: string;
    title: string;
    snippet: string;
    domain: string;
    cellIndices: number[];
  }[],
  debug = false,
  selectedCellsLength?: number
): Citation[] {
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();

  citationUrls.forEach((citationUrl) => {
    // Validate URL format (must start with http:// or https://)
    if (
      !citationUrl.url.startsWith("http://") &&
      !citationUrl.url.startsWith("https://")
    ) {
      if (debug) console.warn("Invalid URL format, skipping:", citationUrl.url);
      return;
    }

    // Skip duplicates by URL
    if (seenUrls.has(citationUrl.url)) {
      if (debug)
        console.warn("Duplicate URL found, skipping:", citationUrl.url);
      return;
    }

    seenUrls.add(citationUrl.url);

    citations.push({
      id: `citation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: citationUrl.title,
      url: citationUrl.url,
      snippet: citationUrl.snippet,
      domain: citationUrl.domain,
      relevanceScore: 0.8, // Default relevance score
    });
  });

  // Sort by relevance score (higher first)
  return citations.sort(
    (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
  );
}
