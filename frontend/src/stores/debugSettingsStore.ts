import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DebugSettingsState {
  isAiFillSelectionDebugEnabled: boolean;
  setAiFillSelectionDebugEnabled: (enabled: boolean) => void;
}

export const useDebugSettingsStore = create<DebugSettingsState>()(
  persist(
    (set) => ({
      isAiFillSelectionDebugEnabled: false,
      setAiFillSelectionDebugEnabled: (enabled: boolean) =>
        set({ isAiFillSelectionDebugEnabled: enabled }),
    }),
    {
      name: "debug-settings",
    }
  )
);

export const useIsAiFillSelectionDebugEnabled = () =>
  useDebugSettingsStore((state) => state.isAiFillSelectionDebugEnabled);

export const useSetAiFillSelectionDebugEnabled = () =>
  useDebugSettingsStore((state) => state.setAiFillSelectionDebugEnabled);
