/**
 * Indicator configuration
 * Central mapping for indicator SVG assets and checkpoint token formats.
 */
(() => {
  const INDICATOR_CONFIGS = {
    "pipe-cube": {
      path: "assets/Cube.svg",
      checkpointStyle: "faceWithMode",
      modeOptions: ["Entry", "Exit"],
      modeJoiner: "",
      faceMap: {
        "face-front": "front",
        "face-left": "left",
        "face-back": "back",
        "face-right": "right",
        "face-top": "top",
      },
    },
    "pipe-double-cube": {
      path: "assets/doubleCube.svg",
      checkpointStyle: "faceWithMode",
      modeOptions: ["Entry", "Exit"],
      modeJoiner: "",
      faceMap: {
        "doubleCube.lower.front": "lower.front",
        "doubleCube.lower.left": "lower.left",
        "doubleCube.lower.back": "lower.back",
        "doubleCube.lower.right": "lower.right",
        "doubleCube.lower.top": "lower.top",
        "doubleCube.upper.front": "upper.front",
        "doubleCube.upper.left": "upper.left",
        "doubleCube.upper.back": "upper.back",
        "doubleCube.upper.right": "upper.right",
        "doubleCube.upper.top": "upper.top",
      },
    },
    "pipe-ladder": {
      path: "assets/pipeladder.svg",
      checkpointStyle: "segmentWithMode",
      modeOptions: ["front", "back"],
      modeJoiner: ".",
      faceMap: {
        "pipeLadder.lower": "lower",
        "pipeLadder.upper": "upper",
      },
    },
    "pipe-quadruple-ladder": {
      path: "assets/quadrupleLadder.svg",
      checkpointStyle: "segmentWithMode",
      modeOptions: ["front", "back"],
      modeJoiner: ".",
      faceMap: {
        "quadrupleLadder.level1": "level1",
        "quadrupleLadder.level2": "level2",
        "quadrupleLadder.level3": "level3",
        "quadrupleLadder.level4": "level4",
      },
    },
    "gate-5x5": {
      path: "assets/5x5Gate.svg",
      checkpointStyle: "entityOnly",
      faceMap: {
        "face-front": "front",
      },
    },
    "start-finish-5x5": {
      path: "assets/5x5Gate.svg",
      checkpointStyle: "entityOnly",
      faceMap: {
        "face-front": "front",
      },
    },
  };

  if (typeof window !== "undefined") {
    window.INDICATOR_CONFIGS = INDICATOR_CONFIGS;
  }
})();
