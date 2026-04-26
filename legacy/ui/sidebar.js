/**
 * Sidebar UI controller.
 */
(() => {
  function createSidebarController({ layout, canvas, state, elements, onLayoutChanged }) {
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
      if (typeof onLayoutChanged === "function") {
        onLayoutChanged();
      }
    }

    function updatePaletteSidebarUI() {
      if (layout) {
        layout.classList.toggle("palette-collapsed", state.paletteCollapsed);
      }
      if (elements.togglePaletteSidebarButton) {
        elements.togglePaletteSidebarButton.textContent = state.paletteCollapsed ? ">" : "<";
        elements.togglePaletteSidebarButton.setAttribute(
          "aria-pressed",
          state.paletteCollapsed ? "true" : "false"
        );
        elements.togglePaletteSidebarButton.setAttribute(
          "aria-label",
          state.paletteCollapsed ? "Expand object palette" : "Collapse object palette"
        );
      }
      if (typeof onLayoutChanged === "function") {
        onLayoutChanged();
      }
    }

    function setMiscTab(tabKey) {
      state.miscTab = tabKey === "transform" ? "transform" : "snapping";
      const showSnapping = state.miscTab === "snapping";
      if (elements.miscTabSnapping) {
        elements.miscTabSnapping.classList.toggle("active", showSnapping);
        elements.miscTabSnapping.setAttribute("aria-pressed", showSnapping ? "true" : "false");
      }
      if (elements.miscTabTransform) {
        elements.miscTabTransform.classList.toggle("active", !showSnapping);
        elements.miscTabTransform.setAttribute("aria-pressed", !showSnapping ? "true" : "false");
      }
      if (elements.rightPanelSnapping) {
        elements.rightPanelSnapping.classList.toggle("hidden", !showSnapping);
      }
      if (elements.rightPanelTransform) {
        elements.rightPanelTransform.classList.toggle("hidden", showSnapping);
      }
    }

    function setRightSidebarTab(tabKey) {
      state.rightSidebarTab = tabKey === "misc" ? "misc" : "none";
      const showMisc = state.rightSidebarTab === "misc";
      if (elements.rightTabMisc) {
        elements.rightTabMisc.classList.toggle("active", showMisc);
        elements.rightTabMisc.setAttribute("aria-pressed", showMisc ? "true" : "false");
      }
      if (elements.rightPanelMisc) {
        elements.rightPanelMisc.classList.toggle("hidden", !showMisc);
      }
      if (!showMisc) {
        if (elements.rightPanelSnapping) {
          elements.rightPanelSnapping.classList.add("hidden");
        }
        if (elements.rightPanelTransform) {
          elements.rightPanelTransform.classList.add("hidden");
        }
        return;
      }
      setMiscTab(state.miscTab);
    }

    return {
      updateSidebarsVisibility,
      updatePaletteSidebarUI,
      setRightSidebarTab,
      setMiscTab,
    };
  }

  if (typeof window !== "undefined") {
    window.SidebarUI = { createSidebarController };
  }
})();
