"use client";
import { useEffect, useRef, useState } from "react";
import { streamSSE } from "@/lib/sse";
import type { CommanderReport, OperatorEvent } from "@/lib/types";
import { Markdown } from "./Markdown";

type Status = "idle" | "pending" | "executing" | "resolved" | "rejected";

interface Audit {
  t: string;
  icon: string;
  text: string;
  tone: "good" | "warn" | "neutral";
}

function clock() {
  return new Date().toTimeString().slice(0, 8);
}

const TONE: Record<Audit["tone"], string> = {
  good: "#34d399",
  warn: "#fbbf24",
  neutral: "#8b909c",
};

export function RemediationPanel({
  report,
  service,
  alertText,
}: {
  report: CommanderReport | null;
  service: string;
  alertText: string;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [audit, setAudit] = useState<Audit[]>([]);
  const [resolution, setResolution] = useState("");
  const [resolveMs, setResolveMs] = useState(0);
  const reportRef = useRef<CommanderReport | null>(null);

  useEffect(() => {
    if (report && report !== reportRef.current) {
      reportRef.current = report;
      setStatus("pending");
      setResolution("");
      setResolveMs(0);
      setAudit([
        {
          t: clock(),
          icon: "📣",
          text: `Commander issued decision — ${report.severity}, ${report.confidence}% confidence`,
          tone: "neutral",
        },
      ]);
    }
    if (!report) {
      reportRef.current = null;
      setStatus("idle");
      setAudit([]);
      setResolution("");
    }
  }, [report]);

  if (!report) {
    return (
      <div className="panel p-5 text-[var(--sub)] text-sm flex items-center justify-center">
        After a decision, the on-call engineer approves and the Operator executes the fix here.
      </div>
    );
  }

  async function approve() {
    if (status !== "pending" || !report) return;
    setStatus("executing");
    setAudit((a) => [
      ...a,
      { t: clock(), icon: "👤", text: "Approved by on-call engineer (human-in-the-loop)", tone: "good" },
    ]);
    try {
      await streamSSE<OperatorEvent>(
        "/api/execute",
        {
          service,
          command: report.remediation.command,
          alertText,
          rootCause: report.rootCause,
        },
        (e) => {
          if (e.type === "op_tool") {
            const argStr = Object.values(e.args).join(", ");
            setAudit((a) => [
              ...a,
              { t: clock(), icon: "🔧", text: `${e.name}(${argStr})`, tone: "neutral" },
            ]);
          } else if (e.type === "op_done") {
            setResolution(e.text);
            setResolveMs(e.timing.totalMs);
            setAudit((a) => [
              ...a,
              { t: clock(), icon: "✅", text: "Recovery verified — incident RESOLVED", tone: "good" },
            ]);
            setStatus("resolved");
          } else if (e.type === "op_error") {
            setAudit((a) => [...a, { t: clock(), icon: "⚠", text: "Operator: " + e.message, tone: "warn" }]);
            setStatus("pending");
          }
        }
      );
    } catch (err) {
      setAudit((a) => [...a, { t: clock(), icon: "⚠", text: (err as Error).message, tone: "warn" }]);
      setStatus("pending");
    }
  }

  function reject() {
    if (status !== "pending") return;
    setStatus("rejected");
    setAudit((a) => [
      ...a,
      { t: clock(), icon: "🚫", text: "Rejected — escalated to a human responder", tone: "warn" },
    ]);
  }

  return (
    <div className="panel p-4 rise">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-base">🛠️</span>
          <span className="mono text-[13px] font-bold tracking-wider text-[var(--text)]">
            OPERATOR · GUARDED EXECUTION
          </span>
        </div>
        {status === "resolved" ? (
          <span
            className="mono text-[12px] font-bold px-2.5 py-1 rounded glow-num"
            style={{ color: "#34d399", background: "#34d39915", border: "1px solid #34d39955" }}
          >
            ✓ RESOLVED{resolveMs ? ` · ${(resolveMs / 1000).toFixed(2)}s` : ""}
          </span>
        ) : status === "rejected" ? (
          <span className="mono text-[12px] font-bold px-2.5 py-1 rounded" style={{ color: "#fbbf24", background: "#fbbf2415" }}>
            ESCALATED
          </span>
        ) : (
          <span className="mono text-[11px] text-[var(--sub)]">awaiting human approval</span>
        )}
      </div>

      {status === "pending" && (
        <div className="mb-3">
          <p className="text-[11.5px] text-[var(--sub)] mb-2">
            Mayday never touches production without sign-off. Review the command and approve.
          </p>
          <div className="panel bg-black/50 p-2.5 mb-2.5" style={{ borderColor: "#34d39933" }}>
            <code className="mono text-[12px] text-[#7ee2b8] break-all">$ {report.remediation.command}</code>
          </div>
          <div className="flex gap-2">
            <button
              onClick={approve}
              className="flex-1 py-2.5 rounded-lg font-bold text-[13px] transition-all"
              style={{ background: "linear-gradient(180deg,#34d399,#10a37f)", color: "#06231a", boxShadow: "0 4px 18px #34d39933" }}
            >
              ✓ Approve &amp; Execute
            </button>
            <button
              onClick={reject}
              className="px-4 py-2.5 rounded-lg font-bold text-[13px] transition-colors"
              style={{ background: "var(--panel-2)", color: "var(--sub)", border: "1px solid var(--border)" }}
            >
              Reject
            </button>
          </div>
        </div>
      )}

      {status === "executing" && (
        <div className="mb-3 mono text-[12px]" style={{ color: "#34d399" }}>
          <span className="blink">◉</span> Operator executing via tool calls…
        </div>
      )}

      {/* Audit log */}
      {audit.length > 0 && (
        <div className="panel bg-[var(--panel-2)] p-3 mb-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--sub)] mb-2">
            Audit log
          </div>
          <ol className="space-y-1.5">
            {audit.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]">
                <span className="mono text-[var(--sub)] shrink-0">{e.t}</span>
                <span className="shrink-0">{e.icon}</span>
                <span className="mono text-[11.5px]" style={{ color: TONE[e.tone] }}>
                  {e.text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {resolution && (
        <div className="panel p-3" style={{ borderColor: "#34d39944", background: "#34d3990a" }}>
          <div className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "#34d399" }}>
            ✅ Resolution
          </div>
          <div className="text-[12.5px] leading-relaxed text-[var(--text)]">
            <Markdown>{resolution}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
