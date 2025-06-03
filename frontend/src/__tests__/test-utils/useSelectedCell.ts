import { useSyncExternalStore } from "react";

import { CellPosition } from "@/stores/selectionStore";

let current: CellPosition | null = null;
const subscribers = new Set<() => void>();

export function useSelectedCellPush(newValue: CellPosition | null) {
  current = newValue; // 1️⃣ change the value
  subscribers.forEach((cb) => cb()); // 2️⃣ tell React “something changed”
}

/**
 * Fake hook that components will actually run while the mock is active.
 * useSyncExternalStore lets React know it should re-render when we call
 * pushUseIsSelecting above.
 */
export function useSelectedCellMock() {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    () => current
  );
}
