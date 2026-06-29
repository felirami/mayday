"use client";
import { AGENTS } from "@/lib/roster";
import type { AgentId, CommanderReport, Timing } from "@/lib/types";
import { AgentCard, type AgentCardState } from "./AgentCard";
import { Markdown } from "./Markdown";

const AGENT_IDS: AgentId[] = ["vision", "logs", "runbook", "rootcause", "skeptic", "commander"];
const STAGE1: AgentId[] = ["vision", "logs", "runbook"];
const SEV_COLOR: Record<string, string> = { SEV1: "#fb5b6b", SEV2: "#fbbf24", SEV3: "#38bdf8" };
const RISK_COLOR: Record<string, string> = { low: "#34d399", medium: "#fbbf24", high: "#fb5b6b" };

export interface LaneState {
  agents: Record<AgentId, AgentCardState>;
  report: CommanderReport | null;
  reportTiming: Timing | null;
  peakTps: number;
  running: boolean;
  startedAt: number;
  doneMs: number | null;
  error: string | null;
}

export function freshLane(): LaneState {
  return {
    agents: Object.fromEntries(
      AGENT_IDS.map((id) => [id, { status: "idle", text: "" }])
    ) as Record<AgentId, AgentCardState>,
    report: null,
    reportTiming: null,
    peakTps: 0,
    running: false,
    startedAt: 0,
    doneMs: null,
    error: null,
  };
}

function skepticBadge(text: string): { label: string; tone: "good" | "warn" | "bad" } | null {
  const up = text.toUpperCase();
  if (up.includes("CHALLENGE")) return { label: "CHALLENGE", tone: "bad" };
  if (up.includes("CONFIRM WITH CAVEAT") || up.includes("CAVEAT")) return { label: "CAVEAT", tone: "warn" };
  if (up.includes("CONFIRM")) return { label: "CONFIRM", tone: "good" };
  return null;
}

function Stage({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="mono text-[9px] font-bold h-4 w-4 rounded grid place-items-center bg-[var(--panel)] border border-[var(--border)] text-[var(--sub)]">
          {n}
        </span>
        <span className="mono text-[10.5px] font-bold tracking-wider text-[var(--sub)]">{title}</span>
        <span className="flex-1 h-px bg-[var(--border)]" />
      </div>
      {children}
    </div>
  );
}

export function ProviderColumn({
  providerKey,
  label,
  sublabel,
  lane,
}: {
  providerKey: "cerebras" | "gpu";
  label: string;
  sublabel: string;
  lane: LaneState;
}) {
  const isCer = providerKey === "cerebras";
  const accent = isCer ? "#34d399" : "#fb7185";
  const elapsed = lane.doneMs ?? (lane.running ? Date.now() - lane.startedAt : 0);
  const doneCount = AGENT_IDS.filter((id) => lane.agents[id].status === "done").length;
  const r = lane.report;
  const sev = r ? SEV_COLOR[r.severity] ?? "#fb5b6b" : "#fb5b6b";

  return (
    <div className="flex flex-col gap-3">
      {/* provider header */}
      <div
        className="panel px-3.5 py-2.5 flex items-center justify-between sticky top-[56px] z-10"
        style={{
          borderColor: `${accent}66`,
          background: isCer ? "#0d1714" : "#170f11",
          boxShadow: lane.doneMs && isCer ? `0 0 22px ${accent}22` : undefined,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl">{isCer ? "🟢" : "🐢"}</span>
          <div className="min-w-0">
            <div className="mono text-[13px] font-bold truncate" style={{ color: accent }}>
              {label}
            </div>
            <div className="text-[10px] text-[var(--sub)]">{sublabel}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 mono text-right">
          <div>
            <div
              className={`text-xl font-bold tabular-nums leading-none ${lane.doneMs && isCer ? "glow-num" : ""}`}
              style={{ color: accent }}
            >
              {(elapsed / 1000).toFixed(elapsed < 10000 ? 2 : 1)}s
            </div>
            <div className="text-[8.5px] text-[var(--sub)] uppercase tracking-wider">elapsed</div>
          </div>
          <div>
            <div className="text-xl font-bold tabular-nums leading-none" style={{ color: "#fbbf24" }}>
              {doneCount}/6
            </div>
            <div className="text-[8.5px] text-[var(--sub)] uppercase tracking-wider">agents</div>
          </div>
          <div>
            <div className={`text-xl font-bold tabular-nums leading-none ${lane.doneMs && isCer ? "glow-num" : ""}`} style={{ color: accent }}>
              {lane.peakTps ? Math.round(lane.peakTps).toLocaleString() : "—"}
            </div>
            <div className="text-[8.5px] text-[var(--sub)] uppercase tracking-wider">tok/s</div>
          </div>
        </div>
      </div>

      <Stage n={1} title="PARALLEL TRIAGE">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {STAGE1.map((id) => (
            <AgentCard key={id} meta={AGENTS[id]} state={lane.agents[id]} compact />
          ))}
        </div>
      </Stage>

      <Stage n={2} title="ROOT-CAUSE">
        <AgentCard meta={AGENTS.rootcause} state={lane.agents.rootcause} compact />
      </Stage>

      <Stage n={3} title="ADVERSARIAL REVIEW">
        <AgentCard
          meta={AGENTS.skeptic}
          state={lane.agents.skeptic}
          compact
          badge={skepticBadge(lane.agents.skeptic.text)}
        />
      </Stage>

      <Stage n={4} title="COMMAND DECISION">
        {r ? (
          <div className="panel p-3 rise" style={{ borderColor: `${sev}55` }}>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="mono text-[11px] font-bold px-1.5 py-0.5 rounded"
                style={{ color: sev, background: `${sev}1a`, border: `1px solid ${sev}55` }}
              >
                {r.severity}
              </span>
              <span className="mono text-[10px] text-[var(--sub)]">
                {lane.reportTiming ? `decided in ${(lane.reportTiming.totalMs / 1000).toFixed(2)}s` : ""}
                {" · "}
                {r.confidence}% conf
              </span>
            </div>
            <div className="text-[13px] font-semibold leading-snug mb-2 text-[var(--text)]">{r.headline}</div>
            <div className="text-[11.5px] text-[var(--sub)] leading-relaxed mb-2">
              <Markdown>{r.rootCause}</Markdown>
            </div>
            <div className="panel bg-black/50 p-2 flex items-center justify-between gap-2" style={{ borderColor: "#34d39933" }}>
              <code className="mono text-[11px] text-[#7ee2b8] break-all leading-relaxed">$ {r.remediation.command}</code>
              <span
                className="mono text-[9px] px-1.5 py-0.5 rounded shrink-0"
                style={{ color: RISK_COLOR[r.remediation.rollbackRisk] ?? "#fbbf24", background: `${RISK_COLOR[r.remediation.rollbackRisk] ?? "#fbbf24"}15` }}
              >
                {r.remediation.rollbackRisk} risk
              </span>
            </div>
          </div>
        ) : (
          <div className="panel p-4 text-center text-[12px]">
            {lane.error ? (
              <span className="text-[var(--red)]">{lane.error}</span>
            ) : lane.running ? (
              <span style={{ color: accent }} className="inline-flex items-center gap-2">
                <span className="blink">◉</span>
                {lane.agents.commander.status === "running"
                  ? `📣 MAYDAY composing the structured decision… ${(elapsed / 1000).toFixed(1)}s${isCer ? "" : " (the big generation — slow on GPU)"}`
                  : `diagnosing… ${doneCount}/6 agents`}
              </span>
            ) : (
              <span className="text-[var(--sub)]">awaiting dispatch</span>
            )}
          </div>
        )}
      </Stage>
    </div>
  );
}
