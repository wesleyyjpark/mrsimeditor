import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Header } from "./Header";
import { PalettePanel } from "./PalettePanel";
import { CanvasArea } from "./CanvasArea";
import { SelectedObjectPanel } from "./SelectedObjectPanel";
import { MiscPanel } from "./MiscPanel";
import { useEditorStore } from "@/store/editorStore";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface AppShellProps {
  canvasRef: React.MutableRefObject<HTMLCanvasElement | null>;
  wrapperRef: React.MutableRefObject<HTMLDivElement | null>;
  layoutRef: React.MutableRefObject<HTMLDivElement | null>;
}

export function AppShell({ canvasRef, wrapperRef, layoutRef }: AppShellProps) {
  const sidebarsHidden = useEditorStore((s) => s.sidebarsHidden);
  const paletteCollapsed = useEditorStore((s) => s.paletteCollapsed);
  const togglePaletteCollapsed = useEditorStore((s) => s.togglePaletteCollapsed);
  const panelSizes = useEditorStore((s) => s.panelSizes);
  const setPanelSizes = useEditorStore((s) => s.setPanelSizes);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Header />
      <main ref={layoutRef} className="relative flex min-h-0 flex-1">
        {paletteCollapsed && !sidebarsHidden ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={togglePaletteCollapsed}
                aria-label="Show palette"
                className="absolute left-1 top-3 z-20 h-12 w-6 rounded-r-md rounded-l-none border-l-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Open palette</TooltipContent>
          </Tooltip>
        ) : null}

        <PanelGroup
          direction="horizontal"
          autoSaveId="mrsim.layout"
          onLayout={(sizes) => {
            if (sizes.length === 3) setPanelSizes(sizes as [number, number, number]);
          }}
          className="flex-1"
        >
          {!sidebarsHidden && !paletteCollapsed ? (
            <>
              <Panel
                id="left"
                order={1}
                defaultSize={panelSizes[0]}
                minSize={14}
                maxSize={32}
                collapsible
                onCollapse={() => togglePaletteCollapsed()}
                className="border-r border-border bg-background"
              >
                <PalettePanel />
              </Panel>
              <PanelResizeHandle className="group relative w-px bg-border data-[resize-handle-state=hover]:bg-primary data-[resize-handle-state=drag]:bg-primary">
                <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 transition-colors group-hover:bg-primary/30" />
              </PanelResizeHandle>
            </>
          ) : null}

          <Panel
            id="center"
            order={2}
            defaultSize={
              sidebarsHidden ? 100 : paletteCollapsed ? panelSizes[0] + panelSizes[1] : panelSizes[1]
            }
            minSize={30}
            className="min-w-0"
          >
            <CanvasArea canvasRef={canvasRef} wrapperRef={wrapperRef} />
          </Panel>

          {!sidebarsHidden ? (
            <>
              <PanelResizeHandle className="group relative w-px bg-border data-[resize-handle-state=hover]:bg-primary data-[resize-handle-state=drag]:bg-primary">
                <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 transition-colors group-hover:bg-primary/30" />
              </PanelResizeHandle>
              <Panel
                id="right"
                order={3}
                defaultSize={panelSizes[2]}
                minSize={18}
                maxSize={40}
                className="border-l border-border bg-background"
              >
                <RightSidebar />
              </Panel>
            </>
          ) : null}
        </PanelGroup>
      </main>
    </div>
  );
}

function RightSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 min-h-0 overflow-hidden border-b border-border">
        <SelectedObjectPanel />
      </div>
      <div className="border-t border-border">
        <Accordion type="single" collapsible defaultValue="">
          <AccordionItem value="misc" className="border-0">
            <AccordionTrigger className="px-3 text-sm">Misc</AccordionTrigger>
            <AccordionContent className="px-3">
              <MiscPanel />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
}
