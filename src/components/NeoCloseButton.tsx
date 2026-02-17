import { useDesignSystemStore } from "../stores/designSystemStore";

interface NeoCloseButtonProps {
	onClick: () => void;
}

/**
 * Close button that renders a Stitch-style neobrutalist square button
 * when the design system is in neobrutalist mode, or falls back to
 * the standard DaisyUI ghost circle button otherwise.
 */
function NeoCloseButton({ onClick }: NeoCloseButtonProps) {
	const isNeo = useDesignSystemStore(
		(s) => s.designMode === "neobrutalist",
	);

	if (isNeo) {
		return (
			<button
				type="button"
				className="neo-close-btn"
				onClick={onClick}
				aria-label="Close"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
				>
					<title>Close</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		);
	}

	return (
		<button
			type="button"
			className="btn btn-circle btn-ghost btn-sm absolute right-3 top-3"
			onClick={onClick}
		>
			✕
		</button>
	);
}

export default NeoCloseButton;
