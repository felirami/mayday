"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS } from "@/lib/roster";
import { streamSSE } from "@/lib/sse";
import type { AgentId, CommanderReport, StreamEvent, Timing } from "@/lib/types";
import { AgentCard, type AgentCardState } from "./AgentCard";
import { CommanderPanel } from "./CommanderPanel";
import { SpeedRace } from "./SpeedRace";

type AgentMap = Record<AgentId, AgentCardState>;
type Summary = Extract<StreamEvent, { type: "summary" }>;

const AGENT_IDS: AgentId[] = ["vision", "logs", "runbook", "rootcause", "skeptic", "commander"];

function freshAgents(): AgentMap {
  return AGENT_IDS.reduce((acc, id) => {
    acc[id] = { status: "idle", text: "" };
    return acc;
  }, {} as AgentMap);
}

/** Portrait (9:16) auto-running demo reel, tuned for an X / mobile clip. */
export function VerticalDemo({ hasKey, baselineLabel }: { hasKey: boolean; baselineLabel: string }) {
  const [agents, setAgents] = useState<AgentMap>(freshAgents);
  const [report, setReport] = useState<CommanderReport | null>(null);
  const [reportTiming, setReportTiming] = useState<Timing | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [peakTps, setPeakTps] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [raceSignal, setRaceSignal] = useState(0);
  const startRef = useRef(0);
  const commanderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsedMs(Date.now() - startRef.current), 80);
    return () => clearInterval(iv);
  }, [running]);

  const onEvent = useCallback((e: StreamEvent) => {
    if (e.type === "agent_start") setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "running" } }));
    else if (e.type === "agent_delta")
      setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "running", text: a[e.id].text + e.text } }));
    else if (e.type === "agent_done") {
      setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "done", text: a[e.id].text || e.text, timing: e.timing } }));
      setPeakTps((p) => Math.max(p, e.timing.tokensPerSec));
    } else if (e.type === "agent_error")
      setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "error", error: e.message } }));
    else if (e.type === "report") {
      setReport(e.report);
      setReportTiming(e.timing);
    } else if (e.type === "summary") setSummary(e);
  }, []);

  const run = useCallback(async (scenarioId: string) => {
    if (!hasKey) return;
    setAgents(freshAgents());
    setReport(null);
    setSummary(null);
    setPeakTps(0);
    setElapsedMs(0);
    startRef.current = Date.now();
    setRunning(true);
    try {
      await streamSSE<StreamEvent>("/api/incident", { scenarioId }, onEvent);
    } catch {
      /* ignore */
    } finally {
      setRunning(false);
      setElapsedMs(Date.now() - startRef.current);
      setTimeout(() => setRaceSignal((n) => n + 1), 900);
    }
  }, [hasKey, onEvent]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const scenarioId = params.get("scenario") || "db-pool";
    if (params.get("auto") !== "0") void run(scenarioId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (report) commanderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

  const doneCount = AGENT_IDS.filter((id) => agents[id].status === "done").length;
  const heroTps = summary ? Math.round(summary.peakTokensPerSec) : Math.round(peakTps);

  return (
    <div className="mx-auto max-w-[440px] px-3 py-4 flex flex-col gap-3 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--red)] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--red)]" />
          </span>
          <span className="text-base font-bold tracking-tight">MAYDAY</span>
        </div>
        <span className="text-[10px] text-[var(--sub)] mono">
          Gemma 4 31B · <span style={{ color: "#fb7185" }}>Cerebras</span>
        </span>
      </div>

      {/* hero number */}
      <div className="panel py-4 flex items-center justify-around telemetry" style={{ borderColor: "#34d39933" }}>
        <div className="flex flex-col items-center">
          <span className={`text-4xl font-bold tabular-nums ${running || summary ? "glow-num" : ""}`} style={{ color: "#34d399" }}>
            {heroTps ? heroTps.toLocaleString() : "—"}
          </span>
          <span className="text-[9px] text-[var(--sub)] uppercase tracking-wider mt-1">peak tok/s</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color: "#38bdf8" }}>
            {(elapsedMs / 1000).toFixed(2)}s
          </span>
          <span className="text-[9px] text-[var(--sub)] uppercase tracking-wider mt-1">whole swarm</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold tabular-nums" style={{ color: "#fbbf24" }}>
            {doneCount}/6
          </span>
          <span className="text-[9px] text-[var(--sub)] uppercase tracking-wider mt-1">agents</span>
        </div>
      </div>

      <SpeedRace baselineLabel={baselineLabel} triggerStart={raceSignal} />

      <div className="grid grid-cols-2 gap-2">
        {AGENT_IDS.map((id) => (
          <AgentCard key={id} meta={AGENTS[id]} state={agents[id]} compact />
        ))}
      </div>

      <div ref={commanderRef}>
        <CommanderPanel report={report} timing={reportTiming} />
      </div>

      <p className="text-center text-[10px] text-[var(--sub)] mono pb-4">
        6 agents · multimodal · #Gemma4 on @Cerebras
      </p>
    </div>
  );
}
