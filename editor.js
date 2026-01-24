
(() => {
  const PIXELS_PER_METER = 40;
  const catalog = (typeof window !== "undefined" && window.OBJECT_CATALOG) || [];
  const lookup = (typeof window !== "undefined" && window.OBJECT_LOOKUP) || {};
  // Get icon constants from window (defined in objects.js)
  const GATE_ICON = (typeof window !== "undefined" && window.GATE_ICON) || "assets/gateobj.png";
  const FLAG_ICON = (typeof window !== "undefined" && window.FLAG_ICON) || "assets/flag.png";
  const GENERIC_ICON = (typeof window !== "undefined" && window.GENERIC_ICON) || "assets/gateobj.png";
  const CUBE_ICON = (typeof window !== "undefined" && window.CUBE_ICON) || "assets/cube.png";
  const DOUBLE_CUBE_ICON = (typeof window !== "undefined" && window.DOUBLE_CUBE_ICON) || "assets/double-cube.png";
  const QUAD_LADDER_ICON = (typeof window !== "undefined" && window.QUAD_LADDER_ICON) || "assets/quad-ladder.png";
  const canvas = new fabric.Canvas("track-canvas", {
    selection: true,
    preserveObjectStacking: true,
    stopContextMenu: true,
  });
  window.trackCanvas = canvas;
  const layout = document.querySelector(".app-layout");
  const canvasWidth = canvas.getWidth();
  const canvasHeight = canvas.getHeight();
  const GRID_BOTTOM_MARGIN = 160;
  const DEFAULT_GRID_SIZE_METERS = 0.7;
  const MAJOR_GRID_METERS = 2.1;
  const DEFAULT_FORWARD_OFFSET_METERS = 16;
  const ZOOM_MIN = 0.4;
  const ZOOM_MAX = 2.5;
  const ZOOM_STEP = 0.1;
  const DEFAULT_CURSOR = canvas.defaultCursor || "default";
  const PAN_CURSOR = "grab";
  const PAN_ACTIVE_CURSOR = "grabbing";

  function getGridOrigin() {
    return {
      x: canvasWidth / 2,
      y: canvasHeight - GRID_BOTTOM_MARGIN,
    };
  }

  function updateGridBackground() {
    const baseSpacingPx = Math.max(4, state.gridSizeMeters * PIXELS_PER_METER);
    const majorMultiplier = Math.max(
      1,
      Math.round(MAJOR_GRID_METERS / state.gridSizeMeters)
    );
    const majorSizePx = baseSpacingPx * majorMultiplier;
    const patternCanvas = fabric.util.createCanvasElement();
    patternCanvas.width = majorSizePx;
    patternCanvas.height = majorSizePx;
    const ctx = patternCanvas.getContext("2d");

    ctx.fillStyle = "#f9fbfd";
    ctx.fillRect(0, 0, majorSizePx, majorSizePx);

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

    const origin = getGridOrigin();
    const offsetX = -((origin.x % majorSizePx) || 0);
    const offsetY = -((origin.y % majorSizePx) || 0);
    const pattern = new fabric.Pattern({
      source: patternCanvas,
      repeat: "repeat",
      offsetX,
      offsetY,
    });

    canvas.setBackgroundColor(pattern, () => {
      canvas.requestRenderAll();
    });
  }

  function clampZoom(value) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
  }

  function updateZoomUI() {
    if (elements.zoomValue) {
      elements.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
    }
    if (elements.zoomSlider) {
      const sliderValue = Math.round(state.zoom * 100);
      if (Number(elements.zoomSlider.value) !== sliderValue) {
        elements.zoomSlider.value = sliderValue.toString();
      }
    }
  }

  function applyZoom(nextZoom, origin) {
    const targetZoom = clampZoom(nextZoom);
    const currentZoom = canvas.getZoom();
    if (Math.abs(targetZoom - currentZoom) < 1e-4) {
      state.zoom = targetZoom;
      updateZoomUI();
      return;
    }
    const point = origin || { x: canvasWidth / 2, y: canvasHeight / 2 };
    canvas.zoomToPoint(point, targetZoom);
    state.zoom = targetZoom;
    updateZoomUI();
    updateGridBackground();
    canvas.requestRenderAll();
  }

  const panState = {
    keyActive: false,
    isDragging: false,
    lastClientX: 0,
    lastClientY: 0,
    restoreSelection: true,
  };

  function updatePanCursor() {
    const cursor = panState.isDragging
      ? PAN_ACTIVE_CURSOR
      : panState.keyActive
      ? PAN_CURSOR
      : DEFAULT_CURSOR;
    canvas.defaultCursor = cursor;
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.style.cursor = cursor;
    }
    if (canvas.lowerCanvasEl) {
      canvas.lowerCanvasEl.style.cursor = cursor;
    }
    if (canvas.wrapperEl) {
      canvas.wrapperEl.style.cursor = cursor;
    }
  }

  function startPan(domEvent) {
    panState.isDragging = true;
    panState.lastClientX = domEvent.clientX;
    panState.lastClientY = domEvent.clientY;
    panState.restoreSelection = canvas.selection;
    canvas.selection = false;
    updatePanCursor();
  }

  function continuePan(domEvent) {
    const nextX = domEvent.clientX;
    const nextY = domEvent.clientY;
    const deltaX = nextX - panState.lastClientX;
    const deltaY = nextY - panState.lastClientY;
    if (deltaX === 0 && deltaY === 0) {
      return;
    }
    canvas.relativePan(new fabric.Point(deltaX, deltaY));
    panState.lastClientX = nextX;
    panState.lastClientY = nextY;
    canvas.requestRenderAll();
  }

  function endPanInteraction() {
    if (!panState.isDragging) {
      updatePanCursor();
      return;
    }
    panState.isDragging = false;
    canvas.selection = panState.restoreSelection;
    updatePanCursor();
    canvas.requestRenderAll();
  }

  function isEditableElement(element) {
    if (!element) {
      return false;
    }
    const tagName = element.tagName;
    if (!tagName) {
      return Boolean(element.isContentEditable);
    }
    const normalizedTag = tagName.toUpperCase();
    return (
      element.isContentEditable ||
      normalizedTag === "INPUT" ||
      normalizedTag === "TEXTAREA" ||
      normalizedTag === "SELECT"
    );
  }

  function updateSidebarsVisibility() {
    if (layout) {
      layout.classList.toggle("sidebars-hidden", state.sidebarsHidden);
    }
    if (elements.toggleSidebarsButton) {
      elements.toggleSidebarsButton.textContent = state.sidebarsHidden
        ? "Show Sidebars"
        : "Hide Sidebars";
      elements.toggleSidebarsButton.setAttribute(
        "aria-pressed",
        state.sidebarsHidden ? "true" : "false"
      );
    }
    canvas.calcOffset();
    canvas.requestRenderAll();
  }

  function createUniqueId() {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return `obj-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  }

  const state = {
    gridSizeMeters: DEFAULT_GRID_SIZE_METERS,
    rotationSnap: 5,
    entityCounters: {},
    placedObjects: [],
    metaByObjectId: new Map(),
    activeMeta: null,
    referenceObjects: [],
    showReferenceLayout: true,
    zoom: 1,
    sidebarsHidden: false,
    ruler: {
      enabled: false,
      startPoint: null,
      line: null,
      label: null,
      isDrawing: false,
    },
  };

  const REFERENCE_LAYOUT = [
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

  const CANOPY_EXPORT_BLOCK = [
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

  const CENTERED_GATE_MACROS = [
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
  ];

  const elements = {
    palette: document.getElementById("object-palette"),
    gridSizeInput: document.getElementById("grid-size-input"),
    rotationSnapInput: document.getElementById("rotation-snap-input"),
    importButton: document.getElementById("import-button"),
    importFileInput: document.getElementById("import-file-input"),
    exportButton: document.getElementById("export-button"),
    deleteButton: document.getElementById("delete-button"),
    duplicateButton: document.getElementById("duplicate-button"),
    resetViewButton: document.getElementById("reset-view"),
    clearSceneButton: document.getElementById("clear-scene"),
    toggleReferencesButton: document.getElementById("toggle-references"),
    toggleSidebarsButton: document.getElementById("toggle-sidebars"),
    zoomInButton: document.getElementById("zoom-in"),
    zoomOutButton: document.getElementById("zoom-out"),
    zoomSlider: document.getElementById("zoom-slider"),
    zoomValue: document.getElementById("zoom-value"),
    globalOffsetX: document.getElementById("global-offset-x"),
    globalOffsetY: document.getElementById("global-offset-y"),
    globalRotation: document.getElementById("global-rotation"),
    selectedNone: document.getElementById("selected-none"),
    selectedDetails: document.getElementById("selected-details"),
    selectedLabel: document.getElementById("selected-label"),
    selectedEntity: document.getElementById("selected-entity"),
    selectedInclude: document.getElementById("selected-include"),
    selectedAltitude: document.getElementById("selected-altitude"),
    selectedPositionX: document.getElementById("selected-position-x"),
    selectedPositionY: document.getElementById("selected-position-y"),
    selectedRotation: document.getElementById("selected-rotation"),
    attachmentControls: document.getElementById("attachment-controls"),
    attachGateSelect: document.getElementById("attach-gate-select"),
    attachSideSelect: document.getElementById("attach-side-select"),
    attachLevelSelect: document.getElementById("attach-level-select"),
    gateStackControls: document.getElementById("gate-stack-controls"),
    gateStackCount: document.getElementById("gate-stack-count"),
    measureToggle: document.getElementById("measure-toggle"),
  };

  /**
   * Utility — clamp input values to meaningful ranges.
   */
  function sanitizeSettings() {
    const gridSize = parseFloat(elements.gridSizeInput.value);
    state.gridSizeMeters =
      Number.isFinite(gridSize) && gridSize > 0 ? gridSize : DEFAULT_GRID_SIZE_METERS;
    elements.gridSizeInput.value = state.gridSizeMeters.toString();

    const rotationSnap = parseFloat(elements.rotationSnapInput.value);
    state.rotationSnap = Number.isFinite(rotationSnap) && rotationSnap > 0 ? rotationSnap : 5;
    elements.rotationSnapInput.value = state.rotationSnap.toString();

    updateGridBackground();
  }

  /**
   * Convert a hex color to rgba string with given alpha.
   */
  function hexToRgba(hex, alpha) {
    const sanitized = hex.replace("#", "");
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Build an entity name with a numeric suffix (e.g. gate1, gate2). this is important for locking the poles to a specfic gate
   */
  function allocateEntityName(prefix) {
    const count = (state.entityCounters[prefix] || 0) + 1;
    state.entityCounters[prefix] = count;
    return `${prefix}${count}`;
  }

  /**
   * Reset entity counters when scene is cleared.
   */
  function resetEntityCounters() {
    state.entityCounters = {};
  }

  /**
   * Register palette buttons and wire up click handlers.
   */
  function populatePalette() {
    if (!elements.palette) {
      return;
    }

    catalog.forEach((entry) => {
      // Skip objects marked as hidden from palette (reference-only objects)
      if (entry.paletteHidden) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";

      const labelSpan = document.createElement("span");
      labelSpan.className = "label";
      labelSpan.textContent = entry.label;

      const includeSpan = document.createElement("span");
      includeSpan.className = "include";
      if (entry.placement === "macro") {
        includeSpan.textContent = `Macro: ${entry.macroName}`;
      } else if (entry.placement === "composite") {
        const partCount = entry.compositeParts ? entry.compositeParts.length : 0;
        includeSpan.textContent = `Composite: ${partCount} parts`;
      } else {
        includeSpan.textContent = entry.includeFile.replace("/Data/Simulations/Multirotor/", "");
      }

      button.appendChild(labelSpan);
      button.appendChild(includeSpan);

      button.addEventListener("click", () => {
        addObjectToScene(entry.id);
      });

      elements.palette.appendChild(button);
    });
  }

  /**
   * Convert fabric object's anchor-aligned position to meters.
   * 
   * COORDINATE SYSTEM EXPLANATION: (this will be changed it sucks ass)
   * - Objects are positioned using their icon's anchor point (typically bottom-center)
   * - The anchor offset accounts for where the "true" position (ground contact point) 
   *   is relative to the icon's visual anchor
   * - For gates: offset is 50/638 of icon height (icon anchor is at bottom, true position 
   *   is slightly above bottom)
   * - For flags/poles: offset is 285/2000 of icon height (flag pole base is partway up icon)
   * - getObjectPositionMeters() calculates the true position by subtracting the anchor offset
   *   from the icon's top position, giving the actual ground position in meters
   */
  const ICON_BASELINE_OFFSETS = {
    [GATE_ICON]: 50 / 638,
    [GENERIC_ICON]: 50 / 638,
    [FLAG_ICON]: 285 / 2000,
    [CUBE_ICON]: 70 / 500,
    [DOUBLE_CUBE_ICON]: 70 / 500,
    [QUAD_LADDER_ICON]: 70 / 500,
  };

  function getConfigForObject(object) {
    const typeId = object?.data?.typeId;
    if (!typeId) {
      return null;
    }
    return lookup[typeId] || null;
  }

  function getAnchorOffsetPx(object) {
    if (!object) {
      return 0;
    }
    const config = getConfigForObject(object);
    if (!config) {
      return 0;
    }
    if (typeof config.anchorOffsetMeters === "number") {
      return config.anchorOffsetMeters * PIXELS_PER_METER;
    }
    if (config.icon) {
      const ratio = ICON_BASELINE_OFFSETS[config.icon] || 0;
      // Round to avoid floating point precision issues that cause snapping misalignment
      return Math.round(ratio * object.getScaledHeight() * 100) / 100;
    }
    return 0;
  }

  function getObjectPositionMeters(object) {
    const origin = getGridOrigin();
    const anchorOffset = getAnchorOffsetPx(object);
    const baseTop = object.top - anchorOffset;
    const xMeters = (object.left - origin.x) / PIXELS_PER_METER;
    const yMeters = (origin.y - baseTop) / PIXELS_PER_METER;
    return { x: xMeters, y: yMeters };
  }

  function pointerToMeters(point) {
    const origin = getGridOrigin();
    const xMeters = (point.x - origin.x) / PIXELS_PER_METER;
    const yMeters = (origin.y - point.y) / PIXELS_PER_METER;
    return { x: xMeters, y: yMeters };
  }

  function clearRulerGraphics() {
    if (state.ruler.line) {
      canvas.remove(state.ruler.line);
      state.ruler.line = null;
    }
    if (state.ruler.label) {
      canvas.remove(state.ruler.label);
      state.ruler.label = null;
    }
    canvas.requestRenderAll();
  }

  function resetRulerMeasurement() {
    state.ruler.startPoint = null;
    state.ruler.isDrawing = false;
  }

  function setRulerEnabled(enabled) {
    state.ruler.enabled = enabled;
    if (!enabled) {
      resetRulerMeasurement();
      clearRulerGraphics();
    }
    updateRulerUI();
  }

  function updateRulerUI() {
    if (!elements.measureToggle) {
      return;
    }
    elements.measureToggle.textContent = state.ruler.enabled ? "Ruler On" : "Ruler Off";
    elements.measureToggle.setAttribute("aria-pressed", state.ruler.enabled ? "true" : "false");
    elements.measureToggle.classList.toggle("primary", state.ruler.enabled);
  }

  function ensureRulerLine(startPoint, endPoint) {
    if (!state.ruler.line) {
      state.ruler.line = new fabric.Line(
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
      canvas.add(state.ruler.line);
    } else {
      state.ruler.line.set({
        x1: startPoint.x,
        y1: startPoint.y,
        x2: endPoint.x,
        y2: endPoint.y,
      });
      state.ruler.line.setCoords();
    }
    state.ruler.line.bringToFront();
  }

  function ensureRulerLabel(text, position) {
    if (!state.ruler.label) {
      state.ruler.label = new fabric.Textbox(text, {
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
      canvas.add(state.ruler.label);
    } else {
      state.ruler.label.set({
        text,
        left: position.x,
        top: position.y,
      });
      state.ruler.label.setCoords();
    }
    state.ruler.label.bringToFront();
  }

  function updateRulerOverlay(endPoint) {
    if (!state.ruler.startPoint) {
      return;
    }
    const startPoint = state.ruler.startPoint;
    ensureRulerLine(startPoint, endPoint);

    const startMeters = pointerToMeters(startPoint);
    const endMeters = pointerToMeters(endPoint);
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
    ensureRulerLabel(labelText, labelPosition);
    canvas.requestRenderAll();
  }

  function handleRulerClick(pointer) {
    if (!state.ruler.enabled) {
      return;
    }
    const clickPoint = new fabric.Point(pointer.x, pointer.y);
    if (!state.ruler.isDrawing) {
      state.ruler.startPoint = clickPoint;
      state.ruler.isDrawing = true;
      updateRulerOverlay(clickPoint);
      return;
    }

    updateRulerOverlay(clickPoint);
    state.ruler.isDrawing = false;
  }

  function handleRulerMove(pointer) {
    if (!state.ruler.enabled || !state.ruler.isDrawing || !state.ruler.startPoint) {
      return;
    }
    const movePoint = new fabric.Point(pointer.x, pointer.y);
    updateRulerOverlay(movePoint);
  }


  /**
   * Check if a gate would overlap with other gates at the given position.
   * Returns the minimum safe distance adjustment needed.
   */
  function checkGateSpacing(object, targetXMeters, targetYMeters) {
    const config = getConfigForObject(object);
    if (!config) return { adjustX: 0, adjustY: 0 };
    
    // Only check spacing for gates
    if (!isGateConfig(config)) return { adjustX: 0, adjustY: 0 };
    
    const gateWidth = config.width || 2.1;
    const minSpacing = gateWidth; // Gates need to be at least their width apart
    
    let adjustX = 0;
    let adjustY = 0;
    
    // Check all other gates
    state.placedObjects.forEach((entry) => {
      if (entry.fabricObject === object) return; // Skip self
      
      const otherConfig = entry.config;
      if (!isGateConfig(otherConfig)) return;
      
      const otherPos = getObjectPositionMeters(entry.fabricObject);
      const dx = targetXMeters - otherPos.x;
      const dy = targetYMeters - otherPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If gates are too close, push them apart
      if (distance > 0 && distance < minSpacing) {
        const angle = Math.atan2(dy, dx);
        const neededSeparation = minSpacing - distance;
        adjustX += Math.cos(angle) * neededSeparation;
        adjustY += Math.sin(angle) * neededSeparation;
      }
    });
    
    return { adjustX, adjustY };
  }

  /**
   * Snap object position and rotation to configured increments.
   */
  function snapObjectTransform(object) {
    const origin = getGridOrigin();
    const gridPx = state.gridSizeMeters * PIXELS_PER_METER;
    const anchorOffset = getAnchorOffsetPx(object);
    const baseTop = object.top - anchorOffset;
    
    // Snap tolerance: if within this many pixels of a snap point, snap to it
    // Increased to 40% of grid size for more forgiving snapping
    const SNAP_TOLERANCE = gridPx * 0.4;
    
    // Calculate current position relative to grid
    const currentX = object.left - origin.x;
    const currentY = origin.y - baseTop;
    
    // Find nearest grid point
    const gridX = Math.round(currentX / gridPx);
    const gridY = Math.round(currentY / gridPx);
    const snappedXPos = gridX * gridPx;
    const snappedYPos = gridY * gridPx;
    
    // Check distance to nearest snap point
    const distanceX = Math.abs(currentX - snappedXPos);
    const distanceY = Math.abs(currentY - snappedYPos);
    
    // Snap if within tolerance, otherwise keep current position
    let finalSnappedX = distanceX <= SNAP_TOLERANCE ? snappedXPos : currentX;
    let finalSnappedY = distanceY <= SNAP_TOLERANCE ? snappedYPos : currentY;
    
    // Convert to meters for gate spacing check
    const snappedXMeters = finalSnappedX / PIXELS_PER_METER;
    const snappedYMeters = finalSnappedY / PIXELS_PER_METER;
    
    // Check gate spacing and adjust if needed
    const spacingAdjust = checkGateSpacing(object, snappedXMeters, snappedYMeters);
    finalSnappedX += spacingAdjust.adjustX * PIXELS_PER_METER;
    finalSnappedY += spacingAdjust.adjustY * PIXELS_PER_METER;
    
    const snappedLeft = origin.x + finalSnappedX;
    const snappedBaseTop = origin.y - finalSnappedY;
    const snappedTop = snappedBaseTop + anchorOffset;
    const snappedAngle =
      Math.round(object.angle / state.rotationSnap) * state.rotationSnap;

    // Round final positions to ensure pixel-perfect alignment
    object.set({
      left: Math.round(snappedLeft),
      top: Math.round(snappedTop),
      angle: snappedAngle,
    });

    object.setCoords();
  }

  function placeObjectAt(object, position = {}) {
    const origin = getGridOrigin();
    const x = position.x ?? 0;
    const y = position.y ?? 0;
    const angle = position.angle ?? 0;
    const anchorOffset = getAnchorOffsetPx(object);
    const baseTop = origin.y - y * PIXELS_PER_METER;

    object.set({
      left: origin.x + x * PIXELS_PER_METER,
      top: baseTop + anchorOffset,
      angle,
    });
    object.setCoords();
  }

  function applyVisualDefaults(object, config) {
    if (object.type !== "image") {
      const baseColor = config.fillColor || config.color || "#3f51b5";
      object.set({
        fill: hexToRgba(baseColor, 0.65),
      });
    }

    object.set({ opacity: 1 });

    object.setCoords();
  }

  /**
   * Create a Fabric.js object for each of the objects in the catalog
   */
  async function createFabricObject(config) {
    // Use visual size for display, actual size for export calculations
    const visualWidth = config.visualWidth !== undefined ? config.visualWidth : config.width;
    const visualHeight = config.visualHeight !== undefined ? config.visualHeight : config.height;
    const widthPx = visualWidth * PIXELS_PER_METER;
    const heightPx = visualHeight * PIXELS_PER_METER;
    const shadow = config.shadow || null;

    if (config.icon) {
      return new Promise((resolve, reject) => {
        fabric.Image.fromURL(
          config.icon,
          (img) => {
            img.set({
              originX: "center",
              originY: "bottom",
              selectable: true,
              hasControls: true,
              hasBorders: false,
              lockScalingX: true,
              lockScalingY: true,
              perPixelTargetFind: true,
              strokeUniform: true,
            });
            const scale = Math.min(widthPx / img.width, heightPx / img.height);
            img.scale(scale);
            img.data = { typeId: config.id };
            resolve(img);
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
      return Promise.resolve(
        new fabric.Circle({
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
          shadow,
        })
      );
    }

    return Promise.resolve(
      new fabric.Rect({
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
        shadow,
      })
    );
  }

  async function createReferenceObjects() {
    state.referenceObjects = [];
    await Promise.all(
      REFERENCE_LAYOUT.map(async (item) => {
        const config = lookup[item.typeId];
        if (!config) {
          console.warn(`Missing reference config for ${item.typeId}`);
          return null;
        }

        const fabricObject = await createFabricObject(config);
        applyVisualDefaults(fabricObject, config);
        fabricObject.set({
          selectable: false,
          evented: false,
          hoverCursor: "default",
          opacity: item.opacity ?? 0.8,
          excludeFromExport: true,
        });
        fabricObject.data = {
          typeId: item.typeId,
          reference: true,
        };
        placeObjectAt(fabricObject, item);
        canvas.add(fabricObject);
        fabricObject.sendToBack();
        state.referenceObjects.push({
          layout: item,
          fabricObject,
        });
        return fabricObject;
      })
    );
    updateReferenceVisibility();
    updateReferenceToggleButton();
  }

  function updateReferenceVisibility() {
    const visible = state.showReferenceLayout;
    state.referenceObjects.forEach(({ fabricObject }) => {
      fabricObject.visible = visible;
    });
    canvas.requestRenderAll();
  }

  function updateReferenceToggleButton() {
    if (!elements.toggleReferencesButton) {
      return;
    }
    elements.toggleReferencesButton.textContent = state.showReferenceLayout
      ? "Hide Reference Layout"
      : "Show Reference Layout";
  }

  /**
   * Add a new object to the scene at the canvas center.
   */
  async function addObjectToScene(typeId, opts = {}) {
    const config = lookup[typeId];
    if (!config) {
      console.warn(`Unknown object id: ${typeId}`);
      return;
    }

    console.log("Adding object:", config.label);

    const fabricObject = await createFabricObject(config);
    fabricObject.data = { typeId: config.id };
    applyVisualDefaults(fabricObject, config);
    const initialPosition = {
      x: opts.x ?? 0,
      y: opts.y ?? DEFAULT_FORWARD_OFFSET_METERS,
      angle: opts.angle ?? 0,
    };
    placeObjectAt(fabricObject, initialPosition);

    canvas.add(fabricObject);
    canvas.setActiveObject(fabricObject);

    snapObjectTransform(fabricObject);

    const entityName = allocateEntityName(config.entityPrefix);
    const metadata = {
      id: createUniqueId(),
      config,
      fabricObject,
      entityName,
      altitude: config.altitude ?? 0,
      stackCount: isStackableGateConfig(config) ? 1 : undefined,
    };

    state.placedObjects.push(metadata);
    state.metaByObjectId.set(fabricObject, metadata);
    updateObjectMetadata(fabricObject);
    setActiveMeta(metadata);
    canvas.requestRenderAll();
  }

  /**
   * Remove metadata and fabric object from state.
   */
  function removeObject(metadata) {
    if (!metadata) {
      return;
    }

    canvas.remove(metadata.fabricObject);
    state.metaByObjectId.delete(metadata.fabricObject);
    state.placedObjects = state.placedObjects.filter((entry) => entry.id !== metadata.id);
    setActiveMeta(null);
  }

  /**
   * Update selected metadata reference and refresh inspector.
   */
  function setActiveMeta(metadata) {
    const scrollX = window.scrollX || document.documentElement.scrollLeft || 0;
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    state.activeMeta = metadata ?? null;
    refreshSelectionPanel();
    if (window.scrollTo) {
      window.scrollTo(scrollX, scrollY);
    }
  }

  /**
   * Get all gates in the scene for attachment selection.
   */
  const GATE_TYPE_IDS = new Set(["gate-5x5", "gate-7x7", "start-finish-5x5"]);
  const STACKABLE_GATE_TYPE_IDS = new Set(["gate-5x5", "start-finish-5x5"]);

  function getGatesForAttachment() {
    return state.placedObjects.filter((entry) => isGateConfig(entry.config));
  }

  function isGateConfig(config) {
    return Boolean(config && GATE_TYPE_IDS.has(config.id));
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

  /**
   * Update attachment controls UI.
   */
  function updateAttachmentControls(meta) {
    if (!elements.attachmentControls || !elements.attachGateSelect) {
      return;
    }

    const isPaddedPole = meta && meta.config.id === "padded-pole";
    if (!isPaddedPole) {
      elements.attachmentControls.classList.add("hidden");
      return;
    }

    elements.attachmentControls.classList.remove("hidden");

    // Populate gate select
    const gates = getGatesForAttachment();
    const select = elements.attachGateSelect;
    select.innerHTML = '<option value="">None (Standalone)</option>';
    gates.forEach((gateMeta) => {
      const option = document.createElement("option");
      option.value = gateMeta.id;
      option.textContent = `${gateMeta.config.label} (${gateMeta.entityName})`;
      select.appendChild(option);
    });

    // Set current attachment
    if (meta.attachedTo) {
      select.value = meta.attachedTo;
      if (elements.attachSideSelect && meta.attachmentSide) {
        elements.attachSideSelect.value = meta.attachmentSide;
      }
    } else {
      select.value = "";
    }

    const gateMeta = meta.attachedTo
      ? state.placedObjects.find((entry) => entry.id === meta.attachedTo)
      : null;
    const clampedLevel = updateAttachmentLevelOptions(gateMeta, meta.attachedLevel);
    if (gateMeta) {
      meta.attachedLevel = clampedLevel;
    }
  }

  function updateAttachmentLevelOptions(gateMeta, preferredLevel) {
    if (!elements.attachLevelSelect) {
      return 1;
    }
    const select = elements.attachLevelSelect;
    select.innerHTML = "";
    if (!gateMeta) {
      select.disabled = true;
      const option = document.createElement("option");
      option.value = "1";
      option.textContent = "Gate 1";
      select.appendChild(option);
      select.value = "1";
      return 1;
    }

    const stackCount = getGateStackCount(gateMeta);
    for (let i = 1; i <= stackCount; i += 1) {
      const option = document.createElement("option");
      option.value = i.toString();
      if (stackCount === 1) {
        option.textContent = "Gate 1 (only)";
      } else if (i === 1) {
        option.textContent = "Gate 1 (bottom)";
      } else if (i === stackCount) {
        option.textContent = `Gate ${i} (top)`;
      } else {
        option.textContent = `Gate ${i}`;
      }
      select.appendChild(option);
    }
    const desiredLevel = Number.parseInt(preferredLevel, 10);
    const clampedLevel = Number.isFinite(desiredLevel)
      ? Math.min(stackCount, Math.max(1, desiredLevel))
      : stackCount;
    select.disabled = false;
    select.value = clampedLevel.toString();
    return clampedLevel;
  }

  function updateGateStackControls(meta) {
    if (!elements.gateStackControls || !elements.gateStackCount) {
      return;
    }
    if (!meta || !isStackableGateConfig(meta.config)) {
      elements.gateStackControls.classList.add("hidden");
      return;
    }
    elements.gateStackControls.classList.remove("hidden");
    const stackCount = getGateStackCount(meta);
    elements.gateStackCount.value = stackCount.toString();
  }

  /**
   * Refresh inspector UI based on selection.
   */
  function refreshSelectionPanel() {
    const meta = state.activeMeta;
    if (!meta) {
      elements.selectedDetails.classList.add("hidden");
      elements.selectedNone.classList.remove("hidden");
      if (elements.attachmentControls) {
        elements.attachmentControls.classList.add("hidden");
      }
      if (elements.gateStackControls) {
        elements.gateStackControls.classList.add("hidden");
      }
      return;
    }

    elements.selectedNone.classList.add("hidden");
    elements.selectedDetails.classList.remove("hidden");

    elements.selectedLabel.textContent = meta.config.label;
    elements.selectedEntity.textContent = meta.entityName;
    elements.selectedInclude.textContent =
      meta.config.placement === "macro"
        ? `Macro: ${meta.config.macroName}`
        : meta.config.includeFile;
    elements.selectedAltitude.value = meta.altitude.toString();
    
    // Update position and rotation display
    const pos = meta.position || getObjectPositionMeters(meta.fabricObject);
    const angle = meta.angle !== undefined ? meta.angle : meta.fabricObject.angle;
    if (elements.selectedPositionX) {
      elements.selectedPositionX.textContent = pos.x.toFixed(3);
    }
    if (elements.selectedPositionY) {
      elements.selectedPositionY.textContent = pos.y.toFixed(3);
    }
    if (elements.selectedRotation) {
      elements.selectedRotation.textContent = angle.toFixed(1);
    }

    // Update attachment controls
    updateGateStackControls(meta);
    updateAttachmentControls(meta);
  }

  /**
   * Update metadata when altitude input changes. lowkey dont know why its altitude
   */
  function handleAltitudeChange(event) {
    if (!state.activeMeta) {
      return;
    }
    const value = parseFloat(event.target.value);
    state.activeMeta.altitude = Number.isFinite(value) ? value : 0;
  }

  /**
   * Calculate position for attached pole relative to gate.
   */
  function calculateAttachedPolePosition(poleMeta, gateMeta, side, level) {
    const gatePos = getObjectPositionMeters(gateMeta.fabricObject);
    const gateAngle = gateMeta.fabricObject.angle;
    const gateWidth = gateMeta.config.width || 2.1;
    const gateHeight = gateMeta.config.height || 2.1;
    const gateBaseAltitude = gateMeta.altitude || 0;
    const stackSpacing = getGateStackSpacing(gateMeta);
    const stackCount = getGateStackCount(gateMeta);
    const requestedLevel = Number.parseInt(level, 10);
    const stackLevel = Number.isFinite(requestedLevel)
      ? Math.min(stackCount, Math.max(1, requestedLevel))
      : stackCount;
    
    // Convert gate angle to radians
    const angleRad = (gateAngle * Math.PI) / 180;
    
    // Calculate offset direction for left/right attachment
    // In our coordinate system: X is lateral (left/right), Y is forward (front/back)
    // Gate forward direction at angle 0° is along Y axis (positive Y)
    // For a gate at 0°: left is negative X, right is positive X
    // When gate rotates, we rotate the perpendicular vector
    // Perpendicular to forward direction: left = rotate forward by -90°, right = rotate forward by +90°
    const offsetDistance = gateWidth / 2; // Half gate width to reach edge (no gap)
    let offsetX = 0;
    let offsetY = 0;
    
    // Calculate perpendicular offset to gate forward direction
    // In editor: X is lateral (left/right), Y is forward (front/back)
    // Gate forward direction at angle θ: (sin(θ), cos(θ)) in (X, Y)
    // Left is perpendicular: rotate forward by -90° = (-cos(θ), sin(θ))
    // Right is perpendicular: rotate forward by +90° = (cos(θ), -sin(θ))
    // Test: At 0° (facing +Y): left = (-1, 0) = -X ✓, right = (1, 0) = +X ✓
    // Test: At 90° (facing +X): left = (0, 1) = +Y ✓, right = (0, -1) = -Y ✓
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
      altitude: gateBaseAltitude + gateHeight + heightOffset + stackSpacing * (stackLevel - 1),
    };
  }

  /**
   * Update pole position when attached to gate.
   */
  function updateAttachedPolePosition(poleMeta) {
    if (!poleMeta.attachedTo) {
      // Not attached, restore normal opacity
      if (poleMeta.fabricObject) {
        poleMeta.fabricObject.set({ opacity: 1 });
      }
      return;
    }
    
    const gateMeta = state.placedObjects.find((m) => m.id === poleMeta.attachedTo);
    if (!gateMeta) {
      // Gate was deleted, detach pole
      poleMeta.attachedTo = null;
      poleMeta.attachmentSide = null;
      poleMeta.attachedLevel = null;
      if (poleMeta.fabricObject) {
        poleMeta.fabricObject.set({ opacity: 1 });
      }
      return;
    }
    const stackCount = getGateStackCount(gateMeta);
    const requestedLevel = Number.parseInt(poleMeta.attachedLevel, 10);
    const clampedLevel = Number.isFinite(requestedLevel)
      ? Math.min(stackCount, Math.max(1, requestedLevel))
      : stackCount;
    poleMeta.attachedLevel = clampedLevel;

    const newPos = calculateAttachedPolePosition(
      poleMeta,
      gateMeta,
      poleMeta.attachmentSide || "left",
      clampedLevel
    );
    placeObjectAt(poleMeta.fabricObject, newPos);
    
    // Update altitude if attached to top
    if (newPos.altitude !== undefined) {
      poleMeta.altitude = newPos.altitude;
      if (elements.selectedAltitude && state.activeMeta && state.activeMeta.id === poleMeta.id) {
        elements.selectedAltitude.value = poleMeta.altitude.toString();
      }
    }
    
    // Visual indicator: slightly reduce opacity for attached poles
    poleMeta.fabricObject.set({ opacity: 0.85 });
    
    updateObjectMetadata(poleMeta.fabricObject);
  }

  /**
   * Handle attachment change for PaddedPole.
   */
  function handleAttachmentChange() {
    if (!state.activeMeta || state.activeMeta.config.id !== "padded-pole") {
      return;
    }
    
    const gateId = elements.attachGateSelect.value;
    const side = elements.attachSideSelect.value;
    const requestedLevel = elements.attachLevelSelect
      ? elements.attachLevelSelect.value
      : "1";
    
    if (!gateId) {
      // Detach
      state.activeMeta.attachedTo = null;
      state.activeMeta.attachmentSide = null;
      state.activeMeta.attachedLevel = null;
      updateAttachmentLevelOptions(null);
    } else {
      // Attach
      const gateMeta = state.placedObjects.find((entry) => entry.id === gateId);
      const clampedLevel = updateAttachmentLevelOptions(gateMeta, requestedLevel);
      state.activeMeta.attachedTo = gateId;
      state.activeMeta.attachmentSide = side;
      state.activeMeta.attachedLevel = clampedLevel;
      updateAttachedPolePosition(state.activeMeta);
    }
    
    canvas.requestRenderAll();
  }

  function handleGateStackChange() {
    if (!state.activeMeta || !isStackableGateConfig(state.activeMeta.config)) {
      return;
    }
    const requestedCount = Number.parseInt(elements.gateStackCount.value, 10);
    const clampedCount = Number.isFinite(requestedCount)
      ? Math.min(3, Math.max(1, requestedCount))
      : 1;
    state.activeMeta.stackCount = clampedCount;
    updateGateStackControls(state.activeMeta);

    // Update any poles attached to this gate
    state.placedObjects.forEach((poleMeta) => {
      if (poleMeta.attachedTo === state.activeMeta.id) {
        if (poleMeta.attachedLevel && poleMeta.attachedLevel > clampedCount) {
          poleMeta.attachedLevel = clampedCount;
        }
        updateAttachedPolePosition(poleMeta);
      }
    });

    canvas.requestRenderAll();
  }

  /**
   * Find metadata for fabric object.
   */
  function getMetaForObject(object) {
    return state.metaByObjectId.get(object) || null;
  }

  /**
   * Update metadata after object transform changes.
   */
  function updateObjectMetadata(object) {
    const meta = getMetaForObject(object);
    if (!meta) {
      return;
    }

    const pos = getObjectPositionMeters(object);
    meta.position = pos;
    meta.angle = object.angle;

    if (state.activeMeta && state.activeMeta.id === meta.id) {
      refreshSelectionPanel();
    }
  }

  /**
   * Clone selected object.
   */
  function duplicateSelected() {
    const active = canvas.getActiveObject();
    if (!active) {
      return;
    }

    const meta = getMetaForObject(active);
    if (!meta) {
      return;
    }

    active.clone((cloned) => {
      canvas.add(cloned);
      cloned.data = { typeId: meta.config.id };
      const currentPos = getObjectPositionMeters(active);
      placeObjectAt(cloned, {
        x: currentPos.x + state.gridSizeMeters,
        y: currentPos.y + state.gridSizeMeters,
        angle: active.angle,
      });
      snapObjectTransform(cloned);
      const newMeta = {
        id: createUniqueId(),
        config: meta.config,
        fabricObject: cloned,
        entityName: allocateEntityName(meta.config.entityPrefix),
        altitude: meta.altitude,
        stackCount: meta.stackCount,
      };

      applyVisualDefaults(cloned, meta.config);

      state.placedObjects.push(newMeta);
      state.metaByObjectId.set(cloned, newMeta);
      updateObjectMetadata(cloned);
      canvas.setActiveObject(cloned);
      setActiveMeta(newMeta);
      canvas.renderAll();
    });
  }

  /**
   * Delete currently selected object.
   */
  function deleteSelected() {
    const active = canvas.getActiveObject();
    if (!active) {
      return;
    }
    const meta = getMetaForObject(active);
    removeObject(meta);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  /**
   * Remove all placed objects.
   */
  function clearScene() {
    state.placedObjects.forEach((entry) => {
      canvas.remove(entry.fabricObject);
    });
    state.placedObjects = [];
    state.metaByObjectId.clear();
    resetEntityCounters();
    setActiveMeta(null);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  function buildEditorMeta(meta) {
    return `      <!-- EditorMeta: ${JSON.stringify(meta)} -->`;
  }

  function parseEditorMeta(commentText) {
    if (!commentText) {
      return null;
    }
    const marker = "EditorMeta:";
    const index = commentText.indexOf(marker);
    if (index === -1) {
      return null;
    }
    const jsonText = commentText.slice(index + marker.length).trim();
    if (!jsonText) {
      return null;
    }
    try {
      return JSON.parse(jsonText);
    } catch (error) {
      console.warn("Failed to parse EditorMeta comment", error);
      return null;
    }
  }

  function normalizeEditorAngle(angleDegrees) {
    let angle = angleDegrees % 360;
    if (angle < -180) {
      angle += 360;
    }
    if (angle > 180) {
      angle -= 360;
    }
    return angle;
  }

  function updateEntityCounterFromName(name) {
    if (!name) {
      return;
    }
    const match = name.match(/^(.*?)(\d+)$/);
    if (!match) {
      return;
    }
    const [, prefix, numberText] = match;
    const number = Number.parseInt(numberText, 10);
    if (!Number.isFinite(number)) {
      return;
    }
    state.entityCounters[prefix] = Math.max(state.entityCounters[prefix] || 0, number);
  }

  async function addObjectFromImport(config, position, meta) {
    const fabricObject = await createFabricObject(config);
    fabricObject.data = { typeId: config.id };
    applyVisualDefaults(fabricObject, config);
    placeObjectAt(fabricObject, position);
    fabricObject.setCoords();

    canvas.add(fabricObject);

    const metadata = {
      id: meta?.id || createUniqueId(),
      config,
      fabricObject,
      entityName: meta?.entityName || allocateEntityName(config.entityPrefix),
      altitude: Number.isFinite(position.altitude) ? position.altitude : config.altitude ?? 0,
      attachedTo: meta?.attachedTo || null,
      attachmentSide: meta?.attachmentSide || null,
      attachedLevel: meta?.attachedLevel || null,
      stackCount: meta?.stackCount,
    };

    updateEntityCounterFromName(metadata.entityName);

    state.placedObjects.push(metadata);
    state.metaByObjectId.set(fabricObject, metadata);
    updateObjectMetadata(fabricObject);
    return metadata;
  }

  function invertGlobalTransform(finalX, finalY, globalOffsetX, globalOffsetY, globalRotationDegrees) {
    const rotationRad = (globalRotationDegrees * Math.PI) / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);
    const adjustedX = finalX - globalOffsetX;
    const adjustedY = finalY - globalOffsetY;
    const rotatedForward = adjustedX;
    const rotatedLateral = -adjustedY;
    const forward = rotatedForward * cosR + rotatedLateral * sinR;
    const lateral = -rotatedForward * sinR + rotatedLateral * cosR;
    return { forward, lateral };
  }

  async function importXmlFromText(xmlText) {
    if (!xmlText) {
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, "application/xml");
    const parserError = doc.querySelector("parsererror");
    if (parserError) {
      alert("Could not parse XML file. Please check the file contents.");
      return;
    }

    const shouldClear = state.placedObjects.length === 0
      ? true
      : confirm("Importing will replace the current scene. Continue?");
    if (!shouldClear) {
      return;
    }
    clearScene();

    const commentNodes = Array.from(doc.childNodes).filter(
      (node) => node.nodeType === Node.COMMENT_NODE
    );
    const globalMeta = commentNodes
      .map((node) => parseEditorMeta(node.nodeValue || ""))
      .find((meta) => meta && meta.scope === "global");

    const globalOffsetX = Number.isFinite(globalMeta?.globalOffsetX)
      ? globalMeta.globalOffsetX
      : 0;
    const globalOffsetY = Number.isFinite(globalMeta?.globalOffsetY)
      ? globalMeta.globalOffsetY
      : 0;
    const globalRotation = Number.isFinite(globalMeta?.globalRotation)
      ? globalMeta.globalRotation
      : 0;

    elements.globalOffsetX.value = globalOffsetX.toString();
    elements.globalOffsetY.value = globalOffsetY.toString();
    elements.globalRotation.value = globalRotation.toString();

    const transformNodes = Array.from(doc.querySelectorAll("Transform")).filter((node) =>
      node.querySelector(":scope > Entity")
    );

    const compositeSeen = new Set();
    const stackSeen = new Set();
    const importMetaById = new Map();

    for (const transform of transformNodes) {
      const entity = transform.querySelector(":scope > Entity");
      if (!entity) {
        continue;
      }

      let meta = null;
      let prevNode = transform.previousSibling;
      while (prevNode && prevNode.nodeType === Node.TEXT_NODE && !prevNode.nodeValue?.trim()) {
        prevNode = prevNode.previousSibling;
      }
      if (prevNode && prevNode.nodeType === Node.COMMENT_NODE) {
        meta = parseEditorMeta(prevNode.nodeValue || "");
      }

      if (meta?.compositeGroupId) {
        if (compositeSeen.has(meta.compositeGroupId)) {
          continue;
        }
        compositeSeen.add(meta.compositeGroupId);
      }

      if (meta?.stackGroupId) {
        if (stackSeen.has(meta.stackGroupId)) {
          continue;
        }
        stackSeen.add(meta.stackGroupId);
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

      let typeConfig = null;
      if (meta?.typeId) {
        typeConfig = lookup[meta.typeId] || null;
      }

      if (!typeConfig) {
        const instance = entity.querySelector("Instance");
        const include = entity.querySelector("Include");
        const macroName = instance?.getAttribute("macro");
        const includeFile = include?.getAttribute("file");
        typeConfig =
          catalog.find((entry) => entry.macroName === macroName) ||
          catalog.find((entry) => entry.includeFile === includeFile) ||
          null;
      }

      if (!typeConfig) {
        console.warn("Skipping unknown object in import:", entity.getAttribute("name"));
        continue;
      }

      const position = {
        x: lateral,
        y: forward,
        angle: normalizeEditorAngle(angleDegrees - globalRotation - 90),
        altitude,
      };

      const importedMeta = await addObjectFromImport(typeConfig, position, {
        id: meta?.id,
        entityName: meta?.entityName || entity.getAttribute("name"),
        attachedTo: meta?.attachedTo,
        attachmentSide: meta?.attachmentSide,
        attachedLevel: meta?.attachedLevel,
        stackCount: meta?.stackCount,
      });

      if (meta?.id) {
        importMetaById.set(meta.id, importedMeta);
      }
    }

    // Restore attachments after all objects exist
    state.placedObjects.forEach((entry) => {
      if (!entry.attachedTo) {
        return;
      }
      const target = importMetaById.get(entry.attachedTo);
      if (!target) {
        entry.attachedTo = null;
        entry.attachmentSide = null;
        entry.attachedLevel = null;
      } else {
        entry.attachedTo = target.id;
      }
      updateAttachedPolePosition(entry);
    });

    resnapAll();
    refreshSelectionPanel();
    canvas.requestRenderAll();
  }

  function handleImportButtonClick() {
    if (elements.importFileInput) {
      elements.importFileInput.value = "";
      elements.importFileInput.click();
    }
  }

  function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      importXmlFromText(reader.result);
    };
    reader.onerror = () => {
      alert("Failed to read the XML file.");
    };
    reader.readAsText(file);
  }

  /**
   * Build XML string from current scene objects.
   */
  function exportXml() {
    const offsetForward = parseFloat(elements.globalOffsetX.value) || 0;
    const offsetLateral = parseFloat(elements.globalOffsetY.value) || 0;
    const globalRotationDegrees = parseFloat(elements.globalRotation.value) || 0;
    const rotationRad = (globalRotationDegrees * Math.PI) / 180;
    const cosR = Math.cos(rotationRad);
    const sinR = Math.sin(rotationRad);

    const lines = [];
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
    lines.push('          <Include file="/Data/Simulations/Multirotor/LaunchStands/MetalLaunchStand.xml"/>');
    lines.push("        </Transform>");
    lines.push("      </Transform>");
    if (state.placedObjects.length > 0) {
      lines.push("");
    }

    // Collect gate positions and enforce minimum spacing
    const gatePositions = [];
    const GATE_WIDTH = 2.1; // Gates are 2.1m wide and centered with -1.05m offset
    
    state.placedObjects.forEach((entry) => {
      const object = entry.fabricObject;
      const config = entry.config;
      const isGate = config.id === "gate-5x5" || config.id === "gate-7x7" || config.id === "start-finish-5x5";
      
      if (isGate) {
        const pos = getObjectPositionMeters(object);
        const forward = pos.y;
        const lateral = pos.x;
        const rotatedForward = forward * cosR - lateral * sinR;
        const rotatedLateral = forward * sinR + lateral * cosR;
        let finalX = rotatedForward + offsetForward;
        let finalY = -rotatedLateral + offsetLateral;
        
        // Ensure gates are at least their width apart
        for (const existingGate of gatePositions) {
          const dx = finalX - existingGate.x;
          const dy = finalY - existingGate.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0 && distance < GATE_WIDTH) {
            // Push gates apart to maintain minimum spacing
            const angle = Math.atan2(dy, dx);
            const neededSeparation = GATE_WIDTH - distance;
            finalX += Math.cos(angle) * neededSeparation;
            finalY += Math.sin(angle) * neededSeparation;
          }
        }
        
        gatePositions.push({ x: finalX, y: finalY, entry });
      }
    });
    
    // Now export all objects, using adjusted positions for gates
    const gatePositionsMap = new Map();
    gatePositions.forEach(({ entry, x, y }) => {
      gatePositionsMap.set(entry, { x, y });
    });

    state.placedObjects.forEach((entry) => {
      const object = entry.fabricObject;
      const pos = getObjectPositionMeters(object);

      const forward = pos.y;
      const lateral = pos.x;
      const rotatedForward = forward * cosR - lateral * sinR;
      const rotatedLateral = forward * sinR + lateral * cosR;
      
      // Use adjusted position if this is a gate, otherwise use calculated position
      const adjustedPos = gatePositionsMap.get(entry);
      const finalX = adjustedPos ? adjustedPos.x : (rotatedForward + offsetForward);
      const finalY = adjustedPos ? adjustedPos.y : (-rotatedLateral + offsetLateral);
      
      const finalAngle = normalizeAngle(object.angle + globalRotationDegrees + 90);
      const altitude = entry.altitude || 0;

      const editorMeta = {
        typeId: entry.config.id,
        id: entry.id,
        entityName: entry.entityName,
        attachedTo: entry.attachedTo || null,
        attachmentSide: entry.attachmentSide || null,
        attachedLevel: entry.attachedLevel || null,
        stackCount: entry.stackCount ?? null,
      };

      const stackCount = getGateStackCount(entry);
      if (isStackableGateConfig(entry.config) && stackCount > 1) {
        const stackSpacing = getGateStackSpacing(entry);
        for (let i = 1; i <= stackCount; i += 1) {
          const stackAltitude = altitude + stackSpacing * (i - 1);
          const stackEntityName = i === 1 ? entry.entityName : `${entry.entityName}_stack${i}`;
          lines.push(
            buildEditorMeta({
              ...editorMeta,
              stackGroupId: entry.id,
              stackIndex: i,
              stackCount,
            })
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
            lines.push(`          <Instance macro="${entry.config.macroName}"/>`);
          } else {
            lines.push(`          <Include file="${entry.config.includeFile}"/>`);
          }
          lines.push("        </Entity>");
          lines.push("      </Transform>");
        }
        return;
      }

      // Handle composite objects (like pipe-flag with stacked poles)
      if (entry.config.placement === "composite" && entry.config.compositeParts) {
        entry.config.compositeParts.forEach((part, index) => {
          const partAltitude = altitude + (part.altitude || 0);
          const partEntityName = index === 0 ? entry.entityName : `${entry.entityName}_${index + 1}`;
          lines.push(
            buildEditorMeta({
              ...editorMeta,
              compositeGroupId: entry.id,
              compositeIndex: index + 1,
              compositeCount: entry.config.compositeParts.length,
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
          
          lines.push("        </Entity>");
          lines.push("      </Transform>");
        });
      } else {
        // Standard single object export
      lines.push(buildEditorMeta(editorMeta));
      lines.push(
        `      <Transform x="${finalX.toFixed(3)}" y="${finalY.toFixed(
          3
        )}" z="${altitude.toFixed(3)}" angleDegrees="${finalAngle.toFixed(
          1
        )}" rz="-1">`
      );
        lines.push(`        <Entity name="${entry.entityName}">`);

        if (entry.config.placement === "macro") {
          lines.push(`          <Instance macro="${entry.config.macroName}"/>`);
        } else {
          lines.push(`          <Include file="${entry.config.includeFile}"/>`);
        }

        lines.push("        </Entity>");
        lines.push("      </Transform>");
      }
    });

    lines.push("    </Entity>");
    lines.push("  </Transform>");
    lines.push("</Simulation>");

    downloadText(lines.join("\n"), "track.xml");
  }

  /**
   * Normalize angles to [0, 360).
   */
  function normalizeAngle(angleDegrees) {
    let angle = angleDegrees % 360;
    if (angle < 0) {
      angle += 360;
    }
    return angle;
  }

  /**
   * Trigger browser download for text content.
   */
  function downloadText(text, filename) {
    const blob = new Blob([text], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Reset canvas viewport transform.
   */
  function resetView() {
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    state.zoom = 1;
    updateZoomUI();
    updateGridBackground();
    canvas.renderAll();
  }

  /**
   * Setup Fabric event listeners.
   */
  function registerCanvasEvents() {
    canvas.on("selection:created", (event) => {
      const object = event.selected?.[0];
      const meta = object ? getMetaForObject(object) : null;
      setActiveMeta(meta);
    });

    canvas.on("selection:updated", (event) => {
      const object = event.selected?.[0];
      const meta = object ? getMetaForObject(object) : null;
      setActiveMeta(meta);
    });

    canvas.on("selection:cleared", () => {
      setActiveMeta(null);
    });

    canvas.on("object:modified", (event) => {
      const object = event.target;
      if (!object || !getMetaForObject(object)) {
        return;
      }
      
      const meta = getMetaForObject(object);
      
      // If this is an attached pole, prevent independent movement
      if (meta && meta.attachedTo) {
        updateAttachedPolePosition(meta);
        canvas.requestRenderAll();
        return;
      }
      
      snapObjectTransform(object);
      updateObjectMetadata(object);
      
      // Update any poles attached to this gate
      if (meta && isGateConfig(meta.config)) {
        state.placedObjects.forEach((poleMeta) => {
          if (poleMeta.attachedTo === meta.id) {
            updateAttachedPolePosition(poleMeta);
          }
        });
      }
      
      canvas.requestRenderAll();
    });

    canvas.on("object:removed", (event) => {
      const object = event.target;
      const meta = getMetaForObject(object);
      if (meta) {
        // If a gate is deleted, detach any poles attached to it
        if (isGateConfig(meta.config)) {
          state.placedObjects.forEach((poleMeta) => {
            if (poleMeta.attachedTo === meta.id) {
              poleMeta.attachedTo = null;
              poleMeta.attachmentSide = null;
              poleMeta.attachedLevel = null;
            }
          });
        }
        
        state.metaByObjectId.delete(object);
        state.placedObjects = state.placedObjects.filter((entry) => entry.id !== meta.id);
        if (state.activeMeta && state.activeMeta.id === meta.id) {
          setActiveMeta(null);
        }
      }
    });

    canvas.on("mouse:down", (event) => {
      const domEvent = event.e;
      if (state.ruler.enabled && domEvent.button === 0 && !panState.keyActive) {
        const pointer = canvas.getPointer(domEvent);
        handleRulerClick(pointer);
        domEvent.preventDefault();
        domEvent.stopPropagation();
        return;
      }
      const isPanMouseButton = domEvent.button === 1 || domEvent.button === 2;
      if (panState.keyActive || isPanMouseButton) {
        startPan(domEvent);
        domEvent.preventDefault();
        domEvent.stopPropagation();
      }
    });

    canvas.on("mouse:move", (event) => {
      const pointer = canvas.getPointer(event.e);
      handleRulerMove(pointer);
      if (!panState.isDragging) {
        return;
      }
      const domEvent = event.e;
      continuePan(domEvent);
      domEvent.preventDefault();
      domEvent.stopPropagation();
    });

    canvas.on("mouse:up", () => {
      endPanInteraction();
    });

    canvas.on("mouse:out", () => {
      endPanInteraction();
    });

    canvas.on("mouse:wheel", (event) => {
      const delta = event.e.deltaY;
      if (!delta) {
        return;
      }
      const pointer = canvas.getPointer(event.e);
      const currentZoom = canvas.getZoom();
      const nextZoom =
        delta > 0 ? currentZoom * (1 - ZOOM_STEP) : currentZoom * (1 + ZOOM_STEP);
      applyZoom(nextZoom, { x: pointer.x, y: pointer.y });
      event.e.preventDefault();
      event.e.stopPropagation();
    });
  }

  /**
   * Register DOM event listeners.
   */
  function registerDomEvents() {
    elements.gridSizeInput.addEventListener("change", () => {
      sanitizeSettings();
      resnapAll();
    });
    elements.rotationSnapInput.addEventListener("change", () => {
      sanitizeSettings();
      resnapAll();
    });
    if (elements.importButton) {
      elements.importButton.addEventListener("click", handleImportButtonClick);
    }
    if (elements.importFileInput) {
      elements.importFileInput.addEventListener("change", handleImportFileChange);
    }
    elements.exportButton.addEventListener("click", exportXml);
    elements.deleteButton.addEventListener("click", deleteSelected);
    elements.duplicateButton.addEventListener("click", duplicateSelected);
    elements.resetViewButton.addEventListener("click", resetView);
    elements.clearSceneButton.addEventListener("click", () => {
      if (state.placedObjects.length === 0) {
        return;
      }
      const confirmation = confirm(
        "Remove all objects from the scene? This cannot be undone."
      );
      if (confirmation) {
        clearScene();
      }
    });
    elements.selectedAltitude.addEventListener("change", handleAltitudeChange);
    if (elements.attachGateSelect) {
      elements.attachGateSelect.addEventListener("change", handleAttachmentChange);
    }
    if (elements.attachSideSelect) {
      elements.attachSideSelect.addEventListener("change", handleAttachmentChange);
    }
    if (elements.attachLevelSelect) {
      elements.attachLevelSelect.addEventListener("change", handleAttachmentChange);
    }
    if (elements.gateStackCount) {
      elements.gateStackCount.addEventListener("change", handleGateStackChange);
    }
    if (elements.toggleReferencesButton) {
      elements.toggleReferencesButton.addEventListener("click", () => {
        state.showReferenceLayout = !state.showReferenceLayout;
        updateReferenceVisibility();
        updateReferenceToggleButton();
      });
    }
    if (elements.toggleSidebarsButton) {
      elements.toggleSidebarsButton.addEventListener("click", () => {
        state.sidebarsHidden = !state.sidebarsHidden;
        updateSidebarsVisibility();
      });
    }
    if (elements.measureToggle) {
      elements.measureToggle.addEventListener("click", () => {
        setRulerEnabled(!state.ruler.enabled);
      });
    }
    if (elements.zoomInButton) {
      elements.zoomInButton.addEventListener("click", () => {
        applyZoom(canvas.getZoom() * (1 + ZOOM_STEP));
      });
    }
    if (elements.zoomOutButton) {
      elements.zoomOutButton.addEventListener("click", () => {
        applyZoom(canvas.getZoom() * (1 - ZOOM_STEP));
      });
    }
    if (elements.zoomSlider) {
      elements.zoomSlider.min = Math.round(ZOOM_MIN * 100).toString();
      elements.zoomSlider.max = Math.round(ZOOM_MAX * 100).toString();
      elements.zoomSlider.addEventListener("input", (event) => {
        const value = Number(event.target.value);
        if (Number.isFinite(value)) {
          applyZoom(value / 100);
        }
      });
    }

    const handleKeyDown = (event) => {
      if (event.code === "Escape") {
        if (state.ruler.enabled) {
          resetRulerMeasurement();
          clearRulerGraphics();
          canvas.requestRenderAll();
        }
        return;
      }
      if (event.code !== "Space" || isEditableElement(event.target)) {
        return;
      }
      if (!panState.keyActive) {
        panState.keyActive = true;
        updatePanCursor();
      }
      event.preventDefault();
    };

    const handleKeyUp = (event) => {
      if (event.code !== "Space") {
        return;
      }
      panState.keyActive = false;
      updatePanCursor();
    };

    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mouseup", endPanInteraction);
    window.addEventListener("blur", () => {
      panState.keyActive = false;
      endPanInteraction();
    });
  }

  /**
   * Resnap all placed objects when settings change.
   */
  function resnapAll() {
    state.placedObjects.forEach((entry) => {
      snapObjectTransform(entry.fabricObject);
      updateObjectMetadata(entry.fabricObject);
      entry.fabricObject.setCoords();
    });
    canvas.requestRenderAll();
  }

  /**
   * Draw crosshair guidelines to indicate the origin. was using this for debugging, lowkey should remove it later
   */
  function drawOriginGuides() {
    const origin = getGridOrigin();
    const vertical = new fabric.Line([origin.x, 0, origin.x, canvasHeight], {
      stroke: "#90a4ae",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    const horizontal = new fabric.Line([0, origin.y, canvasWidth, origin.y], {
      stroke: "#90a4ae",
      strokeWidth: 1,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });

    canvas.add(vertical);
    canvas.add(horizontal);
    vertical.sendToBack();
    horizontal.sendToBack();
  }

  async function init() {
    sanitizeSettings();
    populatePalette();
    registerCanvasEvents();
    registerDomEvents();
    updateSidebarsVisibility();
    updateRulerUI();
    updatePanCursor();
    updateZoomUI();
    updateGridBackground();
    drawOriginGuides();
    await createReferenceObjects();
  }

  init().catch((error) => {
    console.error("Failed to initialize editor", error);
  });
})();

