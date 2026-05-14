import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LazyMotion, AnimatePresence, domAnimation, m, useReducedMotion } from "framer-motion";

/** Time until boot lines begin fading out and the wordmark phase takes over */
const LINES_TO_LOGO_MS = 1680;
/** Total time from mount until the full-screen overlay begins its exit animation */
const OVERLAY_HOLD_MS = 3400;
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
  const [exiting, setExiting] = useState(false);
  const [contentPhase, setContentPhase] = useState<"lines" | "logo">("lines");

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
    const t = window.setTimeout(() => setContentPhase("logo"), LINES_TO_LOGO_MS);
    return () => window.clearTimeout(t);
  }, [prefersReduced]);

  useEffect(() => {
    if (prefersReduced === true) return undefined;
    const t = window.setTimeout(() => setExiting(true), OVERLAY_HOLD_MS);
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
          <div
            key="startup-intro"
            className="z-[9999] flex flex-col items-center justify-center overflow-hidden bg-base-100"
            style={{
              position: "fixed",
              inset: 0,
              opacity: exiting ? 0 : 1,
              transform: exiting ? "scale(1.015)" : "scale(1)",
              transition: `opacity ${EXIT_S}s cubic-bezier(0.4, 0, 0.2, 1), transform ${EXIT_S}s cubic-bezier(0.4, 0, 0.2, 1)`,
            }}
            onTransitionEnd={(e) => {
              if (e.propertyName === "opacity" && exiting) finishOnce();
            }}
            role="status"
            aria-live="polite"
            aria-label="Waypaper Engine startup"
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

            {/* One centered block: either boot log lines or wordmark — never stacked */}
            <div className="relative z-[1] flex min-h-[min(40vh,200px)] w-full items-center justify-center px-4">
              <AnimatePresence mode="wait">
                {contentPhase === "lines" ? (
                  <m.div
                    key="boot-lines"
                    className="w-[min(90vw,720px)] font-mono text-base leading-relaxed md:text-lg lg:text-xl"
                    style={{ fontFamily: "var(--font-mono)" }}
                    variants={lineContainer}
                    initial="hidden"
                    animate="visible"
                    exit={{
                      opacity: 0,
                      y: -8,
                      transition: { duration: 0.32, ease: [0.4, 0, 1, 1] as const },
                    }}
                  >
                    {PHASE_LINES.map((line) => (
                      <m.div
                        key={line.k}
                        className="mb-3 flex gap-6 sm:justify-between"
                        variants={lineItem}
                      >
                        <span className="shrink-0 text-primary">{"//"}</span>
                        <span className="min-w-0 flex-1 text-base-content/70">{line.msg}</span>
                        <span className="shrink-0 text-success">{line.tag}</span>
                      </m.div>
                    ))}
                  </m.div>
                ) : (
                  <m.div
                    key="wordmark"
                    className="flex flex-col items-center gap-10"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
                    }}
                    exit={{
                      opacity: 0,
                      transition: { duration: 0.22 },
                    }}
                  >
                    <div className="relative">
                      <m.div
                        className="absolute inset-[-20px] rounded-3xl"
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
                        className="relative h-24 w-24 object-contain md:h-28 md:w-28 lg:h-32 lg:w-32"
                      />
                    </div>
                    <m.p
                      className="text-center text-base font-semibold tracking-[0.35em] text-base-content/40 md:text-lg lg:text-xl"
                      style={{ fontFamily: "var(--font-display)" }}
                      initial={{ opacity: 0, letterSpacing: "0.42em" }}
                      animate={{
                        opacity: 1,
                        letterSpacing: "0.32em",
                        transition: { delay: 0.12, duration: 0.55 },
                      }}
                    >
                      WAYPAPER
                    </m.p>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  );
};
