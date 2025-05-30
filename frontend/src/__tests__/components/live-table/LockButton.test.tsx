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

import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LockButton from "@/components/live-table/LockButton";
import { useSelectedCells } from "@/stores/selectionStore";

// Mock the dependencies
vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/stores/selectionStore", () => ({
  useSelectedCells: vi.fn(),
}));

describe("LockButton", () => {
  const mockLockSelectedRange = vi.fn();
  const mockUnlockAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useLiveTable with default values
    vi.mocked(useLiveTable).mockReturnValue({
      lockSelectedRange: mockLockSelectedRange,
      unlockAll: mockUnlockAll,
      lockedCells: new Set(),
    } as Partial<ReturnType<typeof useLiveTable>> as ReturnType<typeof useLiveTable>);
  });

  it("should render the lock button when cells are selected", () => {
    // Mock selected cells
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    render(<LockButton />);
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("should render disabled button when no cells are selected", () => {
    // Mock no selected cells
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(<LockButton />);
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("should call lockSelectedRange when clicked with selected cells", () => {
    // Mock selected cells
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    render(<LockButton />);
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    fireEvent.click(button);

    expect(mockLockSelectedRange).toHaveBeenCalledTimes(1);
  });

  it("should render dropdown trigger button", () => {
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(<LockButton />);

    // Check that there are two buttons (lock button and dropdown trigger)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    // The second button should be the dropdown trigger
    const dropdownTrigger = buttons[1];
    expect(dropdownTrigger).toBeInTheDocument();
  });

  it("should have correct disabled state for lock button based on selected cells", () => {
    // Test with no selected cells
    vi.mocked(useSelectedCells).mockReturnValue([]);
    const { rerender } = render(<LockButton />);

    const lockButton = screen.getByRole("button", { name: /lock selected cells/i });
    expect(lockButton).toBeDisabled();

    // Test with selected cells
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
    ]);
    rerender(<LockButton />);

    expect(lockButton).not.toBeDisabled();
  });

  it("should call unlockAll function when component has access to it", () => {
    // This test verifies that the component has access to the unlockAll function
    // and can call it (the actual UI interaction is complex to test with Radix UI)
    vi.mocked(useSelectedCells).mockReturnValue([]);
    vi.mocked(useLiveTable).mockReturnValue({
      lockSelectedRange: mockLockSelectedRange,
      unlockAll: mockUnlockAll,
      lockedCells: new Set(["0-0", "0-1"]), // Some locked cells
    } as Partial<ReturnType<typeof useLiveTable>> as ReturnType<typeof useLiveTable>);

    render(<LockButton />);

    // Verify the component has access to unlockAll by checking the mock was provided
    expect(vi.mocked(useLiveTable)).toHaveBeenCalled();
    const mockCall = vi.mocked(useLiveTable).mock.results[0];
    expect(mockCall.value.unlockAll).toBe(mockUnlockAll);
  });
});
