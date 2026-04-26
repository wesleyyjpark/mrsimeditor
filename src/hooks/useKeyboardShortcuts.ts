import { useEffect } from "react";
import { useEditorStore } from "@/store/editorStore";
import { useOptionalCanvasController } from "@/canvas/controllerContext";
import { useHistoryStore } from "@/store/historyStore";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Central key registry. Bind in <App> via <KeyboardLayer />.
 *
 * Layout:
 *   - Single-key actions (S, L, R, F, B, ?, Delete, +, -, Esc, Ctrl+D)
 *   - Modifier-key actions (Ctrl+K, Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y)
 */
export function useKeyboardShortcuts() {
  const controller = useOptionalCanvasController();
  const toggleCommandPalette = useEditorStore((s) => s.toggleCommandPalette);
  const toggleShortcuts = useEditorStore((s) => s.toggleShortcuts);
  const toggleSidebars = useEditorStore((s) => s.toggleSidebarsHidden);
  const setSnap = useEditorStore((s) => s.setSnappingEnabled);
  const setRuler = useEditorStore((s) => s.setRulerEnabled);
  const toggleReference = useEditorStore((s) => s.toggleShowReferenceLayout);

  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const meta = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key = e.key;

      if (meta && (key === "k" || key === "K")) {
        e.preventDefault();
        toggleCommandPalette();
        return;
      }

      if (meta && (key === "z" || key === "Z")) {
        e.preventDefault();
        if (shift) redo();
        else undo();
        return;
      }
      if (meta && (key === "y" || key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (meta && (key === "d" || key === "D")) {
        e.preventDefault();
        controller?.duplicateSelected();
        return;
      }

      if (meta) return;

      switch (key) {
        case "?":
          e.preventDefault();
          toggleShortcuts();
          break;
        case "b":
        case "B":
          e.preventDefault();
          toggleSidebars();
          break;
        case "s":
        case "S":
          e.preventDefault();
          setSnap(!useEditorStore.getState().snappingEnabled);
          break;
        case "l":
        case "L":
          e.preventDefault();
          setRuler(!useEditorStore.getState().rulerEnabled);
          break;
        case "r":
        case "R":
          e.preventDefault();
          toggleReference();
          break;
        case "f":
        case "F":
          e.preventDefault();
          controller?.resetView();
          break;
        case "+":
        case "=":
          e.preventDefault();
          controller?.zoomIn();
          break;
        case "-":
        case "_":
          e.preventDefault();
          controller?.zoomOut();
          break;
        case "Delete":
        case "Backspace":
          if (controller && useEditorStore.getState().selected) {
            e.preventDefault();
            controller.deleteSelected();
          }
          break;
        case "Escape":
          if (useEditorStore.getState().commandPaletteOpen) {
            useEditorStore.getState().closeCommandPalette();
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    controller,
    toggleCommandPalette,
    toggleShortcuts,
    toggleSidebars,
    setSnap,
    setRuler,
    toggleReference,
    undo,
    redo,
  ]);
}
