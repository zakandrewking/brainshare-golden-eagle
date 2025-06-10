import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockInvoke = vi.fn();
const mockWithStructuredOutput = vi.fn(() => ({ invoke: mockInvoke }));
const mockChatOpenAIInstance = {
  withStructuredOutput: mockWithStructuredOutput,
  invoke: mockInvoke, // For models that don't use withStructuredOutput directly
};
const MockChatOpenAIClass = vi.fn(() => mockChatOpenAIInstance);

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAIClass,
}));

// Mock @langchain/core/messages to spy on constructor calls
let SystemMessageSpy: ReturnType<typeof vi.fn>;
let HumanMessageSpy: ReturnType<typeof vi.fn>;
let ActualMessages: typeof import("@langchain/core/messages");

vi.mock("@langchain/core/messages", async () => {
  ActualMessages = await vi.importActual<
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

// Declare actionsModule here, it will be initialized in beforeEach
let generateSelectedCellsSuggestionsModule: typeof import("@/components/live-table/actions/generateSelectedCellsSuggestions");

describe("generateSelectedCellsSuggestions", () => {
  const mockTableData = [
    { Column1: "A1", Column2: "B1", Column3: "C1" },
    { Column1: "A2", Column2: "B2", Column3: "C2" },
    { Column1: "A3", Column2: "B3", Column3: "C3" },
  ];

  const mockHeaders = ["Column1", "Column2", "Column3"];

  const mockSelectedCells = [
    { rowIndex: 0, colIndex: 0 },
    { rowIndex: 0, colIndex: 1 },
    { rowIndex: 1, colIndex: 0 },
    { rowIndex: 1, colIndex: 1 },
  ];

  const mockSelectedCellsData = [
    ["A1", "B1"],
    ["A2", "B2"],
  ];

  const mockDocumentTitle = "Test Document";
  const mockDocumentDescription = "A test document for testing purposes";

  const mockSuggestions = [
    { rowIndex: 0, colIndex: 0, suggestion: "New A1" },
    { rowIndex: 0, colIndex: 1, suggestion: "New B1" },
    { rowIndex: 1, colIndex: 0, suggestion: "New A2" },
    { rowIndex: 1, colIndex: 1, suggestion: "New B2" },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import the module to be tested here
    // This ensures mocks are fully set up before the module code runs
    generateSelectedCellsSuggestionsModule = await import(
      "@/components/live-table/actions/generateSelectedCellsSuggestions"
    );
  });

  it("should call the LLM with correct prompts and process suggestions", async () => {
    // Arrange
    mockInvoke.mockResolvedValueOnce({ suggestions: mockSuggestions });

    const expectedSystemPromptStart = `You are an AI assistant specializing in data enrichment for tables.`;
    const expectedUserPromptStart = `Table Data:
${JSON.stringify(mockTableData, null, 2)}

Headers: ${JSON.stringify(mockHeaders)}
Selected Cells: ${JSON.stringify(mockSelectedCells)}
Current Values: ${JSON.stringify(mockSelectedCellsData)}
`;

    // Act
    const result = await generateSelectedCellsSuggestionsModule.default(
      mockTableData,
      mockHeaders,
      mockSelectedCells,
      mockSelectedCellsData,
      mockDocumentTitle,
      mockDocumentDescription
    );

    // Assert
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    // Check that SystemMessage and HumanMessage were instantiated with the correct content
    expect(SystemMessageSpy).toHaveBeenCalledTimes(1);
    expect(SystemMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedSystemPromptStart)
    );

    expect(HumanMessageSpy).toHaveBeenCalledTimes(1);
    expect(HumanMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedUserPromptStart)
    );

    // Verify the actual objects passed to invoke
    const invokeCallArgs = mockInvoke.mock.calls[0][0];
    expect(invokeCallArgs).toHaveLength(2);
    expect(invokeCallArgs[0]).toBeInstanceOf(ActualMessages.SystemMessage);
    expect(invokeCallArgs[0].content).toEqual(
      expect.stringContaining(expectedSystemPromptStart)
    );
    expect(invokeCallArgs[1]).toBeInstanceOf(ActualMessages.HumanMessage);
    expect(invokeCallArgs[1].content).toEqual(
      expect.stringContaining(expectedUserPromptStart)
    );

    expect(result).toEqual({ suggestions: mockSuggestions });
  });

  it("should handle the case with no cells selected", async () => {
    // Act
    const result = await generateSelectedCellsSuggestionsModule.default(
      mockTableData,
      mockHeaders,
      [], // Empty selection
      [],
      mockDocumentTitle,
      mockDocumentDescription
    );

    // Assert
    expect(result.error).toBe("No cells selected.");
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(SystemMessageSpy).not.toHaveBeenCalled();
    expect(HumanMessageSpy).not.toHaveBeenCalled();
  });

  it("should handle the case when the server action fails", async () => {
    // Arrange
    const errorMessage = "LLM API Error";
    mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

    const expectedSystemPromptStart = `You are an AI assistant specializing in data enrichment for tables.`;
    const expectedUserPromptStart = `Table Data:
${JSON.stringify(mockTableData, null, 2)}

Headers: ${JSON.stringify(mockHeaders)}
Selected Cells: ${JSON.stringify(mockSelectedCells)}
Current Values: ${JSON.stringify(mockSelectedCellsData)}
`;

    // Act
    const result = await generateSelectedCellsSuggestionsModule.default(
      mockTableData,
      mockHeaders,
      mockSelectedCells,
      mockSelectedCellsData,
      mockDocumentTitle,
      mockDocumentDescription
    );

    // Assert
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    expect(SystemMessageSpy).toHaveBeenCalledTimes(1);
    expect(SystemMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedSystemPromptStart)
    );
    expect(HumanMessageSpy).toHaveBeenCalledTimes(1);
    expect(HumanMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedUserPromptStart)
    );

    const invokeCallArgs = mockInvoke.mock.calls[0][0];
    expect(invokeCallArgs[0].content).toEqual(
      expect.stringContaining(expectedSystemPromptStart)
    );
    expect(invokeCallArgs[1].content).toEqual(
      expect.stringContaining(expectedUserPromptStart)
    );

    expect(result.error).toBe(
      `Failed to generate suggestions: ${errorMessage}`
    );
  });
});
