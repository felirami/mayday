// Provider-aware inference for Gemma 4 31B. The same swarm can run on Cerebras
// or on a GPU provider (OpenRouter) so the UI can race the *real* dispatch.
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

/** A model endpoint the swarm can run on. */
export interface Provider {
  client: OpenAI;
  model: string;
  isCerebras: boolean;
  label: string;
  /** OpenRouter ordered provider pin, comma-separated. */
  providerPin?: string;
}

export function cerebrasProvider(): Provider {
  return { client: cerebras(), model: MODEL, isCerebras: true, label: "Cerebras" };
}

/** The GPU baseline (same Gemma 4 31B model) via an OpenAI-compatible endpoint. */
export function gpuProvider(): Provider | null {
  const apiKey = process.env.BASELINE_API_KEY;
  const baseURL = process.env.BASELINE_BASE_URL;
  const model = process.env.BASELINE_MODEL;
  if (!apiKey || !baseURL || !model) return null;
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model,
    isCerebras: false,
    label: process.env.BASELINE_LABEL ?? "GPU",
    providerPin: process.env.BASELINE_PROVIDER || undefined,
  };
}

/** ~4 chars/token fallback when usage isn't reported. */
function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

function providerRouting(p: Provider): Record<string, unknown> | undefined {
  if (p.isCerebras || !p.providerPin) return undefined;
  return {
    order: p.providerPin.split(",").map((s) => s.trim()).filter(Boolean),
    allow_fallbacks: false,
  };
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
  provider?: Provider;
}

export interface StreamAgentResult {
  text: string;
  timing: Timing;
}

/** Stream a single agent turn on the given provider, capturing TTFT + throughput. */
export async function streamAgent(opts: StreamAgentOpts): Promise<StreamAgentResult> {
  const provider = opts.provider ?? cerebrasProvider();
  const start = Date.now();
  let firstTokenAt: number | null = null;
  let text = "";
  let usageCompletion = 0;
  let usagePrompt = 0;
  let cerebrasGenSeconds: number | null = null;

  const params: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.user },
    ],
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: opts.maxTokens ?? 900,
    temperature: opts.temperature ?? 0.3,
  };
  if (provider.isCerebras) {
    params.reasoning_effort = opts.reasoningEffort ?? "none";
  } else {
    params.max_tokens = opts.maxTokens ?? 900;
    const routing = providerRouting(provider);
    if (routing) params.provider = routing;
  }

  const stream = (await provider.client.chat.completions.create(params as never, {
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
  const genSeconds = cerebrasGenSeconds ?? Math.max(0.001, (totalMs - ttftMs) / 1000);
  const tokensPerSec = completionTokens / Math.max(0.001, genSeconds);

  return {
    text,
    timing: {
      ttftMs,
      totalMs,
      completionTokens,
      promptTokens:
        usagePrompt ||
        estimateTokens(typeof opts.user === "string" ? opts.user : JSON.stringify(opts.user)),
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
        properties: { t: { type: "string" }, event: { type: "string" } },
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

const COMMANDER_JSON_HINT = `\n\nRespond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:\n{"severity":"SEV1|SEV2|SEV3","headline":"...","rootCause":"...","blastRadius":"...","confidence":0-100,"timeline":[{"t":"HH:MM","event":"..."}],"remediation":{"command":"...","rationale":"...","rollbackRisk":"low|medium|high"},"slackUpdate":"..."}`;

function parseJsonLoose(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    /* try harder */
  }
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1]);
    } catch {
      /* continue */
    }
  }
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  throw new Error("could not parse commander JSON");
}

export interface CommanderResult {
  report: CommanderReport;
  timing: Timing;
}

/** The Commander's final structured decision. Strict schema on Cerebras; a
 * prompt-instructed + leniently-parsed JSON on other providers (max compat). */
export async function runCommander(opts: {
  systemPrompt: string;
  user: string;
  signal?: AbortSignal;
  provider?: Provider;
}): Promise<CommanderResult> {
  const provider = opts.provider ?? cerebrasProvider();
  const start = Date.now();

  const params: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: "system", content: opts.systemPrompt },
      {
        role: "user",
        content: provider.isCerebras ? opts.user : opts.user + COMMANDER_JSON_HINT,
      },
    ],
    max_completion_tokens: 900,
    temperature: 0.2,
  };
  if (provider.isCerebras) {
    params.reasoning_effort = "none";
    params.response_format = {
      type: "json_schema",
      json_schema: { name: "incident_report", strict: true, schema: COMMANDER_SCHEMA },
    };
  } else {
    params.max_tokens = 900;
    const routing = providerRouting(provider);
    if (routing) params.provider = routing;
  }

  const resp = (await provider.client.chat.completions.create(params as never, {
    signal: opts.signal,
  })) as any;

  const totalMs = Date.now() - start;
  const content: string = resp?.choices?.[0]?.message?.content ?? "{}";
  const report = parseJsonLoose(content) as CommanderReport;
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
