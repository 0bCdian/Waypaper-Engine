import { describe, expect, it } from "vitest";
import { LOOP_STUDIO_UI_DOC, OPTIONAL_RUNTIME_DEPS_DOC } from "../loopStudioHandbookUrls";

describe("loopStudioHandbookUrls", () => {
  it("points at published GitHub Pages handbook sections", () => {
    expect(LOOP_STUDIO_UI_DOC).toMatch(/^https:\/\/waypaper-engine\.diegoparra\.dev\/manual\//);
    expect(OPTIONAL_RUNTIME_DEPS_DOC).toMatch(
      /^https:\/\/waypaper-engine\.diegoparra\.dev\/manual\//,
    );
  });
});
