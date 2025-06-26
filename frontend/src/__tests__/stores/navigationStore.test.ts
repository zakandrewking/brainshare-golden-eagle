import { act, renderHook } from "@testing-library/react";

import {
  useCloseDrawer,
  useHandleMenuButton,
  useIsDrawerOpen,
  useNavigationStore,
  useOpenDrawer,
  useToggleDrawer,
} from "@/stores/navigationStore";

describe("navigationStore", () => {
  beforeEach(() => {
    useNavigationStore.setState({ isDrawerOpen: false });
  });

  it("should initialize with drawer closed", () => {
    const { result } = renderHook(() => useIsDrawerOpen());
    expect(result.current).toBe(false);
  });

  it("should open drawer when openDrawer is called", () => {
    const { result: drawerOpen } = renderHook(() => useIsDrawerOpen());
    const { result: openDrawer } = renderHook(() => useOpenDrawer());

    act(() => {
      openDrawer.current();
    });

    expect(drawerOpen.current).toBe(true);
  });

  it("should close drawer when closeDrawer is called", () => {
    const { result: drawerOpen } = renderHook(() => useIsDrawerOpen());
    const { result: openDrawer } = renderHook(() => useOpenDrawer());
    const { result: closeDrawer } = renderHook(() => useCloseDrawer());

    act(() => {
      openDrawer.current();
    });
    expect(drawerOpen.current).toBe(true);

    act(() => {
      closeDrawer.current();
    });
    expect(drawerOpen.current).toBe(false);
  });

  it("should toggle drawer state when toggleDrawer is called", () => {
    const { result: drawerOpen } = renderHook(() => useIsDrawerOpen());
    const { result: toggleDrawer } = renderHook(() => useToggleDrawer());

    expect(drawerOpen.current).toBe(false);

    act(() => {
      toggleDrawer.current();
    });
    expect(drawerOpen.current).toBe(true);

    act(() => {
      toggleDrawer.current();
    });
    expect(drawerOpen.current).toBe(false);
  });

  it("should provide useHandleMenuButton as an alias for toggleDrawer", () => {
    const { result: drawerOpen } = renderHook(() => useIsDrawerOpen());
    const { result: handleMenuButton } = renderHook(() =>
      useHandleMenuButton()
    );

    expect(drawerOpen.current).toBe(false);

    act(() => {
      handleMenuButton.current();
    });
    expect(drawerOpen.current).toBe(true);

    act(() => {
      handleMenuButton.current();
    });
    expect(drawerOpen.current).toBe(false);
  });
});
