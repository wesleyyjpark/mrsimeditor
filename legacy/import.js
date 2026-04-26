/**
 * Handles all import and export functionality to MRSIM
 * Encapsulates XML import/export and related file handlers.
 */
(() => {
  function createController(deps) {
    const {
      state,
      canvas,
      elements,
      catalog,
      lookup,
      createFabricObject,
      applyVisualDefaults,
      placeObjectAt,
      allocateEntityName,
      createUniqueId,
      updateObjectMetadata,
      clearScene,
      parseEditorMeta,
      invertGlobalTransform,
      normalizeEditorAngle,
      updateAttachedPolePosition,
      resnapAll,
      refreshSelectionPanel,
      buildEditorMeta,
      centeredGateMacros,
      canopyExportBlock,
      getObjectPositionMeters,
      normalizeAngle,
      downloadText,
      getGateStackCount,
      isStackableGateConfig,
      getGateStackSpacing,
      onSceneChanged,
    } = deps;

    function parseCheckpointOrder(doc, xmlText) {
      const rawText =
        doc?.querySelector("CheckpointList")?.textContent ||
        (typeof xmlText === "string"
          ? (xmlText.match(/<CheckpointList>[\s\S]*?<\/CheckpointList>/i) || [])[0] || ""
          : "");
      if (!rawText) {
        return [];
      }
      const checkpointsBlock = rawText.match(/checkpoints\s*:\s*\[([\s\S]*?)\]/i);
      if (!checkpointsBlock) {
        return [];
      }
      const result = [];
      const pattern = /"([^"]+)"|'([^']+)'/g;
      let match = pattern.exec(checkpointsBlock[1]);
      while (match) {
        result.push(match[1] || match[2]);
        match = pattern.exec(checkpointsBlock[1]);
      }
      return result;
    }

    function updateEntityCounterFromName(name) {
      if (!name || name === "Track") {
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

      const safeEntityName =
        meta?.entityName && meta.entityName !== "Track"
          ? meta.entityName
          : allocateEntityName(config.entityPrefix);
      const metadata = {
        id: meta?.id || createUniqueId(),
        config,
        fabricObject,
        entityName: safeEntityName,
        altitude: Number.isFinite(position.altitude) ? position.altitude : config.altitude ?? 0,
        attachedTo: meta?.attachedTo || null,
        attachmentSide: meta?.attachmentSide || null,
        attachedLevel: meta?.attachedLevel || null,
        attachedCubeTo: meta?.attachedCubeTo || null,
        attachedCubeCorner: meta?.attachedCubeCorner || null,
        stackCount: meta?.stackCount,
      };

      updateEntityCounterFromName(metadata.entityName);

      state.placedObjects.push(metadata);
      state.metaByObjectId.set(fabricObject, metadata);
      updateObjectMetadata(fabricObject);
      return metadata;
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
      state.checkpointOrder = parseCheckpointOrder(doc, xmlText);

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

        if (
          entity.getAttribute("name") === "Track" &&
          !meta?.typeId &&
          !entity.querySelector("Instance") &&
          !entity.querySelector("Include")
        ) {
          continue;
        }

        if (!typeConfig) {
          console.warn("Skipping unknown object in import:", entity.getAttribute("name"));
          continue;
        }

        const rawEntityName = meta?.entityName || entity.getAttribute("name") || "";
        const entityName = rawEntityName === "Track" ? "" : rawEntityName;

        const position = {
          x: lateral,
          y: forward,
          angle: normalizeEditorAngle(angleDegrees - globalRotation - 90),
          altitude,
        };

        const importedMeta = await addObjectFromImport(typeConfig, position, {
          id: meta?.id,
          entityName,
          attachedTo: meta?.attachedTo,
          attachmentSide: meta?.attachmentSide,
          attachedLevel: meta?.attachedLevel,
          attachedCubeTo: meta?.attachedCubeTo,
          attachedCubeCorner: meta?.attachedCubeCorner,
          stackCount: meta?.stackCount,
        });

        if (meta?.id) {
          importMetaById.set(meta.id, importedMeta);
        }
      }

      state.placedObjects.forEach((entry) => {
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
          updateAttachedPolePosition(entry);
        }
      });

      resnapAll();
      refreshSelectionPanel();
      canvas.requestRenderAll();
      if (typeof onSceneChanged === "function") {
        onSceneChanged();
      }
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
      centeredGateMacros.forEach((line) => lines.push(line));
      lines.push("");
      canopyExportBlock.forEach((line) => lines.push(line));
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

      const gatePositions = [];
      const GATE_WIDTH = 2.1;

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

          for (const existingGate of gatePositions) {
            const dx = finalX - existingGate.x;
            const dy = finalY - existingGate.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 0 && distance < GATE_WIDTH) {
              const angle = Math.atan2(dy, dx);
              const neededSeparation = GATE_WIDTH - distance;
              finalX += Math.cos(angle) * neededSeparation;
              finalY += Math.sin(angle) * neededSeparation;
            }
          }

          gatePositions.push({ x: finalX, y: finalY, entry });
        }
      });

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

        const adjustedPos = gatePositionsMap.get(entry);
        const finalX = adjustedPos ? adjustedPos.x : rotatedForward + offsetForward;
        const finalY = adjustedPos ? adjustedPos.y : -rotatedLateral + offsetLateral;

        const finalAngle = normalizeAngle(object.angle + globalRotationDegrees + 90);
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

      lines.push("      <CheckpointList>");
      lines.push("        {");
      lines.push("            isCircuit: true,");
      lines.push("            checkpoints:");
      lines.push("            [");
      if (Array.isArray(state.checkpointOrder) && state.checkpointOrder.length > 0) {
        state.checkpointOrder.forEach((checkpoint, index) => {
          const suffix = index === state.checkpointOrder.length - 1 ? "" : ",";
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

    return {
      importXmlFromText,
      handleImportButtonClick,
      handleImportFileChange,
      exportXml,
    };
  }

  if (typeof window !== "undefined") {
    window.Import = { createController };
  }
})();
