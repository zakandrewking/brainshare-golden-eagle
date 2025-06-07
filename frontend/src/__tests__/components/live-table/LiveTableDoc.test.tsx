import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { DEFAULT_COL_WIDTH } from "@/components/live-table/config";
import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("LiveTableDoc - V1 Migration and Basic V2 State", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();
    const yOldHeaders = yDoc.getArray<string>("tableHeaders");
    yOldHeaders.push(["V1HeaderA", "V1HeaderB"]);
    const yOldColWidths = yDoc.getMap<number>("colWidths");
    yOldColWidths.set("V1HeaderA", 100);
    yOldColWidths.set("V1HeaderB", 120);
    const yOldTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    const v1Row1 = new Y.Map<unknown>();
    v1Row1.set("V1HeaderA", "v1r1a");
    v1Row1.set("V1HeaderB", "v1r1b");
    const v1Row2 = new Y.Map<unknown>();
    v1Row2.set("V1HeaderA", "v1r2a");
    // Deliberately missing V1HeaderB in v1Row2 to test default empty string on migration
    yOldTable.push([v1Row1, v1Row2]);

    liveTableDoc = new LiveTableDoc(yDoc); // Migration to V2 happens here
  });

  it("should migrate V1 data to V2 schema correctly", () => {
    expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(2);
    expect(liveTableDoc.yColumnOrder.length).toBe(2);
    expect(liveTableDoc.yRowOrder.length).toBe(2);

    const colIdA = liveTableDoc.yColumnOrder.get(0);
    const colDefA = liveTableDoc.yColumnDefinitions.get(colIdA);
    expect(colDefA?.name).toBe("V1HeaderA");
    expect(colDefA?.width).toBe(100);

    const colIdB = liveTableDoc.yColumnOrder.get(1);
    const colDefB = liveTableDoc.yColumnDefinitions.get(colIdB);
    expect(colDefB?.name).toBe("V1HeaderB");
    expect(colDefB?.width).toBe(120);

    const rowId1 = liveTableDoc.yRowOrder.get(0);
    const row1Data = liveTableDoc.yRowData.get(rowId1);
    expect(row1Data?.get(colIdA)).toBe("v1r1a");
    expect(row1Data?.get(colIdB)).toBe("v1r1b");

    const rowId2 = liveTableDoc.yRowOrder.get(1);
    const row2Data = liveTableDoc.yRowData.get(rowId2);
    expect(row2Data?.get(colIdA)).toBe("v1r2a");
    expect(row2Data?.get(colIdB)).toBe(""); // Should be default empty string
  });

  it("should clear V1 data after migration if clearV1Data is called", () => {
    liveTableDoc.clearV1Data();
    expect(liveTableDoc.yTable.length).toBe(0);
    expect(liveTableDoc.yHeaders.length).toBe(0);
    expect(liveTableDoc.yColWidths.size).toBe(0);
    // V2 data should persist
    expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(2);
    expect(liveTableDoc.yColumnOrder.length).toBe(2);
  });
});

describe("LiveTableDoc - V2 Operations on Clean V2 State", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let colId1: ColumnId, colId2: ColumnId;
  let rowId1: RowId;

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();

    // Initialize V2 shared types on yDoc FIRST
    const yColumnDefinitions =
      yDoc.getMap<ColumnDefinition>("columnDefinitions");
    const yColumnOrder = yDoc.getArray<ColumnId>("columnOrder");
    const yRowData = yDoc.getMap<Y.Map<CellValue>>("rowData");
    const yRowOrder = yDoc.getArray<RowId>("rowOrder");
    const yMeta = yDoc.getMap<unknown>("metaData");

    colId1 = crypto.randomUUID() as ColumnId;
    colId2 = crypto.randomUUID() as ColumnId;
    rowId1 = crypto.randomUUID() as RowId;

    yDoc.transact(() => {
      yColumnDefinitions.set(colId1, {
        id: colId1,
        name: "ColA",
        width: DEFAULT_COL_WIDTH,
      });
      yColumnDefinitions.set(colId2, {
        id: colId2,
        name: "ColB",
        width: DEFAULT_COL_WIDTH,
      });
      yColumnOrder.push([colId1, colId2]);

      const r1Map = new Y.Map<CellValue>();
      r1Map.set(colId1, "r1a");
      r1Map.set(colId2, "r1b");
      yRowData.set(rowId1, r1Map);
      yRowOrder.push([rowId1]);
      yMeta.set("schemaVersion", 2); // Mark as V2
    });

    // Now instantiate LiveTableDoc. It should pick up existing V2 data.
    liveTableDoc = new LiveTableDoc(yDoc);
  });

  describe("insertRows (V2)", () => {
    it("should insert rows into yRowData and yRowOrder", () => {
      const initialRowCount = liveTableDoc.yRowOrder.length; // Should be 1
      const rowsToInsert = [
        { ColA: "newR2A", ColB: "newR2B" },
        { ColA: "newR3A", ColB: "newR3B" },
      ];

      const result = liveTableDoc.insertRows(1, rowsToInsert);
      expect(result).toBe(rowsToInsert.length);
      expect(liveTableDoc.yRowOrder.length).toBe(
        initialRowCount + rowsToInsert.length
      );

      const insertedRowId2 = liveTableDoc.yRowOrder.get(1);
      const insertedRowData2 = liveTableDoc.yRowData.get(insertedRowId2);
      expect(insertedRowData2?.get(colId1)).toBe("newR2A");
      expect(insertedRowData2?.get(colId2)).toBe("newR2B");

      const insertedRowId3 = liveTableDoc.yRowOrder.get(2);
      const insertedRowData3 = liveTableDoc.yRowData.get(insertedRowId3);
      expect(insertedRowData3?.get(colId1)).toBe("newR3A");
      expect(insertedRowData3?.get(colId2)).toBe("newR3B");
    });

    it("should return 0 if rowsData is empty", () => {
      const result = liveTableDoc.insertRows(0, []);
      expect(result).toBe(0);
    });
  });

  describe("deleteRows (V2)", () => {
    it("should delete rows from yRowData and yRowOrder", () => {
      const rowId2 = crypto.randomUUID() as RowId;
      const r2Map = new Y.Map<CellValue>();
      r2Map.set(colId1, "r2a");
      r2Map.set(colId2, "r2b");
      yDoc.transact(() => {
        liveTableDoc.yRowData.set(rowId2, r2Map); // Use liveTableDoc instance properties
        liveTableDoc.yRowOrder.push([rowId2]);
      });
      const initialRowCount = liveTableDoc.yRowOrder.length;

      const result = liveTableDoc.deleteRows([0]);
      expect(result).toBe(1);
      expect(liveTableDoc.yRowOrder.length).toBe(initialRowCount - 1);
      expect(liveTableDoc.yRowData.has(rowId1)).toBe(false);
      expect(liveTableDoc.yRowOrder.get(0)).toBe(rowId2);
    });
  });

  describe("editHeader (V2)", () => {
    it("should update column name in yColumnDefinitions", () => {
      const colIndexToEdit = 0;
      const originalColId = liveTableDoc.yColumnOrder.get(colIndexToEdit);
      const newHeaderName = "UpdatedColA";

      liveTableDoc.editHeader(colIndexToEdit, newHeaderName);

      const definition = liveTableDoc.yColumnDefinitions.get(originalColId);
      expect(definition?.name).toBe(newHeaderName);
    });
  });

  describe("insertColumns (V2)", () => {
    it("should insert columns and update existing rows", () => {
      const initialColCount = liveTableDoc.yColumnOrder.length;
      const columnsToInsert = [
        { headerName: "NewColX", columnData: ["xValForRow1"] },
      ];

      const result = liveTableDoc.insertColumns(1, columnsToInsert);
      expect(result).toBe(columnsToInsert.length);
      expect(liveTableDoc.yColumnOrder.length).toBe(initialColCount + 1);

      const newColId = liveTableDoc.yColumnOrder.get(1);
      const newColDef = liveTableDoc.yColumnDefinitions.get(newColId);
      expect(newColDef?.name).toBe("NewColX");

      const existingRowData = liveTableDoc.yRowData.get(rowId1);
      expect(existingRowData?.get(newColId)).toBe("xValForRow1");
    });
  });

  describe("deleteColumns (V2)", () => {
    it("should delete columns and update rows", () => {
      const initialColCount = liveTableDoc.yColumnOrder.length;
      const colIdToDelete = liveTableDoc.yColumnOrder.get(0);

      const result = liveTableDoc.deleteColumns([0]);
      expect(result).toBe(1);
      expect(liveTableDoc.yColumnOrder.length).toBe(initialColCount - 1);
      expect(liveTableDoc.yColumnDefinitions.has(colIdToDelete)).toBe(false);

      const existingRowData = liveTableDoc.yRowData.get(rowId1);
      expect(existingRowData?.has(colIdToDelete)).toBe(false);
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colId2);
    });
  });

  describe("reorderColumn (V2)", () => {
    it("should reorder columns correctly", () => {
      // Initial order: [colId1, colId2]
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colId1);
      expect(liveTableDoc.yColumnOrder.get(1)).toBe(colId2);

      // Move first column to second position
      liveTableDoc.reorderColumn(0, 1);

      // New order should be: [colId2, colId1]
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colId2);
      expect(liveTableDoc.yColumnOrder.get(1)).toBe(colId1);
    });

    it("should handle moving column to earlier position", () => {
      // Initial order: [colId1, colId2]
      // Move second column to first position
      liveTableDoc.reorderColumn(1, 0);

      // New order should be: [colId2, colId1]
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colId2);
      expect(liveTableDoc.yColumnOrder.get(1)).toBe(colId1);
    });

    it("should handle the specific case of moving between columns 3 and 4", () => {
      // Set up a table with 5 columns: [A, B, C, D, E]
      const colA = crypto.randomUUID() as ColumnId;
      const colB = crypto.randomUUID() as ColumnId;
      const colC = crypto.randomUUID() as ColumnId;
      const colD = crypto.randomUUID() as ColumnId;
      const colE = crypto.randomUUID() as ColumnId;

      yDoc.transact(() => {
        // Clear existing data
        liveTableDoc.yColumnOrder.delete(0, liveTableDoc.yColumnOrder.length);
        liveTableDoc.yColumnDefinitions.clear();

        // Set up 5 columns
        liveTableDoc.yColumnDefinitions.set(colA, {
          id: colA,
          name: "A",
          width: 150,
        });
        liveTableDoc.yColumnDefinitions.set(colB, {
          id: colB,
          name: "B",
          width: 150,
        });
        liveTableDoc.yColumnDefinitions.set(colC, {
          id: colC,
          name: "C",
          width: 150,
        });
        liveTableDoc.yColumnDefinitions.set(colD, {
          id: colD,
          name: "D",
          width: 150,
        });
        liveTableDoc.yColumnDefinitions.set(colE, {
          id: colE,
          name: "E",
          width: 150,
        });
        liveTableDoc.yColumnOrder.push([colA, colB, colC, colD, colE]);
      });

      // Initial order: [A, B, C, D, E] (indices 0, 1, 2, 3, 4)
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colA);
      expect(liveTableDoc.yColumnOrder.get(1)).toBe(colB);
      expect(liveTableDoc.yColumnOrder.get(2)).toBe(colC);
      expect(liveTableDoc.yColumnOrder.get(3)).toBe(colD);
      expect(liveTableDoc.yColumnOrder.get(4)).toBe(colE);

      // Move column A (index 0) to between columns C and D (final position should be index 3)
      // This simulates dragging A to after column C
      liveTableDoc.reorderColumn(0, 3);

      // Expected order: [B, C, D, A, E]
      expect(liveTableDoc.yColumnOrder.get(0)).toBe(colB);
      expect(liveTableDoc.yColumnOrder.get(1)).toBe(colC);
      expect(liveTableDoc.yColumnOrder.get(2)).toBe(colD);
      expect(liveTableDoc.yColumnOrder.get(3)).toBe(colA);
      expect(liveTableDoc.yColumnOrder.get(4)).toBe(colE);
    });

    it("should do nothing when moving to same position", () => {
      const originalOrder = liveTableDoc.yColumnOrder.toArray();

      liveTableDoc.reorderColumn(0, 0);

      expect(liveTableDoc.yColumnOrder.toArray()).toEqual(originalOrder);
    });

    it("should handle invalid indices gracefully", () => {
      const originalOrder = liveTableDoc.yColumnOrder.toArray();

      // Test out of bounds indices
      liveTableDoc.reorderColumn(-1, 0);
      liveTableDoc.reorderColumn(0, -1);
      liveTableDoc.reorderColumn(10, 0);
      liveTableDoc.reorderColumn(0, 10);

      expect(liveTableDoc.yColumnOrder.toArray()).toEqual(originalOrder);
    });
  });

  describe("updateColumnWidth (V2)", () => {
    it("should update column width in yColumnDefinitions", () => {
      const colNameToUpdate = "ColA";
      const newWidth = 250;

      liveTableDoc.updateColumnWidth(colNameToUpdate, newWidth);
      const definition = liveTableDoc.yColumnDefinitions.get(colId1);
      expect(definition?.width).toBe(newWidth);
    });
  });

  describe("updateCell (V2)", () => {
    it("should update cell value in yRowData", () => {
      const rowIndex = 0;
      const colName = "ColA";
      const newValue = "updatedNewValue";

      liveTableDoc.updateCell(rowIndex, colName, newValue);

      const rowData = liveTableDoc.yRowData.get(rowId1);
      expect(rowData?.get(colId1)).toBe(newValue);
    });
  });

  describe("sortRowsByColumn (V2)", () => {
    it("should sort rows ascending by column", () => {
      const rowId2 = crypto.randomUUID() as RowId;
      const r2Map = new Y.Map<CellValue>();
      r2Map.set(colId1, "b");
      r2Map.set(colId2, "b2");
      yDoc.transact(() => {
        liveTableDoc.yRowData.set(rowId2, r2Map);
        liveTableDoc.yRowOrder.push([rowId2]);
      });

      liveTableDoc.sortRowsByColumn("ColA", "asc");

      const firstRowId = liveTableDoc.yRowOrder.get(0);
      const firstRowData = liveTableDoc.yRowData.get(firstRowId);
      expect(firstRowData?.get(colId1)).toBe("b");
    });

    it("should sort rows descending by column", () => {
      const rowId2 = crypto.randomUUID() as RowId;
      const r2Map = new Y.Map<CellValue>();
      r2Map.set(colId1, "a");
      r2Map.set(colId2, "b2");
      yDoc.transact(() => {
        liveTableDoc.yRowData.set(rowId2, r2Map);
        liveTableDoc.yRowOrder.push([rowId2]);
      });

      liveTableDoc.sortRowsByColumn("ColA", "desc");

      const firstRowId = liveTableDoc.yRowOrder.get(0);
      const firstRowData = liveTableDoc.yRowData.get(firstRowId);
      expect(firstRowData?.get(colId1)).toBe("r1a");
    });
  });
});

describe("LiveTableDoc - V2 Sorting", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let colId1: ColumnId, colId2: ColumnId;

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();
    const yColumnDefinitions =
      yDoc.getMap<ColumnDefinition>("columnDefinitions");
    const yColumnOrder = yDoc.getArray<ColumnId>("columnOrder");
    const yRowData = yDoc.getMap<Y.Map<CellValue>>("rowData");
    const yRowOrder = yDoc.getArray<RowId>("rowOrder");
    const yMeta = yDoc.getMap<unknown>("metaData");

    colId1 = "col1-numeric";
    colId2 = "col2-string";

    yDoc.transact(() => {
      yColumnDefinitions.set(colId1, {
        id: colId1,
        name: "NumberColumn",
        width: 100,
      });
      yColumnDefinitions.set(colId2, {
        id: colId2,
        name: "StringColumn",
        width: 100,
      });
      yColumnOrder.push([colId1, colId2]);

      const rows = [
        { id: "row1", num: "10", str: "c" },
        { id: "row2", num: "2", str: "a" },
        { id: "row3", num: "5", str: "b" },
        { id: "row4", num: "", str: "d" }, // Empty string
        { id: "row5", num: "1", str: "e" },
      ];

      rows.forEach((row) => {
        const rowMap = new Y.Map<CellValue>();
        rowMap.set(colId1, row.num);
        rowMap.set(colId2, row.str);
        yRowData.set(row.id, rowMap);
        yRowOrder.push([row.id]);
      });

      yMeta.set("schemaVersion", 2);
    });

    liveTableDoc = new LiveTableDoc(yDoc);
  });

  it("should sort a numeric column ascending", () => {
    liveTableDoc.sortRowsByColumn("NumberColumn", "asc");

    const sortedRowOrder = liveTableDoc.yRowOrder.toArray();
    const sortedValues = sortedRowOrder.map(
      (rowId) => liveTableDoc.yRowData.get(rowId)?.get(colId1) || ""
    );
    // Empty strings should come first
    expect(sortedValues).toEqual(["", "1", "2", "5", "10"]);
  });

  it("should sort a numeric column descending", () => {
    liveTableDoc.sortRowsByColumn("NumberColumn", "desc");

    const sortedRowOrder = liveTableDoc.yRowOrder.toArray();
    const sortedValues = sortedRowOrder.map(
      (rowId) => liveTableDoc.yRowData.get(rowId)?.get(colId1) || ""
    );
    // Empty strings should come last
    expect(sortedValues).toEqual(["10", "5", "2", "1", ""]);
  });

  it("should sort a string column ascending", () => {
    liveTableDoc.sortRowsByColumn("StringColumn", "asc");

    const sortedRowOrder = liveTableDoc.yRowOrder.toArray();
    const sortedValues = sortedRowOrder.map(
      (rowId) => liveTableDoc.yRowData.get(rowId)?.get(colId2) || ""
    );
    expect(sortedValues).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("should handle mixed numeric and non-numeric content as strings", () => {
    // Add a non-numeric value to the numeric column
    const rowWithMixedDataId = liveTableDoc.yRowOrder.get(0); // "row1"
    const rowMap = liveTableDoc.yRowData.get(rowWithMixedDataId);
    rowMap?.set(colId1, "10a"); // This makes the column non-numeric

    liveTableDoc.sortRowsByColumn("NumberColumn", "asc");
    const sortedRowOrder = liveTableDoc.yRowOrder.toArray();
    const sortedValues = sortedRowOrder.map(
      (rowId) => liveTableDoc.yRowData.get(rowId)?.get(colId1) || ""
    );

    // Should sort as strings: "", "1", "10a", "2", "5"
    expect(sortedValues).toEqual(["", "1", "10a", "2", "5"].sort());
  });
});

describe("LiveTableDoc - V2 Locking", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let colId1: ColumnId, colId2: ColumnId;
  let rowId1: RowId, rowId2: RowId;

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();

    // Initialize V2 shared types on yDoc FIRST
    const yColumnDefinitions =
      yDoc.getMap<ColumnDefinition>("columnDefinitions");
    const yColumnOrder = yDoc.getArray<ColumnId>("columnOrder");
    const yRowData = yDoc.getMap<Y.Map<CellValue>>("rowData");
    const yRowOrder = yDoc.getArray<RowId>("rowOrder");
    const yMeta = yDoc.getMap<unknown>("metaData");

    colId1 = crypto.randomUUID() as ColumnId;
    colId2 = crypto.randomUUID() as ColumnId;
    rowId1 = crypto.randomUUID() as RowId;
    rowId2 = crypto.randomUUID() as RowId;

    yDoc.transact(() => {
      yColumnDefinitions.set(colId1, {
        id: colId1,
        name: "ColA",
        width: DEFAULT_COL_WIDTH,
      });
      yColumnDefinitions.set(colId2, {
        id: colId2,
        name: "ColB",
        width: DEFAULT_COL_WIDTH,
      });
      yColumnOrder.push([colId1, colId2]);

      const r1Map = new Y.Map<CellValue>();
      r1Map.set(colId1, "r1a");
      r1Map.set(colId2, "r1b");
      yRowData.set(rowId1, r1Map);

      const r2Map = new Y.Map<CellValue>();
      r2Map.set(colId1, "r2a");
      r2Map.set(colId2, "r2b");
      yRowData.set(rowId2, r2Map);

      yRowOrder.push([rowId1, rowId2]);
      yMeta.set("schemaVersion", 2); // Mark as V2
    });

    // Now instantiate LiveTableDoc. It should pick up existing V2 data.
    liveTableDoc = new LiveTableDoc(yDoc);
  });

  it("should lock a cell range without a note", () => {
    const lockId = liveTableDoc.lockCellRange(0, 0, 0, 0);
    expect(lockId).toBeTypeOf("string");

    const activeLocks = liveTableDoc.getActiveLocks();
    expect(activeLocks).toHaveLength(1);
    expect(activeLocks[0].id).toBe(lockId);
    expect(activeLocks[0].cells).toHaveLength(1);
    expect(activeLocks[0].cells[0].rowId).toBe(rowId1);
    expect(activeLocks[0].cells[0].columnId).toBe(colId1);
    expect(activeLocks[0].note).toBeUndefined();
  });

  it("should lock a cell range with a note", () => {
    const note = "This is a test note.";
    const lockId = liveTableDoc.lockCellRange(0, 1, 0, 1, note);
    expect(lockId).toBeTypeOf("string");

    const activeLocks = liveTableDoc.getActiveLocks();
    expect(activeLocks).toHaveLength(1);
    expect(activeLocks[0].id).toBe(lockId);
    expect(activeLocks[0].cells).toHaveLength(4);
    expect(activeLocks[0].note).toBe(note);
  });

  it("should update lockedCellsState with notes", () => {
    const mockCallback = vi.fn();
    liveTableDoc.lockedCellsUpdateCallback = mockCallback;

    const note = "This is a test note.";
    liveTableDoc.lockCellRange(0, 0, 0, 0, note);

    liveTableDoc.updateLockedCellsState();

    expect(mockCallback).toHaveBeenCalledTimes(1);
    const lockedCellsMap = mockCallback.mock.calls[0][0];
    expect(lockedCellsMap).toBeInstanceOf(Map);
    expect(lockedCellsMap.size).toBe(1);
    expect(lockedCellsMap.get("0-0")).toBe(note);
  });

  it("should unlock a range", () => {
    const lockId = liveTableDoc.lockCellRange(0, 0, 0, 0);
    expect(liveTableDoc.getActiveLocks()).toHaveLength(1);

    const result = liveTableDoc.unlockRange(lockId!);
    expect(result).toBe(true);
    expect(liveTableDoc.getActiveLocks()).toHaveLength(0);
  });

  it("should return false when unlocking a non-existent range", () => {
    const result = liveTableDoc.unlockRange("non-existent-id");
    expect(result).toBe(false);
  });

  it("should unlock all ranges", () => {
    liveTableDoc.lockCellRange(0, 0, 0, 0);
    liveTableDoc.lockCellRange(1, 1, 1, 1);
    expect(liveTableDoc.getActiveLocks()).toHaveLength(2);

    liveTableDoc.unlockAll();
    expect(liveTableDoc.getActiveLocks()).toHaveLength(0);
  });
});
