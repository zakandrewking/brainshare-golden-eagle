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

  it("should insert provided Y.Map rows into yTable", () => {
    const insertIndex = 0;
    const row1Map = new Y.Map<unknown>();
    row1Map.set("ColA", "new1a");
    row1Map.set("ColB", "new1b");
    const row2Map = new Y.Map<unknown>();
    row2Map.set("ColA", "new2a");
    row2Map.set("ColB", "new2b");
    const rowsToInsert = [row1Map, row2Map];

    const yTableInsertSpy = vi.spyOn(yTable, "insert");

    const result = liveTableDoc.insertRows(insertIndex, rowsToInsert); // Changed from insertRowsIntoDoc

    expect(yTableInsertSpy).toHaveBeenCalledTimes(1);
    expect(yTableInsertSpy).toHaveBeenCalledWith(insertIndex, rowsToInsert);
    expect(yTable.length).toBe(rowsToInsert.length);
    expect(yTable.get(0).toJSON()).toEqual({ ColA: "new1a", ColB: "new1b" });
    expect(yTable.get(1).toJSON()).toEqual({ ColA: "new2a", ColB: "new2b" });
    expect(result).toBe(rowsToInsert.length);
  });

  it("should throw an error if Yjs transaction fails", () => {
    const insertIndex = 0;
    const rowMap = new Y.Map<unknown>();
    rowMap.set("ColA", "fail");
    const rowsToInsert = [rowMap];
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

  it("should do nothing and return success true with 0 insertedCount if rowsToInsert is empty", () => {
    const yTableInsertSpy = vi.spyOn(yTable, "insert");
    const result = liveTableDoc.insertRows(0, []); // Changed from insertRowsIntoDoc

    expect(yTableInsertSpy).not.toHaveBeenCalled();
    expect(result).toBe(0);
  });
});
