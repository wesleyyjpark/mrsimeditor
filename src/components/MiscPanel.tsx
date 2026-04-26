import { Move, Grid3x3 } from "lucide-react";
import { useEditorStore } from "../store/editorStore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MiscTab } from "../types";

export function MiscPanel() {
  const miscTab = useEditorStore((s) => s.miscTab);
  const setMiscTab = useEditorStore((s) => s.setMiscTab);

  const gridSizeMeters = useEditorStore((s) => s.gridSizeMeters);
  const setGridSizeMeters = useEditorStore((s) => s.setGridSizeMeters);
  const rotationSnap = useEditorStore((s) => s.rotationSnap);
  const setRotationSnap = useEditorStore((s) => s.setRotationSnap);

  const globalOffsetX = useEditorStore((s) => s.globalOffsetX);
  const globalOffsetY = useEditorStore((s) => s.globalOffsetY);
  const globalRotation = useEditorStore((s) => s.globalRotation);
  const setGlobalOffsetX = useEditorStore((s) => s.setGlobalOffsetX);
  const setGlobalOffsetY = useEditorStore((s) => s.setGlobalOffsetY);
  const setGlobalRotation = useEditorStore((s) => s.setGlobalRotation);

  return (
    <div className="space-y-3">
      <Tabs value={miscTab} onValueChange={(v) => setMiscTab(v as MiscTab)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="snapping" className="text-xs">
            <Grid3x3 className="mr-1.5 h-3.5 w-3.5" />
            Snapping
          </TabsTrigger>
          <TabsTrigger value="transform" className="text-xs">
            <Move className="mr-1.5 h-3.5 w-3.5" />
            Transform
          </TabsTrigger>
        </TabsList>

        <TabsContent value="snapping" className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Grid size (m)</Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={gridSizeMeters}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) setGridSizeMeters(v);
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Rotation snap (°)</Label>
            <Input
              type="number"
              min={1}
              step={1}
              value={rotationSnap}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) setRotationSnap(v);
              }}
              className="h-8 text-sm"
            />
          </div>
        </TabsContent>

        <TabsContent value="transform" className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Offset X (m)</Label>
            <Input
              type="number"
              step={0.1}
              value={globalOffsetX}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setGlobalOffsetX(v);
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Offset Y (m)</Label>
            <Input
              type="number"
              step={0.1}
              value={globalOffsetY}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setGlobalOffsetY(v);
              }}
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Rotation (°)</Label>
            <Input
              type="number"
              step={1}
              value={globalRotation}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) setGlobalRotation(v);
              }}
              className="h-8 text-sm"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
