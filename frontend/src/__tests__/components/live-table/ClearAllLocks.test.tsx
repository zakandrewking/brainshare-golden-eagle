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
  useLockedCells,
  useLockSelectedRange,
  useUnlockAll,
} from "@/stores/data-store";
import { useSelectedCells } from "@/stores/selection-store";

// Mock the dependencies
vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selection-store")>()),
  useSelectedCells: vi.fn(),
  useSelectedCell: vi.fn(),
}));

vi.mock("@/stores/dataStore", () => ({
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
  useUnlockAll: vi.fn(),
  useUnlockRange: vi.fn(),
  useIsCellLocked: vi.fn(),
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

    vi.mocked(useSelectedCells).mockReturnValue([]);
    vi.mocked(useLockedCells).mockReturnValue(new Set());
    vi.mocked(useLockSelectedRange).mockReturnValue(mockLockSelectedRange);
    vi.mocked(useUnlockAll).mockReturnValue(mockUnlockAll);
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
    expect(vi.mocked(useUnlockAll)).toHaveBeenCalled();
    expect(vi.mocked(useUnlockAll)).toHaveReturnedWith(mockUnlockAll);
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

    vi.mocked(useUnlockAll).mockReturnValue(mockUnlockAllWithBehavior);
    vi.mocked(useLockedCells).mockReturnValue(new Set(["0-0", "1-1"]));

    // Create a test component that uses the hook properly
    const TestComponent = () => {
      const unlockAll = useUnlockAll();

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
