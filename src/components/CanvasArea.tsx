import { useEffect } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Grid,
  Maximize2,
  Minus,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Ruler,
  Settings2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useEditorStore } from "../store/editorStore";
import { useOptionalCanvasController } from "../canvas/controllerContext";
import { GateOrderPanel } from "./GateOrderPanel";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Kbd } from "@/components/ui/kbd";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface CanvasAreaProps {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function CanvasArea({ canvasRef, wrapperRef }: CanvasAreaProps) {
  const canvasView = useEditorStore((s) => s.canvasView);
  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const showReference = useEditorStore((s) => s.showReferenceLayout);
  const toggleShowReference = useEditorStore((s) => s.toggleShowReferenceLayout);
  const snappingEnabled = useEditorStore((s) => s.snappingEnabled);
  const setSnappingEnabled = useEditorStore((s) => s.setSnappingEnabled);
  const placedSummary = useEditorStore((s) => s.placedSummary);
  const rulerEnabled = useEditorStore((s) => s.rulerEnabled);
  const setRulerEnabled = useEditorStore((s) => s.setRulerEnabled);
  const sidebarsHidden = useEditorStore((s) => s.sidebarsHidden);
  const toggleSidebarsHidden = useEditorStore((s) => s.toggleSidebarsHidden);
  const zoom = useEditorStore((s) => s.zoom);
  const controller = useOptionalCanvasController();

  useEffect(() => {
    if (canvasView === "editor" && controller && wrapperRef.current) {
      controller.observeWrapper(wrapperRef.current);
    }
  }, [canvasView, controller, wrapperRef]);

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-background/80 px-3 py-1.5 backdrop-blur">
        <Tabs
          value={canvasView}
          onValueChange={(v) => setCanvasView(v as "editor" | "gate-order")}
        >
          <TabsList className="h-8">
            <TabsTrigger value="editor" className="text-xs">
              Editor
            </TabsTrigger>
            <TabsTrigger value="gate-order" className="text-xs">
              Gate Order
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs"
                    aria-label="Snap and grid alignment"
                  >
                    <Settings2 className="h-3.5 w-3.5 shrink-0" />
                    Snap
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 p-2" collisionPadding={8}>
                  <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-normal uppercase tracking-wide text-muted-foreground">
                    Snapping
                  </DropdownMenuLabel>
                  <div
                    className="flex cursor-default items-center justify-between gap-3 rounded-md px-2 py-2"
                    onPointerDown={(e) => e.stopPropagation()}
                  >

                    <Label
                      htmlFor="snap-menu-enabled"
                      className="cursor-pointer text-xs font-normal leading-snug text-foreground"
                    >
                      Snap to grid{" "}
                      <span className="text-muted-foreground">(keyboard S)</span>
                    </Label>
                    <Switch
                      id="snap-menu-enabled"
                      className="shrink-0"
                      checked={snappingEnabled}
                      onCheckedChange={setSnappingEnabled}
                    />
                  </div>
                  <Separator className="my-2" />
                  <div className="px-2 pb-1">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 w-full justify-start gap-2 px-2 text-xs"
                      disabled={!controller || placedSummary.length === 0}
                      onClick={() => controller?.snapAllToGrid()}
                    >
                      <Grid className="h-3.5 w-3.5" />
                      Snap all to grid
                    </Button>
                    <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                      Moves every object to match grid spacing & rotation snap (Misc →
                      Snapping). Works even if snap-to-grid above is off.
                    </p>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </TooltipTrigger>
          
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={showReference}
              onPressedChange={toggleShowReference}
              aria-label="Reference layout"
            >
              {showReference ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            Reference Layout <Kbd className="ml-2">R</Kbd>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle
              size="sm"
              pressed={rulerEnabled}
              onPressedChange={setRulerEnabled}
              aria-label="Ruler"
            >
              <Ruler className="h-3.5 w-3.5" />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>
            Ruler <Kbd className="ml-2">L</Kbd>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" onClick={() => controller?.resetView()}>
              <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
              Reset View
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Center & fit <Kbd className="ml-2">F</Kbd>
          </TooltipContent>
        </Tooltip>

        {/* Add tooltip button here later */}


        <AlertDialog>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Clear scene">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Clear scene…</TooltipContent>
          </Tooltip>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear scene?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes every object from the canvas. This action can be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (!controller) return;
                  controller.clearScene();
                  useEditorStore.getState().setCheckpointOrder([]);
                  toast.success("Scene cleared");
                }}
              >
                Clear
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-border bg-background px-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom out"
                  onClick={() => controller?.zoomOut()}
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom out</TooltipContent>
            </Tooltip>
            <Slider
              className="w-32"
              min={40}
              max={250}
              step={1}
              value={[Math.round(zoom * 100)]}
              onValueChange={([v]) => {
                if (Number.isFinite(v)) controller?.applyZoom(v / 100);
              }}
              aria-label="Zoom level"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Zoom in"
                  onClick={() => controller?.zoomIn()}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Zoom in</TooltipContent>
            </Tooltip>
            <span className="min-w-[3ch] px-1 font-mono text-xs tabular-nums text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={sidebarsHidden ? "Show sidebars" : "Hide sidebars"}
                onClick={toggleSidebarsHidden}
              >
                {sidebarsHidden ? (
                  <PanelLeftOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelLeftClose className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {sidebarsHidden ? "Show sidebars" : "Hide sidebars"}
              <Kbd className="ml-2">B</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div
        className={cn(
          "relative flex-1 overflow-hidden bg-muted/30",
          canvasView !== "editor" && "hidden"
        )}
        role="tabpanel"
        aria-hidden={canvasView !== "editor"}
      >
        <div
          className="canvas-wrapper absolute inset-0"
          ref={wrapperRef}
          onDragOver={(e) => controller?.handleDragOver(e.nativeEvent)}
          onDrop={(e) => controller?.handleDrop(e.nativeEvent)}
        >
          <canvas ref={canvasRef} width={750} height={800} />
        </div>
      </div>
      <div
        className={cn("flex-1 overflow-hidden", canvasView !== "gate-order" && "hidden")}
        role="tabpanel"
        aria-hidden={canvasView !== "gate-order"}
      >
        <GateOrderPanel />
      </div>
    </section>
  );
}
