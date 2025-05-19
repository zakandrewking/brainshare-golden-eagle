import "@testing-library/jest-dom";

import React from "react";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { fireEvent, render, screen } from "@testing-library/react";

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

import { getLiveTableMockValues } from "./liveTableTestUtils";

vi.mock("@/components/live-table/LiveTableProvider", () => ({
  useLiveTable: vi.fn(),
}));

const mockedUseLiveTable = vi.mocked(useLiveTable);

describe("LiveTableDisplay (referred to as LiveTable in its own file)", () => {
  const mockClearSelection = vi.fn();

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
        clearSelection: mockClearSelection,
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    yDoc.destroy();
  });

  it("should clear selection when clicking outside the table", async () => {
    mockedUseLiveTable.mockReturnValueOnce(
      getLiveTableMockValues({
        liveTableDocInstance,
        selectedCell: { rowIndex: 0, colIndex: 0 },
        isCellSelected: vi.fn(
          (rowIndex, colIndex) => rowIndex === 0 && colIndex === 0
        ),
        clearSelection: mockClearSelection,
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
    expect(mockClearSelection).toHaveBeenCalledTimes(1);
    expect(captureClick).toHaveBeenCalledTimes(1);
  });

  it("should not clear selection when clicking inside the table", () => {
    mockedUseLiveTable.mockReturnValueOnce(
      getLiveTableMockValues({
        liveTableDocInstance,
        selectedCell: { rowIndex: 0, colIndex: 0 },
        isCellSelected: vi.fn(
          (rowIndex, colIndex) => rowIndex === 0 && colIndex === 0
        ),
        clearSelection: mockClearSelection,
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

    expect(mockClearSelection).not.toHaveBeenCalled();
  });
});
