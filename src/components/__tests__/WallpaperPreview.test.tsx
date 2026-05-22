import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WallpaperPreview } from "../WallpaperPreview";
import type { Image, Monitor } from "../../../electron/daemon-go-types";

function makeMonitor(name: string, partial: Partial<Monitor> = {}): Monitor {
  return {
    name,
    width: 1920,
    height: 1080,
    x: 0,
    y: 0,
    scale: 1,
    refresh_rate: 60,
    transform: 0,
    ...partial,
  };
}

function makeImage(partial: Partial<Image> = {}): Image {
  return {
    id: 1,
    name: "wallpaper",
    path: "/images/wallpaper.png",
    media_type: "image",
    duration: 0,
    audio_enabled: false,
    width: 3840,
    height: 1080,
    format: "png",
    file_size: 1000,
    checksum: "abc",
    tags: [],
    colors: [],
    imported_at: "2026-01-01T00:00:00Z",
    source_path: "/src/wallpaper.png",
    is_selected: false,
    thumbnails: {
      default: "/t/default.png",
      "720p": "",
      "1080p": "/t/1080.png",
      "1440p": "",
      "4k": "",
    },
    folder_id: null,
    ...partial,
  };
}

const dp1 = makeMonitor("DP-1", { x: 0 });
const dp2 = makeMonitor("DP-2", { x: 1920 });

describe("WallpaperPreview", () => {
  it("shows a spinner while loading", () => {
    render(
      <WallpaperPreview
        image={null}
        mode="individual"
        monitor={dp1}
        monitors={[dp1]}
        loading
        scale={0.1}
      />,
    );
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a placeholder when no wallpaper is set", () => {
    render(
      <WallpaperPreview
        image={null}
        mode="individual"
        monitor={dp1}
        monitors={[dp1]}
        loading={false}
        scale={0.1}
      />,
    );
    expect(screen.getByText("DP-1")).toBeInTheDocument();
    expect(screen.getByText("1920x1080")).toBeInTheDocument();
  });

  it("renders a static image from its real path", () => {
    render(
      <WallpaperPreview
        image={makeImage({ path: "/images/real.png" })}
        mode="individual"
        monitor={dp1}
        monitors={[dp1]}
        loading={false}
        scale={0.1}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/images/real.png");
  });

  it("renders a video wallpaper as an animating <video> element", () => {
    const { container } = render(
      <WallpaperPreview
        image={makeImage({ media_type: "video", path: "/images/clip.mp4" })}
        mode="individual"
        monitor={dp1}
        monitors={[dp1]}
        loading={false}
        scale={0.1}
      />,
    );
    const video = container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video).toHaveAttribute("src", "/images/clip.mp4");
    expect(video).toHaveProperty("autoplay", true);
    expect(video).toHaveProperty("loop", true);
  });

  it("renders a gif from its real path so it animates", () => {
    render(
      <WallpaperPreview
        image={makeImage({ media_type: "gif", path: "/images/loop.gif" })}
        mode="individual"
        monitor={dp1}
        monitors={[dp1]}
        loading={false}
        scale={0.1}
      />,
    );
    expect(screen.getByRole("img")).toHaveAttribute("src", "/images/loop.gif");
  });

  it("applies a faithful extend split for static images", () => {
    render(
      <WallpaperPreview
        image={makeImage()}
        mode="extend"
        monitor={dp2}
        monitors={[dp1, dp2]}
        loading={false}
        scale={0.1}
      />,
    );
    // bbox 3840x1080, crop for DP-2 at x=1920. previewPerLogical = (1920*0.1)/1920 = 0.1
    const img = screen.getByRole("img");
    expect(img.style.position).toBe("absolute");
    expect(img.style.width).toBe("384px"); // 3840 * 0.1
    expect(img.style.left).toBe("-192px"); // -1920 * 0.1
    expect(img.style.top).toBe("0px");
  });

  it("does not split in clone mode", () => {
    render(
      <WallpaperPreview
        image={makeImage()}
        mode="clone"
        monitor={dp2}
        monitors={[dp1, dp2]}
        loading={false}
        scale={0.1}
      />,
    );
    const img = screen.getByRole("img");
    expect(img.style.position).toBe("");
    expect(img.style.left).toBe("");
  });

  it("does not split video wallpapers even in extend mode", () => {
    const { container } = render(
      <WallpaperPreview
        image={makeImage({ media_type: "video", path: "/images/clip.mp4" })}
        mode="extend"
        monitor={dp2}
        monitors={[dp1, dp2]}
        loading={false}
        scale={0.1}
      />,
    );
    const video = container.querySelector("video");
    expect(video?.style.position).toBe("");
  });
});
