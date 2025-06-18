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

import CitationFinderDialog from "@/components/live-table/CitationFinderDialog";
import type { CellPosition } from "@/stores/selectionStore";

describe("CitationFinderDialog", () => {
  const mockSelectedCells: CellPosition[] = [
    { rowIndex: 0, colIndex: 0 },
    { rowIndex: 0, colIndex: 1 },
    { rowIndex: 1, colIndex: 0 },
  ];

  const mockOnLock = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders when open with correct cell count", () => {
    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    expect(screen.getByTestId("citation-finder-dialog")).toBeInTheDocument();
    expect(screen.getByText("Find Citations")).toBeInTheDocument();
    expect(
      screen.getByText(/Finding relevant citations for 3 selected cells/)
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <CitationFinderDialog
        isOpen={false}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    expect(
      screen.queryByTestId("citation-finder-dialog")
    ).not.toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    expect(screen.getByText("Searching for citations...")).toBeInTheDocument();
  });

  it("shows citations after loading", async () => {
    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    await waitFor(
      () => {
        expect(screen.getByText("Example Citation 1")).toBeInTheDocument();
        expect(screen.getByText("Example Citation 2")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it("allows selecting citations", async () => {
    const user = userEvent.setup();

    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    await waitFor(
      () => {
        expect(screen.getByText("Example Citation 1")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const citation1Checkbox = document.getElementById("citation-1");
    await user.click(citation1Checkbox!);

    expect(citation1Checkbox).toBeChecked();
    expect(screen.getByText("Lock with 1 Citation")).toBeInTheDocument();
  });

  it("calls onLock with citation note when locking", async () => {
    const user = userEvent.setup();

    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    await waitFor(
      () => {
        expect(screen.getByText("Example Citation 1")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const citation1Checkbox = document.getElementById("citation-1");
    await user.click(citation1Checkbox!);

    const lockButton = screen.getByText("Lock with 1 Citation");
    await user.click(lockButton);

    expect(mockOnLock).toHaveBeenCalledWith(
      expect.stringContaining("Example Citation 1")
    );
    expect(mockOnLock).toHaveBeenCalledWith(
      expect.stringContaining("https://example.com/article1")
    );
  });

  it("calls onOpenChange when canceling", async () => {
    const user = userEvent.setup();

    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles single cell selection correctly", () => {
    const singleCell: CellPosition[] = [{ rowIndex: 0, colIndex: 0 }];

    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={singleCell}
      />
    );

    expect(
      screen.getByText(/Finding relevant citations for 1 selected cell/)
    ).toBeInTheDocument();
  });

  it("disables lock button when no citations are selected", async () => {
    render(
      <CitationFinderDialog
        isOpen={true}
        onOpenChange={mockOnOpenChange}
        onLock={mockOnLock}
        selectedCells={mockSelectedCells}
      />
    );

    await waitFor(
      () => {
        expect(screen.getByText("Example Citation 1")).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const lockButton = screen.getByText("Lock with 0 Citations");
    expect(lockButton).toBeDisabled();
  });
});
