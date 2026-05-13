import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettingsModalStore } from "@/stores/settingsModalStore";
import SettingsTabs from "./SettingsTabs";

export function SettingsModal() {
  const { open, closeModal } = useSettingsModalStore();

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.currentTarget === e.target) closeModal();
    },
    [closeModal],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeModal]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="settings-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onClick={handleOverlayClick}
          className="fixed inset-0 z-50 flex items-center justify-center neo-settings-overlay bg-black/50 backdrop-blur-[2px]"
          aria-modal="true"
          role="dialog"
          aria-label="Settings"
        >
          <motion.div
            key="settings-panel"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative flex flex-col overflow-hidden neo-settings-panel rounded-xl shadow-2xl bg-base-100 border border-base-content/10"
            style={{
              width: "min(1100px, 92vw)",
              height: "min(720px, 86vh)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header bar */}
            <div className="flex items-center gap-3 shrink-0 neo-settings-header px-5 h-12 border-b border-base-content/8 bg-base-100">
              {/* Settings icon */}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-base-content/50 shrink-0"
                aria-hidden
              >
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>

              <h2 className="neo-settings-title text-sm font-semibold text-base-content tracking-wide">
                Settings
              </h2>

              <div className="flex-1" />

              {/* Close button */}
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close settings"
                className="neo-settings-close flex items-center justify-center size-7 rounded-md transition-colors duration-100 text-base-content/50 hover:text-base-content hover:bg-base-content/10"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-hidden neo-settings-content">
              <SettingsTabs className="h-full" isModal />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default SettingsModal;
