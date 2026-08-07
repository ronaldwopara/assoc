import * as React from "react";

import { cn } from "@/lib/utils";

/** Rounded, bordered frame the v-table-3 card table sits in. */
const CardFrame = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden rounded-xl border border-border/50 bg-card text-card-foreground shadow-sm",
      className,
    )}
    {...props}
  />
));
CardFrame.displayName = "CardFrame";

export { CardFrame };
