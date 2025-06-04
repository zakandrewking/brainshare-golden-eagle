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
import * as Y from "yjs";

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
import {
  CellValue,
  ColumnDefinition,
  ColumnId,
  LiveTableDoc,
  RowId,
} from "@/components/live-table/live-table-doc";
import LiveTableDisplay from "@/components/live-table/LiveTableDisplay";
import * as LiveTableProviderModule
  from "@/components/live-table/LiveTableProvider";
import { useEditingCell } from "@/stores/data-store";
import {
  useSelectionEnd,
  useSelectionMove,
  useSelectionStart,
} from "@/stores/selection-store";

import {
  getLiveTableMockValues,
  TestDataStoreWrapper,
} from "./liveTableTestUtils";

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/data-store")>()),
  useEditingCell: vi.fn(() => null),
}));

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/selection-store")>()),
  useSelectionStart: vi.fn(),
  useSelectionMove: vi.fn(),
  useSelectionEnd: vi.fn(),
  useIsSelecting: useIsSelectingMock,
}));

vi.mock(
  "@/components/live-table/LiveTableProvider",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/components/live-table/LiveTableProvider")
    >()),
    useLiveTable: vi.fn(),
  })
);

describe("LiveTableDisplay - Drag Selection", () => {
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const colId3 = crypto.randomUUID() as ColumnId;

  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Column1", width: 150 },
    { id: colId2, name: "Column2", width: 150 },
    { id: colId3, name: "Column3", width: 150 },
  ];
  const initialColumnOrder: ColumnId[] = [colId1, colId2, colId3];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: { [colId1]: "A1", [colId2]: "B1", [colId3]: "C1" },
    [rowId2]: { [colId1]: "A2", [colId2]: "B2", [colId3]: "C2" },
    [rowId3]: { [colId1]: "A3", [colId2]: "B3", [colId3]: "C3" },
  };

  let yDoc: Y.Doc;
  let liveTableDocInstance: LiveTableDoc;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();

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
  });

  afterEach(() => {
    vi.useRealTimers();
    yDoc.destroy();
  });

  it("should start selection when mousedown on a cell (not in edit mode)", () => {
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(() => mockSelectionStart);
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);
  });

  it("should not start selection when mousedown on a cell in edit mode", () => {
    vi.mocked(useEditingCell).mockImplementation(() => ({
      rowIndex: 0,
      colIndex: 0,
    }));
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(() => mockSelectionStart);
    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    const cell = screen.getAllByTestId("table-cell")[0];
    fireEvent.mouseDown(cell);
    expect(mockSelectionStart).not.toHaveBeenCalled();
  });

  it("should update selection when mousemove over cells during selection", async () => {
    const mockSelectionStart = vi.fn();
    vi.mocked(useSelectionStart).mockImplementation(() => mockSelectionStart);
    const mockHandleSelectionMove = vi.fn();
    vi.mocked(useSelectionMove).mockImplementation(
      () => mockHandleSelectionMove
    );
    const { rerender } = render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
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
        <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
          <LiveTableDisplay />
        </TestDataStoreWrapper>
      );
    });

    expect(mockSelectionStart).toHaveBeenCalledWith(0, 0);

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

    expect(mockHandleSelectionMove).toHaveBeenCalledWith(1, 1);
  });

  it("should end selection when mouseup", async () => {
    useIsSelectingPush(true);
    const mockSelectionEnd = vi.fn();
    vi.mocked(useSelectionEnd).mockImplementation(() => mockSelectionEnd);

    render(
      <TestDataStoreWrapper liveTableDoc={liveTableDocInstance}>
        <LiveTableDisplay />
      </TestDataStoreWrapper>
    );
    fireEvent.mouseUp(document);
    expect(mockSelectionEnd).toHaveBeenCalled();
  });
});
