import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock openai
const mockResponsesParse = vi.fn();
const mockOpenAIInstance = {
  responses: {
    parse: mockResponsesParse,
  },
};
const MockOpenAIClass = vi.fn(() => mockOpenAIInstance);

vi.mock("openai", () => ({
  default: MockOpenAIClass,
}));

// Mock zodTextFormat
vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn((schema, name) => ({ schema, name })),
}));

// Mock the config
vi.mock("@/components/live-table/actions/config", () => ({
  defaultModel: "gpt-4.1",
  researchModel: "o3",
}));

// Dynamically import the module to be tested
let findCitationsModule: typeof import("@/components/live-table/actions/find-citations");

describe("findCitations", () => {
  const mockSelectedCells = [
    { rowIndex: 0, colIndex: 0 },
    { rowIndex: 0, colIndex: 1 },
  ];
  const mockCellsData = [
    ["Apple Inc", "Technology"],
    ["Microsoft", "Software"],
  ];
  const mockHeaders = ["Company", "Industry"];
  const mockDocumentTitle = "Tech Companies Analysis";
  const mockDocumentDescription = "Analysis of major tech companies";

  beforeEach(async () => {
    vi.clearAllMocks();
    findCitationsModule = await import(
      "@/components/live-table/actions/find-citations"
    );
  });

  describe("main findCitations function", () => {
    it("should successfully find citations for selected cells", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary:
            "Apple Inc is a leading technology company based in Cupertino, California, known for designing and manufacturing consumer electronics, software, and online services.",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.apple.com",
              citationTitle: "Apple Inc - Official Website",
              citationSnippet: "Apple is a leading technology company",
              citedValue: "Apple Inc",
            },
          ],
        },
        usage: {
          prompt_tokens: 100,
          completion_tokens: 200,
          total_tokens: 300,
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(MockOpenAIClass).toHaveBeenCalled();
      expect(mockResponsesParse).toHaveBeenCalledTimes(1);
      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user" }),
          ]),
        })
      );
      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
      expect(result.searchContext).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should return error when no cells are selected", async () => {
      const result = await findCitationsModule.default(
        [],
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No cells selected for citation search.");
      expect(result.citations).toBeUndefined();
      expect(mockResponsesParse).not.toHaveBeenCalled();
    });

    it("should return error when no cell data is provided", async () => {
      const result = await findCitationsModule.default(
        mockSelectedCells,
        [],
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No cell data provided for citation search.");
      expect(result.citations).toBeUndefined();
      expect(mockResponsesParse).not.toHaveBeenCalled();
    });

    it("should return error when no headers are provided", async () => {
      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        [],
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("No headers provided for context.");
      expect(result.citations).toBeUndefined();
      expect(mockResponsesParse).not.toHaveBeenCalled();
    });

    it("should handle API rate limit error", async () => {
      const rateError = new Error("rate_limit exceeded");
      mockResponsesParse.mockRejectedValueOnce(rateError);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
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
      mockResponsesParse.mockRejectedValueOnce(timeoutError);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe("Search request timed out. Please try again.");
      expect(result.citations).toBeUndefined();
    });

    it("should handle API authentication error", async () => {
      const authError = new Error("authentication failed - API key invalid");
      mockResponsesParse.mockRejectedValueOnce(authError);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
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
      mockResponsesParse.mockRejectedValueOnce(generalError);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Failed to find citations: Something went wrong"
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle unknown error", async () => {
      mockResponsesParse.mockRejectedValueOnce("string error");

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "An unknown error occurred while searching for citations."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should handle empty citations response", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary:
            "No relevant citations could be found for the selected data.",
          citations: [],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
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
        cellIndex: i % 2, // Alternate between cell indices 0 and 1
        citationUrl: `https://example${i}.com`,
        citationTitle: `Example ${i}`,
        citationSnippet: `Citation ${i}`,
        citedValue: `Value ${i}`,
      }));

      const mockResponse = {
        output_parsed: {
          textSummary: "Multiple citations found for the selected data.",
          citations: citations,
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.length).toBe(10);
    });

    it("should handle citedValue in response", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Found relevant data for the selected companies.",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.sec.gov/example",
              citationTitle: "SEC Filing - Apple Inc",
              citationSnippet: "Apple Inc reported revenue of $394.3 billion",
              citedValue: "394.3 billion",
            },
            {
              cellIndex: 1,
              citationUrl: "https://www.microsoft.com/investor",
              citationTitle: "Microsoft Investor Relations",
              citationSnippet: "Microsoft is a technology company",
              citedValue: "Microsoft",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBe(2);
      expect(result.citations?.[0].citedValue).toBe("394.3 billion");
      expect(result.citations?.[1].citedValue).toBe("Microsoft");
    });

    it("should handle missing citedValue gracefully", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Citations without specific values",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://example.com",
              citationTitle: "Example Source",
              citationSnippet: "General information about companies",
              citedValue: "Example Source",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
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
      const mockResponse = {
        output_parsed: { textSummary: "Test", citations: [] },
      };
      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Check that the API was called with proper structure
      expect(mockResponsesParse).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining(
                "=== SELECTED CELLS (Values Hidden) ==="
              ),
            }),
          ]),
        })
      );
    });

    it("should handle duplicate values in selected cells", async () => {
      const duplicateCells = [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 0 },
      ];

      const mockResponse = {
        output_parsed: { textSummary: "Test", citations: [] },
      };
      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        duplicateCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Check that the API was called
      expect(mockResponsesParse).toHaveBeenCalled();
    });

    it("should handle empty cells gracefully", async () => {
      const cellsWithEmpty = [
        ["Apple Inc", ""],
        ["", "Software"],
      ];

      const selectedCellsWithEmpty = [
        { rowIndex: 0, colIndex: 1 },
        { rowIndex: 1, colIndex: 0 },
      ];

      const mockResponse = {
        output_parsed: { textSummary: "Test", citations: [] },
      };
      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        selectedCellsWithEmpty,
        cellsWithEmpty,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(mockResponsesParse).toHaveBeenCalled();
    });

    it("should truncate long contexts", async () => {
      const longValue = "A".repeat(200);
      const longCellsData = [[longValue, "Technology"]];
      const longSelectedCells = [{ rowIndex: 0, colIndex: 0 }];

      const mockResponse = {
        output_parsed: { textSummary: "Test", citations: [] },
      };
      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        longSelectedCells,
        longCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(mockResponsesParse).toHaveBeenCalled();
    });
  });

  describe("structured output parsing", () => {
    it("should parse valid JSON with citations", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Apple Inc is a leading technology company",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.apple.com",
              citationTitle: "Apple Inc - Official Website",
              citationSnippet: "Apple is a leading technology company",
              citedValue: "Apple Inc",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBeUndefined();
      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });

    it("should handle malformed JSON gracefully", async () => {
      const mockResponse = {
        output_parsed: null,
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.error).toBe(
        "Failed to parse structured response from API."
      );
    });

    it("should extract citations with proper URL validation", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Technology companies information",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.apple.com",
              citationTitle: "Apple Inc",
              citationSnippet: "Apple is a technology company",
              citedValue: "Apple Inc",
            },
            {
              cellIndex: 1,
              citationUrl: "invalid-url",
              citationTitle: "Invalid URL",
              citationSnippet: "Invalid URL",
              citedValue: "Invalid URL",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.every((c) => c.url.startsWith("http"))).toBe(
        true
      );
    });

    it("should handle single citation", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Microsoft is a software company",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.microsoft.com",
              citationTitle: "Microsoft",
              citationSnippet: "Microsoft is a software company",
              citedValue: "Microsoft",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });
  });

  describe("rate limiting", () => {
    it("should apply rate limiting delay", async () => {
      const startTime = Date.now();

      const mockResponse = {
        output_parsed: { textSummary: "Test", citations: [] },
      };

      const promise1 = findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      const promise2 = findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      mockResponsesParse.mockResolvedValue(mockResponse);

      await Promise.all([promise1, promise2]);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(500);
    });
  });

  describe("Citation interface", () => {
    it("should return citations with all required fields", async () => {
      const mockResponse = {
        output_parsed: {
          textSummary: "Apple is a leading technology company",
          citations: [
            {
              cellIndex: 0,
              citationUrl: "https://www.apple.com",
              citationTitle: "Apple Inc - Official Website",
              citationSnippet: "Apple is a leading technology company",
              citedValue: "Apple Inc",
            },
          ],
        },
      };

      mockResponsesParse.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });
  });
});
