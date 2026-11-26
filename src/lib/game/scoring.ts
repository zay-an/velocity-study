import type {
  ModeConfig,
  PressureLevel,
  QuestionPlan,
  ScoreBreakdown,
  ScoringMode,
} from "./types";

/** Returns a float in [0, 1). Injected so plans and shuffles are deterministic in tests. */
export type Rng = () => number;

export const MAX_POINTS = 1000;

export const PRESSURE_LIMITS: Record<PressureLevel, number | null> = {
  untimed: null,
  standard: 15_000,
  high: 8_000,
};

/** Streak multiplier tiers for Mode C, indexed by consecutive correct answers *before* this one. */
export const STREAK_MULTIPLIERS = [1, 1.25, 1.5, 2] as const;

/** Exponential decay constant for Mode C: answering at the buzzer yields 1000·e^(−ln5) = 200 pts. */
const STREAK_DECAY_K = Math.log(5);

export const MODE_CONFIGS: Record<ScoringMode, ModeConfig> = {
  control: {
    id: "control",
    letter: "A",
    name: "Control",
    tagline: "Untimed Accuracy",
    description: "No countdown, no pressure. Every correct answer is worth the same.",
    formula: "1,000 pts per correct answer",
    timerLabel: "No timer",
    accent: {
      text: "text-sky-300",
      border: "border-sky-400",
      bg: "bg-sky-500",
      glow: "shadow-[0_0_32px_-6px_rgba(56,189,248,0.7)]",
    },
  },
  speed: {
    id: "speed",
    letter: "B",
    name: "Classic Speed Decay",
    tagline: "Kahoot-style",
    description: "15-second timer. Points shrink linearly the longer you take.",
    formula: "round(1000 × (1 − rt ÷ (2 × limit)))  →  1000…500",
    timerLabel: "15s per question",
    accent: {
      text: "text-violet-300",
      border: "border-violet-400",
      bg: "bg-violet-500",
      glow: "shadow-[0_0_32px_-6px_rgba(167,139,250,0.7)]",
    },
  },
  streak: {
    id: "streak",
    letter: "C",
    name: "High-Pressure Streak",
    tagline: "Aggressive",
    description:
      "10-second timer, exponential decay and an escalating streak multiplier that resets instantly on a miss.",
    formula: "1000 × e^(−1.61 × rt ÷ limit) × [1× · 1.25× · 1.5× · 2×]",
    timerLabel: "10s per question",
    accent: {
      text: "text-orange-300",
      border: "border-orange-400",
      bg: "bg-orange-500",
      glow: "shadow-[0_0_32px_-6px_rgba(251,146,60,0.7)]",
    },
  },
  variable: {
    id: "variable",
    letter: "D",
    name: "Variable Pressure",
    tagline: "Dynamic",
    description:
      "Pacing shifts unpredictably between untimed, 15s and 8s per question to probe how changing pressure affects errors.",
    formula: "Untimed → 1,000 flat · Timed → speed decay on that limit",
    timerLabel: "Untimed · 15s · 8s",
    accent: {
      text: "text-fuchsia-300",
      border: "border-fuchsia-400",
      bg: "bg-fuchsia-500",
      glow: "shadow-[0_0_32px_-6px_rgba(232,121,249,0.7)]",
    },
  },
};

export const MODE_ORDER: readonly ScoringMode[] = ["control", "speed", "streak", "variable"];

/** Human label for a question's pacing, derived from its actual time limit. */
export function timeLimitLabel(timeLimitMs: number | null): string {
  return timeLimitMs === null ? "Untimed" : `${timeLimitMs / 1000}s`;
}

/** Fisher–Yates shuffle into a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hasTripleRun(sequence: readonly PressureLevel[]): boolean {
  for (let i = 2; i < sequence.length; i++) {
    if (sequence[i] === sequence[i - 1] && sequence[i] === sequence[i - 2]) return true;
  }
  return false;
}

/**
 * Builds the per-question pacing plan for a session.
 * Mode D uses a balanced, shuffled mix of pressure levels with no level
 * repeating three times in a row, so the pacing feels genuinely unpredictable.
 */
export function buildQuestionPlan(mode: ScoringMode, count: number, rng: Rng): QuestionPlan[] {
  const fixed = (pressure: PressureLevel, timeLimitMs: number | null): QuestionPlan[] =>
    Array.from({ length: count }, () => ({ pressure, timeLimitMs }));

  switch (mode) {
    case "control":
      return fixed("untimed", null);
    case "speed":
      return fixed("standard", 15_000);
    case "streak":
      return fixed("high", 10_000);
    case "variable": {
      const levels: PressureLevel[] = ["untimed", "standard", "high"];
      const pool = Array.from({ length: count }, (_, i) => levels[i % levels.length]);
      let sequence = shuffle(pool, rng);
      for (let attempt = 0; attempt < 50 && hasTripleRun(sequence); attempt++) {
        sequence = shuffle(pool, rng);
      }
      return sequence.map((pressure) => ({ pressure, timeLimitMs: PRESSURE_LIMITS[pressure] }));
    }
  }
}

/** Kahoot-style linear decay: 1000 at 0ms down to 500 at the time limit. */
export function linearSpeedPoints(reactionTimeMs: number, limitMs: number): number {
  const rt = Math.min(Math.max(reactionTimeMs, 0), limitMs);
  return Math.round(MAX_POINTS * (1 - rt / (2 * limitMs)));
}

/** Exponential decay: 1000 at 0ms down to 200 at the time limit. */
export function exponentialSpeedPoints(reactionTimeMs: number, limitMs: number): number {
  const ratio = Math.min(Math.max(reactionTimeMs, 0), limitMs) / limitMs;
  return Math.round(MAX_POINTS * Math.exp(-STREAK_DECAY_K * ratio));
}

export function streakMultiplier(streakBefore: number): number {
  return STREAK_MULTIPLIERS[Math.min(Math.max(streakBefore, 0), STREAK_MULTIPLIERS.length - 1)];
}

interface ScoreInput {
  mode: ScoringMode;
  isCorrect: boolean;
  reactionTimeMs: number;
  timeLimitMs: number | null;
  streakBefore: number;
}

export function calculateScore({
  mode,
  isCorrect,
  reactionTimeMs,
  timeLimitMs,
  streakBefore,
}: ScoreInput): ScoreBreakdown {
  if (!isCorrect) {
    return { basePoints: 0, multiplier: 1, pointsAwarded: 0, streakAfter: 0 };
  }

  let basePoints = MAX_POINTS;
  let multiplier = 1;

  switch (mode) {
    case "control":
      break;
    case "speed":
      basePoints = linearSpeedPoints(reactionTimeMs, timeLimitMs ?? 15_000);
      break;
    case "streak":
      basePoints = exponentialSpeedPoints(reactionTimeMs, timeLimitMs ?? 10_000);
      multiplier = streakMultiplier(streakBefore);
      break;
    case "variable":
      basePoints =
        timeLimitMs === null ? MAX_POINTS : linearSpeedPoints(reactionTimeMs, timeLimitMs);
      break;
  }

  return {
    basePoints,
    multiplier,
    pointsAwarded: Math.round(basePoints * multiplier),
    streakAfter: streakBefore + 1,
  };
}

export function formatPoints(points: number): string {
  return points.toLocaleString("en-US");
}

export function formatMs(ms: number): string {
  return `${Math.round(ms).toLocaleString("en-US")} ms`;
}
