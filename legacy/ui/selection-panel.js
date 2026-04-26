/**
 * Selected object panel + gate indicator controller.
 */
(() => {
  function createSelectionPanelController({
    state,
    elements,
    indicatorConfigs,
    addCheckpointToOrder,
  }) {
    let indicatorRenderToken = 0;

    function isIndicatorSupportedMeta(meta) {
      return Boolean(meta && meta.config && indicatorConfigs[meta.config.id]);
    }

    function getIndicatorConfig(meta) {
      if (!meta || !meta.config) {
        return null;
      }
      return indicatorConfigs[meta.config.id] || null;
    }

    function getIndicatorFaceElement(svg, faceId) {
      if (!svg || !faceId) {
        return null;
      }
      return svg.querySelector(`[id="${faceId}"]`);
    }

    function updateIndicatorModeOptions() {
      if (!elements.indicatorMode) {
        return;
      }
      const config = getIndicatorConfig(state.activeMeta);
      const options = config?.modeOptions || ["Entry", "Exit"];
      elements.indicatorMode.innerHTML = "";
      options.forEach((mode) => {
        const option = document.createElement("option");
        option.value = mode;
        option.textContent = mode;
        elements.indicatorMode.appendChild(option);
      });
      if (!options.includes(state.indicator.mode)) {
        state.indicator.mode = options[0];
      }
      elements.indicatorMode.value = state.indicator.mode;
    }

    function setSelectedPanelTab(tabKey) {
      state.selectedPanelTab = tabKey === "indicator" ? "indicator" : "properties";
      const indicatorEnabled = isIndicatorSupportedMeta(state.activeMeta);
      const showIndicator = indicatorEnabled && state.selectedPanelTab === "indicator";
      if (elements.selectedTabProperties) {
        elements.selectedTabProperties.classList.toggle("active", !showIndicator);
        elements.selectedTabProperties.setAttribute("aria-selected", !showIndicator ? "true" : "false");
      }
      if (elements.selectedTabIndicator) {
        elements.selectedTabIndicator.classList.toggle("active", showIndicator);
        elements.selectedTabIndicator.setAttribute("aria-selected", showIndicator ? "true" : "false");
      }
      if (elements.selectedPropertiesPanel) {
        elements.selectedPropertiesPanel.classList.toggle("hidden", showIndicator);
      }
      if (elements.selectedIndicatorPanel) {
        elements.selectedIndicatorPanel.classList.toggle("hidden", !showIndicator);
      }
    }

    async function renderIndicatorSvg() {
      if (!elements.indicatorSvgContainer) {
        return;
      }
      const config = getIndicatorConfig(state.activeMeta);
      if (!config) {
        elements.indicatorSvgContainer.innerHTML = "";
        elements.indicatorSvgContainer.dataset.indicatorType = "";
        return;
      }
      const renderToken = ++indicatorRenderToken;
      updateIndicatorModeOptions();
      let svgText = "";
      try {
        const response = await fetch(config.path, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load ${config.path}: ${response.status}`);
        }
        svgText = await response.text();
        if (renderToken !== indicatorRenderToken) {
          return;
        }
      } catch (error) {
        console.error("Failed to load indicator SVG", error);
        elements.indicatorSvgContainer.innerHTML = "<p>Failed to load indicator SVG.</p>";
        return;
      }
      if (renderToken !== indicatorRenderToken) {
        return;
      }
      elements.indicatorSvgContainer.innerHTML = svgText;
      elements.indicatorSvgContainer.dataset.indicatorType = state.activeMeta?.config?.id || "";
      const svg = elements.indicatorSvgContainer.querySelector("svg");
      if (!svg) {
        return;
      }
      Object.keys(config.faceMap).forEach((faceId) => {
        const group = getIndicatorFaceElement(svg, faceId);
        if (!group) {
          return;
        }
        group.classList.add("indicator-face");
        group.addEventListener("click", () => {
          state.indicator.selectedFace = faceId;
          updateIndicatorSelection();
        });
      });
      updateIndicatorSelection();
    }

    function updateIndicatorSelection() {
      const config = getIndicatorConfig(state.activeMeta);
      const faceMap = config?.faceMap || {};
      if (elements.indicatorModeField) {
        const showMode = (config?.checkpointStyle || "faceWithMode") !== "entityOnly";
        elements.indicatorModeField.classList.toggle("hidden", !showMode);
      }
      if (elements.indicatorSelectedFace) {
        const suffix = faceMap[state.indicator.selectedFace] || "None";
        elements.indicatorSelectedFace.textContent = suffix;
      }
      const svg = elements.indicatorSvgContainer?.querySelector("svg");
      if (!svg) {
        return;
      }
      Object.keys(faceMap).forEach((faceId) => {
        const group = getIndicatorFaceElement(svg, faceId);
        if (!group) {
          return;
        }
        group.classList.toggle("active", state.indicator.selectedFace === faceId);
      });
      if (elements.indicatorSvgContainer) {
        const modeValue = (state.indicator.mode || "Entry").toLowerCase();
        elements.indicatorSvgContainer.dataset.mode = modeValue;
        elements.indicatorSvgContainer.classList.toggle(
          "mode-exit",
          modeValue === "exit" || modeValue === "back"
        );
        elements.indicatorSvgContainer.classList.toggle("mode-back", modeValue === "back");
      }
    }

    function addIndicatorCheckpoint() {
      if (!state.activeMeta || !isIndicatorSupportedMeta(state.activeMeta)) {
        return;
      }
      const config = getIndicatorConfig(state.activeMeta);
      const faceSuffix = config?.faceMap?.[state.indicator.selectedFace];
      if (!faceSuffix) {
        alert("Select a cube face first.");
        return;
      }
      if ((config?.checkpointStyle || "faceWithMode") === "entityOnly") {
        addCheckpointToOrder(state.activeMeta.entityName);
        return;
      }
      const mode = state.indicator.mode || "Entry";
      const modeJoiner = config?.modeJoiner ?? "";
      addCheckpointToOrder(`${state.activeMeta.entityName}.${faceSuffix}${modeJoiner}${mode}`);
    }

    return {
      isIndicatorSupportedMeta,
      getIndicatorConfig,
      getIndicatorFaceElement,
      updateIndicatorModeOptions,
      setSelectedPanelTab,
      renderIndicatorSvg,
      updateIndicatorSelection,
      addIndicatorCheckpoint,
    };
  }

  if (typeof window !== "undefined") {
    window.SelectionPanelUI = { createSelectionPanelController };
  }
})();
