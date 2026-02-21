import { useMemo, type ReactNode } from "react";
import { useDroppable } from "@dnd-kit/react";
import { useFoldersStore } from "../stores/foldersStore";
import { useImagesStore } from "../stores/images";
import type { DropTargetData } from "../stores/dragStore";

function DroppableBreadcrumb({
	folderId,
	droppableId,
	children,
}: {
	folderId: number | null;
	droppableId: string;
	children: ReactNode;
}) {
	const dropData = useMemo<DropTargetData>(
		() => ({ type: "breadcrumb", folderId }),
		[folderId],
	);
	const { ref, isDropTarget } = useDroppable({
		id: droppableId,
		data: dropData,
	});

	return (
		<span
			ref={ref}
			className={`transition-colors duration-150 rounded${isDropTarget ? " bg-primary/20" : ""}`}
		>
			{children}
		</span>
	);
}

function Breadcrumbs() {
	const breadcrumbPath = useFoldersStore((s) => s.breadcrumbPath);
	const currentFolderId = useFoldersStore((s) => s.currentFolderId);
	const navigateToFolder = useFoldersStore((s) => s.navigateToFolder);

	const isAtRoot = currentFolderId === null;

	const handleNavigate = (folderId: number | null) => {
		navigateToFolder(folderId);
		useImagesStore.getState().fetchPage(1, {
			folder_id: folderId === null ? "root" : folderId,
		});
	};

	return (
		<nav
			className="flex items-center gap-1 px-4 py-2 text-sm"
			aria-label="Breadcrumb"
		>
			<DroppableBreadcrumb folderId={null} droppableId="breadcrumb-root">
				{isAtRoot ? (
					<span className="btn btn-ghost btn-xs gap-1 font-semibold text-base-content cursor-default">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4"
						>
							<path
								fillRule="evenodd"
								d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
								clipRule="evenodd"
							/>
						</svg>
						Gallery
					</span>
				) : (
					<button
						type="button"
						onClick={() => handleNavigate(null)}
						className="btn btn-ghost btn-xs gap-1 text-base-content/70 hover:text-base-content"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 20 20"
							fill="currentColor"
							className="h-4 w-4"
						>
							<path
								fillRule="evenodd"
								d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z"
								clipRule="evenodd"
							/>
						</svg>
						Gallery
					</button>
				)}
			</DroppableBreadcrumb>

			{!isAtRoot &&
				breadcrumbPath.map((folder, index) => {
					const isLast = index === breadcrumbPath.length - 1;
					return (
						<span key={folder.id} className="flex items-center gap-1">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 20 20"
								fill="currentColor"
								className="h-3 w-3 text-base-content/40"
							>
								<path
									fillRule="evenodd"
									d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
									clipRule="evenodd"
								/>
							</svg>
							<DroppableBreadcrumb
								folderId={folder.id}
								droppableId={`breadcrumb-${folder.id}`}
							>
								{isLast ? (
									<span className="btn btn-ghost btn-xs font-semibold text-base-content cursor-default">
										{folder.name}
									</span>
								) : (
									<button
										type="button"
										onClick={() => handleNavigate(folder.id)}
										className="btn btn-ghost btn-xs text-base-content/70 hover:text-base-content"
									>
										{folder.name}
									</button>
								)}
							</DroppableBreadcrumb>
						</span>
					);
				})}
		</nav>
	);
}

export default Breadcrumbs;
