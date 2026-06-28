"use client";
import type { StreamEvent } from "@/lib/types";

type Summary = Extract<StreamEvent, { type: "summary" }>;

export function SpeedHud({
  running,
  liveTps,
  elapsedMs,
  peakTps,
  doneCount,
  totalAgents,
  summary,
}: {
  running: boolean;
  liveTps: number;
  elapsedMs: number;
  peakTps: number;
  doneCount: number;
  totalAgents: number;
  summary: Summary | null;
}) {
  const headlineTps = summary ? Math.round(summary.peakTokensPerSec) : Math.round(peakTps || liveTps);
  const seconds = (elapsedMs / 1000).toFixed(elapsedMs < 10000 ? 2 : 1);

  return (
    <div className="flex items-stretch gap-3 mono">
      <Stat
        label="peak tok/s"
        value={headlineTps ? headlineTps.toLocaleString() : "—"}
        accent="#34d399"
        glow={running || !!summary}
        big
      />
      <Stat label="elapsed" value={`${seconds}s`} accent="#38bdf8" />
      <Stat
        label="agents"
        value={`${doneCount}/${totalAgents}`}
        accent="#fbbf24"
      />
      <Stat
        label="tokens"
        value={summary ? summary.totalCompletionTokens.toLocaleString() : "—"}
        accent="#a78bfa"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  big,
  glow,
}: {
  label: string;
  value: string;
  accent: string;
  big?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className="panel px-3.5 py-2 flex flex-col items-end justify-center min-w-[92px]"
      style={{ borderColor: `${accent}33` }}
    >
      <span
        className={`telemetry tabular-nums leading-none ${big ? "text-3xl" : "text-xl"} font-bold ${
          glow && big ? "glow-num" : ""
        }`}
        style={{ color: accent }}
      >
        {value}
      </span>
      <span className="text-[10px] text-[var(--sub)] uppercase tracking-wider mt-1">
        {label}
      </span>
    </div>
  );
}
