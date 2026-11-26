"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Check,
  ChevronRight,
  Circle,
  Clock,
  Diamond,
  Flame,
  Hourglass,
  Square,
  Triangle,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PushButton } from "@/components/ui/push-button";
import { MODE_CONFIGS, formatPoints, timeLimitLabel, streakMultiplier } from "@/lib/game/scoring";
import type { AnswerRecord, Difficulty, Question, QuestionPlan, ScoringMode } from "@/lib/game/types";
import { sound } from "./sound";
import { useGameStore } from "./use-game-store";

const REVEAL_DURATION_MS = 2400;
const ARM_FALLBACK_MS = 700;

interface TileStyle {
  icon: LucideIcon;
  face: string;
  depth: string;
  glow: string;
}

const TILE_STYLES: TileStyle[] = [
  {
    icon: Triangle,
    face: "bg-fuchsia-500 hover:bg-fuchsia-400",
    depth: "border-fuchsia-800",
    glow: "shadow-[0_0_28px_-6px_rgba(217,70,239,0.75)]",
  },
  {
    icon: Diamond,
    face: "bg-cyan-500 hover:bg-cyan-400",
    depth: "border-cyan-800",
    glow: "shadow-[0_0_28px_-6px_rgba(6,182,212,0.75)]",
  },
  {
    icon: Circle,
    face: "bg-amber-400 hover:bg-amber-300",
    depth: "border-amber-700",
    glow: "shadow-[0_0_28px_-6px_rgba(251,191,36,0.75)]",
  },
  {
    icon: Square,
    face: "bg-lime-400 hover:bg-lime-300",
    depth: "border-lime-700",
    glow: "shadow-[0_0_28px_-6px_rgba(163,230,53,0.75)]",
  },
];

const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Easy: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
  Medium: "bg-amber-500/15 text-amber-300 border-amber-400/30",
  Hard: "bg-rose-500/15 text-rose-300 border-rose-400/30",
};

const roundVariants: Variants = {
  initial: { opacity: 0, x: 48, scale: 0.98 },
  enter: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.28, ease: "easeOut" } },
  exit: { opacity: 0, x: -48, scale: 0.98, transition: { duration: 0.2, ease: "easeIn" } },
};

function fireStreakConfetti(streak: number) {
  const intensity = Math.min(streak, 8);
  const colors = ["#f0abfc", "#67e8f9", "#fde047", "#a3e635", "#fb923c"];
  const base = { colors, disableForReducedMotion: true, zIndex: 60 };
  confetti({ ...base, particleCount: 40 + intensity * 15, spread: 70, startVelocity: 45, origin: { x: 0.5, y: 0.35 } });
  if (streak >= 5) {
    confetti({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } });
    confetti({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } });
  }
}

/* ------------------------------------------------------------------------ */

export function GameArena() {
  const mode = useGameStore((s) => s.selectedMode);
  const questions = useGameStore((s) => s.questions);
  const plan = useGameStore((s) => s.plan);
  const currentIndex = useGameStore((s) => s.currentIndex);
  const score = useGameStore((s) => s.score);
  const streak = useGameStore((s) => s.streak);
  const records = useGameStore((s) => s.records);
  const returnToLobby = useGameStore((s) => s.returnToLobby);

  const question = questions[currentIndex];
  const questionPlan = plan[currentIndex];
  const cfg = MODE_CONFIGS[mode];

  if (!question || !questionPlan) return null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pb-10 pt-4 sm:px-6">
      {/* HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 rounded-xl border-2 border-b-4 ${cfg.accent.border} bg-slate-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${cfg.accent.text}`}
          >
            <span className={`flex size-5 items-center justify-center rounded-md text-[11px] font-black text-slate-950 ${cfg.accent.bg}`}>
              {cfg.letter}
            </span>
            {cfg.name}
          </span>
          <PushButton
            variant="ghost"
            size="sm"
            onClick={() => {
              sound.click();
              returnToLobby();
            }}
          >
            Quit
          </PushButton>
        </div>

        <div className="flex items-center gap-3">
          <StreakBadge streak={streak} mode={mode} />
          <div className="flex items-center gap-2 rounded-xl border-b-4 border-slate-950 bg-slate-800 px-4 py-1.5">
            <Zap className="h-4 w-4 text-yellow-300" aria-hidden />
            <motion.span
              key={score}
              initial={{ scale: 1.35, color: "#fde047" }}
              animate={{ scale: 1, color: "#ffffff" }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="font-mono text-lg font-black tabular-nums"
              aria-label={`Score ${score}`}
            >
              {formatPoints(score)}
            </motion.span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        <span className="shrink-0 font-mono text-xs font-bold text-slate-300">
          Q{currentIndex + 1}/{questions.length}
        </span>
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {questions.map((q, i) => {
            const rec = records[i];
            // Misses are striped so the progress strip doesn't rely on color alone.
            const style = rec
              ? rec.isCorrect
                ? "h-2 bg-emerald-400"
                : "h-2 bg-rose-500 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgba(2,6,23,0.55)_3px_6px)]"
              : i === currentIndex
                ? "h-2 bg-indigo-300"
                : "h-2 bg-slate-700";
            return (
              <div
                key={q.id}
                className={`flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${style}`}
              />
            );
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <QuestionRound
          key={`${question.id}-${currentIndex}`}
          question={question}
          plan={questionPlan}
          previousPlan={plan[currentIndex - 1]}
          mode={mode}
          isLast={currentIndex === questions.length - 1}
        />
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function StreakBadge({ streak, mode }: { streak: number; mode: ScoringMode }) {
  const hot = streak >= 3;
  const multiplier = mode === "streak" ? streakMultiplier(streak) : null;
  return (
    <AnimatePresence>
      {streak >= 2 && (
        <motion.div
          key="streak"
          initial={{ opacity: 0, scale: 0.5, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className={`flex items-center gap-1.5 rounded-xl border-2 border-b-4 px-3 py-1.5 ${
            hot
              ? "border-orange-400 bg-gradient-to-br from-orange-500/30 to-rose-600/30 shadow-[0_0_24px_-4px_rgba(251,146,60,0.8)]"
              : "border-amber-500/60 bg-amber-500/10"
          }`}
          aria-label={`Streak ${streak}`}
        >
          <motion.span
            key={streak}
            initial={{ scale: 1.8, rotate: -15 }}
            animate={{ scale: [1.8, 1, 1.12, 1], rotate: 0 }}
            transition={{ duration: 0.5 }}
            className="flex"
          >
            <Flame className={`h-5 w-5 ${hot ? "fill-orange-400 text-yellow-300" : "text-amber-300"}`} aria-hidden />
          </motion.span>
          <span className="font-mono text-sm font-black text-white">{streak}</span>
          {multiplier !== null && multiplier > 1 && (
            <span className="rounded-md bg-orange-400 px-1.5 py-0.5 font-mono text-[11px] font-black text-orange-950">
              next ×{multiplier}
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------------ */

interface QuestionRoundProps {
  question: Question;
  plan: QuestionPlan;
  previousPlan: QuestionPlan | undefined;
  mode: ScoringMode;
  isLast: boolean;
}

function QuestionRound({ question, plan, previousPlan, mode, isLast }: QuestionRoundProps) {
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const nextQuestion = useGameStore((s) => s.nextQuestion);

  const limitMs = plan.timeLimitMs;
  const [armed, setArmed] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number>(limitMs ?? 0);
  const [result, setResult] = useState<AnswerRecord | null>(null);

  const startRef = useRef<number | null>(null);
  const resolvedRef = useRef(false);
  const lastTickRef = useRef<number | null>(null);
  const tabSwitchedRef = useRef(false);

  const pressureShift = mode === "variable" && previousPlan !== undefined && previousPlan.pressure !== plan.pressure;

  /** Start the reaction-time clock once the question is fully on screen. */
  const arm = useCallback(() => {
    if (startRef.current !== null) return;
    requestAnimationFrame(() => {
      if (startRef.current !== null) return;
      startRef.current = performance.now();
      tabSwitchedRef.current = document.visibilityState === "hidden";
      setArmed(true);
    });
  }, []);

  // Flag the trial if the page is hidden at any point while the clock is running.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && startRef.current !== null && !resolvedRef.current) {
        tabSwitchedRef.current = true;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const resolve = useCallback(
    (selectedIndex: number | null) => {
      if (resolvedRef.current || startRef.current === null) return;
      resolvedRef.current = true;
      const elapsed = Math.round(performance.now() - startRef.current);
      const reactionTimeMs = selectedIndex === null && limitMs !== null ? limitMs : elapsed;
      const record = submitAnswer({
        selectedIndex,
        reactionTimeMs,
        tabSwitched: tabSwitchedRef.current,
      });
      if (!record) return;
      setResult(record);

      if (record.timedOut) {
        sound.timeUp();
      } else if (record.isCorrect) {
        sound.correct();
        if (record.streakAfter >= 3) {
          window.setTimeout(() => sound.streak(), 180);
          fireStreakConfetti(record.streakAfter);
        }
      } else {
        sound.wrong();
      }
    },
    [limitMs, submitAnswer],
  );

  const choose = (index: number) => {
    if (!armed || resolvedRef.current) return;
    sound.click();
    resolve(index);
  };

  const advance = useCallback(() => {
    if (!resolvedRef.current) return;
    nextQuestion();
  }, [nextQuestion]);

  // Fallback in case the entrance animation callback never fires (e.g. tab hidden).
  useEffect(() => {
    const id = window.setTimeout(arm, ARM_FALLBACK_MS);
    return () => window.clearTimeout(id);
  }, [arm]);

  // Countdown loop.
  const onFrame = useEffectEvent((now: number) => {
    if (startRef.current === null || limitMs === null || resolvedRef.current) return false;
    const remaining = Math.max(0, limitMs - (now - startRef.current));
    setRemainingMs(remaining);

    const secondsLeft = Math.ceil(remaining / 1000);
    const urgencyWindow = limitMs <= 8_000 ? 3 : 5;
    if (remaining > 0 && secondsLeft <= urgencyWindow && lastTickRef.current !== secondsLeft) {
      lastTickRef.current = secondsLeft;
      sound.tick(1 - (secondsLeft - 1) / urgencyWindow);
    }
    if (remaining <= 0) {
      resolve(null);
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (!armed || limitMs === null) return;
    let raf = 0;
    const loop = (now: number) => {
      if (onFrame(now)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [armed, limitMs]);

  // Keyboard shortcuts: 1–4 answer, Enter/Space advance.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const idx = ["1", "2", "3", "4"].indexOf(e.key);
    if (idx >= 0) {
      e.preventDefault();
      choose(idx);
    } else if ((e.key === "Enter" || e.key === " ") && resolvedRef.current) {
      e.preventDefault();
      sound.click();
      advance();
    }
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-advance after the reveal.
  useEffect(() => {
    if (!result) return;
    const id = window.setTimeout(advance, REVEAL_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [result, advance]);

  const fraction = limitMs ? remainingMs / limitMs : 1;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const urgent = limitMs !== null && armed && !result && fraction <= 0.34;
  const barColor = fraction > 0.6 ? "bg-cyan-400" : fraction > 0.34 ? "bg-amber-400" : "bg-rose-500";

  return (
    <motion.div
      variants={roundVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      onAnimationComplete={(definition) => {
        if (definition === "enter") arm();
      }}
      className="flex flex-1 flex-col gap-5"
    >
      {/* Timer */}
      <div className="flex items-center gap-4">
        {limitMs !== null ? (
          <>
            <motion.div
              animate={urgent ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={urgent ? { duration: 0.5, repeat: Infinity } : { duration: 0.2 }}
              className={`flex size-14 shrink-0 items-center justify-center rounded-full border-4 font-mono text-xl font-black tabular-nums ${
                urgent ? "border-rose-500 bg-rose-500/20 text-rose-200" : "border-slate-700 bg-slate-800 text-white"
              }`}
              aria-live="off"
            >
              {secondsLeft}
            </motion.div>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-950">
              <div
                className={`h-full rounded-full ${barColor} transition-colors duration-300`}
                style={{ width: `${fraction * 100}%` }}
              />
            </div>
          </>
        ) : (
          <div className="flex h-14 items-center gap-2 rounded-full border-b-4 border-slate-950 bg-slate-800 px-5 text-sm font-semibold text-slate-300">
            <Hourglass className="h-4 w-4 text-sky-300" aria-hidden />
            No time limit — take your time
          </div>
        )}
        {mode === "variable" && (
          <motion.span
            initial={pressureShift ? { scale: 1.4, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 14, delay: 0.15 }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-b-4 px-3 py-1.5 text-xs font-black uppercase tracking-wider ${
              plan.pressure === "high"
                ? "border-rose-400 bg-rose-500/15 text-rose-200"
                : plan.pressure === "standard"
                  ? "border-violet-400 bg-violet-500/15 text-violet-200"
                  : "border-sky-400 bg-sky-500/15 text-sky-200"
            }`}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {pressureShift ? "Shift! " : ""}
            {timeLimitLabel(plan.timeLimitMs)}
          </motion.span>
        )}
      </div>

      {/* Question card */}
      <div className="relative rounded-3xl border-b-[6px] border-slate-950 bg-slate-800 px-6 py-8 text-center shadow-[0_20px_60px_-20px_rgba(79,70,229,0.5)] sm:px-10 sm:py-10">
        <div className="mb-4 flex items-center justify-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${DIFFICULTY_STYLES[question.difficulty]}`}>
            {question.difficulty}
          </span>
          <span className="rounded-full bg-slate-950 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            {question.category}
          </span>
        </div>
        <h2 className="text-balance text-2xl font-extrabold leading-snug text-white sm:text-3xl">{question.prompt}</h2>

        <ResultPopup result={result} mode={mode} />
      </div>

      {/* Answer tiles */}
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        {question.options.map((option, i) => {
          const style = TILE_STYLES[i];
          const Icon = style.icon;
          const isCorrectTile = i === question.correctIndex;
          const isSelected = result?.selectedIndex === i;
          const revealed = result !== null;
          const dimmed = revealed && !isCorrectTile && !isSelected;

          return (
            <motion.button
              key={option}
              type="button"
              onClick={() => choose(i)}
              disabled={revealed}
              aria-disabled={!armed || revealed}
              aria-keyshortcuts={String(i + 1)}
              initial={{ opacity: 0, y: 14 }}
              animate={{
                opacity: dimmed ? 0.35 : 1,
                y: 0,
                scale: revealed && isCorrectTile ? 1.03 : 1,
              }}
              transition={{ duration: 0.22, delay: revealed ? 0 : 0.04 * i }}
              whileHover={!revealed && armed ? { y: -2 } : undefined}
              className={`group relative flex min-h-[84px] items-center gap-4 rounded-2xl border-b-[7px] px-5 py-4 text-left text-lg font-extrabold text-slate-950 transition-[transform,border-width,filter,background-color] duration-75 motion-reduce:transition-none sm:min-h-[104px] sm:text-xl ${style.face} ${style.depth} ${
                revealed ? "cursor-default" : "cursor-pointer active:translate-y-[5px] active:border-b-2"
              } ${!revealed && armed ? style.glow : ""} ${dimmed ? "grayscale" : ""} ${
                revealed && isCorrectTile ? "ring-4 ring-emerald-300 ring-offset-4 ring-offset-slate-900" : ""
              } ${revealed && isSelected && !isCorrectTile ? "ring-4 ring-rose-500 ring-offset-4 ring-offset-slate-900" : ""} focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950/15">
                <Icon className="h-6 w-6 fill-slate-950/80 text-slate-950/80" aria-hidden />
              </span>
              <span className="flex-1 leading-tight">{option}</span>
              {revealed && (isCorrectTile || isSelected) ? (
                <motion.span
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 18 }}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    isCorrectTile ? "bg-emerald-500 text-white" : "bg-rose-600 text-white"
                  }`}
                >
                  {isCorrectTile ? (
                    <Check aria-label="Correct answer" className="size-5" strokeWidth={3.5} />
                  ) : (
                    <X aria-label="Your answer, incorrect" className="size-5" strokeWidth={3.5} />
                  )}
                </motion.span>
              ) : (
                <kbd className="hidden shrink-0 rounded-lg bg-slate-950/20 px-2 py-0.5 font-mono text-sm font-bold text-slate-950/70 sm:block">
                  {i + 1}
                </kbd>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Reveal footer */}
      <div className="min-h-[72px]">
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-stretch gap-3 rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-4 sm:flex-row sm:items-center"
            >
              <p className="flex-1 text-sm text-slate-300">
                <span className="font-semibold text-white">
                  {result.timedOut ? "Time ran out. " : `Answered in ${result.reactionTimeMs.toLocaleString("en-US")} ms. `}
                </span>
                {question.explanation}
                {result.tabSwitched && (
                  <span className="mt-1 block text-xs font-semibold text-amber-300">
                    Tab switch detected — this answer is flagged in your data.
                  </span>
                )}
              </p>
              <PushButton
                variant="secondary"
                onClick={() => {
                  sound.click();
                  advance();
                }}
                className="relative h-12 shrink-0 overflow-hidden px-6 font-black uppercase"
              >
                <motion.span
                  className="absolute inset-y-0 left-0 bg-white/15"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: REVEAL_DURATION_MS / 1000, ease: "linear" }}
                  aria-hidden
                />
                <span className="relative">{isLast ? "See results" : "Next"}</span>
                <ChevronRight className="relative size-5" aria-hidden />
              </PushButton>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------------ */

function ResultPopup({ result, mode }: { result: AnswerRecord | null; mode: ScoringMode }) {
  return (
    <AnimatePresence>
      {result && (
        <motion.div
          key="popup"
          initial={{ opacity: 0, scale: 0.4, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: -6 }}
          exit={{ opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 16 }}
          className="pointer-events-none absolute inset-x-0 -bottom-7 z-10 flex justify-center"
          role="status"
        >
          {result.isCorrect ? (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-b-[6px] border-emerald-700 bg-emerald-400 px-6 py-2.5 text-emerald-950 shadow-[0_0_48px_-4px_rgba(52,211,153,0.9)]">
              <span className="text-2xl font-black tracking-tight sm:text-3xl">+{formatPoints(result.pointsAwarded)} pts!</span>
              {mode === "streak" && result.multiplier > 1 && (
                <span className="rounded-lg bg-emerald-950 px-2 py-0.5 font-mono text-xs font-black text-emerald-300">
                  ×{result.multiplier}
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-b-[6px] border-rose-800 bg-rose-500 px-6 py-2.5 text-white shadow-[0_0_48px_-4px_rgba(244,63,94,0.9)]">
              <span className="text-2xl font-black tracking-tight sm:text-3xl">{result.timedOut ? "Time's up!" : "Not quite!"}</span>
              {mode === "streak" && <span className="text-xs font-bold uppercase opacity-80">streak reset</span>}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
