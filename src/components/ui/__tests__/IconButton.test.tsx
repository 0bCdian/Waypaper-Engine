import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CloseButton } from "../CloseButton";
import { IconButton } from "../IconButton";

describe("IconButton", () => {
  it("renders with .wp-icon-btn", () => {
    const { getByRole } = render(
      <IconButton aria-label="x">
        <span />
      </IconButton>,
    );
    expect(getByRole("button").className).toContain("wp-icon-btn");
  });

  it("includes size modifier class", () => {
    const { getByRole } = render(
      <IconButton aria-label="x" size="lg">
        <span />
      </IconButton>,
    );
    expect(getByRole("button").className).toContain("wp-icon-btn--lg");
  });
});

describe("CloseButton", () => {
  it("renders with .wp-close-btn", () => {
    const { getByRole } = render(<CloseButton />);
    expect(getByRole("button").className).toContain("wp-close-btn");
  });

  it("has aria-label Close by default", () => {
    const { getByRole } = render(<CloseButton />);
    expect(getByRole("button").getAttribute("aria-label")).toBe("Close");
  });

  it("uses custom aria-label", () => {
    const { getByRole } = render(<CloseButton aria-label="Dismiss" />);
    expect(getByRole("button").getAttribute("aria-label")).toBe("Dismiss");
  });
});
