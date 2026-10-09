import { useEffect, useRef } from "react";
import { useMonitorStore } from "../stores/monitors";

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 800;

export const useLoadMonitors = () => {
  const reQueryMonitors = useMonitorStore((s) => s.reQueryMonitors);
  const retriesRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const loadMonitors = async () => {
      await reQueryMonitors();

      // The compositor may not report outputs yet right after login; retry only for that.
      if (
        !cancelled &&
        useMonitorStore.getState().monitorsList.length === 0 &&
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
  }, [reQueryMonitors]);

  return reQueryMonitors;
};
