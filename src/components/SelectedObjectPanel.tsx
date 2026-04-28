import {
  Copy,
  Trash2,
  Layers,
  MapPin,
  Compass,
  ArrowUpDown,
  Hash,
  Box,
  Radar,
  Plus,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { CanvasController } from "../canvas/CanvasController";
import { useEditorStore } from "../store/editorStore";
import { useOptionalCanvasController } from "../canvas/controllerContext";
import { isStackableGateConfig } from "../data/objects";
import { INDICATOR_CONFIGS } from "../data/indicator-config";
import { IndicatorPanel } from "./IndicatorPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Separator } from "@/components/ui/separator";

function ReadonlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="truncate text-xs font-medium" title={value}>
        {value}
      </span>
    </div>
  );
}

export function SelectedObjectPanel() {
  const selected = useEditorStore((s) => s.selected);
  const placedSummary = useEditorStore((s) => s.placedSummary);
  const multiCount = useEditorStore((s) => s.multiSelectionCount);
  const controller = useOptionalCanvasController();

  const supportsIndicator = Boolean(selected && INDICATOR_CONFIGS[selected.config.id]);
  const isPole = selected?.config.id === "padded-pole";
  const hasSensingLine = Boolean(
    selected &&
      selected.config.renderStyle === "point" &&
      typeof selected.config.sensingLineMeters === "number" &&
      selected.config.sensingLineMeters > 0
  );
  const stackable = selected ? isStackableGateConfig(selected.config) : false;

  if (multiCount > 1) {
    return <BulkActionsPanel count={multiCount} />;
  }

  if (!selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-3 py-2 text-sm font-semibold">
          Inspector
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <Box className="h-8 w-8 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            Select an object on the canvas to edit its properties and add indicators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold" title={selected.config.label}>
            {selected.config.label}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {selected.entityName}
          </span>
        </div>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto px-3 pb-3">
        <Accordion type="multiple" defaultValue={["properties", "indicator"]} className="w-full">
          <AccordionItem value="properties">
            <AccordionTrigger>Properties</AccordionTrigger>
            <AccordionContent className="space-y-3">
              {selected.config.previewImage ? (
                <div className="flex items-center justify-center rounded-md border border-border bg-muted/30 p-2">
                  <img
                    src={selected.config.previewImage}
                    alt="Selected object preview"
                    className="max-h-24 object-contain"
                  />
                </div>
              ) : null}
              <div className="rounded-md border border-border bg-card px-3 py-1">
                <ReadonlyField
                  label="Position X"
                  value={`${selected.positionX.toFixed(3)} m`}
                  icon={<MapPin className="h-3 w-3" />}
                />
                <Separator />
                <ReadonlyField
                  label="Position Y"
                  value={`${selected.positionY.toFixed(3)} m`}
                  icon={<MapPin className="h-3 w-3" />}
                />
                <Separator />
                <ReadonlyField
                  label="Rotation"
                  value={`${selected.rotation.toFixed(1)}°`}
                  icon={<Compass className="h-3 w-3" />}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ArrowUpDown className="h-3 w-3" />
                  Altitude (m)
                </Label>
                <Input
                  type="number"
                  step={0.1}
                  value={selected.altitude}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) controller?.setActiveAltitude(v);
                  }}
                  className="h-8 text-sm"
                />
              </div>

              {stackable ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Layers className="h-3 w-3" />
                    5x5 Gate Stack
                  </Label>
                  <Select
                    value={String(selected.stackCount ?? 1)}
                    onValueChange={(v) =>
                      controller?.setActiveStackCount(Number.parseInt(v, 10))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 gate</SelectItem>
                      <SelectItem value="2">2 gates</SelectItem>
                      <SelectItem value="3">3 gates</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {selected.config.id === "champs-25-gate" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Champs25 gate color</Label>
                  <Select
                    value={selected.champsGateColor ?? "red"}
                    onValueChange={(v) =>
                      controller?.setActiveChampsGateColor(
                        v as "red" | "green" | "blue" | "yellow" | "white"
                      )
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="yellow">Yellow</SelectItem>
                      <SelectItem value="white">White</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <ReadonlyField
                label="Include"
                value={
                  selected.config.id === "champs-25-gate"
                    ? "Gates/Champs25Gate.xml (macro by color)"
                    : selected.config.placement === "macro"
                      ? `Macro: ${selected.config.macroName ?? "—"}`
                      : (selected.config.includeFile ?? "—")
                }
                icon={<Hash className="h-3 w-3" />}
              />

              {isPole ? (
                <PoleAttachmentControls
                  selected={selected}
                  placedSummary={placedSummary}
                  onChange={(opts) => controller?.setActiveAttachment(opts)}
                />
              ) : null}

              {hasSensingLine ? (
                <PassageSensingControls
                  controller={controller}
                  objectId={selected.id}
                  entityName={selected.entityName}
                  sensingSide={selected.sensingSide ?? "right"}
                  onSideChange={(side) => controller?.setActiveSensingSide(side)}
                  variant={selected.config.passageTarget === "flag" ? "flag" : "pole"}
                  sensingFacing={selected.sensingFacing ?? "front"}
                  onFacingChange={(f) => controller?.setActiveSensingFacing(f)}
                />
              ) : null}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => controller?.duplicateSelected()}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Duplicate
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this object?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Removes <span className="font-mono">{selected.entityName}</span>{" "}
                        from the scene.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => controller?.deleteSelected()}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </AccordionContent>
          </AccordionItem>

          {supportsIndicator ? (
            <AccordionItem value="indicator">
              <AccordionTrigger>Gate Indicator</AccordionTrigger>
              <AccordionContent>
                <IndicatorPanel />
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      </div>
    </div>
  );
}

function BulkActionsPanel({ count }: { count: number }) {
  const controller = useOptionalCanvasController();

  const align = (side: "left" | "right" | "top" | "bottom" | "centerH" | "centerV") =>
    controller?.alignSelected(side);
  const distribute = (axis: "h" | "v") => controller?.distributeSelected(axis);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">Multiple selection</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {count} objects
          </span>
        </div>
      </div>
      <div className="thin-scrollbar flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Align</div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => align("left")} title="Align left">
              <AlignStartVertical className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => align("centerH")} title="Center horizontally">
              <AlignCenterVertical className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => align("right")} title="Align right">
              <AlignEndVertical className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => align("top")} title="Align top">
              <AlignStartHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => align("centerV")} title="Center vertically">
              <AlignCenterHorizontal className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => align("bottom")} title="Align bottom">
              <AlignEndHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Distribute</div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => distribute("h")}
              title="Distribute horizontally (3+ objects)"
            >
              <AlignHorizontalDistributeCenter className="mr-2 h-4 w-4" />
              Horizontal
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => distribute("v")}
              title="Distribute vertically (3+ objects)"
            >
              <AlignVerticalDistributeCenter className="mr-2 h-4 w-4" />
              Vertical
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => controller?.duplicateSelectedAll()}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicate
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {count} objects?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes every object in the active selection.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => controller?.deleteSelectedAll()}>
                  Delete all
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

interface PoleAttachmentControlsProps {
  selected: NonNullable<ReturnType<typeof useEditorStore.getState>["selected"]>;
  placedSummary: ReturnType<typeof useEditorStore.getState>["placedSummary"];
  onChange: (opts: {
    mode: "" | "gate" | "cube";
    gateId?: string;
    cubeId?: string;
    side?: "left" | "right";
    level?: number;
    corner?: string;
  }) => void;
}

function PoleAttachmentControls({ selected, placedSummary, onChange }: PoleAttachmentControlsProps) {
  const gates = placedSummary.filter((p) => p.isGate);
  const cubes = placedSummary.filter((p) => p.isCube);
  const fromMeta = selected.attachedCubeTo ? "cube" : selected.attachedTo ? "gate" : "";
  const [pendingMode, setPendingMode] = useState<"" | "gate" | "cube">("");

  useEffect(() => {
    setPendingMode("");
  }, [selected.id]);

  // Lets user open Gate/Cube sub-panels before any target exists; once attached, meta wins.
  const mode = (fromMeta || pendingMode) as "" | "gate" | "cube";
  const attachedGate = gates.find((g) => g.id === selected.attachedTo);
  const levelCount = Math.max(1, attachedGate?.stackCount ?? 1);
  const levelOptions = Array.from({ length: levelCount }, (_, i) => i + 1);

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
      <div className="text-xs font-semibold text-muted-foreground">Attachment</div>
      <div className="space-y-1.5">
        <Label className="text-xs">Mode</Label>
        <Select
          value={mode || "none"}
          onValueChange={(v) => {
            if (v === "none") {
              setPendingMode("");
              onChange({ mode: "" });
              return;
            }
            if (v === "gate") {
              setPendingMode("gate");
              onChange({
                mode: "gate",
                gateId: gates[0]?.id,
                side: selected.attachmentSide ?? "left",
                level: selected.attachedLevel ?? 1,
              });
              return;
            }
            if (v === "cube") {
              setPendingMode("cube");
              onChange({
                mode: "cube",
                cubeId: cubes[0]?.id,
                corner: selected.attachedCubeCorner ?? "1",
              });
            }
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Standalone</SelectItem>
            <SelectItem value="gate">Gate</SelectItem>
            <SelectItem value="cube">Cube</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === "gate" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Attach to Gate</Label>
            <Select
              value={selected.attachedTo ?? "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  setPendingMode("");
                  onChange({ mode: "" });
                  return;
                }
                onChange({
                  mode: "gate",
                  gateId: v,
                  side: selected.attachmentSide ?? "left",
                  level: selected.attachedLevel ?? 1,
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {gates.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{`${g.label} (${g.entityName})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {gates.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Add a gate to the scene, then pick it here.</p>
            ) : null}
          </div>
          <div className={`grid gap-2 ${levelCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            <div className="space-y-1.5">
              <Label className="text-xs">Side of gate</Label>
              <Select
                value={selected.attachmentSide ?? "left"}
                onValueChange={(v) =>
                  onChange({
                    mode: "gate",
                    gateId: selected.attachedTo ?? gates[0]?.id,
                    side: v as "left" | "right",
                    level: selected.attachedLevel ?? 1,
                  })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {levelCount > 1 ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Stack level</Label>
                <Select
                  value={String(
                    Math.min(
                      levelCount,
                      Math.max(1, selected.attachedLevel ?? 1)
                    )
                  )}
                  onValueChange={(v) =>
                    onChange({
                      mode: "gate",
                      gateId: selected.attachedTo ?? gates[0]?.id,
                      side: selected.attachmentSide ?? "left",
                      level: Number.parseInt(v, 10),
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levelOptions.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        Level {n} {n === 1 ? "(bottom)" : n === levelCount ? "(top)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {mode === "cube" ? (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Attach to Cube</Label>
            <Select
              value={selected.attachedCubeTo ?? "none"}
              onValueChange={(v) => {
                if (v === "none") {
                  setPendingMode("");
                  onChange({ mode: "" });
                  return;
                }
                onChange({
                  mode: "cube",
                  cubeId: v,
                  corner: selected.attachedCubeCorner ?? "1",
                });
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {cubes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{`${c.label} (${c.entityName})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cubes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Add a cube to the scene, then pick it here.</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Corner</Label>
            <Select
              value={selected.attachedCubeCorner ?? "1"}
              onValueChange={(v) =>
                onChange({
                  mode: "cube",
                  cubeId: selected.attachedCubeTo ?? cubes[0]?.id,
                  corner: v,
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Corner 1</SelectItem>
                <SelectItem value="2">Corner 2</SelectItem>
                <SelectItem value="3">Corner 3</SelectItem>
                <SelectItem value="4">Corner 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PassageSensingControls({
  controller,
  objectId,
  entityName,
  sensingSide,
  onSideChange,
  variant,
  sensingFacing,
  onFacingChange,
}: {
  controller: CanvasController | null;
  objectId: string;
  entityName: string;
  sensingSide: "left" | "right";
  onSideChange: (side: "left" | "right") => void;
  variant: "pole" | "flag";
  sensingFacing: "front" | "back";
  onFacingChange: (f: "front" | "back") => void;
}) {
  const addPolePassageCheckpoint = useEditorStore((s) => s.addPolePassageCheckpoint);
  const addFlagPassageCheckpoint = useEditorStore((s) => s.addFlagPassageCheckpoint);

  const handleAdd = () => {
    if (!objectId) {
      toast.error("No selection.");
      return;
    }
    const snap = controller?.getPolePassageAddSnapshot();
    if (!snap) {
      toast.error("Select an object on the canvas, then add.");
      return;
    }
    if (variant === "flag") {
      addFlagPassageCheckpoint({
        objectId,
        entityName,
        angleDeg: snap.fabricAngleDeg,
        globalRotationAtAdd: snap.globalRotationDeg,
        side: sensingSide,
        facing: sensingFacing,
      });
    } else {
      addPolePassageCheckpoint({
        objectId,
        entityName,
        angleDeg: snap.fabricAngleDeg,
        globalRotationAtAdd: snap.globalRotationDeg,
        side: sensingSide,
      });
    }
    toast.success("Checkpoint added");
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Radar className="h-3 w-3" />
        Passage Sensing
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        {variant === "flag" ? (
          <>
            A short line from the dot shows the pass side (Left and Right). “Approach” flips
            the half-plane 180° so the same L/R can be flown from the front or the back. The export stores that angle even
            if you rotate the flag later.
          </>
        ) : (
          <>
            The small arrow under the dashed line points at the entry side.
          </>
        )}
      </p>
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={`pass-sensing-side-${entityName}`}
          className="text-[11px] text-muted-foreground"
        >
          Pass side
        </Label>
        <Select
          value={sensingSide}
          onValueChange={(value) => onSideChange(value as "left" | "right")}
        >
          <SelectTrigger
            id={`pass-sensing-side-${entityName}`}
            className="h-7 w-28 text-xs"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="right">Right (+X)</SelectItem>
            <SelectItem value="left">Left (−X)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {variant === "flag" ? (
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={`pass-sensing-facing-${entityName}`}
            className="text-[11px] text-muted-foreground"
          >
            Approach
          </Label>
          <Select
            value={sensingFacing}
            onValueChange={(value) => onFacingChange(value as "front" | "back")}
          >
            <SelectTrigger
              id={`pass-sensing-facing-${entityName}`}
              className="h-7 w-32 text-xs"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="front">Front (default)</SelectItem>
              <SelectItem value="back">Back (flip 180°)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <Button size="sm" className="w-full" onClick={handleAdd}>
        <Plus className="mr-2 h-3.5 w-3.5" />
        Add to Gate Order
      </Button>
    </div>
  );
}
