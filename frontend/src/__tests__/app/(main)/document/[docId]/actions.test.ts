import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { deleteLiveblocksRoom } from "@/app/(main)/create-room/actions";
import {
  deleteDocument,
  getDocumentById,
  updateDocument,
} from "@/app/(main)/document/[docId]/actions";

const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

vi.mock("@/app/(main)/create-room/actions", () => ({
  deleteLiveblocksRoom: vi.fn(),
}));

describe("Document Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDocumentById", () => {
    it("should return document data when successful", async () => {
      const mockDocument = {
        id: "test-doc-123",
        title: "Test Document",
        liveblocks_id: "test-room-123"
      };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          }),
        }),
      });

      const result = await getDocumentById("test-doc-123");

      expect(result).toEqual(mockDocument);
      expect(mockSupabase.from).toHaveBeenCalledWith("document");
    });

    it("should throw error when database query fails", async () => {
      const mockError = { message: "Database error" };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      await expect(getDocumentById("test-doc-123")).rejects.toThrow(
        "Failed to fetch document: Database error"
      );
    });
  });

  describe("deleteDocument", () => {
    const mockDocument = {
      id: "test-doc-123",
      title: "Test Document",
      liveblocks_id: "test-room-123",
    };

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          }),
        }),
      });
    });

    it("should return success when both database and Liveblocks deletion are successful", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          }),
        }),
      }).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      vi.mocked(deleteLiveblocksRoom).mockResolvedValue({ success: true });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({ success: true });
      expect(mockSupabase.from).toHaveBeenCalledWith("document");
      expect(vi.mocked(deleteLiveblocksRoom)).toHaveBeenCalledWith("test-room-123");
    });

    it("should return error when database deletion fails", async () => {
      const mockError = { message: "Database error" };

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          }),
        }),
      }).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({
        error: "Failed to delete document: Database error",
      });
      expect(vi.mocked(deleteLiveblocksRoom)).not.toHaveBeenCalled();
    });

    it("should return partial success when database deletion succeeds but Liveblocks deletion fails", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockDocument,
              error: null,
            }),
          }),
        }),
      }).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      vi.mocked(deleteLiveblocksRoom).mockResolvedValue({
        success: false,
        error: "Liveblocks error"
      });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({
        error: "Document deleted but failed to clean up associated room: Liveblocks error",
      });
      expect(vi.mocked(deleteLiveblocksRoom)).toHaveBeenCalledWith("test-room-123");
    });

    it("should return error when getDocumentById fails", async () => {
      const mockError = { message: "Document not found" };

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({
        error: "Failed to delete document: Failed to fetch document: Document not found",
      });
      expect(vi.mocked(deleteLiveblocksRoom)).not.toHaveBeenCalled();
    });

    it("should return error when an exception is thrown", async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({
        error: "Failed to delete document: Network error",
      });
    });

    it("should return generic error when unknown error occurs", async () => {
      mockSupabase.from.mockImplementation(() => {
        throw "Unknown error";
      });

      const result = await deleteDocument("test-doc-123");

      expect(result).toEqual({
        error: "An unknown error occurred while deleting the document.",
      });
    });
  });

  describe("updateDocument", () => {
    it("should return success when update is successful", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await updateDocument("test-doc-123", {
        title: "Updated Title",
        description: "Updated Description",
      });

      expect(result).toEqual({ success: true });
      expect(mockSupabase.from).toHaveBeenCalledWith("document");
    });

    it("should return error when database update fails", async () => {
      const mockError = { message: "Database error" };

      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: mockError,
          }),
        }),
      });

      const result = await updateDocument("test-doc-123", {
        title: "Updated Title",
      });

      expect(result).toEqual({
        error: "Failed to update document: Database error",
      });
    });

    it("should handle partial updates (title only)", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await updateDocument("test-doc-123", {
        title: "Updated Title Only",
      });

      expect(result).toEqual({ success: true });
    });

    it("should handle partial updates (description only)", async () => {
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: null,
          }),
        }),
      });

      const result = await updateDocument("test-doc-123", {
        description: "Updated Description Only",
      });

      expect(result).toEqual({ success: true });
    });

    it("should return error when an exception is thrown", async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error("Network error");
      });

      const result = await updateDocument("test-doc-123", {
        title: "Updated Title",
      });

      expect(result).toEqual({
        error: "Failed to update document: Network error",
      });
    });

    it("should return generic error when unknown error occurs", async () => {
      mockSupabase.from.mockImplementation(() => {
        throw "Unknown error";
      });

      const result = await updateDocument("test-doc-123", {
        title: "Updated Title",
      });

      expect(result).toEqual({
        error: "An unknown error occurred while updating the document.",
      });
    });
  });
});
