/**
 * Core domain types for the speed-accuracy tradeoff game.
 */

export type ScoringMode = "control" | "speed" | "streak" | "variable";

export type Difficulty = "Easy" | "Medium" | "Hard";

export type GamePhase = "lobby" | "playing" | "results";

/** Pressure level applied to a single question. */
export type PressureLevel = "untimed" | "standard" | "high";

export type AnswerIndex = 0 | 1 | 2 | 3;

export interface Question {
  id: string;
  category: "Computer Science" | "General Knowledge";
  difficulty: Difficulty;
  prompt: string;
  options: readonly [string, string, string, string];
  correctIndex: AnswerIndex;
  explanation: string;
}

/** Per-question pacing decided when the session starts. */
export interface QuestionPlan {
  pressure: PressureLevel;
  /** `null` means untimed. */
  timeLimitMs: number | null;
}

export interface ScoreBreakdown {
  basePoints: number;
  multiplier: number;
  pointsAwarded: number;
  streakAfter: number;
}

/** One raw telemetry row, exported 1:1 to CSV. */
export interface AnswerRecord {
  sessionId: string;
  participantId: string;
  mode: ScoringMode;
  questionNumber: number;
  questionId: string;
  category: Question["category"];
  difficulty: Difficulty;
  pressure: PressureLevel;
  timeLimitMs: number | null;
  selectedIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  timedOut: boolean;
  /** Integer milliseconds measured with `performance.now()`. */
  reactionTimeMs: number;
  /** True if the page was hidden at any point while this question was live. */
  tabSwitched: boolean;
  basePoints: number;
  multiplier: number;
  pointsAwarded: number;
  streakAfter: number;
  answeredAt: string;
}

export interface SessionSummary {
  id: string;
  participantId: string;
  mode: ScoringMode;
  startedAt: string;
  completedAt: string;
  totalScore: number;
  questionCount: number;
  correctCount: number;
  timeoutCount: number;
  accuracy: number;
  avgReactionMs: number;
  maxStreak: number;
  records: AnswerRecord[];
}

export interface ModeConfig {
  id: ScoringMode;
  letter: "A" | "B" | "C" | "D";
  name: string;
  tagline: string;
  description: string;
  formula: string;
  timerLabel: string;
  /** Tailwind classes for the mode's accent. */
  accent: {
    text: string;
    border: string;
    bg: string;
    glow: string;
  };
}
