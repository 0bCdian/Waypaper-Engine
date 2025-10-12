/**
 * Button Component for Waypaper Engine
 * 
 * A versatile button component with multiple variants, sizes, and states.
 * Supports loading states, icons, and theme integration.
 */

import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

/**
 * Button variant types
 */
export type ButtonVariant = 
  | 'primary' 
  | 'secondary' 
  | 'accent' 
  | 'ghost' 
  | 'outline' 
  | 'link' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info';

/**
 * Button size types
 */
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Button props interface
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Whether button is in loading state */
  loading?: boolean;
  /** Loading text to display */
  loadingText?: string;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Whether button should take full width */
  fullWidth?: boolean;
  /** Icon to display before text */
  startIcon?: React.ReactNode;
  /** Icon to display after text */
  endIcon?: React.ReactNode;
  /** Whether button should be circular */
  circular?: boolean;
  /** Whether button should be square */
  square?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Button component
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText,
      disabled = false,
      fullWidth = false,
      startIcon,
      endIcon,
      circular = false,
      square = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    // Base classes
    const baseClasses = 'btn relative inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-hidden focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
    
    // Variant classes
    const variantClasses = {
      primary: 'btn-primary',
      secondary: 'btn-secondary',
      accent: 'btn-accent',
      ghost: 'btn-ghost',
      outline: 'btn-outline',
      link: 'btn-link',
      success: 'btn-success',
      warning: 'btn-warning',
      error: 'btn-error',
      info: 'btn-info',
    };
    
    // Size classes
    const sizeClasses = {
      xs: 'btn-xs',
      sm: 'btn-sm',
      md: 'btn-md',
      lg: 'btn-lg',
      xl: 'btn-xl',
    };
    
    // Shape classes
    const shapeClasses = {
      circular: 'btn-circle',
      square: 'btn-square',
    };
    
    // Width classes
    const widthClasses = fullWidth ? 'w-full' : '';
    
    // Loading classes
    const loadingClasses = loading ? 'loading' : '';
    
    // Combine all classes
    const buttonClasses = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      circular && shapeClasses.circular,
      square && shapeClasses.square,
      widthClasses,
      loadingClasses,
      className
    );
    
    // Determine if button should be disabled
    const isDisabled = disabled || loading;
    
    // Render loading spinner
    const renderLoadingSpinner = () => (
      <svg
        className="animate-spin -ml-1 mr-2 h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    );
    
    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={isDisabled}
        {...props}
      >
        {/* Loading state */}
        {loading && (
          <>
            {renderLoadingSpinner()}
            {loadingText && <span>{loadingText}</span>}
          </>
        )}
        
        {/* Normal state */}
        {!loading && (
          <>
            {/* Start icon */}
            {startIcon && (
              <span className="mr-2 shrink-0">
                {startIcon}
              </span>
            )}
            
            {/* Button content */}
            {children && (
              <span className={cn(
                'flex-1',
                startIcon && 'ml-2',
                endIcon && 'mr-2'
              )}>
                {children}
              </span>
            )}
            
            {/* End icon */}
            {endIcon && (
              <span className="ml-2 shrink-0">
                {endIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

/**
 * Icon Button component - circular button with only an icon
 */
export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'startIcon' | 'endIcon'> {
  /** Icon to display */
  icon: React.ReactNode;
  /** Accessibility label */
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, 'aria-label': ariaLabel, ...props }, ref) => (
    <Button
      ref={ref}
      circular
      aria-label={ariaLabel}
      {...props}
    >
      {icon}
    </Button>
  )
);

IconButton.displayName = 'IconButton';

/**
 * Button Group component - groups buttons together
 */
export interface ButtonGroupProps {
  /** Children buttons */
  children: React.ReactNode;
  /** Whether buttons should be connected */
  connected?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const ButtonGroup: React.FC<ButtonGroupProps> = ({
  children,
  connected: _connected = false,
  className,
}) => {
  const groupClasses = cn(
    // btn-group removed in DaisyUI 5 - use join instead
    className
  );
  
  return (
    <div className={groupClasses}>
      {children}
    </div>
  );
};

export default Button;
