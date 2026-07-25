import { useEffect } from "react";
import { daemonClient } from "@/client";
import { useMonitorStore } from "../stores/monitors";
import { refreshActivePlaylist } from "./useSetLastActivePlaylist";

/**
 * The daemon's event bus does non-blocking sends with no replay, and the SSE
 * client reconnects with backoff up to 60s. Everything published during that gap
 * is lost, so after a suspend or a daemon restart the renderer's stores keep
 * stale values forever. Pull the authoritative state on every reconnect.
 */
export function useResyncOnReconnect(): void {
  useEffect(() => {
    const dispose = daemonClient.on("sse_reconnected", () => {
      void useMonitorStore.getState().reQueryMonitors();
      void refreshActivePlaylist();
    });
    return dispose;
  }, []);
}
