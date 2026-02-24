import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../ConfirmDialog", () => ({
	confirmDialog: vi.fn().mockResolvedValue(true),
}));

vi.mock("../../utils/logger", () => ({
	logger: { error: vi.fn() },
}));

import { ImageProcessingProgress } from "../ImageProcessingProgress";
import { useImageProcessingStore } from "../../stores/imageProcessingStore";
import { confirmDialog } from "../ConfirmDialog";

beforeEach(() => {
	vi.clearAllMocks();
	useImageProcessingStore.setState({ batches: new Map() });
});

describe("ImageProcessingProgress", () => {
	it("renders nothing when no batches are active", () => {
		const { container } = render(<ImageProcessingProgress />);
		expect(container.innerHTML).toBe("");
	});

	it("renders progress bar with correct text for an active batch", () => {
		useImageProcessingStore.setState({
			batches: new Map([
				[
					"batch-1",
					{
						totalImages: 10,
						processedImages: 5,
						currentImage: "image.jpg",
						elapsedMs: 3000,
						errors: 0,
					},
				],
			]),
		});

		render(<ImageProcessingProgress />);

		expect(screen.getByText("Processing Images")).toBeInTheDocument();
		expect(screen.getByText("5/10")).toBeInTheDocument();
		expect(screen.getByText("Processing: image.jpg")).toBeInTheDocument();
		expect(screen.getByText("3s elapsed")).toBeInTheDocument();

		const progressBar = document.querySelector("[style]");
		expect(progressBar).toHaveStyle({ width: "50%" });
	});

	it("cancel button calls confirmDialog then goDaemon.cancelImport", async () => {
		useImageProcessingStore.setState({
			batches: new Map([
				[
					"batch-42",
					{
						totalImages: 8,
						processedImages: 2,
						currentImage: "pic.png",
						elapsedMs: 1000,
						errors: 0,
					},
				],
			]),
		});

		const user = userEvent.setup();
		render(<ImageProcessingProgress />);

		const cancelBtn = screen.getByTitle("Cancel import");
		await user.click(cancelBtn);

		expect(confirmDialog).toHaveBeenCalledOnce();
		expect(
			window.API_RENDERER.goDaemon.cancelImport,
		).toHaveBeenCalledWith("batch-42");
	});
});
