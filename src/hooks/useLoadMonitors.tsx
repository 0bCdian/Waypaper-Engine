import { useEffect } from "react";
import { useMonitorStore } from "../stores/monitors";

export const useLoadMonitors = () => {
	const { reQueryMonitors, setLastSavedMonitorConfig } = useMonitorStore();

	useEffect(() => {
		const loadMonitors = async () => {
			await reQueryMonitors();
			await setLastSavedMonitorConfig();
		};
		void loadMonitors();
	}, [reQueryMonitors, setLastSavedMonitorConfig]);

	return reQueryMonitors;
};
