import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { createYSweetDocument } from "@/components/live-table/actions/create-y-sweet-document";

// Environment stubs
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test_anon_key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_API_URL", "http://localhost:54321");
vi.stubEnv("Y_SWEET_CONNECTION_STRING", "ws://localhost:8080");

// Mock next/headers
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => mockCookieStore),
}));

// Mock @supabase/ssr
const mockSupabaseFrom = vi.fn();
const mockSupabaseInsert = vi.fn();
const mockSupabaseSelect = vi.fn();
const mockSupabaseSingle = vi.fn();

const mockSupabaseClient = {
  from: mockSupabaseFrom,
};
mockSupabaseFrom.mockReturnValue({
  insert: mockSupabaseInsert,
});
mockSupabaseInsert.mockReturnValue({
  select: mockSupabaseSelect,
});
mockSupabaseSelect.mockReturnValue({
  single: mockSupabaseSingle,
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

// Mock AI suggestions
// eslint-disable-next-line no-var
var mockGenerateTableInitialization: ReturnType<typeof vi.fn>;
vi.mock("@/app/(main)/document/new/ai-suggestions", () => {
  const actualMock = vi.fn();
  mockGenerateTableInitialization = actualMock;
  return {
    generateTableInitialization: actualMock,
  };
});

// Mock Y-Sweet SDK
// eslint-disable-next-line no-var
var mockDocumentManagerCreateDoc: ReturnType<typeof vi.fn>;
// eslint-disable-next-line no-var
var mockDocumentManagerGetClientToken: ReturnType<typeof vi.fn>;
// eslint-disable-next-line no-var
var mockDocConnectionUpdateDoc: ReturnType<typeof vi.fn>;

vi.mock("@y-sweet/sdk", () => {
  const actualCreateDocMock = vi.fn();
  const actualGetClientTokenMock = vi.fn();
  const actualUpdateDocMock = vi.fn();

  mockDocumentManagerCreateDoc = actualCreateDocMock;
  mockDocumentManagerGetClientToken = actualGetClientTokenMock;
  mockDocConnectionUpdateDoc = actualUpdateDocMock;

  return {
    DocumentManager: vi.fn().mockImplementation(() => ({
      createDoc: actualCreateDocMock,
      getClientToken: actualGetClientTokenMock,
    })),
    DocConnection: vi.fn().mockImplementation(() => ({
      updateDoc: actualUpdateDocMock,
    })),
  };
});

// Mock Yjs
const mockYDocInstanceGetArrayReturn = {
  push: vi.fn(),
  insert: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  length: 0,
  toArray: vi.fn(() => []),
};
const mockYDocInstanceGetXmlFragmentReturn = {
  insert: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
  length: 0,
  toString: vi.fn(() => ""),
};
const mockYDocInstanceGetMapReturn = {
  set: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  has: vi.fn(() => false),
  size: 0,
  toJSON: vi.fn(() => ({})),
  clear: vi.fn(),
};

const mockYDocInstance = {
  getArray: vi.fn(() => mockYDocInstanceGetArrayReturn),
  getXmlFragment: vi.fn(() => mockYDocInstanceGetXmlFragmentReturn),
  getMap: vi.fn(() => mockYDocInstanceGetMapReturn),
  transact: vi.fn((fn) => fn()),
};

vi.mock("yjs", async () => {
  const actualYjs = await vi.importActual<typeof Y>("yjs");
  return {
    ...actualYjs,
    Doc: vi.fn(() => {
      mockYDocInstance.getArray.mockReturnValue(mockYDocInstanceGetArrayReturn);
      mockYDocInstance.getXmlFragment.mockReturnValue(
        mockYDocInstanceGetXmlFragmentReturn
      );
      mockYDocInstance.getMap.mockReturnValue(mockYDocInstanceGetMapReturn);
      return mockYDocInstance;
    }),
    Map: vi.fn(() => mockYDocInstanceGetMapReturn),
    encodeStateAsUpdate: vi.fn(() => new Uint8Array([1, 2, 3])),
    XmlElement: actualYjs.XmlElement,
    XmlText: actualYjs.XmlText,
    Array: actualYjs.Array,
  };
});

describe("Y-Sweet Document Creation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "test_anon_key",
      NEXT_PUBLIC_SUPABASE_API_URL: "http://localhost:54321",
      Y_SWEET_CONNECTION_STRING: "ws://localhost:8080",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
      SUPABASE_SERVICE_ROLE_KEY: "test_supabase_service_role_key",
    };

    // Reset all mock functions
    mockYDocInstance.getArray.mockClear();
    mockYDocInstance.getXmlFragment.mockClear();
    mockYDocInstance.getMap.mockClear();
    mockYDocInstance.transact.mockClear();

    mockYDocInstanceGetArrayReturn.push.mockClear();
    mockYDocInstanceGetXmlFragmentReturn.insert.mockClear();
    mockYDocInstanceGetMapReturn.set.mockClear();

    mockYDocInstance.getArray.mockReturnValue(mockYDocInstanceGetArrayReturn);
    mockYDocInstance.getXmlFragment.mockReturnValue(
      mockYDocInstanceGetXmlFragmentReturn
    );
    mockYDocInstance.getMap.mockReturnValue(mockYDocInstanceGetMapReturn);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createYSweetDocument", () => {
    it("should successfully create a text document", async () => {
      const formData = new FormData();
      formData.append("name", "test-doc");
      formData.append("description", "A test document");
      formData.append("docType", "text");

      const mockSupabaseDocId = "supabase-doc-uuid";
      const mockYSweetId = "ysweet-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId, ysweet_id: mockYSweetId },
        error: null,
      });

      mockDocumentManagerCreateDoc.mockResolvedValueOnce(undefined);
      mockDocumentManagerGetClientToken.mockResolvedValueOnce({
        url: "ws://localhost:8080",
        baseUrl: "http://localhost:8080",
        token: "test-token",
      });
      mockDocConnectionUpdateDoc.mockResolvedValueOnce(undefined);

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.createdDocumentData).toEqual({
          id: mockSupabaseDocId,
          title: "test-doc",
        });
      }
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("document");
      expect(mockDocumentManagerCreateDoc).toHaveBeenCalledWith(mockYSweetId);
      expect(mockYDocInstance.getXmlFragment).toHaveBeenCalledWith("default");
    });

    it("should successfully create a table document with AI suggestions", async () => {
      const formData = new FormData();
      formData.append("name", "Employee Table");
      formData.append("description", "Employee directory");
      formData.append("docType", "table");

      const mockSupabaseDocId = "supabase-doc-uuid";
      const mockYSweetId = "ysweet-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId, ysweet_id: mockYSweetId },
        error: null,
      });

      const mockAiSuggestions = {
        primaryColumnName: "Employee ID",
        secondaryColumnName: "Full Name",
        sampleRow: {
          primaryValue: "EMP001",
          secondaryValue: "John Smith",
        },
      };
      mockGenerateTableInitialization.mockResolvedValueOnce(mockAiSuggestions);

      mockDocumentManagerCreateDoc.mockResolvedValueOnce(undefined);
      mockDocumentManagerGetClientToken.mockResolvedValueOnce({
        url: "ws://localhost:8080",
        baseUrl: "http://localhost:8080",
        token: "test-token",
      });
      mockDocConnectionUpdateDoc.mockResolvedValueOnce(undefined);

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(true);
        expect(result.aiSuggestionsError).toBeUndefined();
      }
      expect(mockGenerateTableInitialization).toHaveBeenCalledWith(
        "Employee Table",
        "Employee directory"
      );
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("metaData");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("columnDefinitions");
      expect(mockYDocInstance.getMap).toHaveBeenCalledWith("rowData");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("columnOrder");
      expect(mockYDocInstance.getArray).toHaveBeenCalledWith("rowOrder");
    });

    it("should return validation errors for invalid form data", async () => {
      const formData = new FormData();
      formData.append("name", " ");
      formData.append("docType", "invalid-type");

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?.name).toContain("Document name cannot be empty.");
        expect(result.errors?.docType).toContain(
          "Invalid document type selected."
        );
      }
      expect(mockSupabaseInsert).not.toHaveBeenCalled();
      expect(mockDocumentManagerCreateDoc).not.toHaveBeenCalled();
    });

    it("should return error if Y_SWEET_CONNECTION_STRING is not set", async () => {
      delete process.env.Y_SWEET_CONNECTION_STRING;

      const formData = new FormData();
      formData.append("name", "test-doc");
      formData.append("docType", "text");

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?._form).toContain("Server configuration error.");
      }
    });

    it("should return error if Supabase document creation fails", async () => {
      const formData = new FormData();
      formData.append("name", "valid-doc-name");
      formData.append("docType", "table");

      const supabaseError = { message: "Supabase insert failed" };
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: supabaseError,
      });

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBeUndefined();
      if (!result.success) {
        expect(result.errors?._form).toContain(
          `Failed to create document record: ${supabaseError.message}`
        );
      }
      expect(mockDocumentManagerCreateDoc).not.toHaveBeenCalled();
    });

    it("should return error if Y-Sweet document creation fails", async () => {
      const formData = new FormData();
      formData.append("name", "test-doc");
      formData.append("docType", "text");

      const mockSupabaseDocId = "supabase-doc-uuid";
      const mockYSweetId = "ysweet-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId, ysweet_id: mockYSweetId },
        error: null,
      });

      const ySweetError = "Y-Sweet createDoc failed";
      mockDocumentManagerCreateDoc.mockRejectedValueOnce(
        new Error(ySweetError)
      );

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors?._form).toContain(
          `Could not create document: ${ySweetError}`
        );
      }
    });

    it("should handle AI suggestions failure gracefully", async () => {
      const formData = new FormData();
      formData.append("name", "AI Test Table");
      formData.append("docType", "table");

      const mockSupabaseDocId = "supabase-doc-uuid";
      const mockYSweetId = "ysweet-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId, ysweet_id: mockYSweetId },
        error: null,
      });

      mockGenerateTableInitialization.mockResolvedValueOnce({
        error: "AI service unavailable",
      });

      mockDocumentManagerCreateDoc.mockResolvedValueOnce(undefined);
      mockDocumentManagerGetClientToken.mockResolvedValueOnce({
        url: "ws://localhost:8080",
        baseUrl: "http://localhost:8080",
        token: "test-token",
      });
      mockDocConnectionUpdateDoc.mockResolvedValueOnce(undefined);

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.aiSuggestionsUsed).toBe(false);
        expect(result.aiSuggestionsError).toBe("AI service unavailable");
      }
    });

    it("should return error if document initialization fails", async () => {
      const formData = new FormData();
      formData.append("name", "test-doc");
      formData.append("docType", "text");

      const mockSupabaseDocId = "supabase-doc-uuid";
      const mockYSweetId = "ysweet-doc-uuid";
      mockSupabaseSingle.mockResolvedValueOnce({
        data: { id: mockSupabaseDocId, ysweet_id: mockYSweetId },
        error: null,
      });

      mockDocumentManagerCreateDoc.mockResolvedValueOnce(undefined);
      mockDocumentManagerGetClientToken.mockResolvedValueOnce({
        url: "ws://localhost:8080",
        baseUrl: "http://localhost:8080",
        token: "test-token",
      });

      const initError = "Failed to initialize document";
      mockDocConnectionUpdateDoc.mockRejectedValueOnce(new Error(initError));

      const result = await createYSweetDocument(null, formData);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors?._form).toContain(
          `Created document, but failed to set default content: ${initError}`
        );
      }
    });
  });
});
