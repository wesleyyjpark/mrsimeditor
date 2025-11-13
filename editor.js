
(() => {
  const PIXELS_PER_METER = 40;
  const catalog = (typeof window !== "undefined" && window.OBJECT_CATALOG) || [];
  const lookup = (typeof window !== "undefined" && window.OBJECT_LOOKUP) || {};
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

    ctx.strokeStyle = "rgba(33, 33, 33, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 1; i < majorMultiplier; i += 1) {
      const offset = i * baseSpacingPx - 0.5;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, majorSizePx);
      ctx.moveTo(0, offset);
      ctx.lineTo(majorSizePx, offset);
      ctx.stroke();
    }

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
    const offsetX = -((origin.x % baseSpacingPx) || 0);
    const offsetY = -((origin.y % baseSpacingPx) || 0);
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

  const elements = {
    palette: document.getElementById("object-palette"),
    gridSizeInput: document.getElementById("grid-size-input"),
    rotationSnapInput: document.getElementById("rotation-snap-input"),
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
   * Build an entity name with a numeric suffix (e.g. gate1, gate2).
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
      const button = document.createElement("button");
      button.type = "button";

      const labelSpan = document.createElement("span");
      labelSpan.className = "label";
      labelSpan.textContent = entry.label;

      const includeSpan = document.createElement("span");
      includeSpan.className = "include";
      includeSpan.textContent =
        entry.placement === "macro"
          ? `Macro: ${entry.macroName}`
          : entry.includeFile.replace("/Data/Simulations/Multirotor/", "");

      button.appendChild(labelSpan);
      button.appendChild(includeSpan);

      button.addEventListener("click", () => {
        addObjectToScene(entry.id);
      });

      elements.palette.appendChild(button);
    });
  }

  /**
   * Convert fabric object's current center position to meters.
   */
  function getObjectPositionMeters(object) {
    const origin = getGridOrigin();
    const xMeters = (object.left - origin.x) / PIXELS_PER_METER;
    const yMeters = (origin.y - object.top) / PIXELS_PER_METER;
    return { x: xMeters, y: yMeters };
  }

  /**
   * Snap object position and rotation to configured increments.
   */
  function snapObjectTransform(object) {
    const origin = getGridOrigin();
    const gridPx = state.gridSizeMeters * PIXELS_PER_METER;
    const snappedX = Math.round((object.left - origin.x) / gridPx);
    const snappedY = Math.round((origin.y - object.top) / gridPx);
    const snappedLeft = origin.x + snappedX * gridPx;
    const snappedTop = origin.y - snappedY * gridPx;
    const snappedAngle =
      Math.round(object.angle / state.rotationSnap) * state.rotationSnap;

    object.set({
      left: snappedLeft,
      top: snappedTop,
      angle: snappedAngle,
    });

    object.setCoords();
  }

  function placeObjectAt(object, position = {}) {
    const origin = getGridOrigin();
    const x = position.x ?? 0;
    const y = position.y ?? 0;
    const angle = position.angle ?? 0;

    object.set({
      left: origin.x + x * PIXELS_PER_METER,
      top: origin.y - y * PIXELS_PER_METER,
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
    const widthPx = config.width * PIXELS_PER_METER;
    const heightPx = config.height * PIXELS_PER_METER;
    const shadow = config.shadow || null;

    if (config.icon) {
      return new Promise((resolve, reject) => {
        fabric.Image.fromURL(
          config.icon,
          (img) => {
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
        (config.width && config.height
          ? ((config.width + config.height) / 2) * PIXELS_PER_METER
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
   * Refresh inspector UI based on selection.
   */
  function refreshSelectionPanel() {
    const meta = state.activeMeta;
    if (!meta) {
      elements.selectedDetails.classList.add("hidden");
      elements.selectedNone.classList.remove("hidden");
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
      };

      cloned.data = { typeId: meta.config.id };
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
    lines.push('  <Include file="/Data/Simulations/Multirotor/Locations/BaylandsPark.xml"/>');
    lines.push('  <Include file="/Data/Simulations/Multirotor/DroneTrackInstanceGroups.xml"/>');
    lines.push('  <Include file="/Data/Simulations/Multirotor/Gates/PoleGates.xml"/>');
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

    state.placedObjects.forEach((entry) => {
      const object = entry.fabricObject;
      const pos = getObjectPositionMeters(object);

      const forward = pos.y;
      const lateral = pos.x;
      const rotatedForward = forward * cosR - lateral * sinR;
      const rotatedLateral = forward * sinR + lateral * cosR;
      const finalX = rotatedForward + offsetForward;
      const finalY = -rotatedLateral + offsetLateral;
      const finalAngle = normalizeAngle(object.angle + globalRotationDegrees + 90);
      const altitude = entry.altitude || 0;

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
      snapObjectTransform(object);
      updateObjectMetadata(object);
      canvas.requestRenderAll();
    });

    canvas.on("object:removed", (event) => {
      const object = event.target;
      const meta = getMetaForObject(object);
      if (meta) {
        state.metaByObjectId.delete(object);
        state.placedObjects = state.placedObjects.filter((entry) => entry.id !== meta.id);
        if (state.activeMeta && state.activeMeta.id === meta.id) {
          setActiveMeta(null);
        }
      }
    });

    canvas.on("mouse:down", (event) => {
      const domEvent = event.e;
      const isPanMouseButton = domEvent.button === 1 || domEvent.button === 2;
      if (!panState.keyActive && !isPanMouseButton) {
        return;
      }
      startPan(domEvent);
      domEvent.preventDefault();
      domEvent.stopPropagation();
    });

    canvas.on("mouse:move", (event) => {
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

