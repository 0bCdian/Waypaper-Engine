/**
 * App Layout Component for Waypaper Engine
 * 
 * Main layout component that provides the overall structure for the application.
 * Includes theme integration and responsive design.
 */

import React, { ReactNode } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/cn';

/**
 * App Layout props interface
 */
export interface AppLayoutProps {
  /** Children content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show sidebar */
  showSidebar?: boolean;
  /** Whether to show header */
  showHeader?: boolean;
  /** Whether to show footer */
  showFooter?: boolean;
}

/**
 * App Layout component
 */
export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  className,
  showSidebar = true,
  showHeader = true,
  showFooter = false,
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  
  // Main container classes
  const containerClasses = cn(
    'min-h-screen theme-transition',
    isDarkMode ? 'theme-dark' : 'theme-light',
    className
  );
  
  return (
    <div 
      className={containerClasses}
      data-theme={currentTheme}
    >
      <div className="flex h-screen">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-64 bg-base-200 border-r border-base-300 flex-shrink-0">
            {/* Sidebar content will be rendered by children */}
          </aside>
        )}
        
        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          {showHeader && (
            <header className="bg-base-100 border-b border-base-300 flex-shrink-0">
              {/* Header content will be rendered by children */}
            </header>
          )}
          
          {/* Main content */}
          <main className="flex-1 overflow-hidden bg-base-100">
            {children}
          </main>
          
          {/* Footer */}
          {showFooter && (
            <footer className="bg-base-200 border-t border-base-300 flex-shrink-0 p-4">
              {/* Footer content will be rendered by children */}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Layout Container component
 */
export interface LayoutContainerProps {
  /** Children content */
  children: ReactNode;
  /** Container size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether container is centered */
  centered?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const LayoutContainer: React.FC<LayoutContainerProps> = ({
  children,
  size = 'lg',
  centered = true,
  className,
}) => {
  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };
  
  // Container classes
  const containerClasses = cn(
    'w-full px-4 py-6',
    sizeClasses[size],
    centered && 'mx-auto',
    className
  );
  
  return (
    <div className={containerClasses}>
      {children}
    </div>
  );
};

/**
 * Layout Section component
 */
export interface LayoutSectionProps {
  /** Children content */
  children: ReactNode;
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Additional CSS classes */
  className?: string;
}

export const LayoutSection: React.FC<LayoutSectionProps> = ({
  children,
  title,
  description,
  className,
}) => {
  const sectionClasses = cn(
    'mb-8',
    className
  );
  
  return (
    <section className={sectionClasses}>
      {(title || description) && (
        <div className="mb-4">
          {title && (
            <h2 className="text-2xl font-bold text-base-content mb-2">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-base-content/70">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
};

/**
 * Layout Grid component
 */
export interface LayoutGridProps {
  /** Children content */
  children: ReactNode;
  /** Number of columns */
  cols?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const LayoutGrid: React.FC<LayoutGridProps> = ({
  children,
  cols = 3,
  gap = 'md',
  className,
}) => {
  // Column classes
  const colClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-4',
    5: 'grid-cols-5',
    6: 'grid-cols-6',
  };
  
  // Gap classes
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };
  
  // Grid classes
  const gridClasses = cn(
    'grid',
    colClasses[cols],
    gapClasses[gap],
    className
  );
  
  return (
    <div className={gridClasses}>
      {children}
    </div>
  );
};

/**
 * Layout Flex component
 */
export interface LayoutFlexProps {
  /** Children content */
  children: ReactNode;
  /** Flex direction */
  direction?: 'row' | 'col' | 'row-reverse' | 'col-reverse';
  /** Justify content */
  justify?: 'start' | 'end' | 'center' | 'between' | 'around' | 'evenly';
  /** Align items */
  align?: 'start' | 'end' | 'center' | 'baseline' | 'stretch';
  /** Wrap items */
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  /** Gap between items */
  gap?: 'sm' | 'md' | 'lg';
  /** Additional CSS classes */
  className?: string;
}

export const LayoutFlex: React.FC<LayoutFlexProps> = ({
  children,
  direction = 'row',
  justify = 'start',
  align = 'start',
  wrap = 'nowrap',
  gap = 'md',
  className,
}) => {
  // Direction classes
  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col',
    'row-reverse': 'flex-row-reverse',
    'col-reverse': 'flex-col-reverse',
  };
  
  // Justify classes
  const justifyClasses = {
    start: 'justify-start',
    end: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };
  
  // Align classes
  const alignClasses = {
    start: 'items-start',
    end: 'items-end',
    center: 'items-center',
    baseline: 'items-baseline',
    stretch: 'items-stretch',
  };
  
  // Wrap classes
  const wrapClasses = {
    nowrap: 'flex-nowrap',
    wrap: 'flex-wrap',
    'wrap-reverse': 'flex-wrap-reverse',
  };
  
  // Gap classes
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
  };
  
  // Flex classes
  const flexClasses = cn(
    'flex',
    directionClasses[direction],
    justifyClasses[justify],
    alignClasses[align],
    wrapClasses[wrap],
    gapClasses[gap],
    className
  );
  
  return (
    <div className={flexClasses}>
      {children}
    </div>
  );
};

export default AppLayout;
