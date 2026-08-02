import { describe, expect, it } from "vitest";
import { PlaylistsClient } from "./playlistsClient";
import type { HttpTransport } from "./httpTransport";

interface CapturedRequest {
  method: string;
  path: string;
  body: unknown;
}

function clientCapturingRequests(requests: CapturedRequest[]): PlaylistsClient {
  const transport = {
    request: (method: string, path: string, body: unknown) => {
      requests.push({ method, path, body });
      return Promise.resolve(undefined);
    },
  } as unknown as HttpTransport;
  return new PlaylistsClient(transport);
}

describe("PlaylistsClient.startPlaylist", () => {
  it("sends every selected monitor name and never a wildcard", async () => {
    const requests: CapturedRequest[] = [];
    await clientCapturingRequests(requests).startPlaylist(7, ["DP-1", "DP-2"], false);

    expect(requests[0].method).toBe("POST");
    expect(requests[0].path).toBe("/playlists/7/start");
    expect(requests[0].body).toEqual({ monitors: ["DP-1", "DP-2"], extend: false });
  });

  it("sends extend true when the selection spans monitors", async () => {
    const requests: CapturedRequest[] = [];
    await clientCapturingRequests(requests).startPlaylist(1, ["DP-1", "DP-2"], true);

    expect(requests[0].body).toEqual({ monitors: ["DP-1", "DP-2"], extend: true });
  });

  it("sends an empty monitor list unchanged so the daemon expands it", async () => {
    const requests: CapturedRequest[] = [];
    await clientCapturingRequests(requests).startPlaylist(2, [], false);

    expect(requests[0].body).toEqual({ monitors: [], extend: false });
  });
});
