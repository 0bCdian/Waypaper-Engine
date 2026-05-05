import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders a <button> with .btn .wp-btn", () => {
    const { getByRole } = render(<Button>OK</Button>);
    const b = getByRole("button");
    expect(b.className).toContain("btn");
    expect(b.className).toContain("wp-btn");
  });

  it("supports variant=primary", () => {
    const { getByRole } = render(<Button variant="primary">Go</Button>);
    expect(getByRole("button").className).toContain("btn-primary");
  });

  it("supports size=sm", () => {
    const { getByRole } = render(<Button size="sm">Go</Button>);
    expect(getByRole("button").className).toContain("btn-sm");
  });

  it("defaults to type=button", () => {
    const { getByRole } = render(<Button>X</Button>);
    expect(getByRole("button").getAttribute("type")).toBe("button");
  });
});
