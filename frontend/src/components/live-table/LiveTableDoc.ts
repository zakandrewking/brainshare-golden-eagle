import * as Y from "yjs";
import { UndoManager } from "yjs";

import { useRoom } from "@liveblocks/react";
import { getYjsProviderForRoom } from "@liveblocks/yjs";

export class LiveTableDoc {
  public yDoc: Y.Doc;
  public yTable: Y.Array<Y.Map<unknown>>;
  public yHeaders: Y.Array<string>;
  public yColWidths: Y.Map<number>;
  public undoManager: UndoManager;

  constructor(yDoc: Y.Doc) {
    this.yDoc = yDoc;
    this.yTable = yDoc.getArray<Y.Map<unknown>>("tableData");
    this.yHeaders = yDoc.getArray<string>("tableHeaders");
    this.yColWidths = yDoc.getMap<number>("colWidths");
    this.undoManager = new UndoManager(
      [this.yTable, this.yHeaders, this.yColWidths],
      {
        captureTimeout: 500,
      }
    );
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
