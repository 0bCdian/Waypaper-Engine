import type React from "react";
import { cn } from "../../utils/cn";

interface FormRowProps {
  label: string;
  htmlFor?: string;
  helper?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormRow: React.FC<FormRowProps> = ({
  label,
  htmlFor,
  helper,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-3 border-b border-[var(--wp-hairline)] last:border-0",
        className,
      )}
    >
      <div className="flex flex-col min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-medium text-base-content">
          {label}
        </label>
        {helper && <p className="text-xs text-base-content/60 mt-0.5">{helper}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
};

export default FormRow;
