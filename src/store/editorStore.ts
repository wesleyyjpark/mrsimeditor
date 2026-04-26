import { create } from "zustand";
import type {
  CanvasView,
  IndicatorMode,
  MiscTab,
  ObjectConfig,
  PaletteCategory,
  RightSidebarTab,
  SelectedPanelTab,
} from "../types";

const DEFAULT_GRID_SIZE_METERS = 0.7;

export type ThemeMode = "light" | "dark" | "system";

function readStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem("mrsim.theme");
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

/**
 * Lightweight selected-object snapshot that React components consume.
 * The CanvasController owns the heavyweight imperative state (Fabric objects).
 */
export interface SelectedObjectSnapshot {
  id: string;
  config: ObjectConfig;
  entityName: string;
  altitude: number;
  positionX: number;
  positionY: number;
  rotation: number;
  attachedTo?: string | null;
  attachmentSide?: "left" | "right" | null;
  attachedLevel?: number | null;
  attachedCubeTo?: string | null;
  attachedCubeCorner?: string | null;
  stackCount?: number;
}

export interface PlacedSummary {
  id: string;
  configId: string;
  label: string;
  entityName: string;
  isGate: boolean;
  isCube: boolean;
}

export interface EditorState {
  /** Shared editor settings */
  gridSizeMeters: number;
  rotationSnap: number;
  snappingEnabled: boolean;
  zoom: number;

  /** Layout state */
  paletteTab: PaletteCategory;
  paletteCollapsed: boolean;
  sidebarsHidden: boolean;
  rightSidebarTab: RightSidebarTab;
  miscTab: MiscTab;
  canvasView: CanvasView;
  selectedPanelTab: SelectedPanelTab;

  /** Reference layout */
  showReferenceLayout: boolean;

  /** Global transform for export */
  globalOffsetX: number;
  globalOffsetY: number;
  globalRotation: number;

  /** Ruler */
  rulerEnabled: boolean;

  /** Selection snapshot */
  selected: SelectedObjectSnapshot | null;
  placedSummary: PlacedSummary[];

  /** Gate Indicator panel state */
  indicatorSelectedFace: string | null;
  indicatorMode: IndicatorMode;

  /** Gate order list */
  checkpointOrder: string[];

  /** Theme mode (light/dark/system) */
  theme: ThemeMode;
  /** Persisted layout sizes (left, center, right) */
  panelSizes: [number, number, number];

  /** Floating UI overlays */
  commandPaletteOpen: boolean;
  shortcutsOpen: boolean;

  /** Multi-selection summary (size = 0 when single/no selection) */
  multiSelectionCount: number;

  setTheme: (theme: ThemeMode) => void;
  setPanelSizes: (sizes: [number, number, number]) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  openShortcuts: () => void;
  closeShortcuts: () => void;
  toggleShortcuts: () => void;
  setMultiSelectionCount: (n: number) => void;

  setGridSizeMeters: (value: number) => void;
  setRotationSnap: (value: number) => void;
  setSnappingEnabled: (value: boolean) => void;
  setZoom: (value: number) => void;

  setPaletteTab: (tab: PaletteCategory) => void;
  togglePaletteCollapsed: () => void;
  toggleSidebarsHidden: () => void;
  setRightSidebarTab: (tab: RightSidebarTab) => void;
  setMiscTab: (tab: MiscTab) => void;
  setCanvasView: (view: CanvasView) => void;
  setSelectedPanelTab: (tab: SelectedPanelTab) => void;

  setShowReferenceLayout: (value: boolean) => void;
  toggleShowReferenceLayout: () => void;

  setGlobalOffsetX: (value: number) => void;
  setGlobalOffsetY: (value: number) => void;
  setGlobalRotation: (value: number) => void;

  setRulerEnabled: (value: boolean) => void;

  setSelected: (snapshot: SelectedObjectSnapshot | null) => void;
  setPlacedSummary: (placed: PlacedSummary[]) => void;

  setIndicatorSelectedFace: (face: string | null) => void;
  setIndicatorMode: (mode: IndicatorMode) => void;

  setCheckpointOrder: (order: string[]) => void;
  addCheckpoint: (value: string) => void;
  removeCheckpoint: (index: number) => void;
  moveCheckpoint: (index: number, delta: number) => void;
  reorderCheckpoint: (from: number, to: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  gridSizeMeters: DEFAULT_GRID_SIZE_METERS,
  rotationSnap: 5,
  snappingEnabled: true,
  zoom: 0.5,

  paletteTab: "favorites",
  paletteCollapsed: false,
  sidebarsHidden: false,
  rightSidebarTab: "none",
  miscTab: "snapping",
  canvasView: "editor",
  selectedPanelTab: "properties",

  showReferenceLayout: true,

  globalOffsetX: 0,
  globalOffsetY: 0,
  globalRotation: 0,

  rulerEnabled: false,

  selected: null,
  placedSummary: [],

  indicatorSelectedFace: null,
  indicatorMode: "Entry",

  checkpointOrder: [],

  theme: readStoredTheme(),
  commandPaletteOpen: false,
  shortcutsOpen: false,
  multiSelectionCount: 0,
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  openShortcuts: () => set({ shortcutsOpen: true }),
  closeShortcuts: () => set({ shortcutsOpen: false }),
  toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
  setMultiSelectionCount: (n) => set({ multiSelectionCount: n }),
  panelSizes: (() => {
    if (typeof window === "undefined") return [20, 60, 20] as [number, number, number];
    try {
      const raw = window.localStorage.getItem("mrsim.panelSizes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.every((n) => typeof n === "number")
        ) {
          return parsed as [number, number, number];
        }
      }
    } catch {
      /* ignore */
    }
    return [20, 60, 20] as [number, number, number];
  })(),

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mrsim.theme", theme);
    }
    set({ theme });
  },
  setPanelSizes: (sizes) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("mrsim.panelSizes", JSON.stringify(sizes));
    }
    set({ panelSizes: sizes });
  },

  setGridSizeMeters: (value) => set({ gridSizeMeters: value }),
  setRotationSnap: (value) => set({ rotationSnap: value }),
  setSnappingEnabled: (value) => set({ snappingEnabled: value }),
  setZoom: (value) => set({ zoom: value }),

  setPaletteTab: (tab) => set({ paletteTab: tab }),
  togglePaletteCollapsed: () => set((s) => ({ paletteCollapsed: !s.paletteCollapsed })),
  toggleSidebarsHidden: () => set((s) => ({ sidebarsHidden: !s.sidebarsHidden })),
  setRightSidebarTab: (tab) => set({ rightSidebarTab: tab }),
  setMiscTab: (tab) => set({ miscTab: tab }),
  setCanvasView: (view) => set({ canvasView: view }),
  setSelectedPanelTab: (tab) => set({ selectedPanelTab: tab }),

  setShowReferenceLayout: (value) => set({ showReferenceLayout: value }),
  toggleShowReferenceLayout: () => set((s) => ({ showReferenceLayout: !s.showReferenceLayout })),

  setGlobalOffsetX: (value) => set({ globalOffsetX: value }),
  setGlobalOffsetY: (value) => set({ globalOffsetY: value }),
  setGlobalRotation: (value) => set({ globalRotation: value }),

  setRulerEnabled: (value) => set({ rulerEnabled: value }),

  setSelected: (snapshot) => set({ selected: snapshot }),
  setPlacedSummary: (placed) => set({ placedSummary: placed }),

  setIndicatorSelectedFace: (face) => set({ indicatorSelectedFace: face }),
  setIndicatorMode: (mode) => set({ indicatorMode: mode }),

  setCheckpointOrder: (order) => set({ checkpointOrder: order }),
  addCheckpoint: (value) =>
    set((s) => {
      const trimmed = value.trim();
      if (!trimmed) {
        return s;
      }
      return { checkpointOrder: [...s.checkpointOrder, trimmed] };
    }),
  removeCheckpoint: (index) =>
    set((s) => ({
      checkpointOrder: s.checkpointOrder.filter((_, i) => i !== index),
    })),
  moveCheckpoint: (index, delta) =>
    set((s) => {
      const next = [...s.checkpointOrder];
      const target = index + delta;
      if (target < 0 || target >= next.length) {
        return s;
      }
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { checkpointOrder: next };
    }),
  reorderCheckpoint: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || to < 0 || from >= s.checkpointOrder.length) {
        return s;
      }
      const next = [...s.checkpointOrder];
      const [item] = next.splice(from, 1);
      next.splice(Math.min(to, next.length), 0, item);
      return { checkpointOrder: next };
    }),
}));
