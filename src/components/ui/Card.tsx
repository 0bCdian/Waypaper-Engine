/**
 * Card Component for Waypaper Engine
 * 
 * A flexible card component for displaying content in a contained format.
 * Supports headers, footers, and various styling options.
 */

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

/**
 * Card variant types
 */
export type CardVariant = 'default' | 'outlined' | 'elevated' | 'flat';

/**
 * Card size types
 */
export type CardSize = 'sm' | 'md' | 'lg';

/**
 * Card props interface
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card variant */
  variant?: CardVariant;
  /** Card size */
  size?: CardSize;
  /** Whether card is interactive (clickable) */
  interactive?: boolean;
  /** Whether card is selected */
  selected?: boolean;
  /** Whether card is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Card component
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      size = 'md',
      interactive = false,
      selected = false,
      disabled = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // Base classes
    const baseClasses = 'card bg-base-100 transition-all duration-200';
    
    // Variant classes
    const variantClasses = {
      default: 'shadow-sm border border-base-200',
      outlined: 'border-2 border-base-300',
      elevated: 'shadow-lg border border-base-200',
      flat: 'shadow-none border-0',
    };
    
    // Size classes
    const sizeClasses = {
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-6',
    };
    
    // Interactive classes
    const interactiveClasses = interactive && !disabled ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : '';
    
    // Selected classes
    const selectedClasses = selected ? 'ring-2 ring-primary ring-offset-2' : '';
    
    // Disabled classes
    const disabledClasses = disabled ? 'opacity-50 cursor-not-allowed' : '';
    
    // Combine all classes
    const cardClasses = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      interactiveClasses,
      selectedClasses,
      disabledClasses,
      className
    );
    
    return (
      <div
        ref={ref}
        className={cardClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

/**
 * Card Header component
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const headerClasses = cn(
      'card-header pb-3 border-b border-base-200',
      className
    );
    
    return (
      <div
        ref={ref}
        className={headerClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

/**
 * Card Body component
 */
export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className, children, ...props }, ref) => {
    const bodyClasses = cn(
      'card-body py-4',
      className
    );
    
    return (
      <div
        ref={ref}
        className={bodyClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

/**
 * Card Footer component
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, children, ...props }, ref) => {
    const footerClasses = cn(
      'card-footer pt-3 border-t border-base-200',
      className
    );
    
    return (
      <div
        ref={ref}
        className={footerClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

/**
 * Card Title component
 */
export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ className, children, ...props }, ref) => {
    const titleClasses = cn(
      'card-title text-lg font-semibold text-base-content',
      className
    );
    
    return (
      <h3
        ref={ref}
        className={titleClasses}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = 'CardTitle';

/**
 * Card Description component
 */
export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    const descriptionClasses = cn(
      'card-description text-sm text-base-content/70',
      className
    );
    
    return (
      <p
        ref={ref}
        className={descriptionClasses}
        {...props}
      >
        {children}
      </p>
    );
  }
);

CardDescription.displayName = 'CardDescription';

/**
 * Card Actions component
 */
export interface CardActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const CardActions = forwardRef<HTMLDivElement, CardActionsProps>(
  ({ className, children, ...props }, ref) => {
    const actionsClasses = cn(
      'card-actions flex gap-2 justify-end',
      className
    );
    
    return (
      <div
        ref={ref}
        className={actionsClasses}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardActions.displayName = 'CardActions';

export default Card;
