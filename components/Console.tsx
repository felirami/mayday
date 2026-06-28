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
import { RemediationPanel } from "./RemediationPanel";

type AgentMap = Record<AgentId, AgentCardState>;
type Summary = Extract<StreamEvent, { type: "summary" }>;

interface ScenarioSummary {
  id: string;
  domain: string;
  title: string;
  service: string;
  severity: string;
  remediationClass: string;
  imageUrl: string;
}

const AGENT_IDS: AgentId[] = [
  "vision",
  "logs",
  "runbook",
  "rootcause",
  "skeptic",
  "commander",
];

const SEV_COLOR: Record<string, string> = {
  SEV1: "#fb5b6b",
  SEV2: "#fbbf24",
  SEV3: "#38bdf8",
};

const DOMAIN_LABELS: Record<string, string> = {
  ops: "⚙ Ops / SRE",
  soc: "🛡 Security / SOC",
  fin: "💸 FinOps / Cost",
};
const DOMAIN_ORDER = ["ops", "soc", "fin"];

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
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>("ops");

  const [alertText, setAlertText] = useState("");
  const [logs, setLogs] = useState("");
  const [runbook, setRunbook] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setElapsedMs(Date.now() - startRef.current), 80);
    return () => clearInterval(iv);
  }, [running]);

  const loadScenario = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`);
      const s = await res.json();
      setScenarioId(id);
      setAlertText(s.alertText ?? "");
      setLogs(s.logs ?? "");
      setRunbook(s.runbook ?? "");
      setImagePreview(s.imageUrl ?? null);
      setImageBase64(null);
      setImageMime(null);
    } catch {
      /* ignore */
    }
  }, []);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      const mime = result.slice(0, comma).match(/data:(.*);base64/)?.[1] ?? "image/png";
      setImageBase64(result.slice(comma + 1));
      setImageMime(mime);
      setImagePreview(result);
      setScenarioId(null); // now a custom incident
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
          [e.id]: { ...a[e.id], status: "done", text: a[e.id].text || e.text, timing: e.timing },
        }));
        setPeakTps((p) => Math.max(p, e.timing.tokensPerSec));
        break;
      case "agent_error":
        setAgents((a) => ({ ...a, [e.id]: { ...a[e.id], status: "error", error: e.message } }));
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

  const dispatch = useCallback(
    async (bodyOverride?: Record<string, unknown>) => {
      if (!hasKey) return;
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
        (scenarioId && !imageBase64
          ? { scenarioId }
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
    },
    [hasKey, scenarioId, imageBase64, alertText, logs, runbook, imageMime, onEvent]
  );

  const runFullDemo = useCallback(
    async (id?: string) => {
      const sid = id ?? scenarioId ?? scenarios[0]?.id;
      if (!sid) return;
      await loadScenario(sid);
      await dispatch({ scenarioId: sid });
      setTimeout(() => setRaceSignal((n) => n + 1), 1200);
    },
    [scenarioId, scenarios, loadScenario, dispatch]
  );

  // Bootstrap: load the scenario list, select one, honor ?scenario / ?run / ?demo.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scenarios");
        const data = await res.json();
        const list: ScenarioSummary[] = data.scenarios ?? [];
        if (cancelled || !list.length) return;
        setScenarios(list);
        const params = new URLSearchParams(window.location.search);
        const wanted = params.get("scenario");
        const startId = list.find((s) => s.id === wanted)?.id ?? list[0].id;
        const startDomain = list.find((s) => s.id === startId)?.domain;
        if (startDomain) setDomain(startDomain);
        await loadScenario(startId);
        if (params.has("run")) void runFullDemo(startId);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doneCount = AGENT_IDS.filter((id) => agents[id].status === "done").length;
  const liveTps = elapsedMs > 0 ? liveCharsRef.current / 4 / (elapsedMs / 1000) : 0;
  const hasInput = !!scenarioId || !!alertText || !!logs || !!runbook || !!imageBase64;
  const selectedService =
    scenarios.find((s) => s.id === scenarioId)?.service ?? "the affected service";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur-md bg-[var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--red)] opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--red)]" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight leading-none">MAYDAY</h1>
              <p className="text-[11px] text-[var(--sub)] leading-tight mt-0.5">
                AI Incident Commander · <span className="text-[var(--text)]">Gemma 4 31B</span> on{" "}
                <span style={{ color: "#fb7185" }}>Cerebras</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/felirami/mayday/blob/main/docs/EVAL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] font-bold px-2.5 py-2 rounded-lg hidden md:flex items-center gap-1.5"
              style={{ background: "#34d39912", color: "#34d399", border: "1px solid #34d39944" }}
              title="10/10 incidents correctly diagnosed across 3 domains in the accuracy eval · avg ~2.3s"
            >
              ✓ 10/10 verified
            </a>
            <button
              onClick={() => runFullDemo()}
              disabled={running || !hasKey}
              className="mono text-[12px] font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-40 hidden sm:block"
              style={{ background: "#34d39915", color: "#34d399", border: "1px solid #34d39955" }}
              title="Load the selected incident, run the swarm, then the speed race"
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

      <main className="max-w-[1400px] mx-auto px-4 py-5 flex flex-col gap-5">
        {/* Full-width side-by-side speed race — the hero */}
        <SpeedRace baselineLabel={baselineLabel} triggerStart={raceSignal} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <section className="lg:col-span-4 flex flex-col gap-4">
          {!hasKey && (
            <div className="panel p-3 text-[12px]" style={{ borderColor: "#fb5b6b55", background: "#fb5b6b0d" }}>
              <span className="text-[var(--red)] font-semibold">⚠ No API key.</span>{" "}
              <span className="text-[var(--sub)]">
                Set <code className="mono">CEREBRAS_API_KEY</code> and restart.
              </span>
            </div>
          )}

          <div className="panel p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="mono text-[12px] font-bold tracking-wider text-[var(--text)]">
                🚨 INCIDENT INTAKE
              </span>
              <span className="mono text-[10px] text-[var(--sub)]">
                {scenarios.length} real-world incidents
              </span>
            </div>

            {/* Domain toggle */}
            <div className="flex gap-1.5 mb-2">
              {DOMAIN_ORDER.filter((d) => scenarios.some((s) => s.domain === d)).map((d) => {
                const label = DOMAIN_LABELS[d] ?? d;
                const count = scenarios.filter((s) => s.domain === d).length;
                const active = domain === d;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setDomain(d);
                      const first = scenarios.find((s) => s.domain === d);
                      if (first) loadScenario(first.id);
                    }}
                    disabled={running}
                    className="mono text-[11px] px-2.5 py-1 rounded transition-colors disabled:opacity-50"
                    style={{
                      background: active ? "#fb5b6b14" : "var(--panel-2)",
                      color: active ? "#fb7185" : "var(--sub)",
                      border: `1px solid ${active ? "#fb5b6b55" : "var(--border)"}`,
                    }}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Scenario picker */}
            <div className="flex flex-col gap-1.5 mb-3">
              {scenarios.filter((s) => s.domain === domain).map((s) => {
                const active = s.id === scenarioId;
                const sev = SEV_COLOR[s.severity] ?? "#fb5b6b";
                return (
                  <button
                    key={s.id}
                    onClick={() => loadScenario(s.id)}
                    disabled={running}
                    className="text-left panel px-2.5 py-2 flex items-center gap-2.5 transition-colors disabled:opacity-60"
                    style={{
                      background: active ? "#fb5b6b0f" : "var(--panel-2)",
                      borderColor: active ? "#fb5b6b66" : "var(--border)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sev }} />
                    <span className="min-w-0 flex-1">
                      <span className="mono text-[11.5px] text-[var(--text)] truncate block">
                        {s.service}
                      </span>
                      <span className="text-[10px] text-[var(--sub)] truncate block">{s.title}</span>
                    </span>
                    <span className="mono text-[9px] px-1.5 py-0.5 rounded shrink-0" style={{ color: sev, background: `${sev}1a` }}>
                      {s.severity}
                    </span>
                    <span className="mono text-[9px] text-[var(--sub)] shrink-0 hidden xl:block">
                      {s.remediationClass}
                    </span>
                  </button>
                );
              })}
            </div>

            <label className="block mb-3">
              <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">
                Alert dashboard (screenshot)
              </span>
              <div className="mt-1.5 panel bg-[var(--panel-2)] border-dashed overflow-hidden relative h-[110px] flex items-center justify-center cursor-pointer hover:border-[var(--sub)] transition-colors">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="alert dashboard" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[var(--sub)] text-[12px]">drop a Grafana / Datadog screenshot</span>
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
              <textarea value={alertText} onChange={(e) => { setAlertText(e.target.value); setScenarioId(null); }} rows={3} disabled={running} className="intake-ta" />
            </Labeled>
            <Labeled label="Logs">
              <textarea value={logs} onChange={(e) => { setLogs(e.target.value); setScenarioId(null); }} rows={4} disabled={running} className="intake-ta" />
            </Labeled>
            <Labeled label="Runbook">
              <textarea value={runbook} onChange={(e) => { setRunbook(e.target.value); setScenarioId(null); }} rows={3} disabled={running} className="intake-ta" />
            </Labeled>

            <button
              onClick={() => dispatch()}
              disabled={running || !hasKey || !hasInput}
              className="w-full mt-1 py-3 rounded-lg font-bold text-[14px] tracking-wide transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: running ? "#fb5b6b22" : "linear-gradient(180deg,#fb5b6b,#e23a4c)",
                color: running ? "#fb5b6b" : "#fff",
                boxShadow: running ? "none" : "0 6px 24px #fb5b6b33",
              }}
            >
              {running ? "◉ SWARM ENGAGED…" : "🚨 DISPATCH SWARM"}
            </button>
            {fatal && <p className="text-[11px] text-[var(--red)] mt-2 mono">{fatal}</p>}
          </div>

          <div className="panel p-3 text-[11px] text-[var(--sub)] leading-relaxed">
            <span className="text-[var(--text)] font-semibold">How it works:</span> Stage 1 — OPTIC,
            TRACE &amp; ARCHIVE fan out <span style={{ color: "#34d399" }}>in parallel</span>. Stage 2
            — SHERLOCK forms a hypothesis. Stage 3 — DEVIL challenges it. Stage 4 — MAYDAY issues a
            structured, safe decision. All on Gemma 4 31B via Cerebras.
          </div>
        </section>

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
            <AgentCard meta={AGENTS.skeptic} state={agents.skeptic} badge={skepticBadge(agents.skeptic.text)} />
          </StageBlock>

          <StageBlock n={4} title="COMMAND DECISION" hint="structured · safe">
            <CommanderPanel report={report} timing={reportTiming} />
          </StageBlock>

          <StageBlock n={5} title="REMEDIATION" hint="human-in-the-loop · executes &amp; verifies">
            <RemediationPanel report={report} service={selectedService} alertText={alertText} />
          </StageBlock>
        </section>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-4 py-6 text-[11px] text-[var(--sub)] text-center">
        Mayday · built for the Cerebras × Google DeepMind Gemma 4 Hackathon · multimodal · multi-agent
        · speed-native
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
      <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">{label}</span>
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
        <span className="mono text-[12px] font-bold tracking-wider text-[var(--text)]">{title}</span>
        <span className="text-[11px] text-[var(--sub)]">— {hint}</span>
        <span className="flex-1 h-px bg-[var(--border)]" />
      </div>
      {children}
    </div>
  );
}
