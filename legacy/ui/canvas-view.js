/**
 * Canvas tab/panel view controller.
 */
(() => {
  function createCanvasViewController({ state, elements, refreshCheckpointOrderUI }) {
    function setCanvasView(view) {
      const next = view === "gate-order" ? "gate-order" : "editor";
      state.canvasView = next;
      const isGateOrder = next === "gate-order";

      if (elements.editorCanvasPanel) {
        elements.editorCanvasPanel.classList.toggle("hidden", isGateOrder);
        elements.editorCanvasPanel.setAttribute("aria-hidden", isGateOrder ? "true" : "false");
      }
      if (elements.gateOrderPanel) {
        elements.gateOrderPanel.classList.toggle("hidden", !isGateOrder);
        elements.gateOrderPanel.setAttribute("aria-hidden", !isGateOrder ? "true" : "false");
      }
      if (elements.canvasTabEditor) {
        elements.canvasTabEditor.classList.toggle("active", !isGateOrder);
        elements.canvasTabEditor.setAttribute("aria-selected", !isGateOrder ? "true" : "false");
      }
      if (elements.canvasTabGateOrder) {
        elements.canvasTabGateOrder.classList.toggle("active", isGateOrder);
        elements.canvasTabGateOrder.setAttribute("aria-selected", isGateOrder ? "true" : "false");
      }
      if (isGateOrder && typeof refreshCheckpointOrderUI === "function") {
        refreshCheckpointOrderUI();
      }
    }

    return {
      setCanvasView,
    };
  }

  if (typeof window !== "undefined") {
    window.CanvasViewUI = { createCanvasViewController };
  }
})();
