/**
 * Footer Component for Waypaper Engine
 * 
 * Application footer component with theme integration and responsive design.
 * Provides space for additional information and actions.
 */

import React, { ReactNode } from 'react';
import { cn } from '../../utils/cn';

/**
 * Footer props interface
 */
export interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  /** Footer content */
  children?: ReactNode;
  /** Whether to show copyright */
  showCopyright?: boolean;
  /** Copyright text */
  copyrightText?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Footer component
 */
export const Footer: React.FC<FooterProps> = ({
  children,
  showCopyright = true,
  copyrightText = '© 2024 Waypaper Engine',
  className,
  ...props
}) => {
  // Footer classes
  const footerClasses = cn(
    'footer bg-base-200 border-t border-base-300 px-4 py-3 theme-transition',
    className
  );
  
  return (
    <footer className={footerClasses} {...props}>
      <div className="flex items-center justify-between w-full">
        {/* Left side */}
        <div className="flex items-center gap-4">
          {showCopyright && (
            <p className="text-sm text-base-content/70">
              {copyrightText}
            </p>
          )}
        </div>
        
        {/* Right side */}
        <div className="flex items-center gap-2">
          {children}
        </div>
      </div>
    </footer>
  );
};

/**
 * Footer Link component
 */
export interface FooterLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Link text */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
}

export const FooterLink: React.FC<FooterLinkProps> = ({
  children,
  className,
  ...props
}) => {
  const linkClasses = cn(
    'text-sm text-base-content/70 hover:text-base-content transition-colors',
    className
  );
  
  return (
    <a className={linkClasses} {...props}>
      {children}
    </a>
  );
};

/**
 * Footer Divider component
 */
export interface FooterDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Additional CSS classes */
  className?: string;
}

export const FooterDivider: React.FC<FooterDividerProps> = ({
  className,
  ...props
}) => {
  const dividerClasses = cn(
    'w-px h-4 bg-base-300',
    className
  );
  
  return <div className={dividerClasses} {...props} />;
};

/**
 * Footer Group component
 */
export interface FooterGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Group title */
  title?: string;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: ReactNode;
}

export const FooterGroup: React.FC<FooterGroupProps> = ({
  title,
  className,
  children,
  ...props
}) => {
  const groupClasses = cn(
    'footer-group',
    className
  );
  
  return (
    <div className={groupClasses} {...props}>
      {title && (
        <h4 className="text-sm font-semibold text-base-content mb-2">
          {title}
        </h4>
      )}
      <div className="flex flex-col gap-1">
        {children}
      </div>
    </div>
  );
};

export default Footer;
