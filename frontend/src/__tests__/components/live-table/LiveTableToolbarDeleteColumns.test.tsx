import React, { useTransition } from "react";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from "vitest";
import * as Y from "yjs";

import {
  type CellValue,
  type ColumnDefinition,
  type ColumnId,
  LiveTableDoc,
  type RowId,
} from "@/components/live-table/LiveTableDoc";
import {
  useDeleteColumns,
  useHeaders,
  useIsCellLockedFn,
  useIsTableLoaded,
  useTableData,
} from "@/stores/dataStore";

vi.mock("@liveblocks/react", () => ({
  useSelf: vi.fn(() => ({
    info: {
      name: "Test User",
      color: "#FF0000",
    },
  })),
  useRoom: vi.fn(() => ({})),
  RoomProvider: vi.fn(({ children }) => children),
}));

vi.mock("react", async () => {
  const actualReact = await vi.importActual<typeof import("react")>("react");
  return {
    ...actualReact,
    default: actualReact,
    useTransition: vi.fn(() => [
      false,
      vi.fn((callback) => {
        if (callback) callback();
      }),
    ]),
  };
});

vi.mock("@/stores/selectionStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useSelectedCells: vi.fn(),
  useSelectionStart: vi.fn(),
  useSelectionEnd: vi.fn(),
  useSelectionRange: vi.fn(),
  useSelection: vi.fn(),
  useSelectedCell: vi.fn(),
}));

vi.mock("@/stores/dataStore", async (importOriginal) => ({
  ...(await importOriginal()),
  useIsTableLoaded: vi.fn(),
  useHeaders: vi.fn(),
  useTableData: vi.fn(),
  useLockedCells: vi.fn(),
  useLockSelectedRange: vi.fn(),
  useUnlockAll: vi.fn(),
  useUnlockRange: vi.fn(),
  useIsCellLockedFn: vi.fn(() => () => false),
  useDeleteColumns: vi.fn(),
  useUndoManager: () => ({
    undo: vi.fn(),
    redo: vi.fn(),
    undoStack: [],
    redoStack: [],
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

vi.mock("lucide-react", async () => {
  const actual = (await vi.importActual(
    "lucide-react"
  )) as typeof import("lucide-react");
  return {
    ...actual,
    Trash2: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="trash-icon" {...props} />
    ),
    ArrowDownToLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowLeftFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowRightFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    ArrowUpFromLine: (props: React.SVGProps<SVGSVGElement>) => (
      <svg {...props} />
    ),
    Columns3: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="columns3-icon" {...props} />
    ),
    Download: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Redo: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
    Rows3: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="rows3-icon" {...props} />
    ),
    Undo: (props: React.SVGProps<SVGSVGElement>) => <svg {...props} />,
  };
});

describe("LiveTableToolbar - Delete Column", () => {
  let liveTableDocInstance: LiveTableDoc;
  let mockDeleteColumns: Mock;

  // Initial V2 data structures
  const colId1 = crypto.randomUUID() as ColumnId;
  const colId2 = crypto.randomUUID() as ColumnId;
  const colId3 = crypto.randomUUID() as ColumnId;
  const colId4 = crypto.randomUUID() as ColumnId;

  const initialColumnDefinitions: ColumnDefinition[] = [
    { id: colId1, name: "Header1", width: 100 },
    { id: colId2, name: "Header2", width: 150 },
    { id: colId3, name: "Header3", width: 200 },
    { id: colId4, name: "Header4", width: 120 },
  ];
  const initialHeaders = [colId1, colId2, colId3, colId4];
  const initialColumnOrder: ColumnId[] = [colId1, colId2, colId3, colId4];

  const rowId1 = crypto.randomUUID() as RowId;
  const rowId2 = crypto.randomUUID() as RowId;
  const rowId3 = crypto.randomUUID() as RowId;
  const initialRowOrder: RowId[] = [rowId1, rowId2, rowId3];

  const initialRowData: Record<RowId, Record<ColumnId, CellValue>> = {
    [rowId1]: {
      [colId1]: "R1C1",
      [colId2]: "R1C2",
      [colId3]: "R1C3",
      [colId4]: "R1C4",
    },
    [rowId2]: {
      [colId1]: "R2C1",
      [colId2]: "R2C2",
      [colId3]: "R2C3",
      [colId4]: "R2C4",
    },
    [rowId3]: {
      [colId1]: "R3C1",
      [colId2]: "R3C2",
      [colId3]: "R3C3",
      [colId4]: "R3C4",
    },
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    vi.mocked(useIsTableLoaded).mockReturnValue(true);
    vi.mocked(useIsCellLockedFn).mockReturnValue(() => false);
    vi.mocked(useHeaders).mockReturnValue(initialHeaders);
    vi.mocked(useTableData).mockReturnValue(Object.values(initialRowData));

    const mockStartTransition = vi.fn((callback) => {
      if (callback) callback();
    });
    (useTransition as Mock).mockReturnValue([false, mockStartTransition]);

    const yDoc = new Y.Doc();
    liveTableDocInstance = new LiveTableDoc(yDoc);

    // Manually populate V2 data for the instance
    yDoc.transact(() => {
      initialColumnDefinitions.forEach((def) =>
        liveTableDocInstance.yColumnDefinitions.set(def.id, def)
      );
      liveTableDocInstance.yColumnOrder.push(initialColumnOrder);
      initialRowOrder.forEach((rId) => {
        const rData = initialRowData[rId];
        const yRowMap = new Y.Map<CellValue>();
        initialColumnOrder.forEach((cId) => {
          if (rData[cId]) yRowMap.set(cId, rData[cId]);
        });
        liveTableDocInstance.yRowData.set(rId, yRowMap);
      });
      liveTableDocInstance.yRowOrder.push(initialRowOrder);
      liveTableDocInstance.yMeta.set("schemaVersion", 2);
    });

    mockDeleteColumns = vi.fn().mockResolvedValue({ deletedCount: 0 });
    vi.mocked(useDeleteColumns).mockReturnValue(mockDeleteColumns);
  });

  afterEach(() => {
    liveTableDocInstance.yDoc.destroy();
  });

  it("should update locked cell positions after deleting columns", async () => {
    // Lock a cell in column 2 (index 2)
    const lockId = liveTableDocInstance.lockCellRange(0, 0, 2, 2, "test lock");
    expect(lockId).toBeTruthy();

    // Use a shared state object to track callback updates
    const stateTracker = {
      lockedCellsMap: new Map<string, string | undefined>(),
      callCount: 0,
    };

    const mockCallback = vi.fn((map) => {
      stateTracker.callCount++;
      stateTracker.lockedCellsMap = new Map(map);
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(stateTracker.lockedCellsMap.has("0-2")).toBe(true);
    expect(stateTracker.lockedCellsMap.get("0-2")).toBe("test lock");

    // Test direct deleteColumns call (this is what the UI should trigger)
    const deletedCount = liveTableDocInstance.deleteColumns([1]);
    expect(deletedCount).toBe(1);
    expect(stateTracker.callCount).toBe(2); // Initial + after delete

    // Verify that the locked cell has been moved to the correct new position
    // Original column 2 should now be at column 1 after deleting column 1
    expect(stateTracker.lockedCellsMap.has("0-1")).toBe(true);
    expect(stateTracker.lockedCellsMap.get("0-1")).toBe("test lock");
    expect(stateTracker.lockedCellsMap.has("0-2")).toBe(false);
  });

  it("should remove locked cells when their column is deleted", async () => {
    // Lock a cell in column 1 (index 1)
    const lockId = liveTableDocInstance.lockCellRange(0, 0, 1, 1, "test lock");
    expect(lockId).toBeTruthy();

    // Use a shared state object to track callback updates
    const stateTracker = {
      lockedCellsMap: new Map<string, string | undefined>(),
      callCount: 0,
    };

    const mockCallback = vi.fn((map) => {
      stateTracker.callCount++;
      stateTracker.lockedCellsMap = new Map(map);
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(stateTracker.lockedCellsMap.has("0-1")).toBe(true);
    expect(stateTracker.callCount).toBe(1);

    // Test direct deleteColumns call (delete column 1 - the locked column)
    const deletedCount = liveTableDocInstance.deleteColumns([1]);
    expect(deletedCount).toBe(1);
    expect(stateTracker.callCount).toBe(2); // Initial + after delete

    // Verify that the locked cell has been removed since its column was deleted
    // After deleting column 1, there should be no cell at the old position
    expect(stateTracker.lockedCellsMap.has("0-1")).toBe(false);
  });

  it("should handle multiple locked cells correctly when deleting columns", async () => {
    // Lock cells in multiple columns
    const lockId1 = liveTableDocInstance.lockCellRange(0, 0, 0, 0, "lock 1");
    const lockId2 = liveTableDocInstance.lockCellRange(1, 1, 2, 2, "lock 2");
    const lockId3 = liveTableDocInstance.lockCellRange(2, 2, 3, 3, "lock 3");
    expect(lockId1).toBeTruthy();
    expect(lockId2).toBeTruthy();
    expect(lockId3).toBeTruthy();

    // Use a shared state object to track callback updates
    const stateTracker = {
      lockedCellsMap: new Map<string, string | undefined>(),
      callCount: 0,
    };

    const mockCallback = vi.fn((map) => {
      stateTracker.callCount++;
      stateTracker.lockedCellsMap = new Map(map);
    });
    liveTableDocInstance.lockedCellsUpdateCallback = mockCallback;
    liveTableDocInstance.updateLockedCellsState();

    expect(stateTracker.lockedCellsMap.has("0-0")).toBe(true); // lock 1
    expect(stateTracker.lockedCellsMap.has("1-2")).toBe(true); // lock 2
    expect(stateTracker.lockedCellsMap.has("2-3")).toBe(true); // lock 3

    // Test direct deleteColumns call (delete column 1 - should shift columns 2,3 to positions 1,2)
    const deletedCount = liveTableDocInstance.deleteColumns([1]);
    expect(deletedCount).toBe(1);
    expect(stateTracker.callCount).toBe(2); // Initial + after delete

    // Verify that locked cells have been updated to correct positions
    expect(stateTracker.lockedCellsMap.has("0-0")).toBe(true); // lock 1 unchanged
    expect(stateTracker.lockedCellsMap.has("1-1")).toBe(true); // lock 2 shifted from column 2 to 1
    expect(stateTracker.lockedCellsMap.has("2-2")).toBe(true); // lock 3 shifted from column 3 to 2

    // Old positions should no longer exist
    expect(stateTracker.lockedCellsMap.has("1-2")).toBe(false);
    expect(stateTracker.lockedCellsMap.has("2-3")).toBe(false);
  });
});
