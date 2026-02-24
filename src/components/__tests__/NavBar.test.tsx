import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockReQueryMonitors = vi.fn().mockResolvedValue(undefined);
const mockModalOpen = vi.fn();

let mockMonitorState = {
	monitorSelection: {
		selectedMonitors: ["HDMI-A-1"],
		mode: "individual" as const,
	},
	reQueryMonitors: mockReQueryMonitors,
};

vi.mock("zustand/react/shallow", () => ({
	useShallow: (fn: Function) => fn,
}));

vi.mock("../../hooks/useIsNeo", () => ({ useIsNeo: () => false }));

vi.mock("../../stores/monitors", () => ({
	useMonitorStore: (selector: (s: typeof mockMonitorState) => unknown) =>
		selector(mockMonitorState),
}));

vi.mock("../../stores/modalStore", () => ({
	useModalStore: { getState: () => ({ open: mockModalOpen }) },
}));

vi.mock("./ModernAppLayout", () => ({
	DRAWER_CHECKBOX_ID: "sidebar-drawer",
}));

vi.mock("../../utils/cn", () => ({
	cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("../../utils/logger", () => ({
	logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { NavBar } from "../layout/NavBar";

beforeEach(() => {
	vi.clearAllMocks();

	mockMonitorState = {
		monitorSelection: {
			selectedMonitors: ["HDMI-A-1"],
			mode: "individual" as const,
		},
		reQueryMonitors: mockReQueryMonitors,
	};
});

describe("NavBar", () => {
	it("renders hamburger toggle and monitor button", () => {
		render(<NavBar />);

		expect(
			screen.getByLabelText("Toggle sidebar"),
		).toBeInTheDocument();
		expect(
			screen.getByLabelText("Select display monitor"),
		).toBeInTheDocument();
	});

	it("shows selected monitor names when monitors are selected", () => {
		mockMonitorState.monitorSelection.selectedMonitors = [
			"HDMI-A-1",
			"DP-1",
		];

		render(<NavBar />);

		expect(screen.getByText("HDMI-A-1, DP-1")).toBeInTheDocument();
	});

	it('shows "Select Display" when no monitors are selected', () => {
		mockMonitorState.monitorSelection.selectedMonitors = [];

		render(<NavBar />);

		expect(screen.getByText("Select Display")).toBeInTheDocument();
	});

	it("clicking monitor button calls reQueryMonitors then opens modal", async () => {
		const user = userEvent.setup();
		render(<NavBar />);

		const monitorBtn = screen.getByLabelText("Select display monitor");
		await user.click(monitorBtn);

		expect(mockReQueryMonitors).toHaveBeenCalled();
		expect(mockModalOpen).toHaveBeenCalledWith("monitors");
	});
});
