import React from "react";
import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Modal, { ModalHeader, type ModalHandle } from "../Modal";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

describe("Modal", () => {
  it("renders children inside the dialog", () => {
    render(
      <Modal>
        <p>Modal content</p>
      </Modal>,
    );

    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("showModal calls dialog.showModal", () => {
    const ref = React.createRef<ModalHandle>();
    render(
      <Modal ref={ref}>
        <p>Content</p>
      </Modal>,
    );

    ref.current?.showModal();
    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
  });

  it("close calls dialog.close", () => {
    const ref = React.createRef<ModalHandle>();
    render(
      <Modal ref={ref}>
        <p>Content</p>
      </Modal>,
    );

    ref.current?.close();
    expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
  });

  it("fires onClose callback when close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );

    await user.click(screen.getByLabelText("Close", { selector: "button" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("fires onClose when header close is clicked", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <Modal stripedHeader={{ title: "Title", subtitle: "Subtitle" }} onClose={onClose}>
        <p>Content</p>
      </Modal>,
    );

    await user.click(screen.getByLabelText("Close", { selector: "button" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not render floating close button when header prop is set", () => {
    const { container } = render(
      <Modal stripedHeader={{ title: "T" }}>
        <p>Content</p>
      </Modal>,
    );

    // Header provides its own CloseButton; the floating one must not also appear
    expect(container.querySelectorAll(".wp-close-btn")).toHaveLength(1);
  });

  it("Modal.Header renders title bar chrome", () => {
    const { container } = render(<ModalHeader title="Hi" onClose={() => {}} />);
    expect(container.querySelector(".wp-modal__header--bar")).toBeTruthy();
  });
});
