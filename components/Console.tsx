"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { AGENTS } from "@/lib/roster";
import { streamSSE } from "@/lib/sse";
import type {
  AgentId,
  CommanderReport,
  StreamEvent,
  Timing,
} from "@/lib/types";
import { AgentCard, type AgentCardState } from "./AgentCard";
import { SpeedHud } from "./SpeedHud";
import { CommanderPanel } from "./CommanderPanel";
import { SpeedRace } from "./SpeedRace";

type AgentMap = Record<AgentId, AgentCardState>;
type Summary = Extract<StreamEvent, { type: "summary" }>;

const AGENT_IDS: AgentId[] = [
  "vision",
  "logs",
  "runbook",
  "rootcause",
  "skeptic",
  "commander",
];

function freshAgents(): AgentMap {
  return AGENT_IDS.reduce((acc, id) => {
    acc[id] = { status: "idle", text: "" };
    return acc;
  }, {} as AgentMap);
}

function skepticBadge(text: string): { label: string; tone: "good" | "warn" | "bad" } | null {
  const up = text.toUpperCase();
  if (up.includes("CHALLENGE")) return { label: "CHALLENGE", tone: "bad" };
  if (up.includes("CONFIRM WITH CAVEAT") || up.includes("CAVEAT"))
    return { label: "CAVEAT", tone: "warn" };
  if (up.includes("CONFIRM")) return { label: "CONFIRM", tone: "good" };
  return null;
}

export function Console({
  hasKey,
  baselineLabel,
}: {
  hasKey: boolean;
  baselineLabel: string;
}) {
  const [alertText, setAlertText] = useState("");
  const [logs, setLogs] = useState("");
  const [runbook, setRunbook] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [useScenario, setUseScenario] = useState(false);

  const [agents, setAgents] = useState<AgentMap>(freshAgents);
  const [report, setReport] = useState<CommanderReport | null>(null);
  const [reportTiming, setReportTiming] = useState<Timing | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [running, setRunning] = useState(false);
  const [fatal, setFatal] = useState<string | null>(null);
  const [raceSignal, setRaceSignal] = useState(0);

  const [peakTps, setPeakTps] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const liveCharsRef = useRef(0);
  const startRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // live elapsed ticker
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsedMs(Date.now() - startRef.current), 80);
    return () => clearInterval(iv);
  }, [running]);

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/api/scenario");
      const s = await res.json();
      setAlertText(s.alertText ?? "");
      setLogs(s.logs ?? "");
      setRunbook(s.runbook ?? "");
      setImagePreview(s.imageUrl ?? null);
      setImageBase64(null);
      setImageMime(null);
      setUseScenario(true);
    } catch {
      /* ignore */
    }
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const meta = result.slice(0, comma);
      const b64 = result.slice(comma + 1);
      const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
      setImageBase64(b64);
      setImageMime(mime);
      setImagePreview(result);
      setUseScenario(false);
    };
    reader.readAsDataURL(file);
  }

  const onEvent = useCallback((e: StreamEvent) => {
    switch (e.type) {
      case "agent_start":
        setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "running" } }));
        break;
      case "agent_delta":
        liveCharsRef.current += e.text.length;
        setAgents((a) => ({
          ...a,
          [e.id]: { ...a[e.id], status: "running", text: a[e.id].text + e.text },
        }));
        break;
      case "agent_done":
        setAgents((a) => ({
          ...a,
          [e.id]: {
            ...a[e.id],
            status: "done",
            text: a[e.id].text || e.text,
            timing: e.timing,
          },
        }));
        setPeakTps((p) => Math.max(p, e.timing.tokensPerSec));
        break;
      case "agent_error":
        setAgents((a) => ({
          ...a,
          [e.id]: { ...a[e.id], status: "error", error: e.message },
        }));
        break;
      case "report":
        setReport(e.report);
        setReportTiming(e.timing);
        break;
      case "summary":
        setSummary(e);
        break;
      case "fatal":
        setFatal(e.message);
        break;
      default:
        break;
    }
  }, []);

  async function dispatch(bodyOverride?: Record<string, unknown>) {
    if (running || !hasKey) return;
    // reset
    setAgents(freshAgents());
    setReport(null);
    setReportTiming(null);
    setSummary(null);
    setFatal(null);
    setPeakTps(0);
    setElapsedMs(0);
    liveCharsRef.current = 0;
    startRef.current = Date.now();
    setRunning(true);

    const body =
      bodyOverride ??
      (useScenario && !imageBase64
        ? { scenario: true }
        : {
            alertText: alertText || undefined,
            logs: logs || undefined,
            runbook: runbook || undefined,
            imageBase64: imageBase64 || undefined,
            imageMime: imageMime || undefined,
          });

    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await streamSSE<StreamEvent>("/api/incident", body, onEvent, ac.signal);
    } catch (err) {
      setFatal((err as Error).message);
    } finally {
      setRunning(false);
      setElapsedMs(Date.now() - startRef.current);
    }
  }

  // One-click demo: load the sample, run the swarm, then fire the speed race.
  async function runFullDemo() {
    if (running) return;
    await loadSample();
    await dispatch({ scenario: true });
    setTimeout(() => setRaceSignal((n) => n + 1), 1200);
  }

  // URL triggers for clean recording: ?run=1 (full auto) or ?demo=1 (preload).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.has("run")) void runFullDemo();
    else if (p.has("demo")) void loadSample();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = AGENT_IDS.filter((id) => agents[id].status === "done").length;
  const liveTps = elapsedMs > 0 ? liveCharsRef.current / 4 / (elapsedMs / 1000) : 0;
  const hasInput = useScenario || !!alertText || !!logs || !!runbook || !!imageBase64;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--red)] opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--red)]" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">
                MAYDAY
              </h1>
              <p className="text-[11px] text-[var(--sub)] leading-tight mt-0.5">
                AI Incident Commander ·{" "}
                <span className="text-[var(--text)]">Gemma 4 31B</span> on{" "}
                <span style={{ color: "#fb7185" }}>Cerebras</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={runFullDemo}
              disabled={running || !hasKey}
              className="mono text-[12px] font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 hidden sm:block"
              style={{ background: "#34d39915", color: "#34d399", border: "1px solid #34d39955" }}
              title="Load sample, run the swarm, then the speed race"
            >
              ▶ RUN DEMO
            </button>
            <SpeedHud
              running={running}
              liveTps={liveTps}
              elapsedMs={elapsedMs}
              peakTps={peakTps}
              doneCount={doneCount}
              totalAgents={AGENT_IDS.length}
              summary={summary}
            />
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: input + race */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          {!hasKey && (
            <div className="panel p-3 text-[12px]" style={{ borderColor: "#fb5b6b55", background: "#fb5b6b0d" }}>
              <span className="text-[var(--red)] font-semibold">⚠ No API key.</span>{" "}
              <span className="text-[var(--sub)]">
                Set <code className="mono">CEREBRAS_API_KEY</code> in{" "}
                <code className="mono">.env.local</code> and restart.
              </span>
            </div>
          )}

          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="mono text-[12px] font-bold tracking-wider text-[var(--text)]">
                🚨 INCIDENT INTAKE
              </span>
              <button
                onClick={loadSample}
                disabled={running}
                className="mono text-[11px] px-2 py-1 rounded border border-[var(--border)] text-[var(--sub)] hover:text-[var(--text)] hover:border-[var(--sub)] transition-colors disabled:opacity-50"
              >
                load sample ↻
              </button>
            </div>

            {/* dashboard image */}
            <label className="block mb-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">
                Alert dashboard (screenshot)
              </span>
              <div className="mt-1.5 panel bg-[var(--panel-2)] border-dashed overflow-hidden relative h-[120px] flex items-center justify-center cursor-pointer hover:border-[var(--sub)] transition-colors">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imagePreview}
                    alt="alert dashboard"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[var(--sub)] text-[12px]">
                    drop a Grafana / Datadog screenshot, or load the sample
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  disabled={running}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            </label>

            <Labeled label="Alert">
              <textarea
                value={alertText}
                onChange={(e) => {
                  setAlertText(e.target.value);
                }}
                placeholder="[PagerDuty] SEV2 — checkout-service p99 > 2s…"
                rows={3}
                disabled={running}
                className="intake-ta"
              />
            </Labeled>
            <Labeled label="Logs">
              <textarea
                value={logs}
                onChange={(e) => setLogs(e.target.value)}
                placeholder="paste log excerpt…"
                rows={4}
                disabled={running}
                className="intake-ta"
              />
            </Labeled>
            <Labeled label="Runbook">
              <textarea
                value={runbook}
                onChange={(e) => setRunbook(e.target.value)}
                placeholder="paste the on-call runbook…"
                rows={3}
                disabled={running}
                className="intake-ta"
              />
            </Labeled>

            <button
              onClick={() => dispatch()}
              disabled={running || !hasKey || !hasInput}
              className="w-full mt-1 py-3 rounded-lg font-bold text-[14px] tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: running
                  ? "#fb5b6b22"
                  : "linear-gradient(180deg,#fb5b6b,#e23a4c)",
                color: running ? "#fb5b6b" : "#fff",
                boxShadow: running ? "none" : "0 6px 24px #fb5b6b33",
              }}
            >
              {running ? "◉ SWARM ENGAGED…" : "🚨 DISPATCH SWARM"}
            </button>
            {fatal && (
              <p className="text-[11px] text-[var(--red)] mt-2 mono">{fatal}</p>
            )}
          </div>

          <SpeedRace baselineLabel={baselineLabel} triggerStart={raceSignal} />

          <div className="panel p-3 text-[11px] text-[var(--sub)] leading-relaxed">
            <span className="text-[var(--text)] font-semibold">How it works:</span>{" "}
            Stage 1 — OPTIC, TRACE & ARCHIVE fan out{" "}
            <span style={{ color: "#34d399" }}>in parallel</span>. Stage 2 —
            SHERLOCK forms a hypothesis. Stage 3 — DEVIL challenges it. Stage 4 —
            MAYDAY issues a structured, safe decision. All on Gemma 4 31B via
            Cerebras.
          </div>
        </section>

        {/* Right: swarm + decision */}
        <section className="lg:col-span-8 flex flex-col gap-4">
          <StageBlock n={1} title="PARALLEL TRIAGE" hint="3 agents · simultaneously">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AgentCard meta={AGENTS.vision} state={agents.vision} />
              <AgentCard meta={AGENTS.logs} state={agents.logs} />
              <AgentCard meta={AGENTS.runbook} state={agents.runbook} />
            </div>
          </StageBlock>

          <StageBlock n={2} title="ROOT-CAUSE SYNTHESIS" hint="combines all evidence">
            <AgentCard meta={AGENTS.rootcause} state={agents.rootcause} />
          </StageBlock>

          <StageBlock n={3} title="ADVERSARIAL REVIEW" hint="the swarm argues">
            <AgentCard
              meta={AGENTS.skeptic}
              state={agents.skeptic}
              badge={skepticBadge(agents.skeptic.text)}
            />
          </StageBlock>

          <StageBlock n={4} title="COMMAND DECISION" hint="structured · safe">
            <CommanderPanel report={report} timing={reportTiming} />
          </StageBlock>
        </section>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-6 text-[11px] text-[var(--sub)] text-center">
        Mayday · built for the Cerebras × Google DeepMind Gemma 4 Hackathon ·
        multimodal · multi-agent · speed-native
      </footer>

      <style jsx global>{`
        .intake-ta {
          width: 100%;
          margin-top: 4px;
          background: var(--panel-2);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 11.5px;
          line-height: 1.5;
          color: var(--text);
          font-family: var(--font-geist-mono), monospace;
          resize: vertical;
        }
        .intake-ta:focus {
          outline: none;
          border-color: #fb5b6b66;
        }
      `}</style>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function StageBlock({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5 mb-2">
        <span className="mono text-[10px] font-bold h-5 w-5 rounded grid place-items-center bg-[var(--panel)] border border-[var(--border)] text-[var(--sub)]">
          {n}
        </span>
        <span className="mono text-[12px] font-bold tracking-wider text-[var(--text)]">
          {title}
        </span>
        <span className="text-[11px] text-[var(--sub)]">— {hint}</span>
        <span className="flex-1 h-px bg-[var(--border)]" />
      </div>
      {children}
    </div>
  );
}
