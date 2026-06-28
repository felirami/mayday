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

const SEV: Record<string, string> = { SEV1: "#fb5b6b", SEV2: "#fbbf24", SEV3: "#38bdf8" };
const DOMAIN_LABEL: Record<string, string> = {
  ops: "Ops / SRE",
  soc: "Security / SOC",
  fin: "FinOps / Cost",
};

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
  const [scenarios, setScenarios] = useState<
    { id: string; service: string; domain: string; severity: string }[]
  >([]);
  const [curId, setCurId] = useState("");
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

  const run = useCallback(
    async (scenarioId: string, race = true) => {
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
        if (race) setTimeout(() => setRaceSignal((n) => n + 1), 900);
      }
    },
    [hasKey, onEvent]
  );

  // Bootstrap: single auto-run, or ?loop=1 kiosk that cycles every incident.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let list: typeof scenarios = [];
      try {
        const data = await (await fetch("/api/scenarios")).json();
        list = data.scenarios ?? [];
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setScenarios(list);
      const params = new URLSearchParams(window.location.search);
      if (params.get("auto") === "0") return;
      const loop = params.get("loop") === "1" && list.length > 0;
      if (loop) {
        let i = Math.max(0, list.findIndex((s) => s.id === params.get("scenario")));
        while (!cancelled) {
          const s = list[i % list.length];
          setCurId(s.id);
          window.scrollTo({ top: 0, behavior: "smooth" });
          await run(s.id, false);
          if (cancelled) break;
          await new Promise((r) => setTimeout(r, 2800));
          i++;
        }
      } else {
        const scenarioId = params.get("scenario") || "db-pool";
        setCurId(scenarioId);
        void run(scenarioId, true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (report) commanderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [report]);

  const doneCount = AGENT_IDS.filter((id) => agents[id].status === "done").length;
  const heroTps = summary ? Math.round(summary.peakTokensPerSec) : Math.round(peakTps);
  const cur = scenarios.find((s) => s.id === curId);

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

      {cur && (
        <div className="flex items-center gap-2 text-[11px] mono -mt-1">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: SEV[cur.severity] ?? "#fb5b6b" }} />
          <span className="text-[var(--text)]">▶ {cur.service}</span>
          <span className="text-[var(--sub)]">· {DOMAIN_LABEL[cur.domain] ?? cur.domain}</span>
        </div>
      )}

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
