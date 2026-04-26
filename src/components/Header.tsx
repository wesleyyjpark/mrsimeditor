import { useRef } from "react";
import { Download, FileUp, FolderOpen, Redo2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useOptionalCanvasController } from "../canvas/controllerContext";
import { useEditorStore } from "../store/editorStore";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
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
import { ThemeToggle } from "./ThemeToggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useHistoryStore } from "@/store/historyStore";

export function Header() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const controller = useOptionalCanvasController();

  const setCheckpointOrder = useEditorStore((s) => s.setCheckpointOrder);
  const setGlobalOffsetX = useEditorStore((s) => s.setGlobalOffsetX);
  const setGlobalOffsetY = useEditorStore((s) => s.setGlobalOffsetY);
  const setGlobalRotation = useEditorStore((s) => s.setGlobalRotation);

  const undo = useHistoryStore((s) => s.undo);
  const redo = useHistoryStore((s) => s.redo);
  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !controller) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      try {
        const nextOrder = await controller.importXmlFromText(text);
        setCheckpointOrder(nextOrder);
        const match = text.match(/EditorMeta:\s*(\{[^}]*"scope"\s*:\s*"global"[^}]*\})/);
        if (match) {
          try {
            const parsed = JSON.parse(match[1]) as {
              globalOffsetX?: number;
              globalOffsetY?: number;
              globalRotation?: number;
            };
            if (Number.isFinite(parsed.globalOffsetX)) setGlobalOffsetX(parsed.globalOffsetX as number);
            if (Number.isFinite(parsed.globalOffsetY)) setGlobalOffsetY(parsed.globalOffsetY as number);
            if (Number.isFinite(parsed.globalRotation))
              setGlobalRotation(parsed.globalRotation as number);
          } catch {
            /* ignore embedded metadata parse errors */
          }
        }
        toast.success(`Imported ${file.name}`);
      } catch (err) {
        toast.error("Failed to import XML", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    };
    reader.onerror = () => toast.error("Failed to read the XML file.");
    reader.readAsText(file);
  };

  const handleExport = () => {
    if (!controller) return;
    controller.exportXml(useEditorStore.getState().checkpointOrder);
    toast.success("Exported track XML");
  };

  const handleClearAll = () => {
    if (!controller) return;
    controller.clearScene();
    useEditorStore.getState().setCheckpointOrder([]);
    toast.success("Scene cleared");
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <div className="flex items-center gap-2 font-semibold">
        <img src="assets/MRSIM_Logo.png" alt="MRSIM logo" className="h-8 w-8" />
        <span className="hidden text-sm tracking-tight sm:inline">Track Editor</span>
        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Prototype
        </span>
      </div>
      <Separator orientation="vertical" className="h-6" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm">
            <FolderOpen className="mr-2 h-4 w-4" />
            File
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Track</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleImportClick}>
            <FileUp className="h-4 w-4" />
            Import XML
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4" />
            Export XML
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => e.preventDefault()}
              >
                <Trash2 className="h-4 w-4" />
                Clear scene…
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear scene?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes all objects and gate-order entries. Use undo if you change
                  your mind.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearAll}>Clear</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml"
        hidden
        onChange={handleFileChange}
      />
      <div className="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => undo()}
              disabled={!canUndo}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => redo()}
              disabled={!canRedo}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" className="h-6" />
        <Button variant="outline" size="sm" onClick={handleImportClick}>
          <FileUp className="mr-2 h-4 w-4" />
          Import
        </Button>
        <Button size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <ThemeToggle />
      </div>
    </header>
  );
}
