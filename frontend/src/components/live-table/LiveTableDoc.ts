import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

import { DEFAULT_COL_WIDTH } from "./config";

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

// Lock-related types
export interface CellLock {
  rowId: RowId;
  columnId: ColumnId;
}

export interface LockRange {
  id: string; // Unique identifier for this lock
  cells: CellLock[]; // Array of locked cells using stable IDs
  note?: string;
}

// Awareness-related types
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

  // -- Lock Properties --
  // Map of lock ranges keyed by lock ID
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

  // Awareness-related callbacks
  public awarenessStatesUpdateCallback:
    | ((awarenessStates: Map<number, AwarenessState | null>) => void)
    | undefined;
  public cursorsDataUpdateCallback:
    | ((cursorsData: CursorDataForCell[]) => void)
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
  // Lock Observers
  public updateLockedCellsObserver: () => void;
  // Awareness Observers
  public updateAwarenessStateObserver: () => void;

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

    // Locks
    this.yActiveLocks = yDoc.getMap<LockRange>("activeLocks");

    this._migrateToV2IfNeeded();

    // undo manager
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

    // Lock observers
    this.updateLockedCellsObserver = this.updateLockedCellsState.bind(this);
    // Awareness Observers
    this.updateAwarenessStateObserver = () => {
      // This will be implemented in LiveTableProvider where we have access to awareness
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
        }
      });
    });
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
        // Y.Map.set will handle create or update.
        // For V1 compatibility where empty string meant delete, we don't do that here.
        // CellValue is string, so empty string is a valid value.
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

      // Remove the column from its current position
      this.yColumnOrder.delete(fromIndex, 1);

      // Calculate the correct insertion index
      // If moving to the right, we need to account for the removal
      const insertIndex = toIndex > fromIndex ? toIndex : toIndex;

      // Insert it at the calculated position
      this.yColumnOrder.insert(insertIndex, [columnId]);
    });
  }

  /**
   * Sorts rows by the values in the given column.
   * @param headerName - The column name to sort by.
   * @param direction - "asc" for ascending or "desc" for descending.
   */
  sortRowsByColumn(headerName: string, direction: "asc" | "desc") {
    let columnIdToSort: ColumnId | undefined;

    for (const [id, def] of this.yColumnDefinitions) {
      if (def.name === headerName) {
        columnIdToSort = id;
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

    const isNumericColumn =
      rowsWithValues.length > 0 &&
      rowsWithValues.every(({ value }) => {
        if (value === null) return true;
        const strValue = String(value).trim();
        if (strValue === "") return true;
        // Remove commas before checking if it's a number
        const cleanedValue = strValue.replace(/,/g, "");
        const num = Number(cleanedValue);
        return !isNaN(num) && isFinite(num);
      });

    rowsWithValues.sort((a, b) => {
      if (isNumericColumn) {
        const aIsEmpty = a.value === null || String(a.value).trim() === "";
        const bIsEmpty = b.value === null || String(b.value).trim() === "";

        if (aIsEmpty && bIsEmpty) return 0;
        if (aIsEmpty) return direction === "asc" ? -1 : 1;
        if (bIsEmpty) return direction === "asc" ? 1 : -1;

        // Remove commas before converting to numbers
        const aNum = Number(String(a.value).replace(/,/g, ""));
        const bNum = Number(String(b.value).replace(/,/g, ""));

        return direction === "asc" ? aNum - bNum : bNum - aNum;
      }

      const aVal = String(a.value);
      const bVal = String(b.value);
      if (aVal < bVal) return direction === "asc" ? -1 : 1;
      if (aVal > bVal) return direction === "asc" ? 1 : -1;
      return 0;
    });

    const sortedRowIds = rowsWithValues.map((r) => r.id);

    this.yDoc.transact(() => {
      this.yRowOrder.delete(0, this.yRowOrder.length);
      this.yRowOrder.push(sortedRowIds);
    });
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
    // Normalize the range
    const minRowIndex = Math.min(startRowIndex, endRowIndex);
    const maxRowIndex = Math.max(startRowIndex, endRowIndex);
    const minColIndex = Math.min(startColIndex, endColIndex);
    const maxColIndex = Math.max(startColIndex, endColIndex);

    // Convert display indices to stable IDs
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

    // Pre-compute cursors for all cells
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const cellCursors: CursorInfo[] = [];

        awarenessStates.forEach((state) => {
          // Skip null states (users who have left)
          if (!state) return;

          // Check if this user has a selection that includes this cell
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
    // Handle null state (when users leave the room)
    if (!state) {
      return false;
    }

    // Check single cell selection
    if (
      state.selectedCell &&
      state.selectedCell.rowIndex === rowIndex &&
      state.selectedCell.colIndex === colIndex
    ) {
      return true;
    }

    // Check selection area
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
