import { toast } from "sonner";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { deleteDocument } from "@/app/(main)/document/[docId]/actions";
import DocumentSettingsDropdown from "@/components/document-settings-dropdown";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => "mock-toast-id"),
    dismiss: vi.fn(),
  },
}));

vi.mock("@/app/(main)/document/[docId]/actions", () => ({
  deleteDocument: vi.fn(),
}));

describe("DocumentSettingsDropdown", () => {
  const mockDocId = "test-doc-123";
  const mockDocumentTitle = "Test Document";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render settings dropdown trigger", () => {
    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("should open dropdown menu when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    expect(screen.getByTestId("delete-document-item")).toBeInTheDocument();
    expect(screen.getByText("Delete document")).toBeInTheDocument();
  });

  it("should open confirmation dialog when delete item is clicked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettingsDropdown docId={mockDocId} documentTitle={mockDocumentTitle} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    expect(screen.getByTestId("delete-confirmation-dialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Document")).toBeInTheDocument();
    expect(screen.getByText(`Are you sure you want to delete "${mockDocumentTitle}"? This action cannot be undone.`)).toBeInTheDocument();
  });

  it("should show generic message when no document title is provided", async () => {
    const user = userEvent.setup();
    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    expect(screen.getByText("Are you sure you want to delete this document? This action cannot be undone.")).toBeInTheDocument();
  });

  it("should close dialog when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const cancelButton = screen.getByTestId("cancel-delete-button");
    await user.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByTestId("delete-confirmation-dialog")).not.toBeInTheDocument();
    });
  });

  it("should successfully delete document and redirect", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteDocument).mockResolvedValue({ success: true });

    render(<DocumentSettingsDropdown docId={mockDocId} documentTitle={mockDocumentTitle} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(deleteDocument).toHaveBeenCalledWith(mockDocId);
      expect(toast.success).toHaveBeenCalledWith("Document deleted successfully");
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("should show error toast when deletion fails", async () => {
    const user = userEvent.setup();
    const errorMessage = "Database error";
    vi.mocked(deleteDocument).mockResolvedValue({ error: errorMessage });

    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(deleteDocument).toHaveBeenCalledWith(mockDocId);
      expect(toast.error).toHaveBeenCalledWith("Failed to delete document");
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("should show error toast when deletion throws an exception", async () => {
    const user = userEvent.setup();
    vi.mocked(deleteDocument).mockRejectedValue(new Error("Network error"));

    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    await waitFor(() => {
      expect(deleteDocument).toHaveBeenCalledWith(mockDocId);
      expect(toast.error).toHaveBeenCalledWith("Failed to delete document");
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("should disable confirm button and show loading text during deletion", async () => {
    const user = userEvent.setup();
    let resolveDelete: (value: { success?: boolean; error?: string }) => void;
    const deletePromise = new Promise<{ success?: boolean; error?: string }>((resolve) => {
      resolveDelete = resolve;
    });
    vi.mocked(deleteDocument).mockReturnValue(deletePromise);

    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    expect(confirmButton).toBeDisabled();
    expect(confirmButton).toHaveTextContent("Deleting...");

    resolveDelete!({ success: true });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/");
    });
  });

  it("should show loading toast during deletion", async () => {
    const user = userEvent.setup();
    let resolveDelete: (value: { success?: boolean; error?: string }) => void;
    const deletePromise = new Promise<{ success?: boolean; error?: string }>((resolve) => {
      resolveDelete = resolve;
    });
    vi.mocked(deleteDocument).mockReturnValue(deletePromise);

    render(<DocumentSettingsDropdown docId={mockDocId} />);

    const trigger = screen.getByTestId("settings-dropdown-trigger");
    await user.click(trigger);

    const deleteItem = screen.getByTestId("delete-document-item");
    await user.click(deleteItem);

    const confirmButton = screen.getByTestId("confirm-delete-button");
    await user.click(confirmButton);

    expect(toast.loading).toHaveBeenCalledTimes(1);

    resolveDelete!({ success: true });

    await waitFor(() => {
      expect(toast.dismiss).toHaveBeenCalledWith("mock-toast-id");
      expect(toast.success).toHaveBeenCalledWith("Document deleted successfully");
    });
  });
});
