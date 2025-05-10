import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import * as Y from "yjs";

import {
  applyDefaultColumnToYDocOnError,
  applyGeneratedColumnToYDoc,
} from "@/components/live-table/yjs-operations";

describe("applyGeneratedColumnToYDoc", () => {
  let yDoc: Y.Doc;
  let yHeaders: Y.Array<string>;
  let yTable: Y.Array<Y.Map<unknown>>;
  let mockTransact: Mock;

  beforeEach(() => {
    yDoc = new Y.Doc();
    yHeaders = yDoc.getArray<string>("headers");
    yTable = yDoc.getArray<Y.Map<unknown>>("table");
    mockTransact = vi.fn((fn) => fn()); // Mock yDoc.transact
    yDoc.transact = mockTransact;

    // Clear mocks
    vi.clearAllMocks();
    // Re-assign the mock transact to the yDoc instance for this test suite
    yDoc.transact = mockTransact;
  });

  it("should add header and data to existing rows within a transaction", () => {
    // Setup initial table state
    yHeaders.push(["Header1"]);
    const row1 = new Y.Map<unknown>();
    row1.set("Header1", "r1c1");
    const row2 = new Y.Map<unknown>();
    row2.set("Header1", "r2c1");
    yTable.push([row1, row2]);

    const finalHeader = "NewAIHeader";
    const finalData = ["ai_val1", "ai_val2"];
    const insertIndex = 1;

    applyGeneratedColumnToYDoc(
      yDoc,
      yHeaders,
      yTable,
      finalHeader,
      finalData,
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);

    // Check yHeaders
    expect(yHeaders.toArray()).toEqual(["Header1", "NewAIHeader"]);

    // Check yTable data
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][finalHeader]).toBe("ai_val1");
    expect(tableData[1][finalHeader]).toBe("ai_val2");
    expect(tableData[0]["Header1"]).toBe("r1c1"); // Existing data preserved
  });

  it("should add header and empty strings if finalData is null", () => {
    yHeaders.push(["Header1"]);
    const row1 = new Y.Map<unknown>();
    row1.set("Header1", "r1c1");
    yTable.push([row1]);

    const finalHeader = "NewAIHeaderNoData";
    const insertIndex = 0;

    applyGeneratedColumnToYDoc(
      yDoc,
      yHeaders,
      yTable,
      finalHeader,
      null, // No AI data
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    expect(yHeaders.toArray()).toEqual(["NewAIHeaderNoData", "Header1"]);
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][finalHeader]).toBe("");
  });

  it("should create new rows if table is initially empty and AI data is provided", () => {
    const finalHeader = "OnlyAIHeader";
    const finalData = ["data1", "data2"];
    const insertIndex = 0;

    applyGeneratedColumnToYDoc(
      yDoc,
      yHeaders,
      yTable,
      finalHeader,
      finalData,
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    expect(yHeaders.toArray()).toEqual(["OnlyAIHeader"]);
    expect(yTable.length).toBe(1); // Should add one row based on current logic for empty table + AI data
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][finalHeader]).toBe("data1");
  });

  it("should create one new row with empty string if table is empty and AI data is null", () => {
    const finalHeader = "EmptyHeader";
    const insertIndex = 0;

    applyGeneratedColumnToYDoc(
      yDoc,
      yHeaders,
      yTable,
      finalHeader,
      null, // No AI Data
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    expect(yHeaders.toArray()).toEqual(["EmptyHeader"]);
    expect(yTable.length).toBe(1);
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][finalHeader]).toBe("");
  });

  it("should use empty string for undefined values in finalData", () => {
    yHeaders.push(["Header1"]);
    const row1 = new Y.Map<unknown>();
    row1.set("Header1", "r1c1");
    yTable.push([row1]);

    const finalHeader = "MixedDataHeader";
    const finalData = [undefined, "val2"]; // Intentionally has undefined
    const insertIndex = 1;

    applyGeneratedColumnToYDoc(
      yDoc,
      yHeaders,
      yTable,
      finalHeader,
      finalData,
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][finalHeader]).toBe(""); // Undefined becomes empty string
  });
});

describe("applyDefaultColumnToYDocOnError", () => {
  let yDoc: Y.Doc;
  let yHeaders: Y.Array<string>;
  let yTable: Y.Array<Y.Map<unknown>>;
  let mockTransact: Mock;

  beforeEach(() => {
    yDoc = new Y.Doc();
    yHeaders = yDoc.getArray<string>("headers");
    yTable = yDoc.getArray<Y.Map<unknown>>("table");
    mockTransact = vi.fn((fn) => fn());
    yDoc.transact = mockTransact;

    vi.clearAllMocks();
    yDoc.transact = mockTransact;
  });

  it("should add default header and empty strings to existing rows within a transaction", () => {
    yHeaders.push(["ExistingCol"]);
    const row1 = new Y.Map<unknown>();
    row1.set("ExistingCol", "val1");
    yTable.push([row1]);

    const headerToAdd = "DefaultNewColumn";
    const insertIndex = 0;

    applyDefaultColumnToYDocOnError(
      yDoc,
      yHeaders,
      yTable,
      headerToAdd,
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    expect(yHeaders.toArray()).toEqual(["DefaultNewColumn", "ExistingCol"]);
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][headerToAdd]).toBe("");
    expect(tableData[0]["ExistingCol"]).toBe("val1");
  });

  it("should create one new row with default header and empty string if table is empty", () => {
    const headerToAdd = "DefaultOnlyColumn";
    const insertIndex = 0;

    applyDefaultColumnToYDocOnError(
      yDoc,
      yHeaders,
      yTable,
      headerToAdd,
      insertIndex
    );

    expect(mockTransact).toHaveBeenCalledTimes(1);
    expect(yHeaders.toArray()).toEqual(["DefaultOnlyColumn"]);
    expect(yTable.length).toBe(1);
    const tableData = yTable.toArray().map((row) => row.toJSON());
    expect(tableData[0][headerToAdd]).toBe("");
  });
});
