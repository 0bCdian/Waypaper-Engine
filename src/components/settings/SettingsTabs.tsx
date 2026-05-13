import type React from "react";
import { useState, useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";
import {
  readPersistedSettingsSection,
  writePersistedSettingsSection,
  SETTINGS_NAV_SECTION_IDS,
} from "@/utils/settingsNavStorage";
import { useSettingsStore } from "@/stores/settingsStore";
import { useShallow } from "zustand/react/shallow";
import SettingsSearch from "./SettingsSearch";
import AppSettingsSection from "./sections/AppSettingsSection";
import DaemonSettingsSection from "./sections/DaemonSettingsSection";
import BackendSettingsSection from "./sections/BackendSettingsSection";
import WallhavenSettingsSection from "./sections/WallhavenSettingsSection";
import type { ConfigSection } from "@/shared/types/unifiedConfig";
import type { SettingsSearchEntry } from "@/utils/settingsSearchIndex";
import { inferBackendSettingsSubTabFromSearchKey } from "@/utils/backendFieldPrefixes";

export interface SettingsTabsProps {
  className?: string;
  /** When rendered inside the modal, adjusts layout to fit a fixed-size container */
  isModal?: boolean;
}

interface NavItem {
  id: ConfigSection;
  label: string;
  icon: React.ReactNode;
  component: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    id: "app",
    label: "General",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    component: AppSettingsSection,
  },
  {
    id: "daemon",
    label: "Daemon",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
    component: DaemonSettingsSection,
  },
  {
    id: "backend",
    label: "Backend",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
    component: BackendSettingsSection,
  },
  {
    id: "wallhaven",
    label: "Wallhaven",
    icon: (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    component: WallhavenSettingsSection,
  },
];

function isSettingsNavSection(value: unknown): value is ConfigSection {
  return (
    typeof value === "string" && (SETTINGS_NAV_SECTION_IDS as readonly string[]).includes(value)
  );
}

export const SettingsTabs: React.FC<SettingsTabsProps> = ({ className, isModal = false }) => {
  const {
    errors,
    searchTerm,
    filteredSections,
    setSearchTerm,
    clearSearch,
    clearErrors,
    setPendingBackendSettingsTab,
  } = useSettingsStore(
    useShallow((s) => ({
      errors: s.errors,
      searchTerm: s.searchTerm,
      filteredSections: s.filteredSections,
      setSearchTerm: s.setSearchTerm,
      clearSearch: s.clearSearch,
      clearErrors: s.clearErrors,
      setPendingBackendSettingsTab: s.setPendingBackendSettingsTab,
    })),
  );

  const [activeSection, setActiveSection] = useState<ConfigSection>(
    () => readPersistedSettingsSection() ?? "app",
  );

  const selectSection = useCallback(
    (section: ConfigSection, searchEntry?: SettingsSearchEntry) => {
      if (section === "backend" && searchEntry?.section === "backend") {
        setPendingBackendSettingsTab(inferBackendSettingsSubTabFromSearchKey(searchEntry.key));
      } else {
        setPendingBackendSettingsTab(null);
      }
      setActiveSection(section);
      writePersistedSettingsSection(section);
    },
    [setPendingBackendSettingsTab],
  );

  if (!isSettingsNavSection(activeSection) || !filteredSections.includes(activeSection)) {
    const next = (filteredSections[0] ?? "app") as ConfigSection;
    setActiveSection(next);
    writePersistedSettingsSection(next);
  }

  useEffect(() => () => clearErrors(), [clearErrors]);

  const visibleNav = navItems.filter((n) => filteredSections.includes(n.id));
  const ActiveComponent = navItems.find((n) => n.id === activeSection)?.component;

  if (isModal) {
    return (
      <div className={cn("size-full flex flex-row", className)}>
        {/* Left rail */}
        <aside className="shrink-0 w-48 flex flex-col neo-settings-rail border-r border-base-content/8 bg-base-200/60">
          {/* Search */}
          <div className="p-3 neo-settings-search-wrap border-b border-base-content/5">
            <SettingsSearch
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onSearchClear={clearSearch}
              onNavigateToSection={selectSection}
              compact
            />
          </div>

          {/* Nav */}
          <nav className="flex flex-col flex-1 overflow-y-auto p-2 gap-1">
            {visibleNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => selectSection(item.id)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 text-left w-full",
                  "rounded-[var(--wp-radius-sm)] text-sm transition-colors",
                  activeSection === item.id
                    ? "neo-settings-nav-active bg-primary/12 text-primary font-medium"
                    : "neo-settings-nav-link text-base-content/60 hover:bg-base-content/5 hover:text-base-content",
                )}
              >
                <span className="shrink-0 opacity-70">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          {/* Error badge */}
          {errors.length > 0 && (
            <div className="p-3 border-t border-[length:var(--wp-border-w)] border-base-content/10">
              <div className="flex items-center gap-2 text-error text-xs font-bold uppercase tracking-wide">
                <svg className="size-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.length} error{errors.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </aside>

        {/* Content pane */}
        <main className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
          {ActiveComponent && (
            <div className="max-w-2xl mx-auto px-8 py-6">
              <ActiveComponent />
            </div>
          )}
        </main>
      </div>
    );
  }

  // Full-page fallback (unused now, kept for resilience)
  return (
    <div className={cn("size-full flex flex-col lg:flex-row", className)}>
      <aside
        className={cn(
          "shrink-0 flex border-base-content/10 bg-base-100",
          "flex-row lg:flex-col lg:w-56 xl:w-64 lg:border-r",
          "border-b lg:border-b-0",
        )}
      >
        <div className="hidden lg:block p-3 border-b border-base-content/5">
          <SettingsSearch
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onSearchClear={clearSearch}
            onNavigateToSection={selectSection}
            compact
          />
        </div>

        <nav className="flex lg:flex-col flex-1 overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto py-1 px-2 lg:py-2 gap-1">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => selectSection(item.id)}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-2 xl:px-4 xl:py-2.5 text-sm xl:text-base transition-colors",
                "lg:w-full lg:text-left",
                activeSection === item.id
                  ? "bg-base-content/10 font-medium text-base-content"
                  : "text-base-content/60 hover:bg-base-content/5 hover:text-base-content",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {errors.length > 0 && (
          <div className="hidden lg:block p-3 border-t border-base-content/5">
            <div className="flex items-center gap-2 text-error text-xs">
              <svg className="size-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.length} error{errors.length !== 1 ? "s" : ""}
            </div>
          </div>
        )}
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarGutter: "stable" }}>
        {ActiveComponent && (
          <div className="lg:max-w-2xl xl:max-w-3xl 2xl:max-w-4xl lg:mx-auto px-4 lg:px-8 xl:px-12 py-4 lg:py-6 xl:py-8">
            <ActiveComponent />
          </div>
        )}
      </main>
    </div>
  );
};

export default SettingsTabs;
