import {
  describe,
  expect,
  it,
  vi,
} from "vitest";
import * as Y from "yjs";

import { act, renderHook } from "@testing-library/react";

import { LiveTableDoc } from "@/components/live-table/LiveTableDoc";
import {
  useIsCellLocked,
  useLockNoteForCell,
  useLockSelectedRange,
  useUnlockAll,
} from "@/stores/dataStore";
import { CellPosition } from "@/stores/selectionStore";

import {
  TestDataStoreWrapper,
} from "../components/live-table/live-table-store-test-utils";

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

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const setupMockLiveTableDoc = () => {
  const yDoc = new Y.Doc();
  const liveTableDoc = new LiveTableDoc(yDoc);

  vi.spyOn(liveTableDoc, "lockCellRange").mockImplementation(
    (_startRow, _endRow, _startCol, _endCol, note?: string): string | null => {
      const lockId = `lock-${Math.random()}`;
      const lockedCells = new Map<string, string | undefined>();
      lockedCells.set("0-0", note);
      act(() => {
        liveTableDoc.lockedCellsUpdateCallback?.(lockedCells);
      });
      return lockId;
    }
  );

  vi.spyOn(liveTableDoc, "unlockAll").mockImplementation(() => {
    act(() => {
      liveTableDoc.lockedCellsUpdateCallback?.(new Map());
    });
  });

  yDoc.transact(() => {
    const colId = "col1";
    liveTableDoc.yColumnOrder.push([colId]);
    liveTableDoc.yColumnDefinitions.set(colId, {
      id: colId,
      name: "Header 1",
      width: 150,
    });
    const rowId = "row1";
    liveTableDoc.yRowOrder.push([rowId]);
    const rowMap = new Y.Map<string>();
    rowMap.set(colId, "value");
    liveTableDoc.yRowData.set(rowId, rowMap);
  });

  return liveTableDoc;
};

describe("dataStore lock features", () => {
  it("should lock a selected range with a note and allow retrieving the note", () => {
    const liveTableDoc = setupMockLiveTableDoc();
    const selectedCells: CellPosition[] = [{ rowIndex: 0, colIndex: 0 }];
    const lockNote = "This is a test note.";

    const { result, rerender } = renderHook(
      () => ({
        lock: useLockSelectedRange(),
        note: useLockNoteForCell(0, 0),
        isLocked: useIsCellLocked(0, 0),
      }),
      {
        wrapper: ({ children }) => (
          <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
            {children}
          </TestDataStoreWrapper>
        ),
      }
    );

    act(() => {
      result.current.lock(selectedCells, lockNote);
    });

    rerender();

    expect(liveTableDoc.lockCellRange).toHaveBeenCalledWith(
      0,
      0,
      0,
      0,
      lockNote
    );

    expect(result.current.note).toBe(lockNote);
    expect(result.current.isLocked).toBe(true);
  });

  it("should lock a selected range without a note", () => {
    const liveTableDoc = setupMockLiveTableDoc();
    const selectedCells: CellPosition[] = [{ rowIndex: 0, colIndex: 0 }];

    const { result } = renderHook(() => useLockSelectedRange(), {
      wrapper: ({ children }) => (
        <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
          {children}
        </TestDataStoreWrapper>
      ),
    });

    act(() => {
      result.current(selectedCells);
    });

    expect(liveTableDoc.lockCellRange).toHaveBeenCalledWith(
      0,
      0,
      0,
      0,
      undefined
    );
  });

  it("should clear all locks", () => {
    const liveTableDoc = setupMockLiveTableDoc();

    const { result, rerender } = renderHook(
      () => ({
        lock: useLockSelectedRange(),
        unlockAll: useUnlockAll(),
        isLocked: useIsCellLocked(0, 0),
      }),
      {
        wrapper: ({ children }) => (
          <TestDataStoreWrapper liveTableDoc={liveTableDoc}>
            {children}
          </TestDataStoreWrapper>
        ),
      }
    );

    act(() => {
      result.current.lock([{ rowIndex: 0, colIndex: 0 }], "note");
    });
    rerender();

    expect(result.current.isLocked).toBe(true);

    act(() => {
      result.current.unlockAll();
    });
    rerender();

    expect(liveTableDoc.unlockAll).toHaveBeenCalled();
    expect(result.current.isLocked).toBe(false);
  });
});
