import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useContextMenuStore, type MenuItem } from "../../stores/contextMenuStore";

vi.mock("../../hooks/useIsNeo", () => ({
  useIsNeo: () => false,
}));

import ContextMenu from "../ContextMenu";

beforeEach(() => {
  vi.clearAllMocks();
  useContextMenuStore.setState({
    isOpen: false,
    position: { x: 0, y: 0 },
    items: [],
  });
});

function openMenuWith(items: MenuItem[], position = { x: 100, y: 100 }) {
  useContextMenuStore.setState({ isOpen: true, position, items });
}

describe("ContextMenu", () => {
  it("renders nothing when isOpen is false", () => {
    const { container } = render(<ContextMenu />);
    expect(container.innerHTML).toBe("");
  });

  it("renders menu items when open", () => {
    const items: MenuItem[] = [
      { type: "action", label: "Copy", onClick: vi.fn() },
      { type: "action", label: "Delete", onClick: vi.fn(), danger: true },
    ];

    openMenuWith(items);
    render(<ContextMenu />);

    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
  });

  it("clicking an action item calls onClick and closes menu", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const items: MenuItem[] = [{ type: "action", label: "Rename", onClick: handleClick }];

    openMenuWith(items);
    render(<ContextMenu />);

    await user.click(screen.getByText("Rename"));

    expect(handleClick).toHaveBeenCalledOnce();
    expect(useContextMenuStore.getState().isOpen).toBe(false);
  });

  it("Escape key closes menu", async () => {
    const items: MenuItem[] = [{ type: "action", label: "Open", onClick: vi.fn() }];

    openMenuWith(items);
    render(<ContextMenu />);

    expect(screen.getByText("Open")).toBeInTheDocument();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(useContextMenuStore.getState().isOpen).toBe(false);
  });

  it("disabled items are not clickable", async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    const items: MenuItem[] = [
      { type: "action", label: "Locked", onClick: handleClick, disabled: true },
    ];

    openMenuWith(items);
    render(<ContextMenu />);

    const button = screen.getByText("Locked").closest("button")!;
    expect(button).toBeDisabled();

    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
