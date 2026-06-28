// Shared types for Mayday — the multi-agent incident commander.

export type AgentId =
  | "vision"
  | "logs"
  | "runbook"
  | "rootcause"
  | "skeptic"
  | "commander";

export type AgentStage = 1 | 2 | 3 | 4;

export interface AgentMeta {
  id: AgentId;
  codename: string;
  emoji: string;
  role: string;
  blurb: string;
  /** hex accent used across the UI for this agent */
  accent: string;
  stage: AgentStage;
  reasoningEffort?: "none" | "low" | "medium" | "high";
}

export interface IncidentInput {
  alertText?: string;
  logs?: string;
  runbook?: string;
  /** raw base64 (no data: prefix) of the alert dashboard screenshot */
  imageBase64?: string;
  /** e.g. image/png */
  imageMime?: string;
}

export interface Timing {
  ttftMs: number;
  totalMs: number;
  completionTokens: number;
  promptTokens: number;
  /** raw generation throughput — the hero number */
  tokensPerSec: number;
}

export interface TimelineItem {
  t: string;
  event: string;
}

export interface Remediation {
  command: string;
  rationale: string;
  rollbackRisk: "low" | "medium" | "high";
}

export interface CommanderReport {
  severity: "SEV1" | "SEV2" | "SEV3";
  headline: string;
  rootCause: string;
  blastRadius: string;
  /** 0–100 */
  confidence: number;
  timeline: TimelineItem[];
  remediation: Remediation;
  slackUpdate: string;
}

export type StreamEvent =
  | { type: "run_start"; agents: AgentId[] }
  | { type: "agent_start"; id: AgentId }
  | { type: "agent_delta"; id: AgentId; text: string }
  | { type: "agent_done"; id: AgentId; text: string; timing: Timing }
  | { type: "agent_error"; id: AgentId; message: string }
  | { type: "report"; report: CommanderReport; timing: Timing }
  | {
      type: "summary";
      agentCount: number;
      totalCompletionTokens: number;
      wallMs: number;
      aggTokensPerSec: number;
      peakTokensPerSec: number;
    }
  | { type: "done" }
  | { type: "fatal"; message: string };

export type RaceEvent =
  | { type: "race_start"; providers: string[] }
  | { type: "race_first_token"; provider: string; ttftMs: number }
  | { type: "race_delta"; provider: string; text: string }
  | { type: "race_done"; provider: string; timing: Timing }
  | { type: "race_summary"; speedup: number; cerebrasTps: number; baselineTps: number }
  | { type: "race_error"; provider: string; message: string };
