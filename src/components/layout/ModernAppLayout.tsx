/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Single layout: persistent icon-rail sidebar + scrollable main content.
 * No titlebar — the WM provides window chrome. No dual desktop/mobile switch.
 */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import { IconRailSidebar } from "./ModernSidebar";
import { StartupIntro } from "../StartupIntro";
import NoBackendBanner from "../NoBackendBanner";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDesignSystemStore } from "../../stores/designSystemStore";
import { useStartupIntroGateStore } from "../../stores/startupIntroGateStore";

export interface ModernAppLayoutProps {
  children: ReactNode;
  className?: string;
}

/** When unset by daemon/client merge, startup intro defaults to enabled. */
function startupIntroDesired(configValue: boolean | undefined): boolean {
  return configValue ?? true;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({ children, className }) => {
  const { isDarkMode } = useTheme();
  const config = useSettingsStore((s) => s.config);
  const syncToDOM = useDesignSystemStore((s) => s.syncToDOM);

  const startupIntroOn = startupIntroDesired(config?.app?.startup_intro);
  const reduceMotionFs = useReducedMotion();
  const introFinishedRef = useRef(false);

  /** Initial: play intro whenever it is assumed on (includes config=null until first load merges). */
  const [introFinished, setIntroFinished] = useState(
    () => !startupIntroDesired(config?.app?.startup_intro),
  );

  const markIntroFinished = useCallback(() => {
    if (introFinishedRef.current) return;
    introFinishedRef.current = true;
    setIntroFinished(true);
  }, []);

  useLayoutEffect(() => {
    if (!startupIntroDesired(config?.app?.startup_intro)) {
      introFinishedRef.current = true;
      setIntroFinished(true);
    }
  }, [config?.app?.startup_intro]);

  /** Sync for sibling components (e.g. Modals): allow chrome when intro completed, intro off in config, or reduced-motion (matches when StartupIntro is not shown). */
  const introFinishedForGate = introFinished || !startupIntroOn || reduceMotionFs === true;

  useLayoutEffect(() => {
    useStartupIntroGateStore.getState().setIntroFinished(introFinishedForGate);
  }, [introFinishedForGate]);

  useEffect(() => {
    if (reduceMotionFs === true) {
      introFinishedRef.current = true;
      setIntroFinished(true);
    }
  }, [reduceMotionFs]);

  useEffect(() => {
    syncToDOM();
  }, [syncToDOM]);

  return (
    <>
      <div className={cn("h-screen flex", isDarkMode ? "theme-dark" : "theme-light", className)}>
        <IconRailSidebar />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100">
          <NoBackendBanner />
          {children}
        </main>
      </div>

      {!introFinished && startupIntroOn && reduceMotionFs !== true && (
        <StartupIntro onFinish={markIntroFinished} />
      )}
    </>
  );
};
