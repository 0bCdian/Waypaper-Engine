import type React from "react";
import { cn } from "../../utils/cn";

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "danger";
}

const variantClasses: Record<NonNullable<TagProps["variant"]>, string> = {
  default: "bg-base-300 text-base-content",
  primary: "bg-primary/15 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-error/15 text-error",
};

export const Tag: React.FC<TagProps> = ({ variant = "default", className, children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-[var(--wp-radius-sm)] text-xs font-medium",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
};

export default Tag;
