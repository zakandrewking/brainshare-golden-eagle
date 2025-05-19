import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

// export type EditLockType =
//   | "cell-range"
//   | "cell-range-columns-locked"
//   | "cell-range-rows-locked";

// export interface EditLock {
//   type: EditLockType;
//   evidence: string;
// }

export class LiveTableDoc {
  // top level yjs entities
  public yDoc: Y.Doc;
  public yTable: Y.Array<Y.Map<unknown>>;
  public yHeaders: Y.Array<string>;
  public yColWidths: Y.Map<number>;

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

  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;

    // this is the basic structure of the doc
    this.yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    this.yHeaders = yDoc.getArray<string>("tableHeaders");
    this.yColWidths = yDoc.getMap<number>("colWidths");

    // // TODO validate with zod on receipt
    // this.editLocks = yDoc.getMap<EditLock>("editLocks");

    // persistent observer functions
    this.updateTableStateObserver = this.updateTableState.bind(this);
    this.updateHeadersStateObserver = this.updateHeadersState.bind(this);
    this.updateColWidthsStateObserver = this.updateColWidthsState.bind(this);

    // undo/redo manager
    this.undoManager = new UndoManager(
      [this.yTable, this.yHeaders, this.yColWidths],
      {
        captureTimeout: 500,
      }
    );
  }

  updateTableState() {
    const currentData = this.yTable.toArray().map((yMap) => {
      return Object.fromEntries(yMap.entries());
    });
    this.tableDataUpdateCallback?.(currentData);
  }

  // Function to update React state for headers
  updateHeadersState() {
    const currentHeaders = this.yHeaders.toArray();
    if (currentHeaders.length === 0 && this.yTable.length > 0) {
      const firstRowMap = this.yTable.get(0);
      if (firstRowMap) {
        const initialHeaders = Array.from(firstRowMap.keys()).sort();
        this.yDoc.transact(() => {
          if (this.yHeaders.length === 0) {
            this.yHeaders.push(initialHeaders);
            this.headersUpdateCallback?.(initialHeaders);
          } else {
            this.headersUpdateCallback?.(this.yHeaders.toArray());
          }
        });
      } else {
        this.headersUpdateCallback?.([]);
      }
    } else {
      this.headersUpdateCallback?.(currentHeaders);
    }
  }

  // Function to update React state for column widths
  updateColWidthsState() {
    const currentWidths = Object.fromEntries(this.yColWidths.entries());
    this.columnWidthsUpdateCallback?.(currentWidths);
  }

  /**
   * Initialize yDoc observers.
   */
  initializeObservers() {
    this.yTable.observeDeep(this.updateTableStateObserver);
    this.yHeaders.observe(this.updateHeadersStateObserver);
    this.yColWidths.observe(this.updateColWidthsStateObserver);
  }

  /**
   * Cleanup yDoc observers.
   */
  cleanupObservers() {
    this.yTable.unobserveDeep(this.updateTableStateObserver);
    this.yHeaders.unobserve(this.updateHeadersStateObserver);
    this.yColWidths.unobserve(this.updateColWidthsStateObserver);
  }

  /**
   * Edit a header in the table.
   * @param index - The index of the header to edit.
   * @param header - The new header value.
   */
  editHeader(index: number, header: string) {
    this.yDoc.transact(() => {
      const oldHeader = this.yHeaders.get(index);

      // Update the header in the yHeaders array
      this.yHeaders.delete(index, 1);
      this.yHeaders.insert(index, [header]);

      // Update all rows to use the new header key
      this.yTable.forEach((row: Y.Map<unknown>) => {
        if (row.has(oldHeader)) {
          const value = row.get(oldHeader);
          row.delete(oldHeader);
          row.set(header, value);
        }
      });

      // Update column width map if needed
      if (this.yColWidths.has(oldHeader)) {
        const width = this.yColWidths.get(oldHeader);
        if (width !== undefined) {
          this.yColWidths.delete(oldHeader);
          this.yColWidths.set(header, width);
        }
      }
    });
  }

  /**
   * insert rows into the table
   * @param initialInsertIndex - the index to insert the rows at
   * @param rowsToInsertInYjs - the rows to insert
   * @returns the number of rows inserted
   */
  insertRows(
    initialInsertIndex: number,
    rowsToInsertInYjs: Y.Map<unknown>[]
  ): number {
    if (rowsToInsertInYjs.length === 0) {
      return 0;
    }
    this.yTable.insert(initialInsertIndex, rowsToInsertInYjs);
    return rowsToInsertInYjs.length;
  }

  /**
   * Deletes rows from the table.
   * Assumes rowIndices are sorted in descending order by the caller to prevent index shifting issues.
   * @param rowIndices - An array of row indices to delete (sorted descending).
   * @returns number of rows deleted.
   */
  deleteRows(rowIndices: number[]): number {
    if (rowIndices.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    this.yDoc.transact(() => {
      rowIndices.forEach((rowIndex) => {
        // Ensure row exists before attempting to delete
        if (rowIndex < this.yTable.length) {
          this.yTable.delete(rowIndex, 1);
          deletedCount++;
        } else {
          console.warn(
            `LiveTableDoc.deleteRows: Attempted to delete non-existent row at index ${rowIndex}. Table length: ${this.yTable.length}`
          );
        }
      });
    });
    if (deletedCount < rowIndices.length) {
      // This case might indicate some indices were out of bounds but others were valid.
      // The operation is still partially successful.
      console.warn(
        `LiveTableDoc.deleteRows: Attempted to delete ${rowIndices.length} rows, but only ${deletedCount} were valid and deleted.`
      );
    }
    return deletedCount;
  }

  /**
   * Inserts columns into the table at the specified index.
   * @param initialInsertIndex - The index to insert the columns at
   * @param columnsToInsert - Array of { headerName, columnData } objects. columnData can be null for default columns.
   * @returns The number of columns inserted
   */
  insertColumns(
    initialInsertIndex: number,
    columnsToInsert: {
      headerName: string;
      columnData: (string | null)[] | null;
    }[]
  ): number {
    if (columnsToInsert.length === 0) {
      return 0;
    }
    try {
      this.yDoc.transact(() => {
        columnsToInsert.forEach((col, i) => {
          const insertIdx = initialInsertIndex + i;
          this.yHeaders.insert(insertIdx, [col.headerName]);
          this.yTable.forEach((row: Y.Map<unknown>, rowIndex) => {
            const valueToAdd = col.columnData
              ? col.columnData[rowIndex] ?? ""
              : "";
            if (!row.has(col.headerName)) {
              row.set(col.headerName, valueToAdd);
            }
          });
          // If table is empty, add a new row with just this column
          if (this.yTable.length === 0) {
            const newRow = new Y.Map<unknown>();
            const valueToAdd =
              col.columnData && col.columnData.length > 0
                ? col.columnData[0] ?? ""
                : "";
            newRow.set(col.headerName, valueToAdd);
            this.yTable.push([newRow]);
          }
        });
      });
      return columnsToInsert.length;
    } catch (error) {
      // Let the error propagate to the caller
      throw error instanceof Error ? error : new Error(String(error));
    }
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
