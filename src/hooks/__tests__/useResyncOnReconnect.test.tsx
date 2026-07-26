import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useResyncOnReconnect } from "../useResyncOnReconnect";

const handlers: Record<string, (payload: unknown) => void> = {};

vi.mock("@/client", () => ({
  daemonClient: {
    on: (event: string, fn: (payload: unknown) => void) => {
      handlers[event] = fn;
      return () => delete handlers[event];
    },
  },
}));

const reQueryMonitors = vi.fn().mockResolvedValue(undefined);
vi.mock("../../stores/monitors", () => ({
  useMonitorStore: { getState: () => ({ reQueryMonitors }) },
}));

const refreshActivePlaylist = vi.fn().mockResolvedValue(undefined);
vi.mock("../useSetLastActivePlaylist", () => ({
  refreshActivePlaylist: () => refreshActivePlaylist(),
}));

describe("useResyncOnReconnect", () => {
  beforeEach(() => {
    reQueryMonitors.mockClear();
    refreshActivePlaylist.mockClear();
  });

  it("does nothing until the stream reconnects", () => {
    renderHook(() => useResyncOnReconnect());
    expect(reQueryMonitors).not.toHaveBeenCalled();
    expect(refreshActivePlaylist).not.toHaveBeenCalled();
  });

  it("refetches daemon state on sse_reconnected", async () => {
    renderHook(() => useResyncOnReconnect());

    handlers["sse_reconnected"]?.({});
    await vi.waitFor(() => expect(reQueryMonitors).toHaveBeenCalledTimes(1));
    expect(refreshActivePlaylist).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useResyncOnReconnect());
    unmount();
    expect(handlers["sse_reconnected"]).toBeUndefined();
    expect(handlers["system_resumed"]).toBeUndefined();
  });

  it("refetches daemon state on system_resumed", async () => {
    renderHook(() => useResyncOnReconnect());

    handlers["system_resumed"]?.({});
    await vi.waitFor(() => expect(reQueryMonitors).toHaveBeenCalledTimes(1));
    expect(refreshActivePlaylist).toHaveBeenCalledTimes(1);
  });
});
