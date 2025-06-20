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

import LockButton from "@/components/live-table/LockButton";
import {
  useIsTableLoaded,
  useLockedCells,
  useLockSelectedRange,
  useUnlockAll,
} from "@/stores/dataStore";
import { useSelectedCells } from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selectionStore")>()),
  useSelectedCells: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/dataStore")>()),
  useIsTableLoaded: vi.fn(),
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
  useUnlockAll: vi.fn(),
  useUnlockRange: vi.fn(),
  useIsCellLocked: vi.fn(),
}));

describe("LockButton", () => {
  const mockLockSelectedRange = vi.fn();
  const mockUnlockAll = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    // table loaded
    vi.mocked(useIsTableLoaded).mockReturnValue(true);

    // Mock useLockedCells with default empty map
    vi.mocked(useLockedCells).mockReturnValue(new Map());

    // Mock useLockSelectedRange
    vi.mocked(useLockSelectedRange).mockReturnValue(mockLockSelectedRange);

    // Mock useUnlockAll
    vi.mocked(useUnlockAll).mockReturnValue(mockUnlockAll);
  });

  it("should render the lock button when cells are selected", () => {
    // Mock selected cells
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ]);

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it("should render disabled button when no cells are selected", () => {
    // Mock no selected cells
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("should call lockSelectedRange when clicked with selected cells", () => {
    // Mock selected cells
    const selectedCells = [
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
    ];
    vi.mocked(useSelectedCells).mockReturnValue(selectedCells);

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );
    const button = screen.getByRole("button", { name: /lock selected cells/i });
    fireEvent.click(button);

    expect(mockLockSelectedRange).toHaveBeenCalledTimes(1);
    expect(mockLockSelectedRange).toHaveBeenCalledWith(selectedCells);
  });

  it("should render dropdown trigger button", () => {
    vi.mocked(useSelectedCells).mockReturnValue([]);

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

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
    const { rerender } = render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

    const lockButton = screen.getByRole("button", {
      name: /lock selected cells/i,
    });
    expect(lockButton).toBeDisabled();

    // Test with selected cells
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    rerender(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

    expect(lockButton).not.toBeDisabled();
  });
});
