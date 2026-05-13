import type React from "react";
import { cn } from "@/utils/cn";

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
  error?: string;
  className?: string;
  /** When true the control is rendered below the label instead of beside it */
  stacked?: boolean;
}

export const SettingRow: React.FC<SettingRowProps> = ({
  label,
  description,
  children,
  error,
  className,
  stacked = false,
}) => (
  <div
    className={cn(
      "flex gap-3 lg:gap-4 xl:gap-5 py-4 xl:py-5 border-b border-base-content/5",
      stacked ? "flex-col" : "flex-col lg:flex-row lg:items-center lg:justify-between",
      className,
    )}
  >
    <div className="min-w-0 flex-1">
      <div className="text-sm xl:text-base font-medium text-base-content">{label}</div>
      {description && (
        <div className="text-xs xl:text-sm text-base-content/50 mt-0.5">{description}</div>
      )}
      {error && <div className="text-xs xl:text-sm text-error mt-1">{error}</div>}
    </div>
    <div className={cn("flex-shrink-0", stacked ? "w-full" : "w-full lg:w-auto")}>{children}</div>
  </div>
);

interface SettingSectionHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export const SettingSectionHeader: React.FC<SettingSectionHeaderProps> = ({
  title,
  description,
  children,
  className,
}) => (
  <div className={cn("pt-6 xl:pt-8 pb-2 xl:pb-3 first:pt-0", className)}>
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-xs xl:text-sm font-semibold uppercase tracking-wider text-base-content/40">
          {title}
        </h3>
        {description && (
          <p className="text-xs xl:text-sm text-base-content/50 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  </div>
);
