/**
 * Theme system type definitions for Waypaper Engine
 * 
 * This file defines the core interfaces and types used throughout the theme system.
 * It provides type safety and consistency across all theme-related functionality.
 */

/**
 * Color palette definition for a theme
 * Each color is defined as a CSS color value (hex, rgb, hsl, etc.)
 */
export interface ThemeColors {
  /** Primary brand color */
  primary: string;
  /** Secondary brand color */
  secondary: string;
  /** Accent color for highlights */
  accent: string;
  /** Neutral colors for backgrounds and borders */
  neutral: string;
  /** Base background color */
  base: string;
  /** Base foreground/text color */
  baseContent: string;
  /** Info color for informational messages */
  info: string;
  /** Success color for success messages */
  success: string;
  /** Warning color for warning messages */
  warning: string;
  /** Error color for error messages */
  error: string;
  /** Additional custom colors */
  custom?: Record<string, string>;
}

/**
 * Extended color palette with multiple shades
 * Provides more granular control over color variations
 */
export interface ExtendedThemeColors extends ThemeColors {
  /** Primary color variations */
  primary50?: string;
  primary100?: string;
  primary200?: string;
  primary300?: string;
  primary400?: string;
  primary500?: string;
  primary600?: string;
  primary700?: string;
  primary800?: string;
  primary900?: string;
  
  /** Secondary color variations */
  secondary50?: string;
  secondary100?: string;
  secondary200?: string;
  secondary300?: string;
  secondary400?: string;
  secondary500?: string;
  secondary600?: string;
  secondary700?: string;
  secondary800?: string;
  secondary900?: string;
  
  /** Neutral color variations */
  neutral50?: string;
  neutral100?: string;
  neutral200?: string;
  neutral300?: string;
  neutral400?: string;
  neutral500?: string;
  neutral600?: string;
  neutral700?: string;
  neutral800?: string;
  neutral900?: string;
}

/**
 * Theme configuration interface
 * Defines the structure of a complete theme configuration
 */
export interface ThemeConfig {
  /** Unique theme identifier */
  name: string;
  /** Human-readable theme name */
  displayName: string;
  /** Theme description */
  description: string;
  /** Theme category (dark, light, colorful, etc.) */
  category: 'dark' | 'light' | 'colorful' | 'minimal' | 'mixed';
  /** Color palette for this theme */
  colors: ExtendedThemeColors;
  /** Additional CSS custom properties */
  customProperties?: Record<string, string>;
  /** Theme-specific font settings */
  fonts?: {
    primary?: string;
    secondary?: string;
    mono?: string;
  };
  /** Theme-specific spacing scale */
  spacing?: Record<string, string>;
  /** Theme-specific border radius scale */
  borderRadius?: Record<string, string>;
  /** Theme-specific shadow definitions */
  shadows?: Record<string, string>;
  /** Whether this theme is available in the theme selector */
  available?: boolean;
  /** Theme preview image path */
  previewImage?: string;
  /** Whether this is a DaisyUI theme (handled by DaisyUI) */
  isDaisyUI?: boolean;
}

/**
 * Theme metadata for display purposes
 */
export interface ThemeMetadata {
  name: string;
  displayName: string;
  description: string;
  category: ThemeConfig['category'];
  previewImage?: string;
  available: boolean;
}

/**
 * Theme state interface for state management
 */
export interface ThemeState {
  /** Currently active theme */
  currentTheme: string;
  /** System theme preference */
  systemTheme: 'light' | 'dark' | 'auto';
  /** Available themes */
  themes: Record<string, ThemeConfig>;
  /** Whether theme is being loaded */
  isLoading: boolean;
  /** Last theme change timestamp */
  lastChanged?: number;
}

/**
 * Theme actions interface for state management
 */
export interface ThemeActions {
  /** Set the active theme */
  setTheme: (theme: string) => void;
  /** Toggle between light and dark themes */
  toggleTheme: () => void;
  /** Set system theme preference */
  setSystemTheme: (mode: 'light' | 'dark' | 'auto') => void;
  /** Load themes from configuration */
  loadThemes: () => Promise<void>;
  /** Reset to default theme */
  resetTheme: () => void;
  /** Get theme by name */
  getTheme: (name: string) => ThemeConfig | undefined;
  /** Check if theme exists */
  hasTheme: (name: string) => boolean;
  /** Get all available themes */
  getAvailableThemes: () => ThemeMetadata[];
}

/**
 * Theme context interface for React context
 */
export interface ThemeContextType extends ThemeState, ThemeActions {
  /** Whether current theme is dark mode */
  isDarkMode: boolean;
  /** Whether current theme is light mode */
  isLightMode: boolean;
  /** Current theme configuration */
  currentThemeConfig: ThemeConfig | undefined;
}

/**
 * Theme change event data
 */
export interface ThemeChangeEvent {
  /** Previous theme name */
  previousTheme: string;
  /** New theme name */
  newTheme: string;
  /** Change timestamp */
  timestamp: number;
  /** Whether change was automatic (system theme) */
  automatic: boolean;
}

/**
 * Theme validation result
 */
export interface ThemeValidationResult {
  /** Whether theme is valid */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

/**
 * Theme loading options
 */
export interface ThemeLoadingOptions {
  /** Whether to persist theme selection */
  persist?: boolean;
  /** Default theme to use if none specified */
  defaultTheme?: string;
  /** Whether to sync with system theme */
  syncWithSystem?: boolean;
  /** Theme change callback */
  onThemeChange?: (event: ThemeChangeEvent) => void;
}

/**
 * CSS custom property definition
 */
export interface CSSCustomProperty {
  /** Property name */
  name: string;
  /** Property value */
  value: string;
  /** Property description */
  description?: string;
}

/**
 * Theme export/import format
 */
export interface ThemeExport {
  /** Theme configuration */
  config: ThemeConfig;
  /** Export metadata */
  metadata: {
    version: string;
    exportedAt: number;
    exportedBy: string;
  };
}

/**
 * Theme import options
 */
export interface ThemeImportOptions {
  /** Whether to overwrite existing theme */
  overwrite?: boolean;
  /** Whether to validate theme before import */
  validate?: boolean;
  /** Import callback */
  onImport?: (theme: ThemeConfig) => void;
}

/**
 * Type guard to check if an object is a valid theme configuration
 */
export function isThemeConfig(obj: unknown): obj is ThemeConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const theme = obj as Record<string, unknown>;
  
  return (
    typeof theme.name === 'string' &&
    typeof theme.displayName === 'string' &&
    typeof theme.description === 'string' &&
    typeof theme.category === 'string' &&
    typeof theme.colors === 'object' &&
    theme.colors !== null
  );
}

/**
 * Type guard to check if an object is a valid theme colors
 */
export function isThemeColors(obj: unknown): obj is ThemeColors {
  if (typeof obj !== 'object' || obj === null) return false;
  
  const colors = obj as Record<string, unknown>;
  
  return (
    typeof colors.primary === 'string' &&
    typeof colors.secondary === 'string' &&
    typeof colors.accent === 'string' &&
    typeof colors.neutral === 'string' &&
    typeof colors.base === 'string' &&
    typeof colors.baseContent === 'string' &&
    typeof colors.info === 'string' &&
    typeof colors.success === 'string' &&
    typeof colors.warning === 'string' &&
    typeof colors.error === 'string'
  );
}

/**
 * Default theme configuration
 */
export const DEFAULT_THEME: ThemeConfig = {
  name: 'dark',
  displayName: 'Dark Mode',
  description: 'Classic dark theme with high contrast',
  category: 'dark',
  colors: {
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#f59e0b',
    neutral: '#374151',
    base: '#1f2937',
    baseContent: '#f9fafb',
    info: '#3b82f6',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  available: true,
};

/**
 * Theme categories for organization
 */
export const THEME_CATEGORIES = {
  DARK: 'dark' as const,
  LIGHT: 'light' as const,
  COLORFUL: 'colorful' as const,
  MINIMAL: 'minimal' as const,
} as const;

/**
 * System theme modes
 */
export const SYSTEM_THEME_MODES = {
  LIGHT: 'light' as const,
  DARK: 'dark' as const,
  AUTO: 'auto' as const,
} as const;
