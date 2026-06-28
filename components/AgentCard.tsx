"use client";
import { useEffect, useRef } from "react";
import type { AgentMeta, Timing } from "@/lib/types";
import { Markdown } from "./Markdown";

export interface AgentCardState {
  status: "idle" | "running" | "done" | "error";
  text: string;
  timing?: Timing;
  error?: string;
}

const STATUS_LABEL: Record<AgentCardState["status"], string> = {
  idle: "STANDBY",
  running: "ANALYZING",
  done: "DONE",
  error: "ERROR",
};

export function AgentCard({
  meta,
  state,
  badge,
  compact,
}: {
  meta: AgentMeta;
  state: AgentCardState;
  badge?: { label: string; tone: "good" | "warn" | "bad" } | null;
  compact?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state.text]);

  const accent = meta.accent;
  const running = state.status === "running";
  const done = state.status === "done";
  const error = state.status === "error";

  const dotColor = error
    ? "#fb5b6b"
    : done
      ? "#34d399"
      : running
        ? accent
        : "#3a3f4b";

  return (
    <div
      className={`panel flex flex-col overflow-hidden transition-all duration-300 ${
        running ? "card-running scanbar" : ""
      }`}
      style={
        {
          "--ring": `${accent}55`,
          borderColor: running ? accent : done ? "#27ae8055" : undefined,
          boxShadow: running ? `0 0 24px ${accent}22` : undefined,
        } as React.CSSProperties
      }
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--border)]">
        <span className="text-lg leading-none" aria-hidden>
          {meta.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="mono text-[13px] font-bold tracking-wider"
              style={{ color: accent }}
            >
              {meta.codename}
            </span>
            <span className="text-[11px] text-[var(--sub)] truncate">{meta.role}</span>
          </div>
        </div>
        {badge && (
          <span
            className="mono text-[10px] font-bold px-1.5 py-0.5 rounded"
            style={{
              color:
                badge.tone === "good"
                  ? "#34d399"
                  : badge.tone === "bad"
                    ? "#fb5b6b"
                    : "#fbbf24",
              background:
                badge.tone === "good"
                  ? "#34d39915"
                  : badge.tone === "bad"
                    ? "#fb5b6b15"
                    : "#fbbf2415",
            }}
          >
            {badge.label}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2 w-2 rounded-full ${running ? "blink" : ""}`}
            style={{ background: dotColor, boxShadow: running ? `0 0 8px ${accent}` : undefined }}
          />
          <span className="mono text-[10px] text-[var(--sub)]">
            {STATUS_LABEL[state.status]}
          </span>
        </span>
      </div>

      <div
        ref={scrollRef}
        className={`stream-scroll px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--text)] overflow-y-auto ${
          compact ? "h-[120px]" : "h-[170px]"
        }`}
      >
        {error ? (
          <span className="text-[var(--red)]">{state.error ?? "failed"}</span>
        ) : state.text ? (
          <Markdown className="opacity-95">{state.text}</Markdown>
        ) : (
          <span className="text-[var(--sub)] italic">
            {running ? "" : "awaiting dispatch…"}
          </span>
        )}
        {running && <span className="blink" style={{ color: accent }}>▋</span>}
      </div>

      <div className="px-3 py-1.5 border-t border-[var(--border)] flex items-center justify-between mono text-[10.5px] text-[var(--sub)]">
        <span>{meta.blurb}</span>
        {state.timing ? (
          <span className="flex gap-2.5" style={{ color: accent }}>
            <span title="output tokens/sec">{Math.round(state.timing.tokensPerSec)} tok/s</span>
            <span title="time to first token" className="text-[var(--sub)]">
              {Math.round(state.timing.ttftMs)}ms TTFT
            </span>
          </span>
        ) : (
          <span className="opacity-40">—</span>
        )}
      </div>
    </div>
  );
}
