import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { useEditorStore } from "@/store/editorStore";

interface Shortcut {
  combo: string[];
  description: string;
  group: string;
}

const SHORTCUTS: Shortcut[] = [
  { group: "General", combo: ["Ctrl", "K"], description: "Open command palette" },
  { group: "General", combo: ["?"], description: "Show this dialog" },
  { group: "General", combo: ["B"], description: "Toggle sidebars" },

  { group: "Edit", combo: ["Ctrl", "Z"], description: "Undo" },
  { group: "Edit", combo: ["Ctrl", "Shift", "Z"], description: "Redo" },
  { group: "Edit", combo: ["Ctrl", "Y"], description: "Redo (alt)" },
  { group: "Edit", combo: ["Delete"], description: "Delete selection" },
  { group: "Edit", combo: ["Ctrl", "D"], description: "Duplicate selection" },
  { group: "Edit", combo: ["Esc"], description: "Clear selection / cancel" },

  { group: "View", combo: ["F"], description: "Reset view (fit)" },
  { group: "View", combo: ["S"], description: "Toggle snapping" },
  { group: "View", combo: ["L"], description: "Toggle ruler" },
  { group: "View", combo: ["R"], description: "Toggle reference layout" },
  { group: "View", combo: ["+"], description: "Zoom in" },
  { group: "View", combo: ["-"], description: "Zoom out" },

  { group: "Canvas", combo: ["Space + Drag"], description: "Pan view" },
  { group: "Canvas", combo: ["Shift + Drag"], description: "Disable snap while moving" },
];

export function ShortcutsDialog() {
  const open = useEditorStore((s) => s.shortcutsOpen);
  const setOpen = useEditorStore((s) => s.toggleShortcuts);

  const groups = SHORTCUTS.reduce<Record<string, Shortcut[]>>((acc, sc) => {
    (acc[sc.group] ??= []).push(sc);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Power-user keys for the canvas, palette, and global actions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group}
              </h4>
              <ul className="space-y-1">
                {items.map((sc) => (
                  <li
                    key={sc.description}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50"
                  >
                    <span>{sc.description}</span>
                    <span className="flex items-center gap-1">
                      {sc.combo.map((key, i) => (
                        <Kbd key={`${key}-${i}`}>{key}</Kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
