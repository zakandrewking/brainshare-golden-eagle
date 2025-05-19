import { beforeEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";

import { LiveTableDoc } from "@/components/live-table/LiveTableDoc";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe("LiveTableDoc - insertRows", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;

  const initialHeaders = ["ColA", "ColB"];

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();
    liveTableDoc = new LiveTableDoc(yDoc);
    yTable = liveTableDoc.yTable;
    yHeaders = liveTableDoc.yHeaders;

    yHeaders.push(initialHeaders);
  });

  it("should insert provided Y.Map rows into yTable and return inserted count", () => {
    const insertIndex = 0;
    const row1Data = { ColA: "new1a", ColB: "new1b" };
    const row2Data = { ColA: "new2a", ColB: "new2b" };
    const rowsToInsert = [row1Data, row2Data];

    const yTableInsertSpy = vi.spyOn(yTable, "insert");

    const result = liveTableDoc.insertRows(insertIndex, rowsToInsert);

    expect(yTableInsertSpy).toHaveBeenCalledTimes(1);
    expect(yTable.length).toBe(rowsToInsert.length);
    expect(yTable.get(0).toJSON()).toEqual(row1Data);
    expect(yTable.get(1).toJSON()).toEqual(row2Data);
    expect(result).toBe(rowsToInsert.length);
  });

  it("should throw an error if Yjs transaction fails", () => {
    const insertIndex = 0;
    const rowData = { ColA: "fail" };
    const rowsToInsert = [rowData];

    const yTableInsertSpy = vi
      .spyOn(yTable, "insert")
      .mockImplementationOnce(() => {
        throw new Error("Yjs fail");
      });

    expect(() => liveTableDoc.insertRows(insertIndex, rowsToInsert)).toThrow(
      "Yjs fail"
    );
    expect(yTableInsertSpy).toHaveBeenCalledTimes(1);
  });

  it("should do nothing and return 0 if rowsToInsert is empty", () => {
    const yTableInsertSpy = vi.spyOn(yTable, "insert");
    const result = liveTableDoc.insertRows(0, []);

    expect(yTableInsertSpy).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});

describe("LiveTableDoc - deleteRows", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;

  const initialHeaders = ["ColA", "ColB"];
  const initialTableData = [
    { ColA: "r0a", ColB: "r0b" },
    { ColA: "r1a", ColB: "r1b" },
    { ColA: "r2a", ColB: "r2b" },
    { ColA: "r3a", ColB: "r3b" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    yDoc = new Y.Doc();
    liveTableDoc = new LiveTableDoc(yDoc);
    yTable = liveTableDoc.yTable;
    yHeaders = liveTableDoc.yHeaders;

    yHeaders.push(initialHeaders);
    initialTableData.forEach((data) => {
      const rowMap = new Y.Map<unknown>();
      Object.entries(data).forEach(([key, value]) => rowMap.set(key, value));
      yTable.push([rowMap]);
    });
  });

  it("should delete specified rows and return the count of deleted rows", () => {
    const indicesToDelete = [2, 0]; // Sorted descending by caller
    const yTableDeleteSpy = vi.spyOn(yTable, "delete");

    const deletedCount = liveTableDoc.deleteRows(indicesToDelete);

    expect(yTableDeleteSpy).toHaveBeenCalledTimes(indicesToDelete.length);
    expect(yTableDeleteSpy).toHaveBeenNthCalledWith(1, 2, 1);
    expect(yTableDeleteSpy).toHaveBeenNthCalledWith(2, 0, 1);

    expect(yTable.length).toBe(
      initialTableData.length - indicesToDelete.length
    );
    expect(yTable.get(0).toJSON()).toEqual(initialTableData[1]);
    expect(yTable.get(1).toJSON()).toEqual(initialTableData[3]);
    expect(deletedCount).toBe(indicesToDelete.length);
  });

  it("should handle deletion of a single row and return 1", () => {
    const indexToDelete = [1];
    const deletedCount = liveTableDoc.deleteRows(indexToDelete);
    expect(yTable.length).toBe(initialTableData.length - 1);
    expect(deletedCount).toBe(1);
  });

  it("should return 0 if rowIndices is empty", () => {
    const deletedCount = liveTableDoc.deleteRows([]);
    expect(yTable.length).toBe(initialTableData.length);
    expect(deletedCount).toBe(0);
  });

  it("should throw an error if Yjs transaction fails", () => {
    const indicesToDelete = [0];
    const yTableDeleteSpy = vi
      .spyOn(yTable, "delete")
      .mockImplementationOnce(() => {
        throw new Error("Yjs delete fail");
      });
    expect(() => liveTableDoc.deleteRows(indicesToDelete)).toThrow(
      "Yjs delete fail"
    );
    expect(yTableDeleteSpy).toHaveBeenCalledTimes(1);
  });

  it("should return count of successfully deleted rows and warn for out-of-bounds indices", () => {
    const indicesToDelete = [5, 0]; // 5 is out of bounds
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const deletedCount = liveTableDoc.deleteRows(indicesToDelete);

    expect(yTable.length).toBe(initialTableData.length - 1); // Only one row should be deleted
    expect(deletedCount).toBe(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Attempted to delete non-existent row at index 5")
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempted to delete 2 rows, but only 1 were valid"
      )
    );
    consoleWarnSpy.mockRestore();
  });

  it("should return 0 and warn for all out-of-bounds indices", () => {
    const indicesToDelete = [10, 20]; // All are out of bounds
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const deletedCount = liveTableDoc.deleteRows(indicesToDelete);

    expect(yTable.length).toBe(initialTableData.length); // No rows should be deleted
    expect(deletedCount).toBe(0);
    // Check for individual warnings
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempted to delete non-existent row at index 10"
      )
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempted to delete non-existent row at index 20"
      )
    );
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "Attempted to delete 2 rows, but only 0 were valid"
      )
    );
    consoleWarnSpy.mockRestore();
  });
});

describe("LiveTableDoc - updateColumnWidth", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let yColWidths: Y.Map<number>;

  beforeEach(() => {
    yDoc = new Y.Doc();
    liveTableDoc = new LiveTableDoc(yDoc);
    yColWidths = liveTableDoc.yColWidths; // Access the map for spying/checking
    vi.spyOn(yDoc, "transact");
  });

  it("should update column width in yColWidths within a transaction", () => {
    const header = "TestCol";
    const newWidth = 200;

    liveTableDoc.updateColumnWidth(header, newWidth);

    expect(yDoc.transact).toHaveBeenCalledTimes(1);
    expect(yColWidths.get(header)).toBe(newWidth);
  });
});

describe("LiveTableDoc - updateCell", () => {
  let yDoc: Y.Doc;
  let liveTableDoc: LiveTableDoc;
  let yTable: Y.Array<Y.Map<unknown>>;
  let yHeaders: Y.Array<string>;

  beforeEach(() => {
    yDoc = new Y.Doc();
    liveTableDoc = new LiveTableDoc(yDoc);
    yTable = liveTableDoc.yTable;
    yHeaders = liveTableDoc.yHeaders;
    yHeaders.push(["Header1", "Header2"]); // Setup some headers
    vi.spyOn(yDoc, "transact");
  });

  it("should update cell value in yTable within a transaction", () => {
    const rowMap = new Y.Map<unknown>();
    rowMap.set("Header1", "val1");
    rowMap.set("Header2", "val2");
    yTable.push([rowMap]);

    const rowIndex = 0;
    const header = "Header1";
    const newValue = "newVal1";

    liveTableDoc.updateCell(rowIndex, header, newValue);

    expect(yDoc.transact).toHaveBeenCalledTimes(1);
    const updatedRow = yTable.get(rowIndex);
    expect(updatedRow.get(header)).toBe(newValue);
  });

  it("should delete cell value if newValue is empty string", () => {
    const rowMap = new Y.Map<unknown>();
    rowMap.set("Header1", "val1");
    yTable.push([rowMap]);

    const rowIndex = 0;
    const header = "Header1";
    const newValue = "";

    liveTableDoc.updateCell(rowIndex, header, newValue);

    expect(yDoc.transact).toHaveBeenCalledTimes(1);
    const updatedRow = yTable.get(rowIndex);
    expect(updatedRow.has(header)).toBe(false);
  });

  it("should do nothing if row does not exist", () => {
    liveTableDoc.updateCell(0, "Header1", "value");
    expect(yDoc.transact).toHaveBeenCalledTimes(1); // Transact is still called
    expect(yTable.length).toBe(0); // No row added or modified
  });
});
