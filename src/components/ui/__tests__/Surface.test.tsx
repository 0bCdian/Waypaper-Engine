import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Surface } from "../Surface";

describe("Surface", () => {
  it("renders children inside a div with .wp-surface", () => {
    const { getByText } = render(<Surface>hello</Surface>);
    const el = getByText("hello");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("wp-surface");
  });

  it("forwards className", () => {
    const { getByText } = render(<Surface className="extra">x</Surface>);
    expect(getByText("x").className).toContain("extra");
  });

  it("supports elevation prop", () => {
    const { getByText } = render(<Surface elevation={2}>y</Surface>);
    expect(getByText("y").className).toContain("wp-surface--elev-2");
  });

  it("elevation=0 has no elev class", () => {
    const { getByText } = render(<Surface elevation={0}>z</Surface>);
    expect(getByText("z").className).not.toContain("wp-surface--elev");
  });
});
