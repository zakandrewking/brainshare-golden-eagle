import { useSyncExternalStore } from "react";

let current = "";
const subscribers = new Set<() => void>();

export function useEditingHeaderValuePush(newValue: string) {
  current = newValue; // 1️⃣ change the value
  subscribers.forEach((cb) => cb()); // 2️⃣ tell React “something changed”
}

/**
 * Fake hook that components will actually run while the mock is active.
 * useSyncExternalStore lets React know it should re-render when we call
 * pushUseIsSelecting above.
 */
export function useEditingHeaderValueMock() {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => subscribers.delete(cb);
    },
    () => current
  );
}
