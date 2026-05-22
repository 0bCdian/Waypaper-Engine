import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export function IconButton({ size = "md", className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      className={cn("wp-icon-btn", `wp-icon-btn--${size}`, className)}
      {...rest}
    />
  );
}
