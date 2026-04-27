import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { INDICATOR_CONFIGS } from "../data/indicator-config";
import { useEditorStore } from "../store/editorStore";
import type { IndicatorMode } from "../types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function IndicatorPanel() {
  const selected = useEditorStore((s) => s.selected);
  const indicatorSelectedFace = useEditorStore((s) => s.indicatorSelectedFace);
  const setIndicatorSelectedFace = useEditorStore((s) => s.setIndicatorSelectedFace);
  const indicatorMode = useEditorStore((s) => s.indicatorMode);
  const setIndicatorMode = useEditorStore((s) => s.setIndicatorMode);
  const addCheckpoint = useEditorStore((s) => s.addCheckpoint);

  const config = selected ? INDICATOR_CONFIGS[selected.config.id] : null;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string>("");

  const modeOptions: IndicatorMode[] = useMemo(
    () => (config?.modeOptions || ["Entry", "Exit"]) as IndicatorMode[],
    [config]
  );

  useEffect(() => {
    if (!modeOptions.includes(indicatorMode)) {
      setIndicatorMode(modeOptions[0]);
    }
  }, [modeOptions, indicatorMode, setIndicatorMode]);

  useEffect(() => {
    if (!config) return;
    if (indicatorSelectedFace && !config.faceMap[indicatorSelectedFace]) {
      setIndicatorSelectedFace(null);
    }
  }, [config, indicatorSelectedFace, setIndicatorSelectedFace]);

  useEffect(() => {
    let cancelled = false;
    if (!config) {
      setSvgText("");
      return;
    }
    fetch(config.path, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${config.path}: ${response.status}`);
        return response.text();
      })
      .then((text) => {
        if (!cancelled) setSvgText(text);
      })
      .catch((err) => {
        console.error("Failed to load indicator SVG", err);
        if (!cancelled) setSvgText("<p>Failed to load indicator SVG.</p>");
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  useEffect(() => {
    if (!config || !containerRef.current) return;
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;
    const cleanups: (() => void)[] = [];
    Object.keys(config.faceMap).forEach((faceId) => {
      const group = svg.querySelector(`[id="${faceId}"]`);
      if (!group) return;
      group.classList.add("indicator-face");
      const handler = () => setIndicatorSelectedFace(faceId);
      group.addEventListener("click", handler);
      cleanups.push(() => group.removeEventListener("click", handler));
    });
    return () => cleanups.forEach((fn) => fn());
  }, [svgText, config, setIndicatorSelectedFace]);

  useEffect(() => {
    if (!config || !containerRef.current) return;
    const svg = containerRef.current.querySelector("svg");
    if (!svg) return;
    Object.keys(config.faceMap).forEach((faceId) => {
      const group = svg.querySelector(`[id="${faceId}"]`);
      if (!group) return;
      group.classList.toggle("active", indicatorSelectedFace === faceId);
    });
  }, [indicatorSelectedFace, svgText, config]);

  if (!selected || !config) return null;

  const showMode = config.checkpointStyle !== "entityOnly";
  const modeValue = indicatorMode.toLowerCase();
  const containerClass = cn(
    "indicator-svg-container",
    (modeValue === "exit" || modeValue === "back") && "mode-exit",
    modeValue === "back" && "mode-back"
  );

  const faceSuffix = indicatorSelectedFace
    ? config.faceMap[indicatorSelectedFace] || "None"
    : "None";

  const handleAdd = () => {
    if (!faceSuffix || faceSuffix === "None") {
      toast.warning("Select a cube face first.");
      return;
    }
    if (config.checkpointStyle === "entityOnly") {
      addCheckpoint(selected.entityName);
      toast.success("Checkpoint added");
      return;
    }
    const modeJoiner = config.modeJoiner ?? "";
    addCheckpoint(`${selected.entityName}.${faceSuffix}${modeJoiner}${indicatorMode}`);
    toast.success("Checkpoint added");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Face</span>
        <Badge variant={faceSuffix === "None" ? "outline" : "secondary"}>
          {faceSuffix}
        </Badge>
      </div>

      {showMode ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Select
            value={indicatorMode}
            onValueChange={(v) => setIndicatorMode(v as IndicatorMode)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modeOptions.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <Button onClick={handleAdd} className="w-full" size="sm">
        <Plus className="mr-2 h-4 w-4" />
        Add to Gate Order
      </Button>

      <div
        ref={containerRef}
        className={containerClass}
        data-mode={modeValue}
        dangerouslySetInnerHTML={{ __html: svgText }}
      />
    </div>
  );
}
