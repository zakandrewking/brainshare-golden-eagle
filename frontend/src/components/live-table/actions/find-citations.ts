"use server";

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

// Web search tool output interface
interface WebSearchOutput {
  type: string;
  status: string;
  content?: unknown;
}

// OpenAI response interface for web search
interface OpenAIWebSearchResponse {
  additional_kwargs?: {
    tool_outputs?: WebSearchOutput[];
  };
  content?: Array<{
    type: string;
    annotations?: Array<{
      type: string;
      url?: string;
      title?: string;
    }>;
    text?: string;
  }>;
}

// Content block with annotations
interface ContentBlock {
  type: string;
  text?: string;
  annotations?: Array<{
    type: string;
    url?: string;
    title?: string;
  }>;
}

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

// Create ChatOpenAI instance with web search capability
const createWebSearchModel = () => {
  const baseModel = new ChatOpenAI({
    model: MODEL,
    temperature: 0.1, // Low temperature for more consistent results
    maxTokens: 4000,
  });

  // Bind the web search tool
  return baseModel.bindTools([
    {
      type: "web_search_preview",
    },
  ]);
};

export default async function findCitations(
  selectedCells: CellPosition[],
  cellsData: string[][],
  headers: string[],
  documentTitle: string,
  documentDescription: string
): Promise<{
  citations?: Citation[];
  searchContext?: string;
  error?: string;
}> {
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
    console.error("Rate limiting error:", error);
    return { error: "Rate limiting failed. Please try again." };
  }

  // Build search context from selected cells
  const searchContext = buildSearchContext(
    selectedCells,
    cellsData,
    headers,
    documentTitle
  );

  // Create system prompt for citation finding
  const systemPrompt = `You are an expert research assistant specializing in finding high-quality, authoritative
citations for data verification and fact-checking.

Your task is to find credible sources that support, verify, or provide context for the selected data from a table.

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
- Every data points must be fully supported by a citation by exact match or by logical inference.
- If logical inference is used, explain the reasoning in the citation.
- If a data point is not fully supported, return that information at the end of the response.

Document Context: "${documentTitle}" - ${documentDescription}

Return citations that would help verify, support, or provide authoritative context for the selected data points.`;

  const userPrompt = `Find authoritative citations for the following selected data from a table:

HEADERS: ${headers.join(", ")}

SELECTED CELLS DATA:
${cellsData
  .map(
    (row, i) =>
      `Row ${i + 1}: ${row
        .map((cell, j) => `${headers[j] || `Column ${j + 1}`}: "${cell}"`)
        .join(", ")}`
  )
  .join("\n")}

SEARCH CONTEXT: ${searchContext}

Please search for high-quality, authoritative sources that can verify, support, or provide context for this data. Focus on:
1. Academic or research sources for scientific claims
2. Government or official statistics for numerical data
3. Reputable news sources for current events or facts
4. Professional or industry sources for specialized information

For each citation found, provide:
- A clear, relevant title
- The source URL
- A specific snippet that relates to the selected data
- The domain name for quick credibility assessment

Prioritize quality over quantity - better to have fewer high-quality citations than many low-quality ones.`;

  try {
    // Create model with web search capability
    const model = createWebSearchModel();

    console.log("--------------------------------");
    console.log("systemPrompt:", systemPrompt);
    console.log("--------------------------------");
    console.log("userPrompt:", userPrompt);
    console.log("--------------------------------");

    // Make the API call with web search
    const response = (await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ])) as OpenAIWebSearchResponse;

    console.log("--------------------------------");
    console.log("response.content.text", response.content?.[0]?.text);
    console.log("--------------------------------");
    console.log("response", response);
    console.log("--------------------------------");

    // Extract web search results from the response
    const webSearchResults = extractWebSearchResults(response);

    if (!webSearchResults || webSearchResults.length === 0) {
      return {
        error: "No web search results found. Please try a different search.",
      };
    }

    // Process the web search results into citations
    const citations = await processWebSearchResults(
      webSearchResults,
      searchContext
    );

    if (!citations || citations.length === 0) {
      return { error: "No relevant citations found for the selected data." };
    }

    return {
      citations: citations.slice(0, 10), // Limit to top 10 citations
      searchContext: searchContext,
    };
  } catch (error) {
    console.error("Error calling OpenAI web search API:", error);

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

// Helper function to build search context from selected cells
function buildSearchContext(
  selectedCells: CellPosition[],
  cellsData: string[][],
  headers: string[],
  documentTitle: string
): string {
  const uniqueValues = new Set<string>();
  const contextParts: string[] = [];

  // Extract unique values from selected cells
  selectedCells.forEach((cell) => {
    if (cellsData[cell.rowIndex] && cellsData[cell.rowIndex][cell.colIndex]) {
      const value = cellsData[cell.rowIndex][cell.colIndex].trim();
      if (value && value !== "" && !uniqueValues.has(value)) {
        uniqueValues.add(value);
        const header = headers[cell.colIndex] || `Column ${cell.colIndex + 1}`;
        contextParts.push(`${header}: ${value}`);
      }
    }
  });

  // Build a concise search context
  const context = `${documentTitle} - ${contextParts.join(", ")}`;

  // Truncate if too long while preserving meaning
  if (context.length > 200) {
    const truncated = context.substring(0, 197) + "...";
    return truncated;
  }

  return context;
}

// Helper function to extract web search results from OpenAI response
function extractWebSearchResults(
  response: OpenAIWebSearchResponse
): WebSearchOutput[] {
  try {
    // Check if the response has web search tool outputs
    if (response.additional_kwargs?.tool_outputs) {
      const toolOutputs = response.additional_kwargs.tool_outputs;
      const webSearchOutputs = toolOutputs.filter(
        (output: WebSearchOutput) =>
          output.type === "web_search_call" && output.status === "completed"
      );
      return webSearchOutputs;
    }

    // Fallback: extract from response content if structured differently
    if (response.content && Array.isArray(response.content)) {
      const searchContent = response.content.filter(
        (block) => block.type === "text" && block.annotations
      );
      return searchContent.map((block) => ({
        type: "web_search_call",
        status: "completed",
        content: block,
      }));
    }

    return [];
  } catch (error) {
    console.error("Error extracting web search results:", error);
    return [];
  }
}

// Helper function to process web search results into Citation objects
async function processWebSearchResults(
  webSearchResults: WebSearchOutput[],
  _searchContext: string
): Promise<Citation[]> {
  const citations: Citation[] = [];

  try {
    // Process each web search result
    for (const result of webSearchResults) {
      if (result.content) {
        // Extract citations from content with annotations
        const extractedCitations = extractCitationsFromContent(
          result.content as ContentBlock[]
        );
        citations.push(...extractedCitations);
      }
    }

    // Remove duplicates based on URL
    const uniqueCitations = citations.filter(
      (citation, index, self) =>
        index === self.findIndex((c) => c.url === citation.url)
    );

    // Sort by relevance if scores are available
    uniqueCitations.sort(
      (a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );

    return uniqueCitations;
  } catch (error) {
    console.error("Error processing web search results:", error);
    return [];
  }
}

// Helper function to extract citations from OpenAI web search content
function extractCitationsFromContent(
  content: ContentBlock[] | ContentBlock
): Citation[] {
  const citations: Citation[] = [];

  try {
    const contentArray = Array.isArray(content) ? content : [content];

    contentArray.forEach((block, index) => {
      if (block.type === "text" && block.annotations) {
        block.annotations.forEach((annotation, annotationIndex) => {
          if (annotation.type === "url_citation" && annotation.url) {
            try {
              const domain = new URL(annotation.url).hostname;

              citations.push({
                id: `citation-${index}-${annotationIndex}`,
                title: annotation.title || domain,
                url: annotation.url,
                snippet: block.text || "",
                domain: domain,
                relevanceScore: 0.8, // Default relevance score
              });
            } catch {
              console.warn(`Invalid URL in citation: ${annotation.url}`);
            }
          }
        });
      }
    });

    return citations;
  } catch (error) {
    console.error("Error extracting citations from content:", error);
    return [];
  }
}
