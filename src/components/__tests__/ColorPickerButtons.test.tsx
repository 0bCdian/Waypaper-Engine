import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ColorPickerButtons from "../ColorPickerButtons";

describe("ColorPickerButtons", () => {
  it("picking a color reports the hex", () => {
    const onPickColor = vi.fn();
    render(<ColorPickerButtons activeNear={false} onPickColor={onPickColor} />);

    fireEvent.change(screen.getByLabelText("Pick a color to filter by"), {
      target: { value: "#3aa7a0" },
    });

    expect(onPickColor).toHaveBeenCalledWith("#3aa7a0");
  });
});
