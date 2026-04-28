import type { ObjectConfig } from "../types";
import {
  CUBE_ICON,
  DOUBLE_CUBE_ICON,
  FLAG_ICON,
  GATE_ICON,
  GENERIC_ICON,
  QUAD_LADDER_ICON,
} from "./icons";

/** Plan-view gate strip: same proportions as 5x5 (visual 2.4×2.1 m on 2.1×0.2 m footprint). */
export const GATE_PLAN_VISUAL_H_M = 2.1;
export const gatePlanVisualWidthM = (footprintWidthM: number) => footprintWidthM * (2.4 / 2.1);

export type Champs25GateColor = "red" | "green" | "blue" | "yellow" | "white";

const CHAMPS25_COLOR_TO_MACRO: Record<Champs25GateColor, string> = {
  red: "Champs25GateRed",
  green: "Champs25GateGreen",
  blue: "Champs25GateBlue",
  yellow: "Champs25GateYellow",
  white: "Champs25GateWhite",
};

export function champs25MacroNameForColor(color: Champs25GateColor | null | undefined): string {
  const c = color && CHAMPS25_COLOR_TO_MACRO[color] ? color : "red";
  return CHAMPS25_COLOR_TO_MACRO[c];
}

export function champs25ColorFromMacroName(macro: string): Champs25GateColor | null {
  const e = Object.entries(CHAMPS25_COLOR_TO_MACRO).find(([, m]) => m === macro);
  return e ? (e[0] as Champs25GateColor) : null;
}

/**
 * Which Instance macro to emit for a placed object (Champs25 uses meta, not `config.macroName`).
 */
export function macroNameForPlacedExport(entry: {
  config: ObjectConfig;
  champsGateColor?: Champs25GateColor | null;
}): string | undefined {
  if (entry.config.id === "champs-25-gate") {
    return champs25MacroNameForColor(entry.champsGateColor);
  }
  return entry.config.macroName;
}

/**
 * Real sim span along the gate line (m). Editor may use a smaller
 * `footprintWidth` for drawing; `width` holds the true course size.
 */
export function gateLogicalSpanMeters(config: ObjectConfig): number {
  return config.width ?? config.footprintWidth ?? 2.1;
}

export const OBJECT_CATALOG: ObjectConfig[] = [
  {
    id: "start-finish-5x5",
    label: "5x5 Start/Finish Gate",
    entityPrefix: "trkGate",
    macroName: "Centered5x5StartFinishGate",
    width: 2.1,
    height: 2.1,
    footprintWidth: 2.1,
    footprintHeight: 0.2,
    stackSpacingMeters: 1.8,
    visualWidth: 2.1,
    visualHeight: 2.1,
    altitude: 0,
    color: "#ff7043",
    placement: "macro",
    renderStyle: "outline",
    paletteCategories: ["standard"],
    previewImage: "assets/gate-image.png",
  },
  {
    id: "gate-5x5",
    label: "5x5 Gate",
    entityPrefix: "trkGate",
    macroName: "Centered5x5Gate",
    width: 2.1,
    height: 2.1,
    footprintWidth: 2.1,
    footprintHeight: 0.2,
    stackSpacingMeters: 1.8,
    visualWidth: 2.4,
    visualHeight: 2.1,
    altitude: 0,
    color: "#42a5f5",
    placement: "macro",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/gate-image.png",
  },
  {
    id: "champs-25-gate",
    label: "Champs25 Gate",
    entityPrefix: "trkGate",
    width: 25,
    height: 25,
    /** Editor canvas only — same as 5×5 gate bar; `width` is the real 25m span for export. */
    footprintWidth: 2.5,
    footprintHeight: 0.4,
    visualWidth: 2.4,
    visualHeight: 2.1,
    altitude: 0,
    color: "#1e88e5",
    placement: "macro",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["champs"],
  },
  {
    id: "champs-25-pole",
    label: "Champs25Pole",
    entityPrefix: "trkPole",
    includeFile: "/Data/Simulations/Multirotor/Gates/Champs25Pole.xml",
    width: 2,
    height: 4,
    footprintWidth: 2,
    footprintHeight: 2,
    altitude: 0,
    color: "#64b5f6",
    placement: "include",
    icon: FLAG_ICON,
    renderStyle: "point",
    sensingLineMeters: 1.5,
    anchorOffsetMeters: 0,
    paletteCategories: ["champs"],
    showDirectionArrow: false,
  },
  {
    id: "hurdle-7x16",
    label: "7x16Hurdle",
    entityPrefix: "trkHurdle",
    includeFile: "/Data/Simulations/Multirotor/7x16Hurdle.xml",
    width: 7,
    height: 16,
    footprintWidth: 16,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(16),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#ffb74d",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "outline",
    paletteCategories: ["standard", "champs"],
    showDirectionArrow: false,
  },
  {
    id: "hurdle-5x10",
    label: "5x10Hurdle",
    entityPrefix: "trkHurdle",
    includeFile: "/Data/Simulations/Multirotor/5x10Hurdle.xml",
    width: 5,
    height: 10,
    footprintWidth: 10,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(10),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#ffcc80",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "outline",
    paletteCategories: ["standard"],
    showDirectionArrow: false,
  },
  {
    id: "hurdle-4x7",
    label: "4x7Hurdle",
    entityPrefix: "trkHurdle",
    includeFile: "/Data/Simulations/Multirotor/4x7Hurdle.xml",
    width: 4,
    height: 7,
    footprintWidth: 7,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(7),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#ffe0b2",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "outline",
    paletteCategories: ["standard", "champs"],
    showDirectionArrow: false,
  },
  {
    id: "gate-7x6",
    label: "7x6 Gate",
    entityPrefix: "trkGate",
    macroName: "Centered7x6Gate",
    /** For import layouts that omit Instance/macro matching. Same model as centered 5×5 macros. */
    includeFile: "/Data/Simulations/Multirotor/7x6Gate.xml",
    width: 7,
    height: 6,
    /** Plan footprint matches 7 m course span (avoid a thin strip vs other gates). */
    footprintWidth: 7,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(7),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#26a69a",
    placement: "macro",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["champs"],
  },
  {
    id: "start-finish-7x6",
    label: "7x6 Start/Finish Gate",
    entityPrefix: "trkGate",
    macroName: "Centered7x6StartFinishGate",
    includeFile: "/Data/Simulations/Multirotor/7x6StartFinishGate.xml",
    width: 7,
    height: 6,
    footprintWidth: 7,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(7),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#42a5f5",
    placement: "macro",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["champs"],
  },
  {
    id: "dive-box-7x7",
    label: "7x7DiveBox",
    entityPrefix: "trkDive",
    includeFile: "/Data/Simulations/Multirotor/7x7DiveBox.xml",
    width: 2.1,
    height: 2.1,
    footprintWidth: 2.1,
    footprintHeight: 2.1,
    visualWidth: gatePlanVisualWidthM(2.1),
    visualHeight: gatePlanVisualWidthM(2.1),
    altitude: 0,
    color: "#26c6da",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "rect",
    paletteCategories: ["champs"],
  },
  {
    id: "dive-box-corner-7x7",
    label: "7x7DiveBoxCorner",
    entityPrefix: "trkDive",
    includeFile: "/Data/Simulations/Multirotor/7x7DiveBoxCorner.xml",
    width: 2.1,
    height: 2.1,
    footprintWidth: 2.1,
    footprintHeight: 2.1,
    visualWidth: gatePlanVisualWidthM(2.1),
    visualHeight: gatePlanVisualWidthM(2.1),
    altitude: 0,
    color: "#4dd0e1",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "rect",
    paletteCategories: ["champs"],
  },
  {
    id: "dive-gate-7x7",
    label: "7x7DiveGate",
    entityPrefix: "trkDive",
    includeFile: "/Data/Simulations/Multirotor/7x7DiveGate.xml",
    width: 7,
    height: 7,
    footprintWidth: 7,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(7),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#80deea",
    placement: "include",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["champs"],
  },
  {
    id: "tower-7x6",
    label: "7x6Tower",
    entityPrefix: "trkTower",
    includeFile: "/Data/Simulations/Multirotor/7x6Tower.xml",
    width: 2.1,
    height: 2.1,
    footprintWidth: 2.1,
    footprintHeight: 2.1,
    visualWidth: gatePlanVisualWidthM(2.1),
    visualHeight: gatePlanVisualWidthM(2.1),
    altitude: 0,
    color: "#8d6e63",
    placement: "include",
    icon: GENERIC_ICON,
    renderStyle: "rect",
    paletteCategories: ["champs"],
  },
  {
    id: "climb-gate-7x7",
    label: "7x7ClimbGate",
    entityPrefix: "trkGate",
    includeFile: "/Data/Simulations/Multirotor/7x7ClimbGate.xml",
    width: 7,
    height: 7,
    footprintWidth: 7,
    footprintHeight: 0.2,
    visualWidth: gatePlanVisualWidthM(7),
    visualHeight: GATE_PLAN_VISUAL_H_M,
    altitude: 0,
    color: "#26a69a",
    placement: "include",
    icon: GATE_ICON,
    renderStyle: "outline",
    paletteCategories: ["champs"],
  },
  {
    id: "flag",
    label: "Flag",
    entityPrefix: "trkFlag",
    includeFile: "/Data/Simulations/Multirotor/FlagPassRight.xml",
    width: 2,
    height: 2,
    altitude: 0,
    color: "#8e6abf",
    placement: "include",
    icon: FLAG_ICON,
    renderStyle: "point",
    /** Shorter than pole: reads as flag span, not a full gate width. */
    sensingLineMeters: 0.5,
    passageTarget: "flag",
    paletteCategories: ["favorites"],
    previewImage: "",
    showDirectionArrow: false,
  },
  {
    id: "pipe-double-cube",
    label: "Pipe Double Cube",
    entityPrefix: "trkCube",
    macroName: "PipeDoubleCube",
    width: 2.1,
    height: 2.1,
    visualWidth: 2,
    visualHeight: 4,
    altitude: 0,
    color: "#ffca28",
    placement: "macro",
    icon: DOUBLE_CUBE_ICON,
    anchorOffsetMeters: 0,
    renderStyle: "rect",
    labelText: "2",
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/double-cube-image.png",
  },
  {
    id: "pipe-cube",
    label: "Pipe Cube",
    entityPrefix: "trkCube",
    macroName: "PipeCube",
    width: 2.1,
    height: 2.1,
    visualWidth: 2,
    visualHeight: 4,
    altitude: 0,
    color: "#fdd835",
    placement: "macro",
    icon: CUBE_ICON,
    anchorOffsetMeters: 0,
    renderStyle: "rect",
    labelText: "1",
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/cube-image.png",
  },
  {
    id: "pipe-ladder",
    label: "Pipe Ladder",
    entityPrefix: "trkLadder",
    macroName: "PipeLadder",
    width: 2.1,
    height: 2.1,
    visualWidth: 2,
    visualHeight: 4,
    altitude: 0,
    color: "#ef5350",
    placement: "macro",
    icon: QUAD_LADDER_ICON,
    anchorOffsetMeters: 0,
    renderStyle: "rectWithCenterLine",
    labelText: "2",
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/ladder-image.png",
  },
  {
    id: "pipe-quadruple-ladder",
    label: "Pipe Quadruple Ladder",
    entityPrefix: "trkLadder",
    macroName: "PipeQuadrupleLadder",
    width: 2.1,
    height: 2.1,
    visualWidth: 2,
    visualHeight: 4,
    altitude: 0,
    color: "#d32f2f",
    placement: "macro",
    icon: QUAD_LADDER_ICON,
    anchorOffsetMeters: 0,
    renderStyle: "rectWithCenterLine",
    labelText: "4",
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/quad.png",
  },
  {
    id: "padded-pole",
    label: "Padded Pole",
    entityPrefix: "trkPole",
    macroName: "PaddedPole",
    width: 2,
    height: 4,
    altitude: 0,
    attachHeightOffsetMeters: 0.3,
    color: "#66bb6a",
    placement: "macro",
    icon: FLAG_ICON,
    anchorOffsetMeters: 0,
    cornerInsetMeters: 0.092,
    renderStyle: "point",
    sensingLineMeters: 1.5,
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/pole-image.png",
    showDirectionArrow: false,
  },
  {
    id: "pipe-flag",
    label: "Pipe Flag",
    entityPrefix: "trkFlag",
    macroName: "PaddedPole",
    width: 2,
    height: 4,
    altitude: 0,
    color: "#4caf50",
    placement: "composite",
    icon: FLAG_ICON,
    anchorOffsetMeters: 0,
    renderStyle: "point",
    sensingLineMeters: 1.5,
    paletteCategories: ["favorites", "standard"],
    previewImage: "assets/pole-image.png",
    compositeParts: [
      { macroName: "PaddedPole", altitude: 0 },
      { macroName: "PaddedPole", altitude: 2 },
    ],
    showDirectionArrow: false,
  },
  {
    id: "shade-canopy",
    label: "Shade Canopy",
    entityPrefix: "trkShade",
    includeFile: "/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml",
    width: 6,
    height: 6,
    altitude: 0,
    color: "#8d6e63",
    placement: "include",
    shape: "square",
    fillColor: "#8d6e63",
    paletteHidden: true,
  },
  {
    id: "metal-launch-stand",
    label: "Metal Launch Stand",
    entityPrefix: "trkLaunch",
    includeFile: "/Data/Simulations/Multirotor/LaunchStands/MetalLaunchStand.xml",
    width: 1.5,
    height: 1.5,
    altitude: 0,
    color: "#78909c",
    placement: "include",
    shape: "circle",
    fillColor: "#78909c",
    paletteHidden: true,
  },
  {
    id: "mat-7x7",
    label: "7x7 Mat",
    entityPrefix: "trkMat",
    includeFile: "/Data/Simulations/Multirotor/7x7Mat.xml",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#9ccc65",
    placement: "include",
    shape: "square",
    fillColor: "#9ccc65",
    paletteHidden: true,
    showDirectionArrow: false,
  },
];

export const OBJECT_LOOKUP: Record<string, ObjectConfig> = OBJECT_CATALOG.reduce(
  (acc, entry) => {
    acc[entry.id] = entry;
    return acc;
  },
  {} as Record<string, ObjectConfig>
);

const FLAG_UNIFIED = OBJECT_LOOKUP["flag"];
if (FLAG_UNIFIED) {
  OBJECT_LOOKUP["flag-pass-left"] = FLAG_UNIFIED;
  OBJECT_LOOKUP["flag-pass-right"] = FLAG_UNIFIED;
}

const GATE_TYPE_IDS = new Set([
  "gate-5x5",
  "start-finish-5x5",
  "gate-7x6",
  "start-finish-7x6",
  "champs-25-gate",
  "dive-gate-7x7",
  "climb-gate-7x7",
  "hurdle-7x16",
  "hurdle-5x10",
  "hurdle-4x7",
]);
const HURDLE_TYPE_IDS = new Set(["hurdle-7x16", "hurdle-5x10", "hurdle-4x7"]);
const CUBE_TYPE_IDS = new Set(["pipe-cube", "pipe-double-cube"]);
const STACKABLE_GATE_TYPE_IDS = new Set(["gate-5x5", "start-finish-5x5"]);

export function isGateConfig(config: ObjectConfig | null | undefined): boolean {
  return Boolean(config && GATE_TYPE_IDS.has(config.id));
}

export function isHurdleConfig(config: ObjectConfig | null | undefined): boolean {
  return Boolean(config && HURDLE_TYPE_IDS.has(config.id));
}

export function isCubeConfig(config: ObjectConfig | null | undefined): boolean {
  return Boolean(config && CUBE_TYPE_IDS.has(config.id));
}

export function isStackableGateConfig(config: ObjectConfig | null | undefined): boolean {
  return Boolean(config && STACKABLE_GATE_TYPE_IDS.has(config.id));
}

export function getGateStackCount(meta: { config: ObjectConfig; stackCount?: number } | null | undefined): number {
  if (!meta || !isStackableGateConfig(meta.config)) {
    return 1;
  }
  const count = Number.parseInt(String(meta.stackCount ?? ""), 10);
  if (!Number.isFinite(count)) {
    return 1;
  }
  return Math.max(1, Math.min(3, count));
}

export function getGateStackSpacing(meta: { config: ObjectConfig } | null | undefined): number {
  if (!meta || !meta.config) {
    return 0;
  }
  if (typeof meta.config.stackSpacingMeters === "number") {
    return meta.config.stackSpacingMeters;
  }
  return meta.config.height || 2.1;
}

/** Fallback if an object is missing `includeFile` (palette flags use `FlagPassLeft` / `FlagPassRight`). */
export const FLAG_BASE_INCLUDE = "/Data/Simulations/Multirotor/Flag.xml";

/** Sim includes for the unified `id: "flag"` object; chosen from `sensingSide` on export. */
export const FLAG_PASS_LEFT_INCLUDE = "/Data/Simulations/Multirotor/FlagPassLeft.xml";
export const FLAG_PASS_RIGHT_INCLUDE = "/Data/Simulations/Multirotor/FlagPassRight.xml";

/**
 * Map old catalog ids to the single `flag` type. Used when rehydrating saves / imports.
 */
export function normalizeFlagTypeId(typeId: string): {
  typeId: string;
  /** Prefer when stored `sensingSide` is absent (legacy scene). */
  legacySensingSide?: "left" | "right";
} {
  if (typeId === "flag-pass-left") return { typeId: "flag", legacySensingSide: "left" };
  if (typeId === "flag-pass-right") return { typeId: "flag", legacySensingSide: "right" };
  return { typeId };
}

/**
 * Maps retired catalog ids and unifies with `normalizeFlagTypeId` for rehydration.
 */
export function normalizeCatalogTypeId(typeId: string): {
  typeId: string;
  legacySensingSide?: "left" | "right";
  legacyChampsGateColor?: Champs25GateColor;
} {
  const split = typeId.match(/^champs-25-gate-(red|green|blue|yellow|white)$/);
  if (split) {
    return { typeId: "champs-25-gate", legacyChampsGateColor: split[1] as Champs25GateColor };
  }
  if (typeId === "gate-7x7") {
    return { typeId: "gate-7x6" };
  }
  return normalizeFlagTypeId(typeId);
}

export function getPassageTarget(config: ObjectConfig | null | undefined): "pole" | "flag" {
  return config?.passageTarget === "flag" ? "flag" : "pole";
}

/**
 * Main mesh for export. The unified flag uses FlagPassLeft or FlagPassRight
 */
export function resolveMainIncludeFile(
  config: ObjectConfig,
  meta?: { sensingSide?: "left" | "right" | null }
): string {
  if (config.id === "flag" && getPassageTarget(config) === "flag") {
    return meta?.sensingSide === "left" ? FLAG_PASS_LEFT_INCLUDE : FLAG_PASS_RIGHT_INCLUDE;
  }
  return config.includeFile ?? FLAG_BASE_INCLUDE;
}

export const REFERENCE_LAYOUT = [
  {
    typeId: "mat-7x7",
    x: 0,
    y: 0,
    angle: 0,
    opacity: 0.7,
    includeInExport: true,
  },
  {
    typeId: "metal-launch-stand",
    x: 0,
    y: 0,
    angle: 90,
    opacity: 0.85,
    includeInExport: true,
  },
  { typeId: "shade-canopy", x: -6, y: -6, angle: 0, opacity: 0.6 },
  { typeId: "shade-canopy", x: 0, y: -6, angle: 0, opacity: 0.6 },
  { typeId: "shade-canopy", x: 6, y: -6, angle: 0, opacity: 0.6 },
  { typeId: "shade-canopy", x: 12, y: -6, angle: 0, opacity: 0.6 },
];

export const CANOPY_EXPORT_BLOCK = [
  '  <Transform x="25" y="-85" rz="-1" angleDegrees="110">',
  '    <Transform x="9" y="-4" rz="1" angleDegrees="-30">',
  '      <Include file="/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml"/>',
  "    </Transform>",
  '    <Transform x="10" y="0">',
  '      <Include file="/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml"/>',
  "    </Transform>",
  '    <Transform x="10" y="4" rz="1" angleDegrees="3">',
  '      <Include file="/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml"/>',
  "    </Transform>",
  '    <Transform x="9.8" y="8" rz="1" angleDegrees="0">',
  '      <Include file="/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml"/>',
  "    </Transform>",
  "  </Transform>",
];

export const CENTERED_GATE_MACROS = [
  '  <Macro name="Centered5x5StartFinishGate">',
  '    <Transform x="-1.05">',
  '      <Include file="/Data/Simulations/Multirotor/5x5StartFinishGate.xml"/>',
  "    </Transform>",
  "  </Macro>",
  '  <Macro name="Centered5x5Gate">',
  '    <Transform x="-1.05">',
  '      <Include file="/Data/Simulations/Multirotor/5x5Gate.xml"/>',
  "    </Transform>",
  "  </Macro>",
  '  <Macro name="Centered7x6Gate">',
  '    <Transform x="-3.5">',
  '      <Include file="/Data/Simulations/Multirotor/7x6Gate.xml"/>',
  "    </Transform>",
  "  </Macro>",
  '  <Macro name="Centered7x6StartFinishGate">',
  '    <Transform x="-3.5">',
  '      <Include file="/Data/Simulations/Multirotor/7x6StartFinishGate.xml"/>',
  "    </Transform>",
  "  </Macro>",
];
