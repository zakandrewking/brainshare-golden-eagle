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
  invoke: mockInvoke,
};
const MockChatOpenAIClass = vi.fn(() => mockChatOpenAIInstance);

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: MockChatOpenAIClass,
}));

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

let generateTableInitializationModule: typeof import("@/app/(main)/create-room/ai-suggestions");

describe("generateTableInitialization", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    generateTableInitializationModule = await import(
      "@/app/(main)/create-room/ai-suggestions"
    );
  });

  it("should generate appropriate column names and sample data for a document title", async () => {
    const documentTitle = "Employee Directory";
    const mockResponse = {
      primaryColumnName: "Employee ID",
      secondaryColumnName: "Full Name",
      sampleRow: {
        primaryValue: "EMP001",
        secondaryValue: "John Smith",
      },
    };
    mockInvoke.mockResolvedValueOnce(mockResponse);

    const result = await generateTableInitializationModule.generateTableInitialization(documentTitle);

    expect(MockChatOpenAIClass).toHaveBeenCalledTimes(1);
    expect(mockWithStructuredOutput).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    expect(SystemMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining("You are an AI assistant specializing in table design")
    );
    expect(HumanMessageSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Document Title: "${documentTitle}"`)
    );

    expect(result).toEqual({
      primaryColumnName: "Employee ID",
      secondaryColumnName: "Full Name",
      sampleRow: {
        primaryValue: "EMP001",
        secondaryValue: "John Smith",
      },
    });
  });

  it("should return an error for empty document title", async () => {
    const result = await generateTableInitializationModule.generateTableInitialization("");

    expect(result.error).toBe("Document title is required for generating suggestions.");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should return an error for whitespace-only document title", async () => {
    const result = await generateTableInitializationModule.generateTableInitialization("   ");

    expect(result.error).toBe("Document title is required for generating suggestions.");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("should handle LLM API errors gracefully", async () => {
    const documentTitle = "Project Tasks";
    const errorMessage = "LLM API Error";
    mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

    const result = await generateTableInitializationModule.generateTableInitialization(documentTitle);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result.error).toBe(`Failed to generate table suggestions: ${errorMessage}`);
    expect(result.primaryColumnName).toBeUndefined();
    expect(result.secondaryColumnName).toBeUndefined();
    expect(result.sampleRow).toBeUndefined();
  });

  it("should generate suggestions for different types of document titles", async () => {
    const documentTitle = "Inventory Management";
    const mockResponse = {
      primaryColumnName: "Product SKU",
      secondaryColumnName: "Product Name",
      sampleRow: {
        primaryValue: "SKU-12345",
        secondaryValue: "Wireless Headphones",
      },
    };
    mockInvoke.mockResolvedValueOnce(mockResponse);

    const result = await generateTableInitializationModule.generateTableInitialization(documentTitle);

    expect(result).toEqual({
      primaryColumnName: "Product SKU",
      secondaryColumnName: "Product Name",
      sampleRow: {
        primaryValue: "SKU-12345",
        secondaryValue: "Wireless Headphones",
      },
    });
  });
});
