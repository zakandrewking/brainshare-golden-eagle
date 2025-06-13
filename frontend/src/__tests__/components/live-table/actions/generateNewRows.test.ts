import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock @langchain/openai and get a handle on the mock constructor and methods
const mockInvoke = vi.fn();
const mockWithStructuredOutput = vi.fn(() => ({ invoke: mockInvoke }));
const mockChatOpenAIInstance = {
  withStructuredOutput: mockWithStructuredOutput,
  invoke: mockInvoke, // Fallback for direct invoke if withStructuredOutput isn't used as expected
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

// Dynamically import the module to be tested
let generateNewRowsModule: typeof import("@/components/live-table/actions/generateNewRows");

describe("generateNewRows", () => {
  const mockTableData = [
    { Header1: "A1", Header2: "B1" },
    { Header1: "A2", Header2: "B2" },
  ];
  const mockHeaders = ["Header1", "Header2"];

  beforeEach(async () => {
    vi.clearAllMocks();
    generateNewRowsModule = await import(
      "@/components/live-table/actions/generateNewRows"
    );
  });

  it("should call the LLM with correct prompts and process generated rows (string[][]) into Record<string,string>[]", async () => {
    const numRowsToGenerate = 2;
    const documentTitle = "Test Document";
    const documentDescription = "Test Description";
    // LLM now returns string[][]
    const mockLlmGeneratedRows: string[][] = [
      ["A3", "B3"],
      ["A4", "B4"],
    ];
    // The action should map this to Record<string, string>[]
    const expectedMappedRows: Record<string, string>[] = [
      { Header1: "A3", Header2: "B3" },
      { Header1: "A4", Header2: "B4" },
    ];
    mockInvoke.mockResolvedValueOnce({ newRows: mockLlmGeneratedRows });

    const expectedSystemPromptStart = `You are an AI assistant specializing in data generation and fact-checking for table population.`;
    const expectedUserPromptStart = `Existing table data:
${JSON.stringify(mockTableData, null, 2)}

Table Headers (in order): ${JSON.stringify(mockHeaders)}`;

    const result = await generateNewRowsModule.default(
      mockTableData,
      mockHeaders,
      numRowsToGenerate,
      documentTitle,
      documentDescription
    );

    expect(MockChatOpenAIClass).toHaveBeenCalledTimes(1);
    expect(mockWithStructuredOutput).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    expect(SystemMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedSystemPromptStart)
    );
    expect(HumanMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(expectedUserPromptStart)
    );

    expect(result).toEqual({ newRows: expectedMappedRows });
  });

  it("should return an empty array if numRowsToGenerate is 0", async () => {
    const result = await generateNewRowsModule.default(
      mockTableData,
      mockHeaders,
      0,
      "Test Document",
      "Test Description"
    );
    expect(result).toEqual({ newRows: [] });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should return an error if headers are empty", async () => {
    const result = await generateNewRowsModule.default(
      mockTableData,
      [],
      1,
      "Test Document",
      "Test Description"
    );
    expect(result.error).toBe("Cannot generate rows without headers.");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should handle LLM API errors gracefully", async () => {
    const numRowsToGenerate = 1;
    const errorMessage = "LLM Error";
    mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

    const result = await generateNewRowsModule.default(
      mockTableData,
      mockHeaders,
      numRowsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(`Failed to generate new rows: ${errorMessage}`);
    expect(result.newRows).toBeUndefined();
  });

  it("should warn if LLM returns a different number of rows than requested but still map and return them", async () => {
    const numRowsToGenerate = 3;
    const mockLlmGeneratedRows: string[][] = [["A3", "B3"]]; // LLM returns 1 row as string[]
    const expectedMappedRows: Record<string, string>[] = [
      { Header1: "A3", Header2: "B3" },
    ];

    mockInvoke.mockResolvedValueOnce({ newRows: mockLlmGeneratedRows });
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = await generateNewRowsModule.default(
      mockTableData,
      mockHeaders,
      numRowsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `LLM was asked to generate ${numRowsToGenerate} rows but returned ${mockLlmGeneratedRows.length} rows. Using the returned rows.`
    );
    expect(result).toEqual({ newRows: expectedMappedRows });
    consoleWarnSpy.mockRestore();
  });
});
