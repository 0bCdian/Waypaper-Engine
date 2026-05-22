import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StartupIntro } from "../StartupIntro";

vi.mock("framer-motion", async () => {
  const dom = await import("framer-motion");
  return {
    ...dom,
    useReducedMotion: () => false as boolean | null,
  };
});

describe("StartupIntro", () => {
  it("announces startup for assistive tech", () => {
    const onFinish = vi.fn();
    render(<StartupIntro onFinish={onFinish} />);
    expect(screen.getByRole("status", { name: /Waypaper Engine startup/i })).toBeInTheDocument();
  });

  it("invokes onFinish after hold and exit (real RAF / motion timelines)", async () => {
    const onFinish = vi.fn();
    render(<StartupIntro onFinish={onFinish} />);
    await waitFor(
      () => {
        expect(onFinish).toHaveBeenCalledTimes(1);
      },
      { timeout: 5200 },
    );
  }, 6000);
});
