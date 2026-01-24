/**
 * Catalog of placeable objects. Each entry defines how an object should be
 * rendered in the editor and how it should be exported to XML.
 */
const GATE_ICON = "assets/gateobj.png";
const FLAG_ICON = "assets/flag.png";
const GENERIC_ICON = "assets/gateobj.png";
const CUBE_ICON = "assets/cube.png";
const DOUBLE_CUBE_ICON = "assets/double-cube.png";
const QUAD_LADDER_ICON = "assets/quad-ladder.png";

const OBJECT_CATALOG = [
  {
    id: "start-finish-5x5",
    label: "5x5 Start/Finish Gate",
    entityPrefix: "trkGate",
    macroName: "Centered5x5StartFinishGate",
    width: 2.1,
    height: 2.1,
    stackSpacingMeters: 1.7,
    visualWidth: 2.1, // Visual size matches actual size (gates touch when 2.1m apart)
    visualHeight: 2.1,
    altitude: 0,
    color: "#ff7043",
    placement: "macro",
    icon: GATE_ICON,
  },
  {
    id: "gate-5x5",
    label: "5x5 Gate",
    entityPrefix: "trkGate",
    macroName: "Centered5x5Gate",
    width: 2.1,
    height: 2.1,
    stackSpacingMeters: 1.7,
    visualWidth: 2.4, // Visual size matches actual size (gates touch when 2.1m apart)
    visualHeight: 2.1,
    altitude: 0,
    color: "#42a5f5",
    placement: "macro",
    icon: GATE_ICON,
  },
  {
    id: "gate-7x7",
    label: "7x7 Gate",
    entityPrefix: "trkGate",
    includeFile: "/Data/Simulations/Multirotor/7x7Gate.xml",
    width: 2.1,
    height: 2.1,
    visualWidth: 2.1, // Visual size matches actual size
    visualHeight: 2.1,
    altitude: 0,
    color: "#26a69a",
    placement: "include",
    icon: GATE_ICON,
  },
  {
    id: "flag-pass-right",
    label: "Flag Pass Right",
    entityPrefix: "trkFlag",
    includeFile: "/Data/Simulations/Multirotor/FlagPassRight.xml",
    width: 2,
    height: 2,
    altitude: 0,
    color: "#ab47bc",
    placement: "include",
    icon: FLAG_ICON,
  },
  {
    id: "flag-pass-left",
    label: "Flag Pass Left",
    entityPrefix: "trkFlag",
    includeFile: "/Data/Simulations/Multirotor/FlagPassLeft.xml",
    width: 2,
    height: 2,
    altitude: 0,
    color: "#7e57c2",
    placement: "include",
    icon: FLAG_ICON,
  },
  {
    id: "pipe-double-cube",
    label: "Pipe Double Cube",
    entityPrefix: "trkCube",
    macroName: "PipeDoubleCube",
    width: 2.1,
    height: 2.1,
    visualWidth: 2, // Smaller visual size to prevent overlap in sim
    visualHeight: 4,
    altitude: 0,
    color: "#ffca28",
    placement: "macro",
    icon: DOUBLE_CUBE_ICON,
  },
  {
    id: "pipe-cube",
    label: "Pipe Cube",
    entityPrefix: "trkCube",
    macroName: "PipeCube",
    width: 2.1,
    height: 2.1,
    visualWidth: 2, // Smaller visual size to prevent overlap in sim
    visualHeight: 4,
    altitude: 0,
    color: "#fdd835",
    placement: "macro",
    icon: CUBE_ICON,
  },
  {
    id: "pipe-ladder",
    label: "Pipe Ladder",
    entityPrefix: "trkLadder",
    macroName: "PipeLadder",
    width: 2.1,
    height: 2.1,
    visualWidth: 2, // Smaller visual size to prevent overlap in sim
    visualHeight: 4,
    altitude: 0,
    color: "#ef5350",
    placement: "macro",
    icon: QUAD_LADDER_ICON,
  },
  {
    id: "pipe-quadruple-ladder",
    label: "Pipe Quadruple Ladder",
    entityPrefix: "trkLadder",
    macroName: "PipeQuadrupleLadder",
    width: 2.1,
    height: 2.1,
    visualWidth: 2, // Smaller visual size to prevent overlap in sim
    visualHeight: 4,
    altitude: 0,
    color: "#d32f2f",
    placement: "macro",
    icon: QUAD_LADDER_ICON,
  },
  {
    id: "padded-pole",
    label: "Padded Pole",
    entityPrefix: "trkPole",
    macroName: "PaddedPole",
    width: 2,
    height: 4,
    altitude: 0, // Will be set when attached to top of gate
    attachHeightOffsetMeters: 0.3,
    color: "#66bb6a",
    placement: "macro",
    icon: FLAG_ICON,
    anchorOffsetMeters: 0,
  },
  {
    id: "pipe-flag",
    label: "Pipe Flag",
    entityPrefix: "trkFlag",
    macroName: "PaddedPole",
    width: 2,
    height: 4, // Visual height for stacked poles
    altitude: 0,
    color: "#4caf50",
    placement: "composite", // Special placement type for composite objects
    icon: FLAG_ICON,
    anchorOffsetMeters: 0,
    compositeParts: [
      { macroName: "PaddedPole", altitude: 0 },
      { macroName: "PaddedPole", altitude: 2 },
    ],
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
  },
];

/**
 * Helper map for quick lookup.
 */
const OBJECT_LOOKUP = OBJECT_CATALOG.reduce((acc, entry) => {
  acc[entry.id] = entry;
  return acc;
}, {});

if (typeof window !== "undefined") {
  window.OBJECT_CATALOG = OBJECT_CATALOG;
  window.OBJECT_LOOKUP = OBJECT_LOOKUP;
  // Export icon constants for use in editor.js
  window.GATE_ICON = GATE_ICON;
  window.FLAG_ICON = FLAG_ICON;
  window.GENERIC_ICON = GENERIC_ICON;
  window.CUBE_ICON = CUBE_ICON;
  window.DOUBLE_CUBE_ICON = DOUBLE_CUBE_ICON;
  window.QUAD_LADDER_ICON = QUAD_LADDER_ICON;
}

