import { createContext, useContext } from "react";
import type { CanvasController } from "./CanvasController";

export const CanvasControllerContext = createContext<CanvasController | null>(null);

export function useCanvasController(): CanvasController {
  const controller = useContext(CanvasControllerContext);
  if (!controller) {
    throw new Error("useCanvasController must be used within CanvasControllerContext.Provider");
  }
  return controller;
}

export function useOptionalCanvasController(): CanvasController | null {
  return useContext(CanvasControllerContext);
}
