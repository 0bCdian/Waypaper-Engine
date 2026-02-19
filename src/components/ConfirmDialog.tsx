import { useEffect, useRef } from "react";
import { create } from "zustand";
import { useDesignSystemStore } from "../stores/designSystemStore";

interface ConfirmOptions {
	title: string;
	message: string;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
}

interface ConfirmState {
	isOpen: boolean;
	options: ConfirmOptions | null;
	resolve: ((value: boolean) => void) | null;
	show: (options: ConfirmOptions) => Promise<boolean>;
	respond: (value: boolean) => void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
	isOpen: false,
	options: null,
	resolve: null,

	show: (options) =>
		new Promise<boolean>((resolve) => {
			set({ isOpen: true, options, resolve });
		}),

	respond: (value) => {
		const { resolve } = get();
		resolve?.(value);
		set({ isOpen: false, options: null, resolve: null });
	},
}));

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
	return useConfirmStore.getState().show(options);
}

function ConfirmDialog() {
	const { isOpen, options, respond } = useConfirmStore();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const isNeo = useDesignSystemStore((s) => s.designMode === "neobrutalist");

	useEffect(() => {
		if (isOpen) {
			dialogRef.current?.showModal();
		} else {
			dialogRef.current?.close();
		}
	}, [isOpen]);

	if (!options) return null;

	const confirmClass = options.danger
		? isNeo
			? "btn btn-error uppercase"
			: "btn btn-error"
		: isNeo
			? "btn btn-primary uppercase"
			: "btn btn-primary";
	const cancelClass = isNeo ? "btn uppercase" : "btn";

	return (
		<dialog
			ref={dialogRef}
			className="modal"
			onClose={() => respond(false)}
		>
			<div className={`modal-box ${isNeo ? "neo-card" : ""}`}>
				<h3 className="text-lg font-bold">{options.title}</h3>
				<p className="py-4 text-base-content/80">{options.message}</p>
				<div className="modal-action">
					<button
						type="button"
						className={cancelClass}
						onClick={() => respond(false)}
					>
						{options.cancelLabel ?? "Cancel"}
					</button>
					<button
						type="button"
						className={confirmClass}
						onClick={() => respond(true)}
					>
						{options.confirmLabel ?? "Confirm"}
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button type="submit" onClick={() => respond(false)}>close</button>
			</form>
		</dialog>
	);
}

export default ConfirmDialog;
