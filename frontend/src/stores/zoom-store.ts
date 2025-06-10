import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ZoomState {
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  getZoomPercentage: () => number;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const DEFAULT_ZOOM = 1.0;
const ZOOM_STEP = 0.1;

const COMMON_ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

const clampZoom = (zoom: number): number => {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
};

const findNearestZoomLevel = (
  currentZoom: number,
  direction: "up" | "down"
): number => {
  if (direction === "up") {
    const nextLevel = COMMON_ZOOM_LEVELS.find((level) => level > currentZoom);
    return nextLevel || Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
  } else {
    const prevLevel = [...COMMON_ZOOM_LEVELS]
      .reverse()
      .find((level) => level < currentZoom);
    return prevLevel || Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
  }
};

export const MIN_ZOOM_LEVEL = MIN_ZOOM;
export const MAX_ZOOM_LEVEL = MAX_ZOOM;
export const DEFAULT_ZOOM_LEVEL = DEFAULT_ZOOM;

export const createZoomStore = (documentId: string) => {
  return create<ZoomState>()(
    persist(
      (set, get) => ({
        zoomLevel: DEFAULT_ZOOM,
        setZoomLevel: (level: number) => {
          const clampedLevel = clampZoom(level);
          set({ zoomLevel: clampedLevel });
        },
        zoomIn: () => {
          const currentZoom = get().zoomLevel;
          const newZoom = findNearestZoomLevel(currentZoom, "up");
          set({ zoomLevel: clampZoom(newZoom) });
        },
        zoomOut: () => {
          const currentZoom = get().zoomLevel;
          const newZoom = findNearestZoomLevel(currentZoom, "down");
          set({ zoomLevel: clampZoom(newZoom) });
        },
        resetZoom: () => {
          set({ zoomLevel: DEFAULT_ZOOM });
        },
        getZoomPercentage: () => {
          return Math.round(get().zoomLevel * 100);
        },
      }),
      {
        name: `table-zoom-settings-${documentId}`,
        version: 1,
      }
    )
  );
};

// Create a store manager to cache document-specific stores
const storeCache = new Map<string, ReturnType<typeof createZoomStore>>();

export const useZoomStore = (documentId: string) => {
  if (!storeCache.has(documentId)) {
    storeCache.set(documentId, createZoomStore(documentId));
  }
  return storeCache.get(documentId)!;
};
