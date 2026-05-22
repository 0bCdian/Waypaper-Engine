import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { useSettingsStore } from "../stores/settingsStore";
import { applyAppTypography } from "../utils/appTypography";

/**
 * Applies `app.font_*` typography to `document.documentElement` whenever config changes.
 */
export function useSyncAppTypography(): void {
  const { preset, body, display, mono } = useSettingsStore(
    useShallow((s) => ({
      preset: s.config?.app?.font_preset,
      body: s.config?.app?.font_family_body,
      display: s.config?.app?.font_family_display,
      mono: s.config?.app?.font_family_mono,
    })),
  );

  useEffect(() => {
    applyAppTypography(useSettingsStore.getState().config?.app ?? undefined);
  }, [preset, body, display, mono]);
}
