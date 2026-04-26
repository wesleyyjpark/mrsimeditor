import * as React from "react";
import { cn } from "@/lib/utils";

export interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd
    ref={ref}
    className={cn(
      "pointer-events-none inline-flex h-5 min-w-[1.25rem] select-none items-center justify-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium uppercase text-muted-foreground",
      className
    )}
    {...props}
  />
));
Kbd.displayName = "Kbd";

export { Kbd };
