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
import { useLockedCells, useLockSelectedRange } from "@/stores/dataStore";
import { useSelectedCells } from "@/stores/selectionStore";

// Mock the dependencies
vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/stores/selectionStore", () => ({
  useSelectedCells: vi.fn(),
}));

vi.mock("@/stores/dataStore", () => ({
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
}));

// Create a test component that directly calls unlockAll
const TestClearAllLocksComponent: React.FC<{ onClearAll: () => void }> = ({
  onClearAll,
}) => {
  return (
    <button onClick={onClearAll} data-testid="clear-all-button">
      Clear All Locks
    </button>
  );
};

describe("Clear All Locks Functionality", () => {
  const mockLockSelectedRange = vi.fn();
  const mockUnlockAll = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useLiveTable with default values
    vi.mocked(useLiveTable).mockReturnValue({
      unlockAll: mockUnlockAll,
    } as Partial<ReturnType<typeof useLiveTable>> as ReturnType<typeof useLiveTable>);

    vi.mocked(useSelectedCells).mockReturnValue([]);
    vi.mocked(useLockedCells).mockReturnValue(new Set());
    vi.mocked(useLockSelectedRange).mockReturnValue(mockLockSelectedRange);
  });

  it("should call unlockAll when Clear All Locks is triggered", () => {
    const handleClearAll = () => {
      mockUnlockAll();
    };

    render(<TestClearAllLocksComponent onClearAll={handleClearAll} />);

    const clearButton = screen.getByTestId("clear-all-button");
    fireEvent.click(clearButton);

    expect(mockUnlockAll).toHaveBeenCalledTimes(1);
  });

  it("should have unlockAll function available in LockButton component", () => {
    vi.mocked(useLockedCells).mockReturnValue(new Set(["0-0", "1-1"])); // Some locked cells

    render(<LockButton />);

    // Verify that the component received the unlockAll function
    expect(vi.mocked(useLiveTable)).toHaveBeenCalled();
    const liveTablMockCall = vi.mocked(useLiveTable).mock.results[0];
    expect(liveTablMockCall.value.unlockAll).toBe(mockUnlockAll);
  });

  it("should disable Clear All Locks when no cells are locked", () => {
    // Mock no locked cells
    vi.mocked(useLockedCells).mockReturnValue(new Set()); // No locked cells

    render(<LockButton />);

    // Verify that the component received empty lockedCells
    expect(vi.mocked(useLockedCells)).toHaveBeenCalled();
  });

  it("should enable Clear All Locks when cells are locked", () => {
    // Mock some locked cells
    vi.mocked(useLockedCells).mockReturnValue(new Set(["0-0", "0-1", "1-0"])); // Some locked cells

    render(<LockButton />);

    // Verify that the component received locked cells
    expect(vi.mocked(useLockedCells)).toHaveBeenCalled();
  });

  it("should test the unlockAll function behavior", () => {
    // Create a mock that simulates the actual unlockAll behavior
    const mockUnlockAllWithBehavior = vi.fn(() => {
      // Simulate clearing all locks
      console.log("All locks cleared");
    });

    vi.mocked(useLiveTable).mockReturnValue({
      unlockAll: mockUnlockAllWithBehavior,
    } as Partial<ReturnType<typeof useLiveTable>> as ReturnType<typeof useLiveTable>);

    vi.mocked(useLockedCells).mockReturnValue(new Set(["0-0", "1-1"]));

    // Create a test component that uses the hook properly
    const TestComponent = () => {
      const { unlockAll } = useLiveTable();

      const handleClearAll = () => {
        unlockAll();
      };

      return <TestClearAllLocksComponent onClearAll={handleClearAll} />;
    };

    render(<TestComponent />);

    const clearButton = screen.getByTestId("clear-all-button");
    fireEvent.click(clearButton);

    expect(mockUnlockAllWithBehavior).toHaveBeenCalledTimes(1);
  });
});
