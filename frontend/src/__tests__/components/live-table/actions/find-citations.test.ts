import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Google Gemini API
const mockGenerateContent = vi.fn();
const mockModels = {
  generateContent: mockGenerateContent,
};
const mockGoogleGenAIInstance = {
  models: mockModels,
};
const MockGoogleGenAIClass = vi.fn(() => mockGoogleGenAIInstance);

vi.mock("@google/genai", () => ({
  GoogleGenAI: MockGoogleGenAIClass,
}));

// Mock zodToJsonSchema
vi.mock("zod-to-json-schema", () => ({
  zodToJsonSchema: vi.fn((schema, options) => ({
    type: "object",
    properties: {
      textSummary: { type: "string" },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rowIndex: { type: "number" },
            columnIndex: { type: "number" },
            header: { type: "string" },
            citationUrl: { type: "string" },
            citationTitle: { type: "string" },
            citationSnippet: { type: "string" },
            citedValue: { type: "string" },
          },
        },
      },
    },
  })),
}));

// Mock the config
vi.mock("@/llm-config", () => ({
  geminiModel: "gemini-2.5-pro",
}));

// Mock environment variables
const _originalEnv = process.env;

// Dynamically import the module to be tested
let findCitationsModule: typeof import("@/components/live-table/actions/find-citations");

describe("findCitations", () => {
  const mockHeaders = ["Company", "Industry"];
  const mockTableData = [
    { Company: "Apple Inc", Industry: "Technology" },
    { Company: "Microsoft", Industry: "Software" },
  ];
  const mockSelectedCells = [
    { rowIndex: 0, colIndex: 0, value: "Apple Inc" },
    { rowIndex: 0, colIndex: 1, value: "Technology" },
  ];
  const mockDocumentTitle = "Tech Companies Analysis";
  const mockDocumentDescription = "Analysis of major tech companies";

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock environment variable
    process.env.GEMINI_API_KEY = "test-api-key";

    // Reset module cache and import fresh
    vi.resetModules();
    findCitationsModule = await import(
      "@/components/live-table/actions/find-citations"
    );
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("main findCitations function", () => {
    it("should successfully find citations for selected cells", async () => {
      const mockResponseData = {
        textSummary:
          "Apple Inc is a leading technology company based in Cupertino, California, known for designing and manufacturing consumer electronics, software, and online services.",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.apple.com",
            citationTitle: "Apple Inc - Official Website",
            citationSnippet: "Apple is a leading technology company",
            citedValue: "Apple Inc",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
        usageMetadata: {
          thoughtsTokenCount: 150,
          candidatesTokenCount: 200,
        },
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(MockGoogleGenAIClass).toHaveBeenCalled();
      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-2.5-pro",
          contents: expect.any(String),
          config: expect.objectContaining({
            tools: expect.any(Array),
            thinkingConfig: expect.any(Object),
            responseJsonSchema: expect.any(Object),
          }),
        })
      );
      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
      expect(result.searchContext).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should return error when no cells are selected", async () => {
      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        [],
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No cells selected for citation search.");
      expect(result.citations).toBeUndefined();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("should return error when no cell data is provided", async () => {
      const result = await findCitationsModule.default(
        [],
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No cell data provided for citation search.");
      expect(result.citations).toBeUndefined();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("should return error when no headers are provided", async () => {
      const result = await findCitationsModule.default(
        mockTableData,
        [],
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No headers provided for context.");
      expect(result.citations).toBeUndefined();
      expect(mockGenerateContent).not.toHaveBeenCalled();
    });

    it("should handle API rate limit error", async () => {
      const rateError = new Error("rate_limit exceeded");
      mockGenerateContent.mockRejectedValueOnce(rateError);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Rate limit exceeded. Please wait a moment and try again."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle API timeout error", async () => {
      const timeoutError = new Error("timeout occurred");
      mockGenerateContent.mockRejectedValueOnce(timeoutError);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("Search request timed out. Please try again.");
      expect(result.citations).toBeUndefined();
    });

    it("should handle API authentication error", async () => {
      const authError = new Error("authentication failed - API key invalid");
      mockGenerateContent.mockRejectedValueOnce(authError);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Authentication error. Please check API configuration."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle general API error", async () => {
      const generalError = new Error("Something went wrong");
      mockGenerateContent.mockRejectedValueOnce(generalError);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Failed to find citations: Something went wrong"
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle unknown error", async () => {
      mockGenerateContent.mockRejectedValueOnce("string error");

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "An unknown error occurred while searching for citations."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle empty citations response", async () => {
      const mockResponseData = {
        textSummary:
          "No relevant citations could be found for the selected data.",
        citations: [],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "No relevant citations found for the selected data."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should limit citations to top 10", async () => {
      const citations = Array.from({ length: 15 }, (_, i) => ({
        rowIndex: 0,
        columnIndex: i % 2, // Alternate between column indices 0 and 1
        header: i % 2 === 0 ? "Company" : "Industry",
        citationUrl: `https://example${i}.com`,
        citationTitle: `Example ${i}`,
        citationSnippet: `Citation ${i}`,
        citedValue: `Value ${i}`,
      }));

      const mockResponseData = {
        textSummary: "Multiple citations found for the selected data.",
        citations: citations,
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.length).toBe(10);
    });

    it("should handle citedValue in response", async () => {
      const mockResponseData = {
        textSummary: "Found relevant data for the selected companies.",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.sec.gov/example",
            citationTitle: "SEC Filing - Apple Inc",
            citationSnippet: "Apple Inc reported revenue of $394.3 billion",
            citedValue: "394.3 billion",
          },
          {
            rowIndex: 0,
            columnIndex: 1,
            header: "Industry",
            citationUrl: "https://www.microsoft.com/investor",
            citationTitle: "Microsoft Investor Relations",
            citationSnippet: "Microsoft is a technology company",
            citedValue: "Microsoft",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBe(2);
      expect(result.citations?.[0].citedValue).toBe("394.3 billion");
      expect(result.citations?.[1].citedValue).toBe("Microsoft");
    });

    it("should handle missing citedValue gracefully", async () => {
      const mockResponseData = {
        textSummary: "Citations without specific values",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://example.com",
            citationTitle: "Example Source",
            citationSnippet: "General information about companies",
            citedValue: "Example Source",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBe(1);
      expect(result.citations?.[0].citedValue).toBe("Example Source");
    });
  });

  describe("buildSearchContext", () => {
    it("should build search context from selected cells", async () => {
      const mockResponseData = { textSummary: "Test", citations: [] };
      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };
      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Check that the API was called with proper structure
      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "gemini-2.5-pro",
          contents: expect.stringContaining(
            "=== SELECTED CELLS (Values Hidden) ==="
          ),
          config: expect.any(Object),
        })
      );
    });

    it("should handle duplicate values in selected cells", async () => {
      const duplicateCells = [
        { rowIndex: 0, colIndex: 0, value: "Apple Inc" },
        { rowIndex: 0, colIndex: 0, value: "Apple Inc" },
      ];

      const mockResponseData = { textSummary: "Test", citations: [] };
      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };
      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        duplicateCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Check that the API was called
      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should handle empty cells gracefully", async () => {
      const tableWithEmpty = [
        { Company: "Apple Inc", Industry: "" },
        { Company: "", Industry: "Software" },
      ];

      const selectedCellsWithEmpty = [
        { rowIndex: 0, colIndex: 1, value: "" },
        { rowIndex: 1, colIndex: 0, value: "" },
      ];

      const mockResponseData = { textSummary: "Test", citations: [] };
      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };
      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        tableWithEmpty,
        mockHeaders,
        selectedCellsWithEmpty,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(mockGenerateContent).toHaveBeenCalled();
    });

    it("should truncate long contexts", async () => {
      const longValue = "A".repeat(200);
      const longTableData = [{ Company: longValue, Industry: "Technology" }];
      const longSelectedCells = [
        { rowIndex: 0, colIndex: 0, value: longValue },
      ];

      const mockResponseData = { textSummary: "Test", citations: [] };
      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };
      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        longTableData,
        mockHeaders,
        longSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });

  describe("structured output parsing", () => {
    it("should parse valid JSON with citations", async () => {
      const mockResponseData = {
        textSummary: "Apple Inc is a leading technology company",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.apple.com",
            citationTitle: "Apple Inc - Official Website",
            citationSnippet: "Apple is a leading technology company",
            citedValue: "Apple Inc",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBeUndefined();
      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });

    it("should handle malformed JSON gracefully", async () => {
      const mockResponse = {
        text: null,
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Failed to find citations: No response text received from API"
      );
    });

    it("should extract citations with proper URL validation", async () => {
      const mockResponseData = {
        textSummary: "Technology companies information",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.apple.com",
            citationTitle: "Apple Inc",
            citationSnippet: "Apple is a technology company",
            citedValue: "Apple Inc",
          },
          {
            rowIndex: 0,
            columnIndex: 1,
            header: "Industry",
            citationUrl: "invalid-url",
            citationTitle: "Invalid URL",
            citationSnippet: "Invalid URL",
            citedValue: "Invalid URL",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.every((c) => c.url.startsWith("http"))).toBe(
        true
      );
    });

    it("should handle single citation", async () => {
      const mockResponseData = {
        textSummary: "Microsoft is a software company",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.microsoft.com",
            citationTitle: "Microsoft",
            citationSnippet: "Microsoft is a software company",
            citedValue: "Microsoft",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });
  });

  describe("rate limiting", () => {
    it("should apply rate limiting delay", async () => {
      const mockResponseData = { textSummary: "Test", citations: [] };
      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      // First call should complete immediately
      const promise1 = findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Advance time to complete first call
      await vi.runAllTimersAsync();
      await promise1;

      // Second call should be delayed due to rate limiting
      const promise2 = findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Advance timers by the expected rate limit delay (1000ms)
      await vi.advanceTimersByTimeAsync(1000);
      await promise2;

      // Both calls should have succeeded
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe("Citation interface", () => {
    it("should return citations with all required fields", async () => {
      const mockResponseData = {
        textSummary: "Apple is a leading technology company",
        citations: [
          {
            rowIndex: 0,
            columnIndex: 0,
            header: "Company",
            citationUrl: "https://www.apple.com",
            citationTitle: "Apple Inc - Official Website",
            citationSnippet: "Apple is a leading technology company",
            citedValue: "Apple Inc",
          },
        ],
      };

      const mockResponse = {
        text: JSON.stringify(mockResponseData),
      };

      mockGenerateContent.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockTableData,
        mockHeaders,
        mockSelectedCells,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });
  });
});
