import { create } from "zustand";
import type { CheckpointOrderEntry } from "../lib/checkpointOrder";
import { useEditorStore } from "./editorStore";

/**
 * Raw shape carried through the history stack. Mirrors
 * {@link import("@/canvas/CanvasController").SceneSnapshotShape} but kept
 * in this module to avoid a circular dependency (controller imports the
 * store, store does not import the controller).
 */
export interface SceneSnapshot {
  /** Serialized canvas JSON (fabric.toJSON with `data` extra prop) */
  canvas: unknown;
  /** Editor counters/state we need to roundtrip */
  entityCounters: Record<string, number>;
  /** Gate-order snapshot at the time of the action */
  checkpointOrder: CheckpointOrderEntry[];
  /** Per-placed-object metadata (entityName, attachments, ...). */
  placed: Array<{
    id: string;
    configId: string;
    entityName: string;
    altitude: number;
    stackCount?: number;
    attachedTo?: string | null;
    attachmentSide?: "left" | "right" | null;
    attachedLevel?: number | null;
    attachedCubeTo?: string | null;
    attachedCubeCorner?: string | null;
    sensingSide?: "left" | "right" | null;
  }>;
}

const MAX_HISTORY = 50;

interface HistoryState {
  past: SceneSnapshot[];
  future: SceneSnapshot[];
  /**
   * When true, scene-mutating callbacks should NOT push a new snapshot
   * (used while we're applying undo/redo).
   */
  applying: boolean;

  push: (snapshot: SceneSnapshot) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

/**
 * The canvas controller is registered here at app startup so the store can call
 * back into it for snapshotting and restoring. We keep it module-scoped so the
 * undo/redo hotkeys work without prop drilling.
 */
let controllerHook: {
  getSnapshot: () => SceneSnapshot;
  loadSnapshot: (snapshot: SceneSnapshot) => Promise<void>;
} | null = null;

export function registerHistoryController(hook: typeof controllerHook): void {
  controllerHook = hook;
}

/**
 * Snapshots the controller and tags it with the current Zustand
 * `checkpointOrder` so undo/redo can restore that too.
 */
function captureCurrent(getSnapshot: () => SceneSnapshot): SceneSnapshot {
  const snap = getSnapshot();
  snap.checkpointOrder = useEditorStore.getState().checkpointOrder;
  return snap;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  applying: false,

  push: (snapshot) => {
    if (get().applying) return;
    const past = [...get().past, snapshot];
    if (past.length > MAX_HISTORY) past.shift();
    set({ past, future: [] });
  },

  undo: () => {
    const { past, future, applying } = get();
    if (applying || past.length === 0 || !controllerHook) return;
    const current = captureCurrent(controllerHook.getSnapshot);
    const previous = past[past.length - 1];
    set({
      applying: true,
      past: past.slice(0, -1),
      future: [current, ...future],
    });
    void controllerHook
      .loadSnapshot(previous)
      .then(() => useEditorStore.getState().setCheckpointOrder(previous.checkpointOrder ?? []))
      .finally(() => set({ applying: false }));
  },

  redo: () => {
    const { past, future, applying } = get();
    if (applying || future.length === 0 || !controllerHook) return;
    const current = captureCurrent(controllerHook.getSnapshot);
    const [next, ...rest] = future;
    set({
      applying: true,
      past: [...past, current],
      future: rest,
    });
    void controllerHook
      .loadSnapshot(next)
      .then(() => useEditorStore.getState().setCheckpointOrder(next.checkpointOrder ?? []))
      .finally(() => set({ applying: false }));
  },

  reset: () => set({ past: [], future: [], applying: false }),
}));

export function isApplyingHistory(): boolean {
  return useHistoryStore.getState().applying;
}
