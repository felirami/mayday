// The Operator: after a human approves the commander's remediation, this agent
// uses Gemma 4 tool-calling to APPLY the fix and VERIFY recovery — a real
// agentic loop (propose → approve → execute → verify), closing the incident.
import { cerebras, MODEL } from "./cerebras";
import type { OperatorEvent, Timing } from "./types";

export interface OperatorCtx {
  service: string;
  command: string;
  alertText: string;
  rootCause: string;
}

type Emit = (e: OperatorEvent) => void;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "apply_remediation",
      strict: true,
      description: "Apply an approved remediation command to the production environment.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { command: { type: "string", description: "The exact command to run" } },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_recovery",
      strict: true,
      description: "Check whether a service's key metrics have returned to baseline after a remediation.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { service: { type: "string" } },
        required: ["service"],
      },
    },
  },
];

// Deterministic, plausible tool results (a real deployment would shell out / call
// the k8s + observability APIs here).
function executeTool(name: string, args: Record<string, unknown>): string {
  if (name === "apply_remediation") {
    const cmd = String(args.command ?? "");
    return `$ ${cmd}\nexit 0 — command accepted. Change applied; new state rolling out, readiness probes passing.`;
  }
  if (name === "verify_recovery") {
    const svc = String(args.service ?? "service");
    return `${svc}: key metrics returning to baseline within SLO — latency, error rate, and saturation nominal over the last 60s. No new errors.`;
  }
  return "unknown tool";
}

const SYSTEM = `You are the OPERATOR on an incident-response swarm. The on-call engineer has just APPROVED a remediation. Your job:
1. Call apply_remediation with the approved command.
2. Then call verify_recovery for the affected service.
3. Then write a single short "RESOLVED" paragraph confirming recovery. State the before -> after for the key metrics, inferring the "before" values from the original alert (e.g. "p99 2.4s -> ~120ms, 5xx 6.8% -> baseline"). Be concise and concrete. Do not call any more tools after verifying.`;

export async function runOperator(ctx: OperatorCtx, emit: Emit, signal?: AbortSignal): Promise<void> {
  const client = cerebras();
  const start = Date.now();
  emit({ type: "op_start" });

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Incident alert:\n${ctx.alertText}\n\nAgreed root cause: ${ctx.rootCause}\n\nApproved remediation command: ${ctx.command}\nAffected service: ${ctx.service}\n\nApply the approved command, verify recovery, then give the RESOLVED summary.`,
    },
  ];

  let completionTokens = 0;
  for (let step = 0; step < 5; step++) {
    const resp = (await client.chat.completions.create(
      {
        model: MODEL,
        messages,
        tools: TOOLS,
        parallel_tool_calls: false,
        max_completion_tokens: 600,
        temperature: 0.2,
        reasoning_effort: "none",
      } as never,
      { signal }
    )) as any;

    const msg = resp?.choices?.[0]?.message;
    completionTokens += resp?.usage?.completion_tokens ?? 0;

    if (msg?.tool_calls?.length) {
      messages.push(msg);
      for (const tc of msg.tool_calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          /* ignore */
        }
        const result = executeTool(tc.function.name, args);
        emit({ type: "op_tool", name: tc.function.name, args, result });
        messages.push({ role: "tool", tool_call_id: tc.id, content: result });
      }
      continue;
    }

    const text: string = msg?.content ?? "Incident resolved.";
    const totalMs = Date.now() - start;
    emit({
      type: "op_done",
      text,
      timing: {
        ttftMs: 0,
        totalMs,
        completionTokens: completionTokens || Math.round(text.length / 4),
        promptTokens: 0,
        tokensPerSec: 0,
      },
    });
    return;
  }

  emit({ type: "op_error", message: "operator did not converge" });
}
