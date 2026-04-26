/**
 * Modern App Layout Component for Waypaper Engine
 *
 * Desktop (≥800px): TitleBar on top, icon-rail sidebar + main content side by side.
 * Mobile (<800px): DaisyUI drawer overlay sidebar.
 */

import type React from "react";
import { useEffect, type ReactNode } from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cn } from "../../utils/cn";
import { SidebarContent, IconRailSidebar } from "./ModernSidebar";
import TitleBar from "./TitleBar";
import { useSettingsStore } from "../../stores/settingsStore";
import { useDesignSystemStore } from "../../stores/designSystemStore";

export const DRAWER_CHECKBOX_ID = "sidebar-drawer";

export interface ModernAppLayoutProps {
  children: ReactNode;
  className?: string;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({ children, className }) => {
  const { currentTheme, isDarkMode } = useTheme();
  const config = useSettingsStore((s) => s.config);
  const syncToDOM = useDesignSystemStore((s) => s.syncToDOM);

  useEffect(() => {
    syncToDOM();
  }, [syncToDOM]);

  if (!config) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  const containerClasses = cn(
    "h-screen wp-theme-transition",
    isDarkMode ? "theme-dark" : "theme-light",
    className,
  );

  return (
    <div className={containerClasses} data-theme={currentTheme}>
      {/* ── Desktop layout (≥800px) ── */}
      <div className="hidden min-[800px]:flex flex-col h-full">
        <TitleBar />
        <div className="flex flex-1 min-h-0">
          <IconRailSidebar />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100">
            {children}
          </main>
        </div>
      </div>

      {/* ── Mobile layout (<800px): drawer ── */}
      <div className="flex min-[800px]:hidden h-full">
        <div className="drawer h-screen w-full">
          <input id={DRAWER_CHECKBOX_ID} type="checkbox" className="drawer-toggle" />
          <div className="drawer-content flex flex-col h-full min-h-0 overflow-hidden">
            <TitleBar />
            <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-base-100">
              {children}
            </main>
          </div>
          <div className="drawer-side z-50">
            <label
              htmlFor={DRAWER_CHECKBOX_ID}
              aria-label="close sidebar"
              className="drawer-overlay"
            />
            <SidebarContent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernAppLayout;
