import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LockWithNoteDialog from "@/components/live-table/LockWithNoteDialog";
import type { CellPosition } from "@/stores/selectionStore";

describe("LockWithNoteDialog", () => {
  const mockSelectedCells: CellPosition[] = [
    { rowIndex: 0, colIndex: 0 },
    { rowIndex: 0, colIndex: 1 },
    { rowIndex: 1, colIndex: 0 },
  ];

  const defaultProps = {
    isOpen: true,
    onOpenChange: vi.fn(),
    onLock: vi.fn(),
    selectedCells: mockSelectedCells,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render dialog when open", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Lock with Note")).toBeInTheDocument();
    expect(
      screen.getByText(/You are about to lock 3 cells/)
    ).toBeInTheDocument();
  });

  it("should not render dialog when closed", () => {
    render(<LockWithNoteDialog {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("should display correct cell count for single cell", () => {
    const singleCellProps = {
      ...defaultProps,
      selectedCells: [{ rowIndex: 0, colIndex: 0 }],
    };

    render(<LockWithNoteDialog {...singleCellProps} />);

    expect(
      screen.getByText(/You are about to lock 1 cell/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Lock 1 cell/ })
    ).toBeInTheDocument();
  });

  it("should display correct cell count for multiple cells", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    expect(
      screen.getByText(/You are about to lock 3 cells/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Lock 3 cells/ })
    ).toBeInTheDocument();
  });

  it("should render textarea with placeholder text", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveAttribute(
      "placeholder",
      "Enter a reason for locking these cells..."
    );
  });

  it("should render Lock and Cancel buttons", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    expect(
      screen.getByRole("button", { name: /Lock 3 cells/ })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("should update textarea value when user types", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    fireEvent.change(textarea, { target: { value: "Important data" } });

    expect(textarea).toHaveValue("Important data");
  });

  it("should call onLock with note when Lock button is clicked", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    const lockButton = screen.getByRole("button", { name: /Lock 3 cells/ });

    fireEvent.change(textarea, { target: { value: "Important data" } });
    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith("Important data");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should call onLock with undefined when note is empty", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const lockButton = screen.getByRole("button", { name: /Lock 3 cells/ });
    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith(undefined);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should call onLock with undefined when note is only whitespace", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    const lockButton = screen.getByRole("button", { name: /Lock 3 cells/ });

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith(undefined);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should call onOpenChange when Cancel button is clicked", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    fireEvent.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onLock).not.toHaveBeenCalled();
  });

  it("should clear textarea when lock action is performed", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    const lockButton = screen.getByRole("button", { name: /Lock 3 cells/ });

    fireEvent.change(textarea, { target: { value: "Test note" } });
    expect(textarea).toHaveValue("Test note");

    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith("Test note");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should clear textarea when cancel action is performed", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    fireEvent.change(textarea, { target: { value: "Test note" } });
    expect(textarea).toHaveValue("Test note");

    fireEvent.click(cancelButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onLock).not.toHaveBeenCalled();
  });

  it("should handle empty selectedCells array", () => {
    const emptyProps = {
      ...defaultProps,
      selectedCells: [],
    };

    render(<LockWithNoteDialog {...emptyProps} />);

    expect(
      screen.getByText(/You are about to lock 0 cells/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Lock 0 cells/ })
    ).toBeInTheDocument();
  });

  it("should call onOpenChange when dialog overlay is clicked", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    // Find the close button in the dialog header
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should maintain textarea focus when typing", async () => {
    const mockOnOpenChange = vi.fn();
    const mockOnLock = vi.fn();
    const selectedCells = [{ rowIndex: 0, colIndex: 0 }];
    const user = userEvent.setup();

    render(
      <LockWithNoteDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={selectedCells}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "Enter a reason for locking these cells..."
    );
    await user.type(textarea, "test note");

    expect(textarea).toHaveFocus();
  });

  it("should lock cells when CMD+Enter is pressed", async () => {
    const mockOnOpenChange = vi.fn();
    const mockOnLock = vi.fn();
    const selectedCells = [{ rowIndex: 0, colIndex: 0 }];
    const user = userEvent.setup();

    render(
      <LockWithNoteDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={selectedCells}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "Enter a reason for locking these cells..."
    );
    await user.type(textarea, "test note");

    // Simulate CMD+Enter (Meta+Enter on Mac)
    await user.keyboard("{Meta>}{Enter}{/Meta}");

    expect(mockOnLock).toHaveBeenCalledWith("test note");
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should lock cells when CTRL+Enter is pressed", async () => {
    const mockOnOpenChange = vi.fn();
    const mockOnLock = vi.fn();
    const selectedCells = [{ rowIndex: 0, colIndex: 0 }];
    const user = userEvent.setup();

    render(
      <LockWithNoteDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={selectedCells}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "Enter a reason for locking these cells..."
    );
    await user.type(textarea, "another test note");

    // Simulate CTRL+Enter
    await user.keyboard("{Control>}{Enter}{/Control}");

    expect(mockOnLock).toHaveBeenCalledWith("another test note");
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("should cancel dialog when Escape is pressed", async () => {
    const mockOnOpenChange = vi.fn();
    const mockOnLock = vi.fn();
    const selectedCells = [{ rowIndex: 0, colIndex: 0 }];
    const user = userEvent.setup();

    render(
      <LockWithNoteDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={selectedCells}
      />
    );

    const textarea = screen.getByPlaceholderText(
      "Enter a reason for locking these cells..."
    );
    await user.type(textarea, "this should be discarded");

    // Simulate Escape key
    await user.keyboard("{Escape}");

    expect(mockOnLock).not.toHaveBeenCalled();
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
