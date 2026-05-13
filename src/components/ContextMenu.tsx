import type React from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useContextMenuStore, type MenuItem } from "../stores/contextMenuStore";
import { useShallow } from "zustand/react/shallow";

const MENU_MIN_WIDTH = 200;
const SUBMENU_DELAY = 150;
const VIEWPORT_PADDING = 8;

function ContextMenu() {
  const { isOpen, position, items, close } = useContextMenuStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      position: s.position,
      items: s.items,
      close: s.close,
    })),
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState(position);
  const [fadeIn, setFadeIn] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);

  const visible = isOpen && fadeIn;
  const focusIndex = isOpen ? focusIdx : -1;

  useEffect(() => {
    if (!isOpen) return;

    requestAnimationFrame(() => {
      if (!menuRef.current) {
        setAdjustedPos(position);
        setFadeIn(true);
        return;
      }
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let x = position.x;
      let y = position.y;
      if (x + rect.width + VIEWPORT_PADDING > vw) x = vw - rect.width - VIEWPORT_PADDING;
      if (y + rect.height + VIEWPORT_PADDING > vh) y = vh - rect.height - VIEWPORT_PADDING;
      if (x < VIEWPORT_PADDING) x = VIEWPORT_PADDING;
      if (y < VIEWPORT_PADDING) y = VIEWPORT_PADDING;
      setAdjustedPos({ x, y });
      setFadeIn(true);
    });
    return () => setFadeIn(false);
  }, [isOpen, position]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleScroll = () => close();
    const handleBlur = () => close();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      const actionItems = items.filter((i) => i.type !== "separator");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((prev) => {
          const next = prev + 1;
          return next >= actionItems.length ? 0 : next;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((prev) => {
          const next = prev - 1;
          return next < 0 ? actionItems.length - 1 : next;
        });
      } else if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        const item = actionItems[focusIndex];
        if (item?.type === "action" && !item.disabled) {
          item.onClick();
          close();
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, items, focusIndex, close]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={`context-menu ${visible ? "context-menu-visible" : ""}`}
      style={{
        position: "fixed",
        left: adjustedPos.x,
        top: adjustedPos.y,
        zIndex: 9999,
        minWidth: MENU_MIN_WIDTH,
      }}
    >
      <MenuItems items={items} close={close} focusIndex={focusIndex} depth={0} />
    </div>,
    document.body,
  );
}

function MenuItems({
  items,
  close,
  focusIndex,
  depth,
}: {
  items: MenuItem[];
  close: () => void;
  focusIndex: number;
  depth: number;
}) {
  const rendered: React.ReactNode[] = [];
  let actionCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type === "separator") {
      rendered.push(<div key={`sep-${item.type}-${i}`} className="context-menu-separator" />);
      continue;
    }
    const isFocused = depth === 0 && actionCount === focusIndex;
    actionCount++;
    if (item.type === "submenu") {
      rendered.push(
        <SubmenuItem
          key={`sub-${item.label}`}
          item={item}
          close={close}
          isFocused={isFocused}
          depth={depth}
        />,
      );
    } else {
      rendered.push(
        <ActionItem key={`act-${item.label}`} item={item} close={close} isFocused={isFocused} />,
      );
    }
  }

  return <div className="context-menu-list">{rendered}</div>;
}

function ActionItem({
  item,
  close,
  isFocused,
}: {
  item: Extract<MenuItem, { type: "action" }>;
  close: () => void;
  isFocused: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isFocused) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isFocused]);

  return (
    <button
      ref={ref}
      type="button"
      disabled={item.disabled}
      className={`context-menu-item ${item.danger ? "context-menu-item-danger" : ""} ${item.disabled ? "context-menu-item-disabled" : ""} ${isFocused ? "context-menu-item-focused" : ""}`}
      onClick={() => {
        if (item.disabled) return;
        item.onClick();
        close();
      }}
    >
      {item.icon && <span className="context-menu-icon">{item.icon}</span>}
      <span className="context-menu-label">{item.label}</span>
    </button>
  );
}

function SubmenuItem({
  item,
  close,
  isFocused,
  depth,
}: {
  item: Extract<MenuItem, { type: "submenu" }>;
  close: () => void;
  isFocused: boolean;
  depth: number;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [submenuSide, setSubmenuSide] = useState<"right" | "left">("right");

  const handleEnter = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), SUBMENU_DELAY);
  }, []);

  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(false), SUBMENU_DELAY);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      if (submenuRef.current && containerRef.current) {
        const parentRect = containerRef.current.getBoundingClientRect();
        const subRect = submenuRef.current.getBoundingClientRect();
        if (parentRect.right + subRect.width + VIEWPORT_PADDING > window.innerWidth) {
          setSubmenuSide("left");
        } else {
          setSubmenuSide("right");
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <div
      ref={containerRef}
      className={`context-menu-item context-menu-item-submenu ${isFocused ? "context-menu-item-focused" : ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {item.icon && <span className="context-menu-icon">{item.icon}</span>}
      <span className="context-menu-label">{item.label}</span>
      <span className="context-menu-chevron">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-3.5"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </span>

      {open && (
        <div
          ref={submenuRef}
          className="context-menu-submenu context-menu context-menu-visible"
          style={{
            position: "absolute",
            top: 0,
            [submenuSide === "right" ? "left" : "right"]: "100%",
            minWidth: MENU_MIN_WIDTH,
          }}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <MenuItems items={item.children} close={close} focusIndex={-1} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}

export default ContextMenu;
