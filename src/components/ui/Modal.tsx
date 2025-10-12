/**
 * Modal Component for Waypaper Engine
 * 
 * A flexible modal component for displaying overlay content.
 * Supports various sizes, animations, and accessibility features.
 */

import React, { forwardRef, useEffect, useRef } from 'react';
import { cn } from '../../utils/cn';

/**
 * Modal size types
 */
export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

/**
 * Modal props interface
 */
export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Whether modal is open */
  open: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal size */
  size?: ModalSize;
  /** Whether modal can be closed by clicking backdrop */
  closeOnBackdropClick?: boolean;
  /** Whether modal can be closed by pressing escape */
  closeOnEscape?: boolean;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether modal is centered */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Modal component
 */
export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      open,
      onClose,
      size = 'md',
      closeOnBackdropClick = true,
      closeOnEscape = true,
      showCloseButton = true,
      centered = true,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const modalRef = useRef<HTMLDivElement>(null);
    
    // Handle escape key
    useEffect(() => {
      if (!open || !closeOnEscape) return;
      
      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          onClose();
        }
      };
      
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, closeOnEscape, onClose]);
    
    // Handle backdrop click
    const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (closeOnBackdropClick && event.target === event.currentTarget) {
        onClose();
      }
    };
    
    // Size classes
    const sizeClasses = {
      xs: 'max-w-xs',
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-full mx-4',
    };
    
    // Modal classes
    const modalClasses = cn(
      'modal-box relative bg-base-100 rounded-lg shadow-xl',
      sizeClasses[size],
      className
    );
    
    // Backdrop classes
    const backdropClasses = cn(
      'modal-backdrop fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-300',
      open ? 'opacity-100' : 'opacity-0 pointer-events-none'
    );
    
    // Container classes
    const containerClasses = cn(
      'modal fixed inset-0 z-50 flex items-center justify-center p-4',
      centered ? 'items-center' : 'items-start pt-16'
    );
    
    if (!open) return null;
    
    return (
      <div className={backdropClasses} onClick={handleBackdropClick}>
        <div className={containerClasses}>
          <div
            ref={ref || modalRef}
            className={modalClasses}
            role="dialog"
            aria-modal="true"
            {...props}
          >
            {/* Close button */}
            {showCloseButton && (
              <button
                className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                onClick={onClose}
                aria-label="Close modal"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            
            {children}
          </div>
        </div>
      </div>
    );
  }
);

Modal.displayName = 'Modal';

/**
 * Modal Header component
 */
export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ModalHeader = forwardRef<HTMLDivElement, ModalHeaderProps>(
  ({ className, children, ...props }, ref) => {
    const headerClasses = cn(
      'modal-header pb-4 border-b border-base-200',
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

ModalHeader.displayName = 'ModalHeader';

/**
 * Modal Body component
 */
export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ModalBody = forwardRef<HTMLDivElement, ModalBodyProps>(
  ({ className, children, ...props }, ref) => {
    const bodyClasses = cn(
      'modal-body py-4',
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

ModalBody.displayName = 'ModalBody';

/**
 * Modal Footer component
 */
export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ className, children, ...props }, ref) => {
    const footerClasses = cn(
      'modal-footer pt-4 border-t border-base-200 flex gap-2 justify-end',
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

ModalFooter.displayName = 'ModalFooter';

/**
 * Modal Title component
 */
export interface ModalTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ModalTitle = forwardRef<HTMLHeadingElement, ModalTitleProps>(
  ({ className, children, ...props }, ref) => {
    const titleClasses = cn(
      'modal-title text-xl font-semibold text-base-content',
      className
    );
    
    return (
      <h2
        ref={ref}
        className={titleClasses}
        {...props}
      >
        {children}
      </h2>
    );
  }
);

ModalTitle.displayName = 'ModalTitle';

/**
 * Modal Description component
 */
export interface ModalDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

export const ModalDescription = forwardRef<HTMLParagraphElement, ModalDescriptionProps>(
  ({ className, children, ...props }, ref) => {
    const descriptionClasses = cn(
      'modal-description text-sm text-base-content/70 mt-2',
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

ModalDescription.displayName = 'ModalDescription';

export default Modal;
