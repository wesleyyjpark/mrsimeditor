import { fabric } from "fabric";
import {
  CANOPY_EXPORT_BLOCK,
  CENTERED_GATE_MACROS,
  OBJECT_CATALOG,
  OBJECT_LOOKUP,
  REFERENCE_LAYOUT,
  champs25ColorFromMacroName,
  macroNameForPlacedExport,
  getGateStackCount,
  getGateStackSpacing,
  getPassageTarget,
  isCubeConfig,
  isGateConfig,
  isHurdleConfig,
  isStackableGateConfig,
  normalizeCatalogTypeId,
  resolveMainIncludeFile,
} from "../data/objects";
import type { Champs25GateColor } from "../data/objects";
import { ICON_BASELINE_OFFSETS } from "../data/icons";
import type { ObjectConfig, PlacedObjectMeta, Position } from "../types";
import {
  FLAG_SENSOR_Z_METERS,
  isFlagPassageCheckpoint,
  isPolePassageCheckpoint,
  flagPassageExportName,
  POLE_SENSOR_Z_METERS,
  polePassageExportName,
  resolveCheckpointExportNames,
  type CheckpointOrderEntry,
  type FlagPassageCheckpoint,
  type PolePassageCheckpoint,
} from "../lib/checkpointOrder";
import {
  buildEditorMeta,
  createUniqueId,
  downloadText,
  hexToRgba,
  invertGlobalTransform,
  normalizeAngle,
  normalizeEditorAngle,
  parseEditorMeta,
} from "../utils";

const PIXELS_PER_METER = 40;
const GRID_BOTTOM_MARGIN = 160;
const DEFAULT_GRID_SIZE_METERS = 0.7;
const MAJOR_GRID_METERS = 2.1;
const DEFAULT_FORWARD_OFFSET_METERS = 16;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const PAN_CURSOR = "grab";
const PAN_ACTIVE_CURSOR = "grabbing";

export interface ControllerSettings {
  gridSizeMeters: number;
  rotationSnap: number;
  snappingEnabled: boolean;
  showReferenceLayout: boolean;
  globalOffsetX: number;
  globalOffsetY: number;
  globalRotation: number;
  rulerEnabled: boolean;
}

export interface CanvasControllerCallbacks {
  onSelectionChanged: (meta: PlacedObjectMeta | null) => void;
  onSceneChanged: () => void;
  onZoomChanged: (zoom: number) => void;
  onMultiSelectionChanged?: (count: number) => void;
}

interface RulerState {
  enabled: boolean;
  startPoint: fabric.Point | null;
  line: fabric.Line | null;
  label: fabric.Textbox | null;
  isDrawing: boolean;
}

interface PanState {
  keyActive: boolean;
  isDragging: boolean;
  lastClientX: number;
  lastClientY: number;
  restoreSelection: boolean;
}

/**
 * Per-placed-object metadata serialized into history snapshots, alongside the
 * raw fabric `toJSON` output. Mirrors the runtime `PlacedObjectMeta` minus
 * the live `fabricObject` reference and the resolved `config` (looked up by id).
 */
export interface SerializedPlaced {
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
  sensingFacing?: "front" | "back" | null;
  champsGateColor?: Champs25GateColor | null;
}

export interface SceneSnapshotShape {
  canvas: unknown;
  entityCounters: Record<string, number>;
  checkpointOrder: CheckpointOrderEntry[];
  placed: SerializedPlaced[];
}

export class CanvasController {
  private canvas: fabric.Canvas;
  private callbacks: CanvasControllerCallbacks;
  private settings: ControllerSettings;
  private layoutEl: HTMLElement | null = null;

  private canvasWidth: number;
  private canvasHeight: number;

  private placedObjects: PlacedObjectMeta[] = [];
  private metaByObjectId: Map<fabric.Object, PlacedObjectMeta> = new Map();
  private referenceObjects: { layout: (typeof REFERENCE_LAYOUT)[number]; fabricObject: fabric.Object }[] = [];
  private entityCounters: Record<string, number> = {};
  private activeMeta: PlacedObjectMeta | null = null;

  private snapDisabledByShift = false;
  private defaultCursor: string;

  private panState: PanState = {
    keyActive: false,
    isDragging: false,
    lastClientX: 0,
    lastClientY: 0,
    restoreSelection: true,
  };

  private ruler: RulerState = {
    enabled: false,
    startPoint: null,
    line: null,
    label: null,
    isDrawing: false,
  };

  private resizeObserver: ResizeObserver | null = null;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundMouseUp: () => void;
  private boundBlur: () => void;
  private boundResize: () => void;

  constructor(
    canvasEl: HTMLCanvasElement,
    initialSettings: ControllerSettings,
    callbacks: CanvasControllerCallbacks
  ) {
    this.canvas = new fabric.Canvas(canvasEl, {
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
    });
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;
    this.canvasWidth = this.canvas.getWidth();
    this.canvasHeight = this.canvas.getHeight();
    this.defaultCursor = this.canvas.defaultCursor || "default";
    this.ruler.enabled = initialSettings.rulerEnabled;

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundKeyUp = this.handleKeyUp.bind(this);
    this.boundMouseUp = this.endPanInteraction.bind(this);
    this.boundBlur = () => {
      this.panState.keyActive = false;
      this.endPanInteraction();
    };
    this.boundResize = () => {
      this.resizeCanvasToWrapper();
      this.updateGridBackground();
      this.canvas.requestRenderAll();
    };
  }

  /** Boot the canvas: register events, draw grid/origin, create reference objects. */
  async init(layoutEl: HTMLElement | null): Promise<void> {
    this.layoutEl = layoutEl;
    this.resizeCanvasToWrapper();
    this.registerCanvasEvents();
    this.applyZoom(0.5);
    this.updateGridBackground();
    this.drawOriginGuides();
    this.attachGlobalListeners();
    await this.createReferenceObjects();
    this.updateReferenceVisibility();
    this.canvas.requestRenderAll();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.boundKeyDown);
    window.removeEventListener("keyup", this.boundKeyUp);
    window.removeEventListener("mouseup", this.boundMouseUp);
    window.removeEventListener("blur", this.boundBlur);
    window.removeEventListener("resize", this.boundResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.canvas.dispose();
  }

  /* Snapshot / restore for undo–redo (history store)*/

  /**
   * Returns a JSON-serializable snapshot of the current scene + counters that
   * can be passed back to {@link loadSnapshot} to restore exactly.
   *
   * We rely on Fabric's `toJSON(["data"])` for transforms/visuals and store
   * the React-side metadata (`entityName`, attachments, indicator state) in a
   * sibling array keyed by the object's id so we can rehydrate fully.
   */
  getSnapshot(): SceneSnapshotShape {
    const placedIds = new Set(this.placedObjects.map((p) => p.id));
    this.placedObjects.forEach((m) => this.updateObjectMetadata(m.fabricObject));
    const exportObjects = this.canvas
      .getObjects()
      .filter((obj) => {
        const data = (obj as fabric.Object & { data?: { id?: string } }).data;
        return data?.id && placedIds.has(data.id);
      });
    const json = (
      this.canvas.toJSON as unknown as (props: string[], objs?: fabric.Object[]) => object
    ).call(this.canvas, ["data"], exportObjects);
    const placed: SerializedPlaced[] = this.placedObjects.map((m) => ({
      id: m.id,
      configId: m.config.id,
      entityName: m.entityName,
      altitude: m.altitude,
      stackCount: m.stackCount,
      attachedTo: m.attachedTo ?? null,
      attachmentSide: m.attachmentSide ?? null,
      attachedLevel: m.attachedLevel ?? null,
      attachedCubeTo: m.attachedCubeTo ?? null,
      attachedCubeCorner: m.attachedCubeCorner ?? null,
      sensingSide: m.sensingSide ?? null,
      sensingFacing: m.sensingFacing ?? null,
      champsGateColor: m.champsGateColor,
    }));
    return {
      canvas: json,
      entityCounters: { ...this.entityCounters },
      checkpointOrder: [],
      placed,
    };
  }

  /**
   * Restores the scene from a snapshot produced by {@link getSnapshot}. Clears
   * the existing canvas first, then rehydrates every `placedObject` from the
   * sibling metadata array.
   */
  async loadSnapshot(snapshot: SceneSnapshotShape): Promise<void> {
    this.clearScene();
    this.entityCounters = { ...snapshot.entityCounters };
    const placedById = new Map<string, SerializedPlaced>();
    (snapshot.placed ?? []).forEach((p) => placedById.set(p.id, p));

    return new Promise((resolve) => {
      this.canvas.loadFromJSON(
        snapshot.canvas as object,
        async () => {
          const objects = this.canvas.getObjects();
          this.placedObjects = [];
          this.metaByObjectId.clear();
          this.referenceObjects = [];
          for (const obj of objects) {
            const data = (obj as fabric.Object & {
              data?: { id?: string; typeId?: string };
            }).data;
            if (!data?.id || !data.typeId) continue;
            const normalizedId = normalizeCatalogTypeId(data.typeId);
            const config = OBJECT_LOOKUP[normalizedId.typeId];
            if (!config) continue;
            if (normalizedId.typeId !== data.typeId) {
              (obj as fabric.Object & { data?: { id?: string; typeId?: string } }).data = {
                ...data,
                typeId: normalizedId.typeId,
              };
            }
            const stored = placedById.get(data.id);
            const defaultSensing =
              config.sensingLineMeters && config.sensingLineMeters > 0
                ? (normalizedId.legacySensingSide ?? this.initialSensingSideForConfig(config))
                : null;
            const meta: PlacedObjectMeta = {
              id: data.id,
              config,
              fabricObject: obj,
              entityName: stored?.entityName ?? data.id,
              altitude: stored?.altitude ?? 0,
              stackCount: stored?.stackCount,
              attachedTo: stored?.attachedTo ?? null,
              attachmentSide: stored?.attachmentSide ?? null,
              attachedLevel: stored?.attachedLevel ?? null,
              attachedCubeTo: stored?.attachedCubeTo ?? null,
              attachedCubeCorner: stored?.attachedCubeCorner ?? null,
              sensingSide:
                stored?.sensingSide === "left" || stored?.sensingSide === "right"
                  ? stored.sensingSide
                  : defaultSensing,
              sensingFacing:
                getPassageTarget(config) === "flag" &&
                config.sensingLineMeters &&
                config.sensingLineMeters > 0
                  ? stored?.sensingFacing === "back"
                    ? "back"
                    : "front"
                  : null,
              champsGateColor:
                config.id === "champs-25-gate"
                  ? (stored?.champsGateColor ??
                    normalizedId.legacyChampsGateColor ??
                    "red")
                  : undefined,
            };
            this.applyVisualDefaults(obj, config);
            this.placedObjects.push(meta);
            this.metaByObjectId.set(obj, meta);
            if (config.sensingLineMeters && config.sensingLineMeters > 0) {
              this.applySensingSideVisibility(meta);
            }
            this.updateObjectMetadata(obj);
          }
          this.placedObjects.forEach((m) => {
            if (m.config.id !== "padded-pole") return;
            if (m.attachedTo || m.attachedCubeTo) {
              this.updateAttachedPolePosition(m);
            } else {
              this.applyAttachedPoleMoveLock(m);
            }
          });
          // loadFromJSON wipes the canvas; rebuild the persistent reference
          // layout objects (they are excluded from the export so they aren't
          // part of the snapshot).
          await this.createReferenceObjects();
          this.updateReferenceVisibility();
          this.updateGridBackground();
          this.canvas.renderAll();
          this.callbacks.onSceneChanged();
          resolve();
        },
        (_o: object, fabricObj: fabric.Object) => {
          fabricObj.set({ selectable: true, hasControls: true });
        }
      );
    });
  }

  /** Update controller settings (called when Zustand store changes). */
  updateSettings(settings: Partial<ControllerSettings>): void {
    const prev = this.settings;
    this.settings = { ...prev, ...settings };
    if (settings.gridSizeMeters !== undefined && settings.gridSizeMeters !== prev.gridSizeMeters) {
      this.updateGridBackground();
    }
    if (
      settings.showReferenceLayout !== undefined &&
      settings.showReferenceLayout !== prev.showReferenceLayout
    ) {
      this.updateReferenceVisibility();
    }
    if (settings.rulerEnabled !== undefined && settings.rulerEnabled !== prev.rulerEnabled) {
      this.ruler.enabled = settings.rulerEnabled;
      if (!settings.rulerEnabled) {
        this.resetRulerMeasurement();
        this.clearRulerGraphics();
      }
    }
  }

  observeWrapper(wrapper: HTMLElement): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    this.resizeObserver = new ResizeObserver(() => {
      this.resizeCanvasToWrapper();
      this.updateGridBackground();
      this.canvas.requestRenderAll();
    });
    this.resizeObserver.observe(wrapper);
  }

  private attachGlobalListeners(): void {
    window.addEventListener("keydown", this.boundKeyDown, { passive: false });
    window.addEventListener("keyup", this.boundKeyUp);
    window.addEventListener("mouseup", this.boundMouseUp);
    window.addEventListener("blur", this.boundBlur);
    window.addEventListener("resize", this.boundResize);
  }

  /* Geometry / coordinates */

  private getGridOrigin(): { x: number; y: number } {
    return {
      x: this.canvasWidth / 2,
      y: this.canvasHeight - GRID_BOTTOM_MARGIN,
    };
  }

  private updateGridBackground(): void {
    const gridSize = this.settings.gridSizeMeters || DEFAULT_GRID_SIZE_METERS;
    const baseSpacingPx = Math.max(4, gridSize * PIXELS_PER_METER);
    const majorMultiplier = Math.max(1, Math.round(MAJOR_GRID_METERS / gridSize));
    const majorSizePx = baseSpacingPx * majorMultiplier;
    const patternCanvas = fabric.util.createCanvasElement();
    patternCanvas.width = majorSizePx;
    patternCanvas.height = majorSizePx;
    const ctx = patternCanvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#f9fbfd";
    ctx.fillRect(0, 0, majorSizePx, majorSizePx);

    // Minor lines at every base grid step (matches snap step so users see what they snap to).
    if (baseSpacingPx > 6 && majorMultiplier > 1) {
      ctx.strokeStyle = "rgba(33, 33, 33, 0.08)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < majorMultiplier; i++) {
        const x = Math.round(i * baseSpacingPx) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, majorSizePx);
        ctx.moveTo(0, x);
        ctx.lineTo(majorSizePx, x);
      }
      ctx.stroke();
    }

    // Major lines around the tile edges.
    ctx.strokeStyle = "rgba(33, 33, 33, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0.5, 0);
    ctx.lineTo(0.5, majorSizePx);
    ctx.moveTo(majorSizePx - 0.5, 0);
    ctx.lineTo(majorSizePx - 0.5, majorSizePx);
    ctx.moveTo(0, 0.5);
    ctx.lineTo(majorSizePx, 0.5);
    ctx.moveTo(0, majorSizePx - 0.5);
    ctx.lineTo(majorSizePx, majorSizePx - 0.5);
    ctx.stroke();

    const origin = this.getGridOrigin();
    const offsetX = -((origin.x % majorSizePx) || 0);
    const offsetY = -((origin.y % majorSizePx) || 0);
    const pattern = new fabric.Pattern({
      source: patternCanvas as unknown as HTMLImageElement,
      repeat: "repeat",
      offsetX,
      offsetY,
    });

    this.canvas.setBackgroundColor(pattern, () => {
      this.canvas.requestRenderAll();
    });
  }

  private resizeCanvasToWrapper(): void {
    const wrapper = this.canvas.getElement().parentElement?.parentElement;
    if (!wrapper) return;
    const nextWidth = wrapper.clientWidth;
    const nextHeight = wrapper.clientHeight;
    if (!nextWidth || !nextHeight) return;
    this.canvas.setWidth(nextWidth);
    this.canvas.setHeight(nextHeight);
    this.canvasWidth = nextWidth;
    this.canvasHeight = nextHeight;
    this.canvas.calcOffset();
  }

  /* Zoom / Pan */

  private clampZoom(value: number): number {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }

  applyZoom(nextZoom: number, origin?: { x: number; y: number }): void {
    const targetZoom = this.clampZoom(nextZoom);
    const currentZoom = this.canvas.getZoom();
    if (Math.abs(targetZoom - currentZoom) < 1e-4) {
      this.callbacks.onZoomChanged(targetZoom);
      return;
    }
    const point = origin || { x: this.canvasWidth / 2, y: this.canvasHeight / 2 };
    this.canvas.zoomToPoint(new fabric.Point(point.x, point.y), targetZoom);
    this.callbacks.onZoomChanged(targetZoom);
    this.updateGridBackground();
    this.canvas.requestRenderAll();
  }

  resetView(): void {
    this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    this.callbacks.onZoomChanged(0.5);
    this.updateGridBackground();
    this.canvas.renderAll();
  }

  zoomIn(): void {
    this.applyZoom(this.canvas.getZoom() * (1 + ZOOM_STEP));
  }

  zoomOut(): void {
    this.applyZoom(this.canvas.getZoom() * (1 - ZOOM_STEP));
  }

  private updatePanCursor(): void {
    const cursor = this.panState.isDragging
      ? PAN_ACTIVE_CURSOR
      : this.panState.keyActive
        ? PAN_CURSOR
        : this.defaultCursor;
    this.canvas.defaultCursor = cursor;
    const canvasAny = this.canvas as unknown as {
      upperCanvasEl?: HTMLElement;
      lowerCanvasEl?: HTMLElement;
      wrapperEl?: HTMLElement;
    };
    if (canvasAny.upperCanvasEl) canvasAny.upperCanvasEl.style.cursor = cursor;
    if (canvasAny.lowerCanvasEl) canvasAny.lowerCanvasEl.style.cursor = cursor;
    if (canvasAny.wrapperEl) canvasAny.wrapperEl.style.cursor = cursor;
  }

  private startPan(domEvent: MouseEvent): void {
    this.panState.isDragging = true;
    this.panState.lastClientX = domEvent.clientX;
    this.panState.lastClientY = domEvent.clientY;
    this.panState.restoreSelection = this.canvas.selection ?? true;
    this.canvas.selection = false;
    this.updatePanCursor();
  }

  private continuePan(domEvent: MouseEvent): void {
    const nextX = domEvent.clientX;
    const nextY = domEvent.clientY;
    const deltaX = nextX - this.panState.lastClientX;
    const deltaY = nextY - this.panState.lastClientY;
    if (deltaX === 0 && deltaY === 0) return;
    this.canvas.relativePan(new fabric.Point(deltaX, deltaY));
    this.panState.lastClientX = nextX;
    this.panState.lastClientY = nextY;
    this.canvas.requestRenderAll();
  }

  private endPanInteraction(): void {
    if (!this.panState.isDragging) {
      this.updatePanCursor();
      return;
    }
    this.panState.isDragging = false;
    this.canvas.selection = this.panState.restoreSelection;
    this.updatePanCursor();
    this.canvas.requestRenderAll();
  }

  /* Object positioning */

  private getConfigForObject(object: fabric.Object | undefined): ObjectConfig | null {
    const data = object?.data as { typeId?: string } | undefined;
    if (!data?.typeId) return null;
    return OBJECT_LOOKUP[data.typeId] || null;
  }

  private getAnchorOffsetPx(object: fabric.Object): number {
    if (!object) return 0;
    const config = this.getConfigForObject(object);
    if (!config) return 0;
    if (typeof config.anchorOffsetMeters === "number") {
      return config.anchorOffsetMeters * PIXELS_PER_METER;
    }
    if (config.icon) {
      const ratio = ICON_BASELINE_OFFSETS[config.icon] || 0;
      return Math.round(ratio * object.getScaledHeight() * 100) / 100;
    }
    return 0;
  }

  private getObjectPositionMeters(object: fabric.Object): { x: number; y: number } {
    const origin = this.getGridOrigin();
    const anchorOffset = this.getAnchorOffsetPx(object);
    const baseTop = (object.top ?? 0) - anchorOffset;
    const xMeters = ((object.left ?? 0) - origin.x) / PIXELS_PER_METER;
    const yMeters = (origin.y - baseTop) / PIXELS_PER_METER;
    return { x: xMeters, y: yMeters };
  }

  private pointerToMeters(point: { x: number; y: number }): { x: number; y: number } {
    const origin = this.getGridOrigin();
    return {
      x: (point.x - origin.x) / PIXELS_PER_METER,
      y: (origin.y - point.y) / PIXELS_PER_METER,
    };
  }

  /* Snapping logic */

  private snapObjectTransform(
    object: fabric.Object,
    opts?: { force?: boolean }
  ): void {
    const bypassToggle = opts?.force === true;
    if (!bypassToggle && (!this.settings.snappingEnabled || this.snapDisabledByShift)) {
      object.setCoords();
      return;
    }
    const attachedPole = this.metaByObjectId.get(object);
    if (
      attachedPole?.config.id === "padded-pole" &&
      (attachedPole.attachedTo || attachedPole.attachedCubeTo)
    ) {
      const snappedAngle =
        Math.round((object.angle ?? 0) / this.settings.rotationSnap) * this.settings.rotationSnap;
      object.set({ angle: snappedAngle });
      object.setCoords();
      return;
    }
    const origin = this.getGridOrigin();
    // Snap to the visible grid lines (one snap step = one minor grid line = gridSizeMeters).
    const snapGridPx = Math.max(4, this.settings.gridSizeMeters * PIXELS_PER_METER);
    const anchorOffset = this.getAnchorOffsetPx(object);
    const baseTop = (object.top ?? 0) - anchorOffset;
    const currentX = (object.left ?? 0) - origin.x;
    const currentY = origin.y - baseTop;
    const gridX = Math.round(currentX / snapGridPx);
    const gridY = Math.round(currentY / snapGridPx);
    const finalSnappedX = gridX * snapGridPx;
    const finalSnappedY = gridY * snapGridPx;
    const snappedLeft = origin.x + finalSnappedX;
    const snappedBaseTop = origin.y - finalSnappedY;
    const snappedTop = snappedBaseTop + anchorOffset;
    const snappedAngle =
      Math.round((object.angle ?? 0) / this.settings.rotationSnap) * this.settings.rotationSnap;
    object.set({
      left: Math.round(snappedLeft),
      top: Math.round(snappedTop),
      angle: snappedAngle,
    });
    object.setCoords();
  }

  private placeObjectAt(object: fabric.Object, position: Position = { x: 0, y: 0 }): void {
    const origin = this.getGridOrigin();
    const x = position.x ?? 0;
    const y = position.y ?? 0;
    const angle = position.angle ?? 0;
    const anchorOffset = this.getAnchorOffsetPx(object);
    const baseTop = origin.y - y * PIXELS_PER_METER;
    object.set({
      left: origin.x + x * PIXELS_PER_METER,
      top: baseTop + anchorOffset,
      angle,
    });
    object.setCoords();
  }

  private applyVisualDefaults(object: fabric.Object, config: ObjectConfig): void {
    if (object.type !== "image") {
      const baseColor = config.fillColor || config.color || "#3f51b5";
      object.set({ fill: hexToRgba(baseColor, 0.65) });
    }
    if (config.renderStyle === "point") {
      const hasSensingLine =
        typeof config.sensingLineMeters === "number" && config.sensingLineMeters > 0;
      if (hasSensingLine) {
        // Allow rotation so the user can aim the sensing line i.e change where the gate indicator is positioned relative to the pole; scaling is
        // already locked, and we hide every handle except the rotation one.
        object.set({ hasControls: true, hasBorders: false });
        object.setControlsVisibility?.({
          mtr: true,
          tl: false,
          tr: false,
          bl: false,
          br: false,
          mt: false,
          mb: false,
          ml: false,
          mr: false,
        });
      } else {
        object.set({ hasControls: false, hasBorders: false });
      }
    }
    object.set({ opacity: 1 });
    object.setCoords();
  }

  /**
   * Small triangle just past the bottom edge of the icon\
   * tip points toward the gate center which is (inward, −Y)
   */
  private makeFrontMarkerInward(
    baseColor: string,
    arrowSize: number,
    halfHeightPx: number
  ): fabric.Triangle {
    return new fabric.Triangle({
      width: arrowSize,
      height: arrowSize,
      fill: baseColor,
      originX: "center",
      originY: "center",
      left: 0,
      top: halfHeightPx + arrowSize * 0.75,
      angle: 0,
      opacity: 0.95,
      selectable: false,
      evented: false,
      strokeUniform: true,
    });
  }

  private async createFabricObject(config: ObjectConfig): Promise<fabric.Object> {
    const showForward = config.showDirectionArrow !== false;
    const visualWidth = config.visualWidth !== undefined ? config.visualWidth : config.width;
    const visualHeight = config.visualHeight !== undefined ? config.visualHeight : config.height;
    const footprintWidth =
      config.footprintWidth !== undefined ? config.footprintWidth : config.width;
    const footprintHeight =
      config.footprintHeight !== undefined ? config.footprintHeight : config.height;
    const widthPx = visualWidth * PIXELS_PER_METER;
    const heightPx = visualHeight * PIXELS_PER_METER;
    const footprintWidthPx = footprintWidth * PIXELS_PER_METER;
    const footprintHeightPx = footprintHeight * PIXELS_PER_METER;
    const shadow = config.shadow || null;
    const renderStyle = config.renderStyle || null;

    if (renderStyle) {
      const baseColor = config.fillColor || config.color || "#3f51b5";

      if (renderStyle === "point") {
        const radius = Math.max(4, Math.round(PIXELS_PER_METER * 0.12));
        const sensingMeters = config.sensingLineMeters ?? 0;

        if (sensingMeters > 0) {
          const lineLengthPx = sensingMeters * PIXELS_PER_METER;
          const tipSize = Math.max(8, Math.round(PIXELS_PER_METER * 0.18));

          // Local origin (0, 0) is the pole's dot. We add a line+tip pair on
          // BOTH sides (+X and -X) so the group's bbox is naturally symmetric
          // on the dot — no balancer hack needed. The active side renders
          // visible; the other has opacity 0. Toggling sides is just an
          // opacity flip (see `applySensingSideVisibility`).
          const dot = new fabric.Circle({
            radius,
            fill: baseColor,
            stroke: baseColor,
            strokeWidth: 1,
            originX: "center",
            originY: "center",
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
          });
          const makeLine = (side: "left" | "right") => {
            const sign = side === "right" ? 1 : -1;
            const line = new fabric.Line(
              side === "right"
                ? [0, 0, lineLengthPx, 0]
                : [-lineLengthPx, 0, 0, 0],
              {
                stroke: baseColor,
                strokeWidth: 2,
                strokeDashArray: [6, 4],
                strokeUniform: true,
                originX: "center",
                originY: "center",
                left: (lineLengthPx / 2) * sign,
                top: 0,
                selectable: false,
                evented: false,
              }
            );
            (line as fabric.Object & { data?: Record<string, unknown> }).data = {
              sensingDir: side,
            };
            return line;
          };
          const makeTip = (side: "left" | "right") => {
            const sign = side === "right" ? 1 : -1;
            const tip = new fabric.Triangle({
              width: tipSize,
              height: tipSize,
              fill: baseColor,
              originX: "center",
              originY: "center",
              left: (lineLengthPx + tipSize / 2) * sign,
              top: 0,
              angle: side === "right" ? 90 : -90,
              selectable: false,
              evented: false,
            });
            (tip as fabric.Object & { data?: Record<string, unknown> }).data = {
              sensingDir: side,
            };
            return tip;
          };

          // Small arrow on the "bottom" (+Y) of the sensing line, tip pointing
          // at the line / pole — indicates entry side without R/L text.
          const makeEntryArrow = (side: "left" | "right") => {
            const sign = side === "right" ? 1 : -1;
            const cx = (lineLengthPx / 2) * sign;
            const h = 9;
            const w = 10;
            const tri = new fabric.Polygon(
              [
                { x: 0, y: 0 },
                { x: -w / 2, y: h },
                { x: w / 2, y: h },
              ],
              {
                left: cx,
                top: 2,
                fill: baseColor,
                originX: "center",
                originY: "top",
                selectable: false,
                evented: false,
              }
            );
            (tri as fabric.Object & { data?: Record<string, unknown> }).data = {
              sensingDir: side,
              entryArrow: true,
            };
            return tri;
          };
          const rightLine = makeLine("right");
          const rightTip = makeTip("right");
          const rightArrow = makeEntryArrow("right");
          const leftLine = makeLine("left");
          const leftTip = makeTip("left");
          const leftArrow = makeEntryArrow("left");
          // Default visible side is "right" (matches local +X). Snapshot/import
          // restore flips this via `applySensingSideVisibility` if needed.
          leftLine.set({ opacity: 0 });
          leftTip.set({ opacity: 0 });
          leftArrow.set({ opacity: 0 });
          // The arrow itself as the front marker
          const forwardMarker: fabric.Object[] = showForward
            ? (() => {
                const f = this.makeFrontMarkerInward(baseColor, 8, radius);
                return [f];
              })()
            : [];

          return new fabric.Group(
            [
              leftLine,
              leftTip,
              leftArrow,
              rightLine,
              rightTip,
              rightArrow,
              dot,
              ...forwardMarker,
            ],
            {
              originX: "center",
              originY: "center",
              selectable: true,
              hasControls: true,
              hasBorders: false,
              lockScalingX: true,
              lockScalingY: true,
              perPixelTargetFind: true,
              strokeUniform: true,
              shadow: shadow ?? undefined,
            }
          );
        }

        if (!showForward) {
          return new fabric.Circle({
            radius,
            fill: baseColor,
            stroke: baseColor,
            strokeWidth: 1,
            originX: "center",
            originY: "center",
            selectable: true,
            hasControls: true,
            hasBorders: false,
            lockScalingX: true,
            lockScalingY: true,
            perPixelTargetFind: true,
            strokeUniform: true,
            shadow: shadow ?? undefined,
          });
        }
        {
          const dot = new fabric.Circle({
            radius,
            fill: baseColor,
            stroke: baseColor,
            strokeWidth: 1,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
          });
          const f = this.makeFrontMarkerInward(baseColor, 8, radius);
          return new fabric.Group([dot, f], {
            originX: "center",
            originY: "center",
            selectable: true,
            hasControls: true,
            hasBorders: false,
            lockScalingX: true,
            lockScalingY: true,
            perPixelTargetFind: true,
            strokeUniform: true,
            shadow: shadow ?? undefined,
          });
        }
      }

      if (renderStyle === "outline") {
        const minThinPx = 6;
        const outlineW = footprintWidthPx;
        const outlineH = Math.max(footprintHeightPx, minThinPx);
        const rect = new fabric.Rect({
          width: outlineW,
          height: outlineH,
          fill: "transparent",
          stroke: baseColor,
          strokeWidth: 2,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
        const parts: fabric.Object[] = [rect];
        if (showForward) {
          const arrowSize = Math.max(8, Math.min(outlineW * 0.12, 24));
          parts.push(this.makeFrontMarkerInward(baseColor, arrowSize, outlineH / 2));
        }
        return new fabric.Group(parts, {
          originX: "center",
          originY: "center",
          selectable: true,
          hasControls: true,
          hasBorders: false,
          lockScalingX: true,
          lockScalingY: true,
          perPixelTargetFind: true,
          strokeUniform: true,
          shadow: shadow ?? undefined,
        });
      }

      if (renderStyle === "rect") {
        const rect = new fabric.Rect({
          width: footprintWidthPx,
          height: footprintHeightPx,
          fill: hexToRgba(baseColor, 0.35),
          stroke: baseColor,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
        const parts: fabric.Object[] = [rect];
        if (config.labelText) {
          const label = new fabric.Text(config.labelText, {
            fontSize: 18,
            fill: baseColor,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
          });
          parts.push(label);
        }
        if (showForward) {
          const arrowSize = Math.max(7, Math.min(footprintWidthPx * 0.1, 20));
          parts.push(this.makeFrontMarkerInward(baseColor, arrowSize, footprintHeightPx / 2));
        }
        return new fabric.Group(parts, {
          originX: "center",
          originY: "center",
          selectable: true,
          hasControls: true,
          hasBorders: false,
          lockScalingX: true,
          lockScalingY: true,
          perPixelTargetFind: true,
          strokeUniform: true,
          shadow: shadow ?? undefined,
        });
      }

      if (renderStyle === "rectWithCenterLine") {
        const rect = new fabric.Rect({
          width: footprintWidthPx,
          height: footprintHeightPx,
          fill: "transparent",
          stroke: baseColor,
          strokeWidth: 1,
          originX: "center",
          originY: "center",
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
        const line = new fabric.Line(
          [-footprintWidthPx / 2, 0, footprintWidthPx / 2, 0],
          {
            stroke: baseColor,
            strokeWidth: 4,
            originX: "center",
            originY: "center",
            selectable: false,
            evented: false,
            strokeUniform: true,
          }
        );
        const parts: fabric.Object[] = [rect, line];
        if (config.labelText) {
          const label = new fabric.Text(config.labelText, {
            fontSize: 16,
            fill: baseColor,
            originX: "right",
            originY: "top",
            left: footprintWidthPx / 2 - 4,
            top: -footprintHeightPx / 2 + 2,
            selectable: false,
            evented: false,
          });
          parts.push(label);
        }
        if (showForward) {
          const arrowSize = Math.max(7, Math.min(footprintWidthPx * 0.1, 20));
          parts.push(this.makeFrontMarkerInward(baseColor, arrowSize, footprintHeightPx / 2));
        }
        return new fabric.Group(parts, {
          originX: "center",
          originY: "center",
          selectable: true,
          hasControls: true,
          hasBorders: false,
          lockScalingX: true,
          lockScalingY: true,
          perPixelTargetFind: true,
          strokeUniform: true,
          shadow: shadow ?? undefined,
        });
      }
    }

    if (config.icon) {
      return new Promise<fabric.Object>((resolve) => {
        fabric.Image.fromURL(
          config.icon as string,
          (img) => {
            const baseColor = config.fillColor || config.color || "#3f51b5";
            img.set({
              originX: "center",
              originY: "center",
              selectable: true,
              hasControls: true,
              hasBorders: false,
              lockScalingX: true,
              lockScalingY: true,
              perPixelTargetFind: true,
              strokeUniform: true,
            });
            const scale = Math.min(widthPx / (img.width ?? 1), heightPx / (img.height ?? 1));
            img.scale(scale);
            const sh = img.getScaledHeight();
            if (showForward) {
              const ar = this.makeFrontMarkerInward(
                baseColor,
                Math.max(6, Math.min(sh * 0.12, 18)),
                sh / 2
              );
              const g = new fabric.Group([img, ar], {
                originX: "center",
                originY: "center",
                selectable: true,
                hasControls: true,
                hasBorders: false,
                lockScalingX: true,
                lockScalingY: true,
                perPixelTargetFind: true,
                strokeUniform: true,
                shadow: config.shadow ?? undefined,
              });
              resolve(g);
            } else {
              resolve(img);
            }
          },
          { crossOrigin: "anonymous" }
        );
      });
    }

    if (config.shape === "circle") {
      const diameterPx =
        (visualWidth && visualHeight
          ? ((visualWidth + visualHeight) / 2) * PIXELS_PER_METER
          : widthPx || heightPx) || PIXELS_PER_METER;
      return new fabric.Circle({
        radius: diameterPx / 2,
        originX: "center",
        originY: "center",
        selectable: true,
        hasControls: true,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        perPixelTargetFind: true,
        strokeUniform: true,
        shadow: shadow ?? undefined,
      });
    }

    return new fabric.Rect({
      width: widthPx,
      height: heightPx,
      fill: config.fillColor || hexToRgba(config.color, 0.3),
      originX: "center",
      originY: "center",
      selectable: true,
      hasControls: true,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      perPixelTargetFind: true,
      strokeUniform: true,
      shadow: shadow ?? undefined,
    });
  }

  /* Reference layout */

  private async createReferenceObjects(): Promise<void> {
    this.referenceObjects = [];
    await Promise.all(
      REFERENCE_LAYOUT.map(async (item) => {
        const config = OBJECT_LOOKUP[item.typeId];
        if (!config) return null;
        const fabricObject = await this.createFabricObject(config);
        this.applyVisualDefaults(fabricObject, config);
        fabricObject.set({
          selectable: false,
          evented: false,
          hoverCursor: "default",
          opacity: item.opacity ?? 0.8,
          excludeFromExport: true,
        });
        fabricObject.data = { typeId: item.typeId, reference: true };
        this.placeObjectAt(fabricObject, item);
        this.canvas.add(fabricObject);
        fabricObject.sendToBack();
        this.referenceObjects.push({ layout: item, fabricObject });
        return fabricObject;
      })
    );
  }

  private updateReferenceVisibility(): void {
    const visible = this.settings.showReferenceLayout;
    this.referenceObjects.forEach(({ fabricObject }) => {
      fabricObject.visible = visible;
    });
    this.canvas.requestRenderAll();
  }

  /* 
   * Object lifecycle
   *  */

  private allocateEntityName(prefix: string): string {
    const count = (this.entityCounters[prefix] || 0) + 1;
    this.entityCounters[prefix] = count;
    return `${prefix}${count}`;
  }

  private resetEntityCounters(): void {
    this.entityCounters = {};
  }

  async addObjectToScene(typeId: string, opts: Partial<Position> = {}): Promise<void> {
    const config = OBJECT_LOOKUP[typeId];
    if (!config) {
      console.warn(`Unknown object id: ${typeId}`);
      return;
    }
    const fabricObject = await this.createFabricObject(config);
    fabricObject.data = { typeId: config.id };
    this.applyVisualDefaults(fabricObject, config);
    const initialPosition: Position = {
      x: opts.x ?? 0,
      y: opts.y ?? DEFAULT_FORWARD_OFFSET_METERS,
      angle: opts.angle ?? 0,
    };
    this.placeObjectAt(fabricObject, initialPosition);
    this.canvas.add(fabricObject);
    this.canvas.setActiveObject(fabricObject);
    fabricObject.setCoords();
    const entityName = this.allocateEntityName(config.entityPrefix);
    const hasSensing = !!(config.sensingLineMeters && config.sensingLineMeters > 0);
    const metadata: PlacedObjectMeta = {
      id: createUniqueId(),
      config,
      fabricObject,
      entityName,
      altitude: config.altitude ?? 0,
      stackCount: isStackableGateConfig(config) ? 1 : undefined,
      sensingSide: hasSensing ? this.initialSensingSideForConfig(config) : null,
      sensingFacing:
        hasSensing && getPassageTarget(config) === "flag" ? "front" : null,
      champsGateColor: config.id === "champs-25-gate" ? "red" : undefined,
    };
    this.placedObjects.push(metadata);
    this.metaByObjectId.set(fabricObject, metadata);
    if (hasSensing) {
      this.applySensingSideVisibility(metadata);
    }
    this.updateObjectMetadata(fabricObject);
    this.setActiveMeta(metadata);
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  duplicateSelected(): void {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    const meta = this.metaByObjectId.get(active);
    if (!meta) return;
    active.clone((cloned: fabric.Object) => {
      this.canvas.add(cloned);
      cloned.data = { typeId: meta.config.id };
      const currentPos = this.getObjectPositionMeters(active);
      this.placeObjectAt(cloned, {
        x: currentPos.x + this.settings.gridSizeMeters,
        y: currentPos.y + this.settings.gridSizeMeters,
        angle: active.angle ?? 0,
      });
      cloned.setCoords();
      const newMeta: PlacedObjectMeta = {
        id: createUniqueId(),
        config: meta.config,
        fabricObject: cloned,
        entityName: this.allocateEntityName(meta.config.entityPrefix),
        altitude: meta.altitude,
        stackCount: meta.stackCount,
        sensingSide: meta.sensingSide ?? null,
        sensingFacing: meta.sensingFacing ?? null,
        champsGateColor: meta.champsGateColor,
      };
      this.applyVisualDefaults(cloned, meta.config);
      this.placedObjects.push(newMeta);
      this.metaByObjectId.set(cloned, newMeta);
      if (newMeta.sensingSide) {
        this.applySensingSideVisibility(newMeta);
      }
      this.updateObjectMetadata(cloned);
      this.applyAttachedPoleMoveLock(newMeta);
      this.canvas.setActiveObject(cloned);
      this.setActiveMeta(newMeta);
      this.canvas.renderAll();
      this.callbacks.onSceneChanged();
    });
  }

  deleteSelected(): void {
    const active = this.canvas.getActiveObject();
    if (!active) return;
    const meta = this.metaByObjectId.get(active);
    if (!meta) return;
    this.canvas.remove(meta.fabricObject);
    this.metaByObjectId.delete(meta.fabricObject);
    this.placedObjects = this.placedObjects.filter((entry) => entry.id !== meta.id);
    this.setActiveMeta(null);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  clearScene(): void {
    this.placedObjects.forEach((entry) => this.canvas.remove(entry.fabricObject));
    this.placedObjects = [];
    this.metaByObjectId.clear();
    this.resetEntityCounters();
    this.setActiveMeta(null);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  setActiveMeta(metadata: PlacedObjectMeta | null): void {
    this.activeMeta = metadata;
    this.callbacks.onSelectionChanged(metadata);
  }

  getActiveMeta(): PlacedObjectMeta | null {
    return this.activeMeta;
  }

  getPlacedObjects(): PlacedObjectMeta[] {
    return [...this.placedObjects];
  }

  /** Update mutable inspector fields on the active meta. */
  setActiveAltitude(value: number): void {
    if (!this.activeMeta) return;
    this.activeMeta.altitude = Number.isFinite(value) ? value : 0;
    this.callbacks.onSelectionChanged(this.activeMeta);
    this.callbacks.onSceneChanged();
  }

  setActiveStackCount(value: number): void {
    if (!this.activeMeta || !isStackableGateConfig(this.activeMeta.config)) return;
    const clamped = Number.isFinite(value) ? Math.min(3, Math.max(1, value)) : 1;
    this.activeMeta.stackCount = clamped;

    // Update poles attached to this gate
    this.placedObjects.forEach((poleMeta) => {
      if (poleMeta.attachedTo === this.activeMeta?.id) {
        if (poleMeta.attachedLevel && poleMeta.attachedLevel > clamped) {
          poleMeta.attachedLevel = clamped;
        }
        this.updateAttachedPolePosition(poleMeta);
      }
    });
    this.callbacks.onSelectionChanged(this.activeMeta);
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  setActiveChampsGateColor(value: Champs25GateColor): void {
    if (!this.activeMeta || this.activeMeta.config.id !== "champs-25-gate") return;
    this.activeMeta.champsGateColor = value;
    const found = this.placedObjects.find((e) => e.id === this.activeMeta?.id);
    if (found) found.champsGateColor = value;
    this.callbacks.onSelectionChanged(this.activeMeta);
    this.callbacks.onSceneChanged();
  }

  setActiveAttachment(opts: {
    mode: "" | "gate" | "cube";
    gateId?: string;
    cubeId?: string;
    side?: "left" | "right";
    level?: number;
    corner?: string;
  }): void {
    const meta = this.activeMeta;
    if (!meta || meta.config.id !== "padded-pole") return;
    const { mode } = opts;
    const prevGateId = meta.attachedTo;
    const prevCubeId = meta.attachedCubeTo;
    const wasAttached = !!(prevGateId || prevCubeId);

    if (!mode) {
      meta.attachedTo = null;
      meta.attachmentSide = null;
      meta.attachedLevel = null;
      meta.attachedCubeTo = null;
      meta.attachedCubeCorner = null;
    } else if (mode === "cube") {
      let cubeId = opts.cubeId;
      if (!cubeId) {
        const cubes = this.getCubesForAttachment();
        cubeId = cubes[0]?.id;
      }
      if (!cubeId) {
        // No cube in the scene to attach to — do not clear an existing
        // attachment; UI may re-prompt once a cube exists.
        this.canvas.requestRenderAll();
        this.callbacks.onSelectionChanged(meta);
        this.callbacks.onSceneChanged();
        return;
      }
      meta.attachedCubeTo = cubeId;
      meta.attachedCubeCorner = opts.corner ?? "1";
      meta.attachedTo = null;
      meta.attachmentSide = null;
      meta.attachedLevel = null;
    } else if (mode === "gate") {
      let gateId = opts.gateId;
      if (!gateId) {
        const gList = this.getGatesForAttachment();
        gateId = gList[0]?.id;
      }
      if (!gateId) {
        this.canvas.requestRenderAll();
        this.callbacks.onSelectionChanged(meta);
        this.callbacks.onSceneChanged();
        return;
      }
      const gateMeta = this.placedObjects.find((entry) => entry.id === gateId);
      const stackCount = getGateStackCount(gateMeta || undefined);
      const requested = Number.parseInt(String(opts.level ?? 1), 10);
      const clampedLevel = Number.isFinite(requested)
        ? Math.min(stackCount, Math.max(1, requested))
        : stackCount;
      meta.attachedTo = gateId;
      meta.attachmentSide = opts.side ?? "left";
      meta.attachedLevel = clampedLevel;
      meta.attachedCubeTo = null;
      meta.attachedCubeCorner = null;
    } else {
      meta.attachedTo = null;
      meta.attachmentSide = null;
      meta.attachedLevel = null;
      meta.attachedCubeTo = null;
      meta.attachedCubeCorner = null;
    }

    if (meta.attachedTo || meta.attachedCubeTo) {
      const newGate = meta.attachedTo;
      const newCube = meta.attachedCubeTo;
      const firstAttach = !wasAttached;
      const switchedTarget =
        (newGate && newGate !== prevGateId) || (newCube && newCube !== prevCubeId);
      if (firstAttach || switchedTarget) {
        if (newGate) {
          const gm = this.placedObjects.find((e) => e.id === newGate);
          if (gm) {
            meta.fabricObject.set({ angle: gm.fabricObject.angle ?? 0 });
          }
        } else if (newCube) {
          const cm = this.placedObjects.find((e) => e.id === newCube);
          if (cm) {
            meta.fabricObject.set({ angle: cm.fabricObject.angle ?? 0 });
          }
        }
      }
      this.updateAttachedPolePosition(meta);
    } else if (meta.fabricObject) {
      meta.fabricObject.set({ opacity: 1 });
    }
    this.applyAttachedPoleMoveLock(meta);
    this.canvas.requestRenderAll();
    this.callbacks.onSelectionChanged(meta);
    this.callbacks.onSceneChanged();
  }

  /**
   * Attached padded poles: fixed XY (follows gate/cube in code) but free rotation
   * for the sensing line. Standalone: full drag.
   */
  private applyAttachedPoleMoveLock(poleMeta: PlacedObjectMeta): void {
    if (poleMeta.config.id !== "padded-pole" || !poleMeta.fabricObject) return;
    const lock = !!(poleMeta.attachedTo || poleMeta.attachedCubeTo);
    poleMeta.fabricObject.set({ lockMovementX: lock, lockMovementY: lock });
  }


  private applySensingSideVisibility(meta: PlacedObjectMeta): void {
    const obj = meta.fabricObject as fabric.Group | undefined;
    if (!obj || typeof (obj as fabric.Group).getObjects !== "function") return;
    const side: "left" | "right" = meta.sensingSide === "left" ? "left" : "right";
    const children = (obj as fabric.Group).getObjects();
    for (const child of children) {
      const dir = (child as fabric.Object & { data?: { sensingDir?: "left" | "right" } })
        .data?.sensingDir;
      if (!dir) continue;
      child.set({ opacity: dir === side ? 1 : 0 });
    }
    (obj as fabric.Object & { dirty?: boolean }).dirty = true;
    if (getPassageTarget(meta.config) === "flag") {
      this.applySensingFacingEntryArrows(meta);
    }
  }

  /**
   * For flags: The back approach mirrors the small entry marker to the other side
   * of the dashed line (and flips it) to match a 180° half-plane in export.
   */
  private applySensingFacingEntryArrows(meta: PlacedObjectMeta): void {
    if (getPassageTarget(meta.config) !== "flag") return;
    const m = meta.config.sensingLineMeters;
    if (typeof m !== "number" || m <= 0) return;
    const obj = meta.fabricObject as fabric.Group | undefined;
    if (!obj || typeof (obj as fabric.Group).getObjects !== "function") return;
    const facing = meta.sensingFacing === "back" ? "back" : "front";
    const lineLengthPx = m * PIXELS_PER_METER;
    const h = 9; // keep in sync with makeEntryArrow
    for (const child of (obj as fabric.Group).getObjects()) {
      const data = (child as fabric.Object & { data?: { entryArrow?: boolean; sensingDir?: "left" | "right" } })
        .data;
      if (!data?.entryArrow || !data.sensingDir) continue;
      const sign = data.sensingDir === "right" ? 1 : -1;
      const cx = (lineLengthPx / 2) * sign;
      // small arrow position math
      if (facing === "back") {
        child.set({
          left: cx,
          top: -(10 + h),
          scaleY: -1,
          originX: "center",
          originY: "top",
        });
      } else {
        child.set({
          left: cx,
          top: 2,
          scaleY: 1,
          originX: "center",
          originY: "top",
        });
      }
    }
    (obj as fabric.Object & { dirty?: boolean }).dirty = true;
  }


  setActiveSensingSide(side: "left" | "right"): void {
    const meta = this.activeMeta;
    if (!meta) return;
    if (!meta.config.sensingLineMeters) return;
    if ((meta.sensingSide ?? "right") === side) return;
    meta.sensingSide = side;
    this.applySensingSideVisibility(meta);
    this.updateObjectMetadata(meta.fabricObject);
    this.canvas.requestRenderAll();
    this.callbacks.onSelectionChanged(meta);
    this.callbacks.onSceneChanged();
  }

  setActiveSensingFacing(facing: "front" | "back"): void {
    const meta = this.activeMeta;
    if (!meta) return;
    if (getPassageTarget(meta.config) !== "flag") return;
    if (!meta.config.sensingLineMeters || !(meta.config.sensingLineMeters > 0)) return;
    if ((meta.sensingFacing ?? "front") === facing) return;
    meta.sensingFacing = facing;
    this.applySensingFacingEntryArrows(meta);
    this.updateObjectMetadata(meta.fabricObject);
    this.canvas.requestRenderAll();
    this.callbacks.onSelectionChanged(meta);
    this.callbacks.onSceneChanged();
  }

  private initialSensingSideForConfig(_config: ObjectConfig): "left" | "right" {
    return "right";
  }

  /**
   * Use when adding a pole passage checkpoint: reads the live fabric angle and
   * global rotation so the stored snapshot matches the canvas (React selection
   * can lag a frame behind after rotation).
   */
  getPolePassageAddSnapshot(): { fabricAngleDeg: number; globalRotationDeg: number } | null {
    const m = this.activeMeta;
    if (!m?.config.sensingLineMeters || !(m.config.sensingLineMeters > 0)) {
      return null;
    }
    return {
      fabricAngleDeg: m.fabricObject.angle ?? 0,
      globalRotationDeg: this.settings.globalRotation || 0,
    };
  }

  /* Attachment math calculations for the poles */

  private calculateAttachedPolePosition(
    poleMeta: PlacedObjectMeta,
    gateMeta: PlacedObjectMeta,
    side: "left" | "right",
    level: number
  ): Position {
    const gatePos = this.getObjectPositionMeters(gateMeta.fabricObject);
    const gateAngle = gateMeta.fabricObject.angle ?? 0;
    const gateWidth = gateMeta.config.width || 2.1;
    const gateHeight = gateMeta.config.height || 2.1;
    const gateBaseAltitude = gateMeta.altitude || 0;
    const stackSpacing = getGateStackSpacing(gateMeta);
    const stackCount = getGateStackCount(gateMeta);
    const stackLevel = Number.isFinite(level)
      ? Math.min(stackCount, Math.max(1, level))
      : stackCount;
    const angleRad = (gateAngle * Math.PI) / 180;
    const offsetDistance = gateWidth / 2;
    let offsetX = 0;
    let offsetY = 0;
    if (side === "left") {
      offsetX = -Math.cos(angleRad) * offsetDistance;
      offsetY = Math.sin(angleRad) * offsetDistance;
    } else if (side === "right") {
      offsetX = Math.cos(angleRad) * offsetDistance;
      offsetY = -Math.sin(angleRad) * offsetDistance;
    }
    const heightOffset =
      typeof poleMeta?.config?.attachHeightOffsetMeters === "number"
        ? poleMeta.config.attachHeightOffsetMeters
        : 0;
    return {
      x: gatePos.x + offsetX,
      y: gatePos.y + offsetY,
      angle: gateAngle,
      altitude:
        gateBaseAltitude + gateHeight + heightOffset + stackSpacing * (stackLevel - 1),
    };
  }

  private calculateCubeCornerPosition(
    cubeMeta: PlacedObjectMeta,
    corner: string,
    inwardMeters = 0
  ): Position {
    const cubePos = this.getObjectPositionMeters(cubeMeta.fabricObject);
    const cubeAngle = cubeMeta.fabricObject.angle ?? 0;
    const cubeWidth = cubeMeta.config.footprintWidth || cubeMeta.config.width || 2.1;
    const cubeHeight = cubeMeta.config.footprintHeight || cubeMeta.config.height || 2.1;
    const cubeAltitude = cubeMeta.altitude || 0;
    const baseHeight = cubeMeta.config.height || 2.1;
    const cubeVerticalHeight =
      cubeMeta.config.id === "pipe-double-cube" ? baseHeight * 2 : baseHeight;
    const halfW = cubeWidth / 2;
    const halfH = cubeHeight / 2;
    const angleRad = (cubeAngle * Math.PI) / 180;
    const cornerIndex = Number.parseInt(corner, 10);
    const resolvedCorner = Number.isFinite(cornerIndex) ? cornerIndex : 1;
    const localCorners: Record<number, { x: number; y: number }> = {
      1: { x: -halfW, y: halfH },
      2: { x: halfW, y: halfH },
      3: { x: halfW, y: -halfH },
      4: { x: -halfW, y: -halfH },
    };
    const local = localCorners[resolvedCorner] || localCorners[1];
    const rotatedX = local.x * Math.cos(angleRad) - local.y * Math.sin(angleRad);
    const rotatedY = local.x * Math.sin(angleRad) + local.y * Math.cos(angleRad);
    let shiftX = 0;
    let shiftY = 0;
    if (inwardMeters > 0) {
      const dirLocalX = -Math.sign(local.x || 1);
      const dirLocalY = -Math.sign(local.y || 1);
      const dirScale = inwardMeters / Math.sqrt(2);
      const dirLocal = { x: dirLocalX * dirScale, y: dirLocalY * dirScale };
      shiftX = dirLocal.x * Math.cos(angleRad) - dirLocal.y * Math.sin(angleRad);
      shiftY = dirLocal.x * Math.sin(angleRad) + dirLocal.y * Math.cos(angleRad);
    }
    return {
      x: cubePos.x + rotatedX + shiftX,
      y: cubePos.y + rotatedY + shiftY,
      angle: cubeAngle,
      altitude: cubeAltitude + cubeVerticalHeight,
    };
  }

  private updateAttachedPolePosition(poleMeta: PlacedObjectMeta): void {
    if (!poleMeta.attachedTo && !poleMeta.attachedCubeTo) {
      if (poleMeta.fabricObject) poleMeta.fabricObject.set({ opacity: 1 });
      this.applyAttachedPoleMoveLock(poleMeta);
      return;
    }

    const keepAngle = poleMeta.fabricObject.angle ?? 0;

    if (poleMeta.attachedCubeTo) {
      const cubeMeta = this.placedObjects.find((m) => m.id === poleMeta.attachedCubeTo);
      if (!cubeMeta) {
        poleMeta.attachedCubeTo = null;
        poleMeta.attachedCubeCorner = null;
        if (poleMeta.fabricObject) poleMeta.fabricObject.set({ opacity: 1 });
        this.applyAttachedPoleMoveLock(poleMeta);
        return;
      }
      const poleInsetMeters =
        typeof poleMeta?.config?.cornerInsetMeters === "number"
          ? poleMeta.config.cornerInsetMeters
          : 0;
      const cubePos = this.calculateCubeCornerPosition(
        cubeMeta,
        poleMeta.attachedCubeCorner || "1",
        poleInsetMeters
      );
      const heightOffset =
        typeof poleMeta?.config?.attachHeightOffsetMeters === "number"
          ? poleMeta.config.attachHeightOffsetMeters
          : 0;
      const cubeHeightBoost = 0.5;
      const cubeAlt = (cubePos.altitude || 0) + heightOffset + cubeHeightBoost;
      this.placeObjectAt(poleMeta.fabricObject, {
        x: cubePos.x,
        y: cubePos.y,
        angle: keepAngle,
        altitude: cubeAlt,
      });
      poleMeta.altitude = cubeAlt;
      poleMeta.fabricObject.set({ opacity: 0.85 });
      this.updateObjectMetadata(poleMeta.fabricObject);
      this.applyAttachedPoleMoveLock(poleMeta);
      return;
    }

    const gateMeta = this.placedObjects.find((m) => m.id === poleMeta.attachedTo);
    if (!gateMeta) {
      poleMeta.attachedTo = null;
      poleMeta.attachmentSide = null;
      poleMeta.attachedLevel = null;
      if (poleMeta.fabricObject) poleMeta.fabricObject.set({ opacity: 1 });
      this.applyAttachedPoleMoveLock(poleMeta);
      return;
    }
    const stackCount = getGateStackCount(gateMeta);
    const requestedLevel = Number.parseInt(String(poleMeta.attachedLevel ?? ""), 10);
    const clampedLevel = Number.isFinite(requestedLevel)
      ? Math.min(stackCount, Math.max(1, requestedLevel))
      : stackCount;
    poleMeta.attachedLevel = clampedLevel;
    const newPos = this.calculateAttachedPolePosition(
      poleMeta,
      gateMeta,
      poleMeta.attachmentSide || "left",
      clampedLevel
    );
    this.placeObjectAt(poleMeta.fabricObject, {
      x: newPos.x,
      y: newPos.y,
      angle: keepAngle,
      altitude: newPos.altitude,
    });
    if (newPos.altitude !== undefined) poleMeta.altitude = newPos.altitude;
    poleMeta.fabricObject.set({ opacity: 0.85 });
    this.updateObjectMetadata(poleMeta.fabricObject);
    this.applyAttachedPoleMoveLock(poleMeta);
  }

  private updateObjectMetadata(object: fabric.Object): void {
    const meta = this.metaByObjectId.get(object);
    if (!meta) return;
    const pos = this.getObjectPositionMeters(object);
    meta.position = pos;
    meta.angle = object.angle ?? 0;
    const existing = (object as fabric.Object & { data?: Record<string, unknown> }).data ?? {};
    (object as fabric.Object & { data?: Record<string, unknown> }).data = {
      ...existing,
      id: meta.id,
      typeId: meta.config.id,
    };
    if (this.activeMeta && this.activeMeta.id === meta.id) {
      this.callbacks.onSelectionChanged(this.activeMeta);
    }
  }

  /** Snap every placed object to the current grid / rotation snap (explicit toolbar action). */
  snapAllToGrid(): void {
    this.placedObjects.forEach((entry) => {
      if (
        entry.config.id === "padded-pole" &&
        (entry.attachedTo || entry.attachedCubeTo)
      ) {
        this.updateAttachedPolePosition(entry);
        this.snapObjectTransform(entry.fabricObject, { force: true });
      } else {
        this.snapObjectTransform(entry.fabricObject, { force: true });
      }
      this.updateObjectMetadata(entry.fabricObject);
      entry.fabricObject.setCoords();
    });
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  /* Ruler (im gonna fix this) */

  private clearRulerGraphics(): void {
    if (this.ruler.line) {
      this.canvas.remove(this.ruler.line);
      this.ruler.line = null;
    }
    if (this.ruler.label) {
      this.canvas.remove(this.ruler.label);
      this.ruler.label = null;
    }
    this.canvas.requestRenderAll();
  }

  private resetRulerMeasurement(): void {
    this.ruler.startPoint = null;
    this.ruler.isDrawing = false;
  }

  private ensureRulerLine(startPoint: fabric.Point, endPoint: fabric.Point): void {
    if (!this.ruler.line) {
      this.ruler.line = new fabric.Line(
        [startPoint.x, startPoint.y, endPoint.x, endPoint.y],
        {
          stroke: "#ff4081",
          strokeWidth: 2,
          strokeDashArray: [8, 6],
          selectable: false,
          evented: false,
          excludeFromExport: true,
        }
      );
      this.canvas.add(this.ruler.line);
    } else {
      this.ruler.line.set({
        x1: startPoint.x,
        y1: startPoint.y,
        x2: endPoint.x,
        y2: endPoint.y,
      });
      this.ruler.line.setCoords();
    }
    this.ruler.line.bringToFront();
  }

  private ensureRulerLabel(text: string, position: { x: number; y: number }): void {
    if (!this.ruler.label) {
      this.ruler.label = new fabric.Textbox(text, {
        left: position.x,
        top: position.y,
        fontSize: 14,
        fill: "#ffffff",
        backgroundColor: "rgba(15, 23, 42, 0.64)",
        padding: 8,
        borderColor: "transparent",
        selectable: false,
        evented: false,
        textAlign: "center",
        originX: "center",
        originY: "center",
        excludeFromExport: true,
      });
      this.canvas.add(this.ruler.label);
    } else {
      this.ruler.label.set({ text, left: position.x, top: position.y });
      this.ruler.label.setCoords();
    }
    this.ruler.label.bringToFront();
  }

  private updateRulerOverlay(endPoint: fabric.Point): void {
    if (!this.ruler.startPoint) return;
    const startPoint = this.ruler.startPoint;
    this.ensureRulerLine(startPoint, endPoint);
    const startMeters = this.pointerToMeters(startPoint);
    const endMeters = this.pointerToMeters(endPoint);
    const deltaLateral = endMeters.x - startMeters.x;
    const deltaForward = endMeters.y - startMeters.y;
    const planarDistance = Math.sqrt(deltaLateral ** 2 + deltaForward ** 2);
    const labelText = `${planarDistance.toFixed(2)} m\nΔx ${deltaLateral.toFixed(
      2
    )} m · Δy ${deltaForward.toFixed(2)} m`;
    const labelPosition = {
      x: (startPoint.x + endPoint.x) / 2,
      y: (startPoint.y + endPoint.y) / 2 - 20,
    };
    this.ensureRulerLabel(labelText, labelPosition);
    this.canvas.requestRenderAll();
  }

  private handleRulerClick(pointer: { x: number; y: number }): void {
    if (!this.ruler.enabled) return;
    const clickPoint = new fabric.Point(pointer.x, pointer.y);
    if (!this.ruler.isDrawing) {
      this.ruler.startPoint = clickPoint;
      this.ruler.isDrawing = true;
      this.updateRulerOverlay(clickPoint);
      return;
    }
    this.updateRulerOverlay(clickPoint);
    this.ruler.isDrawing = false;
  }

  private handleRulerMove(pointer: { x: number; y: number }): void {
    if (!this.ruler.enabled || !this.ruler.isDrawing || !this.ruler.startPoint) return;
    this.updateRulerOverlay(new fabric.Point(pointer.x, pointer.y));
  }

  /* Drag-and-drop / scene events */

  handleDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  async handleDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    const typeId = event.dataTransfer?.getData("text/plain");
    if (!typeId) return;
    const pointer = this.canvas.getPointer(event as unknown as Event);
    const meters = this.pointerToMeters(pointer);
    await this.addObjectToScene(typeId, { x: meters.x, y: meters.y });
  }

  private isEditableElement(element: EventTarget | null): boolean {
    if (!element || !(element instanceof HTMLElement)) return false;
    const tagName = element.tagName?.toUpperCase();
    return (
      element.isContentEditable ||
      tagName === "INPUT" ||
      tagName === "TEXTAREA" ||
      tagName === "SELECT"
    );
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (event.code === "Escape") {
      if (this.ruler.enabled) {
        this.resetRulerMeasurement();
        this.clearRulerGraphics();
        this.canvas.requestRenderAll();
      }
      return;
    }
    if (
      (event.code === "ShiftLeft" || event.code === "ShiftRight") &&
      !this.isEditableElement(event.target)
    ) {
      this.snapDisabledByShift = true;
    }
    if (event.code !== "Space" || this.isEditableElement(event.target)) return;
    if (!this.panState.keyActive) {
      this.panState.keyActive = true;
      this.updatePanCursor();
    }
    event.preventDefault();
  }

  private handleKeyUp(event: KeyboardEvent): void {
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      this.snapDisabledByShift = false;
    }
    if (event.code !== "Space") return;
    this.panState.keyActive = false;
    this.updatePanCursor();
  }

  private notifyMultiSelection(): void {
    const active = this.canvas.getActiveObject();
    let count = 0;
    if (active && (active as fabric.Object).type === "activeSelection") {
      count = ((active as unknown as { _objects: fabric.Object[] })._objects || []).length;
    }
    this.callbacks.onMultiSelectionChanged?.(count);
  }

  private registerCanvasEvents(): void {
    const handleSelection = (event: { selected?: fabric.Object[] }) => {
      const objects = event.selected ?? [];
      if (objects.length > 1) {
        this.setActiveMeta(null);
      } else {
        const obj = objects[0];
        const meta = obj ? this.metaByObjectId.get(obj) || null : null;
        this.setActiveMeta(meta);
      }
      this.notifyMultiSelection();
    };
    this.canvas.on("selection:created", handleSelection);
    this.canvas.on("selection:updated", handleSelection);
    this.canvas.on("selection:cleared", () => {
      this.setActiveMeta(null);
      this.callbacks.onMultiSelectionChanged?.(0);
    });
    this.canvas.on("object:modified", (event) => {
      const object = event.target;
      if (!object || !this.metaByObjectId.get(object)) return;
      const meta = this.metaByObjectId.get(object);
      if (meta && (meta.attachedTo || meta.attachedCubeTo)) {
        this.updateAttachedPolePosition(meta);
        this.snapObjectTransform(object);
        this.canvas.requestRenderAll();
        this.callbacks.onSceneChanged();
        return;
      }
      this.snapObjectTransform(object);
      this.updateObjectMetadata(object);
      if (meta && isGateConfig(meta.config)) {
        this.placedObjects.forEach((poleMeta) => {
          if (poleMeta.attachedTo === meta.id) {
            this.updateAttachedPolePosition(poleMeta);
          }
        });
      }
      if (meta && isCubeConfig(meta.config)) {
        this.placedObjects.forEach((poleMeta) => {
          if (poleMeta.attachedCubeTo === meta.id) {
            this.updateAttachedPolePosition(poleMeta);
          }
        });
      }
      this.canvas.requestRenderAll();
      this.callbacks.onSceneChanged();
    });
    this.canvas.on("object:moving", (event) => {
      const target = event.target;
      if (!target) return;
      this.computeAndDrawAlignmentGuides(target);
    });
    this.canvas.on("object:scaling", () => this.clearAlignmentGuides());
    this.canvas.on("object:rotating", () => this.clearAlignmentGuides());
    this.canvas.on("object:modified", () => this.clearAlignmentGuides());
    this.canvas.on("mouse:up", () => this.clearAlignmentGuides());

    this.canvas.on("object:removed", (event) => {
      const object = event.target;
      if (!object) return;
      const meta = this.metaByObjectId.get(object);
      if (meta) {
        if (isGateConfig(meta.config)) {
          this.placedObjects.forEach((poleMeta) => {
            if (poleMeta.attachedTo === meta.id) {
              poleMeta.attachedTo = null;
              poleMeta.attachmentSide = null;
              poleMeta.attachedLevel = null;
              this.updateAttachedPolePosition(poleMeta);
            }
          });
        }
        if (isCubeConfig(meta.config)) {
          this.placedObjects.forEach((poleMeta) => {
            if (poleMeta.attachedCubeTo === meta.id) {
              poleMeta.attachedCubeTo = null;
              poleMeta.attachedCubeCorner = null;
              this.updateAttachedPolePosition(poleMeta);
            }
          });
        }
        this.metaByObjectId.delete(object);
        this.placedObjects = this.placedObjects.filter((entry) => entry.id !== meta.id);
        if (this.activeMeta && this.activeMeta.id === meta.id) {
          this.setActiveMeta(null);
        }
        this.callbacks.onSceneChanged();
      }
    });

    this.canvas.on("mouse:down", (event) => {
      const domEvent = event.e as MouseEvent;
      if (this.ruler.enabled && domEvent.button === 0 && !this.panState.keyActive) {
        const pointer = this.canvas.getPointer(domEvent);
        this.handleRulerClick(pointer);
        domEvent.preventDefault();
        domEvent.stopPropagation();
        return;
      }
      const isPanMouseButton = domEvent.button === 1 || domEvent.button === 2;
      if (this.panState.keyActive || isPanMouseButton) {
        this.startPan(domEvent);
        domEvent.preventDefault();
        domEvent.stopPropagation();
      }
    });

    this.canvas.on("mouse:move", (event) => {
      const pointer = this.canvas.getPointer(event.e);
      this.handleRulerMove(pointer);
      if (!this.panState.isDragging) return;
      const domEvent = event.e as MouseEvent;
      this.continuePan(domEvent);
      domEvent.preventDefault();
      domEvent.stopPropagation();
    });

    this.canvas.on("mouse:up", () => this.endPanInteraction());
    this.canvas.on("mouse:out", () => this.endPanInteraction());

    this.canvas.on("mouse:wheel", (event) => {
      const wheel = event.e as WheelEvent;
      const delta = wheel.deltaY;
      if (!delta) return;
      const pointer = this.canvas.getPointer(wheel);
      const currentZoom = this.canvas.getZoom();
      const nextZoom = delta > 0 ? currentZoom * (1 - ZOOM_STEP) : currentZoom * (1 + ZOOM_STEP);
      this.applyZoom(nextZoom, { x: pointer.x, y: pointer.y });
      wheel.preventDefault();
      wheel.stopPropagation();
    });
  }

  private drawOriginGuides(): void {
    const origin = this.getGridOrigin();
    const vertical = new fabric.Line([origin.x, 0, origin.x, this.canvasHeight], {
      stroke: "#90a4ae",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    const horizontal = new fabric.Line([0, origin.y, this.canvasWidth, origin.y], {
      stroke: "#90a4ae",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    this.canvas.add(vertical);
    this.canvas.add(horizontal);
    vertical.sendToBack();
    horizontal.sendToBack();
  }

  /* Import / Export (XML) */

  async importXmlFromText(xmlText: string): Promise<string[]> {
    if (!xmlText) return [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      alert("Could not parse XML file. Please check the file contents.");
      return [];
    }

    const shouldClear =
      this.placedObjects.length === 0 || confirm("Importing will replace the current scene. Continue?");
    if (!shouldClear) return [];

    this.clearScene();
    const checkpointOrder = this.parseCheckpointOrder(doc, xmlText);

    const commentNodes = Array.from(doc.childNodes).filter(
      (node) => node.nodeType === Node.COMMENT_NODE
    ) as Comment[];
    const globalMeta = commentNodes
      .map((node) => parseEditorMeta(node.nodeValue || "") as Record<string, number> | null)
      .find((meta) => meta && meta.scope === ("global" as unknown as number));

    const globalOffsetX = Number.isFinite(globalMeta?.globalOffsetX)
      ? (globalMeta?.globalOffsetX as number)
      : 0;
    const globalOffsetY = Number.isFinite(globalMeta?.globalOffsetY)
      ? (globalMeta?.globalOffsetY as number)
      : 0;
    const globalRotation = Number.isFinite(globalMeta?.globalRotation)
      ? (globalMeta?.globalRotation as number)
      : 0;

    this.settings.globalOffsetX = globalOffsetX;
    this.settings.globalOffsetY = globalOffsetY;
    this.settings.globalRotation = globalRotation;

    const transformNodes = Array.from(doc.querySelectorAll("Transform")).filter((node) =>
      node.querySelector(":scope > Entity")
    );

    const compositeSeen = new Set<string>();
    const stackSeen = new Set<string>();
    const importMetaById = new Map<string, PlacedObjectMeta>();

    for (const transform of transformNodes) {
      const entity = transform.querySelector(":scope > Entity");
      if (!entity) continue;

      /** Skip the wrapper <Entity name="Track"> and make sure its not placeable i.e spawning random crap */
      if (entity.getAttribute("name") === "Track") continue;

      let meta: Record<string, unknown> | null = null;
      let prevNode = transform.previousSibling;
      while (
        prevNode &&
        prevNode.nodeType === Node.TEXT_NODE &&
        !prevNode.nodeValue?.trim()
      ) {
        prevNode = prevNode.previousSibling;
      }
      if (prevNode && prevNode.nodeType === Node.COMMENT_NODE) {
        meta = parseEditorMeta(prevNode.nodeValue || "");
      }

      const compositeGroupId = meta?.compositeGroupId as string | undefined;
      if (compositeGroupId) {
        if (compositeSeen.has(compositeGroupId)) continue;
        compositeSeen.add(compositeGroupId);
      }

      const stackGroupId = meta?.stackGroupId as string | undefined;
      if (stackGroupId) {
        if (stackSeen.has(stackGroupId)) continue;
        stackSeen.add(stackGroupId);
      }

      const finalX = Number.parseFloat(transform.getAttribute("x") || "0");
      const finalY = Number.parseFloat(transform.getAttribute("y") || "0");
      const altitude = Number.parseFloat(transform.getAttribute("z") || "0");
      const angleDegrees = Number.parseFloat(transform.getAttribute("angleDegrees") || "0");

      const { forward, lateral } = invertGlobalTransform(
        finalX,
        finalY,
        globalOffsetX,
        globalOffsetY,
        globalRotation
      );

      let typeConfig: ObjectConfig | null = null;
      let importFlagSensing: "left" | "right" | null = null;
      let importChampsColor: Champs25GateColor | undefined;
      const typeId = meta?.typeId as string | undefined;
      if (typeId) {
        const n = normalizeCatalogTypeId(typeId);
        typeConfig = OBJECT_LOOKUP[n.typeId] || null;
        if (n.legacySensingSide) importFlagSensing = n.legacySensingSide;
        if (n.legacyChampsGateColor) importChampsColor = n.legacyChampsGateColor;
      }

      if (!typeConfig) {
        const instance = entity.querySelector("Instance");
        const include = entity.querySelector("Include");
        const macroName = instance?.getAttribute("macro");
        const includeFile = include?.getAttribute("file");
        const chFromInstance = macroName ? champs25ColorFromMacroName(macroName) : null;
        if (chFromInstance) {
          typeConfig = OBJECT_LOOKUP["champs-25-gate"];
          importChampsColor = chFromInstance;
        }
        if (!typeConfig) {
          typeConfig =
            OBJECT_CATALOG.find((entry) => entry.macroName === macroName) ||
            OBJECT_CATALOG.find((entry) => entry.includeFile === includeFile) ||
            null;
        }
        if (!typeConfig && includeFile) {
          if (includeFile.includes("FlagPassLeft")) {
            typeConfig = OBJECT_LOOKUP["flag"];
            importFlagSensing = "left";
          } else if (includeFile.includes("FlagPassRight")) {
            typeConfig = OBJECT_LOOKUP["flag"];
            importFlagSensing = "right";
          } else if (includeFile.includes("Gates/Champs25Gate.xml")) {
            typeConfig = OBJECT_LOOKUP["champs-25-gate"];
            importChampsColor = importChampsColor ?? "red";
          }
        }
      }

      if (!typeConfig) {
        console.warn("Skipping unknown object in import:", entity.getAttribute("name"));
        continue;
      }

      const rawEntityName =
        (meta?.entityName as string | undefined) || entity.getAttribute("name") || "";
      const entityName = rawEntityName === "Track" ? "" : rawEntityName;

      const position: Position = {
        x: lateral,
        y: forward,
        angle: normalizeEditorAngle(angleDegrees - globalRotation - 90),
        altitude,
      };

      const metaChamps = meta?.champsGateColor as Champs25GateColor | undefined;
      const importedMeta = await this.addObjectFromImport(typeConfig, position, {
        id: meta?.id as string | undefined,
        entityName,
        attachedTo: meta?.attachedTo as string | null,
        attachmentSide: meta?.attachmentSide as "left" | "right" | null,
        attachedLevel: meta?.attachedLevel as number | null,
        attachedCubeTo: meta?.attachedCubeTo as string | null,
        attachedCubeCorner: meta?.attachedCubeCorner as string | null,
        stackCount: meta?.stackCount as number | undefined,
        sensingSide: meta?.sensingSide as "left" | "right" | null,
        sensingFacing: meta?.sensingFacing as "front" | "back" | null,
        importFlagSensing,
        champsGateColor:
          typeConfig.id === "champs-25-gate"
            ? metaChamps ?? importChampsColor ?? "red"
            : undefined,
      });

      const metaId = meta?.id as string | undefined;
      if (metaId && importedMeta) {
        importMetaById.set(metaId, importedMeta);
      }
    }

    this.placedObjects.forEach((entry) => {
      if (entry.attachedTo) {
        const target = importMetaById.get(entry.attachedTo);
        if (!target) {
          entry.attachedTo = null;
          entry.attachmentSide = null;
          entry.attachedLevel = null;
        } else {
          entry.attachedTo = target.id;
        }
      }
      if (entry.attachedCubeTo) {
        const cubeTarget = importMetaById.get(entry.attachedCubeTo);
        if (!cubeTarget) {
          entry.attachedCubeTo = null;
          entry.attachedCubeCorner = null;
        } else {
          entry.attachedCubeTo = cubeTarget.id;
        }
      }
      if (entry.attachedTo || entry.attachedCubeTo) {
        this.updateAttachedPolePosition(entry);
      }
    });

    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
    return checkpointOrder;
  }

  private parseCheckpointOrder(doc: Document, xmlText: string): string[] {
    const rawText =
      doc?.querySelector("CheckpointList")?.textContent ||
      (typeof xmlText === "string"
        ? (xmlText.match(/<CheckpointList>[\s\S]*?<\/CheckpointList>/i) || [])[0] || ""
        : "");
    if (!rawText) return [];
    const checkpointsBlock = rawText.match(/checkpoints\s*:\s*\[([\s\S]*?)\]/i);
    if (!checkpointsBlock) return [];
    const result: string[] = [];
    const pattern = /"([^"]+)"|'([^']+)'/g;
    let match = pattern.exec(checkpointsBlock[1]);
    while (match) {
      result.push(match[1] || match[2]);
      match = pattern.exec(checkpointsBlock[1]);
    }
    return result;
  }

  private updateEntityCounterFromName(name: string): void {
    if (!name || name === "Track") return;
    const match = name.match(/^(.*?)(\d+)$/);
    if (!match) return;
    const [, prefix, numberText] = match;
    const number = Number.parseInt(numberText, 10);
    if (!Number.isFinite(number)) return;
    this.entityCounters[prefix] = Math.max(this.entityCounters[prefix] || 0, number);
  }

  private async addObjectFromImport(
    config: ObjectConfig,
    position: Position,
    meta: {
      id?: string;
      entityName: string;
      attachedTo?: string | null;
      attachmentSide?: "left" | "right" | null;
      attachedLevel?: number | null;
      attachedCubeTo?: string | null;
      attachedCubeCorner?: string | null;
      stackCount?: number;
      sensingSide?: "left" | "right" | null;
      sensingFacing?: "front" | "back" | null;
      /** From old type id or Include path when importing unified `flag`. */
      importFlagSensing?: "left" | "right" | null;
      champsGateColor?: Champs25GateColor;
    }
  ): Promise<PlacedObjectMeta> {
    const fabricObject = await this.createFabricObject(config);
    fabricObject.data = { typeId: config.id };
    this.applyVisualDefaults(fabricObject, config);
    this.placeObjectAt(fabricObject, position);
    fabricObject.setCoords();
    this.canvas.add(fabricObject);

    const safeEntityName =
      meta.entityName && meta.entityName !== "Track"
        ? meta.entityName
        : this.allocateEntityName(config.entityPrefix);
    const hasSensing = !!(config.sensingLineMeters && config.sensingLineMeters > 0);
    const isFlag = getPassageTarget(config) === "flag";
    const metadata: PlacedObjectMeta = {
      id: meta.id || createUniqueId(),
      config,
      fabricObject,
      entityName: safeEntityName,
      altitude: Number.isFinite(position.altitude)
        ? (position.altitude as number)
        : config.altitude ?? 0,
      attachedTo: meta.attachedTo ?? null,
      attachmentSide: meta.attachmentSide ?? null,
      attachedLevel: meta.attachedLevel ?? null,
      attachedCubeTo: meta.attachedCubeTo ?? null,
      attachedCubeCorner: meta.attachedCubeCorner ?? null,
      stackCount: meta.stackCount,
      sensingSide: hasSensing
        ? meta.sensingSide === "left" || meta.sensingSide === "right"
          ? meta.sensingSide
          : isFlag &&
              (meta.importFlagSensing === "left" || meta.importFlagSensing === "right")
            ? meta.importFlagSensing
            : this.initialSensingSideForConfig(config)
        : null,
      sensingFacing:
        hasSensing && isFlag
          ? meta.sensingFacing === "back" || meta.sensingFacing === "front"
            ? meta.sensingFacing
            : "front"
          : null,
      champsGateColor:
        config.id === "champs-25-gate"
          ? meta.champsGateColor ?? "red"
          : undefined,
    };
    this.updateEntityCounterFromName(metadata.entityName);
    this.placedObjects.push(metadata);
    this.metaByObjectId.set(fabricObject, metadata);
    if (hasSensing) {
      this.applySensingSideVisibility(metadata);
    }
    this.updateObjectMetadata(fabricObject);
    return metadata;
  }

  /**
   * Collects half-plane passage sensors. Structured `polePassage` / `flagPassage`
   * entries get per-capture angle (and for flags, `facing`); legacy plain entity
   * name strings get N copies at the current `sensingSide` / `sensingFacing`.
   */
  private collectPassageSensors(
    entry: PlacedObjectMeta,
    checkpointOrder: CheckpointOrderEntry[]
  ): {
    subEntityName: string;
    relativeAngleDeg: number;
    side: "left" | "right";
    zMeters: number;
    facing: "front" | "back";
  }[] {
    const hasSensing = !!(entry.config.sensingLineMeters && entry.config.sensingLineMeters > 0);
    if (!hasSensing) return [];
    const fabricAngle = entry.fabricObject.angle ?? 0;
    const gNow = this.settings.globalRotation || 0;
    const target = getPassageTarget(entry.config);

    if (target === "flag") {
      const structured = checkpointOrder.filter(
        (c): c is FlagPassageCheckpoint =>
          isFlagPassageCheckpoint(c) && c.objectId === entry.id
      );
      if (structured.length > 0) {
        return structured.map((p) => {
          const gAdd = p.globalRotationAtAdd !== undefined ? p.globalRotationAtAdd : gNow;
          const relativeAngleDeg = normalizeEditorAngle(
            p.angleDeg - fabricAngle + (gAdd - gNow)
          );
          return {
            subEntityName: flagPassageExportName(p),
            relativeAngleDeg,
            side: p.side,
            zMeters: FLAG_SENSOR_Z_METERS,
            facing: p.facing,
          };
        });
      }
      const legacyCount = checkpointOrder.filter(
        (c) => typeof c === "string" && c.trim() === entry.entityName
      ).length;
      if (legacyCount === 0) return [];
      const side: "left" | "right" = entry.sensingSide === "left" ? "left" : "right";
      const facing: "front" | "back" = entry.sensingFacing === "back" ? "back" : "front";
      return Array.from({ length: legacyCount }, (_, i) => ({
        subEntityName: `${entry.entityName}_pass_legacy_${i}`,
        relativeAngleDeg: 0,
        side,
        zMeters: FLAG_SENSOR_Z_METERS,
        facing,
      }));
    }

    const structured = checkpointOrder.filter(
      (c): c is PolePassageCheckpoint => isPolePassageCheckpoint(c) && c.objectId === entry.id
    );
    if (structured.length > 0) {
      return structured.map((p) => {
        const gAdd = p.globalRotationAtAdd !== undefined ? p.globalRotationAtAdd : gNow;
        const relativeAngleDeg = normalizeEditorAngle(
          p.angleDeg - fabricAngle + (gAdd - gNow)
        );
        return {
          subEntityName: polePassageExportName(p),
          relativeAngleDeg,
          side: p.side,
          zMeters: POLE_SENSOR_Z_METERS,
          facing: "front" as const,
        };
      });
    }
    const legacyCount = checkpointOrder.filter(
      (c) => typeof c === "string" && c.trim() === entry.entityName
    ).length;
    if (legacyCount === 0) return [];
    const side: "left" | "right" = entry.sensingSide === "left" ? "left" : "right";
    return Array.from({ length: legacyCount }, (_, i) => ({
      subEntityName: `${entry.entityName}_pass_legacy_${i}`,
      relativeAngleDeg: 0,
      side,
      zMeters: POLE_SENSOR_Z_METERS,
      facing: "front" as const,
    }));
  }

  private buildPassageSensorEntityLines(
    subEntityName: string,
    relativeAngleDeg: number,
    side: "left" | "right",
    zMeters: number,
    facing: "front" | "back"
  ): string[] {
    const sensorIncludePath =
      side === "left"
        ? "/Data/Simulations/Multirotor/HalfPlanePassageLeft.xml"
        : "/Data/Simulations/Multirotor/HalfPlanePassageRight.xml";
    const angleDeg = normalizeEditorAngle(
      relativeAngleDeg + (facing === "back" ? 180 : 0)
    );
    return [
      `        <Entity name="${subEntityName}">`,
      `          <Transform z="${zMeters.toFixed(2)}" angleDegrees="${angleDeg.toFixed(1)}">`,
      `            <Include file="${sensorIncludePath}"/>`,
      `          </Transform>`,
      `        </Entity>`,
    ];
  }

  exportXml(checkpointOrder: CheckpointOrderEntry[]): void {
    const offsetForward = this.settings.globalOffsetX || 0;
    const offsetLateral = this.settings.globalOffsetY || 0;
    const globalRotationDegrees = this.settings.globalRotation || 0;
    const rotationRad = (globalRotationDegrees * Math.PI) / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);

    const lines: string[] = [];
    lines.push("<Simulation>");
    lines.push(
      buildEditorMeta({
        scope: "global",
        globalOffsetX: offsetForward,
        globalOffsetY: offsetLateral,
        globalRotation: globalRotationDegrees,
      })
    );
    lines.push('  <Include file="/Data/Simulations/Multirotor/Locations/BaylandsPark.xml"/>');
    lines.push('  <Include file="/Data/Simulations/Multirotor/DroneTrackInstanceGroups.xml"/>');
    lines.push('  <Include file="/Data/Simulations/Multirotor/Gates/PoleGates.xml"/>');
    lines.push("");
    CENTERED_GATE_MACROS.forEach((line) => lines.push(line));
    lines.push("");
    CANOPY_EXPORT_BLOCK.forEach((line) => lines.push(line));
    lines.push("");
    lines.push('  <Transform x="30" y="-60">');
    lines.push('    <Entity name="Track">');
    lines.push('      <Transform x="0" y="0" rz="-1" angleDegrees="0">');
    lines.push("        <Transform>");
    lines.push('          <Include file="/Data/Simulations/Multirotor/7x7Mat.xml"/>');
    lines.push("        </Transform>");
    lines.push('        <Transform z=".025" rz="-1" angleDegrees="90">');
    lines.push(
      '          <Include file="/Data/Simulations/Multirotor/LaunchStands/MetalLaunchStand.xml"/>'
    );
    lines.push("        </Transform>");
    lines.push("      </Transform>");
    if (this.placedObjects.length > 0) lines.push("");

    this.placedObjects.forEach((entry) => {
      const object = entry.fabricObject;
      const pos = this.getObjectPositionMeters(object);
      const forward = pos.y;
      const lateral = pos.x;
      const rotatedForward = forward * cosR - lateral * sinR;
      const rotatedLateral = forward * sinR + lateral * cosR;
      const finalX = rotatedForward + offsetForward;
      const finalY = -rotatedLateral + offsetLateral;
      const finalAngle = normalizeAngle((object.angle ?? 0) + globalRotationDegrees + 90);
      const altitude = entry.altitude || 0;
      const editorMeta = {
        typeId: entry.config.id,
        id: entry.id,
        entityName: entry.entityName,
        attachedTo: entry.attachedTo || null,
        attachmentSide: entry.attachmentSide || null,
        attachedLevel: entry.attachedLevel || null,
        attachedCubeTo: entry.attachedCubeTo || null,
        attachedCubeCorner: entry.attachedCubeCorner || null,
        stackCount: entry.stackCount ?? null,
        sensingSide: entry.sensingSide ?? null,
        sensingFacing: getPassageTarget(entry.config) === "flag" ? entry.sensingFacing ?? null : null,
        ...(entry.config.id === "champs-25-gate"
          ? { champsGateColor: entry.champsGateColor ?? "red" }
          : {}),
      };

      const passageSensors = this.collectPassageSensors(entry, checkpointOrder);
      const passageSensorLines: string[] = [];
      for (const p of passageSensors) {
        passageSensorLines.push(
          ...this.buildPassageSensorEntityLines(
            p.subEntityName,
            p.relativeAngleDeg,
            p.side,
            p.zMeters,
            p.facing
          )
        );
      }
      const mainIncludeFile = resolveMainIncludeFile(entry.config, {
        sensingSide: entry.sensingSide,
      });

      const stackCount = getGateStackCount(entry);
      if (isStackableGateConfig(entry.config) && stackCount > 1) {
        const stackSpacing = getGateStackSpacing(entry);
        for (let i = 1; i <= stackCount; i += 1) {
          const stackAltitude = altitude + stackSpacing * (i - 1);
          const stackEntityName = i === 1 ? entry.entityName : `${entry.entityName}_stack${i}`;
          lines.push(
            buildEditorMeta({ ...editorMeta, stackGroupId: entry.id, stackIndex: i, stackCount })
          );
          lines.push(
            `      <Transform x="${finalX.toFixed(3)}" y="${finalY.toFixed(
              3
            )}" z="${stackAltitude.toFixed(3)}" angleDegrees="${finalAngle.toFixed(
              1
            )}" rz="-1">`
          );
          lines.push(`        <Entity name="${stackEntityName}">`);
          if (entry.config.placement === "macro") {
            const m = macroNameForPlacedExport(entry);
            if (m) {
              lines.push(`          <Instance macro="${m}"/>`);
            }
          } else {
            lines.push(`          <Include file="${mainIncludeFile}"/>`);
          }
          if (passageSensorLines.length > 0 && i === 1) {
            lines.push(...passageSensorLines);
          }
          lines.push("        </Entity>");
          lines.push("      </Transform>");
        }
        return;
      }

      if (entry.config.placement === "composite" && entry.config.compositeParts) {
        entry.config.compositeParts.forEach((part, index) => {
          const partAltitude = altitude + (part.altitude || 0);
          const partEntityName =
            index === 0 ? entry.entityName : `${entry.entityName}_${index + 1}`;
          lines.push(
            buildEditorMeta({
              ...editorMeta,
              compositeGroupId: entry.id,
              compositeIndex: index + 1,
              compositeCount: entry.config.compositeParts!.length,
            })
          );
          lines.push(
            `      <Transform x="${finalX.toFixed(3)}" y="${finalY.toFixed(
              3
            )}" z="${partAltitude.toFixed(3)}" angleDegrees="${finalAngle.toFixed(
              1
            )}" rz="-1">`
          );
          lines.push(`        <Entity name="${partEntityName}">`);
          if (part.macroName) {
            lines.push(`          <Instance macro="${part.macroName}"/>`);
          } else if (part.includeFile) {
            lines.push(`          <Include file="${part.includeFile}"/>`);
          }
          if (passageSensorLines.length > 0 && index === 0) {
            lines.push(...passageSensorLines);
          }
          lines.push("        </Entity>");
          lines.push("      </Transform>");
        });
      } else {
        lines.push(buildEditorMeta(editorMeta));
        lines.push(
          `      <Transform x="${finalX.toFixed(3)}" y="${finalY.toFixed(
            3
          )}" z="${altitude.toFixed(3)}" angleDegrees="${finalAngle.toFixed(1)}" rz="-1">`
        );
        lines.push(`        <Entity name="${entry.entityName}">`);
        if (entry.config.placement === "macro") {
          const m = macroNameForPlacedExport(entry);
          if (m) {
            lines.push(`          <Instance macro="${m}"/>`);
          }
        } else {
          lines.push(`          <Include file="${mainIncludeFile}"/>`);
        }
        if (passageSensorLines.length > 0) {
          lines.push(...passageSensorLines);
        }
        lines.push("        </Entity>");
        lines.push("      </Transform>");
      }
    });

    lines.push("      <CheckpointList>");
    lines.push("        {");
    lines.push("            isCircuit: true,");
    lines.push("            checkpoints:");
    lines.push("            [");
    if (Array.isArray(checkpointOrder) && checkpointOrder.length > 0) {
      const resolvedNames = resolveCheckpointExportNames(checkpointOrder, (entityName) => {
        const m = this.placedObjects.find((e) => e.entityName === entityName);
        if (!m) return undefined;
        return {
          id: m.id,
          hasSensing: !!(m.config.sensingLineMeters && m.config.sensingLineMeters > 0),
          passageTarget: getPassageTarget(m.config),
        };
      });
      resolvedNames.forEach((checkpoint, index) => {
        const suffix = index === resolvedNames.length - 1 ? "" : ",";
        lines.push(`                "${checkpoint}"${suffix}`);
      });
    }
    lines.push("            ]");
    lines.push("        }");
    lines.push("        </CheckpointList>");
    lines.push("    </Entity>");
    lines.push("  </Transform>");
    lines.push("</Simulation>");

    downloadText(lines.join("\n"), "track.xml");
  }

  /* Helpers exposed to React components */

  getGatesForAttachment(): PlacedObjectMeta[] {
    return this.placedObjects.filter(
      (entry) => isGateConfig(entry.config) && !isHurdleConfig(entry.config)
    );
  }

  getCubesForAttachment(): PlacedObjectMeta[] {
    return this.placedObjects.filter((entry) => isCubeConfig(entry.config));
  }

 
  /* Multi-select bulk actions and alignment guides */
  

  private alignmentGuideLines: fabric.Line[] = [];

  private clearAlignmentGuides(): void {
    if (this.alignmentGuideLines.length === 0) return;
    for (const line of this.alignmentGuideLines) {
      this.canvas.remove(line);
    }
    this.alignmentGuideLines = [];
  }

  /**
   * Draws temporary green guide lines whenever a moving object's center or
   * edges line up with another placed object within a small pixel threshold.
   * Snaps the moving object's position to the matched line.
   */
  private computeAndDrawAlignmentGuides(target: fabric.Object): void {
    this.clearAlignmentGuides();
    if (!this.metaByObjectId.has(target)) return;

    const TOL = 6;
    const tBounds = target.getBoundingRect(true, true);
    const targetCenters = {
      x: tBounds.left + tBounds.width / 2,
      y: tBounds.top + tBounds.height / 2,
    };
    const targetEdges = {
      left: tBounds.left,
      right: tBounds.left + tBounds.width,
      top: tBounds.top,
      bottom: tBounds.top + tBounds.height,
    };

    let snapDx = 0;
    let snapDy = 0;
    const verticalLines = new Set<number>();
    const horizontalLines = new Set<number>();

    for (const meta of this.placedObjects) {
      if (meta.fabricObject === target) continue;
      const b = meta.fabricObject.getBoundingRect(true, true);
      const centers = { x: b.left + b.width / 2, y: b.top + b.height / 2 };
      const edges = {
        left: b.left,
        right: b.left + b.width,
        top: b.top,
        bottom: b.top + b.height,
      };

      const xCandidates = [
        { theirs: centers.x, ours: targetCenters.x },
        { theirs: edges.left, ours: targetEdges.left },
        { theirs: edges.right, ours: targetEdges.right },
        { theirs: edges.left, ours: targetEdges.right },
        { theirs: edges.right, ours: targetEdges.left },
      ];
      for (const { theirs, ours } of xCandidates) {
        if (Math.abs(theirs - ours) <= TOL) {
          if (snapDx === 0) snapDx = theirs - ours;
          verticalLines.add(theirs);
        }
      }

      const yCandidates = [
        { theirs: centers.y, ours: targetCenters.y },
        { theirs: edges.top, ours: targetEdges.top },
        { theirs: edges.bottom, ours: targetEdges.bottom },
        { theirs: edges.top, ours: targetEdges.bottom },
        { theirs: edges.bottom, ours: targetEdges.top },
      ];
      for (const { theirs, ours } of yCandidates) {
        if (Math.abs(theirs - ours) <= TOL) {
          if (snapDy === 0) snapDy = theirs - ours;
          horizontalLines.add(theirs);
        }
      }
    }

    if (snapDx !== 0 || snapDy !== 0) {
      target.set({
        left: (target.left ?? 0) + snapDx,
        top: (target.top ?? 0) + snapDy,
      });
      target.setCoords();
    }

    for (const x of verticalLines) {
      const line = new fabric.Line([x, 0, x, this.canvasHeight], {
        stroke: "rgba(245, 158, 11, 0.85)",
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as fabric.Object & { __isGuide?: boolean }).__isGuide = true;
      this.canvas.add(line);
      this.alignmentGuideLines.push(line);
    }
    for (const y of horizontalLines) {
      const line = new fabric.Line([0, y, this.canvasWidth, y], {
        stroke: "rgba(245, 158, 11, 0.85)",
        strokeWidth: 1,
        selectable: false,
        evented: false,
        excludeFromExport: true,
      });
      (line as fabric.Object & { __isGuide?: boolean }).__isGuide = true;
      this.canvas.add(line);
      this.alignmentGuideLines.push(line);
    }
  }

  private getActiveSelectionObjects(): fabric.Object[] {
    const active = this.canvas.getActiveObject();
    if (!active) return [];
    if (active.type === "activeSelection") {
      return ((active as unknown as { _objects: fabric.Object[] })._objects || []).slice();
    }
    return [active];
  }

  /** Aligns every selected object along the requested axis. */
  alignSelected(side: "left" | "right" | "top" | "bottom" | "centerH" | "centerV"): void {
    const items = this.getActiveSelectionObjects().filter((obj) => this.metaByObjectId.has(obj));
    if (items.length < 2) return;

    const bounds = items.map((obj) => ({ obj, b: obj.getBoundingRect(true, true) }));
    const lefts = bounds.map((x) => x.b.left);
    const rights = bounds.map((x) => x.b.left + x.b.width);
    const tops = bounds.map((x) => x.b.top);
    const bottoms = bounds.map((x) => x.b.top + x.b.height);

    let target = 0;
    switch (side) {
      case "left":
        target = Math.min(...lefts);
        break;
      case "right":
        target = Math.max(...rights);
        break;
      case "top":
        target = Math.min(...tops);
        break;
      case "bottom":
        target = Math.max(...bottoms);
        break;
      case "centerH":
        target = (Math.min(...lefts) + Math.max(...rights)) / 2;
        break;
      case "centerV":
        target = (Math.min(...tops) + Math.max(...bottoms)) / 2;
        break;
    }

    for (const { obj, b } of bounds) {
      const cx = b.left + b.width / 2;
      const cy = b.top + b.height / 2;
      let dx = 0;
      let dy = 0;
      switch (side) {
        case "left":
          dx = target - b.left;
          break;
        case "right":
          dx = target - (b.left + b.width);
          break;
        case "top":
          dy = target - b.top;
          break;
        case "bottom":
          dy = target - (b.top + b.height);
          break;
        case "centerH":
          dx = target - cx;
          break;
        case "centerV":
          dy = target - cy;
          break;
      }
      obj.set({ left: (obj.left ?? 0) + dx, top: (obj.top ?? 0) + dy });
      obj.setCoords();
      this.updateObjectMetadata(obj);
    }
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  /** Distributes selected objects evenly along the chosen axis. */
  distributeSelected(axis: "h" | "v"): void {
    const items = this.getActiveSelectionObjects().filter((obj) => this.metaByObjectId.has(obj));
    if (items.length < 3) return;
    const sorted = items
      .map((obj) => ({ obj, b: obj.getBoundingRect(true, true) }))
      .sort((a, b) => (axis === "h" ? a.b.left - b.b.left : a.b.top - b.b.top));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span =
      axis === "h"
        ? last.b.left + last.b.width / 2 - (first.b.left + first.b.width / 2)
        : last.b.top + last.b.height / 2 - (first.b.top + first.b.height / 2);
    const step = span / (sorted.length - 1);

    for (let i = 1; i < sorted.length - 1; i++) {
      const target =
        axis === "h"
          ? first.b.left + first.b.width / 2 + step * i
          : first.b.top + first.b.height / 2 + step * i;
      const { obj, b } = sorted[i];
      const center = axis === "h" ? b.left + b.width / 2 : b.top + b.height / 2;
      const delta = target - center;
      if (axis === "h") obj.set({ left: (obj.left ?? 0) + delta });
      else obj.set({ top: (obj.top ?? 0) + delta });
      obj.setCoords();
      this.updateObjectMetadata(obj);
    }
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
  }

  /** Duplicates every object in the active selection. */
  duplicateSelectedAll(): void {
    const items = this.getActiveSelectionObjects().filter((obj) => this.metaByObjectId.has(obj));
    if (items.length <= 1) {
      this.duplicateSelected();
      return;
    }
    this.canvas.discardActiveObject();
    const newObjects: fabric.Object[] = [];
    let pending = items.length;
    items.forEach((src) => {
      const meta = this.metaByObjectId.get(src);
      if (!meta) {
        if (--pending === 0) this.finalizeMultiDuplicate(newObjects);
        return;
      }
      src.clone((cloned: fabric.Object) => {
        this.canvas.add(cloned);
        cloned.data = { typeId: meta.config.id };
        const currentPos = this.getObjectPositionMeters(src);
        this.placeObjectAt(cloned, {
          x: currentPos.x + this.settings.gridSizeMeters,
          y: currentPos.y + this.settings.gridSizeMeters,
          angle: src.angle ?? 0,
        });
        cloned.setCoords();
        const newMeta: PlacedObjectMeta = {
          id: createUniqueId(),
          config: meta.config,
          fabricObject: cloned,
          entityName: this.allocateEntityName(meta.config.entityPrefix),
          altitude: meta.altitude,
          stackCount: meta.stackCount,
          sensingSide: meta.sensingSide ?? null,
          sensingFacing: meta.sensingFacing ?? null,
          champsGateColor: meta.champsGateColor,
        };
        this.applyVisualDefaults(cloned, meta.config);
        this.placedObjects.push(newMeta);
        this.metaByObjectId.set(cloned, newMeta);
        this.updateObjectMetadata(cloned);
        newObjects.push(cloned);
        if (--pending === 0) this.finalizeMultiDuplicate(newObjects);
      });
    });
  }

  private finalizeMultiDuplicate(newObjects: fabric.Object[]): void {
    if (newObjects.length === 0) return;
    if (newObjects.length === 1) {
      this.canvas.setActiveObject(newObjects[0]);
    } else {
      const sel = new fabric.ActiveSelection(newObjects, { canvas: this.canvas });
      this.canvas.setActiveObject(sel);
    }
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
    this.notifyMultiSelection();
  }

  /** Removes every object in the active selection. */
  deleteSelectedAll(): void {
    const items = this.getActiveSelectionObjects().filter((obj) => this.metaByObjectId.has(obj));
    if (items.length === 0) return;
    for (const obj of items) {
      const meta = this.metaByObjectId.get(obj);
      if (!meta) continue;
      this.canvas.remove(meta.fabricObject);
      this.metaByObjectId.delete(meta.fabricObject);
      this.placedObjects = this.placedObjects.filter((entry) => entry.id !== meta.id);
    }
    this.setActiveMeta(null);
    this.canvas.discardActiveObject();
    this.canvas.requestRenderAll();
    this.callbacks.onSceneChanged();
    this.callbacks.onMultiSelectionChanged?.(0);
  }
}
