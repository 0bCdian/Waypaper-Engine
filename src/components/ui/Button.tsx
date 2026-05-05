import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost" | "neutral";
  size?: "xs" | "sm" | "md" | "lg";
  block?: boolean;
}

export function Button({
  variant,
  size,
  block,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "btn wp-btn",
        variant && `btn-${variant}`,
        size && `btn-${size}`,
        block && "btn-block",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
