import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CitationFinderDialog from "@/components/live-table/CitationFinderDialog";
import type { CellPosition } from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

// Mock the findCitations server action
vi.mock("@/components/live-table/actions/find-citations", () => ({
  default: vi.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            citations: [
              {
                title: "Example Citation 1",
                url: "https://example.com/article1",
                snippet:
                  "This is a relevant snippet from the first citation that relates to your selected data.",
                citedValue: "Example Value 1",
              },
              {
                title: "Example Citation 2",
                url: "https://example.com/article2",
                snippet:
                  "This is another relevant snippet that provides additional context for your selection.",
                citedValue: "Example Value 2",
              },
            ],
            searchContext: "Found 2 relevant citations for the selected data.",
          });
        }, 2000);
      })
  ),
  Citation: {},
}));

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
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders when open with correct cell count", () => {
    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    expect(screen.getByTestId("citation-finder-dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /Find Citations for 3 Selected cells/,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Review and select citations to lock with your data.")
    ).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={false}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    expect(
      screen.queryByTestId("citation-finder-dialog")
    ).not.toBeInTheDocument();
  });

  it("shows initial ready state before search", () => {
    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    expect(screen.getByText("Selected Data Preview:")).toBeInTheDocument();
    expect(
      screen.getByText("This process typically takes about 30 seconds.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Find Citations/ })
    ).toBeInTheDocument();
  });

  it("shows loading state after clicking search button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    // Click the Find Citations button
    const findButton = screen.getByRole("button", { name: /Find Citations/ });
    await user.click(findButton);

    // Should show loading state
    expect(
      screen.getByText("Analyzing your selected data...")
    ).toBeInTheDocument();
  });

  it("shows citations after clicking search button", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    // Click the Find Citations button
    const findButton = screen.getByRole("button", { name: /Find Citations/ });
    await user.click(findButton);

    // Should show loading state
    expect(
      screen.getByText("Analyzing your selected data...")
    ).toBeInTheDocument();

    // Advance timers to simulate the 2 second timeout
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Example Citation 1")).toBeInTheDocument();
    expect(screen.getByText("Example Citation 2")).toBeInTheDocument();
  });

  it("allows selecting citations", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    // Click the Find Citations button
    const findButton = screen.getByRole("button", { name: /Find Citations/ });
    await user.click(findButton);

    // Advance timers to get citations
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Example Citation 1")).toBeInTheDocument();

    // Find the citation container which is now clickable
    const citationContainer = screen
      .getByText("Example Citation 1")
      .closest('div[class*="cursor-pointer"]');
    expect(citationContainer).toBeInTheDocument();

    // Click the citation container
    await user.click(citationContainer!);

    // Find the checkbox to verify it's checked
    const checkbox = document.getElementById(
      "citation-citation-0"
    ) as HTMLInputElement;
    expect(checkbox).toBeChecked();
    expect(screen.getByText("Lock with 1 Citation")).toBeInTheDocument();
  });

  it("calls onLock with citation note when locking", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    // Click the Find Citations button
    const findButton = screen.getByRole("button", { name: /Find Citations/ });
    await user.click(findButton);

    // Advance timers to get citations
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Example Citation 1")).toBeInTheDocument();

    // Find the citation container which is now clickable
    const citationContainer = screen
      .getByText("Example Citation 1")
      .closest('div[class*="cursor-pointer"]');
    expect(citationContainer).toBeInTheDocument();

    // Click the citation container
    await user.click(citationContainer!);

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
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    const cancelButton = screen.getByText("Cancel");
    await user.click(cancelButton);

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });

  it("handles single cell selection correctly", () => {
    const singleCell: CellPosition[] = [{ rowIndex: 0, colIndex: 0 }];

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={singleCell}
        />
      </TestDataStoreWrapper>
    );

    expect(
      screen.getByRole("heading", {
        name: /Find Citations for 1 Selected cell/,
      })
    ).toBeInTheDocument();
  });

  it("disables lock button when no citations are selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TestDataStoreWrapper>
        <CitationFinderDialog
          isOpen={true}
          onOpenChange={mockOnOpenChange}
          onLock={mockOnLock}
          selectedCells={mockSelectedCells}
        />
      </TestDataStoreWrapper>
    );

    // Click the Find Citations button
    const findButton = screen.getByRole("button", { name: /Find Citations/ });
    await user.click(findButton);

    // Advance timers to get citations
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.getByText("Example Citation 1")).toBeInTheDocument();

    const lockButton = screen.getByText("Lock with 0 Citations");
    expect(lockButton).toBeDisabled();
  });
});
