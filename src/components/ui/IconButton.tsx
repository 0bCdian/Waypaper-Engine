import type React from "react";
import { cn } from "../../utils/cn";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md" | "lg";
  variant?: "ghost" | "danger";
}

const sizeClasses = { sm: "w-7 h-7", md: "w-9 h-9", lg: "w-11 h-11" };
const iconSizes = { sm: "w-3.5 h-3.5", md: "w-4 h-4", lg: "w-5 h-5" };
const variantClasses = {
  ghost: "text-base-content/60 hover:text-base-content hover:bg-base-content/8",
  danger: "text-base-content/60 hover:text-error hover:bg-error/10",
};

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  size = "md",
  variant = "ghost",
  className,
  children,
  ...props
}) => {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-[var(--wp-radius-sm)] transition-colors duration-100",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      <span className={iconSizes[size]}>{children}</span>
    </button>
  );
};

export default IconButton;
