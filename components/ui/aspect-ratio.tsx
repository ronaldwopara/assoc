"use client";

import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AspectRatioProps extends React.ComponentPropsWithoutRef<
  typeof AspectRatioPrimitive.Root
> {
  ratio?: number;
}

const AspectRatio = React.forwardRef<
  React.ElementRef<typeof AspectRatioPrimitive.Root>,
  AspectRatioProps
>(({ className, ratio = 1, ...props }, ref) => (
  <AspectRatioPrimitive.Root
    ref={ref}
    ratio={ratio}
    className={cn("relative w-full overflow-hidden", className)}
    {...props}
  />
));
AspectRatio.displayName = "AspectRatio";

export { AspectRatio };
