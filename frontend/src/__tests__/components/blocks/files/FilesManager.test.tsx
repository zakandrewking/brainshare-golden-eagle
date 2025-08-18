import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { render, screen } from "@testing-library/react";

import FilesManager from "@/blocks/files/files-manager";
import useFiles from "@/blocks/files/logic/use-files";

// Mock the child components
vi.mock("@/components/blocks/files/file-uploader", () => ({
  default: vi.fn(({ onUploadSuccess }: { onUploadSuccess: () => void }) => (
    <div data-testid="file-uploader">
      <button data-testid="trigger-upload-success" onClick={onUploadSuccess}>
        Trigger Upload Success
      </button>
    </div>
  )),
}));

vi.mock("@/components/blocks/files/file-list", () => ({
  default: vi.fn(
    ({
      files,
      onFileDeleted,
    }: {
      files: unknown[];
      onFileDeleted: () => void;
    }) => (
      <div data-testid="file-list">
        <div data-testid="file-count">{files.length} files</div>
        <button data-testid="trigger-file-deleted" onClick={onFileDeleted}>
          Trigger File Deleted
        </button>
      </div>
    )
  ),
}));

// Mock the useFiles hook
vi.mock("@/components/blocks/files/logic/file", () => ({
  useFiles: vi.fn(),
}));

// Mock other dependencies
vi.mock("@/hooks/use-is-ssr", () => ({
  default: vi.fn(() => false),
}));

vi.mock("@/components/ui/loading", () => ({
  DelayedLoadingSpinner: () => (
    <div data-testid="delayed-loading-spinner">Loading...</div>
  ),
}));

vi.mock("@/components/something-went-wrong", () => ({
  default: () => (
    <div data-testid="something-went-wrong">Something went wrong</div>
  ),
}));

describe("FilesManager", () => {
  const mockMutate = vi.fn();
  const mockFiles = [
    {
      id: "1",
      name: "test1.txt",
      size: 100,
      bucket_id: "files",
      object_path: "1.txt",
    },
    {
      id: "2",
      name: "test2.csv",
      size: 200,
      bucket_id: "files",
      object_path: "2.csv",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useFiles).mockReturnValue({
      data: mockFiles,
      error: null,
      isLoading: false,
      mutate: mockMutate,
    });
  });

  it("should render FileUploader and FileList with correct data integration", () => {
    render(<FilesManager isOverLimit={false} />);

    // Check that both components are rendered
    expect(screen.getByTestId("file-uploader")).toBeInTheDocument();
    expect(screen.getByTestId("file-list")).toBeInTheDocument();

    // Check that FileList receives the correct file data
    expect(screen.getByTestId("file-count")).toHaveTextContent("2 files");

    // Check that the Files section header is rendered
    expect(screen.getByText("Files")).toBeInTheDocument();
  });

  it("should coordinate data updates between uploader and list", () => {
    render(<FilesManager isOverLimit={false} />);

    // Simulate successful upload
    const uploadSuccessButton = screen.getByTestId("trigger-upload-success");
    uploadSuccessButton.click();

    // Check that mutate was called to refresh the file list
    expect(mockMutate).toHaveBeenCalledTimes(1);

    // Reset the mock
    mockMutate.mockClear();

    // Simulate file deletion
    const fileDeletedButton = screen.getByTestId("trigger-file-deleted");
    fileDeletedButton.click();

    // Check that mutate was called again to refresh the file list
    expect(mockMutate).toHaveBeenCalledTimes(1);
  });

  it("should show loading state while data is being fetched", () => {
    vi.mocked(useFiles).mockReturnValue({
      data: undefined,
      error: null,
      isLoading: true,
      mutate: mockMutate,
    });

    render(<FilesManager isOverLimit={false} />);

    expect(screen.getByTestId("delayed-loading-spinner")).toBeInTheDocument();
    expect(screen.queryByTestId("file-uploader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("file-list")).not.toBeInTheDocument();
  });

  it("should show error state when data fetching fails", () => {
    vi.mocked(useFiles).mockReturnValue({
      data: undefined,
      error: new Error("Failed to load files"),
      isLoading: false,
      mutate: mockMutate,
    });

    render(<FilesManager isOverLimit={false} />);

    expect(screen.getByTestId("something-went-wrong")).toBeInTheDocument();
    expect(screen.queryByTestId("file-uploader")).not.toBeInTheDocument();
    expect(screen.queryByTestId("file-list")).not.toBeInTheDocument();
  });
});
