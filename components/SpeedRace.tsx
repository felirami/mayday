"use client";
import { useEffect, useRef, useState } from "react";
import { streamSSE } from "@/lib/sse";
import { CEREBRAS_LABEL } from "@/lib/raceLabels";
import type { RaceEvent, Timing } from "@/lib/types";
import { Markdown } from "./Markdown";

const TARGET_TOKENS = 700;

interface Lane {
  label: string;
  text: string;
  ttftMs?: number;
  timing?: Timing;
  done: boolean;
  liveTps: number;
  startedAt: number;
}

export function SpeedRace({
  baselineLabel,
  triggerStart,
}: {
  baselineLabel: string;
  triggerStart?: number;
}) {
  const [lanes, setLanes] = useState<Record<string, Lane>>({});
  const [running, setRunning] = useState(false);
  const [speedup, setSpeedup] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setTick((t) => t + 1), 60);
    return () => clearInterval(iv);
  }, [running]);

  async function start() {
    if (running) return;
    setLanes({});
    setSpeedup(null);
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
              return { ...s, [e.provider]: { ...lane, text, liveTps: text.length / 4 / secs } };
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
      /* surfaced via empty lanes */
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (triggerStart && triggerStart > 0) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerStart]);

  const laneOrder = [CEREBRAS_LABEL, baselineLabel];
  const laneTps = (l?: Lane) => (l ? (l.done ? l.timing?.tokensPerSec ?? 0 : l.liveTps) : 0);
  const cer = lanes[CEREBRAS_LABEL];
  const gpu = lanes[baselineLabel];
  // live speedup once both lanes are producing tokens — so the number lands fast
  const liveSpeedup =
    speedup ??
    (laneTps(cer) > 0 && laneTps(gpu) > 0 ? laneTps(cer) / laneTps(gpu) : null);
  const started = Object.keys(lanes).length > 0;

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <div>
            <div className="mono text-[14px] font-bold tracking-wider text-[var(--text)]">
              SPEED RACE
            </div>
            <div className="text-[11px] text-[var(--sub)]">
              same model (Gemma 4 31B) · same prompt · running in parallel
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {liveSpeedup && (
            <span
              className={`mono text-base sm:text-lg font-bold px-3 py-1.5 rounded-lg ${speedup ? "glow-num" : ""}`}
              style={{ color: "#34d399", background: "#34d39915", border: "1px solid #34d39955" }}
            >
              {speedup ? "" : "≈ "}
              {liveSpeedup.toFixed(1)}× faster
            </span>
          )}
          <button
            onClick={start}
            disabled={running}
            className="mono text-[13px] font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: "#38bdf81a", color: "#7dd3fc", border: "1px solid #38bdf855" }}
          >
            {running ? "◉ racing…" : started ? "↻ run again" : "run race ▶"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {laneOrder.map((label) => {
          const l = lanes[label];
          const isCerebras = label === CEREBRAS_LABEL;
          const accent = isCerebras ? "#34d399" : "#fb7185";
          const tps = Math.round(laneTps(l));
          const estTokens = l ? l.text.length / 4 : 0;
          const progress = Math.min(100, (estTokens / TARGET_TOKENS) * 100);
          const liveSecs = l ? (Date.now() - l.startedAt) / 1000 : 0;
          const clock = l?.timing ? l.timing.totalMs / 1000 : liveSecs;
          const streaming = l && !l.done && running;

          return (
            <div
              key={label}
              className="panel bg-[var(--panel-2)] flex flex-col overflow-hidden transition-all"
              style={{
                borderColor: isCerebras ? "#34d39955" : "#fb718555",
                boxShadow: l?.done && isCerebras ? "0 0 28px #34d39922" : undefined,
              }}
            >
              {/* lane header */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{isCerebras ? "🟢" : "🐢"}</span>
                  <div className="min-w-0">
                    <div className="mono text-[12.5px] font-bold truncate" style={{ color: accent }}>
                      {label}
                    </div>
                    <div className="text-[10px] text-[var(--sub)]">
                      {isCerebras ? "wafer-scale engine" : "NVIDIA GPU · bf16"}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`mono text-2xl sm:text-3xl font-bold tabular-nums leading-none ${
                      isCerebras && l?.done ? "glow-num" : ""
                    }`}
                    style={{ color: accent }}
                  >
                    {tps.toLocaleString()}
                  </div>
                  <div className="text-[9px] text-[var(--sub)] uppercase tracking-wider">tok/s</div>
                </div>
              </div>

              {/* progress bar */}
              <div className="px-4 pb-2.5">
                <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-150"
                    style={{
                      width: `${progress}%`,
                      background: accent,
                      boxShadow: streaming ? `0 0 10px ${accent}` : undefined,
                    }}
                  />
                </div>
              </div>

              {/* streaming text */}
              <div
                ref={(el) => {
                  scrollRefs.current[label] = el;
                  if (el) el.scrollTop = el.scrollHeight;
                }}
                className="stream-scroll px-4 py-2 text-[11.5px] leading-relaxed h-[180px] overflow-y-auto text-[var(--text)] opacity-90 border-t border-[var(--border)]"
              >
                {l?.text ? (
                  <Markdown>{l.text}</Markdown>
                ) : (
                  <span className="text-[var(--sub)] italic">
                    {running ? "" : "ready — hit run race"}
                  </span>
                )}
                {streaming && <span className="blink" style={{ color: accent }}>▋</span>}
              </div>

              {/* footer */}
              <div className="px-4 py-2 border-t border-[var(--border)] mono text-[10.5px] flex items-center justify-between">
                <span className="text-[var(--sub)]">
                  {l?.ttftMs ? `${Math.round(l.ttftMs)}ms to first token` : "—"}
                </span>
                <span
                  className="tabular-nums font-bold"
                  style={{ color: l?.done ? accent : streaming ? "#fbbf24" : "var(--sub)" }}
                >
                  {l?.done
                    ? `✓ done in ${clock.toFixed(2)}s`
                    : streaming
                      ? `▮ ${clock.toFixed(1)}s — still streaming…`
                      : "idle"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {cer?.done && running && (
        <p className="text-[12px] mt-3 text-center" style={{ color: "#34d399" }}>
          ⚡ Cerebras already finished — the GPU is still streaming. Same model. Same prompt.
        </p>
      )}
    </div>
  );
}
