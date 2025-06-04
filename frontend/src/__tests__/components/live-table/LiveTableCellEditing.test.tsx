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
import userEvent from "@testing-library/user-event";

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/live-table-doc";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
import {
  useEditingCell,
  useHandleCellBlur,
  useHandleCellChange,
  useHandleCellFocus,
  useSetEditingCell,
} from "@/stores/data-store";
import {
  useIsSelecting,
  useSelectedCell,
  useSelectedCells,
  useSelectionArea,
  useSelectionStart,
} from "@/stores/selection-store";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal()),
    useLiveTable: vi.fn(),
  })
);

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionArea: vi.fn(),
  useIsSelecting: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsCellLocked: vi.fn(() => () => false),
  useHandleCellFocus: vi.fn(),
  useHandleCellBlur: vi.fn(),
  useHandleCellChange: vi.fn(),
  useEditingCell: vi.fn(),
  useSetEditingCell: vi.fn(),
  useSetEditingHeaderIndex: vi.fn(),
  useHandleHeaderDoubleClick: vi.fn(() => {}),
}));

describe("LiveTableDisplay Cell Editing", () => {
  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  // V2 data structures
  const colIdN = crypto.randomUUID() as ColumnId;
  const colIdA = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colIdN, name: "name", width: DEFAULT_COL_WIDTH },
    { id: colIdA, name: "age", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colIdN, colIdA];

  const rowIdJD = crypto.randomUUID() as RowId;
  const rowIdJS = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowIdJD, rowIdJS];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowIdJD]: { [colIdN]: "John Doe", [colIdA]: "30" },
    [rowIdJS]: { [colIdN]: "Jane Smith", [colIdA]: "25" },
  };

  beforeEach(() => {
    vi.resetAllMocks();

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

    const baseLiveTableContext = getLiveTableMockValues({
      liveTableDocInstance,
      initialColumnDefinitions,
      initialColumnOrder,
      initialRowOrder,
      initialRowData,
    });

    vi.mocked(LiveTableProviderModule.useLiveTable).mockImplementation(() => ({
      ...(baseLiveTableContext as ReturnType<
        typeof LiveTableProviderModule.useLiveTable
      >),
    }));

    // Reset specific hook implementations for dataStore if they were changed in tests
    // This ensures a clean state for dataStore hooks that are commonly mocked per test.
    vi.mocked(useEditingCell).mockReturnValue(null);
    vi.mocked(useSetEditingCell).mockReturnValue(vi.fn());
    vi.mocked(useHandleCellFocus).mockReturnValue(vi.fn());
    vi.mocked(useHandleCellBlur).mockReturnValue(vi.fn());
    vi.mocked(useHandleCellChange).mockReturnValue(vi.fn());
    vi.mocked(useSelectionStart).mockReturnValue(vi.fn());
    vi.mocked(useSelectedCells).mockReturnValue([]);
  });

  afterEach(() => {
    yDoc.destroy();
  });

  it("handles cell interactions correctly - click behavior and edit mode", async () => {
    const user = userEvent.setup();

    // Mocks specific to this test
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockReturnValue(mockSelectionStart);

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);

    const mockHandleCellFocus = vi.fn(); // Correctly scoped mock for this test
    vi.mocked(useHandleCellFocus).mockReturnValue(mockHandleCellFocus);

    const mockHandleCellChange = vi.fn(); // Define and mock for the whole test scope
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);

    const mockHandleCellBlur = vi.fn(); // Define and mock for the whole test scope
    vi.mocked(useHandleCellBlur).mockReturnValue(mockHandleCellBlur);

    // useHandleCellChange and useHandleCellBlur use global mocks or are re-mocked if specific behavior is needed

    const { container, rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const cellInputJohnDoe = screen.getByDisplayValue("John Doe");
    expect(cellInputJohnDoe).toBeInTheDocument();

    await user.click(cellInputJohnDoe); // Click the INPUT itself

    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);
    expect(cellInputJohnDoe).not.toHaveFocus(); // Original assertion

    const tdJohnDoe = cellInputJohnDoe.closest("td");
    expect(tdJohnDoe).toBeInTheDocument();
    await user.dblClick(tdJohnDoe!); // Then double click the TD

    expect(mockSetEditingCell).toHaveBeenCalledWith({
      // Assertions for double click
      rowIndex: 0,
      colIndex: 0,
    });
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0); // Assert scoped mock

    vi.mocked(useEditingCell).mockReturnValue({
      // Simulate entering edit mode
      rowIndex: 0,
      colIndex: 0,
    });

    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
    const editingInput = editingTd!.querySelector(
      'input[type="text"]'
    ) as HTMLInputElement | null;
    expect(editingInput).toBeInTheDocument();
    expect(editingInput!.value).toBe("John Doe");

    // Mock useHandleCellChange for this specific part of the test
    // const mockHandleCellChangeScoped = vi.fn();
    // vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChangeScoped);

    fireEvent.change(editingInput!, { target: { value: "New Name" } });
    const headerNameForFirstCol = initialColumnDefinitions[0].name;
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      // Assert the test-scoped mock
      0,
      headerNameForFirstCol,
      "New Name"
    );

    // Mock useHandleCellBlur for this specific part of the test
    // const mockHandleCellBlurScoped = vi.fn();
    // vi.mocked(useHandleCellBlur).mockReturnValue(mockHandleCellBlurScoped);

    const cellInputJaneSmith = screen.getByDisplayValue("Jane Smith");
    await user.click(cellInputJaneSmith.closest("td")!); // Click another cell's TD

    expect(mockHandleCellBlur).toHaveBeenCalled(); // Assert the test-scoped mock
    expect(mockSelectionStart).toHaveBeenCalledWith(1, 0); // New selection should start
  });

  it("enters edit mode immediately when typing a character on selected cell", async () => {
    const user = userEvent.setup();

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockHandleCellFocus = vi.fn();
    vi.mocked(useHandleCellFocus).mockReturnValue(mockHandleCellFocus);
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockReturnValue(mockSelectionStart);

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    const { rerender, container } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // First select a cell by clicking on it
    const cellToClick = screen.getByDisplayValue("John Doe");
    await user.click(cellToClick);
    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);

    // Explicitly mock the direct dependencies of handleKeyDown for this state
    vi.mocked(useEditingCell).mockReturnValue(null); // Ensure not editing
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]); // Ensure single cell selected
    const mockCurrentSelectedCell = { rowIndex: 0, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(mockCurrentSelectedCell);
    vi.mocked(useSelectionArea).mockReturnValue({
      startCell: mockCurrentSelectedCell,
      endCell: mockCurrentSelectedCell,
    });
    vi.mocked(useIsSelecting).mockReturnValue(false);

    // Ensure no input element within the cell has focus before keydown
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Clear mocks that might have been called by click
    mockSetEditingCell.mockClear();
    mockHandleCellChange.mockClear();
    mockHandleCellFocus.mockClear();

    // Mock the selection state to simulate a single cell being selected
    // This simulates that the click above resulted in cell (0,0) being selected
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    rerender(
      // Rerender for useSelectedCells mock to take effect if needed by internal logic
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Type a character
    fireEvent.keyDown(document, { key: "A" });

    // Should enter edit mode and append the character to existing content
    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);
    const headerNameForFirstCol = initialColumnDefinitions[0].name; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "John DoeA" // Appended to existing content
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
  });

  it("enters edit mode and removes last character when pressing backspace on selected cell", async () => {
    const user = userEvent.setup();

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockHandleCellFocus = vi.fn();
    vi.mocked(useHandleCellFocus).mockReturnValue(mockHandleCellFocus);
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockReturnValue(mockSelectionStart);

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    const { rerender, container } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // First select a cell by clicking on it
    const cellToClickBackspace = screen.getByDisplayValue("John Doe");
    await user.click(cellToClickBackspace);
    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);

    // Explicitly mock the direct dependencies of handleKeyDown for this state
    vi.mocked(useEditingCell).mockReturnValue(null); // Ensure not editing
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]); // Ensure single cell selected

    const mockCurrentSelectedCell = { rowIndex: 0, colIndex: 0 };
    vi.mocked(useSelectedCell).mockReturnValue(mockCurrentSelectedCell);
    vi.mocked(useSelectedCells).mockReturnValue([mockCurrentSelectedCell]);
    vi.mocked(useSelectionArea).mockReturnValue({
      startCell: mockCurrentSelectedCell,
      endCell: mockCurrentSelectedCell,
    });
    vi.mocked(useIsSelecting).mockReturnValue(false);

    // Ensure no input element within the cell has focus before keydown
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Clear mocks
    mockSetEditingCell.mockClear();
    mockHandleCellChange.mockClear();
    mockHandleCellFocus.mockClear();

    // Mock the selection state
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Press backspace
    fireEvent.keyDown(document, { key: "Backspace" });

    // Should enter edit mode and remove the last character
    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);
    const headerNameForFirstCol = initialColumnDefinitions[0].name; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "John Do" // Removed last character
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
  });

  it("does not enter edit mode when typing if multiple cells are selected", async () => {
    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockHandleCellFocus = vi.fn();
    vi.mocked(useHandleCellFocus).mockReturnValue(mockHandleCellFocus);

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    // Mock the selection state to simulate multiple cells being selected
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ]);

    const { container } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Type a character
    if (container.firstChild) {
      fireEvent.keyDown(container.firstChild as HTMLElement, { key: "A" });
    } else {
      throw new Error("Test setup error: container.firstChild is null");
    }

    // Should NOT enter edit mode when multiple cells are selected
    expect(mockSetEditingCell).not.toHaveBeenCalled();
    expect(mockHandleCellFocus).not.toHaveBeenCalled();
    expect(mockHandleCellChange).not.toHaveBeenCalled();
  });

  it("handles backspace on empty cell correctly", async () => {
    const user = userEvent.setup();

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockHandleCellFocus = vi.fn();
    vi.mocked(useHandleCellFocus).mockReturnValue(mockHandleCellFocus);
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockReturnValue(mockSelectionStart);

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    // Create specific data for this test
    const localInitialRowData = JSON.parse(JSON.stringify(initialRowData));
    localInitialRowData[rowIdJD][colIdN] = ""; // Set John Doe's name to empty

    // Update yDoc to reflect this change for TestDataStoreWrapper
    const yRowMapForJD = liveTableDocInstance.yRowData.get(rowIdJD);
    if (yRowMapForJD) {
      yRowMapForJD.set(colIdN, "");
    }

    const localLiveTableContext = getLiveTableMockValues({
      liveTableDocInstance, // yDoc is implicitly used by this instance
      initialColumnDefinitions,
      initialColumnOrder,
      initialRowOrder,
      initialRowData: localInitialRowData,
    });

    // Temporarily override the useLiveTable mock for this test
    const originalUseLiveTableMock = LiveTableProviderModule.useLiveTable;
    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      ...(localLiveTableContext as ReturnType<
        typeof LiveTableProviderModule.useLiveTable
      >),
    });

    const { rerender, container } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Select the (now empty) cell (0,0)
    const cellToClickEmpty = screen.getByDisplayValue("");
    await user.click(cellToClickEmpty);
    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);

    // Explicitly mock the direct dependencies of handleKeyDown for this state
    vi.mocked(useEditingCell).mockReturnValue(null); // Ensure not editing
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]); // Ensure single cell selected

    const mockCurrentSelectedCellEmpty = { rowIndex: 0, colIndex: 0 }; // Variable name changed to avoid conflict
    vi.mocked(useSelectedCell).mockReturnValue(mockCurrentSelectedCellEmpty);
    vi.mocked(useSelectedCells).mockReturnValue([mockCurrentSelectedCellEmpty]);
    vi.mocked(useSelectionArea).mockReturnValue({
      startCell: mockCurrentSelectedCellEmpty,
      endCell: mockCurrentSelectedCellEmpty,
    });
    vi.mocked(useIsSelecting).mockReturnValue(false);

    // Ensure no input element within the cell has focus before keydown
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    // Clear mocks
    mockSetEditingCell.mockClear();
    mockHandleCellChange.mockClear();
    mockHandleCellFocus.mockClear();

    // Mock the selection state
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    rerender(
      // Rerender for useSelectedCells mock to take effect
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Press backspace on empty cell
    fireEvent.keyDown(document, { key: "Backspace" });

    // Should enter edit mode and keep the cell empty
    expect(mockSetEditingCell).toHaveBeenCalledWith({
      rowIndex: 0,
      colIndex: 0,
    });
    expect(mockHandleCellFocus).toHaveBeenCalledWith(0, 0);
    const headerNameForFirstCol = initialColumnDefinitions[0].name; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "" // Empty string remains empty
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();

    // Restore original useLiveTable mock if it was changed for this test
    vi.mocked(LiveTableProviderModule.useLiveTable).mockImplementation(
      originalUseLiveTableMock
    );
  });
});
