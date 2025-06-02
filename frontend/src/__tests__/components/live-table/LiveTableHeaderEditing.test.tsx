import React from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  MockedFunction,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  type LiveTableContextType,
  useLiveTable,
} from "@/components/live-table/LiveTableProvider";
import {
  type SelectionState,
  useSelectionStore,
} from "@/stores/selectionStore";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

// Mock the useLiveTable hook
vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock the dataStore hooks
vi.mock("@/stores/dataStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores/dataStore")>();
  return {
    ...actual,
    useIsCellLocked: () => vi.fn(() => false),
  };
});

// Mock the selectionStore hooks
vi.mock("@/stores/selectionStore", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/stores/selectionStore")
  >();
  return {
    ...actual,
    useSelectionStore: vi.fn(),
  };
});

describe("LiveTableDisplay Header Editing", () => {
  let mockHandleHeaderDoubleClick: ReturnType<typeof vi.fn>;
  let mockHandleHeaderChange: ReturnType<typeof vi.fn>;
  let mockHandleHeaderBlur: ReturnType<typeof vi.fn>;
  let mockHandleHeaderKeyDown: ReturnType<typeof vi.fn>;

  let currentEditingHeaderIndex: number | null = null;
  let currentEditingHeaderValue: string = "";

  // V2 data structures
  const colIdN = crypto.randomUUID() as ColumnId;
  const colIdA = crypto.randomUUID() as ColumnId;
  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colIdN, name: "Name", width: DEFAULT_COL_WIDTH },
    { id: colIdA, name: "Age", width: DEFAULT_COL_WIDTH },
  ];
  const initialColumnOrder: ColumnId[] = [colIdN, colIdA];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2];
  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colIdN]: "Alice", [colIdA]: "30" },
    [rowId2]: { [colIdN]: "Bob", [colIdA]: "24" },
  };

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;
  let editHeaderSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock useSelectionStore
    vi.mocked(useSelectionStore).mockImplementation(
      <TState = SelectionState,>(
        selector?: (state: SelectionState) => TState
      ): TState | SelectionState => {
        const state: SelectionState = {
          selectedCell: null,
          selectionArea: { startCell: null, endCell: null },
          isSelecting: false,
          setSelectedCell: vi.fn(),
          startSelection: vi.fn(),
          moveSelection: vi.fn(),
          endSelection: vi.fn(),
          clearSelection: vi.fn(),
        };
        if (selector) {
          return selector(state);
        }
        return state;
      }
    );

    yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);
    // Manually populate V2 data for the instance
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

    editHeaderSpy = vi.spyOn(liveTableDocInstance, "editHeader");

    currentEditingHeaderIndex = null;
    currentEditingHeaderValue = "";

    mockHandleHeaderDoubleClick = vi.fn((index) => {
      act(() => {
        currentEditingHeaderIndex = index;
        const colId = liveTableDocInstance.yColumnOrder.get(index);
        currentEditingHeaderValue =
          liveTableDocInstance.yColumnDefinitions.get(colId!)?.name || "";
      });
    });
    mockHandleHeaderChange = vi.fn(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        act(() => {
          currentEditingHeaderValue = event.target.value;
        });
      }
    );

    mockHandleHeaderBlur = vi.fn(() => {
      act(() => {
        if (
          currentEditingHeaderIndex !== null &&
          currentEditingHeaderValue.trim()
        ) {
          const colId = liveTableDocInstance.yColumnOrder.get(
            currentEditingHeaderIndex as number
          );
          const currentNameInDoc = liveTableDocInstance.yColumnDefinitions.get(
            colId as ColumnId
          )?.name;
          if (currentEditingHeaderValue.trim() !== currentNameInDoc) {
            liveTableDocInstance.editHeader(
              currentEditingHeaderIndex as number,
              currentEditingHeaderValue.trim()
            );
          }
        }
        currentEditingHeaderIndex = null;
      });
    });

    mockHandleHeaderKeyDown = vi.fn(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault();
          mockHandleHeaderBlur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          act(() => {
            currentEditingHeaderIndex = null;
          });
        }
      }
    );

    const baseMock = getLiveTableMockValues({
      liveTableDocInstance,
    });

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...baseMock,
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
          handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
          handleHeaderChange: mockHandleHeaderChange,
          handleHeaderBlur: mockHandleHeaderBlur,
          handleHeaderKeyDown: mockHandleHeaderKeyDown,
        } as LiveTableContextType)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (editHeaderSpy) editHeaderSpy.mockRestore();
    yDoc.destroy();
  });

  it("should enter edit mode on header double-click and display input", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const headerNameForTest = initialColumnDefinitions[0].name; // "Name"

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(0);

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe(headerNameForTest);
  });

  it("should update header value on input change", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerNameForTest = initialColumnDefinitions[0].name; // "Name"

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;
    const newHeaderText = "New Header Name";

    fireEvent.change(input, { target: { value: newHeaderText } });
    expect(mockHandleHeaderChange).toHaveBeenCalled();

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    expect(input.value).toBe(newHeaderText);
  });

  it("should save header changes on blur by calling liveTableDoc.editHeader", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;
    const newHeaderText = "Updated Name";

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: newHeaderText } });
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(mockHandleHeaderBlur).toHaveBeenCalled();
    expect(editHeaderSpy).toHaveBeenCalledWith(
      headerIndexToEdit,
      newHeaderText
    );
  });

  it("should save header changes on Enter key press by calling liveTableDoc.editHeader", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);
    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;
    const newHeaderText = "Confirmed Name";

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: newHeaderText } });
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);

    await user.keyboard("{Enter}");

    expect(mockHandleHeaderKeyDown).toHaveBeenCalled();
    expect(mockHandleHeaderBlur).toHaveBeenCalled();
    expect(editHeaderSpy).toHaveBeenCalledWith(
      headerIndexToEdit,
      newHeaderText
    );

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: null,
          editingHeaderValue: "",
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);
    const updatedHeaderCellTh =
      screen.getAllByRole("columnheader")[headerIndexToEdit + 1];
    expect(
      within(updatedHeaderCellTh).queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  it("should cancel header edit on Escape key press", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);
    const headerIndexToEdit = 0;
    const headerNameForTest = initialColumnDefinitions[headerIndexToEdit].name;

    const headerCellDiv = screen.getByText(headerNameForTest).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${headerNameForTest}-editing`
    ) as HTMLInputElement;
    const originalValue = currentEditingHeaderValue;

    fireEvent.change(input, { target: { value: "Temporary Change" } });
    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);

    await user.keyboard("{Escape}");

    expect(mockHandleHeaderKeyDown).toHaveBeenCalled();
    expect(editHeaderSpy).not.toHaveBeenCalled();

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          ...getLiveTableMockValues({
            liveTableDocInstance,
            handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
            handleHeaderChange: mockHandleHeaderChange,
            handleHeaderBlur: mockHandleHeaderBlur,
            handleHeaderKeyDown: mockHandleHeaderKeyDown,
          }),
          editingHeaderIndex: null,
          editingHeaderValue: originalValue,
        } as LiveTableContextType)
    );
    rerender(<LiveTableDisplay />);
    const updatedHeaderCellTh =
      screen.getAllByRole("columnheader")[headerIndexToEdit + 1];
    expect(
      within(updatedHeaderCellTh).queryByRole("textbox")
    ).not.toBeInTheDocument();
    expect(screen.getByText(headerNameForTest)).toBeInTheDocument();
  });
});
