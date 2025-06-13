/**
 * Example of a simple test setup, including manual push for a hook.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  act,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import {
  useIsSelectingMock,
  useIsSelectingPush,
} from "@/__tests__/test-utils/useIsSelecting";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import {
  CellValue,
  ColumnId,
  RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useEditingCell,
  useHeaders,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";
import {
  useSelectionEnd,
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

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useEditingCell: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selectionStore")>()),
  useSelectionStartOrMove: vi.fn(),
  useSelectionEnd: vi.fn(),
  useIsSelecting: useIsSelectingMock,
  useSelectionArea: vi.fn(() => ({
    startCell: null,
    endCell: null,
  })),
}));

describe("LiveTableDisplay - Drag Selection", () => {
  const initialHeaders = ["Name", "Age", "City"];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { Name: "Alice", Age: "30", City: "New York" },
    [rowId2]: { Name: "Bob", Age: "24", City: "Los Angeles" },
    [rowId3]: { Name: "Charlie", Age: "35", City: "Chicago" },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

    // table loaded
    vi.mocked(useIsTableLoaded).mockImplementation(() => true);
    vi.mocked(useEditingCell).mockImplementation(() => null);
    vi.mocked(useHeaders).mockImplementation(() => initialHeaders);
    vi.mocked(useTableData).mockImplementation(() =>
      Object.values(initialRowData)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should start selection when mousedown on a cell (not in edit mode)", () => {
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockSelectionStartOrMove
    );
    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);
  });

  it("should not start selection when mousedown on a cell in edit mode", () => {
    vi.mocked(useEditingCell).mockImplementation(() => ({
      rowIndex: 0,
      colIndex: 0,
    }));
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockSelectionStartOrMove
    );
    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockSelectionStartOrMove).not.toHaveBeenCalled();
  });

  it("should update selection when mousemove over cells during selection", async () => {
    const mockSelectionStartOrMove = vi.fn();
    vi.mocked(useSelectionStartOrMove).mockImplementation(
      () => mockSelectionStartOrMove
    );

    const { rerender } = render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const firstCell = screen.getAllByTestId("table-cell")[0];
    const targetCell = screen.getAllByTestId("table-cell")[4];

    expect(targetCell.getAttribute("data-row-index")).toBe("1");
    expect(targetCell.getAttribute("data-col-index")).toBe("1");

    await act(async () => {
      fireEvent.mouseDown(firstCell);
    });

    // Explicitly rerender after mousedown state change
    act(() => {
      rerender(
        <TestDataStoreWrapper>
          <LiveTableDisplay />
        </TestDataStoreWrapper>
      );
    });

    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(0, 0, false);

    await act(async () => {
      useIsSelectingPush(true);
    });

    document.elementFromPoint = vi.fn((x, y) => {
      if (x === 123 && y === 456) {
        if (targetCell && targetCell.tagName === "TD") {
          return targetCell;
        }
        return null;
      }
      return null;
    });

    await act(async () => {
      fireEvent.mouseMove(document, { clientX: 123, clientY: 456 });
    });

    expect(mockSelectionStartOrMove).toHaveBeenCalledWith(1, 1, true);
  });

  it("should end selection when mouseup", async () => {
    useIsSelectingPush(true);
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    render(
      <TestDataStoreWrapper>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    fireEvent.mouseUp(document);
    expect(mockSelectionEnd).toHaveBeenCalled();
  });
});
