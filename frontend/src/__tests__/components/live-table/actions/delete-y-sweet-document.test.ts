import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteYSweetDocument,
  getDocumentById,
} from "@/components/live-table/actions/delete-y-sweet-document";

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
const mockSupabaseClient = {
  from: vi.fn(),
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => mockSupabaseClient),
}));

describe("Y-Sweet Document Deletion", () => {
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
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getDocumentById", () => {
    it("should return document data when successful", async () => {
      const mockDocument = {
        id: "test-doc-123",
        title: "Test Document",
        liveblocks_id: "test-room-123",
        ysweet_id: "test-ysweet-123",
        description: "Test description",
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getDocumentById("test-doc-123");

      expect(result).toEqual(mockDocument);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("document");
    });

    it("should throw error when database query fails", async () => {
      const mockError = { message: "Database error" };

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      await expect(getDocumentById("test-doc-123")).rejects.toThrow(
        "Failed to fetch document: Database error"
      );
    });
  });

  describe("deleteYSweetDocument", () => {
    it("should successfully delete a document", async () => {
      const mockDocument = {
        id: "test-doc-123",
        title: "Test Document",
        liveblocks_id: "test-room-123",
        ysweet_id: "test-ysweet-123",
        description: "Test description",
      };

      // Mock getDocumentById call
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      // Mock delete call
      const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockDeleteEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
        });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return error if Y_SWEET_CONNECTION_STRING is not set", async () => {
      delete process.env.Y_SWEET_CONNECTION_STRING;

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Server configuration error.");
    });

    it("should return error if document does not have ysweet_id", async () => {
      const mockDocument = {
        id: "test-doc-123",
        title: "Test Document",
        liveblocks_id: "test-room-123",
        ysweet_id: null,
        description: "Test description",
      };

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Document does not have a Y-Sweet ID.");
    });

    it("should return error when getDocumentById fails", async () => {
      const mockError = { message: "Document not found" };

      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: mockError,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe(
        "Failed to delete document: Failed to fetch document: Document not found"
      );
    });

    it("should return error when database deletion fails", async () => {
      const mockDocument = {
        id: "test-doc-123",
        title: "Test Document",
        liveblocks_id: "test-room-123",
        ysweet_id: "test-ysweet-123",
        description: "Test description",
      };

      // Mock getDocumentById call
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const mockEq = vi.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = vi.fn().mockReturnValue({
        eq: mockEq,
      });

      // Mock delete call with error
      const mockDeleteError = { message: "Deletion failed" };
      const mockDeleteEq = vi
        .fn()
        .mockResolvedValue({ error: mockDeleteError });
      const mockDelete = vi.fn().mockReturnValue({
        eq: mockDeleteEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
        });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Failed to delete document: Deletion failed");
    });

    it("should return generic error when unknown error occurs", async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw "Unknown error";
      });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe(
        "An unknown error occurred while deleting the document."
      );
    });

    it("should handle Error instances properly", async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await deleteYSweetDocument("test-doc-123");

      expect(result.success).toBeUndefined();
      expect(result.error).toBe("Failed to delete document: Network error");
    });
  });
});
