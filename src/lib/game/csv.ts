import type { AnswerRecord } from "./types";

export const CSV_COLUMNS: ReadonlyArray<keyof AnswerRecord> = [
  "sessionId",
  "participantId",
  "mode",
  "questionNumber",
  "questionId",
  "category",
  "difficulty",
  "pressure",
  "timeLimitMs",
  "selectedIndex",
  "correctIndex",
  "isCorrect",
  "timedOut",
  "reactionTimeMs",
  "tabSwitched",
  "basePoints",
  "multiplier",
  "pointsAwarded",
  "streakAfter",
  "answeredAt",
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(records: readonly AnswerRecord[]): string {
  const header = CSV_COLUMNS.join(",");
  const rows = records.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return [header, ...rows].join("\r\n");
}
