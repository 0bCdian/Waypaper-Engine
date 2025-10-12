/**
 * Theme Context Types for Waypaper Engine
 * 
 * Type definitions for the theme context system.
 */

import { ThemeConfig } from '../themes/types';

/**
 * Theme change event interface
 */
export interface ThemeChangeEvent {
  themeName: string;
  timestamp: number;
  source: 'user' | 'system' | 'auto';
}

/**
 * Theme context type interface
 */
export interface ThemeContextType {
  currentTheme: string;
  themes: Record<string, ThemeConfig>;
  setTheme: (themeName: string) => void;
  toggleTheme: () => void;
  isDarkMode: boolean;
  isLightMode: boolean;
  syncWithSystem: boolean;
  setSyncWithSystem: (sync: boolean) => void;
  setSystemThemePreference: (mode: 'light' | 'dark' | 'auto') => void;
  getAvailableThemes: () => Array<{
    name: string;
    displayName: string;
    description: string;
    category: string;
    previewImage?: string;
    available: boolean;
  }>;
  currentThemeConfig: ThemeConfig;
  systemTheme: 'light' | 'dark' | 'auto';
  isLoading: boolean;
  lastChanged?: number;
}

/**
 * Theme provider props interface
 */
export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  persist?: boolean;
  syncWithSystem?: boolean;
}
