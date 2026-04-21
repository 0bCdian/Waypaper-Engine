import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { createMockAPI } from "./mocks/apiRenderer";

afterEach(() => {
  cleanup();
});

const mockAPI = createMockAPI();
vi.stubGlobal("API_RENDERER", mockAPI);

if (typeof window !== "undefined") {
  Object.defineProperty(window, "API_RENDERER", {
    value: mockAPI,
    writable: true,
    configurable: true,
  });

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.stubGlobal("__DEBUG__", false);
