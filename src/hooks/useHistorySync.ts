import { useEffect } from "react";
import { useOptionalCanvasController } from "@/canvas/controllerContext";
import { registerHistoryController, useHistoryStore } from "@/store/historyStore";

/**
 * Connects the canvas controller into the history store so undo/redo hotkeys work.
 * Mounted once near the top of the React tree.
 */
export function useHistorySync(): void {
  const controller = useOptionalCanvasController();

  useEffect(() => {
    if (!controller) return;
    registerHistoryController({
      getSnapshot: () => controller.getSnapshot(),
      loadSnapshot: (snapshot) => controller.loadSnapshot(snapshot),
    });
    useHistoryStore.getState().reset();
    return () => registerHistoryController(null);
  }, [controller]);
}
