import type { AnswerRecord, SessionSummary } from "./types";

export function summarizeSession(
  meta: Pick<SessionSummary, "id" | "participantId" | "mode" | "startedAt" | "completedAt">,
  records: AnswerRecord[],
  maxStreak: number,
): SessionSummary {
  const correctCount = records.filter((r) => r.isCorrect).length;
  const timeoutCount = records.filter((r) => r.timedOut).length;
  const answered = records.filter((r) => !r.timedOut);
  const avgReactionMs = answered.length
    ? answered.reduce((sum, r) => sum + r.reactionTimeMs, 0) / answered.length
    : 0;

  return {
    ...meta,
    totalScore: records.reduce((sum, r) => sum + r.pointsAwarded, 0),
    questionCount: records.length,
    correctCount,
    timeoutCount,
    accuracy: records.length ? correctCount / records.length : 0,
    avgReactionMs: Math.round(avgReactionMs),
    maxStreak,
    records,
  };
}

export function median(values: readonly number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ModeAggregate {
  runs: number;
  accuracy: number;
  avgReactionMs: number;
  avgScore: number;
  bestScore: number;
}

export function aggregateSessions(sessions: readonly SessionSummary[]): ModeAggregate | null {
  if (!sessions.length) return null;
  const n = sessions.length;
  return {
    runs: n,
    accuracy: sessions.reduce((s, x) => s + x.accuracy, 0) / n,
    avgReactionMs: sessions.reduce((s, x) => s + x.avgReactionMs, 0) / n,
    avgScore: sessions.reduce((s, x) => s + x.totalScore, 0) / n,
    bestScore: Math.max(...sessions.map((x) => x.totalScore)),
  };
}

export interface SpeedSplit {
  medianMs: number;
  fastAccuracy: number;
  slowAccuracy: number;
  fastN: number;
  slowN: number;
}

/** Median split on reaction time: is accuracy worse for the faster half? */
export function speedSplit(records: readonly AnswerRecord[]): SpeedSplit | null {
  const answered = records.filter((r) => !r.timedOut);
  if (answered.length < 2) return null;
  const mid = median(answered.map((r) => r.reactionTimeMs));
  const fast = answered.filter((r) => r.reactionTimeMs <= mid);
  const slow = answered.filter((r) => r.reactionTimeMs > mid);
  if (!fast.length || !slow.length) return null;
  const acc = (rs: AnswerRecord[]) => rs.filter((r) => r.isCorrect).length / rs.length;
  return {
    medianMs: mid,
    fastAccuracy: acc(fast),
    slowAccuracy: acc(slow),
    fastN: fast.length,
    slowN: slow.length,
  };
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
