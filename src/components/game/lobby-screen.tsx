"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  Clock,
  FlaskConical,
  Flame,
  Gauge,
  InfinityIcon,
  Keyboard,
  Play,
  Shuffle,
  Target,
  type LucideIcon,
} from "lucide-react";
import { PushButton } from "@/components/ui/push-button";
import { DEMO_QUESTIONS } from "@/lib/game/demo-questions";
import { MODE_CONFIGS, MODE_ORDER } from "@/lib/game/scoring";
import type { ScoringMode } from "@/lib/game/types";
import { readStoredParticipantCode } from "@/lib/participant-storage";
import { ParticipantNote } from "./participant-id";
import { sound } from "./sound";
import { useGameStore } from "./use-game-store";

const MODE_ICONS: Record<ScoringMode, LucideIcon> = {
  control: Target,
  speed: Gauge,
  streak: Flame,
  variable: Shuffle,
};

const DIFFICULTY_COUNTS = DEMO_QUESTIONS.reduce<Record<string, number>>((acc, q) => {
  acc[q.difficulty] = (acc[q.difficulty] ?? 0) + 1;
  return acc;
}, {});

/** Starts a session labeled with the participant code currently stored on this device. */
export function beginSession() {
  sound.unlock();
  sound.click();
  useGameStore.getState().startGame(readStoredParticipantCode());
}

function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a, button, input, textarea, select") !== null;
}

export function LobbyScreen() {
  const selectedMode = useGameStore((s) => s.selectedMode);
  const history = useGameStore((s) => s.history);
  const setSelectedMode = useGameStore((s) => s.setSelectedMode);

  const choose = (mode: ScoringMode) => {
    sound.click();
    setSelectedMode(mode);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      const mode = MODE_ORDER[idx];
      if (mode !== undefined) {
        e.preventDefault();
        sound.click();
        useGameStore.getState().setSelectedMode(mode);
      } else if (e.key === "Enter" && !isInteractiveTarget(e.target)) {
        // Let Enter on a focused link/button keep its native behavior.
        e.preventDefault();
        beginSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const runsByMode = (mode: ScoringMode) => history.filter((h) => h.mode === mode).length;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-8 sm:px-6">
      {/* Hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="text-center"
      >
        <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
          <FlaskConical className="size-3.5" aria-hidden />
          Live research prototype
        </div>
        <h1 className="text-5xl font-black tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-br from-white via-indigo-100 to-indigo-300 bg-clip-text text-transparent">
            Velocity
          </span>
          <span className="bg-gradient-to-br from-fuchsia-400 via-violet-400 to-cyan-300 bg-clip-text text-transparent">
            Study
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base text-slate-300 sm:text-lg">
          Does racing the clock make you sharper — or sloppier? Pick a scoring condition, answer{" "}
          {DEMO_QUESTIONS.length} questions, and see your speed–accuracy trade-off.
        </p>
      </motion.section>

      {/* Mode selection */}
      <section aria-labelledby="mode-heading">
        <div className="mb-3 flex items-end justify-between gap-4">
          <h2 id="mode-heading" className="text-sm font-bold uppercase tracking-[0.18em] text-slate-300">
            Choose a scoring condition
          </h2>
          <span className="hidden items-center gap-1.5 text-xs text-slate-400 sm:inline-flex">
            <Keyboard className="size-3.5" aria-hidden /> Press 1–4 to select · Enter to start
          </span>
        </div>

        <div role="radiogroup" aria-label="Scoring mode" className="grid gap-4 sm:grid-cols-2">
          {MODE_ORDER.map((id, i) => {
            const cfg = MODE_CONFIGS[id];
            const Icon = MODE_ICONS[id];
            const active = selectedMode === id;
            const runs = runsByMode(id);
            return (
              <motion.button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => choose(id)}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                whileHover={{ y: -3 }}
                className={`group relative flex flex-col gap-3 rounded-2xl border-2 border-b-[6px] bg-slate-800 p-5 text-left transition-[border-color,box-shadow,background-color,transform] duration-150 motion-reduce:transition-none active:translate-y-1 active:border-b-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 ${
                  active ? `${cfg.accent.border} ${cfg.accent.glow}` : "border-slate-950 hover:border-slate-600"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-lg font-black text-slate-950 ${cfg.accent.bg}`}
                    >
                      {cfg.letter}
                    </span>
                    <div>
                      <div className="text-lg font-extrabold leading-tight text-white">{cfg.name}</div>
                      <div className={`text-xs font-semibold uppercase tracking-wider ${cfg.accent.text}`}>
                        {cfg.tagline}
                      </div>
                    </div>
                  </div>
                  <Icon
                    className={`size-6 shrink-0 transition-colors ${active ? cfg.accent.text : "text-slate-400"}`}
                    aria-hidden
                  />
                </div>

                <p className="text-sm leading-relaxed text-slate-300">{cfg.description}</p>

                <code className="block rounded-lg bg-slate-950 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-300">
                  {cfg.formula}
                </code>

                <div className="mt-auto flex items-center justify-between text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    {id === "control" ? (
                      <InfinityIcon className="size-3.5" aria-hidden />
                    ) : (
                      <Clock className="size-3.5" aria-hidden />
                    )}
                    {cfg.timerLabel}
                  </span>
                  <span className="flex items-center gap-2">
                    {runs > 0 && (
                      <span className="rounded-full bg-slate-950 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                        {runs} saved run{runs === 1 ? "" : "s"}
                      </span>
                    )}
                    <kbd className="rounded-md border border-slate-600 bg-slate-950 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">
                      {i + 1}
                    </kbd>
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </section>

      {/* Participant + start */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="flex flex-col items-stretch gap-4 rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-5 sm:flex-row sm:items-center"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-300">Participant</span>
          <p className="text-sm text-slate-100">
            <ParticipantNote />
          </p>
          <span className="text-xs text-slate-300">
            Deck: {DEMO_QUESTIONS.length} questions · {DIFFICULTY_COUNTS.Easy ?? 0} Easy ·{" "}
            {DIFFICULTY_COUNTS.Medium ?? 0} Medium · {DIFFICULTY_COUNTS.Hard ?? 0} Hard · order shuffled each run
          </span>
        </div>

        <PushButton variant="primary" size="lg" onClick={beginSession} className="group">
          <Play
            aria-hidden
            className="size-6 fill-current transition-transform group-hover:scale-110 motion-reduce:transition-none"
          />
          Start · {MODE_CONFIGS[selectedMode].letter}
        </PushButton>
      </motion.section>
    </div>
  );
}
