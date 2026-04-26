import { useEffect } from "react";
import { useEditorStore, type ThemeMode } from "@/store/editorStore";

/**
 * Subscribes to the theme value in the store and applies/removes the `.dark`
 * class on the root element. Honors `system` by following the user's
 * preferred-color-scheme media query.
 */
export function useTheme(): {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  resolved: "light" | "dark";
} {
  const theme = useEditorStore((s) => s.theme);
  const setTheme = useEditorStore((s) => s.setTheme);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const apply = () => {
      const resolved =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
    };

    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
    return undefined;
  }, [theme]);

  const resolved: "light" | "dark" =
    theme === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;

  return { theme, setTheme, resolved };
}
