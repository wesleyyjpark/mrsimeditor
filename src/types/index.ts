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
