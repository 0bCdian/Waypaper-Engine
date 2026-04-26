import type React from "react";
import { cn } from "../../utils/cn";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  selected?: boolean;
}

export const Card: React.FC<CardProps> = ({
  interactive = false,
  selected = false,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "rounded-[var(--wp-radius-md)] [box-shadow:var(--wp-elev-1)] bg-[var(--wp-surface-2)] border border-[var(--wp-hairline)]",
        interactive &&
          "cursor-pointer transition-[box-shadow,transform] duration-[var(--wp-dur-fast)] hover:-translate-y-0.5 hover:[box-shadow:var(--wp-elev-2)]",
        selected && "ring-2 ring-primary/60 bg-primary/8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export default Card;
