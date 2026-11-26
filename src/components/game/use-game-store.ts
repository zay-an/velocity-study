"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEMO_QUESTIONS } from "@/lib/game/demo-questions";
import { buildQuestionPlan, calculateScore, shuffle } from "@/lib/game/scoring";
import { summarizeSession } from "@/lib/game/session-stats";
import type {
  AnswerRecord,
  GamePhase,
  Question,
  QuestionPlan,
  ScoringMode,
  SessionSummary,
} from "@/lib/game/types";
import { sound } from "./sound";

const MAX_HISTORY = 50;
const ANONYMOUS = "anonymous";

function createId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // randomUUID is missing on insecure (non-localhost http) origins; fall back to CSPRNG bytes.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `s-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export interface SubmitAnswerInput {
  selectedIndex: number | null;
  /** Integer milliseconds from `performance.now()`. */
  reactionTimeMs: number;
  tabSwitched: boolean;
}

interface GameState {
  // Persisted preferences + local research history
  selectedMode: ScoringMode;
  muted: boolean;
  history: SessionSummary[];

  // Live session (memory only)
  hasHydrated: boolean;
  phase: GamePhase;
  sessionId: string;
  participantId: string;
  startedAt: string;
  questions: Question[];
  plan: QuestionPlan[];
  currentIndex: number;
  score: number;
  streak: number;
  maxStreak: number;
  records: AnswerRecord[];
  currentSession: SessionSummary | null;

  // Actions
  setSelectedMode: (mode: ScoringMode) => void;
  toggleMute: () => void;
  /** `participantCode` is captured once per session so every row is labeled consistently. */
  startGame: (participantCode: string | null) => void;
  submitAnswer: (input: SubmitAnswerInput) => AnswerRecord | null;
  nextQuestion: () => void;
  returnToLobby: () => void;
  clearHistory: () => void;
}

const liveDefaults = {
  phase: "lobby" as GamePhase,
  sessionId: "",
  participantId: ANONYMOUS,
  startedAt: "",
  questions: [] as Question[],
  plan: [] as QuestionPlan[],
  currentIndex: 0,
  score: 0,
  streak: 0,
  maxStreak: 0,
  records: [] as AnswerRecord[],
  currentSession: null as SessionSummary | null,
};

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      selectedMode: "speed",
      muted: false,
      history: [],
      hasHydrated: false,
      ...liveDefaults,

      setSelectedMode: (mode) => set({ selectedMode: mode }),

      toggleMute: () => {
        const muted = !get().muted;
        sound.setMuted(muted);
        set({ muted });
      },

      startGame: (participantCode) => {
        const mode = get().selectedMode;
        const questions = shuffle(DEMO_QUESTIONS, Math.random);
        set({
          ...liveDefaults,
          phase: "playing",
          sessionId: createId(),
          participantId: participantCode ?? ANONYMOUS,
          startedAt: new Date().toISOString(),
          questions,
          plan: buildQuestionPlan(mode, questions.length, Math.random),
        });
      },

      submitAnswer: ({ selectedIndex, reactionTimeMs, tabSwitched }) => {
        const state = get();
        if (state.phase !== "playing") return null;
        const question = state.questions[state.currentIndex];
        const plan = state.plan[state.currentIndex];
        if (!question || !plan) return null;
        // Guard against double submission for the same question.
        if (state.records.some((r) => r.questionNumber === state.currentIndex + 1)) return null;

        const timedOut = selectedIndex === null;
        const isCorrect = !timedOut && selectedIndex === question.correctIndex;
        const rt = Math.round(reactionTimeMs);
        const breakdown = calculateScore({
          mode: state.selectedMode,
          isCorrect,
          reactionTimeMs: rt,
          timeLimitMs: plan.timeLimitMs,
          streakBefore: state.streak,
        });

        const record: AnswerRecord = {
          sessionId: state.sessionId,
          participantId: state.participantId,
          mode: state.selectedMode,
          questionNumber: state.currentIndex + 1,
          questionId: question.id,
          category: question.category,
          difficulty: question.difficulty,
          pressure: plan.pressure,
          timeLimitMs: plan.timeLimitMs,
          selectedIndex,
          correctIndex: question.correctIndex,
          isCorrect,
          timedOut,
          reactionTimeMs: rt,
          tabSwitched,
          basePoints: breakdown.basePoints,
          multiplier: breakdown.multiplier,
          pointsAwarded: breakdown.pointsAwarded,
          streakAfter: breakdown.streakAfter,
          answeredAt: new Date().toISOString(),
        };

        set({
          records: [...state.records, record],
          score: state.score + breakdown.pointsAwarded,
          streak: breakdown.streakAfter,
          maxStreak: Math.max(state.maxStreak, breakdown.streakAfter),
        });
        return record;
      },

      nextQuestion: () => {
        const state = get();
        if (state.phase !== "playing") return;
        const nextIndex = state.currentIndex + 1;
        if (nextIndex < state.questions.length) {
          set({ currentIndex: nextIndex });
          return;
        }
        const summary = summarizeSession(
          {
            id: state.sessionId,
            participantId: state.participantId,
            mode: state.selectedMode,
            startedAt: state.startedAt,
            completedAt: new Date().toISOString(),
          },
          state.records,
          state.maxStreak,
        );
        set({
          phase: "results",
          currentSession: summary,
          history: [...state.history, summary].slice(-MAX_HISTORY),
        });
      },

      returnToLobby: () => set({ ...liveDefaults }),

      clearHistory: () => {
        const current = get().currentSession;
        set({ history: current ? [current] : [] });
      },
    }),
    {
      name: "velocity-study:game:v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
        selectedMode: state.selectedMode,
        muted: state.muted,
        history: state.history,
      }),
      onRehydrateStorage: () => (state) => {
        sound.setMuted(state?.muted ?? false);
        useGameStore.setState({ hasHydrated: true });
      },
    },
  ),
);
