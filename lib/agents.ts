// Server-side: agent system prompts. Roster metadata lives in ./roster so the
// client bundle never ships the prompts.
import promptsJson from "./data/agent-prompts.json";
import type { AgentId } from "./types";

export { AGENTS, AGENT_ORDER, STAGE1 } from "./roster";

const prompts = promptsJson as Record<AgentId, string>;

export function systemPrompt(id: AgentId): string {
  return prompts[id] ?? "";
}
