/**
 * Theme system type definitions for Waypaper Engine
 */

/**
 * Extended color palette with multiple shades
 */
export interface ExtendedThemeColors {
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
 */
export interface ThemeConfig {
	/** Unique theme identifier */
	name: string;
	/** Human-readable theme name */
	displayName: string;
	/** Theme description */
	description: string;
	/** Theme category (dark, light, colorful, etc.) */
	category: "dark" | "light" | "colorful" | "minimal" | "mixed";
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
