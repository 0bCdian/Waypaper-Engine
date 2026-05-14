/**
 * Sidebar / Icon Rail Component for Waypaper Engine
 *
 * Desktop (≥800px): persistent icon rail — 56px collapsed, 240px expanded.
 * Mobile (<800px): the DaisyUI drawer overlay is used instead (see ModernAppLayout).
 */

import type React from "react";
import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { LazyMotion, m, AnimatePresence, domAnimation } from "framer-motion";
import { SidebarConfiguration } from "../SidebarConfiguration";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";
import { confirmDialog } from "../ConfirmDialog";
import { cn } from "../../utils/cn";
import { useSettingsModalStore } from "../../stores/settingsModalStore";

const PINNED_KEY = "waypaper-sidebar-pinned";
const HOVER_REVEAL_KEY = "waypaper-sidebar-hover-reveal";

/** Programmatically close the drawer (mobile fallback) */
function closeDrawer() {
  const checkbox = document.getElementById(DRAWER_CHECKBOX_ID) as HTMLInputElement | null;
  if (checkbox) checkbox.checked = false;
}

const NAV_ITEMS = [
  {
    to: "/",
    label: "Gallery",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Gallery</title>
        <rect width="7" height="7" x="3" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="3" rx="1" />
        <rect width="7" height="7" x="14" y="14" rx="1" />
        <rect width="7" height="7" x="3" y="14" rx="1" />
      </svg>
    ),
  },
  {
    to: "/wallhaven",
    label: "Wallhaven",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Wallhaven</title>
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: "/history",
    label: "History",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>History</title>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: "/loop-studio",
    label: "Loop Studio",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Loop Studio</title>
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    to: "/shader-studio",
    label: "Shader Studio",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Shader Studio</title>
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M5 19h14" />
      </svg>
    ),
  },
  {
    to: "/settings",
    label: "Settings",
    icon: (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <title>Settings</title>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
] as const;

/** Desktop icon rail — always visible, collapses to icons, expands on hover or pin */
export const IconRailSidebar: React.FC = () => {
  const location = useLocation();
  const isConfigurationPage = location.pathname === "/configuration";
  const { open: settingsOpen, openModal: openSettings } = useSettingsModalStore();

  const [pinned, setPinned] = useState<boolean>(() => {
    try {
      return localStorage.getItem(PINNED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [hovered, setHovered] = useState(false);
  const [hoverRevealEnabled, setHoverRevealEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HOVER_REVEAL_KEY) === "true";
    } catch {
      return false;
    }
  });

  const expanded = pinned || (hoverRevealEnabled && hovered);

  const handlePinToggle = useCallback(() => {
    setPinned((p) => {
      const next = !p;
      try {
        localStorage.setItem(PINNED_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleHoverRevealToggle = useCallback(() => {
    setHoverRevealEnabled((v) => {
      const next = !v;
      try {
        localStorage.setItem(HOVER_REVEAL_KEY, String(next));
      } catch {}
      return next;
    });
  }, []);

  const isActive = (to: string) => {
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  };

  if (isConfigurationPage) {
    return (
      <aside className="bg-base-200 border-r border-base-300 w-64 flex flex-col overflow-y-auto shrink-0 neo-sidebar neo-sidebar--config">
        <SidebarConfiguration />
      </aside>
    );
  }

  const railEaseTransition = `var(--wp-dur-base) var(--wp-ease-out)`;

  // Padding-left transitions icons with the rail width (same duration/easing as aside width).
  // Nav uses px-2 (8px each side): inner width = 40px when rail is 56px.
  // Center 20px icons: (40 - 20) / 2 = 10px. Center 16px footer icons: (40 - 16) / 2 = 12px.
  // Expanded insets match settings modal rail (nav px-2 + control px-3 → 20px to icon).
  const navItemStyle = {
    paddingLeft: expanded ? "0.75rem" : "0.625rem",
    paddingRight: "0.75rem",
    transition: `padding-left ${railEaseTransition}`,
  } as const;
  const footerBtnStyle = {
    paddingLeft: "0.75rem",
    paddingRight: "0.75rem",
  } as const;
  // Masthead: keep justify-start always; animate padding-left between collapsed “centered logo”
  // (12px = same optical center as former justify-center + px-2) and expanded pl-5 (20px).
  const mastheadStyle = {
    paddingLeft: expanded ? "1.25rem" : "0.75rem",
    paddingRight: "0.5rem",
    transition: `padding-left ${railEaseTransition}`,
  } as const;

  return (
    <LazyMotion features={domAnimation}>
      <aside
        className="neo-sidebar relative bg-base-100 border-r flex flex-col shrink-0 overflow-hidden"
        style={{
          width: expanded ? 240 : 56,
          transition: `width ${railEaseTransition}`,
          borderColor: "var(--wp-hairline)",
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* App logo + name */}
        <div
          className="flex items-center shrink-0 overflow-hidden py-3 gap-3 justify-start neo-sidebar-masthead"
          style={mastheadStyle}
        >
          <Link
            to={"/"}
            className="size-8 shrink-0 flex items-center justify-center overflow-hidden neo-icon-box rounded-[var(--wp-radius-sm)]"
          >
            <img
              src={`${import.meta.env.BASE_URL}app.png`}
              alt="Waypaper Engine"
              className="size-full object-contain"
            />
          </Link>
          <AnimatePresence>
            {expanded && (
              <m.span
                key="name"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 160 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{ duration: 0.15 }}
                className="font-semibold text-base text-base-content whitespace-nowrap overflow-hidden min-w-0 neo-sidebar-brand"
              >
                Waypaper Engine
              </m.span>
            )}
          </AnimatePresence>
        </div>

        <div
          className="mx-2 shrink-0 neo-sidebar-rule h-px"
          style={{ background: "var(--wp-hairline)" }}
        />

        {/* Navigation — px-2 / gap-1 / py-3 aligned with settings modal rail */}
        <nav className="flex-1 flex flex-col gap-1 py-3 px-2 overflow-y-auto overflow-x-hidden">
          {NAV_ITEMS.map((item) => {
            if (item.to === "/settings") {
              // Settings opens the modal instead of navigating
              const active = settingsOpen;
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => openSettings()}
                  aria-pressed={settingsOpen}
                  className={cn(
                    "relative flex items-center gap-3 min-h-10 py-2 transition-colors duration-100 overflow-hidden w-full neo-sidebar-nav-link rounded-[var(--wp-radius-sm)]",
                    active
                      ? "bg-primary/12 text-primary"
                      : "text-base-content/70 hover:text-base-content hover:bg-base-content/8",
                  )}
                  style={navItemStyle}
                >
                  {active && (
                    <m.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"
                    />
                  )}
                  <span className="shrink-0">{item.icon}</span>
                  <AnimatePresence>
                    {expanded && (
                      <m.span
                        key={`label-${item.to}`}
                        initial={{ opacity: 0, maxWidth: 0 }}
                        animate={{ opacity: 1, maxWidth: 160 }}
                        exit={{ opacity: 0, maxWidth: 0 }}
                        transition={{ duration: 0.12 }}
                        className="text-sm font-medium whitespace-nowrap overflow-hidden min-w-0"
                      >
                        {item.label}
                      </m.span>
                    )}
                  </AnimatePresence>
                </button>
              );
            }

            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 min-h-10 py-2 transition-colors duration-100 overflow-hidden neo-sidebar-nav-link rounded-[var(--wp-radius-sm)]",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-base-content/70 hover:text-base-content hover:bg-base-content/8",
                )}
                style={navItemStyle}
              >
                {/* Active indicator — modern mode (neo uses structural rail in CSS) */}
                {active && (
                  <m.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"
                  />
                )}
                <span className="shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {expanded && (
                    <m.span
                      key={`label-${item.to}`}
                      initial={{ opacity: 0, maxWidth: 0 }}
                      animate={{ opacity: 1, maxWidth: 160 }}
                      exit={{ opacity: 0, maxWidth: 0 }}
                      transition={{ duration: 0.12 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden min-w-0"
                    >
                      {item.label}
                    </m.span>
                  )}
                </AnimatePresence>
              </Link>
            );
          })}
        </nav>

        <div
          className="mx-2 shrink-0 neo-sidebar-rule h-px"
          style={{ background: "var(--wp-hairline)" }}
        />

        {/* Footer: hover-reveal toggle + pin toggle + quit */}
        <div className="flex flex-col gap-1 py-3 px-2 shrink-0 overflow-hidden">
          {/* Hover-reveal toggle */}
          <button
            type="button"
            onClick={handleHoverRevealToggle}
            aria-label={
              hoverRevealEnabled ? "Disable auto-reveal on hover" : "Enable auto-reveal on hover"
            }
            className={cn(
              "flex items-center gap-3 min-h-10 py-2 transition-colors duration-100 overflow-hidden neo-sidebar-footer-btn rounded-[var(--wp-radius-sm)]",
              hoverRevealEnabled
                ? "text-base-content/70 hover:text-base-content hover:bg-base-content/8"
                : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5",
            )}
            style={footerBtnStyle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0"
            >
              {hoverRevealEnabled ? (
                <>
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              ) : (
                <>
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </>
              )}
            </svg>
            <AnimatePresence>
              {expanded && (
                <m.span
                  key="hover-reveal-label"
                  initial={{ opacity: 0, maxWidth: 0 }}
                  animate={{ opacity: 1, maxWidth: 160 }}
                  exit={{ opacity: 0, maxWidth: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-sm whitespace-nowrap overflow-hidden min-w-0"
                >
                  {hoverRevealEnabled ? "Auto-reveal: On" : "Auto-reveal: Off"}
                </m.span>
              )}
            </AnimatePresence>
          </button>

          {/* Pin toggle */}
          <button
            type="button"
            onClick={handlePinToggle}
            aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
            className={cn(
              "flex items-center gap-3 min-h-10 py-2 transition-colors duration-100 overflow-hidden neo-sidebar-footer-btn neo-sidebar-footer-btn--pin rounded-[var(--wp-radius-sm)] text-base-content/50 hover:text-base-content hover:bg-base-content/8",
            )}
            style={footerBtnStyle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={pinned ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0"
            >
              <line x1="12" y1="17" x2="12" y2="22" />
              <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
            </svg>
            <AnimatePresence>
              {expanded && (
                <m.span
                  key="pin-label"
                  initial={{ opacity: 0, maxWidth: 0 }}
                  animate={{ opacity: 1, maxWidth: 160 }}
                  exit={{ opacity: 0, maxWidth: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-sm whitespace-nowrap overflow-hidden min-w-0"
                >
                  {pinned ? "Unpin sidebar" : "Pin sidebar"}
                </m.span>
              )}
            </AnimatePresence>
          </button>

          {/* Quit */}
          <button
            type="button"
            onClick={async () => {
              const quit = await confirmDialog({
                title: "Quit Application",
                message: "Are you sure you want to quit?",
                confirmLabel: "Quit",
                danger: true,
              });
              if (quit) window.API_RENDERER.exitApp();
            }}
            className="flex items-center gap-3 min-h-10 py-2 transition-colors duration-100 overflow-hidden neo-sidebar-footer-btn neo-sidebar-footer-btn--quit rounded-[var(--wp-radius-sm)] text-base-content/50 hover:text-error hover:bg-error/10"
            style={footerBtnStyle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="shrink-0"
            >
              <title>Quit</title>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16,17 21,12 16,7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <AnimatePresence>
              {expanded && (
                <m.span
                  key="quit-label"
                  initial={{ opacity: 0, maxWidth: 0 }}
                  animate={{ opacity: 1, maxWidth: 160 }}
                  exit={{ opacity: 0, maxWidth: 0 }}
                  transition={{ duration: 0.12 }}
                  className="text-sm whitespace-nowrap overflow-hidden min-w-0"
                >
                  Quit
                </m.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </aside>
    </LazyMotion>
  );
};

/** Mobile drawer content — same nav items in expanded form */
export const SidebarContent: React.FC = () => {
  const location = useLocation();
  const isConfigurationPage = location.pathname === "/configuration";
  const openSettings = useSettingsModalStore((s) => s.openModal);

  const handleNavigationClick = () => closeDrawer();

  return (
    <div className="bg-base-200 min-h-full w-64 flex flex-col p-4 border-r border-base-300 neo-sidebar-drawer">
      {isConfigurationPage ? (
        <SidebarConfiguration />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div className="size-12 overflow-hidden flex items-center justify-center neo-icon-box rounded-[var(--wp-radius-md)]">
              <img
                src={`${import.meta.env.BASE_URL}app.png`}
                alt="Waypaper Engine"
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-semibold text-base-content">Waypaper Engine</h1>
              <p className="text-sm text-base-content/70">Wallpaper Manager</p>
            </div>
          </div>

          <nav className="flex-1">
            <ul className="menu text-base-content">
              {NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  {item.to === "/settings" ? (
                    <button
                      type="button"
                      onClick={() => {
                        openSettings();
                        handleNavigationClick();
                      }}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-300 transition-colors w-full text-left"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </button>
                  ) : (
                    <Link
                      to={item.to}
                      onClick={handleNavigationClick}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-300 transition-colors"
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto pt-4 border-t border-base-300">
            <button
              type="button"
              onClick={async () => {
                const quit = await confirmDialog({
                  title: "Quit Application",
                  message: "Are you sure you want to quit?",
                  confirmLabel: "Quit",
                  danger: true,
                });
                if (quit) window.API_RENDERER.exitApp();
              }}
              className="btn btn-error btn-sm w-full"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <title>Quit</title>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16,17 21,12 16,7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Quit
            </button>
          </div>
        </>
      )}
    </div>
  );
};
