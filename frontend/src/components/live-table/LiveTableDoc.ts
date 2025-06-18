import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

import { DEFAULT_COL_WIDTH } from "./config";

export interface SortingConfig {
  column: string;
  direction: "asc" | "desc";
}

export type RowId = string;
export type ColumnId = string;

export type CellValue = string;

export type DataType =
  | "text"
  | "integer"
  | "decimal"
  | "datetime"
  | "enum"
  | "boolean"
  | "imageurl";

export interface ColumnDefinition {
  id: ColumnId;
  name: string;
  width: number;
  dataType?: DataType;
  enumValues?: string[];
}

export interface CellLock {
  rowId: RowId;
  columnId: ColumnId;
}

export interface LockRange {
  id: string;
  cells: CellLock[];
  note?: string;
}

export interface CellPosition {
  rowIndex: number;
  colIndex: number;
}

export interface SelectionArea {
  startCell: CellPosition | null;
  endCell: CellPosition | null;
}

export interface AwarenessState {
  user?: {
    name: string;
    color: string;
  };
  selectedCell?: CellPosition | null;
  selectionArea?: SelectionArea | null;
}

export interface CursorInfo {
  user?: { name: string; color: string };
}

export interface CursorDataForCell {
  rowIndex: number;
  colIndex: number;
  cursors: CursorInfo[];
}

const CURRENT_SCHEMA_VERSION = 2;

export class LiveTableDoc {
  public yDoc: Y.Doc;

  public yTable: Y.Array<Y.Map<unknown>>;
  public yHeaders: Y.Array<string>;
  public yColWidths: Y.Map<number>;

  public yMeta: Y.Map<unknown>;
  public yRowData: Y.Map<Y.Map<CellValue>>;
  public yColumnDefinitions: Y.Map<ColumnDefinition>;
  public yColumnOrder: Y.Array<ColumnId>;
  public yRowOrder: Y.Array<RowId>;

  public yActiveLocks: Y.Map<LockRange>;

  public tableDataUpdateCallback:
    | ((data: Record<string, unknown>[]) => void)
    | undefined;
  public headersUpdateCallback: ((headers: string[]) => void) | undefined;
  public columnWidthsUpdateCallback:
    | ((widths: Record<string, number>) => void)
    | undefined;
  public lockedCellsUpdateCallback:
    | ((lockedCells: Map<string, string | undefined>) => void)
    | undefined;

  public awarenessStatesUpdateCallback:
    | ((awarenessStates: Map<number, AwarenessState | null>) => void)
    | undefined;
  public cursorsDataUpdateCallback:
    | ((cursorsData: CursorDataForCell[]) => void)
    | undefined;

  public undoManager: UndoManager;

  public updateTableStateObserver: () => void;
  public updateHeadersStateObserver: () => void;
  public updateColWidthsStateObserver: () => void;
  public updateV2TableDataObserver: () => void;
  public updateV2ColumnDefinitionsObserver: () => void;
  public updateV2ColumnOrderObserver: () => void;
  public updateV2RowOrderObserver: () => void;
  public updateLockedCellsObserver: () => void;
  public updateAwarenessStateObserver: () => void;

  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;

    this.yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    this.yHeaders = yDoc.getArray<string>("tableHeaders");
    this.yColWidths = yDoc.getMap<number>("colWidths");

    this.yMeta = yDoc.getMap<unknown>("metaData");
    this.yRowData = yDoc.getMap<Y.Map<CellValue>>("rowData");
    this.yColumnDefinitions =
      yDoc.getMap<ColumnDefinition>("columnDefinitions");
    this.yColumnOrder = yDoc.getArray<ColumnId>("columnOrder");
    this.yRowOrder = yDoc.getArray<RowId>("rowOrder");

    this.yActiveLocks = yDoc.getMap<LockRange>("activeLocks");

    this._migrateToV2IfNeeded();

    const itemsToTrack = [
      this.yRowData,
      this.yColumnDefinitions,
      this.yColumnOrder,
      this.yRowOrder,
      this.yActiveLocks,
    ];
    this.undoManager = new UndoManager(itemsToTrack, {
      captureTimeout: 500,
    });

    this.updateTableStateObserver = this.updateTableState.bind(this);
    this.updateHeadersStateObserver = this.updateHeadersState.bind(this);
    this.updateColWidthsStateObserver = this.updateColWidthsState.bind(this);

    this.updateV2TableDataObserver = this.updateTableState.bind(this);
    this.updateV2ColumnDefinitionsObserver = () => {
      this.updateHeadersState();
      this.updateColWidthsState();
    };
    this.updateV2ColumnOrderObserver = () => {
      this.updateHeadersState();
      this.updateLockedCellsState();
    };
    this.updateV2RowOrderObserver = () => {
      this.updateTableState();
      this.updateLockedCellsState();
    };

    this.updateV2ColumnDefinitionsObserver = () => {
      this.updateHeadersState();
      this.updateColWidthsState();
      this.updateTableState();
    };

    this.updateLockedCellsObserver = this.updateLockedCellsState.bind(this);
    this.updateAwarenessStateObserver = () => {};
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
          dataType: "text",
        };
        this.yColumnDefinitions.set(columnId, definition);
        this.yColumnOrder.push([columnId]);
      });

      const oldTableDataArray = this.yTable.toArray();
      oldTableDataArray.forEach((oldRowMapY) => {
        const oldRowMap = Object.fromEntries(oldRowMapY.entries());
        const rowId = crypto.randomUUID() as RowId;
        this.yRowOrder.push([rowId]);

        const newRowYMap = new Y.Map<CellValue>();
        headerToColumnIdMap.forEach((columnId, oldHeaderString) => {
          const cellValue = oldRowMap[oldHeaderString] as string;
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
    this.yActiveLocks.observe(this.updateLockedCellsObserver);

    // Manually trigger initial state propagation
    this.updateTableState();
    this.updateHeadersState();
    this.updateColWidthsState();
    this.updateLockedCellsState();
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
    this.yActiveLocks.unobserve(this.updateLockedCellsObserver);
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
        return;
      }
      const definition = this.yColumnDefinitions.get(columnId);
      if (definition) {
        const updatedDefinition: ColumnDefinition = {
          ...definition,
          name: newHeaderName,
        };
        this.yColumnDefinitions.set(columnId, updatedDefinition);
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

    // Update locked cells state after insertion to recalculate display indices
    this.updateLockedCellsState();

    return rowsData.length;
  }

  /**
   * insert empty rows into the table
   * @param initialInsertIndex - the index to insert the rows at in yRowOrder
   * @param count - the number of empty rows to insert
   * @returns the number of rows inserted
   */
  insertEmptyRows(initialInsertIndex: number, count: number): number {
    if (count <= 0) {
      return 0;
    }

    let insertedCount = 0;
    this.yDoc.transact(() => {
      const newRowIds: RowId[] = [];
      const columnDefs = Array.from(this.yColumnDefinitions.values());
      if (columnDefs.length === 0) {
        // cannot insert rows if there are no columns
        return;
      }

      for (let i = 0; i < count; i++) {
        const rowId = crypto.randomUUID() as RowId;
        newRowIds.push(rowId);
        const newRowYMap = new Y.Map<CellValue>();

        columnDefs.forEach((def) => {
          newRowYMap.set(def.id, "");
        });
        this.yRowData.set(rowId, newRowYMap);
      }
      this.yRowOrder.insert(initialInsertIndex, newRowIds);
      insertedCount = count;
    });

    // Update locked cells state after insertion to recalculate display indices
    this.updateLockedCellsState();

    return insertedCount;
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
        }
      });
    });

    // Update locked cells state after deletion to recalculate display indices
    this.updateLockedCellsState();

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
            width: DEFAULT_COL_WIDTH,
            dataType: "text",
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
        });
        this.yColumnOrder.insert(initialInsertIndex, newColumnIds);

        if (this.yRowOrder.length === 0 && newColumnIds.length > 0) {
          const rowId = crypto.randomUUID() as RowId;
          const newRowYMap = new Y.Map<CellValue>();
          const assignedColumnIds: ColumnId[] = [];
          newColumnIds.forEach((columnId) => {
            newRowYMap.set(columnId, "");
            assignedColumnIds.push(columnId);
          });
          this.yColumnOrder.forEach((existingColId) => {
            if (!assignedColumnIds.includes(existingColId)) {
              newRowYMap.set(existingColId, "");
            }
          });
          this.yRowData.set(rowId, newRowYMap);
          this.yRowOrder.push([rowId]);
        }
      });

      // Update locked cells state after insertion to recalculate display indices
      this.updateLockedCellsState();

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
    const deletedColumnIds: ColumnId[] = [];

    this.yDoc.transact(() => {
      // Sort descending to handle index shifts correctly if not already sorted by caller
      const sortedIndices = [...colIndices].sort((a, b) => b - a);
      sortedIndices.forEach((colIndex) => {
        if (colIndex < this.yColumnOrder.length) {
          const columnId = this.yColumnOrder.get(colIndex);
          deletedColumnIds.push(columnId);
          this.yColumnOrder.delete(colIndex, 1);
          this.yColumnDefinitions.delete(columnId);

          this.yRowData.forEach((rowMap) => {
            rowMap.delete(columnId);
          });
          deletedCount++;
        }
      });

      // Clean up locked cells that reference deleted columns
      const locksToRemove: string[] = [];
      this.yActiveLocks.forEach((lockRange, lockId) => {
        const remainingCells = lockRange.cells.filter(
          (cell) => !deletedColumnIds.includes(cell.columnId)
        );

        if (remainingCells.length === 0) {
          // Remove lock entirely if all cells are in deleted columns
          locksToRemove.push(lockId);
        } else if (remainingCells.length !== lockRange.cells.length) {
          // Update lock with remaining cells if some were removed
          this.yActiveLocks.set(lockId, {
            ...lockRange,
            cells: remainingCells,
          });
        }
      });

      // Remove locks that have no remaining cells
      locksToRemove.forEach((lockId) => {
        this.yActiveLocks.delete(lockId);
      });
    });

    // Update locked cells state after deletion to recalculate display indices
    // This needs to be called outside the transaction to ensure the callback is triggered
    this.updateLockedCellsState();

    return deletedCount;
  }

  /**
   * Updates the data type of a specific column.
   * @param headerName - The name of the column to update.
   * @param newDataType - The new data type for the column.
   * @param enumValues - The enum values if dataType is 'enum'.
   */
  updateColumnDataType(
    headerName: string,
    newDataType: DataType,
    enumValues?: string[]
  ): void {
    this.yDoc.transact(() => {
      let columnIdToUpdate: ColumnId | undefined;
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
            dataType: newDataType,
            enumValues: newDataType === "enum" ? enumValues : undefined,
          };
          this.yColumnDefinitions.set(columnIdToUpdate, updatedDefinition);
        }
      }
    });
  }

  /**
   * Gets the data type of a specific column.
   * @param headerName - The name of the column.
   * @returns The data type of the column or 'text' if not found.
   */
  getColumnDataType(headerName: string): DataType {
    for (const [_id, def] of this.yColumnDefinitions) {
      if (def.name === headerName) {
        return def.dataType || "text";
      }
    }
    return "text";
  }

  /**
   * Gets the enum values of a specific column.
   * @param headerName - The name of the column.
   * @returns The enum values or undefined if not an enum column.
   */
  getColumnEnumValues(headerName: string): string[] | undefined {
    for (const [_id, def] of this.yColumnDefinitions) {
      if (def.name === headerName) {
        return def.enumValues;
      }
    }
    return undefined;
  }

  /**
   * Updates the width of a specific column.
   * @param headerName - The name of the column to update.
   * @param newWidth - The new width for the column.
   */
  updateColumnWidth(headerName: string, newWidth: number): void {
    this.yDoc.transact(() => {
      let columnIdToUpdate: ColumnId | undefined;
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
        }
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
        return;
      }

      const yRowMap = this.yRowData.get(rowId);
      if (yRowMap) {
        yRowMap.set(columnIdToUpdate, newValue);
      }
    });
  }

  /**
   * Reorders a column by moving it from one position to another.
   * @param fromIndex - The current index of the column to move.
   * @param toIndex - The target index where the column should be moved.
   */
  reorderColumn(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) {
      return;
    }
    if (fromIndex < 0 || fromIndex >= this.yColumnOrder.length) {
      return;
    }
    if (toIndex < 0 || toIndex >= this.yColumnOrder.length) {
      return;
    }

    this.yDoc.transact(() => {
      const columnId = this.yColumnOrder.get(fromIndex);
      if (!columnId) {
        return;
      }

      this.yColumnOrder.delete(fromIndex, 1);

      const insertIndex = toIndex > fromIndex ? toIndex : toIndex;

      this.yColumnOrder.insert(insertIndex, [columnId]);
    });

    // Update locked cells state after reordering to recalculate display indices
    this.updateLockedCellsState();
  }

  /**
   * Sorts rows by the values in the given column.
   * @param headerName - The column name to sort by.
   * @param direction - "asc" for ascending or "desc" for descending.
   */
  sortRowsByColumn(headerName: string, direction: "asc" | "desc") {
    let columnIdToSort: ColumnId | undefined;
    let columnDataType: DataType = "text";

    for (const [id, def] of this.yColumnDefinitions) {
      if (def.name === headerName) {
        columnIdToSort = id;
        columnDataType = def.dataType || "text";
        break;
      }
    }

    if (!columnIdToSort) {
      return;
    }

    const rowsWithValues: { id: RowId; value: CellValue }[] = [];

    this.yRowOrder.forEach((rowId) => {
      const rowMap = this.yRowData.get(rowId);
      const value = rowMap?.get(columnIdToSort!) ?? "";
      rowsWithValues.push({ id: rowId, value });
    });

    // If no explicit data type is set, try to auto-detect numeric columns (backward compatibility)
    if (columnDataType === "text") {
      const isNumericColumn =
        rowsWithValues.length > 0 &&
        rowsWithValues.every(({ value }) => {
          if (value === null) return true;
          const strValue = String(value).trim();
          if (strValue === "") return true;
          const cleanedValue = strValue.replace(/,/g, "");
          const num = Number(cleanedValue);
          return !isNaN(num) && isFinite(num);
        });

      if (isNumericColumn) {
        columnDataType = "integer";
      }
    }

    rowsWithValues.sort((a, b) => {
      const aIsEmpty = a.value === null || String(a.value).trim() === "";
      const bIsEmpty = b.value === null || String(b.value).trim() === "";

      // Handle empty values first
      if (aIsEmpty && bIsEmpty) return 0;
      if (aIsEmpty) return direction === "asc" ? -1 : 1;
      if (bIsEmpty) return direction === "asc" ? 1 : -1;

      const aVal = String(a.value);
      const bVal = String(b.value);

      let comparison = 0;

      switch (columnDataType) {
        case "integer": {
          const aNum = Number(aVal.replace(/,/g, ""));
          const bNum = Number(bVal.replace(/,/g, ""));
          comparison = aNum - bNum;
          break;
        }
        case "decimal": {
          const aNum = parseFloat(aVal.replace(/[$,]/g, ""));
          const bNum = parseFloat(bVal.replace(/[$,]/g, ""));
          comparison = aNum - bNum;
          break;
        }
        case "datetime": {
          // Try to parse as ISO 8601 dates
          const aDate = new Date(aVal);
          const bDate = new Date(bVal);
          if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
            comparison = aDate.getTime() - bDate.getTime();
          } else {
            // Fallback to string comparison if not valid dates
            comparison = aVal.localeCompare(bVal);
          }
          break;
        }
        case "boolean": {
          // Convert to boolean values for comparison
          const aBool = this.parseBooleanValue(aVal);
          const bBool = this.parseBooleanValue(bVal);
          comparison = (aBool ? 1 : 0) - (bBool ? 1 : 0);
          break;
        }
        case "enum": {
          // Get enum values for this column
          const enumValues = this.getColumnEnumValues(headerName);
          if (enumValues) {
            const aIndex = enumValues.indexOf(aVal);
            const bIndex = enumValues.indexOf(bVal);
            // If both values are in enum, sort by enum order
            if (aIndex !== -1 && bIndex !== -1) {
              comparison = aIndex - bIndex;
            } else {
              // Fallback to string comparison
              comparison = aVal.localeCompare(bVal);
            }
          } else {
            comparison = aVal.localeCompare(bVal);
          }
          break;
        }
        case "imageurl":
        case "text":
        default: {
          comparison = aVal.localeCompare(bVal);
          break;
        }
      }

      return direction === "asc" ? comparison : -comparison;
    });

    const sortedRowIds = rowsWithValues.map((r) => r.id);

    this.yDoc.transact(() => {
      this.yRowOrder.delete(0, this.yRowOrder.length);
      this.yRowOrder.push(sortedRowIds);
    });
  }

  /**
   * Helper method to parse boolean values from strings.
   * @param value - The string value to parse as boolean.
   * @returns Boolean representation of the value.
   */
  private parseBooleanValue(value: string): boolean {
    const lowerValue = value.toLowerCase().trim();
    return (
      lowerValue === "true" ||
      lowerValue === "yes" ||
      lowerValue === "1" ||
      lowerValue === "on"
    );
  }

  /**
   * Updates the locked cells state for React components.
   */
  updateLockedCellsState() {
    const lockedCells = new Map<string, string | undefined>();

    this.yActiveLocks.forEach((lockRange) => {
      lockRange.cells.forEach((cellLock) => {
        // Convert rowId and columnId to display indices
        const rowIndex = this.yRowOrder.toArray().indexOf(cellLock.rowId);
        const colIndex = this.yColumnOrder.toArray().indexOf(cellLock.columnId);

        if (rowIndex >= 0 && colIndex >= 0) {
          lockedCells.set(`${rowIndex}-${colIndex}`, lockRange.note);
        }
      });
    });

    if (this.lockedCellsUpdateCallback) {
      this.lockedCellsUpdateCallback(lockedCells);
    }
  }

  /**
   * Locks a range of cells based on display indices.
   * @param startRowIndex - Starting row index (display order)
   * @param endRowIndex - Ending row index (display order)
   * @param startColIndex - Starting column index (display order)
   * @param endColIndex - Ending column index (display order)
   * @param note - Optional note for the lock
   * @returns The lock ID if successful, null if failed
   */
  lockCellRange(
    startRowIndex: number,
    endRowIndex: number,
    startColIndex: number,
    endColIndex: number,
    note?: string
  ): string | null {
    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    const cells: CellLock[] = [];
    for (let rowIndex = minRowIndex; rowIndex <= maxRowIndex; rowIndex++) {
      const rowId = this.yRowOrder.get(rowIndex);
      if (!rowId) continue;

      for (let colIndex = minColIndex; colIndex <= maxColIndex; colIndex++) {
        const columnId = this.yColumnOrder.get(colIndex);
        if (!columnId) continue;

        cells.push({ rowId, columnId });
      }
    }

    if (cells.length === 0) {
      return null;
    }

    const lockId = crypto.randomUUID();
    const lockRange: LockRange = {
      id: lockId,
      cells,
      note,
    };

    this.yDoc.transact(() => {
      this.yActiveLocks.set(lockId, lockRange);
    });

    return lockId;
  }

  /**
   * Unlocks a specific lock range.
   * @param lockId - The ID of the lock to remove
   * @returns True if the lock was removed, false if not found
   */
  unlockRange(lockId: string): boolean {
    if (!this.yActiveLocks.has(lockId)) {
      return false;
    }

    this.yDoc.transact(() => {
      this.yActiveLocks.delete(lockId);
    });

    return true;
  }

  /**
   * Unlocks all locks.
   */
  unlockAll(): void {
    this.yDoc.transact(() => {
      this.yActiveLocks.clear();
    });
  }

  /**
   * Gets all active locks.
   * @returns Array of all lock ranges
   */
  getActiveLocks(): LockRange[] {
    return Array.from(this.yActiveLocks.values());
  }

  /**
   * Updates awareness states for React components.
   * This method should be called when awareness changes.
   */
  updateAwarenessState(awarenessStates: Map<number, AwarenessState | null>) {
    if (this.awarenessStatesUpdateCallback) {
      this.awarenessStatesUpdateCallback(awarenessStates);
    }

    // Also update cursors data
    this.updateCursorsData(awarenessStates);
  }

  /**
   * Computes and updates cursor data for all cells based on awareness states.
   */
  updateCursorsData(awarenessStates: Map<number, AwarenessState | null>) {
    if (!this.cursorsDataUpdateCallback) return;

    const cursorsData: CursorDataForCell[] = [];
    const rowCount = this.yRowOrder.length;
    const colCount = this.yColumnOrder.length;

    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cellCursors: CursorInfo[] = [];

        awarenessStates.forEach((state) => {
          if (!state) return;

          if (this.isCellInUserSelection(r, c, state)) {
            cellCursors.push({
              user: state.user,
            });
          }
        });

        if (cellCursors.length > 0) {
          cursorsData.push({ rowIndex: r, colIndex: c, cursors: cellCursors });
        }
      }
    }

    this.cursorsDataUpdateCallback(cursorsData);
  }

  /**
   * Checks if a cell is within a user's selection area.
   */
  private isCellInUserSelection(
    rowIndex: number,
    colIndex: number,
    state: AwarenessState | null
  ): boolean {
    if (!state) {
      return false;
    }

    if (
      state.selectedCell &&
      state.selectedCell.rowIndex === rowIndex &&
      state.selectedCell.colIndex === colIndex
    ) {
      return true;
    }

    if (state.selectionArea?.startCell && state.selectionArea?.endCell) {
      const { startCell, endCell } = state.selectionArea;
      const minRow = Math.min(startCell.rowIndex, endCell.rowIndex);
      const maxRow = Math.max(startCell.rowIndex, endCell.rowIndex);
      const minCol = Math.min(startCell.colIndex, endCell.colIndex);
      const maxCol = Math.max(startCell.colIndex, endCell.colIndex);

      return (
        rowIndex >= minRow &&
        rowIndex <= maxRow &&
        colIndex >= minCol &&
        colIndex <= maxCol
      );
    }

    return false;
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
