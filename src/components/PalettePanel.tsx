import { useMemo, useState } from "react";
import { ChevronLeft, Search, Star } from "lucide-react";
import { OBJECT_CATALOG } from "../data/objects";
import { useEditorStore } from "../store/editorStore";
import { useOptionalCanvasController } from "../canvas/controllerContext";
import type { ObjectConfig, PaletteCategory } from "../types";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TABS: { id: PaletteCategory; label: string }[] = [
  { id: "favorites", label: "Favorites" },
  { id: "standard", label: "Standard" },
  { id: "champs", label: "Champ" },
];

function buildDragPreview(entry: ObjectConfig): HTMLCanvasElement {
  const dragPreviewCanvas = document.createElement("canvas");
  dragPreviewCanvas.width = 48;
  dragPreviewCanvas.height = 48;
  dragPreviewCanvas.style.position = "fixed";
  dragPreviewCanvas.style.left = "-9999px";
  dragPreviewCanvas.style.top = "-9999px";
  dragPreviewCanvas.style.pointerEvents = "none";
  const ctx = dragPreviewCanvas.getContext("2d");
  if (ctx) {
    const baseColor = entry.fillColor || entry.color || "#3f51b5";
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(0, 0, dragPreviewCanvas.width, dragPreviewCanvas.height);
    ctx.save();
    ctx.translate(dragPreviewCanvas.width / 2, dragPreviewCanvas.height / 2);
    const size = 28;
    if (entry.renderStyle === "point") {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.fill();
    } else if (entry.renderStyle === "outline") {
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 6, size, size / 3);
    } else if (entry.renderStyle === "rectWithCenterLine") {
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 3, size, size / 1.5);
      ctx.beginPath();
      ctx.moveTo(-size / 2, 0);
      ctx.lineTo(size / 2, 0);
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-size / 2, -size / 3, size, size / 1.5);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(-size / 2, -size / 3, size, size / 1.5);
    }
    if (entry.labelText) {
      ctx.fillStyle = baseColor;
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      ctx.fillText(entry.labelText, size / 2 - 2, -size / 3 + 2);
    }
    ctx.restore();
  }
  return dragPreviewCanvas;
}

export function PalettePanel() {
  const paletteTab = useEditorStore((s) => s.paletteTab);
  const setPaletteTab = useEditorStore((s) => s.setPaletteTab);
  const togglePaletteCollapsed = useEditorStore((s) => s.togglePaletteCollapsed);
  const controller = useOptionalCanvasController();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OBJECT_CATALOG.filter((entry) => {
      if (entry.paletteHidden) return false;
      const categories = Array.isArray(entry.paletteCategories)
        ? entry.paletteCategories
        : entry.paletteCategory
          ? [entry.paletteCategory]
          : ["standard"];
      if (!categories.includes(paletteTab)) return false;
      if (!q) return true;
      return (
        entry.label.toLowerCase().includes(q) ||
        entry.id.toLowerCase().includes(q) ||
        (entry.labelText ?? "").toLowerCase().includes(q)
      );
    });
  }, [paletteTab, query]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Star className="h-4 w-4 text-primary" />
          Object Palette
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Collapse palette"
              onClick={togglePaletteCollapsed}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Collapse palette</TooltipContent>
        </Tooltip>
      </div>
      <div className="space-y-2 px-3 pb-2 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search objects…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Tabs
          value={paletteTab}
          onValueChange={(v) => setPaletteTab(v as PaletteCategory)}
        >
          <TabsList className="grid w-full grid-cols-3">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <ScrollArea className="flex-1 thin-scrollbar">
        <div className="grid grid-cols-2 gap-2 p-3 pt-1">
          {filtered.map((entry) => {
            const previewImagePath = entry.previewImage || entry.icon || "";
            return (
              <Tooltip key={entry.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    draggable
                    data-type-id={entry.id}
                    onClick={() => controller?.addObjectToScene(entry.id)}
                    onDragStart={(event) => {
                      if (!event.dataTransfer) return;
                      event.dataTransfer.setData("text/plain", entry.id);
                      event.dataTransfer.effectAllowed = "copy";
                      const preview = buildDragPreview(entry);
                      document.body.appendChild(preview);
                      event.dataTransfer.setDragImage(preview, 24, 24);
                      setTimeout(() => preview.remove(), 0);
                    }}
                    className={cn(
                      "group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-2 text-card-foreground shadow-sm transition-all",
                      "hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      "active:scale-[0.97]"
                    )}
                  >
                    {previewImagePath ? (
                      <img
                        className="h-12 w-12 object-contain"
                        alt={`${entry.label} preview`}
                        src={previewImagePath}
                        draggable={false}
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded bg-muted text-muted-foreground">
                        <Star className="h-5 w-5" />
                      </div>
                    )}
                    <span className="line-clamp-1 text-[11px] font-medium leading-tight text-center">
                      {entry.label}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="space-y-0.5">
                    <div className="font-medium">{entry.label}</div>
                    {entry.placement === "macro" ? (
                      <div className="text-[10px] text-muted-foreground">
                        Macro: {entry.macroName}
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">
                        {entry.includeFile}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      Click or drag to add
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          {filtered.length === 0 ? (
            <div className="col-span-2 py-8 text-center text-xs text-muted-foreground">
              No objects match "{query}"
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}
