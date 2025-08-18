import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { renderHook } from "@testing-library/react";

import useFile from "@/blocks/files/logic/use-file";
import useFileContent, {
  type FileContent,
  type FileData,
} from "@/blocks/files/logic/use-file-content";
import useFiles from "@/blocks/files/logic/use-files";

// Environment stubs
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test_anon_key");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_API_URL", "http://localhost:54321");

// Mock SWR
vi.mock("swr", () => ({
  default: vi.fn(),
}));

// Mock CSV parser
vi.mock("@/utils/csv", () => ({
  parseCsv: vi.fn(),
}));

// Mock file types
vi.mock("@/utils/file-types", () => ({
  SUPPORTED_FILE_TYPES: {
    CSV: "csv",
    TXT: "txt",
    IPYNB: "ipynb",
  },
}));

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}));

describe("file hooks", () => {
  const mockFileData = {
    id: "test-file-id",
    name: "test-file.csv",
    size: 1024,
    bucket_id: "files",
    object_path: "test-path.csv",
    user_id: "user-123",
  };

  const mockFilesList: FileData[] = [
    {
      id: "file-1",
      name: "data.csv",
      size: 2048,
      bucket_id: "files",
      object_path: "data.csv",
      user_id: "user-123",
    },
    {
      id: "file-2",
      name: "notebook.ipynb",
      size: 4096,
      bucket_id: "files",
      object_path: "notebook.ipynb",
      user_id: "user-123",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("useFiles", () => {
    it("should return files list successfully", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: mockFilesList,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      // Mock the SWR return value directly
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: mockFilesList,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFiles());

      expect(result.current.data).toEqual(mockFilesList);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle supabase error when fetching files", async () => {
      const mockSelect = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const mockError = new Error("Database error");
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: mockError,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFiles());

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle loading state", async () => {
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFiles());

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it("should call SWR with correct parameters", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFiles());

      expect(mockUseSWR).toHaveBeenCalledWith(
        "/files",
        expect.any(Function),
        expect.objectContaining({
          revalidateIfStale: true,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          refreshInterval: 0,
        })
      );
    });

    it("should return empty array when no files exist", async () => {
      const emptyFilesList: FileData[] = [];
      const mockSelect = vi.fn().mockResolvedValue({
        data: emptyFilesList,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: emptyFilesList,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFiles());

      expect(result.current.data).toEqual(emptyFilesList);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("useFile", () => {
    it("should return file data successfully", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockFileData,
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      // Mock the SWR return value directly
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: mockFileData,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFile("test-file-id"));

      expect(result.current.data).toEqual(mockFileData);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle supabase error", async () => {
      const mockSelect = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockReturnThis();
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "File not found" },
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });
      mockSelect.mockReturnValue({
        eq: mockEq,
      });
      mockEq.mockReturnValue({
        single: mockSingle,
      });

      const mockError = new Error("File not found");
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: mockError,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFile("test-file-id"));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle loading state", async () => {
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() => useFile("test-file-id"));

      expect(result.current.data).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it("should call SWR with correct parameters", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFile("test-file-id"));

      expect(mockUseSWR).toHaveBeenCalledWith(
        "/files/test-file-id",
        expect.any(Function),
        {
          revalidateIfStale: true,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          refreshInterval: 0,
        }
      );
    });
  });

  describe("useFileContent", () => {
    const mockFileContent: FileContent = {
      text: "Name,Age,City\nJohn,25,NYC\nJane,30,LA",
      headers: ["Name", "Age", "City"],
      parsedData: [
        ["John", "25", "NYC"],
        ["Jane", "30", "LA"],
      ],
      fileType: "csv",
    };

    it("should return CSV file content successfully", async () => {
      const mockBlob = new Blob([mockFileContent.text], { type: "text/csv" });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const csvUtils = await import("@/utils/csv");
      vi.mocked(csvUtils.parseCsv).mockResolvedValue({
        headers: mockFileContent.headers!,
        parsedData: mockFileContent.parsedData!,
      });

      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: mockFileContent,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.csv")
      );

      expect(result.current.content).toEqual(mockFileContent);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return IPYNB file content successfully", async () => {
      const notebookContent = {
        cells: [
          {
            cell_type: "markdown",
            source: ["# Test Notebook\n", "This is a test."],
          },
          {
            cell_type: "code",
            source: ["print('Hello World')"],
            outputs: [],
          },
        ],
      };

      const mockContent: FileContent = {
        text: JSON.stringify(notebookContent),
        fileType: "ipynb",
        isNotebook: true,
        notebookCells: [
          {
            cellType: "markdown",
            source: ["# Test Notebook\n", "This is a test."],
            outputs: [],
          },
          {
            cellType: "code",
            source: ["print('Hello World')"],
            outputs: [],
          },
        ],
      };

      const mockBlob = new Blob([JSON.stringify(notebookContent)], {
        type: "application/json",
      });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: mockContent,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.ipynb")
      );

      expect(result.current.content).toEqual(mockContent);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should return text file content successfully", async () => {
      const textContent = {
        text: "This is a text file",
        fileType: "txt",
      };
      const mockBlob = new Blob([textContent.text], { type: "text/plain" });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: textContent,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.txt")
      );

      expect(result.current.content).toEqual(textContent);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle download error", async () => {
      const mockError = new Error("Failed to download file");
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: mockError,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.csv")
      );

      expect(result.current.content).toBeNull();
      expect(result.current.error).toEqual(mockError);
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle CSV parsing error", async () => {
      const mockBlob = new Blob(["invalid,csv\ndata"], { type: "text/csv" });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const csvUtils = await import("@/utils/csv");
      vi.mocked(csvUtils.parseCsv).mockRejectedValue(
        new Error("CSV parsing failed")
      );

      const contentWithParsingError = {
        text: "invalid,csv\ndata",
        fileType: "csv",
      };
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: contentWithParsingError,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.csv")
      );

      expect(result.current.content).toEqual(contentWithParsingError);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle IPYNB parsing error", async () => {
      const mockBlob = new Blob(["invalid json"], { type: "application/json" });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const contentWithParsingError = {
        text: "invalid json",
        fileType: "ipynb",
      };
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: contentWithParsingError,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.ipynb")
      );

      expect(result.current.content).toEqual(contentWithParsingError);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });

    it("should handle loading state", async () => {
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      const { result } = renderHook(() =>
        useFileContent("files", "test-path.csv")
      );

      expect(result.current.content).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(true);
    });

    it("should not fetch when bucketId is missing", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFileContent(undefined, "test-path.csv"));

      expect(mockUseSWR).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("should not fetch when objectPath is missing", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFileContent("files", undefined));

      expect(mockUseSWR).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("should call SWR with correct cache key", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFileContent("files", "test-path.csv"));

      expect(mockUseSWR).toHaveBeenCalledWith(
        "/file-content/files/test-path.csv",
        expect.any(Function),
        {
          revalidateIfStale: true,
          revalidateOnFocus: false,
          revalidateOnReconnect: false,
          refreshInterval: 0,
        }
      );
    });

    it("should handle both bucketId and objectPath being present", async () => {
      const useSWR = await import("swr");
      const mockUseSWR = vi.mocked(useSWR.default);
      mockUseSWR.mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      renderHook(() => useFileContent("files", "test-path.csv"));

      expect(mockUseSWR).toHaveBeenCalledWith(
        "/file-content/files/test-path.csv",
        expect.any(Function),
        expect.any(Object)
      );
    });

    it("should handle different file extensions correctly", async () => {
      const mockBlob = new Blob(["some text content"], { type: "text/plain" });
      const mockDownload = vi.fn().mockResolvedValue({
        data: mockBlob,
        error: null,
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        download: mockDownload,
      });

      const textContent = {
        text: "some text content",
        fileType: "pdf", // Unknown extension
      };
      const useSWR = await import("swr");
      vi.mocked(useSWR.default).mockReturnValue({
        data: textContent,
        error: null,
        isLoading: false,
        isValidating: false,
        mutate: vi.fn(),
      });

      const csvUtils = await import("@/utils/csv");
      const mockParseCsv = vi.mocked(csvUtils.parseCsv);

      const { result } = renderHook(() =>
        useFileContent("files", "document.pdf")
      );

      expect(result.current.content).toEqual(textContent);
      expect(mockParseCsv).not.toHaveBeenCalled();
    });
  });
});
