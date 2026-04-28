/**
 * Sidebar / Icon Rail Component for Waypaper Engine
 *
 * Desktop (≥800px): persistent icon rail — 56px collapsed, 240px expanded.
 * Mobile (<800px): the DaisyUI drawer overlay is used instead (see ModernAppLayout).
 */

import type React from "react";
import { useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import SidebarConfiguration from "../SidebarConfiguration";
import { DRAWER_CHECKBOX_ID } from "./ModernAppLayout";
import { useIsNeo } from "../../hooks/useIsNeo";
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
  const isNeo = useIsNeo();
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
      <aside
        className={cn(
          "bg-base-200 border-r border-base-300 w-64 flex flex-col overflow-y-auto shrink-0",
          isNeo && "neo-sidebar neo-sidebar--config",
        )}
      >
        <SidebarConfiguration />
      </aside>
    );
  }

  // Padding-left values that smoothly transition the icon from centered (collapsed)
  // to left-aligned (expanded) via CSS transition, avoiding any layout jump flash.
  // Sidebar collapsed = 56px total. Nav wrapper has no horizontal padding (removed px-1.5),
  // so buttons span the full 56px. Formula: (56 - iconWidth) / 2 = collapsed center.
  const navItemStyle = {
    paddingLeft: expanded ? "0.5rem" : "1.125rem", // 18px centers 20px icon in 56px
    paddingRight: "0.5rem",
    transition: `padding-left var(--wp-dur-base) var(--wp-ease-out)`,
  } as const;
  const footerBtnStyle = {
    paddingLeft: expanded ? "0.5rem" : "1.25rem", // 20px centers 16px icon in 56px
    paddingRight: "0.5rem",
    transition: `padding-left var(--wp-dur-base) var(--wp-ease-out)`,
  } as const;
  const mastheadStyle = {
    paddingLeft: expanded ? "0.5rem" : "0.75rem", // 12px centers 32px logo in 56px
    paddingRight: "0.5rem",
    transition: `padding-left var(--wp-dur-base) var(--wp-ease-out)`,
  } as const;

  return (
    <aside
      className="neo-sidebar relative bg-base-200 border-r flex flex-col shrink-0 overflow-hidden"
      style={{
        width: expanded ? 240 : 56,
        transition: `width var(--wp-dur-base) var(--wp-ease-out)`,
        ...(isNeo ? {} : { borderColor: "var(--wp-hairline)" }),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* App logo + name */}
      <div
        className={cn(
          "flex items-center h-13 gap-3 shrink-0 overflow-hidden",
          isNeo && "neo-sidebar-masthead",
        )}
        style={mastheadStyle}
      >
        <Link
          to={"/"}
          className={`w-8 h-8 shrink-0 flex items-center justify-center overflow-hidden ${isNeo ? "neo-icon-box" : "rounded-md"}`}
        >
          <img
            src={`${import.meta.env.BASE_URL}app.png`}
            alt="Waypaper Engine"
            className="w-full h-full object-contain"
          />
        </Link>
        <AnimatePresence>
          {expanded && (
            <motion.span
              key="name"
              initial={{ opacity: 0, maxWidth: 0 }}
              animate={{ opacity: 1, maxWidth: 160 }}
              exit={{ opacity: 0, maxWidth: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                "font-semibold text-sm text-base-content whitespace-nowrap overflow-hidden",
                isNeo && "neo-sidebar-brand",
              )}
            >
              Waypaper Engine
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div
        className={cn("mx-2 shrink-0", isNeo ? "neo-sidebar-rule" : "h-px")}
        style={isNeo ? undefined : { background: "var(--wp-hairline)" }}
      />

      {/* Navigation — no px-1.5 wrapper; padding lives on each item for smooth centering */}
      <nav className="flex-1 flex flex-col gap-0.5 py-2 overflow-y-auto overflow-x-hidden">
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
                  "relative flex items-center gap-3 h-9 transition-colors duration-100 overflow-hidden w-full",
                  isNeo
                    ? "neo-sidebar-nav-link"
                    : cn(
                        "rounded-lg",
                        active
                          ? "bg-primary/12 text-primary"
                          : "text-base-content/70 hover:text-base-content hover:bg-base-content/8",
                      ),
                )}
                style={navItemStyle}
              >
                {!isNeo && active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"
                  />
                )}
                <span className="shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      key={`label-${item.to}`}
                      initial={{ opacity: 0, maxWidth: 0 }}
                      animate={{ opacity: 1, maxWidth: 160 }}
                      exit={{ opacity: 0, maxWidth: 0 }}
                      transition={{ duration: 0.12 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {item.label}
                    </motion.span>
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
                "relative flex items-center gap-3 h-9 transition-colors duration-100 overflow-hidden",
                isNeo
                  ? "neo-sidebar-nav-link"
                  : cn(
                      "rounded-lg",
                      active
                        ? "bg-primary/12 text-primary"
                        : "text-base-content/70 hover:text-base-content hover:bg-base-content/8",
                    ),
              )}
              style={navItemStyle}
            >
              {/* Active indicator — default theme only (neo uses structural rail in CSS) */}
              {!isNeo && active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary"
                />
              )}
              <span className="shrink-0">{item.icon}</span>
              <AnimatePresence>
                {expanded && (
                  <motion.span
                    key={`label-${item.to}`}
                    initial={{ opacity: 0, maxWidth: 0 }}
                    animate={{ opacity: 1, maxWidth: 160 }}
                    exit={{ opacity: 0, maxWidth: 0 }}
                    transition={{ duration: 0.12 }}
                    className="text-sm font-medium whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div
        className={cn("mx-2 shrink-0", isNeo ? "neo-sidebar-rule" : "h-px")}
        style={isNeo ? undefined : { background: "var(--wp-hairline)" }}
      />

      {/* Footer: hover-reveal toggle + pin toggle + quit */}
      <div className="flex flex-col gap-0.5 py-2 shrink-0 overflow-hidden">
        {/* Hover-reveal toggle */}
        <button
          type="button"
          onClick={handleHoverRevealToggle}
          aria-label={
            hoverRevealEnabled ? "Disable auto-reveal on hover" : "Enable auto-reveal on hover"
          }
          className={cn(
            "flex items-center gap-3 h-9 transition-colors duration-100 overflow-hidden",
            isNeo
              ? "neo-sidebar-footer-btn"
              : cn(
                  "rounded-lg",
                  hoverRevealEnabled
                    ? "text-base-content/70 hover:text-base-content hover:bg-base-content/8"
                    : "text-base-content/40 hover:text-base-content/70 hover:bg-base-content/5",
                ),
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
              <motion.span
                key="hover-reveal-label"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 160 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{ duration: 0.12 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                {hoverRevealEnabled ? "Auto-reveal: On" : "Auto-reveal: Off"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Pin toggle */}
        <button
          type="button"
          onClick={handlePinToggle}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
          className={cn(
            "flex items-center gap-3 h-9 transition-colors duration-100 overflow-hidden",
            isNeo
              ? "neo-sidebar-footer-btn neo-sidebar-footer-btn--pin"
              : "rounded-lg text-base-content/50 hover:text-base-content hover:bg-base-content/8",
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
          >
            <line x1="12" y1="17" x2="12" y2="22" />
            <path d="M5 17h14v-1.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1v4.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24z" />
          </svg>
          <AnimatePresence>
            {expanded && (
              <motion.span
                key="pin-label"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 160 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{ duration: 0.12 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                {pinned ? "Unpin sidebar" : "Pin sidebar"}
              </motion.span>
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
          className={cn(
            "flex items-center gap-3 h-9 transition-colors duration-100 overflow-hidden",
            isNeo
              ? "neo-sidebar-footer-btn neo-sidebar-footer-btn--quit"
              : "rounded-lg text-base-content/50 hover:text-error hover:bg-error/10",
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
          >
            <title>Quit</title>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16,17 21,12 16,7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <AnimatePresence>
            {expanded && (
              <motion.span
                key="quit-label"
                initial={{ opacity: 0, maxWidth: 0 }}
                animate={{ opacity: 1, maxWidth: 160 }}
                exit={{ opacity: 0, maxWidth: 0 }}
                transition={{ duration: 0.12 }}
                className="text-sm whitespace-nowrap overflow-hidden"
              >
                Quit
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </aside>
  );
};

/** Mobile drawer content — same nav items in expanded form */
export const SidebarContent: React.FC = () => {
  const location = useLocation();
  const isConfigurationPage = location.pathname === "/configuration";
  const isNeo = useIsNeo();
  const openSettings = useSettingsModalStore((s) => s.openModal);

  const handleNavigationClick = () => closeDrawer();

  return (
    <div
      className={cn(
        "bg-base-200 min-h-full w-64 flex flex-col p-4 border-r border-base-300",
        isNeo && "neo-sidebar-drawer",
      )}
    >
      {isConfigurationPage ? (
        <SidebarConfiguration />
      ) : (
        <>
          <div className="flex items-center gap-3 mb-6">
            <div
              className={`w-12 h-12 overflow-hidden flex items-center justify-center ${isNeo ? "neo-icon-box" : "rounded-lg"}`}
            >
              <img
                src={`${import.meta.env.BASE_URL}app.png`}
                alt="Waypaper Engine"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-base-content">Waypaper Engine</h1>
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

export default IconRailSidebar;
