import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../Card";

describe("Card", () => {
  it("wraps children in .wp-card", () => {
    const { getByText } = render(<Card>x</Card>);
    expect(getByText("x").className).toContain("wp-card");
  });

  it("applies elevation modifier", () => {
    const { getByText } = render(<Card elevation={2}>y</Card>);
    expect(getByText("y").className).toContain("wp-card--elev-2");
  });

  it("omits elevation modifier when elevation=0", () => {
    const { getByText } = render(<Card elevation={0}>z</Card>);
    expect(getByText("z").className).not.toMatch(/wp-card--elev-/);
  });

  it("adds .wp-card--polaroid when polaroid=true", () => {
    const { getByText } = render(<Card polaroid>p</Card>);
    expect(getByText("p").className).toContain("wp-card--polaroid");
  });

  it("forwards className", () => {
    const { getByText } = render(<Card className="extra">q</Card>);
    expect(getByText("q").className).toContain("extra");
  });
});
