import "@testing-library/jest-dom";

import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import { useLiveTable } from "@/components/live-table/LiveTableProvider";
import { selectionStore } from "@/stores/selectionStore";

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the selection store
vi.mock("@/stores/selectionStore", async () => {
  const actual = await vi.importActual("@/stores/selectionStore");
  return {
    ...actual,
    selectionStore: {
      ...actual.selectionStore,
      getState: vi.fn().mockReturnValue({
        ...actual.selectionStore.getState(),
        clearSelection: vi.fn(), // Mock clearSelection from the store
        startSelection: vi.fn(),
        moveSelection: vi.fn(),
        endSelection: vi.fn(),
        setSelectedCell: vi.fn(),
      }),
      subscribe: vi.fn(() => () => {}), // Mock subscribe
    },
    useSelectionStore: vi.fn((selector) => {
      // Provide a basic mock for useSelectionStore if needed for other parts of the component
      // For this specific test, we are more interested in the direct call to clearSelection
      const state = actual.selectionStore.getState();
      return selector ? selector(state) : state;
    }),
  };
});

const mockedUseLiveTable = vi.mocked(useLiveTable);
const mockedSelectionStore = vi.mocked(selectionStore);

describe("LiveTableDisplay (referred to as LiveTable in its own file)", () => {
  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  // V2 data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Column 1", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colId1];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "R1C1" },
    [rowId2]: { [colId1]: "R2C1" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Reset the mock for clearSelection before each test
    // Ensure the mock is fresh for each assertion
    const actualStore = await vi.importActual("@/stores/selectionStore");
    mockedSelectionStore.getState.mockReturnValue({
      ...actualStore.selectionStore.getState(),
      selectedCell: null, // Reset relevant parts of state
      isSelecting: false,
      selectionArea: { startCell: null, endCell: null },
      clearSelection: vi.fn(), // This is the important mock
      startSelection: vi.fn(),
      moveSelection: vi.fn(),
      endSelection: vi.fn(),
      setSelectedCell: vi.fn(),
    });

    yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);
    // Manually populate V2 data
    yDoc.transact(() => {
      initialColumnDefinitions.forEach((def) =>
        liveTableDocInstance.yColumnDefinitions.set(def.id, def)
      );
      liveTableDocInstance.yColumnOrder.push(initialColumnOrder);
      initialRowOrder.forEach((rId) => {
        const rData = initialRowData[rId];
        const yRowMap = new Y.Map<CellValue>();
        initialColumnOrder.forEach((cId) => {
          if (rData[cId] !== undefined) yRowMap.set(cId, rData[cId]);
        });
        liveTableDocInstance.yRowData.set(rId, yRowMap);
      });
      liveTableDocInstance.yRowOrder.push(initialRowOrder);
      liveTableDocInstance.yMeta.set("schemaVersion", 2);
    });

    mockedUseLiveTable.mockReturnValue(
      getLiveTableMockValues({
        liveTableDocInstance,
        // Remove clearSelection from here as it's no longer from context
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    yDoc.destroy();
  });

  it("should clear selection when clicking outside the table", async () => {
    // Mock the store's state for this specific test if needed, e.g., if selectedCell should have a value
    const actualStore = await vi.importActual("@/stores/selectionStore");
    const mockClearSelectionFromStore = vi.fn();
    mockedSelectionStore.getState.mockReturnValueOnce({
        ...actualStore.selectionStore.getState(),
        selectedCell: { rowIndex: 0, colIndex: 0 }, // Example initial state
        isSelecting: false,
        clearSelection: mockClearSelectionFromStore, // Use a fresh mock for this test
        startSelection: vi.fn(),
        moveSelection: vi.fn(),
        endSelection: vi.fn(),
        setSelectedCell: vi.fn(),
    });

    mockedUseLiveTable.mockReturnValueOnce(
      getLiveTableMockValues({
        liveTableDocInstance,
        // selectedCell and isCellSelected are not directly used by the click-outside logic anymore
        // as it relies on the selectionStore
      })
    );

    const captureClick = vi.fn();

    render(
      <div>
        <button data-testid="outside-element" onClick={captureClick}>
          Click Outside Here
        </button>
        <LiveTableDisplay />
      </div>
    );

    const outsideElement = screen.getByTestId("outside-element");
    fireEvent.click(outsideElement);
    await vi.runAllTimersAsync();
    expect(mockClearSelectionFromStore).toHaveBeenCalledTimes(1); // Check the store's mock
    expect(captureClick).toHaveBeenCalledTimes(1);
  });

  it("should not clear selection when clicking inside the table", async () => {
    const actualStore = await vi.importActual("@/stores/selectionStore");
    const mockClearSelectionFromStore = vi.fn();
    mockedSelectionStore.getState.mockReturnValueOnce({
        ...actualStore.selectionStore.getState(),
        selectedCell: { rowIndex: 0, colIndex: 0 }, // Example initial state
        isSelecting: false,
        clearSelection: mockClearSelectionFromStore, // Use a fresh mock for this test
        startSelection: vi.fn(),
        moveSelection: vi.fn(),
        endSelection: vi.fn(),
        setSelectedCell: vi.fn(),
    });

    mockedUseLiveTable.mockReturnValueOnce(
      getLiveTableMockValues({
        liveTableDocInstance,
        // selectedCell and isCellSelected are not directly used by the click-outside logic anymore
      })
    );

    render(<LiveTableDisplay />);
    const inputElement = screen.getByDisplayValue("R1C1");
    const cellElement = inputElement.closest("td");
    expect(cellElement).toBeInTheDocument();

    if (cellElement) {
      fireEvent.mouseDown(cellElement);
    } else {
      throw new Error("Could not find parent TD for input with value R1C1");
    }

    expect(mockClearSelectionFromStore).not.toHaveBeenCalled(); // Check the store's mock
  });
});
