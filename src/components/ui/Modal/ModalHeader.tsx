import { type ReactNode } from "react";
import { cn } from "@/utils/cn";

export interface ModalHeaderProps {
  variant?: "plain" | "striped";
  className?: string;
  children?: ReactNode;
}

export function ModalHeader({ variant = "plain", className, children }: ModalHeaderProps) {
  return (
    <header
      className={cn(
        "wp-modal__header",
        variant === "striped" && "wp-modal__header--striped",
        className,
      )}
    >
      {children}
    </header>
  );
}
