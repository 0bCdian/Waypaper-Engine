import { describe, expect, it } from "vitest";

import { parseDaemonJsonBody } from "./parseDaemonJsonBody";

describe("parseDaemonJsonBody", () => {
  it("parses clean JSON objects", () => {
    expect(parseDaemonJsonBody('{"status":"reset"}\n')).toEqual({ status: "reset" });
  });

  it("strips stray leading primitives before JSON object start", () => {
    expect(parseDaemonJsonBody('true{"status":"reset"}')).toEqual({ status: "reset" });
  });

  it("strips stray leading primitives before JSON array start", () => {
    expect(parseDaemonJsonBody("null[1,2]")).toEqual([1, 2]);
  });

  it("rejects invalid payload after fallback", () => {
    expect(() => parseDaemonJsonBody("trueoops")).toThrow(SyntaxError);
  });
});
