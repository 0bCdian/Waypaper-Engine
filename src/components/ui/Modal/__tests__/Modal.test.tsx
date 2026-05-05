import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "../Modal";

describe("Modal", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <Modal open={false} onClose={() => {}}>
        <p>X</p>
      </Modal>,
    );
    expect(container.querySelector(".wp-modal")).toBeNull();
  });

  it("renders content when open", () => {
    const { getByText } = render(
      <Modal open onClose={() => {}}>
        <p>hi</p>
      </Modal>,
    );
    expect(getByText("hi")).toBeTruthy();
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose}>
        <p>x</p>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("applies size class when size prop given", () => {
    const { container } = render(
      <Modal open onClose={() => {}} size="lg">
        <p>x</p>
      </Modal>,
    );
    expect(container.querySelector(".wp-modal--lg")).toBeTruthy();
  });
});
