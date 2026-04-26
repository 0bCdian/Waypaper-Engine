import type React from "react";
import { cn } from "../../utils/cn";

type ElevLevel = 1 | 2 | 3;

interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: ElevLevel;
  /** 1=base-100, 2=base-100+8% content, 3=base-100+16% content */
  surface?: 1 | 2 | 3;
  as?: keyof React.JSX.IntrinsicElements;
}

const elevClass: Record<ElevLevel, string> = {
  1: "[box-shadow:var(--wp-elev-1)]",
  2: "[box-shadow:var(--wp-elev-2)]",
  3: "[box-shadow:var(--wp-elev-3)]",
};

const surfaceStyle: Record<1 | 2 | 3, string> = {
  1: "bg-[var(--wp-surface-1)]",
  2: "bg-[var(--wp-surface-2)]",
  3: "bg-[var(--wp-surface-3)]",
};

export const Surface: React.FC<SurfaceProps> = ({
  level = 1,
  surface = 1,
  as: Tag = "div",
  className,
  children,
  ...props
}) => {
  const C = Tag as React.ElementType;
  return (
    <C className={cn(surfaceStyle[surface], elevClass[level], className)} {...props}>
      {children}
    </C>
  );
};

export default Surface;
