import { useEffect } from "react";
import { daemonClient } from "@/client";
import { useMonitorStore } from "../stores/monitors";
import { refreshActivePlaylist } from "./useSetLastActivePlaylist";

/**
 * The daemon's event bus does non-blocking sends with no replay, and the SSE
 * client reconnects with backoff up to 60s. Everything published during that gap
 * is lost, so after a suspend or a daemon restart the renderer's stores keep
 * stale values forever. Pull the authoritative state on every reconnect, and on
 * `system_resumed` (emitted by the Electron main process via powerMonitor —
 * suspend/resume causes the same kind of state gap even without a dropped SSE
 * stream).
 */
export function useResyncOnReconnect(): void {
  useEffect(() => {
    const resync = () => {
      void useMonitorStore.getState().reQueryMonitors();
      void refreshActivePlaylist();
    };

    const disposers = [
      daemonClient.on("sse_reconnected", resync),
      daemonClient.on("system_resumed", resync),
    ];
    return () => {
      for (const dispose of disposers) dispose();
    };
  }, []);
}
