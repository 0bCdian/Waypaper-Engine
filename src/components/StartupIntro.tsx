import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LazyMotion, AnimatePresence, domAnimation, m, useReducedMotion } from "framer-motion";

/** ~2.6s staged content ~+ 0.4s exit overlay ≈ 3s wall clock total */
const CONTENT_HOLD_MS = 2580;
const EXIT_S = 0.42;

/** Boot lines — decorative; not literal daemon logs */
const PHASE_LINES = [
  { k: "a", msg: "Session channel ready", tag: "[ ok ]" },
  { k: "b", msg: "Config plane synchronized", tag: "[ ok ]" },
  { k: "c", msg: "Renderer surfaces armed", tag: "[ ok ]" },
] as const;

export interface StartupIntroProps {
  onFinish: () => void;
}

/**
 * Full-viewport cinematic boot sequence shown once after daemon config loads.
 * Skipped when prefers-reduced-motion is set (parent may also skip mounting).
 */
export const StartupIntro: React.FC<StartupIntroProps> = ({ onFinish }) => {
  const prefersReduced = useReducedMotion();
  const finishedRef = useRef(false);
  const [visible, setVisible] = useState(true);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish();
  }, [onFinish]);

  const handleExitComplete = useCallback(() => {
    finishOnce();
  }, [finishOnce]);

  useEffect(() => {
    if (prefersReduced === true) {
      finishOnce();
    }
  }, [prefersReduced, finishOnce]);

  useEffect(() => {
    if (prefersReduced === true) return undefined;
    const t = window.setTimeout(() => setVisible(false), CONTENT_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [prefersReduced]);

  if (prefersReduced === true) {
    return null;
  }

  const lineContainer = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.11, delayChildren: 0.06 },
    },
  };

  const lineItem = {
    hidden: { opacity: 0, x: -16 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence mode="sync" onExitComplete={handleExitComplete}>
        {visible && (
          <m.div
            key="startup-intro"
            layout={false}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden bg-base-100"
            style={{
              boxShadow: "inset 0 0 120px oklch(from var(--color-base-content) l c h / 0.12)",
            }}
            role="status"
            aria-live="polite"
            aria-label="Waypaper Engine startup"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.015,
              transition: { duration: EXIT_S, ease: [0.4, 0, 0.2, 1] as const },
            }}
          >
            {/* subtle grid + vignette */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.07]"
              aria-hidden
              style={{
                backgroundImage: `
                  linear-gradient(90deg, oklch(from var(--color-base-content) l c h) 1px, transparent 1px),
                  linear-gradient(oklch(from var(--color-base-content) l c h / 1) 1px, transparent 1px)
                `,
                backgroundSize: "24px 24px",
              }}
            />
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  "radial-gradient(ellipse 80% 60% at 50% 40%, transparent 40%, oklch(from var(--color-base-content) l c h / 0.16) 100%)",
              }}
            />

            {/* horizontal pulse band */}
            <m.div
              className="pointer-events-none absolute left-[-20%] right-[-20%] h-[2px] blur-[3px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, oklch(from var(--color-primary) l c h / 0.35) 50%, transparent 100%)",
              }}
              aria-hidden
              initial={{ opacity: 0.5, scaleX: 0.3 }}
              animate={{
                opacity: [0.3, 0.85, 0.35],
                scaleX: [0.4, 1, 1],
              }}
              transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] as const }}
            />

            {/* Log block */}
            <m.div
              className="relative z-[1] w-[min(90vw,440px)] font-mono text-[11px] leading-relaxed md:text-xs"
              style={{ fontFamily: "var(--font-mono)" }}
              variants={lineContainer}
              initial="hidden"
              animate="visible"
            >
              {PHASE_LINES.map((line) => (
                <m.div
                  key={line.k}
                  className="mb-2 flex gap-4 sm:justify-between"
                  variants={lineItem}
                >
                  <span className="shrink-0 text-primary">{"//"}</span>
                  <span className="min-w-0 flex-1 text-base-content/70">{line.msg}</span>
                  <span className="shrink-0 text-success">{line.tag}</span>
                </m.div>
              ))}
            </m.div>

            {/* Wordmark stack */}
            <m.div
              className="relative z-[1] mt-12 flex flex-col items-center gap-6"
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.55, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const }}
            >
              <div className="relative">
                <m.div
                  className="absolute inset-[-12px] rounded-2xl"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, oklch(from var(--color-primary) l c h / 0.25) 0%, transparent 70%)",
                  }}
                  animate={{ opacity: [0.5, 0.95, 0.55], scale: [0.94, 1, 1] }}
                  transition={{ duration: 1.6, ease: "easeInOut" }}
                  aria-hidden
                />
                <img
                  src={`${import.meta.env.BASE_URL}app.png`}
                  alt=""
                  draggable={false}
                  className="relative h-14 w-14 object-contain md:h-16 md:w-16"
                />
              </div>
              <m.p
                className="text-center text-[0.72rem] font-semibold tracking-[0.35em] text-base-content/40 md:text-sm"
                style={{ fontFamily: "var(--font-display)" }}
                initial={{ opacity: 0, letterSpacing: "0.42em" }}
                animate={{ opacity: 1, letterSpacing: "0.32em" }}
                transition={{ delay: 0.78, duration: 0.6 }}
              >
                WAYPAPER
              </m.p>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
};

export default StartupIntro;
