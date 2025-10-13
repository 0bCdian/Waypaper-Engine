/**
 * DaisyUI Theme configurations for Waypaper Engine
 * 
 * This file contains all available DaisyUI theme definitions.
 * DaisyUI themes are applied using the data-theme attribute and don't require
 * custom color definitions as they're handled by DaisyUI itself.
 */

import { ThemeConfig } from './types';

/**
 * All DaisyUI theme names (35 themes total)
 */
export const DAISYUI_THEMES = [
  'light', 'dark', 'cupcake', 'bumblebee', 'emerald', 'corporate', 'synthwave', 
  'retro', 'cyberpunk', 'valentine', 'halloween', 'garden', 'forest', 'aqua', 
  'lofi', 'pastel', 'fantasy', 'wireframe', 'black', 'luxury', 'dracula', 
  'cmyk', 'autumn', 'business', 'acid', 'lemonade', 'night', 'coffee', 
  'winter', 'dim', 'nord', 'sunset'
];

/**
 * Custom CSS theme names
 */
export const CUSTOM_THEMES = [
  'doublezombie',
  'gruvbox', 'catppuccin', 'monokai', 'tokyo-night', 'everforest', 'gruvbox-material',
  'gruvbox-light', 'catppuccin-light', 'monokai-light', 'tokyo-night-light', 'everforest-light', 'gruvbox-material-light'
];

/**
 * All available themes (DaisyUI + Custom)
 */
export const ALL_THEMES = [...DAISYUI_THEMES, ...CUSTOM_THEMES];

/**
 * Theme metadata for DaisyUI themes
 */
const daisyUIThemeMetadata: Record<string, { displayName: string; description: string; category: 'light' | 'dark' | 'mixed' }> = {
  light: { displayName: 'Light', description: 'Clean and bright light theme', category: 'light' },
  dark: { displayName: 'Dark', description: 'Classic dark theme with high contrast', category: 'dark' },
  cupcake: { displayName: 'Cupcake', description: 'Sweet and colorful theme', category: 'light' },
  bumblebee: { displayName: 'Bumblebee', description: 'Bright yellow and black theme', category: 'light' },
  emerald: { displayName: 'Emerald', description: 'Green and nature-inspired theme', category: 'light' },
  corporate: { displayName: 'Corporate', description: 'Professional blue theme', category: 'light' },
  synthwave: { displayName: 'Synthwave', description: 'Retro neon theme', category: 'dark' },
  retro: { displayName: 'Retro', description: 'Vintage-inspired theme', category: 'mixed' },
  cyberpunk: { displayName: 'Cyberpunk', description: 'Futuristic neon theme', category: 'dark' },
  valentine: { displayName: 'Valentine', description: 'Romantic pink theme', category: 'light' },
  halloween: { displayName: 'Halloween', description: 'Spooky orange and black theme', category: 'dark' },
  garden: { displayName: 'Garden', description: 'Natural green theme', category: 'light' },
  forest: { displayName: 'Forest', description: 'Deep green nature theme', category: 'dark' },
  aqua: { displayName: 'Aqua', description: 'Ocean blue theme', category: 'light' },
  lofi: { displayName: 'Lo-Fi', description: 'Minimalist grayscale theme', category: 'light' },
  pastel: { displayName: 'Pastel', description: 'Soft pastel colors', category: 'light' },
  fantasy: { displayName: 'Fantasy', description: 'Magical purple theme', category: 'dark' },
  wireframe: { displayName: 'Wireframe', description: 'Minimalist outline-solid theme', category: 'light' },
  black: { displayName: 'Black', description: 'Pure black theme', category: 'dark' },
  luxury: { displayName: 'Luxury', description: 'Elegant gold theme', category: 'dark' },
  dracula: { displayName: 'Dracula', description: 'Dark theme with vibrant accents', category: 'dark' },
  cmyk: { displayName: 'CMYK', description: 'Print-inspired color theme', category: 'light' },
  autumn: { displayName: 'Autumn', description: 'Warm fall colors', category: 'light' },
  business: { displayName: 'Business', description: 'Professional theme', category: 'light' },
  acid: { displayName: 'Acid', description: 'Bright neon theme', category: 'light' },
  lemonade: { displayName: 'Lemonade', description: 'Fresh citrus theme', category: 'light' },
  night: { displayName: 'Night', description: 'Deep night theme', category: 'dark' },
  coffee: { displayName: 'Coffee', description: 'Warm brown theme', category: 'dark' },
  winter: { displayName: 'Winter', description: 'Cool winter theme', category: 'light' },
  dim: { displayName: 'Dim', description: 'Subtle dark theme', category: 'dark' },
  nord: { displayName: 'Nord', description: 'Arctic-inspired theme', category: 'dark' },
  sunset: { displayName: 'Sunset', description: 'Warm sunset colors', category: 'light' }
};

/**
 * Theme metadata for custom CSS themes
 */
const customThemeMetadata: Record<string, { displayName: string; description: string; category: 'light' | 'dark' | 'mixed' }> = {
  gruvbox: { displayName: 'Gruvbox', description: 'Retro groove color scheme', category: 'dark' },
  catppuccin: { displayName: 'Catppuccin', description: 'Soothing pastel theme', category: 'dark' },
  monokai: { displayName: 'Monokai', description: 'Classic monokai color scheme', category: 'dark' },
  'tokyo-night': { displayName: 'Tokyo Night', description: 'Clean dark theme inspired by Tokyo', category: 'dark' },
  everforest: { displayName: 'Everforest', description: 'Low contrast, greenish dark theme', category: 'dark' },
  'gruvbox-material': { displayName: 'Gruvbox Material', description: 'Material Design version of Gruvbox', category: 'dark' },
  'gruvbox-light': { displayName: 'Gruvbox Light', description: 'Light version of retro groove colors', category: 'light' },
  'catppuccin-light': { displayName: 'Catppuccin Light', description: 'Light version of soothing pastel theme', category: 'light' },
  'monokai-light': { displayName: 'Monokai Light', description: 'Light version of classic monokai', category: 'light' },
  'tokyo-night-light': { displayName: 'Tokyo Day', description: 'Light version inspired by Tokyo', category: 'light' },
  'everforest-light': { displayName: 'Everforest Light', description: 'Light version with greenish tones', category: 'light' },
  'gruvbox-material-light': { displayName: 'Gruvbox Material Light', description: 'Light Material Design Gruvbox', category: 'light' }
};

/**
 * Create DaisyUI theme configuration
 */
function createDaisyUITheme(name: string): ThemeConfig {
  const metadata = daisyUIThemeMetadata[name];
  return {
    name,
    displayName: metadata?.displayName || name.charAt(0).toUpperCase() + name.slice(1),
    description: metadata?.description || `DaisyUI ${name} theme`,
    category: metadata?.category || 'mixed',
    colors: {
      primary: '',
      secondary: '',
      accent: '',
      neutral: '',
      base: '',
      baseContent: '',
      info: '',
      success: '',
      warning: '',
      error: ''
    }, // DaisyUI handles colors internally
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    available: true,
    isDaisyUI: true, // Flag to indicate this is a DaisyUI theme
  };
}

/**
 * Create custom theme configuration
 */
function createCustomTheme(name: string): ThemeConfig {
  const metadata = customThemeMetadata[name];
  return {
    name,
    displayName: metadata?.displayName || name.charAt(0).toUpperCase() + name.slice(1),
    description: metadata?.description || `Custom ${name} theme`,
    category: metadata?.category || 'mixed',
    colors: {
      primary: '',
      secondary: '',
      accent: '',
      neutral: '',
      base: '',
      baseContent: '',
      info: '',
      success: '',
      warning: '',
      error: ''
    }, // Custom CSS handles colors
    fonts: {
      primary: 'Inter, system-ui, sans-serif',
      secondary: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    available: true,
  };
}

/**
 * All available themes (DaisyUI + Custom)
 */
export const themes: Record<string, ThemeConfig> = {
  // DaisyUI themes
  ...DAISYUI_THEMES.reduce((acc, themeName) => {
    acc[themeName] = createDaisyUITheme(themeName);
    return acc;
  }, {} as Record<string, ThemeConfig>),
  
  // Custom themes
  ...CUSTOM_THEMES.reduce((acc, themeName) => {
    acc[themeName] = createCustomTheme(themeName);
    return acc;
  }, {} as Record<string, ThemeConfig>)
};

/**
 * Default theme name
 */
export const DEFAULT_THEME_NAME = 'dark';

/**
 * Get theme by name
 */
export function getTheme(name: string): ThemeConfig | undefined {
  return themes[name];
}

/**
 * Get all available themes
 */
export function getAllThemes(): ThemeConfig[] {
  return Object.values(themes).filter(theme => theme.available);
}

/**
 * Get themes by category
 */
export function getThemesByCategory(category: ThemeConfig['category']): ThemeConfig[] {
  return Object.values(themes).filter(theme => theme.category === category && theme.available);
}

/**
 * Check if theme exists
 */
export function hasTheme(name: string): boolean {
  return name in themes && (themes[name].available ?? true);
}

/**
 * Get theme metadata for display purposes
 */
export function getThemeMetadata(name: string) {
  const theme = themes[name];
  if (!theme) return undefined;
  
  return {
    name: theme.name,
    displayName: theme.displayName,
    description: theme.description,
    category: theme.category,
    previewImage: theme.previewImage,
    available: theme.available,
  };
}

/**
 * Get all theme metadata
 */
export function getAllThemeMetadata() {
  return Object.values(themes)
    .filter(theme => theme.available)
    .map(theme => getThemeMetadata(theme.name)!);
}

export default themes;
