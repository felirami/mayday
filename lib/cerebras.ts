// Cerebras Inference client (OpenAI-compatible) for Gemma 4 31B.
// All Mayday agents run through this module.
import OpenAI from "openai";
import type { CommanderReport, Timing } from "./types";

export const MODEL = "gemma-4-31b";
export const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

let _client: OpenAI | null = null;

/** Reused singleton — the SDK warms the TCP connection on construction. */
export function cerebras(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.CEREBRAS_API_KEY ?? "",
      baseURL: CEREBRAS_BASE_URL,
    });
  }
  return _client;
}

export function hasCerebrasKey(): boolean {
  return Boolean(process.env.CEREBRAS_API_KEY);
}

/** ~4 chars/token fallback when usage isn't reported. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface StreamAgentOpts {
  systemPrompt: string;
  user: ChatContent;
  reasoningEffort?: "none" | "low" | "medium" | "high";
  maxTokens?: number;
  temperature?: number;
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export interface StreamAgentResult {
  text: string;
  timing: Timing;
}

/**
 * Stream a single agent turn, capturing TTFT + Cerebras `time_info` so the UI
 * can show the real generation throughput.
 */
export async function streamAgent(
  opts: StreamAgentOpts
): Promise<StreamAgentResult> {
  const client = cerebras();
  const start = Date.now();
  let firstTokenAt: number | null = null;
  let text = "";
  let usageCompletion = 0;
  let usagePrompt = 0;
  let cerebrasGenSeconds: number | null = null;

  const params: Record<string, unknown> = {
    model: MODEL,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.user },
    ],
    stream: true,
    stream_options: { include_usage: true },
    reasoning_effort: opts.reasoningEffort ?? "none",
    max_completion_tokens: opts.maxTokens ?? 900,
    temperature: opts.temperature ?? 0.3,
  };

  const stream = (await client.chat.completions.create(params as never, {
    signal: opts.signal,
  })) as unknown as AsyncIterable<any>;

  for await (const chunk of stream) {
    const delta: string = chunk?.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      if (firstTokenAt === null) firstTokenAt = Date.now();
      text += delta;
      opts.onDelta?.(delta);
    }
    if (chunk?.usage) {
      usageCompletion = chunk.usage.completion_tokens ?? usageCompletion;
      usagePrompt = chunk.usage.prompt_tokens ?? usagePrompt;
    }
    const ti = chunk?.time_info;
    if (ti?.completion_time) cerebrasGenSeconds = ti.completion_time;
  }

  const totalMs = Date.now() - start;
  const ttftMs = firstTokenAt ? firstTokenAt - start : totalMs;
  const completionTokens = usageCompletion || estimateTokens(text);
  const genSeconds =
    cerebrasGenSeconds ?? Math.max(0.001, (totalMs - ttftMs) / 1000);
  const tokensPerSec = completionTokens / Math.max(0.001, genSeconds);

  return {
    text,
    timing: {
      ttftMs,
      totalMs,
      completionTokens,
      promptTokens:
        usagePrompt ||
        estimateTokens(
          typeof opts.user === "string" ? opts.user : JSON.stringify(opts.user)
        ),
      tokensPerSec,
    },
  };
}

// Strict JSON schema for the Incident Commander's final structured decision.
const COMMANDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    severity: { type: "string", enum: ["SEV1", "SEV2", "SEV3"] },
    headline: { type: "string" },
    rootCause: { type: "string" },
    blastRadius: { type: "string" },
    confidence: { type: "integer" },
    timeline: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          t: { type: "string" },
          event: { type: "string" },
        },
        required: ["t", "event"],
      },
    },
    remediation: {
      type: "object",
      additionalProperties: false,
      properties: {
        command: { type: "string" },
        rationale: { type: "string" },
        rollbackRisk: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["command", "rationale", "rollbackRisk"],
    },
    slackUpdate: { type: "string" },
  },
  required: [
    "severity",
    "headline",
    "rootCause",
    "blastRadius",
    "confidence",
    "timeline",
    "remediation",
    "slackUpdate",
  ],
} as const;

export interface CommanderResult {
  report: CommanderReport;
  timing: Timing;
}

/** The Commander uses strict structured outputs for a guaranteed-shape decision. */
export async function runCommander(opts: {
  systemPrompt: string;
  user: string;
  signal?: AbortSignal;
}): Promise<CommanderResult> {
  const client = cerebras();
  const start = Date.now();

  const resp = (await client.chat.completions.create(
    {
      model: MODEL,
      messages: [
        { role: "system", content: opts.systemPrompt },
        { role: "user", content: opts.user },
      ],
      reasoning_effort: "none",
      max_completion_tokens: 1300,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "incident_report",
          strict: true,
          schema: COMMANDER_SCHEMA,
        },
      },
    } as never,
    { signal: opts.signal }
  )) as any;

  const totalMs = Date.now() - start;
  const content: string = resp?.choices?.[0]?.message?.content ?? "{}";
  const report = JSON.parse(content) as CommanderReport;
  const ti = resp?.time_info;
  const usage = resp?.usage;
  const completionTokens = usage?.completion_tokens ?? estimateTokens(content);
  const genSeconds = ti?.completion_time ?? Math.max(0.001, totalMs / 1000);

  return {
    report,
    timing: {
      ttftMs: ti?.prompt_time ? Math.round(ti.prompt_time * 1000) : 0,
      totalMs,
      completionTokens,
      promptTokens: usage?.prompt_tokens ?? 0,
      tokensPerSec: completionTokens / Math.max(0.001, genSeconds),
    },
  };
}
