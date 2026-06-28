"use client";
import { useState } from "react";
import type { CommanderReport, Timing } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className="mono text-[10px] px-2 py-1 rounded border border-[var(--border)] text-[var(--sub)] hover:text-[var(--text)] hover:border-[var(--sub)] transition-colors"
    >
      {copied ? "copied ✓" : "copy"}
    </button>
  );
}

const SEV_COLOR: Record<string, string> = {
  SEV1: "#fb5b6b",
  SEV2: "#fbbf24",
  SEV3: "#38bdf8",
};
const RISK_COLOR: Record<string, string> = {
  low: "#34d399",
  medium: "#fbbf24",
  high: "#fb5b6b",
};

export function CommanderPanel({
  report,
  timing,
}: {
  report: CommanderReport | null;
  timing: Timing | null;
}) {
  if (!report) {
    return (
      <div className="panel p-5 h-full flex items-center justify-center text-[var(--sub)] text-sm">
        <span>The Incident Commander&apos;s decision will appear here.</span>
      </div>
    );
  }

  const sev = SEV_COLOR[report.severity] ?? "#fb5b6b";
  const risk = RISK_COLOR[report.remediation.rollbackRisk] ?? "#fbbf24";

  return (
    <div className="panel p-4 rise" style={{ borderColor: `${sev}55`, boxShadow: `0 0 30px ${sev}14` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📣</span>
          <span className="mono text-[13px] font-bold tracking-wider" style={{ color: "#fb7185" }}>
            MAYDAY · FINAL CALL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="mono text-[12px] font-bold px-2 py-1 rounded"
            style={{ color: sev, background: `${sev}1a`, border: `1px solid ${sev}55` }}
          >
            {report.severity}
          </span>
          {timing && (
            <span className="mono text-[10px] text-[var(--sub)]">
              decided in {(timing.totalMs / 1000).toFixed(2)}s
            </span>
          )}
        </div>
      </div>

      <h2 className="text-[17px] font-semibold leading-snug mb-3 text-[var(--text)]">
        {report.headline}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Field label="Root cause" value={report.rootCause} span={2} />
        <div className="panel bg-[var(--panel-2)] p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-[var(--sub)] mb-1.5">
            Confidence
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${report.confidence}%`,
                  background: report.confidence >= 70 ? "#34d399" : report.confidence >= 40 ? "#fbbf24" : "#fb5b6b",
                }}
              />
            </div>
            <span className="mono text-[13px] font-bold" style={{ color: "#34d399" }}>
              {report.confidence}%
            </span>
          </div>
          <div className="text-[11px] text-[var(--sub)] mt-2 leading-snug">
            {report.blastRadius}
          </div>
        </div>
      </div>

      {/* Remediation command */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">
            Recommended remediation
          </span>
          <span
            className="mono text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: risk, background: `${risk}15` }}
          >
            rollback risk: {report.remediation.rollbackRisk}
          </span>
        </div>
        <div className="panel bg-black/50 p-3 flex items-start justify-between gap-3" style={{ borderColor: "#34d39933" }}>
          <code className="mono text-[12.5px] text-[#7ee2b8] break-all leading-relaxed flex-1">
            $ {report.remediation.command}
          </code>
          <CopyButton text={report.remediation.command} />
        </div>
        <p className="text-[11.5px] text-[var(--sub)] mt-1.5 leading-snug">
          {report.remediation.rationale}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Timeline */}
        <div className="panel bg-[var(--panel-2)] p-3">
          <div className="text-[10px] uppercase tracking-wider text-[var(--sub)] mb-2">
            Timeline
          </div>
          <ol className="space-y-1.5">
            {report.timeline.map((item, i) => (
              <li key={i} className="flex gap-2.5 text-[12px]">
                <span className="mono text-[var(--amber)] shrink-0">{item.t}</span>
                <span className="text-[var(--text)] opacity-90">{item.event}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Slack update */}
        <div className="panel bg-[var(--panel-2)] p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider text-[var(--sub)]">
              #incident-checkout · ready to paste
            </span>
            <CopyButton text={report.slackUpdate} />
          </div>
          <div className="text-[12px] leading-relaxed whitespace-pre-wrap text-[var(--text)] opacity-95 max-h-[160px] overflow-y-auto stream-scroll">
            {report.slackUpdate}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: string; span?: number }) {
  return (
    <div className={`panel bg-[var(--panel-2)] p-2.5 ${span === 2 ? "sm:col-span-2" : ""}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--sub)] mb-1.5">{label}</div>
      <div className="text-[12.5px] leading-relaxed text-[var(--text)] opacity-95">{value}</div>
    </div>
  );
}
