/**
 * Input Component for Waypaper Engine
 *
 * A versatile input component with various types, states, and styling options.
 * Supports validation, icons, and theme integration.
 */

import React, { forwardRef } from "react";
import { cn } from "../../utils/cn";

/**
 * Input variant types
 */
export type InputVariant = "default" | "bordered" | "ghost" | "primary";

/**
 * Input size types
 */
export type InputSize = "xs" | "sm" | "md" | "lg";

/**
 * Input props interface
 */
export interface InputProps
	extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
	/** Input variant */
	variant?: InputVariant;
	/** Input size */
	size?: InputSize;
	/** Whether input has error state */
	error?: boolean;
	/** Error message to display */
	errorMessage?: string;
	/** Whether input is disabled */
	disabled?: boolean;
	/** Whether input is required */
	required?: boolean;
	/** Label text */
	label?: string;
	/** Helper text */
	helperText?: string;
	/** Icon to display before input */
	startIcon?: React.ReactNode;
	/** Icon to display after input */
	endIcon?: React.ReactNode;
	/** Whether to show character count */
	showCount?: boolean;
	/** Maximum character count */
	maxLength?: number;
	/** Additional CSS classes */
	className?: string;
	/** Input container classes */
	containerClassName?: string;
}

/**
 * Input component
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			variant = "default",
			size = "md",
			error = false,
			errorMessage,
			disabled = false,
			required = false,
			label,
			helperText,
			startIcon,
			endIcon,
			showCount = false,
			maxLength,
			className,
			containerClassName,
			...props
		},
		ref,
	) => {
		// Base classes
		const baseClasses = "input w-full transition-all duration-200";

		// Variant classes
		const variantClasses = {
			default: "input-bordered",
			bordered: "input-bordered border-2",
			ghost: "input-ghost",
			primary: "input-primary",
		};

		// Size classes
		const sizeClasses = {
			xs: "input-xs",
			sm: "input-sm",
			md: "input-md",
			lg: "input-lg",
		};

		// Error classes
		const errorClasses = error ? "input-error" : "";

		// Disabled classes
		const disabledClasses = disabled ? "input-disabled" : "";

		// Combine input classes
		const inputClasses = cn(
			baseClasses,
			variantClasses[variant],
			sizeClasses[size],
			errorClasses,
			disabledClasses,
			className,
		);

		// Container classes
		const containerClasses = cn("form-control w-full", containerClassName);

		// Get current value length
		const currentLength = props.value?.toString().length || 0;

		return (
			<div className={containerClasses}>
				{/* Label */}
				{label && (
					<label className="label">
						<span className="label-text font-medium">
							{label}
							{required && <span className="text-error ml-1">*</span>}
						</span>
					</label>
				)}

				{/* Input container */}
				<div className="relative">
					{/* Start icon */}
					{startIcon && (
						<div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/60">
							{startIcon}
						</div>
					)}

					{/* Input field */}
					<input
						ref={ref}
						className={cn(
							inputClasses,
						!!startIcon && "pl-10",
						!!endIcon && "pr-10",
						)}
						disabled={disabled}
						maxLength={maxLength}
						{...props}
					/>

					{/* End icon */}
					{endIcon && (
						<div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-base-content/60">
							{endIcon}
						</div>
					)}
				</div>

				{/* Helper text and error message */}
				<div className="label">
					<span className="label-text-alt">
						{/* Error message */}
						{error && errorMessage && (
							<span className="text-error">{errorMessage}</span>
						)}

						{/* Helper text */}
						{!error && helperText && (
							<span className="text-base-content/60">{helperText}</span>
						)}

						{/* Character count */}
						{showCount && maxLength && (
							<span className="text-base-content/60 ml-auto">
								{currentLength}/{maxLength}
							</span>
						)}
					</span>
				</div>
			</div>
		);
	},
);

Input.displayName = "Input";

/**
 * Textarea component
 */
export interface TextareaProps
	extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
	/** Textarea variant */
	variant?: InputVariant;
	/** Textarea size */
	size?: InputSize;
	/** Whether textarea has error state */
	error?: boolean;
	/** Error message to display */
	errorMessage?: string;
	/** Whether textarea is disabled */
	disabled?: boolean;
	/** Whether textarea is required */
	required?: boolean;
	/** Label text */
	label?: string;
	/** Helper text */
	helperText?: string;
	/** Whether to show character count */
	showCount?: boolean;
	/** Maximum character count */
	maxLength?: number;
	/** Number of rows */
	rows?: number;
	/** Whether textarea auto-resizes */
	autoResize?: boolean;
	/** Additional CSS classes */
	className?: string;
	/** Textarea container classes */
	containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
			variant = "default",
			size = "md",
			error = false,
			errorMessage,
			disabled = false,
			required = false,
			label,
			helperText,
			showCount = false,
			maxLength,
			rows = 3,
			autoResize = false,
			className,
			containerClassName,
			...props
		},
		ref,
	) => {
		// Base classes
		const baseClasses = "textarea w-full transition-all duration-200";

		// Variant classes
		const variantClasses = {
			default: "textarea-bordered",
			bordered: "textarea-bordered border-2",
			ghost: "textarea-ghost",
			primary: "textarea-primary",
		};

		// Size classes
		const sizeClasses = {
			xs: "textarea-xs",
			sm: "textarea-sm",
			md: "textarea-md",
			lg: "textarea-lg",
		};

		// Error classes
		const errorClasses = error ? "textarea-error" : "";

		// Disabled classes
		const disabledClasses = disabled ? "textarea-disabled" : "";

		// Auto-resize classes
		const autoResizeClasses = autoResize ? "resize-none" : "";

		// Combine textarea classes
		const textareaClasses = cn(
			baseClasses,
			variantClasses[variant],
			sizeClasses[size],
			errorClasses,
			disabledClasses,
			autoResizeClasses,
			className,
		);

		// Container classes
		const containerClasses = cn("form-control w-full", containerClassName);

		// Get current value length
		const currentLength = props.value?.toString().length || 0;

		return (
			<div className={containerClasses}>
				{/* Label */}
				{label && (
					<label className="label">
						<span className="label-text font-medium">
							{label}
							{required && <span className="text-error ml-1">*</span>}
						</span>
					</label>
				)}

				{/* Textarea field */}
				<textarea
					ref={ref}
					className={textareaClasses}
					disabled={disabled}
					maxLength={maxLength}
					rows={rows}
					{...props}
				/>

				{/* Helper text and error message */}
				<div className="label">
					<span className="label-text-alt">
						{/* Error message */}
						{error && errorMessage && (
							<span className="text-error">{errorMessage}</span>
						)}

						{/* Helper text */}
						{!error && helperText && (
							<span className="text-base-content/60">{helperText}</span>
						)}

						{/* Character count */}
						{showCount && maxLength && (
							<span className="text-base-content/60 ml-auto">
								{currentLength}/{maxLength}
							</span>
						)}
					</span>
				</div>
			</div>
		);
	},
);

Textarea.displayName = "Textarea";

export default Input;
