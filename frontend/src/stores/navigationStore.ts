import { create } from "zustand";

interface NavigationState {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  isDrawerOpen: false,
  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),
  toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
}));

export const useIsDrawerOpen = () =>
  useNavigationStore((state) => state.isDrawerOpen);

export const useOpenDrawer = () =>
  useNavigationStore((state) => state.openDrawer);

export const useCloseDrawer = () =>
  useNavigationStore((state) => state.closeDrawer);

export const useToggleDrawer = () =>
  useNavigationStore((state) => state.toggleDrawer);

export const useHandleMenuButton = () =>
  useNavigationStore((state) => state.toggleDrawer);
