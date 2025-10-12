/**
 * Theme Context System for Waypaper Engine
 * 
 * This file provides React context for theme management, including
 * theme switching, persistence, and synchronization with system preferences.
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { ThemeContextType, ThemeConfig, ThemeChangeEvent } from './types';
import { themes } from '../themes/themes';

// Default theme name
const DEFAULT_THEME_NAME = 'dark';

/**
 * Get theme by name
 */
const getTheme = (name: string) => themes[name];

/**
 * Theme Context
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Theme Provider Props
 */
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: string;
  persist?: boolean;
  syncWithSystem?: boolean;
}

/**
 * Theme Provider Component
 * 
 * Provides theme context to all child components and manages theme state,
 * persistence, and system synchronization.
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = DEFAULT_THEME_NAME,
  persist = true,
  syncWithSystem: initialSyncWithSystem = true,
}) => {
  // State
  const [currentTheme, setCurrentThemeState] = useState<string>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark' | 'auto'>('auto');
  const [syncWithSystem, setSyncWithSystem] = useState<boolean>(initialSyncWithSystem);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChanged, setLastChanged] = useState<number | undefined>();

  // Get current theme configuration
  const currentThemeConfig = getTheme(currentTheme);

  // Check if current theme is dark mode
  const isDarkMode = currentThemeConfig?.category === 'dark';
  const isLightMode = currentThemeConfig?.category === 'light';

  /**
   * Apply theme to document
   */
  const applyTheme = useCallback((themeName: string) => {
    // Simply set the data-theme attribute - DaisyUI handles everything
    document.documentElement.setAttribute('data-theme', themeName);
    console.log(`Applied DaisyUI theme: ${themeName}`);
  }, []);

  /**
   * Set theme with persistence and validation
   */
  const setTheme = useCallback((themeName: string) => {
    // Validate theme exists in our DaisyUI themes
    const theme = getTheme(themeName);
    if (!theme) {
      console.warn(`Theme "${themeName}" not found`);
      return;
    }

    const previousTheme = currentTheme;
    const timestamp = Date.now();

    // Update state
    setCurrentThemeState(themeName);
    setLastChanged(timestamp);

    // Apply theme to document
    applyTheme(themeName);

    // Persist theme selection
    if (persist) {
      try {
        localStorage.setItem('waypaper-theme', themeName);
      } catch (error) {
        console.warn('Failed to persist theme selection:', error);
      }
    }

    console.log(`Theme changed from "${previousTheme}" to "${themeName}"`);
  }, [currentTheme, applyTheme, persist]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    const current = getTheme(currentTheme);
    if (!current) return;

    // Find opposite theme
    const oppositeCategory = current.category === 'dark' ? 'light' : 'dark';
    const oppositeTheme = Object.values(themes).find(
      theme => theme.category === oppositeCategory && theme.available
    );

    if (oppositeTheme) {
      setTheme(oppositeTheme.name);
    }
  }, [currentTheme, setTheme]);

  /**
   * Set system theme preference
   */
  const setSystemThemePreference = useCallback((mode: 'light' | 'dark' | 'auto') => {
    setSyncWithSystem(mode === 'auto');
    
    if (persist) {
      try {
        localStorage.setItem('waypaper-system-theme', mode);
      } catch (error) {
        console.warn('Failed to persist system theme preference:', error);
      }
    }

    // Apply theme based on system preference
    if (mode === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const themeName = prefersDark ? 'dark' : 'light';
      setTheme(themeName);
    } else {
      setTheme(mode);
    }
  }, [setTheme, persist, setSyncWithSystem]);

  /**
   * Load themes from configuration
   */
  const loadThemes = useCallback(async () => {
    setIsLoading(true);
    try {
      // Themes are already loaded from themes.ts
      // This function can be extended to load themes from external sources
      console.log('Themes loaded:', Object.keys(themes));
    } catch (error) {
      console.error('Failed to load themes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Reset to default theme
   */
  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
  }, [setTheme, defaultTheme]);

  /**
   * Get theme by name
   */
  const getThemeByName = useCallback((name: string): ThemeConfig | undefined => {
    return getTheme(name);
  }, []);

  /**
   * Check if theme exists
   */
  const hasTheme = useCallback((name: string): boolean => {
    return name in themes && (themes[name].available ?? true);
  }, []);

  /**
   * Get all available themes
   */
  const getAvailableThemes = useCallback(() => {
    return Object.values(themes)
      .filter(theme => theme.available ?? true)
      .map(theme => ({
        name: theme.name,
        displayName: theme.displayName,
        description: theme.description,
        category: theme.category,
        previewImage: theme.previewImage,
        available: theme.available ?? true,
      }));
  }, []);

  // Initialize theme on mount
  useEffect(() => {
    const initializeTheme = async () => {
      try {
        // Load themes first
        await loadThemes();
        
        // Get saved theme or use default
        let savedTheme = defaultTheme;
        if (persist) {
          try {
            const stored = localStorage.getItem('waypaper-theme');
            if (stored && hasTheme(stored)) {
              savedTheme = stored;
            }
          } catch (error) {
            console.warn('Failed to load saved theme:', error);
          }
        }
        
        // Apply theme immediately
        setCurrentThemeState(savedTheme);
        applyTheme(savedTheme);
        
        setIsLoading(false);
        console.log(`Theme initialized: ${savedTheme}`);
      } catch (error) {
        console.error('Failed to initialize theme:', error);
        // Fallback to default theme
        applyTheme(defaultTheme);
        setIsLoading(false);
      }
    };

    initializeTheme();
  }, [applyTheme, defaultTheme, persist, hasTheme, loadThemes]);

  // Listen for system theme changes
  useEffect(() => {
    if (!syncWithSystem || systemTheme !== 'auto') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const themeName = e.matches ? 'dark' : 'light';
      setTheme(themeName);
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [syncWithSystem, systemTheme, setTheme]);

  // Listen for Electron native theme changes
  useEffect(() => {
    if (!syncWithSystem || systemTheme !== 'auto') return;

    const handleNativeThemeChange = (isDark: boolean) => {
      const themeName = isDark ? 'dark' : 'light';
      setTheme(themeName);
    };

    // Check if we're in Electron environment
    // Note: Native theme synchronization is not yet implemented
    // if (window.API_RENDERER?.onNativeThemeUpdated) {
    //   window.API_RENDERER.onNativeThemeUpdated(handleNativeThemeChange);
    //   
    //   return () => {
    //     window.API_RENDERER?.removeAllListeners?.('native-theme-updated');
    //   };
    // }
  }, [syncWithSystem, systemTheme, setTheme]);

  // Context value
  const contextValue: ThemeContextType = {
    // State
    currentTheme,
    systemTheme,
    themes,
    isLoading,
    lastChanged,
    
    // Computed values
    isDarkMode,
    isLightMode,
    currentThemeConfig,
    
    // Actions
    setTheme,
    toggleTheme,
    setSystemThemePreference,
    loadThemes,
    resetTheme,
    getTheme: getThemeByName,
    hasTheme,
    getAvailableThemes,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to use theme context
 * 
 * @returns Theme context value
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

/**
 * Hook for theme-specific utilities
 */
export const useThemeUtils = () => {
  const { currentTheme, currentThemeConfig, isDarkMode, isLightMode } = useTheme();

  /**
   * Get color value from current theme
   */
  const getColor = useCallback((colorName: keyof ThemeConfig['colors']) => {
    return (currentThemeConfig?.colors as any)?.[colorName] || '';
  }, [currentThemeConfig]);

  /**
   * Check if current theme has a specific color
   */
  const hasColor = useCallback((colorName: keyof ThemeConfig['colors']) => {
    return Boolean((currentThemeConfig?.colors as any)?.[colorName]);
  }, [currentThemeConfig]);

  /**
   * Get theme-specific CSS class
   */
  const getThemeClass = useCallback((baseClass: string) => {
    return `${baseClass} theme-${currentTheme}`;
  }, [currentTheme]);

  /**
   * Get theme-specific CSS variables
   */
  const getThemeVariables = useCallback(() => {
    if (!currentThemeConfig) return {};
    
    const variables: Record<string, string> = {};
    Object.entries(currentThemeConfig.colors).forEach(([key, value]) => {
      if (typeof value === 'string') {
        variables[`--color-${key}`] = value;
      }
    });
    
    return variables;
  }, [currentThemeConfig]);

  return {
    getColor,
    hasColor,
    getThemeClass,
    getThemeVariables,
    isDarkMode,
    isLightMode,
    currentTheme,
    currentThemeConfig,
  };
};

export default ThemeProvider;
