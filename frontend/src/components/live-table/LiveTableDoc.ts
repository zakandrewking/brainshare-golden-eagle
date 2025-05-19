import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

import { DEFAULT_COL_WIDTH } from "./config";

// export type EditLockType =
//   | "cell-range"
//   | "cell-range-columns-locked"
//   | "cell-range-rows-locked";

// export interface EditLock {
//   type: EditLockType;
//   evidence: string;
// }

export interface SortingConfig {
  // key is the columnId (in V2) or header string (in V1)
  column: string;
  direction: "asc" | "desc";
}

export type RowId = string;
export type ColumnId = string;

// can be extended later
export type CellValue = string;

export interface ColumnDefinition {
  id: ColumnId;
  name: string;
  width: number;
}

const CURRENT_SCHEMA_VERSION = 2;

export class LiveTableDoc {
  // top level yjs entities
  public yDoc: Y.Doc;

  // -- V1 Schema Properties (may coexist during migration) --
  // Array of rows, where each row is a Map keyed by header string
  public yTable: Y.Array<Y.Map<unknown>>;
  // Array of header strings (defines column order and keys for yTable rows)
  public yHeaders: Y.Array<string>;
  // Map keyed by header string to column width
  public yColWidths: Y.Map<number>;

  // -- V2 Schema Properties --
  // For schemaVersion and other metadata
  public yMeta: Y.Map<unknown>;
  // Outer key: RowId, Inner key: ColumnId to cell value
  public yRowData: Y.Map<Y.Map<CellValue>>;
  // Key: ColumnId
  public yColumnDefinitions: Y.Map<ColumnDefinition>;
  // Array of ColumnIds, defines display order
  public yColumnOrder: Y.Array<ColumnId>;
  // Array of RowIds, defines display order
  public yRowOrder: Y.Array<RowId>;

  public tableDataUpdateCallback:
    | ((data: Record<string, unknown>[]) => void)
    | undefined;
  public headersUpdateCallback: ((headers: string[]) => void) | undefined;
  public columnWidthsUpdateCallback:
    | ((widths: Record<string, number>) => void)
    | undefined;

  // public editLocks: Y.Map<EditLock>;

  // undo/redo manager
  public undoManager!: UndoManager; // Initialized after potential migration

  // persistent observer functions
  public updateTableStateObserver: () => void;
  public updateHeadersStateObserver: () => void;
  public updateColWidthsStateObserver: () => void;
  // V2 Observers
  public updateV2TableDataObserver: () => void;
  public updateV2ColumnDefinitionsObserver: () => void;
  public updateV2ColumnOrderObserver: () => void;
  public updateV2RowOrderObserver: () => void;

  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;

    // Initialize all Yjs types (V1 and V2)
    // V1
    this.yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    this.yHeaders = yDoc.getArray<string>("tableHeaders");
    this.yColWidths = yDoc.getMap<number>("colWidths");

    // V2
    this.yMeta = yDoc.getMap<unknown>("metaData");
    this.yRowData = yDoc.getMap<Y.Map<CellValue>>("rowData");
    this.yColumnDefinitions =
      yDoc.getMap<ColumnDefinition>("columnDefinitions");
    this.yColumnOrder = yDoc.getArray<ColumnId>("columnOrder");
    this.yRowOrder = yDoc.getArray<RowId>("rowOrder");

    this._migrateToV2IfNeeded();
    this._initializeUndoManager();

    // persistent observer functions
    this.updateTableStateObserver = this.updateTableState.bind(this);
    this.updateHeadersStateObserver = this.updateHeadersState.bind(this);
    this.updateColWidthsStateObserver = this.updateColWidthsState.bind(this);

    // V2 observers also bound, then selectively attached based on schema version
    this.updateV2TableDataObserver = this.updateTableState.bind(this); // Reuses updateTableState
    this.updateV2ColumnDefinitionsObserver = this.updateHeadersState.bind(this); // Reuses updateHeadersState for name changes
    this.updateV2ColumnOrderObserver = this.updateHeadersState.bind(this); // Reuses updateHeadersState for order changes
    this.updateV2RowOrderObserver = this.updateTableState.bind(this); // Reuses updateTableState for row order changes

    // Also need to call columnWidthsUpdateCallback if V2 column definition width changes
    // For simplicity, updateV2ColumnDefinitionsObserver can trigger both header and width updates
    this.updateV2ColumnDefinitionsObserver = () => {
      this.updateHeadersState();
      this.updateColWidthsState();
    };
  }

  private _initializeUndoManager() {
    const itemsToTrack = [
      this.yRowData,
      this.yColumnDefinitions,
      this.yColumnOrder,
      this.yRowOrder,
    ];
    this.undoManager = new UndoManager(itemsToTrack, {
      captureTimeout: 500,
    });
  }

  public _migrateToV2IfNeeded(force: boolean = false) {
    if (this.yMeta.get("schemaVersion") === CURRENT_SCHEMA_VERSION && !force) {
      return;
    }

    // Check if V1 data exists to migrate. If not, initialize V2 directly.
    const v1HeadersExist = this.yHeaders.length > 0;
    const v1TableDataExists = this.yTable.length > 0;

    if (
      !v1HeadersExist &&
      !v1TableDataExists &&
      this.yRowData.size === 0 &&
      this.yColumnDefinitions.size === 0
    ) {
      // Empty document, or already V2 (though _isV2Schema should catch this)
      // Initialize as V2 if it's truly empty and not marked.
      this.yDoc.transact(() => {
        this.yMeta.set("schemaVersion", CURRENT_SCHEMA_VERSION);
      });
      return;
    }

    this.yDoc.transact(() => {
      console.log("Migrating LiveTableDoc schema from V1 to V2...");

      if (force) {
        // clear v2 data
        this.yRowData.clear();
        this.yColumnDefinitions.clear();
        this.yColumnOrder.delete(0, this.yColumnOrder.length);
        this.yRowOrder.delete(0, this.yRowOrder.length);
      }

      // 1. Migrate Headers to ColumnDefinitions and ColumnOrder
      const oldHeadersArray = this.yHeaders.toArray();
      const oldColWidths = Object.fromEntries(this.yColWidths.entries());
      const headerToColumnIdMap = new Map<string, ColumnId>();

      oldHeadersArray.forEach((oldHeaderString) => {
        const columnId = crypto.randomUUID() as ColumnId;
        headerToColumnIdMap.set(oldHeaderString, columnId);
        const definition: ColumnDefinition = {
          id: columnId,
          name: oldHeaderString,
          width: oldColWidths[oldHeaderString] ?? DEFAULT_COL_WIDTH,
        };
        this.yColumnDefinitions.set(columnId, definition);
        this.yColumnOrder.push([columnId]);
      });

      // 2. Migrate TableData to RowData and RowOrder
      const oldTableDataArray = this.yTable.toArray();
      oldTableDataArray.forEach((oldRowMapY) => {
        const oldRowMap = Object.fromEntries(oldRowMapY.entries());
        const rowId = crypto.randomUUID() as RowId;
        this.yRowOrder.push([rowId]);

        const newRowYMap = new Y.Map<unknown>();
        headerToColumnIdMap.forEach((columnId, oldHeaderString) => {
          const cellValue = oldRowMap[oldHeaderString];
          if (cellValue !== undefined) {
            newRowYMap.set(columnId, cellValue);
          } else {
            newRowYMap.set(columnId, ""); // Default to empty string for missing cells
          }
        });
        this.yRowData.set(rowId, newRowYMap);
      });

      // 3. Set schema version
      this.yMeta.set("schemaVersion", CURRENT_SCHEMA_VERSION);
      console.log("LiveTableDoc schema migration to V2 complete.");

      // Optional: Clear V1 data after successful migration.
      // For now, we keep it for backward compatibility / phased rollout.
      // this.yTable.delete(0, this.yTable.length);
      // this.yHeaders.delete(0, this.yHeaders.length);
      // this.yColWidths.clear();
    });
  }

  updateTableState() {
    const currentData: Record<string, unknown>[] = [];
    const colDefs = Object.fromEntries(this.yColumnDefinitions.entries());
    const colOrder = this.yColumnOrder.toArray();

    this.yRowOrder.forEach((rowId) => {
      const rowMap = this.yRowData.get(rowId);
      if (rowMap) {
        const row: Record<string, unknown> = {};
        colOrder.forEach((columnId) => {
          const def = colDefs[columnId];
          if (def) {
            row[def.name] = rowMap.get(columnId) ?? "";
          }
        });
        currentData.push(row);
      }
    });
    this.tableDataUpdateCallback?.(currentData);
  }

  // Function to update React state for headers
  updateHeadersState() {
    const currentHeaders: string[] = [];
    const colDefs = Object.fromEntries(this.yColumnDefinitions.entries());
    this.yColumnOrder.forEach((columnId) => {
      const def = colDefs[columnId];
      if (def) {
        currentHeaders.push(def.name);
      }
    });

    if (
      currentHeaders.length === 0 &&
      this.yRowOrder.length > 0 &&
      this.yColumnDefinitions.size > 0
    ) {
      // This case implies yColumnOrder is empty but definitions and row data exist.
      // Attempt to populate yColumnOrder based on available definitions (e.g., sorted by ID).
      // This is a recovery mechanism, ideally migration ensures yColumnOrder is populated.
      const derivedColOrder = Array.from(this.yColumnDefinitions.keys()).sort();
      this.yDoc.transact(() => {
        if (this.yColumnOrder.length === 0) {
          // Check again inside transaction
          this.yColumnOrder.push(derivedColOrder);
          // Re-derive currentHeaders with the new order
          const reDerivedHeaders: string[] = [];
          derivedColOrder.forEach((colId) => {
            const def = this.yColumnDefinitions.get(colId);
            if (def) reDerivedHeaders.push(def.name);
          });
          this.headersUpdateCallback?.(reDerivedHeaders);
        } else {
          this.headersUpdateCallback?.(currentHeaders); // Use already populated currentHeaders if another client fixed it
        }
      });
    } else {
      this.headersUpdateCallback?.(currentHeaders);
    }
  }

  // Function to update React state for column widths
  updateColWidthsState() {
    const currentWidths: Record<string, number> = {};
    const colDefs = Object.fromEntries(this.yColumnDefinitions.entries());
    this.yColumnOrder.forEach((columnId) => {
      const def = colDefs[columnId];
      if (def) {
        currentWidths[def.name] = def.width;
      }
    });
    this.columnWidthsUpdateCallback?.(currentWidths);
  }

  /**
   * Initialize yDoc observers.
   */
  initializeObservers() {
    this.yRowData.observeDeep(this.updateV2TableDataObserver);
    this.yColumnDefinitions.observeDeep(this.updateV2ColumnDefinitionsObserver);
    this.yColumnOrder.observe(this.updateV2ColumnOrderObserver);
    this.yRowOrder.observe(this.updateV2RowOrderObserver);
  }

  /**
   * Cleanup yDoc observers.
   */
  cleanupObservers() {
    this.yRowData.unobserveDeep(this.updateV2TableDataObserver);
    this.yColumnDefinitions.unobserveDeep(
      this.updateV2ColumnDefinitionsObserver
    );
    this.yColumnOrder.unobserve(this.updateV2ColumnOrderObserver);
    this.yRowOrder.unobserve(this.updateV2RowOrderObserver);
  }

  /**
   * Edit a header name in the table (V2 Schema).
   * @param index - The index of the column in yColumnOrder.
   * @param newHeaderName - The new header name.
   */
  editHeader(index: number, newHeaderName: string) {
    this.yDoc.transact(() => {
      const columnId = this.yColumnOrder.get(index);
      if (!columnId) {
        console.error(`editHeader: No columnId found at index ${index}`);
        return;
      }
      const definition = this.yColumnDefinitions.get(columnId);
      if (definition) {
        const updatedDefinition: ColumnDefinition = {
          ...definition,
          name: newHeaderName,
        };
        this.yColumnDefinitions.set(columnId, updatedDefinition);
      } else {
        console.error(
          `editHeader: No column definition found for columnId ${columnId}`
        );
      }
    });
  }

  insertRows(rows: Y.Map<unknown>[], rowInsertIndex: number) {
    this.yDoc.transact(() => {
      this.yTable.insert(rowInsertIndex, rows);
    });
  }

  deleteRows(rowIds: RowId[]) {
    this.yDoc.transact(() => {
      rowIds.forEach((rowId) => {
        // DELETE from row data
        // DELETE from row order
      });
    });
  }

  insertColumns(columns: Y.Map<unknown>[], columnInsertIndex: number) {
    this.yDoc.transact(() => {
      this.yTable.insert(columnInsertIndex, columns);
    });
  }

  deleteColumns(columnIds: ColumnId[]) {
    this.yDoc.transact(() => {
      columnIds.forEach((columnId) => {
        this.yColumnDefinitions.delete(columnId);
      });
      // DELETE from column order
      // DELETE from sortConfig
    });
  }
}

export function initializeLiveblocksRoom(
  room: Exclude<ReturnType<typeof useRoom>, null>
) {
  const yProvider = getYjsProviderForRoom(room);
  const yDoc = yProvider.getYDoc();
  return {
    liveTableDoc: new LiveTableDoc(yDoc),
    yProvider,
  };
}
