import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, ListOrdered, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { checkpointKey, formatCheckpointListLabel } from "../lib/checkpointOrder";
import { useEditorStore } from "../store/editorStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function GateOrderPanel() {
  const order = useEditorStore((s) => s.checkpointOrder);
  const addCheckpoint = useEditorStore((s) => s.addCheckpoint);
  const removeCheckpoint = useEditorStore((s) => s.removeCheckpoint);
  const moveCheckpoint = useEditorStore((s) => s.moveCheckpoint);
  const reorderCheckpoint = useEditorStore((s) => s.reorderCheckpoint);

  const [draft, setDraft] = useState("");
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleAdd = () => {
    if (!draft.trim()) return;
    addCheckpoint(draft);
    setDraft("");
    toast.success("Checkpoint added");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2">
        <ListOrdered className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Gate Order</span>
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {order.length} {order.length === 1 ? "checkpoint" : "checkpoints"}
        </span>
      </div>

      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Input
          placeholder="trkCube1.topEntry"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button onClick={handleAdd} disabled={!draft.trim()}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add
        </Button>
      </div>

      <ScrollArea className="flex-1 thin-scrollbar">
        {order.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center text-sm text-muted-foreground">
            <ListOrdered className="mb-2 h-6 w-6" />
            No checkpoints yet.
          </div>
        ) : (
          <ol className="space-y-1 p-3">
            {order.map((checkpoint, index) => {
              const isDragging = draggingIndex === index;
              return (
                <li
                  key={checkpointKey(checkpoint, index)}
                  className={cn(
                    "group flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-sm shadow-sm transition-colors",
                    "hover:border-primary/40",
                    isDragging && "opacity-50"
                  )}
                  draggable
                  onDragStart={() => setDraggingIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (draggingIndex === null) return;
                    reorderCheckpoint(draggingIndex, index);
                    setDraggingIndex(null);
                  }}
                  onDragEnd={() => setDraggingIndex(null)}
                >
                  <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" />
                  <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {index + 1}.
                  </span>
                  <span
                    className="flex-1 truncate font-mono text-xs"
                    title={formatCheckpointListLabel(checkpoint)}
                  >
                    {formatCheckpointListLabel(checkpoint)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveCheckpoint(index, -1)}
                    disabled={index === 0}
                    aria-label="Move up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => moveCheckpoint(index, 1)}
                    disabled={index === order.length - 1}
                    aria-label="Move down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeCheckpoint(index)}
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ol>
        )}
      </ScrollArea>
    </div>
  );
}
