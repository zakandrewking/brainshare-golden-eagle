import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock @langchain/openai
const mockInvoke = vi.fn();
const mockChatOpenAIInstance = {
  invoke: mockInvoke,
};
const MockChatOpenAIClass = vi.fn(() => mockChatOpenAIInstance);

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAIClass,
}));

// Mock @langchain/core/messages
let SystemMessageSpy: ReturnType<typeof vi.fn>;
let HumanMessageSpy: ReturnType<typeof vi.fn>;

vi.mock("@langchain/core/messages", async () => {
  const ActualMessages = await vi.importActual<
    typeof import("@langchain/core/messages")
  >("@langchain/core/messages");
  SystemMessageSpy = vi.fn(
    (...args: ConstructorParameters<typeof ActualMessages.SystemMessage>) =>
      new ActualMessages.SystemMessage(...args)
  );
  HumanMessageSpy = vi.fn(
    (...args: ConstructorParameters<typeof ActualMessages.HumanMessage>) =>
      new ActualMessages.HumanMessage(...args)
  );
  return {
    ...ActualMessages,
    SystemMessage: SystemMessageSpy,
    HumanMessage: HumanMessageSpy,
  };
});

// Mock the config
vi.mock("@/components/live-table/actions/config", () => ({
  MODEL: "gpt-4.1",
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
        content: `\`\`\`json
{
  "textSummary": "Apple Inc is a leading technology company based in Cupertino, California, known for designing and manufacturing consumer electronics, software, and online services.",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc - Official Website",
      "snippet": "Apple is a leading technology company",
      "domain": "apple.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(MockChatOpenAIClass).toHaveBeenCalledWith({
        model: "gpt-4.1",
        temperature: 0.1,
        maxTokens: 4000,
      });
      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(SystemMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("expert research assistant")
      );
      expect(HumanMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("Find authoritative citations")
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
      expect(mockInvoke).not.toHaveBeenCalled();
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
      expect(mockInvoke).not.toHaveBeenCalled();
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
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("should handle API rate limit error", async () => {
      const rateError = new Error("rate_limit exceeded");
      mockInvoke.mockRejectedValueOnce(rateError);

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
      mockInvoke.mockRejectedValueOnce(timeoutError);

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
      mockInvoke.mockRejectedValueOnce(authError);

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
      mockInvoke.mockRejectedValueOnce(generalError);

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
      mockInvoke.mockRejectedValueOnce("string error");

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
        content: `\`\`\`json
{
  "textSummary": "No relevant citations could be found for the selected data.",
  "citationUrls": []
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

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
        url: `https://example${i}.com`,
        title: `Example ${i}`,
        snippet: `Citation ${i}`,
        domain: `example${i}.com`,
      }));

      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Multiple citations found for the selected data.",
  "citationUrls": ${JSON.stringify(citations)}
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.length).toBe(10);
    });
  });

  describe("buildSearchContext", () => {
    it("should build search context from selected cells", async () => {
      const expectedContext = `${mockDocumentTitle} - Company: Apple Inc, Industry: Technology`;

      const mockResponse = {
        content: `\`\`\`json
{"textSummary": "Test", "citationUrls": []}
\`\`\``,
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(HumanMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining(expectedContext)
      );
    });

    it("should handle duplicate values in selected cells", async () => {
      const duplicateCells = [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 0 },
      ];

      const mockResponse = {
        content: `\`\`\`json
{"textSummary": "Test", "citationUrls": []}
\`\`\``,
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        duplicateCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(HumanMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("Company: Apple Inc")
      );
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
        content: `\`\`\`json
{"textSummary": "Test", "citationUrls": []}
\`\`\``,
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        selectedCellsWithEmpty,
        cellsWithEmpty,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(HumanMessageSpy).toHaveBeenCalled();
    });

    it("should truncate long contexts", async () => {
      const longValue = "A".repeat(200);
      const longCellsData = [[longValue, "Technology"]];
      const longSelectedCells = [{ rowIndex: 0, colIndex: 0 }];

      const mockResponse = {
        content: `\`\`\`json
{"textSummary": "Test", "citationUrls": []}
\`\`\``,
      };
      mockInvoke.mockResolvedValueOnce(mockResponse);

      await findCitationsModule.default(
        longSelectedCells,
        longCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(HumanMessageSpy).toHaveBeenCalled();
    });
  });

  describe("structured output parsing", () => {
    it("should parse valid JSON with citations", async () => {
      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Apple Inc is a leading technology company",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc - Official Website",
      "snippet": "Apple is a leading technology company",
      "domain": "apple.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

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
        content: "Invalid JSON response",
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

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

    it("should extract citations with proper URL validation", async () => {
      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Technology companies information",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc",
      "snippet": "Apple is a technology company",
      "domain": "apple.com"
    },
    {
      "url": "invalid-url",
      "title": "Invalid",
      "snippet": "This should be filtered out",
      "domain": "invalid.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

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
        content: `\`\`\`json
{
  "textSummary": "Microsoft is a software company",
  "citationUrls": [
    {
      "url": "https://www.microsoft.com",
      "title": "Microsoft",
      "snippet": "Microsoft is a software company",
      "domain": "microsoft.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

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

  describe("citation processing", () => {
    it("should remove duplicate citations by URL", async () => {
      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Technology companies information",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc",
      "snippet": "Apple info 1",
      "domain": "apple.com"
    },
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc - Different Title",
      "snippet": "Apple info 2",
      "domain": "apple.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.length).toBe(1);
    });

    it("should sort citations by relevance score", async () => {
      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Multiple technology companies information",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc",
      "snippet": "Apple info",
      "domain": "apple.com"
    },
    {
      "url": "https://www.microsoft.com",
      "title": "Microsoft",
      "snippet": "Microsoft info",
      "domain": "microsoft.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations?.length).toBe(2);
      expect(result.citations?.every((c) => c.relevanceScore === 0.8)).toBe(
        true
      );
    });
  });

  describe("rate limiting", () => {
    it("should apply rate limiting delay", async () => {
      const startTime = Date.now();

      const mockResponse = {
        content: `\`\`\`json
{"textSummary": "Test", "citationUrls": []}
\`\`\``,
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

      mockInvoke.mockResolvedValue(mockResponse);

      await Promise.all([promise1, promise2]);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThan(500);
    });
  });

  describe("Citation interface", () => {
    it("should return citations with all required fields", async () => {
      const mockResponse = {
        content: `\`\`\`json
{
  "textSummary": "Apple is a leading technology company",
  "citationUrls": [
    {
      "url": "https://www.apple.com",
      "title": "Apple Inc - Official Website",
      "snippet": "Apple is a leading technology company",
      "domain": "apple.com"
    }
  ]
}
\`\`\``,
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      expect(result.citations).toBeDefined();
      result.citations?.forEach((citation) => {
        expect(citation).toHaveProperty("id");
        expect(citation).toHaveProperty("title");
        expect(citation).toHaveProperty("url");
        expect(citation).toHaveProperty("snippet");
        expect(citation).toHaveProperty("domain");
        expect(citation).toHaveProperty("relevanceScore");
        expect(typeof citation.id).toBe("string");
        expect(typeof citation.title).toBe("string");
        expect(typeof citation.url).toBe("string");
        expect(typeof citation.snippet).toBe("string");
        expect(typeof citation.domain).toBe("string");
        expect(typeof citation.relevanceScore).toBe("number");
      });
    });
  });
});
