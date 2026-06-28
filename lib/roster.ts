// Client-safe agent roster metadata (no system prompts — those stay server-side).
import type { AgentId, AgentMeta } from "./types";

export const AGENTS: Record<AgentId, AgentMeta> = {
  vision: {
    id: "vision",
    codename: "OPTIC",
    emoji: "👁️",
    role: "Vision Analyst",
    blurb: "Reads the alert dashboard",
    accent: "#38bdf8",
    stage: 1,
  },
  logs: {
    id: "logs",
    codename: "TRACE",
    emoji: "📜",
    role: "Log Analyst",
    blurb: "Hunts the smoking gun in logs",
    accent: "#a78bfa",
    stage: 1,
  },
  runbook: {
    id: "runbook",
    codename: "ARCHIVE",
    emoji: "📚",
    role: "Runbook Retriever",
    blurb: "Finds the matching playbook",
    accent: "#34d399",
    stage: 1,
  },
  rootcause: {
    id: "rootcause",
    codename: "SHERLOCK",
    emoji: "🧠",
    role: "Root-Cause Analyst",
    blurb: "Forms the leading hypothesis",
    accent: "#fbbf24",
    stage: 2,
    reasoningEffort: "none",
  },
  skeptic: {
    id: "skeptic",
    codename: "DEVIL",
    emoji: "🛡️",
    role: "Skeptic / Verifier",
    blurb: "Challenges the hypothesis",
    accent: "#f87171",
    stage: 3,
  },
  commander: {
    id: "commander",
    codename: "MAYDAY",
    emoji: "📣",
    role: "Incident Commander",
    blurb: "Issues the final call",
    accent: "#fb7185",
    stage: 4,
  },
};

export const AGENT_ORDER: AgentId[] = [
  "vision",
  "logs",
  "runbook",
  "rootcause",
  "skeptic",
  "commander",
];

/** Stage-1 agents fan out in parallel — the "watch them all fire at once" moment. */
export const STAGE1: AgentId[] = ["vision", "logs", "runbook"];
