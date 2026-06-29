// The Mayday orchestrator: fans the swarm out across 4 stages and emits a
// live event stream the UI renders in real time.
import { AGENTS, STAGE1, systemPrompt } from "./agents";
import {
  runCommander,
  streamAgent,
  type ChatContent,
  type Provider,
} from "./cerebras";
import type { AgentId, IncidentInput, StreamEvent, Timing } from "./types";

type Emit = (e: StreamEvent) => void;

function dataUri(input: IncidentInput): string | null {
  if (!input.imageBase64) return null;
  return `data:${input.imageMime ?? "image/png"};base64,${input.imageBase64}`;
}

function stage1User(id: AgentId, input: IncidentInput): ChatContent {
  const alert = input.alertText?.trim() || "(no alert text provided)";
  if (id === "vision") {
    const text = `Alert summary:\n${alert}\n\nAnalyze the attached incident dashboard screenshot.`;
    const uri = dataUri(input);
    if (uri) {
      // text first, then the image (Cerebras multimodal message format)
      return [
        { type: "text", text },
        { type: "image_url", image_url: { url: uri } },
      ];
    }
    return `${text}\n\n(No screenshot was attached — rely on the alert text and say the dashboard was unavailable.)`;
  }
  if (id === "logs") {
    return `Alert summary:\n${alert}\n\nLog excerpt:\n\`\`\`\n${
      input.logs?.trim() || "(no logs provided)"
    }\n\`\`\``;
  }
  // runbook
  return `Alert summary:\n${alert}\n\nInternal runbook:\n${
    input.runbook?.trim() || "(no runbook provided)"
  }`;
}

export async function runIncident(
  input: IncidentInput,
  emit: Emit,
  signal?: AbortSignal,
  provider?: Provider
): Promise<void> {
  const wallStart = Date.now();
  const timings: Timing[] = [];
  let peakTps = 0;
  const findings: Partial<Record<AgentId, string>> = {};

  const fullOrder: AgentId[] = [
    "vision",
    "logs",
    "runbook",
    "rootcause",
    "skeptic",
    "commander",
  ];
  emit({ type: "run_start", agents: fullOrder });

  // Only run stage-1 agents that have something to work with.
  const stage1: AgentId[] = STAGE1.filter((id) => {
    if (id === "vision") return Boolean(input.imageBase64 || input.alertText);
    if (id === "logs") return Boolean(input.logs);
    if (id === "runbook") return Boolean(input.runbook);
    return false;
  });

  if (stage1.length === 0) {
    emit({ type: "fatal", message: "No incident inputs provided." });
    return;
  }

  async function runStreaming(
    id: AgentId,
    user: ChatContent,
    reasoning?: "none" | "low" | "medium" | "high"
  ) {
    emit({ type: "agent_start", id });
    try {
      const { text, timing } = await streamAgent({
        systemPrompt: systemPrompt(id),
        user,
        reasoningEffort: reasoning,
        onDelta: (t) => emit({ type: "agent_delta", id, text: t }),
        signal,
        provider,
      });
      findings[id] = text;
      timings.push(timing);
      peakTps = Math.max(peakTps, timing.tokensPerSec);
      emit({ type: "agent_done", id, text, timing });
    } catch (e) {
      emit({ type: "agent_error", id, message: (e as Error).message });
      findings[id] = `(agent ${id} failed)`;
    }
  }

  // ── Stage 1: parallel fan-out (the speed-compounding moment) ──
  await Promise.all(
    stage1.map((id) => runStreaming(id, stage1User(id, input), AGENTS[id].reasoningEffort))
  );

  const evidence =
    `Alert:\n${input.alertText ?? "(none)"}\n\n` +
    `=== OPTIC · dashboard read ===\n${findings.vision ?? "n/a"}\n\n` +
    `=== TRACE · log analysis ===\n${findings.logs ?? "n/a"}\n\n` +
    `=== ARCHIVE · runbook match ===\n${findings.runbook ?? "n/a"}`;

  // ── Stage 2: root-cause synthesis ──
  await runStreaming("rootcause", evidence, AGENTS.rootcause.reasoningEffort);

  // ── Stage 3: skeptic challenges the hypothesis ──
  const skepticUser =
    `${evidence}\n\n=== SHERLOCK · leading hypothesis ===\n${findings.rootcause ?? "n/a"}`;
  await runStreaming("skeptic", skepticUser, AGENTS.skeptic.reasoningEffort);

  // ── Stage 4: commander issues the structured decision ──
  emit({ type: "agent_start", id: "commander" });
  try {
    const commanderUser =
      `${skepticUser}\n\n=== DEVIL · verdict ===\n${findings.skeptic ?? "n/a"}\n\n` +
      `Issue the final incident decision as JSON.`;
    const { report, timing } = await runCommander({
      systemPrompt: systemPrompt("commander"),
      user: commanderUser,
      signal,
      provider,
    });
    timings.push(timing);
    peakTps = Math.max(peakTps, timing.tokensPerSec);
    emit({ type: "agent_done", id: "commander", text: report.headline, timing });
    emit({ type: "report", report, timing });
  } catch (e) {
    emit({ type: "agent_error", id: "commander", message: (e as Error).message });
  }

  const wallMs = Date.now() - wallStart;
  const totalCompletionTokens = timings.reduce((s, t) => s + t.completionTokens, 0);
  const aggTokensPerSec = totalCompletionTokens / Math.max(0.001, wallMs / 1000);
  emit({
    type: "summary",
    agentCount: fullOrder.length,
    totalCompletionTokens,
    wallMs,
    aggTokensPerSec,
    peakTokensPerSec: peakTps,
  });
  emit({ type: "done" });
}
