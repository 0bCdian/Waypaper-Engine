import { useEffect, useRef } from "react";
import { useMonitorStore } from "../stores/monitors";
import { useShallow } from "zustand/react/shallow";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 800;

export const useLoadMonitors = () => {
  const { reQueryMonitors, setLastSavedMonitorConfig } = useMonitorStore(
    useShallow((s) => ({
      reQueryMonitors: s.reQueryMonitors,
      setLastSavedMonitorConfig: s.setLastSavedMonitorConfig,
    })),
  );
  const retriesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadMonitors = async () => {
      await reQueryMonitors();
      await setLastSavedMonitorConfig();

      const { monitorsList, _configLoaded } = useMonitorStore.getState();
      if (
        !cancelled &&
        (monitorsList.length === 0 || !_configLoaded) &&
        retriesRef.current < MAX_RETRIES
      ) {
        retriesRef.current += 1;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          if (!cancelled) void loadMonitors();
        }, RETRY_DELAY_MS * retriesRef.current);
      }
    };
    void loadMonitors();

    return () => {
      cancelled = true;
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [reQueryMonitors, setLastSavedMonitorConfig]);

  return reQueryMonitors;
};
