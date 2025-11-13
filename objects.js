/**
 * Catalog of placeable objects. Each entry defines how an object should be
 * rendered in the editor and how it should be exported to XML.
 */
const GATE_ICON = "assets/gateobj.png";
const FLAG_ICON = "assets/flag.png";
const GENERIC_ICON = "assets/gateobj.png";
const CUBE_ICON = "assets/cube.png";

const OBJECT_CATALOG = [
  {
    id: "start-finish-5x5",
    label: "5x5 Start/Finish Gate",
    entityPrefix: "gate",
    includeFile: "/Data/Simulations/Multirotor/5x5StartFinishGate.xml",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#ff7043",
    placement: "include",
    icon: GATE_ICON,
  },
  {
    id: "gate-5x5",
    label: "5x5 Gate",
    entityPrefix: "gate",
    includeFile: "/Data/Simulations/Multirotor/5x5Gate.xml",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#42a5f5",
    placement: "include",
    icon: GATE_ICON,
  },
  {
    id: "c-gate-5x5",
    label: "c-5x5 Gate",
    entityPrefix: "gate",
    includeFile: "/Data/Simulations/Multirotor/Centered5x5Gate.xml",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#42a5f5",
    placement: "include",
  },
  {
    id: "gate-7x7",
    label: "7x7 Gate",
    entityPrefix: "gate",
    includeFile: "/Data/Simulations/Multirotor/7x7Gate.xml",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#26a69a",
    placement: "include",
    icon: GATE_ICON,
  },
  {
    id: "shade-canopy",
    label: "Shade Canopy",
    entityPrefix: "shade",
    includeFile: "/Data/Simulations/Multirotor/Furniture/ShadeCanopy.xml",
    width: 6,
    height: 6,
    altitude: 0,
    color: "#8d6e63",
    placement: "include",
    shape: "square",
    fillColor: "#8d6e63",
  },
  {
    id: "flag-pass-right",
    label: "Flag Pass Right",
    entityPrefix: "flag",
    includeFile: "/Data/Simulations/Multirotor/FlagPassRight.xml",
    width: 1,
    height: 2,
    altitude: 0,
    color: "#ab47bc",
    placement: "include",
    icon: FLAG_ICON,
  },
  {
    id: "flag-pass-left",
    label: "Flag Pass Left",
    entityPrefix: "flag",
    includeFile: "/Data/Simulations/Multirotor/FlagPassLeft.xml",
    width: 1,
    height: 2,
    altitude: 0,
    color: "#7e57c2",
    placement: "include",
    icon: FLAG_ICON,
  },
  {
    id: "pipe-double-cube",
    label: "Pipe Double Cube",
    entityPrefix: "cube",
    macroName: "PipeDoubleCube",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#ffca28",
    placement: "macro",
    icon: CUBE_ICON,
  },
  {
    id: "pipe-cube",
    label: "Pipe Cube",
    entityPrefix: "cube",
    macroName: "PipeCube",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#fdd835",
    placement: "macro",
    icon: CUBE_ICON,
  },
  {
    id: "pipe-ladder",
    label: "Pipe Ladder",
    entityPrefix: "ladder",
    macroName: "PipeLadder",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#ef5350",
    placement: "macro",
    icon: CUBE_ICON,
  },
  {
    id: "pipe-quadruple-ladder",
    label: "Pipe Quadruple Ladder",
    entityPrefix: "ladder",
    macroName: "PipeQuadrupleLadder",
    width: 2.1,
    height: 2.1,
    altitude: 0,
    color: "#d32f2f",
    placement: "macro",
    icon: CUBE_ICON,
  },
  {
    id: "metal-launch-stand",
    label: "Metal Launch Stand",
    entityPrefix: "launch",
    includeFile: "/Data/Simulations/Multirotor/LaunchStands/MetalLaunchStand.xml",
    width: 2,
    height: 2,
    altitude: 0,
    color: "#78909c",
    placement: "include",
    shape: "circle",
    fillColor: "#78909c",
  },
  {
    id: "mat-7x7",
    label: "7x7 Mat",
    entityPrefix: "mat",
    includeFile: "/Data/Simulations/Multirotor/7x7Mat.xml",
    width: 7,
    height: 7,
    altitude: 0,
    color: "#9ccc65",
    placement: "include",
    shape: "square",
    fillColor: "#9ccc65",
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
}

