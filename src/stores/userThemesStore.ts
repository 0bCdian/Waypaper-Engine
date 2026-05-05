import { create } from "zustand";
import { devtools } from "zustand/middleware";

import type { UserThemeMeta } from "../styles/themes/types";
import { logger } from "../utils/logger";

interface UserThemesState {
  themes: readonly UserThemeMeta[];
}

interface UserThemesActions {
  loadFromDaemon: () => Promise<void>;
}

export const useUserThemesStore = create<UserThemesState & UserThemesActions>()(
  devtools(
    (set) => ({
      themes: [],

      async loadFromDaemon() {
        try {
          const res = await fetch("/api/themes");
          if (!res.ok) return;
          const list = (await res.json()) as UserThemeMeta[];
          for (const t of list) {
            ensureStylesheetInjected(t);
          }
          set({ themes: list }, false, "loadFromDaemon");
        } catch (e) {
          logger.warn("Failed to load user themes", { error: String(e) });
        }
      },
    }),
    { name: "user-themes" },
  ),
);

function ensureStylesheetInjected(t: UserThemeMeta) {
  if (typeof document === "undefined") return;
  const id = `wp-user-theme-${t.name}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = t.url;
  document.head.appendChild(link);
}
