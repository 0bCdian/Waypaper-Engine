/**
 * Header Component for Waypaper Engine
 * 
 * Application header component with navigation, theme controls, and user actions.
 * Integrates with the theme system and provides responsive design.
 */

import React from 'react';
import { ThemeSelector, ThemeToggle } from '../ui';
import { cn } from '../../utils/cn';

/**
 * Header props interface
 */
export interface HeaderProps extends React.HTMLAttributes<HTMLElement> {
  /** Header title */
  title?: string;
  /** Header subtitle */
  subtitle?: string;
  /** Whether to show theme selector */
  showThemeSelector?: boolean;
  /** Whether to show theme toggle */
  showThemeToggle?: boolean;
  /** Whether to show sidebar toggle */
  showSidebarToggle?: boolean;
  /** Callback when sidebar toggle is clicked */
  onSidebarToggle?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Children content */
  children?: React.ReactNode;
}

/**
 * Header component
 */
export const Header: React.FC<HeaderProps> = ({
  title = 'Waypaper Engine',
  subtitle,
  showThemeSelector = true,
  showThemeToggle = false,
  showSidebarToggle = true,
  onSidebarToggle,
  className,
  children,
  ...props
}) => {
  // Header classes
  const headerClasses = cn(
    'navbar bg-base-100 border-b border-base-300 px-4 py-2 theme-transition',
    className
  );
  
  return (
    <header className={headerClasses} {...props}>
      {/* Left side */}
      <div className="navbar-start">
        {/* Sidebar toggle */}
    
          <button
            className="btn btn-ghost btn-sm"
            onClick={onSidebarToggle}
            aria-label="Toggle sidebar"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </button>
        
        
        {/* Title and subtitle */}
        <div className="ml-4">
          <h1 className="text-2xl font-bold ">
            {title}
            hola
          </h1>
          {subtitle && (
            <p className="text-sm text-base-content/70">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      
      {/* Center */}
      <div className="navbar-center">
        {children}
      </div>
      
      {/* Right side */}
      <div className="navbar-end gap-2">
        {/* Theme toggle */}
        {showThemeToggle && (
          <ThemeToggle showLabel={false} />
        )}
        
        {/* Theme selector */}
        {showThemeSelector && (
          <ThemeSelector />
        )}
        
        {/* Additional actions can be added here */}
      </div>
    </header>
  );
};

/**
 * Compact Header - minimal version
 */
export interface CompactHeaderProps extends Omit<HeaderProps, 'showThemeSelector' | 'showThemeToggle'> {
  /** Whether to show theme toggle */
  showThemeToggle?: boolean;
}

export const CompactHeader: React.FC<CompactHeaderProps> = ({
  showThemeToggle = true,
  ...props
}) => {
  return (
    <Header
      showThemeSelector={false}
      showThemeToggle={showThemeToggle}
      {...props}
    />
  );
};

/**
 * Full Header - with all features
 */
export const FullHeader: React.FC<HeaderProps> = (props) => {
  return (
    <Header
      showThemeSelector={true}
      showThemeToggle={false}
      {...props}
    />
  );
};

export default Header;
