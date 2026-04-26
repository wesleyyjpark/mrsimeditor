import { useMemo } from "react";
import {
  Box,
  Compass,
  FileUp,
  Download,
  Eye,
  Magnet,
  Maximize2,
  Moon,
  Plus,
  Redo2,
  Ruler,
  Sun,
  Trash2,
  Undo2,
  Keyboard,
  ListOrdered,
  PanelLeftClose,
} from "lucide-react";
import { toast } from "sonner";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useEditorStore } from "@/store/editorStore";
import { useOptionalCanvasController } from "@/canvas/controllerContext";
import { useTheme } from "@/hooks/useTheme";
import { useHistoryStore } from "@/store/historyStore";
import { OBJECT_CATALOG } from "@/data/objects";

export function CommandPalette() {
  const open = useEditorStore((s) => s.commandPaletteOpen);
  const setOpen = useEditorStore((s) => s.toggleCommandPalette);
  const close = useEditorStore((s) => s.closeCommandPalette);

  const controller = useOptionalCanvasController();
  const { setTheme } = useTheme();

  const setCanvasView = useEditorStore((s) => s.setCanvasView);
  const toggleSnap = useEditorStore((s) => s.setSnappingEnabled);
  const snapping = useEditorStore((s) => s.snappingEnabled);
  const toggleRuler = useEditorStore((s) => s.setRulerEnabled);
  const ruler = useEditorStore((s) => s.rulerEnabled);
  const toggleReference = useEditorStore((s) => s.toggleShowReferenceLayout);
  const togglePalette = useEditorStore((s) => s.togglePaletteCollapsed);
  const openShortcuts = useEditorStore((s) => s.openShortcuts);

  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const visibleObjects = useMemo(
    () => OBJECT_CATALOG.filter((entry) => !entry.paletteHidden),
    []
  );

  const run = (fn: () => void) => () => {
    fn();
    close();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={run(() => {
              if (!controller) return;
              controller.exportXml(useEditorStore.getState().checkpointOrder);
              toast.success("Exported track XML");
            })}
          >
            <Download />
            Export XML
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={run(() => {
              const inputs = document.querySelectorAll<HTMLInputElement>(
                'input[type="file"]'
              );
              inputs[0]?.click();
            })}
          >
            <FileUp />
            Import XML…
            <CommandShortcut>⌘O</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(() => controller?.resetView())}>
            <Maximize2 />
            Reset View
            <CommandShortcut>F</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={run(() => {
              if (!controller) return;
              controller.clearScene();
              useEditorStore.getState().setCheckpointOrder([]);
              toast.success("Scene cleared");
            })}
          >
            <Trash2 />
            Clear scene
          </CommandItem>
          <CommandItem
            onSelect={run(() => undo())}
            disabled={!canUndo}
          >
            <Undo2 />
            Undo
            <CommandShortcut>⌘Z</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={run(() => redo())}
            disabled={!canRedo}
          >
            <Redo2 />
            Redo
            <CommandShortcut>⌘⇧Z</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="View">
          <CommandItem onSelect={run(() => toggleSnap(!snapping))}>
            <Magnet />
            {snapping ? "Disable snapping" : "Enable snapping"}
            <CommandShortcut>S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(() => toggleRuler(!ruler))}>
            <Ruler />
            {ruler ? "Hide ruler" : "Show ruler"}
            <CommandShortcut>L</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(() => toggleReference())}>
            <Eye />
            Toggle reference layout
            <CommandShortcut>R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={run(() => togglePalette())}>
            <PanelLeftClose />
            Toggle palette
          </CommandItem>
          <CommandItem onSelect={run(() => setCanvasView("editor"))}>
            <Compass />
            Show editor
          </CommandItem>
          <CommandItem onSelect={run(() => setCanvasView("gate-order"))}>
            <ListOrdered />
            Show gate order
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem onSelect={run(() => setTheme("light"))}>
            <Sun />
            Light theme
          </CommandItem>
          <CommandItem onSelect={run(() => setTheme("dark"))}>
            <Moon />
            Dark theme
          </CommandItem>
          <CommandItem onSelect={run(() => setTheme("system"))}>
            <Sun />
            System theme
          </CommandItem>
          <CommandItem onSelect={run(() => openShortcuts())}>
            <Keyboard />
            Show keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Add object">
          {visibleObjects.map((entry) => (
            <CommandItem
              key={entry.id}
              keywords={[entry.label, entry.id, entry.labelText ?? ""]}
              onSelect={run(() => {
                controller?.addObjectToScene(entry.id);
                toast.success(`Added ${entry.label}`);
              })}
            >
              {entry.previewImage ? (
                <img
                  src={entry.previewImage}
                  alt=""
                  className="h-5 w-5 object-contain"
                />
              ) : (
                <Box />
              )}
              {entry.label}
              <CommandShortcut className="text-[10px]">
                <Plus className="h-3 w-3" />
              </CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
