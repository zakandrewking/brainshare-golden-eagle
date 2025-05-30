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

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useLiveTable
    vi.mocked(useLiveTable).mockReturnValue({
      lockSelectedRange: mockLockSelectedRange,
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
});
