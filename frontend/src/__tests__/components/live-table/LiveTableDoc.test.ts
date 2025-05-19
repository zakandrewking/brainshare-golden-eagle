import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import * as Y from "yjs";

import {
  ColumnDefinition,
  ColumnId,
  LiveTableDoc,
  RowId,
} from "@/components/live-table/LiveTableDoc"; // Adjust path as needed

// Mock crypto.randomUUID
const mockUUID = (() => {
  let count = 0;
  return () => {
    count++;
    return `uuid-${count}`;
  };
})();
vi.stubGlobal("crypto", {
  ...global.crypto,
  randomUUID: vi.fn(mockUUID),
});

const DEFAULT_COL_WIDTH = 150;
const CURRENT_SCHEMA_VERSION = 2;

describe("LiveTableDoc", () => {
  let yDoc: Y.Doc;

  beforeEach(() => {
    yDoc = new Y.Doc();
    // Reset UUID counter for deterministic IDs in each test
    const randomUUIDMock = global.crypto.randomUUID as unknown as Mock;
    randomUUIDMock.mockImplementation(
      (() => {
        let count = 0;
        return () => {
          count++;
          return `uuid-${count}`;
        };
      })()
    );
  });

  describe("Initialization and Schema Versioning", () => {
    it("should initialize an empty document to V2 schema", () => {
      const liveTableDoc = new LiveTableDoc(yDoc);
      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(liveTableDoc.yRowData.size).toBe(0);
      expect(liveTableDoc.yColumnDefinitions.size).toBe(0);
    });

    it("should identify an existing V2 document and not re-migrate", () => {
      // Setup V2 structure manually
      const meta = yDoc.getMap<unknown>("metaData");
      meta.set("schemaVersion", CURRENT_SCHEMA_VERSION);
      const colDefs = yDoc.getMap<ColumnDefinition>("columnDefinitions");
      const colId = "col-id-1";
      colDefs.set(colId, { id: colId, name: "Test Col", width: 100 });
      const colOrder = yDoc.getArray<ColumnId>("columnOrder");
      colOrder.push([colId]);

      const migrationSpy = vi.spyOn(
        LiveTableDoc.prototype,
        "_migrateToV2IfNeeded"
      );
      const liveTableDoc = new LiveTableDoc(yDoc);

      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(liveTableDoc.yColumnDefinitions.get(colId)?.name).toBe("Test Col");
      expect(migrationSpy).toHaveBeenCalled();
      expect(liveTableDoc.yColumnDefinitions.size).toBe(1);
      migrationSpy.mockRestore();
    });
  });

  describe("V1 to V2 Migration", () => {
    let v1Table: Y.Array<Y.Map<unknown>>;
    let v1Headers: Y.Array<string>;
    let v1ColWidths: Y.Map<number>;

    beforeEach(() => {
      v1Table = yDoc.getArray<Y.Map<unknown>>("tableData");
      v1Headers = yDoc.getArray<string>("tableHeaders");
      v1ColWidths = yDoc.getMap<number>("colWidths");
    });

    it("should correctly migrate a V1 document with data", () => {
      v1Headers.push(["Name", "Age"]);
      v1ColWidths.set("Name", 100);
      v1ColWidths.set("Age", 80);
      const row1V1 = new Y.Map<unknown>();
      row1V1.set("Name", "Alice");
      row1V1.set("Age", 30);
      const row2V1 = new Y.Map<unknown>();
      row2V1.set("Name", "Bob");
      v1Table.push([row1V1, row2V1]);

      const liveTableDoc = new LiveTableDoc(yDoc);

      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      const colIdName = "uuid-1";
      const colIdAge = "uuid-2";
      expect(liveTableDoc.yColumnDefinitions.size).toBe(2);
      expect(liveTableDoc.yColumnDefinitions.get(colIdName)).toEqual({
        id: colIdName,
        name: "Name",
        width: 100,
      });
      expect(liveTableDoc.yColumnDefinitions.get(colIdAge)).toEqual({
        id: colIdAge,
        name: "Age",
        width: 80,
      });
      expect(liveTableDoc.yColumnOrder.toArray()).toEqual([
        colIdName,
        colIdAge,
      ]);

      const rowIdAlice = "uuid-3";
      const rowIdBob = "uuid-4";
      expect(liveTableDoc.yRowOrder.toArray()).toEqual([rowIdAlice, rowIdBob]);
      expect(liveTableDoc.yRowData.size).toBe(2);
      const aliceRowV2 = liveTableDoc.yRowData.get(rowIdAlice);
      expect(aliceRowV2?.get(colIdName)).toBe("Alice");
      expect(aliceRowV2?.get(colIdAge)).toBe(30);
      const bobRowV2 = liveTableDoc.yRowData.get(rowIdBob);
      expect(bobRowV2?.get(colIdName)).toBe("Bob");
      expect(bobRowV2?.get(colIdAge)).toBe("");

      expect(v1Headers.length).toBe(2);
      expect(v1Table.length).toBe(2);
    });

    it("should be idempotent", () => {
      v1Headers.push(["InitialHeader"]);
      const rowV1 = new Y.Map<unknown>();
      rowV1.set("InitialHeader", "value");
      v1Table.push([rowV1]);
      const liveTableDoc = new LiveTableDoc(yDoc);
      const initialV2ColDefsSize = liveTableDoc.yColumnDefinitions.size;
      const initialV2RowDataSize = liveTableDoc.yRowData.size;
      const initialV2ColOrder = liveTableDoc.yColumnOrder.toArray();
      const initialV2RowOrder = liveTableDoc.yRowOrder.toArray();

      liveTableDoc._migrateToV2IfNeeded();

      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(liveTableDoc.yColumnDefinitions.size).toBe(initialV2ColDefsSize);
      expect(liveTableDoc.yRowData.size).toBe(initialV2RowDataSize);
      expect(liveTableDoc.yColumnOrder.toArray()).toEqual(initialV2ColOrder);
      expect(liveTableDoc.yRowOrder.toArray()).toEqual(initialV2RowOrder);
    });

    it("should handle migration of an empty V1 table", () => {
      const liveTableDoc = new LiveTableDoc(yDoc);
      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(liveTableDoc.yColumnDefinitions.size).toBe(0);
      expect(liveTableDoc.yColumnOrder.length).toBe(0);
      expect(liveTableDoc.yRowData.size).toBe(0);
      expect(liveTableDoc.yRowOrder.length).toBe(0);
    });

    it("should handle migration of V1 table with headers but no rows", () => {
      v1Headers.push(["H1", "H2"]);
      v1ColWidths.set("H1", 200);
      const liveTableDoc = new LiveTableDoc(yDoc);
      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      const colIdH1 = "uuid-1";
      const colIdH2 = "uuid-2";
      expect(liveTableDoc.yColumnDefinitions.size).toBe(2);
      expect(liveTableDoc.yColumnDefinitions.get(colIdH1)).toEqual({
        id: colIdH1,
        name: "H1",
        width: 200,
      });
      expect(liveTableDoc.yColumnDefinitions.get(colIdH2)).toEqual({
        id: colIdH2,
        name: "H2",
        width: DEFAULT_COL_WIDTH,
      });
      expect(liveTableDoc.yColumnOrder.toArray()).toEqual([colIdH1, colIdH2]);
      expect(liveTableDoc.yRowData.size).toBe(0);
      expect(liveTableDoc.yRowOrder.length).toBe(0);
    });

    it("should handle migration of V1 table with rows but no V1 headers", () => {
      const rowV1 = new Y.Map<unknown>();
      rowV1.set("ImplicitCol1", "val1");
      v1Table.push([rowV1]);
      const liveTableDoc = new LiveTableDoc(yDoc);
      expect(liveTableDoc.yMeta.get("schemaVersion")).toBe(
        CURRENT_SCHEMA_VERSION
      );
      expect(liveTableDoc.yColumnDefinitions.size).toBe(0);
      expect(liveTableDoc.yColumnOrder.length).toBe(0);
      expect(liveTableDoc.yRowData.size).toBe(1);
      expect(liveTableDoc.yRowOrder.length).toBe(1);
      const rowId = liveTableDoc.yRowOrder.get(0) as RowId;
      const rowDataMap = liveTableDoc.yRowData.get(rowId);
      expect(rowDataMap?.size).toBe(0);
    });
  });

  describe("V2 Operations", () => {
    let liveTableDoc: LiveTableDoc;
    const col1Id = "col1-id";
    const col2Id = "col2-id";
    const row1Id = "row1-id";
    const row2Id = "row2-id";

    beforeEach(() => {
      let idCounter = 0;
      const specificUUIDs = [col1Id, col2Id, row1Id, row2Id];
      // crypto.randomUUID is already a mock due to vi.stubGlobal in the module scope
      // We just need to change its implementation for this specific describe block
      const randomUUIDMock = global.crypto.randomUUID as unknown as Mock;
      randomUUIDMock.mockImplementation(() => {
        const id = specificUUIDs[idCounter] || `fallback-uuid-${idCounter}`;
        idCounter++;
        return id;
      });

      yDoc.getMap("metaData").set("schemaVersion", CURRENT_SCHEMA_VERSION);
      const colDefs = yDoc.getMap<ColumnDefinition>("columnDefinitions");
      colDefs.set(col1Id, { id: col1Id, name: "Col1", width: 100 });
      colDefs.set(col2Id, { id: col2Id, name: "Col2", width: 120 });
      const colOrder = yDoc.getArray<ColumnId>("columnOrder");
      colOrder.push([col1Id, col2Id]);
      const rowOrder = yDoc.getArray<RowId>("rowOrder");
      rowOrder.push([row1Id, row2Id]);
      const rowData = yDoc.getMap<Y.Map<unknown>>("rowData");
      const r1Map = new Y.Map<unknown>();
      r1Map.set(col1Id, "R1C1");
      r1Map.set(col2Id, "R1C2");
      rowData.set(row1Id, r1Map);
      const r2Map = new Y.Map<unknown>();
      r2Map.set(col1Id, "R2C1");
      r2Map.set(col2Id, "R2C2");
      rowData.set(row2Id, r2Map);
      liveTableDoc = new LiveTableDoc(yDoc);

      // Restore the general mockUUID implementation after this block
      const generalMockRandomUUID = global.crypto.randomUUID as unknown as Mock;
      generalMockRandomUUID.mockImplementation(mockUUID);
    });

    it("editHeader should update column name in yColumnDefinitions for V2", () => {
      liveTableDoc.editHeader(0, "NewCol1Name");
      const definition = liveTableDoc.yColumnDefinitions.get(col1Id);
      expect(definition?.name).toBe("NewCol1Name");
      expect(definition?.width).toBe(100);
      const otherDef = liveTableDoc.yColumnDefinitions.get(col2Id);
      expect(otherDef?.name).toBe("Col2");
    });

    it("editHeader should do nothing if index is out of bounds for V2", () => {
      const originalName = liveTableDoc.yColumnDefinitions.get(col1Id)?.name;
      liveTableDoc.editHeader(5, "OutOfBounds");
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)?.name).toBe(
        originalName
      );
    });

    it("tableDataUpdateCallback should be called with correctly transformed data from V2", () => {
      const mockCallback = vi.fn();
      liveTableDoc.tableDataUpdateCallback = mockCallback;
      liveTableDoc.updateTableState();
      expect(mockCallback).toHaveBeenCalledTimes(1);
      const callbackData = mockCallback.mock.calls[0][0];
      expect(callbackData).toEqual([
        { Col1: "R1C1", Col2: "R1C2" },
        { Col1: "R2C1", Col2: "R2C2" },
      ]);
    });

    it("headersUpdateCallback should be called with correctly transformed headers from V2", () => {
      const mockCallback = vi.fn();
      liveTableDoc.headersUpdateCallback = mockCallback;
      liveTableDoc.updateHeadersState();
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback.mock.calls[0][0]).toEqual(["Col1", "Col2"]);
    });

    it("columnWidthsUpdateCallback should be called with correctly transformed widths from V2", () => {
      const mockCallback = vi.fn();
      liveTableDoc.columnWidthsUpdateCallback = mockCallback;
      liveTableDoc.updateColWidthsState();
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback.mock.calls[0][0]).toEqual({ Col1: 100, Col2: 120 });
    });

    it("should correctly initialize UndoManager for V2 schema (functional test)", () => {
      const initialName = liveTableDoc.yColumnDefinitions.get(col1Id)!.name;
      liveTableDoc.editHeader(0, "Temp Name For Undo Test");
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)!.name).toBe(
        "Temp Name For Undo Test"
      );
      liveTableDoc.undoManager.undo();
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)!.name).toBe(
        initialName
      );
    });

    it("Undo/Redo for header edit in V2", () => {
      const initialName = liveTableDoc.yColumnDefinitions.get(col1Id)!.name;
      liveTableDoc.editHeader(0, "Temporary Name");
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)!.name).toBe(
        "Temporary Name"
      );
      liveTableDoc.undoManager.undo();
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)!.name).toBe(
        initialName
      );
      liveTableDoc.undoManager.redo();
      expect(liveTableDoc.yColumnDefinitions.get(col1Id)!.name).toBe(
        "Temporary Name"
      );
    });
  });

  describe("Observers", () => {
    it("should setup V2 observers if schema is V2", () => {
      yDoc.getMap("metaData").set("schemaVersion", CURRENT_SCHEMA_VERSION);
      const liveTableDoc = new LiveTableDoc(yDoc);
      const yRowDataSpy = vi.spyOn(liveTableDoc.yRowData, "observeDeep");
      const yColDefsSpy = vi.spyOn(
        liveTableDoc.yColumnDefinitions,
        "observeDeep"
      );
      const yColOrderSpy = vi.spyOn(liveTableDoc.yColumnOrder, "observe");
      const yRowOrderSpy = vi.spyOn(liveTableDoc.yRowOrder, "observe");
      liveTableDoc.initializeObservers();
      expect(yRowDataSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(yColDefsSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(yColOrderSpy).toHaveBeenCalledWith(expect.any(Function));
      expect(yRowOrderSpy).toHaveBeenCalledWith(expect.any(Function));
      const yTableSpy = vi.spyOn(liveTableDoc.yTable, "observeDeep");
      expect(yTableSpy).toHaveBeenCalledTimes(0);
    });

    it("cleanupObservers should unobserve all relevant types", () => {
      const liveTableDoc = new LiveTableDoc(yDoc);
      const yRowDataSpy = vi.spyOn(liveTableDoc.yRowData, "unobserveDeep");
      const yColDefsSpy = vi.spyOn(
        liveTableDoc.yColumnDefinitions,
        "unobserveDeep"
      );
      const yColOrderSpy = vi.spyOn(liveTableDoc.yColumnOrder, "unobserve");
      const yRowOrderSpy = vi.spyOn(liveTableDoc.yRowOrder, "unobserve");

      liveTableDoc.initializeObservers();
      liveTableDoc.cleanupObservers();

      expect(yRowDataSpy).toHaveBeenCalled();
      expect(yColDefsSpy).toHaveBeenCalled();
      expect(yColOrderSpy).toHaveBeenCalled();
      expect(yRowOrderSpy).toHaveBeenCalled();
    });
  });
});
