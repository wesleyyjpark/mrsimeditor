/**
 * Model
 * Type predicates and stack-related rules used across editor features.
 */
(() => {
  const GATE_TYPE_IDS = new Set(["gate-5x5", "gate-7x7", "start-finish-5x5"]);
  const CUBE_TYPE_IDS = new Set(["pipe-cube", "pipe-double-cube"]);
  const STACKABLE_GATE_TYPE_IDS = new Set(["gate-5x5", "start-finish-5x5"]);

  function isGateConfig(config) {
    return Boolean(config && GATE_TYPE_IDS.has(config.id));
  }

  function isCubeConfig(config) {
    return Boolean(config && CUBE_TYPE_IDS.has(config.id));
  }

  function isStackableGateConfig(config) {
    return Boolean(config && STACKABLE_GATE_TYPE_IDS.has(config.id));
  }

  function getGateStackCount(meta) {
    if (!meta || !isStackableGateConfig(meta.config)) {
      return 1;
    }
    const count = Number.parseInt(meta.stackCount, 10);
    if (!Number.isFinite(count)) {
      return 1;
    }
    return Math.max(1, Math.min(3, count));
  }

  function getGateStackSpacing(meta) {
    if (!meta || !meta.config) {
      return 0;
    }
    if (typeof meta.config.stackSpacingMeters === "number") {
      return meta.config.stackSpacingMeters;
    }
    return meta.config.height || 2.1;
  }

  if (typeof window !== "undefined") {
    window.Model = {
      isGateConfig,
      isCubeConfig,
      isStackableGateConfig,
      getGateStackCount,
      getGateStackSpacing,
    };
  }
})();
