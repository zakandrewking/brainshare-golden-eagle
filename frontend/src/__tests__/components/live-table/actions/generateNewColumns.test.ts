import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Mock @langchain/openai
const mockInvoke = vi.fn();
const mockWithStructuredOutput = vi.fn(() => ({ invoke: mockInvoke }));
const mockChatOpenAIInstance = {
  withStructuredOutput: mockWithStructuredOutput,
  invoke: mockInvoke,
};
const MockChatOpenAIClass = vi.fn(() => mockChatOpenAIInstance);

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAIClass,
}));

// Mock @langchain/core/messages
// Declare spies in a scope accessible by tests
let SystemMessageSpy: ReturnType<typeof vi.fn>;
let HumanMessageSpy: ReturnType<typeof vi.fn>;

vi.mock("@langchain/core/messages", async () => {
  const ActualMessages = await vi.importActual<
    typeof import("@langchain/core/messages")
  >("@langchain/core/messages");
  // Assign to the higher-scoped spies
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
let generateNewColumnsModule: typeof import("@/components/live-table/actions/generateNewColumns");

describe("generateNewColumns", () => {
  const mockTableData = [
    { Header1: "A1", Header2: "B1" },
    { Header1: "A2", Header2: "B2" },
  ];
  const mockHeaders = ["Header1", "Header2"];

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-import the module before each test to reset its state if it has any
    // and to ensure mocks are correctly applied for each test.
    const importPath = "@/components/live-table/actions/generateNewColumns";
    generateNewColumnsModule = await import(importPath);

    // Reset spies that might be called in module scope or constructors if necessary
    // For SystemMessage and HumanMessage, they are typically instantiated within the function,
    // so clearing mocks of their constructor/class should be sufficient.
  });

  it("should call the LLM with correct prompts and process generated columns", async () => {
    const numColsToGenerate = 1;
    const documentTitle = "Test Document";
    const documentDescription = "Test Description";
    const mockLlmGeneratedColumns = [
      {
        headerName: "NewHeader",
        columnData: ["C1", "C2"],
      },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });

    const expectedSystemPromptStart = `You are an AI assistant specializing in data enrichment and fact-checking for tables.`;
    const expectedUserPromptStart = `Here is the existing table data:
${JSON.stringify(mockTableData, null, 2)}

Existing Headers: ${JSON.stringify(mockHeaders)}`;

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
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
    expect(result).toEqual({ generatedColumns: mockLlmGeneratedColumns });
  });

  it("should return an error if numCols is 0 or negative", async () => {
    let result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      0,
      "Test Document",
      "Test Description"
    );
    expect(result.error).toBe(
      "Number of columns to generate must be positive."
    );
    expect(mockInvoke).not.toHaveBeenCalled();

    result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      -1,
      "Test Document",
      "Test Description"
    );
    expect(result.error).toBe(
      "Number of columns to generate must be positive."
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should handle LLM API errors gracefully", async () => {
    const numColsToGenerate = 1;
    const errorMessage = "LLM Error";
    mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(
      `Failed to generate new columns: ${errorMessage}`
    );
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should return an error if LLM returns columnData with incorrect length", async () => {
    const numColsToGenerate = 1;
    const mockLlmGeneratedColumns = [
      {
        headerName: "BadDataHeader",
        columnData: ["C1"], // Expected 2 rows of data based on mockTableData
      },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });

    const result = await generateNewColumnsModule.default(
      mockTableData, // 2 rows
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(
      `LLM returned column 'BadDataHeader' with 1 data rows, but expected 2.`
    );
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should allow columnData with incorrect length if tableData is empty", async () => {
    const numColsToGenerate = 1;
    const mockLlmGeneratedColumns = [
      {
        headerName: "NewHeaderEmptyTable",
        columnData: ["C1", "C2", "C3"], // Any length is fine if original table is empty
      },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });

    const result = await generateNewColumnsModule.default(
      [], // empty table data
      mockHeaders, // headers can still exist
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBeUndefined();
    expect(result.generatedColumns).toEqual(mockLlmGeneratedColumns);
  });

  it("should return an error if LLM returns a duplicate header (case-insensitive)", async () => {
    const numColsToGenerate = 1;
    const mockLlmGeneratedColumns = [
      {
        headerName: "Header1", // Duplicate of an existing header
        columnData: ["C1", "C2"],
      },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(
      `LLM generated a duplicate or conflicting header: 'Header1'.`
    );
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should return an error if LLM returns multiple new columns with duplicate headers (case-insensitive)", async () => {
    const numColsToGenerate = 2;
    const mockLlmGeneratedColumns = [
      { headerName: "NewUniqueHeader", columnData: ["C1", "C2"] },
      { headerName: "newuniqueheader", columnData: ["D1", "D2"] }, // Duplicate of another new header
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(
      `LLM generated a duplicate or conflicting header: 'newuniqueheader'.`
    );
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should return an error if LLM does not return any columns", async () => {
    const numColsToGenerate = 1;
    mockInvoke.mockResolvedValueOnce({ generatedColumns: [] }); // LLM returns empty array

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe("LLM did not return any generated columns.");
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should return an error if LLM response is missing generatedColumns property", async () => {
    const numColsToGenerate = 1;
    mockInvoke.mockResolvedValueOnce({}); // LLM returns object without generatedColumns

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe("LLM did not return any generated columns.");
    expect(result.generatedColumns).toBeUndefined();
  });

  it("should truncate if LLM returns more columns than requested", async () => {
    const numColsToGenerate = 1;
    const mockLlmGeneratedColumns = [
      { headerName: "Col1", columnData: ["A", "B"] },
      { headerName: "Col2", columnData: ["X", "Y"] },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate,
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      `LLM returned 2 columns but 1 were requested. Truncating.`
    );
    expect(result.generatedColumns).toEqual([mockLlmGeneratedColumns[0]]); // Should take the first one
    consoleWarnSpy.mockRestore();
  });

  it("should use all returned columns if LLM returns fewer or equal columns than requested (and more than 0)", async () => {
    const numColsToGenerate = 2;
    const mockLlmGeneratedColumns = [
      { headerName: "OnlyCol", columnData: ["A", "B"] },
    ];
    mockInvoke.mockResolvedValueOnce({
      generatedColumns: mockLlmGeneratedColumns,
    });
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = await generateNewColumnsModule.default(
      mockTableData,
      mockHeaders,
      numColsToGenerate, // Request 2, LLM returns 1
      "Test Document",
      "Test Description"
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning in this case
    expect(result.generatedColumns).toEqual(mockLlmGeneratedColumns);
    consoleWarnSpy.mockRestore();
  });
});
