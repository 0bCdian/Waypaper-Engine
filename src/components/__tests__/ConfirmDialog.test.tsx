import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConfirmDialog, { useConfirmStore, confirmDialog } from "../ConfirmDialog";

vi.mock("../../hooks/useIsNeo", () => ({ useIsNeo: () => false }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

beforeEach(() => {
  useConfirmStore.setState({
    isOpen: false,
    options: null,
    resolve: null,
  });
});

describe("useConfirmStore", () => {
  it("show() opens dialog and respond() resolves the promise", async () => {
    const promise = useConfirmStore.getState().show({
      title: "Delete?",
      message: "Are you sure?",
    });

    const state = useConfirmStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.options?.title).toBe("Delete?");

    state.respond(true);

    await expect(promise).resolves.toBe(true);
    expect(useConfirmStore.getState().isOpen).toBe(false);
  });

  it("respond(false) resolves with false", async () => {
    const promise = useConfirmStore.getState().show({
      title: "Confirm",
      message: "Proceed?",
    });

    useConfirmStore.getState().respond(false);

    await expect(promise).resolves.toBe(false);
  });
});

describe("confirmDialog", () => {
  it("delegates to useConfirmStore.show", async () => {
    const promise = confirmDialog({
      title: "Test",
      message: "Hello",
    });

    expect(useConfirmStore.getState().isOpen).toBe(true);

    useConfirmStore.getState().respond(true);
    await expect(promise).resolves.toBe(true);
  });
});

describe("ConfirmDialog component", () => {
  it("renders title and message when open", () => {
    useConfirmStore.setState({
      isOpen: true,
      options: { title: "Remove item", message: "This cannot be undone" },
      resolve: vi.fn(),
    });

    render(<ConfirmDialog />);

    expect(screen.getByText("Remove item")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone")).toBeInTheDocument();
  });

  it("confirm button calls respond(true)", async () => {
    const user = userEvent.setup();
    let resolved: boolean | undefined;

    useConfirmStore.setState({
      isOpen: true,
      options: { title: "OK?", message: "Sure?" },
      resolve: (v) => {
        resolved = v;
      },
    });

    render(<ConfirmDialog />);

    await user.click(screen.getByText("Confirm"));
    expect(resolved).toBe(true);
  });

  it("cancel button calls respond(false)", async () => {
    const user = userEvent.setup();
    let resolved: boolean | undefined;

    useConfirmStore.setState({
      isOpen: true,
      options: { title: "OK?", message: "Sure?" },
      resolve: (v) => {
        resolved = v;
      },
    });

    render(<ConfirmDialog />);

    await user.click(screen.getByText("Cancel"));
    expect(resolved).toBe(false);
  });
});
