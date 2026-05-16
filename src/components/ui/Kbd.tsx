import type React from "react";
import { cn } from "@/utils/cn";

interface KbdProps {
  size?: "sm" | "md";
  children: React.ReactNode;
  className?: string;
}

/**
 * Keyboard key primitive. Uses wp-kbd token classes so it remains readable on
 * every surface, including inside DaisyUI alert variants (alert-info, etc.).
 */
export const Kbd: React.FC<KbdProps> = ({ size = "md", children, className }) => {
  return <kbd className={cn("wp-kbd", size === "sm" && "wp-kbd--sm", className)}>{children}</kbd>;
};
