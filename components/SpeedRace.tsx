"use client";
import { useRef, useState } from "react";
import { streamSSE } from "@/lib/sse";
import { CEREBRAS_LABEL } from "@/lib/raceLabels";
import type { RaceEvent, Timing } from "@/lib/types";

interface Lane {
  label: string;
  text: string;
  ttftMs?: number;
  timing?: Timing;
  done: boolean;
  liveTps: number;
  startedAt: number;
}

export function SpeedRace({ baselineLabel }: { baselineLabel: string }) {
  const [lanes, setLanes] = useState<Record<string, Lane>>({});
  const [running, setRunning] = useState(false);
  const [speedup, setSpeedup] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function reset() {
    setLanes({});
    setSpeedup(null);
  }

  async function start() {
    if (running) return;
    reset();
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const t0 = Date.now();
    try {
      await streamSSE<RaceEvent>(
        "/api/race",
        {},
        (e) => {
          if (e.type === "race_start") {
            const init: Record<string, Lane> = {};
            for (const p of e.providers)
              init[p] = { label: p, text: "", done: false, liveTps: 0, startedAt: t0 };
            setLanes(init);
          } else if (e.type === "race_first_token") {
            setLanes((s) => ({ ...s, [e.provider]: { ...s[e.provider], ttftMs: e.ttftMs } }));
          } else if (e.type === "race_delta") {
            setLanes((s) => {
              const lane = s[e.provider];
              if (!lane) return s;
              const text = lane.text + e.text;
              const secs = Math.max(0.001, (Date.now() - lane.startedAt) / 1000);
              return {
                ...s,
                [e.provider]: { ...lane, text, liveTps: text.length / 4 / secs },
              };
            });
          } else if (e.type === "race_done") {
            setLanes((s) => ({
              ...s,
              [e.provider]: { ...s[e.provider], done: true, timing: e.timing, liveTps: e.timing.tokensPerSec },
            }));
          } else if (e.type === "race_summary") {
            setSpeedup(e.speedup);
          }
        },
        ac.signal
      );
    } catch {
      /* surfaced via lanes staying empty */
    } finally {
      setRunning(false);
    }
  }

  const laneList = Object.values(lanes);
  const cerebras = lanes[CEREBRAS_LABEL];

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">⚡</span>
          <span className="mono text-[13px] font-bold tracking-wider text-[var(--text)]">
            SPEED RACE
          </span>
          <span className="text-[11px] text-[var(--sub)]">
            same prompt · Cerebras vs GPU
          </span>
        </div>
        <div className="flex items-center gap-3">
          {speedup && (
            <span
              className="mono text-sm font-bold px-2.5 py-1 rounded glow-num"
              style={{ color: "#34d399", background: "#34d39915", border: "1px solid #34d39955" }}
            >
              {speedup.toFixed(1)}× faster
            </span>
          )}
          <button
            onClick={start}
            disabled={running}
            className="mono text-[12px] font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
            style={{ background: "#38bdf81a", color: "#7dd3fc", border: "1px solid #38bdf855" }}
          >
            {running ? "racing…" : "run race ▶"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(laneList.length ? laneList : [{ label: CEREBRAS_LABEL }, { label: baselineLabel }]).map(
          (lane) => {
            const l = lanes[lane.label];
            const isCerebras = lane.label === CEREBRAS_LABEL;
            const accent = isCerebras ? "#34d399" : "#8b909c";
            return (
              <div
                key={lane.label}
                className="panel bg-[var(--panel-2)] flex flex-col overflow-hidden"
                style={{ borderColor: isCerebras ? "#34d39944" : undefined }}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)]">
                  <span className="mono text-[12px] font-bold" style={{ color: accent }}>
                    {isCerebras ? "🟢 " : "🐢 "}
                    {lane.label}
                  </span>
                  <span className="mono text-[13px] font-bold tabular-nums" style={{ color: accent }}>
                    {l ? Math.round((l.done ? l.timing?.tokensPerSec ?? 0 : l.liveTps) || 0) : 0} tok/s
                  </span>
                </div>
                <div className="stream-scroll px-3 py-2 text-[11.5px] leading-relaxed h-[150px] overflow-y-auto whitespace-pre-wrap text-[var(--text)] opacity-90">
                  {l?.text || <span className="text-[var(--sub)] italic">idle</span>}
                  {l && !l.done && running && (
                    <span className="blink" style={{ color: accent }}>▋</span>
                  )}
                </div>
                <div className="px-3 py-1.5 border-t border-[var(--border)] mono text-[10px] text-[var(--sub)] flex justify-between">
                  <span>{l?.ttftMs ? `${Math.round(l.ttftMs)}ms to first token` : "—"}</span>
                  <span>{l?.timing ? `${(l.timing.totalMs / 1000).toFixed(2)}s total` : ""}</span>
                </div>
              </div>
            );
          }
        )}
      </div>
      {cerebras?.done && (
        <p className="text-[11px] text-[var(--sub)] mt-2">
          Both ran Gemma-class generation on the same prompt. Cerebras streams faster than you can read.
        </p>
      )}
    </div>
  );
}
