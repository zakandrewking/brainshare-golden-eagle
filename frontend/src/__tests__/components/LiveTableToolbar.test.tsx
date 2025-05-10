import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen } from "@testing-library/react";

import * as ActionsModule from "@/components/live-table/actions";
import * as LiveTableProviderModule from "@/components/live-table/LiveTableProvider";
import LiveTableToolbar from "@/components/live-table/LiveTableToolbar";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

vi.mock("@/components/live-table/actions", () => ({
  generateNewColumn: vi.fn().mockResolvedValue({
    newHeader: "AI Column",
    newColumnData: ["value1", "value2"],
  }),
}));

describe("LiveTableToolbar - Add Column Buttons", () => {
  const mockYDoc = new Y.Doc();
  const mockYHeaders = mockYDoc.getArray<string>("headers");
  const mockYTable = mockYDoc.getArray<Y.Map<unknown>>("table");
  const mockUndoManager = new Y.UndoManager([mockYHeaders, mockYTable]);
  const mockTransact = vi.fn((fn) => fn());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockYDoc.transact = mockTransact;

    vi.mocked(LiveTableProviderModule.useLiveTable).mockReturnValue({
      yDoc: mockYDoc,
      yHeaders: mockYHeaders,
      yTable: mockYTable,
      undoManager: mockUndoManager,
      isTableLoaded: true,
      selectedCell: { rowIndex: 0, colIndex: 0 },
      tableId: "test-table",
      tableData: [{ "Column 1": "data1", "Column 2": "data2" }],
      headers: ["Column 1", "Column 2"],
      columnWidths: {},
      handleCellChange: vi.fn(),
      handleCellFocus: vi.fn(),
      handleCellBlur: vi.fn(),
      editingHeaderIndex: null,
      editingHeaderValue: "",
      handleHeaderDoubleClick: vi.fn(),
      handleHeaderChange: vi.fn(),
      handleHeaderBlur: vi.fn(),
      handleHeaderKeyDown: vi.fn(),
      handleColumnResize: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should add a column to the left when the add left button is clicked", async () => {
    render(<LiveTableToolbar />);

    const addLeftButton = screen.getByRole("button", {
      name: "Add column to the left",
    });

    expect(addLeftButton).toBeDefined();

    fireEvent.mouseDown(addLeftButton);

    expect(vi.mocked(ActionsModule.generateNewColumn)).toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(mockTransact).toHaveBeenCalled();
  });
});
