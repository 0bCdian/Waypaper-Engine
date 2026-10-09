import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../PlaylistTrack", () => ({ default: () => null }));

import BottomDock from "../BottomDock";

describe("BottomDock pagination", () => {
  it("keeps Previous and Next at the ends and steps one page", () => {
    const onChange = vi.fn();
    render(<BottomDock currentPage={5} totalPages={20} handlePageChange={onChange} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveAccessibleName("Previous page");
    expect(buttons[buttons.length - 1]).toHaveAccessibleName("Next page");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(onChange.mock.calls).toEqual([[6], [4]]);
  });

  it("keeps the same number of buttons on every page so Next never moves", () => {
    const { rerender } = render(
      <BottomDock currentPage={1} totalPages={24} handlePageChange={vi.fn()} />,
    );
    const count = screen.getAllByRole("button").length;
    for (const page of [2, 5, 12, 20, 24]) {
      rerender(<BottomDock currentPage={page} totalPages={24} handlePageChange={vi.fn()} />);
      expect(screen.getAllByRole("button")).toHaveLength(count);
    }
  });

  it("disables the steps at the first and last page", () => {
    const { rerender } = render(
      <BottomDock currentPage={1} totalPages={3} handlePageChange={vi.fn()} />,
    );
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();

    rerender(<BottomDock currentPage={3} totalPages={3} handlePageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });
});
