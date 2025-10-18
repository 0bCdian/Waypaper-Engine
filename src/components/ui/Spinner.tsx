/**
 * Spinner Component for Waypaper Engine
 *
 * A loading spinner component with various sizes and styles.
 * Supports different animation types and theme integration.
 */

import React from "react";
import { cn } from "../../utils/cn";

/**
 * Spinner size types
 */
export type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl";

/**
 * Spinner variant types
 */
export type SpinnerVariant = "default" | "dots" | "pulse" | "bounce";

/**
 * Spinner props interface
 */
export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
	/** Spinner size */
	size?: SpinnerSize;
	/** Spinner variant */
	variant?: SpinnerVariant;
	/** Whether spinner is centered */
	centered?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Text to display with spinner */
	text?: string;
}

/**
 * Spinner component
 */
export const Spinner: React.FC<SpinnerProps> = ({
	size = "md",
	variant = "default",
	centered = false,
	className,
	text,
	...props
}) => {
	// Size classes
	const sizeClasses = {
		xs: "w-3 h-3",
		sm: "w-4 h-4",
		md: "w-6 h-6",
		lg: "w-8 h-8",
		xl: "w-12 h-12",
	};

	// Container classes
	const containerClasses = cn(
		"flex items-center gap-2",
		centered && "justify-center",
		className,
	);

	// Render different spinner variants
	const renderSpinner = () => {
		switch (variant) {
			case "dots":
				return (
					<div className="flex space-x-1">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className={cn(
									"bg-current rounded-full animate-pulse",
									sizeClasses[size],
								)}
								style={{
									animationDelay: `${i * 0.2}s`,
									animationDuration: "1s",
								}}
							/>
						))}
					</div>
				);

			case "pulse":
				return (
					<div
						className={cn(
							"bg-current rounded-full animate-pulse",
							sizeClasses[size],
						)}
					/>
				);

			case "bounce":
				return (
					<div className="flex space-x-1">
						{[0, 1, 2].map((i) => (
							<div
								key={i}
								className={cn(
									"bg-current rounded-full animate-bounce",
									sizeClasses[size],
								)}
								style={{
									animationDelay: `${i * 0.1}s`,
								}}
							/>
						))}
					</div>
				);

			case "default":
			default:
				return (
					<svg
						className={cn("animate-spin text-current", sizeClasses[size])}
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle
							className="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							strokeWidth="4"
						/>
						<path
							className="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
				);
		}
	};

	return (
		<div className={containerClasses} {...props}>
			{renderSpinner()}
			{text && <span className="text-sm text-current/80">{text}</span>}
		</div>
	);
};

/**
 * Loading Spinner - commonly used variant
 */
export interface LoadingSpinnerProps extends Omit<SpinnerProps, "variant"> {
	/** Loading text */
	loadingText?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
	loadingText,
	text,
	...props
}) => {
	return <Spinner variant="default" text={loadingText || text} {...props} />;
};

/**
 * Dots Spinner - alternative loading indicator
 */
export const DotsSpinner: React.FC<SpinnerProps> = (props) => {
	return <Spinner variant="dots" {...props} />;
};

/**
 * Pulse Spinner - simple pulsing indicator
 */
export const PulseSpinner: React.FC<SpinnerProps> = (props) => {
	return <Spinner variant="pulse" {...props} />;
};

/**
 * Bounce Spinner - bouncing dots indicator
 */
export const BounceSpinner: React.FC<SpinnerProps> = (props) => {
	return <Spinner variant="bounce" {...props} />;
};

export default Spinner;
