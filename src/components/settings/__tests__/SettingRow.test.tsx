import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingRow } from "../SettingRow";

describe("SettingRow", () => {
  it("exposes a named group around its controls", () => {
    render(
      <SettingRow label="Volume" description="How loud">
        <input type="range" />
      </SettingRow>,
    );
    const group = screen.getByRole("group", { name: "Volume" });
    expect(group).toHaveAccessibleDescription("How loud");
  });
});
