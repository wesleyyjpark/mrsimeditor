/* Help Window for the editor */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useEditorStore } from "@/store/editorStore";

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  const openShortcuts = useEditorStore((s) => s.openShortcuts);

  const goToFullShortcuts = () => {
    onOpenChange(false);
    openShortcuts();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Quick help</DialogTitle>
          <DialogDescription>
            Adding more as questions get asked.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-4 text-sm text-foreground">
          <li>
            <span className="font-medium">Command palette</span> — press{" "}
            <Kbd className="mx-0.5">Ctrl</Kbd>
            <span className="text-muted-foreground">+</span>
            <Kbd className="mx-0.5">K</Kbd>
            <span className="text-muted-foreground"> or </span>
            <Kbd className="mx-0.5">Cmd</Kbd>
            <span className="text-muted-foreground">+</span>
            <Kbd className="mx-0.5">K</Kbd>
            <span className="text-muted-foreground"> on Mac</span> to search actions.
          </li>
          <li>
            <span className="font-medium">All keyboard shortcuts</span> — press{" "}
            <Kbd>?</Kbd> anytime, or use the button below.
          </li>
          <li>
            <span className="font-medium">Pan the canvas</span> — hold{" "}
            <Kbd>Space</Kbd> and drag.
          </li>
          <li>
            <span className="font-medium">Import / export</span> — use the File menu or the
            toolbar buttons. The location to put the track will be on your machine in your Documents/MRSIM/Tracks folder.
          </li>
        </ul>
        <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="secondary" size="sm" onClick={goToFullShortcuts}>
            View all keyboard shortcuts
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
