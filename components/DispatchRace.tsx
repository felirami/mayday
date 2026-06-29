"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS } from "@/lib/roster";
import { streamSSE } from "@/lib/sse";
import type { AgentId, CommanderReport, StreamEvent } from "@/lib/types";
import { Markdown } from "./Markdown";

const AGENT_IDS: AgentId[] = ["vision", "logs", "runbook", "rootcause", "skeptic", "commander"];
type LaneKey = "cerebras" | "gpu";

interface AgentLite {
  status: "idle" | "running" | "done" | "error";
  text: string;
  tps?: number;
}
interface LaneState {
  agents: Record<AgentId, AgentLite>;
  report: CommanderReport | null;
  running: boolean;
  startedAt: number;
  doneMs: number | null;
  current: AgentId | null;
  error: string | null;
}

function freshLane(): LaneState {
  return {
    agents: Object.fromEntries(
      AGENT_IDS.map((id) => [id, { status: "idle", text: "" }])
    ) as Record<AgentId, AgentLite>,
    report: null,
    running: false,
    startedAt: 0,
    doneMs: null,
    current: null,
    error: null,
  };
}

const SEV_COLOR: Record<string, string> = { SEV1: "#fb5b6b", SEV2: "#fbbf24", SEV3: "#38bdf8" };

export function DispatchRace({
  scenarioId,
  hasKey,
  gpuLabel,
  triggerStart,
}: {
  scenarioId: string | null;
  hasKey: boolean;
  gpuLabel: string;
  triggerStart?: number;
}) {
  const [lanes, setLanes] = useState<Record<LaneKey, LaneState>>({
    cerebras: freshLane(),
    gpu: freshLane(),
  });
  const [running, setRunning] = useState(false);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const boxRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setTick((t) => t + 1), 70);
    return () => clearInterval(iv);
  }, [running]);

  const onLaneEvent = useCallback((lane: LaneKey, e: StreamEvent) => {
    setLanes((s) => {
      const L: LaneState = { ...s[lane], agents: { ...s[lane].agents } };
      if (e.type === "agent_start") {
        L.agents[e.id] = { ...L.agents[e.id], status: "running", text: "" };
        L.current = e.id;
      } else if (e.type === "agent_delta") {
        const cur = L.agents[e.id];
        L.agents[e.id] = { ...cur, status: "running", text: cur.text + e.text };
      } else if (e.type === "agent_done") {
        L.agents[e.id] = {
          ...L.agents[e.id],
          status: "done",
          text: L.agents[e.id].text || e.text,
          tps: Math.round(e.timing.tokensPerSec),
        };
      } else if (e.type === "agent_error") {
        L.agents[e.id] = { ...L.agents[e.id], status: "error" };
      } else if (e.type === "report") {
        L.report = e.report;
      } else if (e.type === "fatal") {
        L.error = e.message;
      }
      return { ...s, [lane]: L };
    });
  }, []);

  const run = useCallback(
    async (sid: string) => {
      if (!hasKey || running) return;
      const t0 = Date.now();
      setLanes({
        cerebras: { ...freshLane(), running: true, startedAt: t0 },
        gpu: { ...freshLane(), running: true, startedAt: t0 },
      });
      setRunning(true);
      const ac = new AbortController();
      abortRef.current = ac;

      const runLane = async (lane: LaneKey) => {
        try {
          await streamSSE<StreamEvent>(
            "/api/incident",
            { scenarioId: sid, provider: lane },
            (e) => onLaneEvent(lane, e),
            ac.signal
          );
        } catch (err) {
          setLanes((s) => ({ ...s, [lane]: { ...s[lane], error: (err as Error).message } }));
        } finally {
          setLanes((s) => ({
            ...s,
            [lane]: { ...s[lane], running: false, doneMs: Date.now() - s[lane].startedAt },
          }));
        }
      };

      await Promise.all([runLane("cerebras"), runLane("gpu")]);
      setRunning(false);
    },
    [hasKey, running, onLaneEvent]
  );

  useEffect(() => {
    if (triggerStart && triggerStart > 0 && scenarioId) run(scenarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerStart]);

  const cer = lanes.cerebras;
  const gpu = lanes.gpu;
  const cerElapsed = cer.doneMs ?? (cer.running ? Date.now() - cer.startedAt : 0);
  const gpuElapsed = gpu.doneMs ?? (gpu.running ? Date.now() - gpu.startedAt : 0);
  const speedup = cer.doneMs && gpuElapsed ? gpuElapsed / cer.doneMs : null;

  return (
    <div className="panel p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">⚡</span>
          <div>
            <div className="mono text-[14px] font-bold tracking-wider text-[var(--text)]">
              SAME DISPATCH · CEREBRAS vs GPU
            </div>
            <div className="text-[11px] text-[var(--sub)]">
              the full 6-agent swarm on the same model (Gemma 4 31B) — run in parallel
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {speedup && (
            <span
              className={`mono text-base sm:text-lg font-bold px-3 py-1.5 rounded-lg ${!gpu.running ? "glow-num" : ""}`}
              style={{ color: "#34d399", background: "#34d39915", border: "1px solid #34d39955" }}
            >
              {gpu.running ? "≈ " : ""}
              {speedup.toFixed(1)}× faster
            </span>
          )}
          <button
            onClick={() => scenarioId && run(scenarioId)}
            disabled={running || !hasKey || !scenarioId}
            className="mono text-[13px] font-bold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: "#fb5b6b1a", color: "#fb7185", border: "1px solid #fb5b6b66" }}
          >
            {running ? "◉ dispatching…" : "🚨 dispatch on both ▶"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(["cerebras", "gpu"] as LaneKey[]).map((laneKey) => {
          const L = lanes[laneKey];
          const isCer = laneKey === "cerebras";
          const accent = isCer ? "#34d399" : "#fb7185";
          const label = isCer ? "Cerebras · Gemma 4 31B" : gpuLabel;
          const elapsed = isCer ? cerElapsed : gpuElapsed;
          const doneCount = AGENT_IDS.filter((id) => L.agents[id].status === "done").length;
          const cur = L.current ? L.agents[L.current] : null;

          return (
            <div
              key={laneKey}
              className="panel bg-[var(--panel-2)] flex flex-col overflow-hidden"
              style={{
                borderColor: isCer ? "#34d39955" : "#fb718555",
                boxShadow: L.doneMs && isCer ? "0 0 28px #34d39922" : undefined,
              }}
            >
              {/* lane header */}
              <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{isCer ? "🟢" : "🐢"}</span>
                  <div className="min-w-0">
                    <div className="mono text-[12px] font-bold truncate" style={{ color: accent }}>
                      {label}
                    </div>
                    <div className="text-[10px] text-[var(--sub)]">
                      {isCer ? "wafer-scale engine" : "NVIDIA GPU · bf16"}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`mono text-2xl sm:text-3xl font-bold tabular-nums leading-none ${
                      L.doneMs && isCer ? "glow-num" : ""
                    }`}
                    style={{ color: accent }}
                  >
                    {(elapsed / 1000).toFixed(elapsed < 10000 ? 2 : 1)}s
                  </div>
                  <div className="text-[9px] text-[var(--sub)] uppercase tracking-wider">
                    {doneCount}/6 agents{L.running ? " · running" : L.doneMs ? " · done" : ""}
                  </div>
                </div>
              </div>

              {/* agent strip */}
              <div className="flex gap-1 px-4 pb-2 flex-wrap">
                {AGENT_IDS.map((id) => {
                  const st = L.agents[id].status;
                  const c =
                    st === "done" ? "#34d399" : st === "running" ? accent : st === "error" ? "#fb5b6b" : "#3a3f4b";
                  return (
                    <span
                      key={id}
                      className={`mono text-[9px] font-bold px-1.5 py-0.5 rounded ${st === "running" ? "blink" : ""}`}
                      style={{ color: c, background: `${c}1a`, border: `1px solid ${c}44` }}
                      title={`${AGENTS[id].codename} — ${st}${L.agents[id].tps ? ` · ${L.agents[id].tps} tok/s` : ""}`}
                    >
                      {AGENTS[id].emoji}
                      {L.agents[id].tps ? ` ${L.agents[id].tps}` : ""}
                    </span>
                  );
                })}
              </div>

              {/* live output of the current agent */}
              <div className="px-4 pb-1.5 flex items-center gap-2">
                <span className="mono text-[10px] font-bold" style={{ color: accent }}>
                  {L.current ? `▶ ${AGENTS[L.current].codename}` : L.doneMs ? "✓ complete" : "—"}
                </span>
              </div>
              <div
                ref={(el) => {
                  boxRefs.current[laneKey] = el;
                  if (el) el.scrollTop = el.scrollHeight;
                }}
                className="stream-scroll px-4 py-1.5 text-[11px] leading-relaxed h-[150px] overflow-y-auto text-[var(--text)] opacity-90 border-t border-[var(--border)]"
              >
                {cur?.text ? (
                  <Markdown>{cur.text}</Markdown>
                ) : (
                  <span className="text-[var(--sub)] italic">
                    {L.running ? "" : "ready — dispatch on both"}
                  </span>
                )}
                {L.running && cur && <span className="blink" style={{ color: accent }}>▋</span>}
              </div>

              {/* footer / verdict */}
              <div className="px-4 py-2 border-t border-[var(--border)] mono text-[10.5px]">
                {L.error ? (
                  <span className="text-[var(--red)]">{L.error}</span>
                ) : L.report ? (
                  <span className="flex items-center gap-2">
                    <span
                      className="font-bold px-1.5 py-0.5 rounded"
                      style={{
                        color: SEV_COLOR[L.report.severity] ?? "#fb5b6b",
                        background: `${SEV_COLOR[L.report.severity] ?? "#fb5b6b"}1a`,
                      }}
                    >
                      {L.report.severity}
                    </span>
                    <span className="text-[var(--sub)] truncate">{L.report.headline}</span>
                  </span>
                ) : L.running ? (
                  <span style={{ color: accent }}>
                    {isCer ? "swarm running…" : "swarm running… (GPU is slow — that's the point)"}
                  </span>
                ) : (
                  <span className="text-[var(--sub)]">idle</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {cer.doneMs && gpu.running && (
        <p className="text-[12px] mt-3 text-center" style={{ color: "#34d399" }}>
          ⚡ Cerebras already resolved the whole incident — the GPU is still on agent {AGENT_IDS.filter((id) => gpu.agents[id].status === "done").length + 1} of 6. Same model. Same dispatch.
        </p>
      )}
    </div>
  );
}
