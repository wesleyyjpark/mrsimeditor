/**
 * Gate order UI controller.
 */
(() => {
  function createGateOrderController({ state, elements }) {
    function updateGateOrderUI() {
      if (!elements.gateOrderList || !elements.gateOrderEmpty) {
        return;
      }
      elements.gateOrderList.innerHTML = "";
      state.checkpointOrder.forEach((checkpoint, index) => {
        const item = document.createElement("li");
        item.className = "gate-order-item";
        const text = document.createElement("span");
        text.className = "gate-order-item-text";
        text.textContent = checkpoint;
        item.appendChild(text);

        const moveUp = document.createElement("button");
        moveUp.type = "button";
        moveUp.textContent = "↑";
        moveUp.disabled = index === 0;
        moveUp.addEventListener("click", () => moveCheckpoint(index, -1));
        item.appendChild(moveUp);

        const moveDown = document.createElement("button");
        moveDown.type = "button";
        moveDown.textContent = "↓";
        moveDown.disabled = index === state.checkpointOrder.length - 1;
        moveDown.addEventListener("click", () => moveCheckpoint(index, 1));
        item.appendChild(moveDown);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "danger";
        remove.textContent = "Remove";
        remove.addEventListener("click", () => {
          state.checkpointOrder.splice(index, 1);
          updateGateOrderUI();
        });
        item.appendChild(remove);
        elements.gateOrderList.appendChild(item);
      });

      elements.gateOrderEmpty.classList.toggle("hidden", state.checkpointOrder.length > 0);
    }

    function moveCheckpoint(index, delta) {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= state.checkpointOrder.length) {
        return;
      }
      const [item] = state.checkpointOrder.splice(index, 1);
      state.checkpointOrder.splice(nextIndex, 0, item);
      updateGateOrderUI();
    }

    function addCheckpointToOrder(value) {
      const checkpoint = (value || "").trim();
      if (!checkpoint) {
        return;
      }
      state.checkpointOrder.push(checkpoint);
      if (elements.gateOrderInput) {
        elements.gateOrderInput.value = "";
      }
      updateGateOrderUI();
    }

    function refreshCheckpointOrderUI() {
      updateGateOrderUI();
    }

    return {
      updateGateOrderUI,
      moveCheckpoint,
      addCheckpointToOrder,
      refreshCheckpointOrderUI,
    };
  }

  if (typeof window !== "undefined") {
    window.GateOrderUI = { createGateOrderController };
  }
})();
