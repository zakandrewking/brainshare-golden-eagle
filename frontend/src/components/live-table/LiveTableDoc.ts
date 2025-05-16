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

  // public editLocks: Y.Map<EditLock>;

  // undo/redo manager
  public undoManager: UndoManager;

  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;

    // this is the basic structure of the doc
    this.yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    this.yHeaders = yDoc.getArray<string>("tableHeaders");
    this.yColWidths = yDoc.getMap<number>("colWidths");

    // // TODO validate with zod on receipt
    // this.editLocks = yDoc.getMap<EditLock>("editLocks");

    // undo/redo manager
    this.undoManager = new UndoManager(
      [this.yTable, this.yHeaders, this.yColWidths],
      {
        captureTimeout: 500,
      }
    );
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
