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
import userEvent from "@testing-library/user-event";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnId,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useEditingCell,
  useHandleCellChange,
  useHeaders,
  useIsCellLockedFn,
  useIsTableLoaded,
  useSetEditingCell,
  useTableData,
} from "@/stores/dataStore";
import {
  useIsSelecting,
  useSelectedCell,
  useSelectedCells,
  useSelectionArea,
  useSelectionStartOrMove,
} from "@/stores/selectionStore";

import { TestDataStoreWrapper } from "./live-table-store-test-utils";

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

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCell: vi.fn(),
  useSelectedCells: vi.fn(),
  useSelectionStartOrMove: vi.fn(),
  useSelectionArea: vi.fn(() => ({
    startCell: null,
    endCell: null,
  })),
  useIsSelecting: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
  useIsCellLockedFn: vi.fn(),
  useHandleCellChange: vi.fn(),
  useEditingCell: vi.fn(),
  useSetEditingCell: vi.fn(),
  useSetEditingHeaderIndex: vi.fn(),
  useHandleHeaderDoubleClick: vi.fn(() => {}),
}));

describe("LiveTableDisplay Cell Editing", () => {
  const initialHeaders = ["name", "age"];
  const rowIdJD = crypto.randomUUID() as RowId;
  const rowIdJS = crypto.randomUUID() as RowId;
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowIdJD]: { name: "John Doe", age: "30" },
    [rowIdJS]: { name: "Jane Smith", age: "25" },
  };

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLockedFn).mockImplementation(() => () => false);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));

    // Reset specific hook implementations for dataStore if they were changed in tests
    // This ensures a clean state for dataStore hooks that are commonly mocked per test.
    vi.mocked(useEditingCell).mockReturnValue(null);
    vi.mocked(useSetEditingCell).mockReturnValue(vi.fn());
    vi.mocked(useHandleCellChange).mockReturnValue(vi.fn());
    vi.mocked(useSelectionStartOrMove).mockReturnValue(vi.fn());
    vi.mocked(useSelectedCells).mockReturnValue([]);
  });

  it("handles cell interactions correctly - click behavior and edit mode", async () => {
    const user = userEvent.setup();

    // Mocks specific to this test
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockReturnValue(
      mockSelectionStartOrMove
    );

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);

    const mockHandleCellChange = vi.fn(); // Define and mock for the whole test scope
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);

    const { container, rerender } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const cellJohnDoe = screen.getByText("John Doe");
    expect(cellJohnDoe).toBeInTheDocument();

    await user.click(cellJohnDoe); // Click the text content

    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);
    expect(cellJohnDoe).not.toHaveFocus(); // Original assertion

    const tdJohnDoe = cellJohnDoe.closest("td");
    expect(tdJohnDoe).toBeInTheDocument();
    await user.dblClick(tdJohnDoe!); // Then double click the TD

    expect(mockSetEditingCell).toHaveBeenCalledWith({
      // Assertions for double click
      rowIndex: 0,
      colIndex: 0,
    });

    vi.mocked(useEditingCell).mockReturnValue({
      // Simulate entering edit mode
      rowIndex: 0,
      colIndex: 0,
    });

    rerender(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
    const editingTextarea = editingTd!.querySelector(
      "textarea"
    ) as HTMLTextAreaElement | null;
    expect(editingTextarea).toBeInTheDocument();
    expect(editingTextarea!.value).toBe("John Doe");

    // Mock useHandleCellChange for this specific part of the test
    // const mockHandleCellChangeScoped = vi.fn();
    // vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChangeScoped);

    fireEvent.change(editingTextarea!, { target: { value: "New Name" } });
    const headerNameForFirstCol = initialHeaders[0];
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      // Assert the test-scoped mock
      0,
      headerNameForFirstCol,
      "New Name"
    );

    const cellJaneSmith = screen.getByText("Jane Smith");
    await user.click(cellJaneSmith.closest("td")!); // Click another cell's TD

    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(1, 0, false); // New selection should start
  });

  it("enters edit mode immediately when typing a character on selected cell", async () => {
    const user = userEvent.setup();

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockReturnValue(
      mockSelectionStartOrMove
    );

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    const { rerender, container } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // First select a cell by clicking on it
    const cellToClick = screen.getByText("John Doe");
    await user.click(cellToClick);
    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);

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

    // Mock the selection state to simulate a single cell being selected
    // This simulates that the click above resulted in cell (0,0) being selected
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);

    rerender(
      // Rerender for useSelectedCells mock to take effect if needed by internal logic
      <TestDataStoreWrapper>
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
    const headerNameForFirstCol = initialHeaders[0]; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "John DoeA" // Appended to existing content
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper>
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
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockReturnValue(
      mockSelectionStartOrMove
    );

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    const { rerender, container } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // First select a cell by clicking on it
    const cellToClickBackspace = screen.getByText("John Doe");
    await user.click(cellToClickBackspace);
    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);

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

    // Mock the selection state
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    rerender(
      <TestDataStoreWrapper>
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
    const headerNameForFirstCol = initialHeaders[0]; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "John Do" // Removed last character
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper>
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

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    // Mock the selection state to simulate multiple cells being selected
    vi.mocked(useSelectedCells).mockReturnValue([
      { rowIndex: 0, colIndex: 0 },
      { rowIndex: 0, colIndex: 1 },
      { rowIndex: 1, colIndex: 0 },
      { rowIndex: 1, colIndex: 1 },
    ]);

    const { container } = render(
      <TestDataStoreWrapper>
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
    expect(mockHandleCellChange).not.toHaveBeenCalled();
  });

  it("handles backspace on empty cell correctly", async () => {
    const user = userEvent.setup();

    const mockSetEditingCell = vi.fn();
    vi.mocked(useSetEditingCell).mockReturnValue(mockSetEditingCell);
    const mockHandleCellChange = vi.fn();
    vi.mocked(useHandleCellChange).mockReturnValue(mockHandleCellChange);
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockReturnValue(
      mockSelectionStartOrMove
    );

    vi.mocked(useEditingCell).mockReturnValue(null); // Initially not editing

    // Create specific data for this test
    const localInitialRowData = JSON.parse(JSON.stringify(initialRowData));
    localInitialRowData[rowIdJD][initialHeaders[0]] = ""; // Set John Doe's name to empty
    vi.mocked(useTableData).mockReturnValue(Object.values(localInitialRowData));

    const { rerender, container } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    // Select the (now empty) cell (0,0) - empty cells display non-breaking space in div
    const cellToClickEmpty = container.querySelector(
      '[data-row-index="0"][data-col-index="0"]'
    ) as HTMLElement;
    await user.click(cellToClickEmpty);
    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);

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

    // Mock the selection state
    vi.mocked(useSelectedCells).mockReturnValue([{ rowIndex: 0, colIndex: 0 }]);
    rerender(
      // Rerender for useSelectedCells mock to take effect
      <TestDataStoreWrapper>
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
    const headerNameForFirstCol = initialHeaders[0]; // "name"
    expect(mockHandleCellChange).toHaveBeenCalledWith(
      0,
      headerNameForFirstCol,
      "" // Empty string remains empty
    );

    // Verify UI changes to editing mode
    vi.mocked(useEditingCell).mockReturnValue({ rowIndex: 0, colIndex: 0 });
    rerender(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const editingTd = container.querySelector('td[data-editing="true"]');
    expect(editingTd).toBeInTheDocument();
  });
});
