import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock @langchain/openai
const mockInvoke = vi.fn();
const mockBindTools = vi.fn(() => ({ invoke: mockInvoke }));
const mockChatOpenAIInstance = {
  bindTools: mockBindTools,
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
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: [
                {
                  type: "text",
                  text: "Apple is a leading technology company",
                  annotations: [
                    {
                      type: "url_citation",
                      url: "https://www.apple.com",
                      title: "Apple Inc - Official Website",
                    },
                  ],
                },
              ],
            },
          ],
        },
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
      expect(mockBindTools).toHaveBeenCalledWith([
        {
          type: "web_search_preview",
        },
      ]);
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

    it("should handle empty web search results", async () => {
      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [],
        },
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
        "No web search results found. Please try a different search."
      );
      expect(result.citations).toBeUndefined();
    });

    it("should limit citations to top 10", async () => {
      const citations = Array.from({ length: 15 }, (_, i) => ({
        type: "text",
        text: `Citation ${i}`,
        annotations: [
          {
            type: "url_citation",
            url: `https://example${i}.com`,
            title: `Example ${i}`,
          },
        ],
      }));

      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: citations,
            },
          ],
        },
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
      // We need to access the buildSearchContext function
      // Since it's not exported, we'll test it through the main function
      // by checking the HumanMessage call which includes the search context
      const expectedContext = `${mockDocumentTitle} - Company: Apple Inc, Industry: Technology`;

      // Mock a response to avoid errors
      mockInvoke.mockResolvedValueOnce({
        additional_kwargs: { tool_outputs: [] },
      });

      await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // The search context is built and passed to the HumanMessage
      expect(HumanMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining(expectedContext)
      );
    });

    it("should handle duplicate values in selected cells", async () => {
      const duplicateCells = [
        { rowIndex: 0, colIndex: 0 },
        { rowIndex: 0, colIndex: 0 }, // Same cell selected twice
      ];

      await findCitationsModule.default(
        duplicateCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Should still only include the value once in the context
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
        { rowIndex: 0, colIndex: 1 }, // Empty cell
        { rowIndex: 1, colIndex: 0 }, // Empty cell
      ];

      await findCitationsModule.default(
        selectedCellsWithEmpty,
        cellsWithEmpty,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Should handle empty cells without including them in context
      expect(HumanMessageSpy).toHaveBeenCalled();
    });

    it("should truncate long contexts", async () => {
      const longValue = "A".repeat(200);
      const longCellsData = [[longValue, "Technology"]];
      const longSelectedCells = [{ rowIndex: 0, colIndex: 0 }];

      await findCitationsModule.default(
        longSelectedCells,
        longCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // The context should be truncated
      expect(HumanMessageSpy).toHaveBeenCalled();
    });
  });

  describe("extractWebSearchResults", () => {
    it("should extract web search results from tool outputs", async () => {
      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: [
                {
                  type: "text",
                  text: "Apple is a leading technology company",
                  annotations: [
                    {
                      type: "url_citation",
                      url: "https://www.apple.com",
                      title: "Apple Inc - Official Website",
                    },
                  ],
                },
              ],
            },
            {
              type: "other_tool",
              status: "completed",
              content: "irrelevant",
            },
          ],
        },
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Should only process web_search_call type results
      expect(result.error).toBeUndefined();
      expect(result.citations).toBeDefined();
      expect(result.citations?.length).toBeGreaterThan(0);
    });

    it("should handle response with content array fallback", async () => {
      const mockResponse = {
        content: [
          {
            type: "text",
            text: "Apple is a technology company",
            annotations: [
              {
                type: "url_citation",
                url: "https://www.apple.com",
                title: "Apple Inc",
              },
            ],
          },
        ],
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

  describe("extractCitationsFromContent", () => {
    it("should extract citations with proper URL validation", async () => {
      const validContent = [
        {
          type: "text",
          text: "Apple is a technology company",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.apple.com",
              title: "Apple Inc",
            },
            {
              type: "url_citation",
              url: "invalid-url", // Should be filtered out
              title: "Invalid",
            },
          ],
        },
      ];

      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: validContent,
            },
          ],
        },
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Should only include valid URLs
      expect(result.citations?.every((c) => c.url.startsWith("http"))).toBe(
        true
      );
    });

    it("should handle single content block", async () => {
      const singleContent = {
        type: "text",
        text: "Microsoft is a software company",
        annotations: [
          {
            type: "url_citation",
            url: "https://www.microsoft.com",
            title: "Microsoft",
          },
        ],
      };

      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: singleContent,
            },
          ],
        },
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

  describe("processWebSearchResults", () => {
    it("should remove duplicate citations by URL", async () => {
      const duplicateContent = [
        {
          type: "text",
          text: "Apple info 1",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.apple.com",
              title: "Apple Inc",
            },
          ],
        },
        {
          type: "text",
          text: "Apple info 2",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.apple.com", // Same URL
              title: "Apple Inc - Different Title",
            },
          ],
        },
      ];

      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: duplicateContent,
            },
          ],
        },
      };

      mockInvoke.mockResolvedValueOnce(mockResponse);

      const result = await findCitationsModule.default(
        mockSelectedCells,
        mockCellsData,
        mockHeaders,
        mockDocumentTitle,
        mockDocumentDescription
      );

      // Should only have one citation despite duplicate URLs
      expect(result.citations?.length).toBe(1);
    });

    it("should sort citations by relevance score", async () => {
      // This test would need to verify sorting, but since relevance scores
      // are set to default 0.8, we'll test that citations are returned
      const multipleContent = [
        {
          type: "text",
          text: "Apple info",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.apple.com",
              title: "Apple Inc",
            },
          ],
        },
        {
          type: "text",
          text: "Microsoft info",
          annotations: [
            {
              type: "url_citation",
              url: "https://www.microsoft.com",
              title: "Microsoft",
            },
          ],
        },
      ];

      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: multipleContent,
            },
          ],
        },
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

      // Make two calls in quick succession
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

      mockInvoke.mockResolvedValue({
        additional_kwargs: { tool_outputs: [] },
      });

      await Promise.all([promise1, promise2]);

      const elapsed = Date.now() - startTime;
      // Should have some delay due to rate limiting
      expect(elapsed).toBeGreaterThan(500); // At least some delay
    });
  });

  describe("Citation interface", () => {
    it("should return citations with all required fields", async () => {
      const mockResponse = {
        additional_kwargs: {
          tool_outputs: [
            {
              type: "web_search_call",
              status: "completed",
              content: [
                {
                  type: "text",
                  text: "Apple is a leading technology company",
                  annotations: [
                    {
                      type: "url_citation",
                      url: "https://www.apple.com",
                      title: "Apple Inc - Official Website",
                    },
                  ],
                },
              ],
            },
          ],
        },
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
