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

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import { LiveTableDoc as ActualLiveTableDoc } from "@/components/live-table/LiveTableDoc";
import {
  type LiveTableContextType,
  useLiveTable,
} from "@/components/live-table/LiveTableProvider";

// Mock the useLiveTable hook
vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

// Mock LiveTableDoc to spy on editHeader
const mockEditHeader = vi.fn();
vi.mock("@/components/live-table/LiveTableDoc", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/live-table/LiveTableDoc")
  >("@/components/live-table/LiveTableDoc");
  return {
    ...actual,
    LiveTableDoc: vi.fn().mockImplementation((yDoc) => {
      const instance = new actual.LiveTableDoc(yDoc);
      instance.editHeader = mockEditHeader; // Augment the real instance
      return instance;
    }),
  };
});

describe("LiveTableDisplay Header Editing", () => {
  let mockHandleHeaderDoubleClick: ReturnType<typeof vi.fn>;
  let mockHandleHeaderChange: ReturnType<typeof vi.fn>;
  let mockHandleHeaderBlur: ReturnType<typeof vi.fn>;
  let mockHandleHeaderKeyDown: ReturnType<typeof vi.fn>;

  // To store the state that LiveTableDisplay would get from the provider
  let currentEditingHeaderIndex: number | null = null;
  let currentEditingHeaderValue: string = "";

  const initialHeaders = ["Name", "Age"];
  const initialTableData = [
    { Name: "Alice", Age: "30" },
    { Name: "Bob", Age: "24" },
  ];
  let yDoc: Y.Doc;
  let liveTableDocInstance: ActualLiveTableDoc; // Use the actual type now

  beforeEach(() => {
    vi.clearAllMocks();

    yDoc = new Y.Doc();
    // The mock factory for LiveTableDoc will be used here
    liveTableDocInstance = new (vi.mocked(ActualLiveTableDoc))(yDoc);

    // Initialize Yjs state for consistency if needed by underlying logic called by editHeader
    const yHeaders = yDoc.getArray<string>("tableHeaders");
    yHeaders.insert(0, initialHeaders);
    const yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    initialTableData.forEach((rowData) => {
      const yRow = new Y.Map<unknown>();
      Object.entries(rowData).forEach(([key, value]) => {
        yRow.set(key, value);
      });
      yTable.push([yRow]);
    });

    currentEditingHeaderIndex = null;
    currentEditingHeaderValue = "";

    mockHandleHeaderDoubleClick = vi.fn((index) => {
      act(() => {
        currentEditingHeaderIndex = index;
        currentEditingHeaderValue = initialHeaders[index];
      });
    });
    mockHandleHeaderChange = vi.fn(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        // Added type
        act(() => {
          currentEditingHeaderValue = event.target.value;
        });
      }
    );

    mockHandleHeaderBlur = vi.fn(() => {
      act(() => {
        if (
          currentEditingHeaderIndex !== null &&
          currentEditingHeaderValue.trim() &&
          currentEditingHeaderValue.trim() !==
            initialHeaders[currentEditingHeaderIndex!]
        ) {
          liveTableDocInstance.editHeader(
            currentEditingHeaderIndex!,
            currentEditingHeaderValue.trim()
          );
        }
        currentEditingHeaderIndex = null;
      });
    });

    mockHandleHeaderKeyDown = vi.fn(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        // Added type
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

    (useLiveTable as MockedFunction<typeof useLiveTable>).mockImplementation(
      () =>
        ({
          tableData: initialTableData,
          headers: initialHeaders,
          columnWidths: { Name: 150, Age: 100 },
          handleCellChange: vi.fn(),
          handleCellFocus: vi.fn(),
          handleCellBlur: vi.fn(),
          editingHeaderIndex: currentEditingHeaderIndex,
          editingHeaderValue: currentEditingHeaderValue,
          handleHeaderDoubleClick: mockHandleHeaderDoubleClick,
          handleHeaderChange: mockHandleHeaderChange,
          handleHeaderBlur: mockHandleHeaderBlur,
          handleHeaderKeyDown: mockHandleHeaderKeyDown,
          handleColumnResize: vi.fn(),
          selectedCell: null,
          handleSelectionStart: vi.fn(),
          handleSelectionMove: vi.fn(),
          handleSelectionEnd: vi.fn(),
          isSelecting: false,
          isCellSelected: vi.fn().mockReturnValue(false),
          yDoc: yDoc,
          yTable: yDoc.getArray("tableData"),
          yHeaders: yDoc.getArray("tableHeaders"),
          yColWidths: yDoc.getMap("colWidths"),
          undoManager: new Y.UndoManager([yDoc.getArray("tableData")]),
          tableId: "test-table",
          isTableLoaded: true,
          selectionArea: { startCell: null, endCell: null },
          selectedCells: [],
          clearSelection: vi.fn(),
          getSelectedCellsData: vi.fn().mockReturnValue([]),
          editingCell: null,
          setEditingCell: vi.fn(),
          liveTableDoc: liveTableDocInstance,
        } as LiveTableContextType)
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should enter edit mode on header double-click and display input", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);

    const headerCellDiv = screen.getByText(initialHeaders[0]).closest("div"); // Get the div inside th
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);

    expect(mockHandleHeaderDoubleClick).toHaveBeenCalledWith(0);

    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${initialHeaders[0]}-editing`
    ) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe(initialHeaders[0]);
  });

  it("should update header value on input change", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);

    const headerCellDiv = screen.getByText(initialHeaders[0]).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${initialHeaders[0]}-editing`
    ) as HTMLInputElement;
    const newHeaderText = "New Header Name";

    fireEvent.change(input, { target: { value: newHeaderText } });

    expect(mockHandleHeaderChange).toHaveBeenCalled();
    rerender(<LiveTableDisplay />);
    expect(input.value).toBe(newHeaderText);
  });

  it("should save header changes on blur", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);
    const headerIndexToEdit = 0;
    const newHeaderText = "Updated Name";

    const headerCellDiv = screen
      .getByText(initialHeaders[headerIndexToEdit])
      .closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${initialHeaders[headerIndexToEdit]}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: newHeaderText } });
    rerender(<LiveTableDisplay />);

    await act(async () => {
      fireEvent.blur(input);
    });

    expect(mockHandleHeaderBlur).toHaveBeenCalled();
    expect(mockEditHeader).toHaveBeenCalledWith(
      headerIndexToEdit,
      newHeaderText
    );
  });

  it("should save header changes on Enter key press", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);
    const headerIndexToEdit = 0;
    const newHeaderText = "Confirmed Name";

    const headerCellDiv = screen
      .getByText(initialHeaders[headerIndexToEdit])
      .closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${initialHeaders[headerIndexToEdit]}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: newHeaderText } });

    await user.keyboard("{Enter}");

    expect(mockHandleHeaderKeyDown).toHaveBeenCalled();
    expect(mockHandleHeaderBlur).toHaveBeenCalled();
    expect(mockEditHeader).toHaveBeenCalledWith(
      headerIndexToEdit,
      newHeaderText
    );

    const updatedHeaderCellTh =
      screen.getAllByRole("columnheader")[headerIndexToEdit];
    expect(
      within(updatedHeaderCellTh).queryByRole("textbox")
    ).not.toBeInTheDocument();
  });

  it("should cancel header edit on Escape key press", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<LiveTableDisplay />);
    const headerIndexToEdit = 0;
    const originalHeaderText = initialHeaders[headerIndexToEdit];

    const headerCellDiv = screen.getByText(originalHeaderText).closest("div");
    expect(headerCellDiv).toBeInTheDocument();
    await user.dblClick(headerCellDiv!);
    rerender(<LiveTableDisplay />);

    const input = screen.getByTestId(
      `${originalHeaderText}-editing`
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "Temporary Change" } });
    rerender(<LiveTableDisplay />);

    await user.keyboard("{Escape}");

    expect(mockHandleHeaderKeyDown).toHaveBeenCalled();
    expect(mockEditHeader).not.toHaveBeenCalled();

    rerender(<LiveTableDisplay />);
    const updatedHeaderCellTh =
      screen.getAllByRole("columnheader")[headerIndexToEdit];
    expect(
      within(updatedHeaderCellTh).queryByRole("textbox")
    ).not.toBeInTheDocument();
  });
});
