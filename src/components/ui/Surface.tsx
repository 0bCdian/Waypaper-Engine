import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  /** Elevation level (0 = flat, 1-3 increasing shadow). */
  elevation?: 0 | 1 | 2 | 3;
  children?: ReactNode;
}

export function Surface({ elevation = 1, className, children, ...rest }: SurfaceProps) {
  return (
    <div
      className={cn("wp-surface", elevation > 0 && `wp-surface--elev-${elevation}`, className)}
      {...rest}
    >
      {children}
    </div>
  );
}
