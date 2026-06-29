"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { streamSSE } from "@/lib/sse";
import type { AgentId, StreamEvent } from "@/lib/types";
import { ProviderColumn, freshLane, type LaneState } from "./ProviderColumn";
import { CommanderPanel } from "./CommanderPanel";
import { RemediationPanel } from "./RemediationPanel";

interface ScenarioSummary {
  id: string;
  domain: string;
  title: string;
  service: string;
  severity: string;
  remediationClass: string;
  imageUrl: string;
}

const AGENT_IDS: AgentId[] = ["vision", "logs", "runbook", "rootcause", "skeptic", "commander"];
const SEV_COLOR: Record<string, string> = { SEV1: "#fb5b6b", SEV2: "#fbbf24", SEV3: "#38bdf8" };
const DOMAIN_LABELS: Record<string, string> = {
  ops: "⚙ Ops / SRE",
  soc: "🛡 Security / SOC",
  fin: "💸 FinOps / Cost",
};
const DOMAIN_ORDER = ["ops", "soc", "fin"];
type LaneKey = "cerebras" | "gpu";

export function Console({ hasKey, baselineLabel }: { hasKey: boolean; baselineLabel: string }) {
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>("ops");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState("");
  const [custom, setCustom] = useState<{ alertText: string; logs: string; runbook: string; imageBase64: string | null; imageMime: string | null } | null>(null);

  const [lanes, setLanes] = useState<Record<LaneKey, LaneState>>({ cerebras: freshLane(), gpu: freshLane() });
  const [running, setRunning] = useState(false);
  const [, setTick] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => setTick((t) => t + 1), 80);
    return () => clearInterval(iv);
  }, [running]);

  const loadScenario = useCallback(async (id: string) => {
    try {
      const s = await (await fetch(`/api/scenarios?id=${encodeURIComponent(id)}`)).json();
      setScenarioId(id);
      setImagePreview(s.imageUrl ?? null);
      setSelectedAlert(s.alertText ?? "");
      setCustom(null);
    } catch {
      /* ignore */
    }
  }, []);

  const onLaneEvent = useCallback((lane: LaneKey, e: StreamEvent) => {
    setLanes((s) => {
      const L: LaneState = { ...s[lane], agents: { ...s[lane].agents } };
      if (e.type === "agent_start") {
        L.agents[e.id] = { ...L.agents[e.id], status: "running" };
      } else if (e.type === "agent_delta") {
        const cur = L.agents[e.id];
        L.agents[e.id] = { ...cur, status: "running", text: cur.text + e.text };
      } else if (e.type === "agent_done") {
        L.agents[e.id] = { ...L.agents[e.id], status: "done", text: L.agents[e.id].text || e.text, timing: e.timing };
        L.peakTps = Math.max(L.peakTps, e.timing.tokensPerSec);
      } else if (e.type === "agent_error") {
        L.agents[e.id] = { ...L.agents[e.id], status: "error", error: e.message };
      } else if (e.type === "report") {
        L.report = e.report;
        L.reportTiming = e.timing;
      } else if (e.type === "fatal") {
        L.error = e.message;
      }
      return { ...s, [lane]: L };
    });
  }, []);

  const dispatch = useCallback(async () => {
    if (!hasKey || running) return;
    const useScenario = scenarioId && !custom?.imageBase64;
    if (!useScenario && !custom) return;
    const t0 = Date.now();
    setLanes({
      cerebras: { ...freshLane(), running: true, startedAt: t0 },
      gpu: { ...freshLane(), running: true, startedAt: t0 },
    });
    setRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    const base = useScenario
      ? { scenarioId }
      : {
          alertText: custom?.alertText || undefined,
          logs: custom?.logs || undefined,
          runbook: custom?.runbook || undefined,
          imageBase64: custom?.imageBase64 || undefined,
          imageMime: custom?.imageMime || undefined,
        };

    const runLane = async (lane: LaneKey) => {
      try {
        await streamSSE<StreamEvent>("/api/incident", { ...base, provider: lane }, (e) => onLaneEvent(lane, e), ac.signal);
      } catch (err) {
        setLanes((s) => ({ ...s, [lane]: { ...s[lane], error: (err as Error).message } }));
      } finally {
        setLanes((s) => ({ ...s, [lane]: { ...s[lane], running: false, doneMs: Date.now() - s[lane].startedAt } }));
      }
    };
    await Promise.all([runLane("cerebras"), runLane("gpu")]);
    setRunning(false);
  }, [hasKey, running, scenarioId, custom, onLaneEvent]);

  const runFullDemo = useCallback(
    async (id?: string) => {
      const sid = id ?? scenarioId ?? scenarios[0]?.id;
      if (!sid) return;
      await loadScenario(sid);
      void dispatch();
    },
    [scenarioId, scenarios, loadScenario, dispatch]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await (await fetch("/api/scenarios")).json();
        const list: ScenarioSummary[] = data.scenarios ?? [];
        if (cancelled || !list.length) return;
        setScenarios(list);
        const params = new URLSearchParams(window.location.search);
        const startId = list.find((s) => s.id === params.get("scenario"))?.id ?? list[0].id;
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

  const cer = lanes.cerebras;
  const gpu = lanes.gpu;
  const gpuElapsed = gpu.doneMs ?? (gpu.running ? Date.now() - gpu.startedAt : 0);
  const speedup = cer.doneMs && gpuElapsed ? gpuElapsed / cer.doneMs : null;
  const presentDomains = DOMAIN_ORDER.filter((d) => scenarios.some((s) => s.domain === d));
  const selected = scenarios.find((s) => s.id === scenarioId);
  const selectedService = selected?.service ?? "the affected service";

  return (
    <div className="min-h-screen">
      {/* header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[var(--bg)]/85 border-b border-[var(--border)]">
        <div className="max-w-[1600px] mx-auto px-4 py-2.5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--red)] opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--red)]" />
            </span>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">MAYDAY</h1>
              <p className="text-[10.5px] text-[var(--sub)] leading-tight mt-0.5">
                AI Incident Commander · <span className="text-[var(--text)]">Gemma 4 31B</span> · Cerebras vs GPU
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            {speedup && (
              <span
                className={`mono text-sm font-bold px-2.5 py-1.5 rounded-lg ${!gpu.running ? "glow-num" : ""}`}
                style={{ color: "#34d399", background: "#34d39915", border: "1px solid #34d39955" }}
              >
                {gpu.running ? "≈ " : ""}
                {speedup.toFixed(1)}× faster
              </span>
            )}
            <a
              href="https://github.com/felirami/mayday/blob/main/docs/EVAL.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mono text-[11px] font-bold px-2.5 py-1.5 rounded-lg hidden lg:flex items-center"
              style={{ background: "#34d39912", color: "#34d399", border: "1px solid #34d39944" }}
              title="10/10 incidents correctly diagnosed across 3 domains · avg ~2.3s"
            >
              ✓ 10/10 verified
            </a>
            <button
              onClick={() => runFullDemo()}
              disabled={running || !hasKey}
              className="mono text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40 hidden sm:block"
              style={{ background: "#34d39915", color: "#34d399", border: "1px solid #34d39955" }}
            >
              ▶ RUN DEMO
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-4 flex flex-col gap-4">
        {/* intake bar */}
        <div className="panel p-3">
          {!hasKey && (
            <div className="text-[12px] mb-2 text-[var(--red)]">
              ⚠ No API key — set <code className="mono">CEREBRAS_API_KEY</code> and restart.
            </div>
          )}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="mono text-[11px] font-bold tracking-wider text-[var(--text)] mr-1">🚨 INCIDENT</span>
            {presentDomains.map((d) => {
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
                  className="mono text-[10.5px] px-2 py-1 rounded transition-colors disabled:opacity-50"
                  style={{
                    background: active ? "#fb5b6b14" : "var(--panel-2)",
                    color: active ? "#fb7185" : "var(--sub)",
                    border: `1px solid ${active ? "#fb5b6b55" : "var(--border)"}`,
                  }}
                >
                  {DOMAIN_LABELS[d] ?? d} ({scenarios.filter((s) => s.domain === d).length})
                </button>
              );
            })}
            <span className="flex-1" />
            <button
              onClick={dispatch}
              disabled={running || !hasKey || !scenarioId}
              className="py-2 px-4 rounded-lg font-bold text-[13px] tracking-wide transition-all disabled:opacity-40"
              style={{
                background: running ? "#fb5b6b22" : "linear-gradient(180deg,#fb5b6b,#e23a4c)",
                color: running ? "#fb5b6b" : "#fff",
                boxShadow: running ? "none" : "0 4px 18px #fb5b6b33",
              }}
            >
              {running ? "◉ DISPATCHING ON BOTH…" : "🚨 DISPATCH ON BOTH"}
            </button>
          </div>
          {/* scenario chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 stream-scroll">
            {scenarios
              .filter((s) => s.domain === domain)
              .map((s) => {
                const active = s.id === scenarioId;
                const sev = SEV_COLOR[s.severity] ?? "#fb5b6b";
                return (
                  <button
                    key={s.id}
                    onClick={() => loadScenario(s.id)}
                    disabled={running}
                    className="panel px-2.5 py-1.5 flex items-center gap-2 shrink-0 transition-colors disabled:opacity-60 text-left"
                    style={{
                      background: active ? "#fb5b6b0f" : "var(--panel-2)",
                      borderColor: active ? "#fb5b6b66" : "var(--border)",
                    }}
                  >
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: sev }} />
                    <span className="mono text-[11px] text-[var(--text)] whitespace-nowrap">{s.service}</span>
                    <span className="mono text-[9px] px-1 py-0.5 rounded shrink-0" style={{ color: sev, background: `${sev}1a` }}>
                      {s.remediationClass}
                    </span>
                  </button>
                );
              })}
            {imagePreview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview} alt="dashboard" className="h-[42px] rounded border border-[var(--border)] shrink-0 ml-1" />
            )}
          </div>
        </div>

        {/* the two-provider side-by-side dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ProviderColumn providerKey="cerebras" label="CEREBRAS · Gemma 4 31B" sublabel="wafer-scale engine" lane={cer} />
          <ProviderColumn providerKey="gpu" label={baselineLabel} sublabel="NVIDIA GPU · bf16" lane={gpu} />
        </div>

        {cer.doneMs && gpu.running && (
          <p className="text-[12px] text-center -mt-1" style={{ color: "#34d399" }}>
            ⚡ Cerebras resolved the whole incident in {(cer.doneMs / 1000).toFixed(2)}s — the GPU is still working. Same model. Same dispatch.
          </p>
        )}

        {/* Cerebras decision detail + human-in-the-loop remediation */}
        {cer.report && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div>
              <div className="mono text-[11px] font-bold tracking-wider text-[var(--sub)] mb-2">
                📋 CEREBRAS DECISION — in full
              </div>
              <CommanderPanel report={cer.report} timing={cer.reportTiming} />
            </div>
            <div>
              <div className="mono text-[11px] font-bold tracking-wider text-[var(--sub)] mb-2">
                🛠️ REMEDIATION — human-in-the-loop
              </div>
              <RemediationPanel report={cer.report} service={selectedService} alertText={selectedAlert} />
            </div>
          </div>
        )}
      </main>

      <footer className="max-w-[1600px] mx-auto px-4 py-6 text-[11px] text-[var(--sub)] text-center">
        Mayday · the same 6-agent dispatch on Gemma 4 31B — Cerebras vs GPU, side by side · multimodal · multi-agent
      </footer>
    </div>
  );
}
