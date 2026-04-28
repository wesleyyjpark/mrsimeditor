import type { fabric } from "fabric";

export type RenderStyle = "point" | "outline" | "rect" | "rectWithCenterLine";
export type Placement = "macro" | "include" | "composite";
export type PaletteCategory = "favorites" | "standard" | "champs";
export type CanvasView = "editor" | "gate-order";
export type RightSidebarTab = "none" | "misc";
export type MiscTab = "snapping" | "transform";
export type SelectedPanelTab = "properties" | "indicator";
export type IndicatorMode = "Entry" | "Exit" | "front" | "back";

export interface CompositePart {
  macroName?: string;
  includeFile?: string;
  altitude: number;
}

export interface ObjectConfig {
  id: string;
  label: string;
  entityPrefix: string;
  macroName?: string;
  includeFile?: string;
  width: number;
  height: number;
  footprintWidth?: number;
  footprintHeight?: number;
  visualWidth?: number;
  visualHeight?: number;
  altitude: number;
  attachHeightOffsetMeters?: number;
  cornerInsetMeters?: number;
  stackSpacingMeters?: number;
  color: string;
  fillColor?: string;
  placement: Placement;
  icon?: string;
  shape?: "circle" | "square";
  renderStyle?: RenderStyle;
  showDirectionArrow?: boolean;
  /**
   * Setting on `renderStyle: "point"` object which draws a thin line extruding from
   * the dot in the local +X direction with this length in meters. Indicates the
   * passage-sensing side of a pole (same as to `HalfPlanePassageLeft.xml` on
   * a flag); rotating the pole rotates the line, so it mirrors the sensor. At least in theory...
   */
  sensingLineMeters?: number;
  /**
   * When set to `"flag"`, passage checkpoints use the flag sensor height, optional
   * `flagPassage` list entries, and (when any passage is exported) `Flag.xml` for
   * the mesh instead of a precomposed FlagPassLeft/Right include.
   */
  passageTarget?: "pole" | "flag";
  paletteCategories?: PaletteCategory[];
  paletteCategory?: PaletteCategory;
  paletteHidden?: boolean;
  previewImage?: string;
  labelText?: string;
  anchorOffsetMeters?: number;
  shadow?: fabric.Shadow | null;
  compositeParts?: CompositePart[];
}

export interface Position {
  x: number;
  y: number;
  angle?: number;
  altitude?: number;
}

export interface PlacedObjectMeta {
  id: string;
  config: ObjectConfig;
  fabricObject: fabric.Object;
  entityName: string;
  altitude: number;
  attachedTo?: string | null;
  attachmentSide?: "left" | "right" | null;
  attachedLevel?: number | null;
  attachedCubeTo?: string | null;
  attachedCubeCorner?: string | null;
  stackCount?: number;
  /**
   * For poles with `sensingLineMeters > 0`: which side of the pole the passage
   * sensor lives on. The editor visual line points in local +X for "right" and
   * local -X for "left", and the export emits the matching
   * `HalfPlanePassage{Left,Right}.xml` include.
   */
  sensingSide?: "left" | "right" | null;
  /**
   * For flags with `passageTarget: "flag"`: which side of the half-plane is the
   * approach when adding legacy-style checkpoint strings (and default for new adds).
   */
  sensingFacing?: "front" | "back" | null;
  /**
   * For champs 25 gate, determines the macro to emit on export.
   */
  champsGateColor?: "red" | "green" | "blue" | "yellow" | "white" | null;
  position?: { x: number; y: number };
  angle?: number;
}

export interface ReferenceLayoutItem {
  typeId: string;
  x: number;
  y: number;
  angle: number;
  opacity?: number;
  includeInExport?: boolean;
}

export type IndicatorCheckpointStyle = "faceWithMode" | "segmentWithMode" | "entityOnly";

export interface IndicatorConfig {
  path: string;
  checkpointStyle: IndicatorCheckpointStyle;
  modeOptions?: IndicatorMode[];
  modeJoiner?: string;
  faceMap: Record<string, string>;
}

export type IndicatorConfigsMap = Record<string, IndicatorConfig>;
