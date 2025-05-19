import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mocked,
  vi,
} from "vitest";
import * as Y from "yjs";

import { act, fireEvent, render, screen } from "@testing-library/react";

import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";

import { getLiveTableMockValues } from "./liveTableTestUtils";

// Mock Y.UndoManager directly
const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockStopCapturing = vi.fn();

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

let mockUndoManagerInstance: MockUndoManagerType;

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

describe("LiveTableToolbar - Undo/Redo Functionality", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUndoManagerInstance = {
      undo: mockUndo,
      redo: mockRedo,
      on: mockOn,
      off: mockOff,
      undoStack: [],
      redoStack: [],
      stopCapturing: mockStopCapturing,
    };

    const mockData = getLiveTableMockValues({
      undoManager: mockUndoManagerInstance as unknown as Y.UndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
    });
    vi.mocked(useLiveTable).mockReturnValue(mockData);
  });

  afterEach(() => {
    // Vitest automatically cleans up DOM, no specific unmount needed unless effects aren't cleaned by component
  });

  const triggerUndoManagerEvent = (
    eventName: "stack-item-added" | "stack-item-popped"
  ) => {
    const callback = mockOn.mock.calls.find(
      (call) => call[0] === eventName
    )?.[1];
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
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );
    triggerUndoManagerEvent("stack-item-added"); // Trigger initial state update

    const undoButton = screen.getByRole("button", { name: /undo/i });
    const redoButton = screen.getByRole("button", { name: /redo/i });

    expect(undoButton).toBeDisabled();
    expect(redoButton).toBeDisabled();
  });

  it("should enable Undo button when an item is added to the undo stack", () => {
    mockUndoManagerInstance.undoStack = [{}];
    mockUndoManagerInstance.redoStack = [];

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );
    triggerUndoManagerEvent("stack-item-added");

    const undoButton = screen.getByRole("button", { name: /undo/i });
    fireEvent.mouseDown(undoButton);

    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it("should enable Redo and disable Undo after undo operation (simulated by stack change)", () => {
    mockUndoManagerInstance.undoStack = [];
    mockUndoManagerInstance.redoStack = [{}];

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );
    triggerUndoManagerEvent("stack-item-added"); // For redo stack

    const redoButton = screen.getByRole("button", { name: /redo/i });
    fireEvent.mouseDown(redoButton);

    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it("should enable Undo and disable Redo after redo operation (simulated by stack change)", () => {
    mockUndoManagerInstance.undoStack = [{}];
    mockUndoManagerInstance.redoStack = [];

    render(
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
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
      <TooltipProvider>
        <LiveTableToolbar />
      </TooltipProvider>
    );

    expect(mockOn).toHaveBeenCalledWith(
      "stack-item-added",
      expect.any(Function)
    );
    expect(mockOn).toHaveBeenCalledWith(
      "stack-item-popped",
      expect.any(Function)
    );

    const onStackItemAddedCallback = mockOn.mock.calls.find(
      (call) => call[0] === "stack-item-added"
    )?.[1];
    const onStackItemPoppedCallback = mockOn.mock.calls.find(
      (call) => call[0] === "stack-item-popped"
    )?.[1];

    unmount();

    expect(mockOff).toHaveBeenCalledWith(
      "stack-item-added",
      onStackItemAddedCallback
    );
    expect(mockOff).toHaveBeenCalledWith(
      "stack-item-popped",
      onStackItemPoppedCallback
    );
  });
});
