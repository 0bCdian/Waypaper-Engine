/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Single layout: persistent icon-rail sidebar + scrollable main content.
 * No titlebar — the WM provides window chrome. No dual desktop/mobile switch.
 */

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
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

const INTRO_PLAYED_KEY = "waypaper-intro-played";

function introAlreadyPlayed(): boolean {
  try {
    return localStorage.getItem(INTRO_PLAYED_KEY) !== null;
  } catch {
    return false;
  }
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({ children, className }) => {
  const { isDarkMode } = useTheme();
  // `startup_intro` defaults to on; it only allows the one-time first-launch intro.
  const introAllowed = useSettingsStore((s) => s.config?.app?.startup_intro) !== false;
  const syncToDOM = useDesignSystemStore((s) => s.syncToDOM);
  const reduceMotion = useReducedMotion() === true;

  const [introFinished, setIntroFinished] = useState(introAlreadyPlayed);
  const markIntroFinished = useCallback(() => {
    try {
      localStorage.setItem(INTRO_PLAYED_KEY, "1");
    } catch {
      /* the intro just plays again next launch */
    }
    setIntroFinished(true);
  }, []);

  const showIntro = !introFinished && introAllowed && !reduceMotion;

  /** Lets siblings (e.g. Modals) hold startup chrome until the intro is out of the way. */
  useLayoutEffect(() => {
    useStartupIntroGateStore.getState().setIntroFinished(!showIntro);
  }, [showIntro]);

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

      {showIntro && <StartupIntro onFinish={markIntroFinished} />}
    </>
  );
};
