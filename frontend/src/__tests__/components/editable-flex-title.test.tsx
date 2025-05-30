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

import EditableFlexTitle from "@/components/editable-flex-title";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("EditableFlexTitle", () => {
  const mockOnUpdate = vi.fn();
  const defaultProps = {
    title: "Test Document",
    description: "Test description",
    onUpdate: mockOnUpdate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render title and description", () => {
    render(<EditableFlexTitle {...defaultProps} />);

    expect(screen.getByText("Test Document")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit title/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view description/i })).toBeInTheDocument();
  });

  it("should enter edit mode when edit button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    expect(screen.getByDisplayValue("Test Document")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save title/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel editing/i })).toBeInTheDocument();
  });

  it("should save title changes when save button is clicked", async () => {
    const user = userEvent.setup();
    mockOnUpdate.mockResolvedValue(undefined);

    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const input = screen.getByDisplayValue("Test Document");
    await user.clear(input);
    await user.type(input, "Updated Title");

    const saveButton = screen.getByRole("button", { name: /save title/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith({ title: "Updated Title" });
    });
  });

  it("should cancel title editing when cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const input = screen.getByDisplayValue("Test Document");
    await user.clear(input);
    await user.type(input, "Changed Title");

    const cancelButton = screen.getByRole("button", { name: /cancel editing/i });
    await user.click(cancelButton);

    expect(screen.getByText("Test Document")).toBeInTheDocument();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it("should save title when Enter key is pressed", async () => {
    const user = userEvent.setup();
    mockOnUpdate.mockResolvedValue(undefined);

    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const input = screen.getByDisplayValue("Test Document");
    await user.clear(input);
    await user.type(input, "Updated Title{enter}");

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith({ title: "Updated Title" });
    });
  });

  it("should cancel title editing when Escape key is pressed", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const input = screen.getByDisplayValue("Test Document");
    await user.clear(input);
    await user.type(input, "Changed Title");
    await user.keyboard("{Escape}");

    expect(screen.getByText("Test Document")).toBeInTheDocument();
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it("should open description dialog when info button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const infoButton = screen.getByRole("button", { name: /view description/i });
    await user.click(infoButton);

    expect(screen.getByText("Test description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit description/i })).toBeInTheDocument();
  });

  it("should enter description edit mode when edit description button is clicked", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const infoButton = screen.getByRole("button", { name: /view description/i });
    await user.click(infoButton);

    const editDescButton = screen.getByRole("button", { name: /edit description/i });
    await user.click(editDescButton);

    expect(screen.getByDisplayValue("Test description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("should save description changes", async () => {
    const user = userEvent.setup();
    mockOnUpdate.mockResolvedValue(undefined);

    render(<EditableFlexTitle {...defaultProps} />);

    const infoButton = screen.getByRole("button", { name: /view description/i });
    await user.click(infoButton);

    const editDescButton = screen.getByRole("button", { name: /edit description/i });
    await user.click(editDescButton);

    const textarea = screen.getByDisplayValue("Test description");
    await user.clear(textarea);
    await user.type(textarea, "Updated description");

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalledWith({ description: "Updated description" });
    });
  });

  it("should handle update errors gracefully", async () => {
    const user = userEvent.setup();
    const { toast } = await import("sonner");
    mockOnUpdate.mockRejectedValue(new Error("Update failed"));

    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const input = screen.getByDisplayValue("Test Document");
    await user.clear(input);
    await user.type(input, "Updated Title");

    const saveButton = screen.getByRole("button", { name: /save title/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update title");
    });
  });

  it("should not call onUpdate if title hasn't changed", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const editButton = screen.getByRole("button", { name: /edit title/i });
    await user.click(editButton);

    const saveButton = screen.getByRole("button", { name: /save title/i });
    await user.click(saveButton);

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it("should not call onUpdate if description hasn't changed", async () => {
    const user = userEvent.setup();
    render(<EditableFlexTitle {...defaultProps} />);

    const infoButton = screen.getByRole("button", { name: /view description/i });
    await user.click(infoButton);

    const editDescButton = screen.getByRole("button", { name: /edit description/i });
    await user.click(editDescButton);

    const saveButton = screen.getByRole("button", { name: /save/i });
    await user.click(saveButton);

    expect(mockOnUpdate).not.toHaveBeenCalled();
  });
});
