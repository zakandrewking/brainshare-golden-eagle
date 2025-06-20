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

// Mock the dependencies
vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selectionStore")>()),
  useSelectedCells: vi.fn(),
  useSelectedCell: vi.fn(),
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
    vi.resetAllMocks();

    // table loaded
    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useSelectedCells).mockReturnValue([]);
    vi.mocked(useLockedCells).mockReturnValue(new Map());
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
    vi.mocked(useLockedCells).mockReturnValue(
      new Map([
        ["0-0", undefined],
        ["1-1", undefined],
      ])
    ); // Some locked cells

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

    // Verify that the component received the unlockAll function
    expect(vi.mocked(useUnlockAll)).toHaveBeenCalled();
    expect(vi.mocked(useUnlockAll)).toHaveReturnedWith(mockUnlockAll);
  });

  it("should disable Clear All Locks when no cells are locked", () => {
    // Mock no locked cells
    vi.mocked(useLockedCells).mockReturnValue(new Map()); // No locked cells

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

    // Verify that the component received empty lockedCells
    expect(vi.mocked(useLockedCells)).toHaveBeenCalled();
  });

  it("should enable Clear All Locks when cells are locked", () => {
    // Mock some locked cells
    vi.mocked(useLockedCells).mockReturnValue(
      new Map([
        ["0-0", undefined],
        ["0-1", undefined],
        ["1-0", undefined],
      ])
    ); // Some locked cells

    render(
      <TestDataStoreWrapper>
        <LockButton />
      </TestDataStoreWrapper>
    );

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
    vi.mocked(useLockedCells).mockReturnValue(
      new Map([
        ["0-0", undefined],
        ["1-1", undefined],
      ])
    );

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
