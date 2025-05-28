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
  public undoManager: UndoManager;

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

    // undo manager
    const itemsToTrack = [
      this.yRowData,
      this.yColumnDefinitions,
      this.yColumnOrder,
      this.yRowOrder,
    ];
    this.undoManager = new UndoManager(itemsToTrack, {
      captureTimeout: 500,
    });

    // persistent observer functions
    this.updateTableStateObserver = this.updateTableState.bind(this);
    this.updateHeadersStateObserver = this.updateHeadersState.bind(this);
    this.updateColWidthsStateObserver = this.updateColWidthsState.bind(this);

    // V2 observers also bound, then selectively attached based on schema version
    this.updateV2TableDataObserver = this.updateTableState.bind(this); // Reuses updateTableState
    this.updateV2ColumnDefinitionsObserver = () => {
      this.updateHeadersState();
      this.updateColWidthsState();
    }; // Reuses updateHeadersState for name changes
    this.updateV2ColumnOrderObserver = this.updateHeadersState.bind(this); // Reuses updateHeadersState for order changes
    this.updateV2RowOrderObserver = this.updateTableState.bind(this); // Reuses updateTableState for row order changes

    this.updateV2ColumnDefinitionsObserver = () => {
      this.updateHeadersState();
      this.updateColWidthsState();
      this.updateTableState();
    };
  }

  public _migrateToV2IfNeeded(force: boolean = false) {
    if (this.yMeta.get("schemaVersion") === CURRENT_SCHEMA_VERSION && !force) {
      return;
    }

    const v1HeadersExist = this.yHeaders.length > 0;
    const v1TableDataExists = this.yTable.length > 0;

    if (
      !v1HeadersExist &&
      !v1TableDataExists &&
      this.yRowData.size === 0 &&
      this.yColumnDefinitions.size === 0
    ) {
      this.yDoc.transact(() => {
        this.yMeta.set("schemaVersion", CURRENT_SCHEMA_VERSION);
      });
      return;
    }

    this.yDoc.transact(() => {

      if (force) {
        // clear v2 data
        this.yRowData.clear();
        this.yColumnDefinitions.clear();
        this.yColumnOrder.delete(0, this.yColumnOrder.length);
        this.yRowOrder.delete(0, this.yRowOrder.length);
      }

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

      const oldTableDataArray = this.yTable.toArray() as Y.Map<CellValue>[];
      oldTableDataArray.forEach((oldRowMapY) => {
        const oldRowMap = Object.fromEntries(oldRowMapY.entries());
        const rowId = crypto.randomUUID() as RowId;
        this.yRowOrder.push([rowId]);

        const newRowYMap = new Y.Map<CellValue>();
        headerToColumnIdMap.forEach((columnId, oldHeaderString) => {
          const cellValue = oldRowMap[oldHeaderString];
          if (cellValue !== undefined) {
            newRowYMap.set(columnId, cellValue);
          } else {
            newRowYMap.set(columnId, "");
          }
        });
        this.yRowData.set(rowId, newRowYMap);
      });

      this.yMeta.set("schemaVersion", CURRENT_SCHEMA_VERSION);
    });
  }

  public clearV1Data() {
    this.yTable.delete(0, this.yTable.length);
    this.yHeaders.delete(0, this.yHeaders.length);
    this.yColWidths.clear();
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
    if (this.tableDataUpdateCallback) {
      this.tableDataUpdateCallback(currentData);
    }
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
      if (this.headersUpdateCallback) {
        this.headersUpdateCallback(currentHeaders);
      }
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
    if (this.columnWidthsUpdateCallback) {
      this.columnWidthsUpdateCallback(currentWidths);
    }
  }

  /**
   * Initialize yDoc observers.
   */
  initializeObservers() {
    this.yRowData.observeDeep(this.updateV2TableDataObserver);
    this.yColumnDefinitions.observeDeep(this.updateV2ColumnDefinitionsObserver);
    this.yColumnOrder.observe(this.updateV2ColumnOrderObserver);
    this.yRowOrder.observe(this.updateV2RowOrderObserver);

    // Manually trigger initial state propagation
    this.updateTableState();
    this.updateHeadersState();
    this.updateColWidthsState();
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
   * Edit a header in the table. (Already V2 Compatible from user diff)
   * @param index - The index of the header to edit.
   * @param header - The new header value.
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

  /**
   * insert rows into the table
   * @param initialInsertIndex - the index to insert the rows at in yRowOrder
   * @param rowsData - the rows to insert, keyed by column name
   * @returns the number of rows inserted
   */
  insertRows(
    initialInsertIndex: number,
    rowsData: Record<string, CellValue>[]
  ): number {
    if (rowsData.length === 0) {
      return 0;
    }

    this.yDoc.transact(() => {
      const newRowIds: RowId[] = [];

      const nameToIdMap = new Map<string, ColumnId>();
      const currentColumnDefinitions: ColumnDefinition[] = [];
      this.yColumnDefinitions.forEach((def) => {
        nameToIdMap.set(def.name, def.id);
        currentColumnDefinitions.push(def);
      });

      for (const rowObject of rowsData) {
        const rowId = crypto.randomUUID() as RowId;
        newRowIds.push(rowId);
        const newRowYMap = new Y.Map<CellValue>();
        const assignedColumnIds: ColumnId[] = [];

        for (const headerName in rowObject) {
          if (Object.prototype.hasOwnProperty.call(rowObject, headerName)) {
            const columnId = nameToIdMap.get(headerName);
            const cellVal = rowObject[headerName];
            if (columnId) {
              newRowYMap.set(columnId, cellVal);
              assignedColumnIds.push(columnId);
            } else {
              // console.warn(
              //   `ColumnId not found for headerName \"${headerName}\". This data will be skipped for this cell.`
              // );
            }
          }
        }
        currentColumnDefinitions.forEach((def) => {
          if (!assignedColumnIds.includes(def.id)) {
            newRowYMap.set(def.id, "");
          }
        });
        this.yRowData.set(rowId, newRowYMap);
      }
      this.yRowOrder.insert(initialInsertIndex, newRowIds);
    });

    return rowsData.length;
  }

  /**
   * Deletes rows from the table.
   * Assumes rowIndices are sorted in descending order by the caller to prevent index shifting issues.
   * @param rowIndices - An array of row indices (from yRowOrder) to delete (sorted descending).
   * @returns number of rows deleted.
   */
  deleteRows(rowIndices: number[]): number {
    if (rowIndices.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    this.yDoc.transact(() => {
      // Sort descending to handle index shifts correctly if not already sorted by caller
      const sortedIndices = [...rowIndices].sort((a, b) => b - a);
      sortedIndices.forEach((rowIndex) => {
        if (rowIndex < this.yRowOrder.length) {
          const rowId = this.yRowOrder.get(rowIndex);
          this.yRowOrder.delete(rowIndex, 1);
          this.yRowData.delete(rowId);
          deletedCount++;
        } else {
          // console.warn(
          //   `LiveTableDoc.deleteRows: Attempted to delete non-existent row at index ${rowIndex}. Row order length: ${this.yRowOrder.length}`
          // );
        }
      });
    });
    if (deletedCount < rowIndices.length) {
      // console.warn(
      //   `LiveTableDoc.deleteRows: Attempted to delete ${rowIndices.length} rows, but only ${deletedCount} were valid and deleted.`
      // );
    }
    return deletedCount;
  }

  /**
   * Inserts columns into the table at the specified index.
   * @param initialInsertIndex - The index to insert the columns at in yColumnOrder
   * @param columnsToInsert - Array of { headerName, columnData } objects. columnData values correspond to rows in yRowOrder.
   * @returns The number of columns inserted
   */
  insertColumns(
    initialInsertIndex: number,
    columnsToInsert: {
      headerName: string;
      columnData: (CellValue | null)[] | null;
    }[]
  ): number {
    if (columnsToInsert.length === 0) {
      return 0;
    }
    try {
      this.yDoc.transact(() => {
        const newColumnIds: ColumnId[] = [];
        columnsToInsert.forEach((colSpec) => {
          const columnId = crypto.randomUUID() as ColumnId;
          newColumnIds.push(columnId);

          const definition: ColumnDefinition = {
            id: columnId,
            name: colSpec.headerName,
            width: DEFAULT_COL_WIDTH, // Or make configurable
          };
          this.yColumnDefinitions.set(columnId, definition);

          // Add cell data for this new column to all existing rows
          this.yRowOrder.forEach((rowId, rowIndex) => {
            const rowMap = this.yRowData.get(rowId);
            if (rowMap) {
              const cellValue =
                colSpec.columnData && colSpec.columnData[rowIndex] != null
                  ? colSpec.columnData[rowIndex]
                  : "";
              rowMap.set(columnId, cellValue as CellValue);
            }
          });

          // If table has no rows yet, but we are inserting columns,
          // subsequent row insertions will handle cell creation.
          // If columnsToInsert implies data for non-existent rows, that data is ignored.
        });
        this.yColumnOrder.insert(initialInsertIndex, newColumnIds);

        // If table was empty and now has columns, add one empty row if no rows exist.
        if (this.yRowOrder.length === 0 && newColumnIds.length > 0) {
          const rowId = crypto.randomUUID() as RowId;
          const newRowYMap = new Y.Map<CellValue>();
          const assignedColumnIds: ColumnId[] = [];
          newColumnIds.forEach((columnId) => {
            newRowYMap.set(columnId, ""); // Initialize with empty strings
            assignedColumnIds.push(columnId);
          });
          // If there are other columns already, ensure they are also in this new row.
          this.yColumnOrder.forEach((existingColId) => {
            if (!assignedColumnIds.includes(existingColId)) {
              newRowYMap.set(existingColId, "");
            }
          });
          this.yRowData.set(rowId, newRowYMap);
          this.yRowOrder.push([rowId]);
        }
      });
      return columnsToInsert.length;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Deletes columns from the table.
   * Assumes colIndices are sorted in descending order by the caller to prevent index shifting issues.
   * @param colIndices - An array of column indices (from yColumnOrder) to delete (sorted descending).
   * @returns number of columns deleted.
   */
  deleteColumns(colIndices: number[]): number {
    if (colIndices.length === 0) {
      return 0;
    }
    let deletedCount = 0;
    this.yDoc.transact(() => {
      // Sort descending to handle index shifts correctly if not already sorted by caller
      const sortedIndices = [...colIndices].sort((a, b) => b - a);
      sortedIndices.forEach((colIndex) => {
        if (colIndex < this.yColumnOrder.length) {
          const columnId = this.yColumnOrder.get(colIndex);
          this.yColumnOrder.delete(colIndex, 1);
          this.yColumnDefinitions.delete(columnId);

          // Delete data for this column from all rows
          this.yRowData.forEach((rowMap) => {
            rowMap.delete(columnId);
          });
          deletedCount++;
        } else {
          // console.warn(
          //   `LiveTableDoc.deleteColumns: Attempted to delete non-existent column at index ${colIndex}. Column order length: ${this.yColumnOrder.length}`
          // );
        }
      });
    });
    if (deletedCount < colIndices.length) {
      // console.warn(
      //   `LiveTableDoc.deleteColumns: Attempted to delete ${colIndices.length} columns, but only ${deletedCount} were valid and deleted.`
      // );
    }
    return deletedCount;
  }

  /**
   * Updates the width of a specific column.
   * @param headerName - The name of the column to update.
   * @param newWidth - The new width for the column.
   */
  updateColumnWidth(headerName: string, newWidth: number): void {
    this.yDoc.transact(() => {
      let columnIdToUpdate: ColumnId | undefined;
      // Find columnId by name
      for (const [id, def] of this.yColumnDefinitions) {
        if (def.name === headerName) {
          columnIdToUpdate = id;
          break;
        }
      }

      if (columnIdToUpdate) {
        const definition = this.yColumnDefinitions.get(columnIdToUpdate);
        if (definition) {
          const updatedDefinition: ColumnDefinition = {
            ...definition,
            width: newWidth,
          };
          this.yColumnDefinitions.set(columnIdToUpdate, updatedDefinition);
        } else {
          // console.warn(
          //   `LiveTableDoc.updateColumnWidth: No definition found for ID derived from header '${headerName}'.`
          // );
        }
      } else {
        // console.warn(
        //   `LiveTableDoc.updateColumnWidth: No column found with header name '${headerName}'.`
        // );
      }
    });
  }

  /**
   * Updates the value of a specific cell in the table.
   * @param rowIndex - The index of the row (in yRowOrder) to update.
   * @param headerName - The name of the column to update.
   * @param newValue - The new value for the cell.
   */
  updateCell(rowIndex: number, headerName: string, newValue: CellValue): void {
    this.yDoc.transact(() => {
      const rowId = this.yRowOrder.get(rowIndex);
      if (!rowId) {
        // console.warn(`LiveTableDoc.updateCell: Invalid rowIndex ${rowIndex}.`);
        return;
      }

      let columnIdToUpdate: ColumnId | undefined;
      for (const [id, def] of this.yColumnDefinitions) {
        if (def.name === headerName) {
          columnIdToUpdate = id;
          break;
        }
      }

      if (!columnIdToUpdate) {
        // console.warn(
        //   `LiveTableDoc.updateCell: No column found with header name '${headerName}'.`
        // );
        return;
      }

      const yRowMap = this.yRowData.get(rowId);
      if (yRowMap) {
        // Y.Map.set will handle create or update.
        // For V1 compatibility where empty string meant delete, we don't do that here.
        // CellValue is string, so empty string is a valid value.
        yRowMap.set(columnIdToUpdate, newValue);
      } else {
        // console.warn(
        //   `LiveTableDoc.updateCell: No row data found for rowId ${rowId}.`
        // );
      }
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
