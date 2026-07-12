import { describe, expect, it } from "vitest";
import { ImagesClient } from "./imagesClient";
import type { HttpTransport } from "./httpTransport";

function clientCapturingPath(paths: string[]): ImagesClient {
  const transport = {
    request: (_method: string, path: string) => {
      paths.push(path);
      return Promise.resolve({ data: [], pagination: null });
    },
  } as unknown as HttpTransport;
  return new ImagesClient(transport);
}

describe("ImagesClient.getImages query serialization", () => {
  it("forwards hue_group to the daemon", async () => {
    const paths: string[] = [];
    await clientCapturingPath(paths).getImages({ hue_group: 3 });
    expect(paths[0]).toContain("hue_group=3");
  });

  it("forwards the neutral hue group (99)", async () => {
    const paths: string[] = [];
    await clientCapturingPath(paths).getImages({ hue_group: 99 });
    expect(paths[0]).toContain("hue_group=99");
  });

  it("omits hue_group when unset", async () => {
    const paths: string[] = [];
    await clientCapturingPath(paths).getImages({ page: 1 });
    expect(paths[0]).not.toContain("hue_group");
  });
});
