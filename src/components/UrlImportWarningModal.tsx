import type React from "react";
import { useState } from "react";

interface UrlImportWarningModalProps {
	isOpen: boolean;
	urls: string[];
	onConfirm: (dontShowAgain: boolean) => void;
	onCancel: () => void;
}

export const UrlImportWarningModal: React.FC<UrlImportWarningModalProps> = ({
	isOpen,
	urls,
	onConfirm,
	onCancel,
}) => {
	const [dontShowAgain, setDontShowAgain] = useState(false);

	if (!isOpen) return null;

	return (
		<dialog className="modal modal-open" aria-modal="true">
			<div className="modal-box max-w-md">
				<h3 className="font-bold text-lg flex items-center gap-2 text-warning">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						className="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2}
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					Import from the internet
				</h3>
				<p className="py-4 text-sm text-base-content/80">
					You are about to download and import{" "}
					<strong>{urls.length} image{urls.length > 1 ? "s" : ""}</strong> from
					the internet. Downloading files from untrusted sources can be
					dangerous.
				</p>
				<div className="max-h-32 overflow-y-auto rounded bg-base-200 p-2 text-xs font-mono break-all">
					{urls.map((url) => (
						<div key={url} className="truncate" title={url}>{url}</div>
					))}
				</div>
				<div className="form-control mt-4">
					<label className="label cursor-pointer justify-start gap-2">
						<input
							type="checkbox"
							className="checkbox checkbox-sm"
							checked={dontShowAgain}
							onChange={(e) => setDontShowAgain(e.target.checked)}
						/>
						<span className="label-text text-sm">Don&apos;t show this warning again</span>
					</label>
				</div>
				<div className="modal-action">
					<button className="btn btn-ghost" onClick={onCancel}>
						Cancel
					</button>
					<button
						className="btn btn-warning"
						onClick={() => onConfirm(dontShowAgain)}
					>
						Download &amp; Import
					</button>
				</div>
			</div>
			<form method="dialog" className="modal-backdrop">
				<button onClick={onCancel}>close</button>
			</form>
		</dialog>
	);
};
