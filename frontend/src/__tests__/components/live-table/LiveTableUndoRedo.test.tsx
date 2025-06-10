import React from "react";

import {
  beforeEach,
  describe,
  expect,
  it,
  type Mocked,
  vi,
} from "vitest";
import { UndoManager } from "yjs";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useIsTableLoaded, useUndoManager } from "@/stores/dataStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

// Mock Liveblocks to avoid RoomProvider error
vi.mock("@liveblocks/react", () => ({
  useSelf: vi.fn(() => ({
    info: {
      name: "Test User",
      color: "#FF0000",
    },
  })),
  useRoom: vi.fn(() => ({})),
  RoomProvider: vi.fn(({ children }) => children),
}));

// Define a type for the mock UndoManager
type MockUndoManagerType = {
  undo: Mocked<() => void>;
  redo: Mocked<() => void>;
  on: Mocked<(event: string, callback: () => void) => void>;
  off: Mocked<(event: string, callback: () => void) => void>;
  undoStack: unknown[];
  redoStack: unknown[];
  stopCapturing: Mocked<() => void>;
};

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useLockedCells: () => new Set(),
  useLockSelectedRange: () => vi.fn(),
  useUnlockAll: () => vi.fn(),
  useUnlockRange: () => vi.fn(),
  useIsCellLocked: () => vi.fn(() => false),
  useUndoManager: vi.fn(),
  useHandleCellChange: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selectionStore")>()),
  useSelectedCells: () => [],
}));

describe("LiveTableToolbar - Undo/Redo Functionality", () => {
  let mockUndoManagerInstance: MockUndoManagerType;

  beforeEach(async () => {
    vi.resetAllMocks();

    // table loaded
    vi.mocked(useIsTableLoaded).mockReturnValue(true);

    // Mock ResizeObserver properly
    Object.defineProperty(global, "ResizeObserver", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      })),
    });

    mockUndoManagerInstance = {
      undo: vi.fn(),
      redo: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      undoStack: [],
      redoStack: [],
      stopCapturing: vi.fn(),
    };

    vi.mocked(useUndoManager).mockImplementation(
      () => mockUndoManagerInstance as UndoManager
    );
  });

  const triggerUndoManagerEvent = (
    eventName: "stack-item-added" | "stack-item-popped"
  ) => {
    // Find the callback that was registered for this event
    const onCalls = vi.mocked(mockUndoManagerInstance.on).mock.calls;
    const callback = onCalls.find((call) => call[0] === eventName)?.[1];
    if (callback) {
      act(() => {
        callback();
      });
    }
  };

  it("should have Undo and Redo buttons initially disabled", () => {
    mockUndoManagerInstance.undoStack = [];
    mockUndoManagerInstance.redoStack = [];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it("should enable Undo button when an item is added to the undo stack", () => {
    mockUndoManagerInstance.undoStack = [{}];
    mockUndoManagerInstance.redoStack = [];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );
    triggerUndoManagerEvent("stack-item-added");

    const undoButton = screen.getByRole("button", { name: /undo/i });
    expect(undoButton).not.toBeDisabled();
    const redoButton = screen.getByRole("button", { name: /redo/i });
    expect(redoButton).toBeDisabled();
  });

  it("should call UndoManager.undo when Undo button is clicked", () => {
    mockUndoManagerInstance.undoStack = [{}];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );
    triggerUndoManagerEvent("stack-item-added");

    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.mouseDown(undoButton);

    expect(mockUndoManagerInstance.undo).toHaveBeenCalledTimes(1);
  });

  it("should enable Redo and disable Undo after undo operation (simulated by stack change)", () => {
    mockUndoManagerInstance.undoStack = [];
    mockUndoManagerInstance.redoStack = [{}];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );
    triggerUndoManagerEvent("stack-item-popped"); // Simulates undo removing from undo stack
    triggerUndoManagerEvent("stack-item-added"); // Simulates undo adding to redo stack

    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });

    expect(undoButton).toBeDisabled();
    expect(redoButton).not.toBeDisabled();
  });

  it("should call UndoManager.redo when Redo button is clicked", () => {
    mockUndoManagerInstance.redoStack = [{}];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );
    triggerUndoManagerEvent("stack-item-added"); // For redo stack

    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.mouseDown(redoButton);

    expect(mockUndoManagerInstance.redo).toHaveBeenCalledTimes(1);
  });

  it("should enable Undo and disable Redo after redo operation (simulated by stack change)", () => {
    mockUndoManagerInstance.undoStack = [{}];
    mockUndoManagerInstance.redoStack = [];

    render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );
    triggerUndoManagerEvent("stack-item-added"); // Simulates redo adding to undo stack
    triggerUndoManagerEvent("stack-item-popped"); // Simulates redo removing from redo stack

    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });

    expect(undoButton).not.toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it("should register and unregister event listeners on mount and unmount", () => {
    const { unmount } = render(
      <TestDataStoreWrapper>
        <TooltipProvider>
          <LiveTableToolbar />
        </TooltipProvider>
      </TestDataStoreWrapper>
    );

    expect(mockUndoManagerInstance.on).toHaveBeenCalledWith(
      "stack-item-added",
      expect.any(Function)
    );
    expect(mockUndoManagerInstance.on).toHaveBeenCalledWith(
      "stack-item-popped",
      expect.any(Function)
    );

    const onCalls = vi.mocked(mockUndoManagerInstance.on).mock.calls;
    const onStackItemAddedCallback = onCalls.find(
      (call) => call[0] === "stack-item-added"
    )?.[1];
    const onStackItemPoppedCallback = onCalls.find(
      (call) => call[0] === "stack-item-popped"
    )?.[1];

    unmount();

    expect(mockUndoManagerInstance.off).toHaveBeenCalledWith(
      "stack-item-added",
      onStackItemAddedCallback
    );
    expect(mockUndoManagerInstance.off).toHaveBeenCalledWith(
      "stack-item-popped",
      onStackItemPoppedCallback
    );
  });
});
