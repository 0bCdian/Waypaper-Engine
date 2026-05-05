import { type ButtonHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {}

export function CloseButton({
  className,
  type = "button",
  "aria-label": ariaLabel,
  ...rest
}: CloseButtonProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel ?? "Close"}
      className={cn("wp-close-btn", className)}
      {...rest}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" />
      </svg>
    </button>
  );
}
