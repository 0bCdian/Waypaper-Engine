import { describe, it, expect, vi } from "vitest";
import { buildImageMenuItems } from "../contextMenuItems";

const image = { id: 1, name: "a.png", path: "/a.png", media_type: "image" } as never;

describe("buildImageMenuItems Rename", () => {
  it("adds Rename for a single image and calls the callback", () => {
    const onRename = vi.fn();
    const item = buildImageMenuItems(image, [], 1, onRename).find(
      (i) => i.type === "action" && i.label === "Rename",
    );
    expect(item).toBeDefined();
    if (item?.type === "action") item.onClick();
    expect(onRename).toHaveBeenCalledOnce();
  });

  it("omits Rename for multi-selection", () => {
    const items = buildImageMenuItems(image, [], 3, vi.fn());
    expect(items.some((i) => i.type === "action" && i.label === "Rename")).toBe(false);
  });
});
