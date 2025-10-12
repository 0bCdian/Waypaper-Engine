/**
 * Modern App Layout Component for Waypaper Engine
 * 
 * A modern layout implementation inspired by Upscayl's design.
 * Uses the new ModernSidebar with toggle functionality.
 */

import React, { ReactNode } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/cn';
import ModernSidebar from './ModernSidebar';
import { useUnifiedConfigStore } from '../../stores/unifiedConfig';

/**
 * Modern App Layout props interface
 */
export interface ModernAppLayoutProps {
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
 * Modern App Layout component
 */
export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({
  children,
  className,
  showSidebar = true,
  showHeader = true,
  showFooter = false,
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  const { config } = useUnifiedConfigStore();
  
  // Show loading state if config is not yet loaded
  if (!config) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }
  
  // Main container classes
  const containerClasses = cn(
    'min-h-screen theme-transition flex',
    isDarkMode ? 'theme-dark' : 'theme-light',
    className
  );
  
  return (
    <div 
      className={containerClasses}
      data-theme={currentTheme}
    >
      {/* Sidebar */}
      {showSidebar && <ModernSidebar />}
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        {showHeader && (
          <header className="bg-base-100 border-b border-base-300 shrink-0 p-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold text-base-content">
                Waypaper Engine
              </h1>
              <div className="flex items-center gap-2">
                {/* Theme selector or other header controls can go here */}
              </div>
            </div>
          </header>
        )}
        
        {/* Main content */}
        <main className="flex-1 overflow-hidden bg-base-100">
          {children}
        </main>
        
        {/* Footer */}
        {showFooter && (
          <footer className="bg-base-200 border-t border-base-300 shrink-0 p-4">
            <div className="text-center text-sm text-base-content/70">
              <p>© 2024 Waypaper Engine - Wallpaper Management Made Easy</p>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};

export default ModernAppLayout;
