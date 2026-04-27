import { useEffect, useRef, useState } from "react";
import { CanvasController } from "./canvas/CanvasController";
import { CanvasControllerContext } from "./canvas/controllerContext";
import { useEditorStore } from "./store/editorStore";
import type { PlacedObjectMeta } from "./types";
import type { PlacedSummary, SelectedObjectSnapshot } from "./store/editorStore";
import { getGateStackCount, isCubeConfig, isGateConfig } from "./data/objects";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/hooks/useTheme";
import { AppShell } from "@/components/AppShell";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useHistorySync } from "@/hooks/useHistorySync";
import { useHistoryStore } from "@/store/historyStore";

function metaToSnapshot(meta: PlacedObjectMeta | null): SelectedObjectSnapshot | null {
  if (!meta) return null;
  const angle = meta.angle !== undefined ? meta.angle : meta.fabricObject.angle ?? 0;
  const pos = meta.position ?? { x: 0, y: 0 };
  return {
    id: meta.id,
    config: meta.config,
    entityName: meta.entityName,
    altitude: meta.altitude,
    positionX: pos.x,
    positionY: pos.y,
    rotation: angle,
    attachedTo: meta.attachedTo ?? null,
    attachmentSide: meta.attachmentSide ?? null,
    attachedLevel: meta.attachedLevel ?? null,
    attachedCubeTo: meta.attachedCubeTo ?? null,
    attachedCubeCorner: meta.attachedCubeCorner ?? null,
    stackCount: meta.stackCount,
    sensingSide: meta.sensingSide ?? null,
    sensingFacing: meta.sensingFacing ?? null,
  };
}

export function App() {
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const [controller, setController] = useState<CanvasController | null>(null);

  useTheme();

  useEffect(() => {
    if (!canvasElRef.current) return;

    const initialState = useEditorStore.getState();
    const ctrl = new CanvasController(
      canvasElRef.current,
      {
        gridSizeMeters: initialState.gridSizeMeters,
        rotationSnap: initialState.rotationSnap,
        snappingEnabled: initialState.snappingEnabled,
        showReferenceLayout: initialState.showReferenceLayout,
        globalOffsetX: initialState.globalOffsetX,
        globalOffsetY: initialState.globalOffsetY,
        globalRotation: initialState.globalRotation,
        rulerEnabled: initialState.rulerEnabled,
      },
      {
        onSelectionChanged: (meta) => {
          useEditorStore.getState().setSelected(metaToSnapshot(meta));
        },
        onSceneChanged: () => {
          const placed = ctrl.getPlacedObjects().map<PlacedSummary>((entry) => ({
            id: entry.id,
            configId: entry.config.id,
            label: entry.config.label,
            entityName: entry.entityName,
            isGate: isGateConfig(entry.config),
            isCube: isCubeConfig(entry.config),
            stackCount: isGateConfig(entry.config) ? getGateStackCount(entry) : undefined,
          }));
          useEditorStore.getState().setPlacedSummary(placed);
          if (!useHistoryStore.getState().applying) {
            const snapshot = ctrl.getSnapshot();
            snapshot.checkpointOrder = useEditorStore.getState().checkpointOrder;
            useHistoryStore.getState().push(snapshot);
          }
        },
        onZoomChanged: (zoom) => useEditorStore.getState().setZoom(zoom),
        onMultiSelectionChanged: (count) => useEditorStore.getState().setMultiSelectionCount(count),
      }
    );

    ctrl.init(layoutRef.current).catch((err) => console.error("Controller init failed", err));
    if (wrapperRef.current) ctrl.observeWrapper(wrapperRef.current);
    setController(ctrl);

    return () => {
      ctrl.dispose();
    };
  }, []);

  useEffect(() => {
    if (!controller) return;
    return useEditorStore.subscribe((state, prev) => {
      const changed: Partial<{
        gridSizeMeters: number;
        rotationSnap: number;
        snappingEnabled: boolean;
        showReferenceLayout: boolean;
        globalOffsetX: number;
        globalOffsetY: number;
        globalRotation: number;
        rulerEnabled: boolean;
      }> = {};
      if (state.gridSizeMeters !== prev.gridSizeMeters) changed.gridSizeMeters = state.gridSizeMeters;
      if (state.rotationSnap !== prev.rotationSnap) changed.rotationSnap = state.rotationSnap;
      if (state.snappingEnabled !== prev.snappingEnabled) changed.snappingEnabled = state.snappingEnabled;
      if (state.showReferenceLayout !== prev.showReferenceLayout)
        changed.showReferenceLayout = state.showReferenceLayout;
      if (state.globalOffsetX !== prev.globalOffsetX) changed.globalOffsetX = state.globalOffsetX;
      if (state.globalOffsetY !== prev.globalOffsetY) changed.globalOffsetY = state.globalOffsetY;
      if (state.globalRotation !== prev.globalRotation) changed.globalRotation = state.globalRotation;
      if (state.rulerEnabled !== prev.rulerEnabled) changed.rulerEnabled = state.rulerEnabled;
      if (Object.keys(changed).length > 0) controller.updateSettings(changed);
    });
  }, [controller]);

  return (
    <CanvasControllerContext.Provider value={controller}>
      <TooltipProvider delayDuration={250}>
        <KeyboardLayer />
        <AppShell
          canvasRef={canvasElRef}
          wrapperRef={wrapperRef}
          layoutRef={layoutRef}
        />
        <CommandPalette />
        <ShortcutsDialog />
        <Toaster position="bottom-right" richColors closeButton />
      </TooltipProvider>
    </CanvasControllerContext.Provider>
  );
}

function KeyboardLayer() {
  useKeyboardShortcuts();
  useHistorySync();
  return null;
}
