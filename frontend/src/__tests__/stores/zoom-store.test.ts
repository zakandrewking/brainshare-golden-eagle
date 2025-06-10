import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { act } from "@testing-library/react";

import {
  DEFAULT_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  MIN_ZOOM_LEVEL,
  useZoomStore,
} from "@/stores/zoom-store";

const TEST_DOC_ID = "test-document-id";

describe("Zoom Store", () => {
  beforeEach(() => {
    const store = useZoomStore(TEST_DOC_ID);
    act(() => {
      store.getState().setZoomLevel(DEFAULT_ZOOM_LEVEL);
    });
  });

  it("should initialize with default zoom level", () => {
    const store = useZoomStore(TEST_DOC_ID);
    const zoomLevel = store.getState().zoomLevel;
    expect(zoomLevel).toBe(DEFAULT_ZOOM_LEVEL);
  });

  it("should zoom in correctly", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().zoomIn();
    });

    expect(store.getState().zoomLevel).toBe(1.25);
  });

  it("should zoom out correctly", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().zoomOut();
    });

    expect(store.getState().zoomLevel).toBe(0.75);
  });

  it("should clamp zoom level to minimum", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(0.1);
    });

    expect(store.getState().zoomLevel).toBe(MIN_ZOOM_LEVEL);
  });

  it("should clamp zoom level to maximum", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(5.0);
    });

    expect(store.getState().zoomLevel).toBe(MAX_ZOOM_LEVEL);
  });

  it("should not zoom below minimum when zooming out", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(MIN_ZOOM_LEVEL);
      store.getState().zoomOut();
    });

    expect(store.getState().zoomLevel).toBe(MIN_ZOOM_LEVEL);
  });

  it("should not zoom above maximum when zooming in", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(MAX_ZOOM_LEVEL);
      store.getState().zoomIn();
    });

    expect(store.getState().zoomLevel).toBe(MAX_ZOOM_LEVEL);
  });

  it("should return correct zoom percentage", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(1.5);
    });

    expect(store.getState().getZoomPercentage()).toBe(150);
  });

  it("should reset zoom to default level", () => {
    const store = useZoomStore(TEST_DOC_ID);

    act(() => {
      store.getState().setZoomLevel(2.0);
      store.getState().resetZoom();
    });

    expect(store.getState().zoomLevel).toBe(DEFAULT_ZOOM_LEVEL);
  });
});
