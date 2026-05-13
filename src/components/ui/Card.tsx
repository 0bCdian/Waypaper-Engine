import type { HTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/utils/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Render with a polaroid frame. Visually distinct in neobrutalist mode
   * (extra padding + paper tint + framed inner image) and a no-op in
   * modern mode unless a palette opts in via `.wp-card--polaroid` rules.
   */
  polaroid?: boolean;
  /** Elevation level (0 = flat, 1-3 increasing). Defaults to 1. */
  elevation?: 0 | 1 | 2 | 3;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

export function Card({
  polaroid = false,
  elevation = 1,
  className,
  children,
  ref,
  ...rest
}: CardProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "wp-card",
        polaroid && "wp-card--polaroid",
        elevation > 0 && `wp-card--elev-${elevation}`,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
