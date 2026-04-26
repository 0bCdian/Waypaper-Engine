/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Single layout: persistent icon-rail sidebar + scrollable main content.
 * No titlebar — the WM provides window chrome. No dual desktop/mobile switch.
 */

import type React from "react";
import { useEffect, type ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import { IconRailSidebar } from "./ModernSidebar";
import LoadingScreen from "../LoadingScreen";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDesignSystemStore } from "../../stores/designSystemStore";

// Keep DRAWER_CHECKBOX_ID exported so SidebarContent (mobile) still compiles cleanly
export const DRAWER_CHECKBOX_ID = "sidebar-drawer";

export interface ModernAppLayoutProps {
  children: ReactNode;
  className?: string;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({
  children,
  className,
}) => {
  const { currentTheme, isDarkMode } = useTheme();
  const config = useSettingsStore((s) => s.config);
  const syncToDOM = useDesignSystemStore((s) => s.syncToDOM);

  useEffect(() => {
    syncToDOM();
  }, [syncToDOM]);

  if (!config) {
    return <LoadingScreen />;
  }

  return (
    <div
      className={cn(
        "h-screen flex wp-theme-transition",
        isDarkMode ? "theme-dark" : "theme-light",
        className,
      )}
      data-theme={currentTheme}
    >
      <IconRailSidebar />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100">
        {children}
      </main>
    </div>
  );
};

export default ModernAppLayout;
