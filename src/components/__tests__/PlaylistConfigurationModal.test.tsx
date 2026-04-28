import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("zustand/react/shallow", () => ({
  useShallow: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("../../stores/playlist", () => ({
  usePlaylistStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setConfiguration: vi.fn(),
      playlist: {
        images: [],
        configuration: {
          type: "timer",
          interval: 300,
          order: "ordered",
          always_start_on_first_image: false,
        },
      },
    }),
}));

vi.mock("../../stores/modalStore", () => ({
  useModalStore: {
    getState: () => ({
      register: vi.fn(),
      unregister: vi.fn(),
    }),
  },
}));

vi.mock("../Modal", () => ({
  default: React.forwardRef(
    (
      {
        children,
        stripedHeader,
      }: React.PropsWithChildren<{ stripedHeader?: { title?: React.ReactNode } }>,
      ref: React.Ref<unknown>,
    ) => {
      React.useImperativeHandle(ref, () => ({
        showModal: vi.fn(),
        close: vi.fn(),
      }));
      return (
        <div>
          {stripedHeader?.title != null ? <h2>{stripedHeader.title}</h2> : null}
          {children}
        </div>
      );
    },
  ),
}));

vi.mock("../../utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import PlaylistConfigurationModal from "../PlaylistConfigurationModal";

describe("PlaylistConfigurationModal", () => {
  it("does not offer per-playlist transition toggle", () => {
    render(<PlaylistConfigurationModal />);
    expect(screen.queryByText("Show transition")).toBeNull();
  });
});
