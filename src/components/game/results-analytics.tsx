"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Check,
  Download,
  EyeOff,
  Flame,
  Gauge,
  RotateCcw,
  Target,
  Timer,
  Trash2,
  Trophy,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { PushButton } from "@/components/ui/push-button";
import { toCsv } from "@/lib/game/csv";
import { MODE_CONFIGS, MODE_ORDER, formatMs, formatPoints, timeLimitLabel } from "@/lib/game/scoring";
import { aggregateSessions, formatPercent, speedSplit } from "@/lib/game/session-stats";
import type { AnswerRecord, ScoringMode, SessionSummary } from "@/lib/game/types";
import { beginSession } from "./lobby-screen";
import { sound } from "./sound";
import { useGameStore } from "./use-game-store";

const CORRECT_COLOR = "#34d399"; // emerald-400
const INCORRECT_COLOR = "#f43f5e"; // rose-500
const AXIS_TEXT = "#cbd5e1"; // slate-300
const AXIS_LINE = "#94a3b8"; // slate-400: >= 3:1 against slate-800 for UI lines
const GRID_LINE = "#334155"; // slate-700

function downloadCsv(filename: string, records: readonly AnswerRecord[]) {
  const blob = new Blob([toCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface ChartPoint {
  rt: number;
  points: number;
  record: AnswerRecord;
}

function isChartPoint(value: unknown): value is ChartPoint {
  return (
    typeof value === "object" &&
    value !== null &&
    "record" in value &&
    typeof value.record === "object" &&
    value.record !== null
  );
}

/* ------------------------------ Component ------------------------------- */

export function ResultsAnalytics() {
  const session = useGameStore((s) => s.currentSession);
  const history = useGameStore((s) => s.history);
  const returnToLobby = useGameStore((s) => s.returnToLobby);
  const clearHistory = useGameStore((s) => s.clearHistory);
  const celebratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!session || celebratedRef.current === session.id) return;
    celebratedRef.current = session.id;
    sound.fanfare();
    const strong = session.accuracy >= 0.75;
    const base = { disableForReducedMotion: true, zIndex: 60, colors: ["#f0abfc", "#67e8f9", "#fde047", "#34d399", "#a78bfa"] };
    confetti({ ...base, particleCount: strong ? 160 : 70, spread: 100, startVelocity: 50, origin: { x: 0.5, y: 0.3 } });
    if (strong) {
      const id = window.setTimeout(() => {
        confetti({ ...base, particleCount: 80, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
        confetti({ ...base, particleCount: 80, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
      }, 350);
      return () => window.clearTimeout(id);
    }
  }, [session]);

  if (!session) return null;

  const cfg = MODE_CONFIGS[session.mode];
  const records = session.records;
  const priorSessions = history.filter((h) => h.id !== session.id);
  const split = speedSplit(records);
  const tabSwitchCount = records.filter((r) => r.tabSwitched).length;

  const points: ChartPoint[] = records.map((r) => ({ rt: r.reactionTimeMs, points: r.pointsAwarded, record: r }));
  const correctPoints = points.filter((p) => p.record.isCorrect);
  const incorrectPoints = points.filter((p) => !p.record.isCorrect);
  const timeLimits = Array.from(new Set(records.map((r) => r.timeLimitMs).filter((v): v is number => v !== null)));
  const maxLimit = timeLimits.length ? Math.max(...timeLimits) : 0;

  const stats: Array<{ label: string; value: string; sub: string; icon: LucideIcon; tone: string }> = [
    { label: "Final score", value: formatPoints(session.totalScore), sub: `${session.questionCount} questions`, icon: Trophy, tone: "text-yellow-300" },
    { label: "Accuracy", value: formatPercent(session.accuracy), sub: `${session.correctCount}/${session.questionCount} correct`, icon: Target, tone: "text-emerald-300" },
    {
      label: "Avg reaction",
      value: formatMs(session.avgReactionMs),
      sub: session.timeoutCount ? `${session.timeoutCount} timeout${session.timeoutCount === 1 ? "" : "s"} excluded` : "answered questions",
      icon: Timer,
      tone: "text-cyan-300",
    },
    { label: "Max streak", value: String(session.maxStreak), sub: "consecutive correct", icon: Flame, tone: "text-orange-300" },
  ];

  const stamp = session.completedAt.replace(/[:.]/g, "-").slice(0, 19);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
          className="flex size-16 items-center justify-center rounded-2xl border-b-[6px] border-yellow-600 bg-yellow-300 shadow-[0_0_48px_-6px_rgba(253,224,71,0.8)]"
        >
          <Trophy className="size-9 text-yellow-900" aria-hidden />
        </motion.div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-300">Speed vs. Accuracy · Research Summary</p>
          <h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Round complete!</h1>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-xl border-2 border-b-4 ${cfg.accent.border} bg-slate-800 px-3 py-1 text-xs font-bold uppercase tracking-wider ${cfg.accent.text}`}>
          Mode {cfg.letter} · {cfg.name}
        </span>
        <span className="font-mono text-xs text-slate-300">Participant {session.participantId}</span>
        {tabSwitchCount > 0 && (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-semibold text-amber-200">
            <EyeOff aria-hidden className="size-4" />
            {tabSwitchCount} answer{tabSwitchCount === 1 ? " was" : "s were"} given after leaving the tab and {tabSwitchCount === 1 ? "is" : "are"} flagged in the CSV.
          </p>
        )}
      </motion.header>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.15 + i * 0.07, type: "spring", stiffness: 300, damping: 22 }}
            className="rounded-2xl border-b-[6px] border-slate-950 bg-slate-800 p-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
              <s.icon className={`size-4 ${s.tone}`} aria-hidden />
              {s.label}
            </div>
            <div className="mt-2 font-mono text-2xl font-black tabular-nums text-white sm:text-3xl">{s.value}</div>
            <div className="mt-0.5 text-xs text-slate-300">{s.sub}</div>
          </motion.div>
        ))}
      </section>

      {/* Scatter */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-4 sm:p-6"
        aria-labelledby="scatter-heading"
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="scatter-heading" className="text-lg font-extrabold text-white">
              Reaction time vs. points
            </h2>
            <p className="text-sm text-slate-300">Each mark is one question. Misses score 0.</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-300" aria-label="Legend">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full" style={{ backgroundColor: CORRECT_COLOR }} />
              Correct ({correctPoints.length})
            </span>
            <span className="inline-flex items-center gap-1.5">
              <X className="size-3.5" strokeWidth={4} style={{ color: INCORRECT_COLOR }} aria-hidden />
              Incorrect ({incorrectPoints.length})
            </span>
          </div>
        </div>

        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 28, left: 4 }}>
              <CartesianGrid stroke={GRID_LINE} strokeDasharray="0" vertical={false} />
              <XAxis
                type="number"
                dataKey="rt"
                name="Reaction time"
                domain={[0, (max: number) => Math.max(2000, maxLimit, Math.ceil(max / 1000) * 1000)]}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}s`}
                stroke={AXIS_LINE}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                tickLine={false}
                label={{ value: "Reaction time", position: "insideBottom", offset: -16, fill: AXIS_TEXT, fontSize: 12 }}
              />
              <YAxis
                type="number"
                dataKey="points"
                name="Points"
                domain={[0, (max: number) => Math.max(1000, Math.ceil(max / 250) * 250)]}
                stroke={AXIS_LINE}
                tick={{ fill: AXIS_TEXT, fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ZAxis range={[110, 110]} />
              {session.avgReactionMs > 0 && (
                <ReferenceLine
                  x={session.avgReactionMs}
                  stroke="#818cf8"
                  strokeDasharray="4 4"
                  label={{ value: "avg", position: "top", fill: "#a5b4fc", fontSize: 11 }}
                />
              )}
              {timeLimits.map((limit) => (
                <ReferenceLine
                  key={limit}
                  x={limit}
                  stroke={AXIS_LINE}
                  strokeDasharray="2 4"
                  label={{ value: `${limit / 1000}s limit`, position: "insideTopRight", fill: AXIS_TEXT, fontSize: 11 }}
                />
              ))}
              <Tooltip
                cursor={{ stroke: GRID_LINE, strokeDasharray: "3 3" }}
                content={({ active, payload }) => <ScatterTooltip active={active} datum={payload?.[0]?.payload} />}
              />
              <Scatter name="Correct" data={correctPoints} fill={CORRECT_COLOR} stroke="#0f172a" strokeWidth={2} shape="circle" />
              <Scatter name="Incorrect" data={incorrectPoints} fill={INCORRECT_COLOR} stroke="#0f172a" strokeWidth={1} shape="cross" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {split && (
          <div className="mt-4 grid gap-3 rounded-xl bg-slate-950 p-4 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">Median split</div>
              <div className="font-mono text-white">{formatMs(split.medianMs)}</div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">Faster half accuracy</div>
              <div className="font-mono text-white">
                {formatPercent(split.fastAccuracy)} <span className="text-slate-300">(n={split.fastN})</span>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-300">Slower half accuracy</div>
              <div className="font-mono text-white">
                {formatPercent(split.slowAccuracy)} <span className="text-slate-300">(n={split.slowN})</span>
              </div>
            </div>
          </div>
        )}
      </motion.section>

      {/* Per-question telemetry */}
      <section className="rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-4 sm:p-6" aria-labelledby="telemetry-heading">
        <h2 id="telemetry-heading" className="mb-3 text-lg font-extrabold text-white">
          Question telemetry
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-300">
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-3 font-bold">#</th>
                <th className="py-2 pr-3 font-bold">Question</th>
                <th className="py-2 pr-3 font-bold">Difficulty</th>
                <th className="py-2 pr-3 font-bold">Pressure</th>
                <th className="py-2 pr-3 text-right font-bold">RT</th>
                <th className="py-2 pr-3 font-bold">Result</th>
                <th className="py-2 text-right font-bold">Points</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.questionNumber} className="border-b border-slate-700/60 last:border-0">
                  <td className="py-2 pr-3 font-mono text-slate-300">{r.questionNumber}</td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-300">
                    {r.questionId}
                    {r.tabSwitched && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-300" title="Tab switched during this question">
                        <EyeOff aria-hidden className="size-3.5" />
                        <span className="sr-only">(tab switched)</span>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-slate-300">{r.difficulty}</td>
                  <td className="py-2 pr-3 text-slate-300">{timeLimitLabel(r.timeLimitMs)}</td>
                  <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-100">{formatMs(r.reactionTimeMs)}</td>
                  <td className="py-2 pr-3">
                    {r.isCorrect ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-300">
                        <Check className="size-4" aria-hidden /> Correct
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-300">
                        <X className="size-4" aria-hidden /> {r.timedOut ? "Timeout" : "Incorrect"}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-white">
                    {formatPoints(r.pointsAwarded)}
                    {r.multiplier > 1 && <span className="ml-1 text-xs text-orange-300">×{r.multiplier}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mode comparison */}
      <section className="rounded-2xl border-b-4 border-slate-950 bg-slate-800 p-4 sm:p-6" aria-labelledby="compare-heading">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="compare-heading" className="text-lg font-extrabold text-white">
              Compared with previous runs
            </h2>
            <p className="text-sm text-slate-300">
              Averages of runs saved on this device, grouped by scoring mode. This session is shown separately.
            </p>
          </div>
          {priorSessions.length > 0 && (
            <PushButton
              variant="ghost"
              size="sm"
              onClick={() => {
                sound.click();
                clearHistory();
              }}
            >
              <Trash2 className="size-3.5" aria-hidden /> Clear saved runs
            </PushButton>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-300">
              <tr className="border-b border-slate-700">
                <th className="py-2 pr-3 font-bold">Mode</th>
                <th className="py-2 pr-3 text-right font-bold">Runs</th>
                <th className="py-2 pr-3 text-right font-bold">Accuracy</th>
                <th className="py-2 pr-3 text-right font-bold">Avg RT</th>
                <th className="py-2 pr-3 text-right font-bold">Avg score</th>
                <th className="py-2 text-right font-bold">Best</th>
              </tr>
            </thead>
            <tbody>
              {MODE_ORDER.map((mode) => (
                <ComparisonRows key={mode} mode={mode} session={session} prior={priorSessions.filter((h) => h.mode === mode)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row">
          <PushButton
            variant="secondary"
            onClick={() => {
              sound.click();
              downloadCsv(`velocity-study_${session.mode}_${stamp}.csv`, records);
            }}
          >
            <Download className="size-5" aria-hidden /> Download Session CSV
          </PushButton>
          {history.length > 1 && (
            <PushButton
              variant="ghost"
              onClick={() => {
                sound.click();
                downloadCsv(`velocity-study_all-runs_${stamp}.csv`, history.flatMap((h) => h.records));
              }}
            >
              <Download className="size-5" aria-hidden /> All runs ({history.length})
            </PushButton>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PushButton
            variant="ghost"
            onClick={() => {
              sound.click();
              returnToLobby();
            }}
          >
            <Gauge className="size-5" aria-hidden /> Change mode
          </PushButton>
          <PushButton variant="primary" onClick={beginSession} className="uppercase">
            <RotateCcw className="size-5" aria-hidden /> Play again
          </PushButton>
        </div>
      </section>
    </div>
  );
}

/* --------------------------- Sub-components ----------------------------- */

function ScatterTooltip({ active, datum }: { active?: boolean; datum: unknown }) {
  if (!active || !isChartPoint(datum)) return null;
  const r = datum.record;
  return (
    <div className="max-w-[240px] rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 flex items-center gap-1.5 font-bold text-white">
        {r.isCorrect ? (
          <Check className="size-3.5 text-emerald-300" aria-hidden />
        ) : (
          <X className="size-3.5 text-rose-300" aria-hidden />
        )}
        Q{r.questionNumber} · {r.difficulty}
      </div>
      <div className="font-mono text-slate-300">{r.questionId}</div>
      <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-slate-100">
        <span className="text-slate-300">RT</span>
        <span className="text-right font-mono">{formatMs(r.reactionTimeMs)}</span>
        <span className="text-slate-300">Points</span>
        <span className="text-right font-mono">{formatPoints(r.pointsAwarded)}</span>
        <span className="text-slate-300">Pressure</span>
        <span className="text-right">{timeLimitLabel(r.timeLimitMs)}</span>
        {r.timedOut && (
          <>
            <span className="text-slate-300">Status</span>
            <span className="text-right text-rose-300">Timed out</span>
          </>
        )}
        {r.tabSwitched && (
          <>
            <span className="text-slate-300">Tab</span>
            <span className="text-right text-amber-300">Switched</span>
          </>
        )}
      </div>
    </div>
  );
}

function Delta({ value, format, invert = false }: { value: number; format: (v: number) => string; invert?: boolean }) {
  if (Math.abs(value) < 1e-9) return <span className="ml-1.5 text-[11px] text-slate-300">±0</span>;
  const better = invert ? value < 0 : value > 0;
  return (
    <span className={`ml-1.5 text-[11px] font-bold ${better ? "text-emerald-300" : "text-rose-300"}`}>
      {value > 0 ? "▲" : "▼"}
      {format(Math.abs(value))}
    </span>
  );
}

function ComparisonRows({ mode, session, prior }: { mode: ScoringMode; session: SessionSummary; prior: SessionSummary[] }) {
  const cfg = MODE_CONFIGS[mode];
  const agg = aggregateSessions(prior);
  const isCurrent = session.mode === mode;
  const dash = <span className="text-slate-400">—</span>;

  return (
    <>
      <tr className={`border-b border-slate-700/60 ${isCurrent ? "bg-slate-700/40" : ""}`}>
        <td className="py-2.5 pr-3">
          <span className="inline-flex items-center gap-2">
            <span className={`flex size-5 items-center justify-center rounded-md text-[11px] font-black text-slate-950 ${cfg.accent.bg}`}>
              {cfg.letter}
            </span>
            <span className="font-semibold text-slate-100">{cfg.name}</span>
            <span className="text-xs text-slate-300">{isCurrent ? "prior avg" : "avg"}</span>
          </span>
        </td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? agg.runs : 0}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? formatPercent(agg.accuracy) : dash}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? formatMs(agg.avgReactionMs) : dash}</td>
        <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-slate-300">{agg ? formatPoints(Math.round(agg.avgScore)) : dash}</td>
        <td className="py-2.5 text-right font-mono tabular-nums text-slate-300">{agg ? formatPoints(agg.bestScore) : dash}</td>
      </tr>
      {isCurrent && (
        <tr className="border-b border-slate-700/60 bg-indigo-500/10">
          <td className="py-2.5 pr-3 pl-7">
            <span className="inline-flex items-center gap-1.5 font-bold text-indigo-200">
              <Zap className="size-3.5" aria-hidden /> This session
            </span>
          </td>
          <td className="py-2.5 pr-3 text-right font-mono text-slate-300">1</td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {formatPercent(session.accuracy)}
            {agg && <Delta value={(session.accuracy - agg.accuracy) * 100} format={(v) => `${Math.round(v)}pp`} />}
          </td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {formatMs(session.avgReactionMs)}
            {agg && <Delta value={session.avgReactionMs - agg.avgReactionMs} format={(v) => `${Math.round(v)}`} invert />}
          </td>
          <td className="py-2.5 pr-3 text-right font-mono tabular-nums text-white">
            {formatPoints(session.totalScore)}
            {agg && <Delta value={session.totalScore - agg.avgScore} format={(v) => formatPoints(Math.round(v))} />}
          </td>
          <td className="py-2.5 text-right font-mono tabular-nums text-white">
            {agg && session.totalScore > agg.bestScore ? (
              <span className="rounded-md bg-yellow-300 px-1.5 py-0.5 text-[11px] font-black text-yellow-950">NEW BEST</span>
            ) : (
              dash
            )}
          </td>
        </tr>
      )}
    </>
  );
}
