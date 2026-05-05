import { useEffect, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { ModalHeader } from "./ModalHeader";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  children?: ReactNode;
}

function ModalBase({ open, onClose, size, className, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="wp-modal-backdrop" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn("wp-modal", size && `wp-modal--${size}`, className)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export const Modal = Object.assign(ModalBase, { Header: ModalHeader });
