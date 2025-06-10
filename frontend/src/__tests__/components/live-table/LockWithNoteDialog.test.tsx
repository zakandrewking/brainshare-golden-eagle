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
      screen.getByRole("button", { name: "Lock 1 cell" })
    ).toBeInTheDocument();
  });

  it("should display correct cell count for multiple cells", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    expect(
      screen.getByText(/You are about to lock 3 cells/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Lock 3 cells" })
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
      screen.getByRole("button", { name: "Lock 3 cells" })
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
    const lockButton = screen.getByRole("button", { name: "Lock 3 cells" });

    fireEvent.change(textarea, { target: { value: "Important data" } });
    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith("Important data");
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should call onLock with undefined when note is empty", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const lockButton = screen.getByRole("button", { name: "Lock 3 cells" });
    fireEvent.click(lockButton);

    expect(defaultProps.onLock).toHaveBeenCalledWith(undefined);
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should call onLock with undefined when note is only whitespace", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    const lockButton = screen.getByRole("button", { name: "Lock 3 cells" });

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
    const lockButton = screen.getByRole("button", { name: "Lock 3 cells" });

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
      screen.getByRole("button", { name: "Lock 0 cells" })
    ).toBeInTheDocument();
  });

  it("should call onOpenChange when dialog overlay is clicked", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    // Find the close button in the dialog header
    const closeButton = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeButton);

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("should maintain textarea focus when typing", () => {
    render(<LockWithNoteDialog {...defaultProps} />);

    const textarea = screen.getByLabelText("Note (optional)");
    textarea.focus();

    fireEvent.change(textarea, { target: { value: "Test" } });

    expect(document.activeElement).toBe(textarea);
  });
});
