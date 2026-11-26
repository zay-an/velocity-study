"use client";

import { useEffect } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { GameArena } from "./game-arena";
import { GameHeader } from "./game-header";
import { LobbyScreen } from "./lobby-screen";
import { ResultsAnalytics } from "./results-analytics";
import { useGameStore } from "./use-game-store";

/** Client root for the speed–accuracy tradeoff game: header, backdrop and phase switcher. */
export function GameApp() {
  const phase = useGameStore((s) => s.phase);

  // Load persisted history/preferences after mount so prerendered markup matches the first client render.
  useEffect(() => {
    void useGameStore.persist.rehydrate();
  }, []);

  // Global "M" shortcut toggles sound.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "m" || e.key === "M") useGameStore.getState().toggleMute();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative flex min-h-screen flex-1 flex-col overflow-x-hidden bg-slate-900 text-slate-100">
        {/* Ambient backdrop */}
        <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-indigo-600/20 blur-[120px]" />
          <div className="absolute -right-40 top-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-600/10 blur-[120px]" />
          <div className="absolute -bottom-48 left-1/4 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(148,163,184,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.5) 1px, transparent 1px)",
              backgroundSize: "44px 44px",
              maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            }}
          />
        </div>

        <GameHeader />

        <main className="relative z-10 flex flex-1 flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="flex flex-1 flex-col"
            >
              {phase === "lobby" && <LobbyScreen />}
              {phase === "playing" && <GameArena />}
              {phase === "results" && <ResultsAnalytics />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
