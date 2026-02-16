import { useEffect } from "react";
import { useMonitorStore } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";

export const useLoadMonitors = () => {
	const { reQueryMonitors, setLastSavedMonitorConfig } = useMonitorStore(
		useShallow((s) => ({
			reQueryMonitors: s.reQueryMonitors,
			setLastSavedMonitorConfig: s.setLastSavedMonitorConfig,
		})),
	);

	useEffect(() => {
		const loadMonitors = async () => {
			await reQueryMonitors();
			await setLastSavedMonitorConfig();
		};
		void loadMonitors();
	}, [reQueryMonitors, setLastSavedMonitorConfig]);

	return reQueryMonitors;
};
