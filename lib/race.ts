// Cerebras-vs-GPU speed race. Cerebras (Gemma 4 31B) always runs for real.
// The opponent runs against a real OpenAI-compatible provider when configured
// (BASELINE_* env), otherwise a clearly-labeled representative stream so the
// race is always demoable.
import OpenAI from "openai";
import { cerebras, MODEL } from "./cerebras";
import { CEREBRAS_LABEL } from "./raceLabels";
import type { RaceEvent, Timing } from "./types";

export { CEREBRAS_LABEL };

const RACE_PROMPT =
  "You are an SRE assistant. A production checkout service started throwing HTTP 5xx and its p99 latency spiked to ~2.4s right after a deploy that raised the database connection-pool size. Write a concise incident remediation runbook: the immediate mitigation, the exact rollback command, how to verify recovery, and one follow-up to prevent recurrence.";

const RACE_MAX_TOKENS = 320;

function estimateTokens(text: string): number {
  return Math.max(1, Math.round(text.length / 4));
}

interface BaselineCfg {
  client: OpenAI;
  model: string;
  label: string;
}

function baselineConfig(): BaselineCfg | null {
  const apiKey = process.env.BASELINE_API_KEY;
  const baseURL = process.env.BASELINE_BASE_URL;
  const model = process.env.BASELINE_MODEL;
  if (!apiKey || !baseURL || !model) return null;
  return {
    client: new OpenAI({ apiKey, baseURL }),
    model,
    label: process.env.BASELINE_LABEL ?? "GPU provider",
  };
}

type Emit = (e: RaceEvent) => void;

async function streamReal(
  client: OpenAI,
  model: string,
  label: string,
  emit: Emit,
  signal?: AbortSignal,
  legacyMaxTokens = false
): Promise<Timing> {
  const start = Date.now();
  let firstAt: number | null = null;
  let text = "";
  let completion = 0;

  const params: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: RACE_PROMPT }],
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: RACE_MAX_TOKENS,
    temperature: 0.3,
  };
  // Some OpenAI-compatible GPU providers (e.g. OpenRouter) expect max_tokens;
  // Cerebras rejects it, so only add it for the baseline.
  if (legacyMaxTokens) params.max_tokens = RACE_MAX_TOKENS;

  const stream = (await client.chat.completions.create(params as never, {
    signal,
  })) as unknown as AsyncIterable<any>;

  let cerebrasGenSeconds: number | null = null;
  for await (const chunk of stream) {
    const delta: string = chunk?.choices?.[0]?.delta?.content ?? "";
    if (delta) {
      if (firstAt === null) {
        firstAt = Date.now();
        emit({ type: "race_first_token", provider: label, ttftMs: firstAt - start });
      }
      text += delta;
      emit({ type: "race_delta", provider: label, text: delta });
    }
    if (chunk?.usage?.completion_tokens) completion = chunk.usage.completion_tokens;
    if (chunk?.time_info?.completion_time)
      cerebrasGenSeconds = chunk.time_info.completion_time;
  }

  const totalMs = Date.now() - start;
  const ttftMs = firstAt ? firstAt - start : totalMs;
  const completionTokens = completion || estimateTokens(text);
  const genSeconds = cerebrasGenSeconds ?? Math.max(0.001, (totalMs - ttftMs) / 1000);
  const timing: Timing = {
    ttftMs,
    totalMs,
    completionTokens,
    promptTokens: estimateTokens(RACE_PROMPT),
    tokensPerSec: completionTokens / Math.max(0.001, genSeconds),
  };
  emit({ type: "race_done", provider: label, timing });
  return timing;
}

// Representative GPU stream when no real baseline is configured. Honest + labeled.
const REPRESENTATIVE_TEXT = `Immediate mitigation: the symptoms began at the deploy, so treat the release as the suspect and roll it back rather than tuning live infra.

1. Confirm the change: kubectl rollout history deploy/checkout-service and diff the connection-pool config between the current and previous revision.
2. Roll back: kubectl rollout undo deploy/checkout-service. This is reversible and mutates no data.
3. Verify recovery: watch p99 latency return toward ~120ms and the 5xx rate fall to baseline; confirm the Hikari pool 'active' drops well below 'max' and Postgres stops logging 'too many clients already'.
4. Prevent recurrence: add a CI guard so replicas x maximumPoolSize never exceeds Postgres max_connections, and alert on pool active==max.`;

async function streamRepresentative(
  label: string,
  emit: Emit,
  signal?: AbortSignal
): Promise<Timing> {
  const targetTps = Number(process.env.BASELINE_SIM_TPS ?? 75);
  const words = REPRESENTATIVE_TEXT.split(/(\s+)/);
  const start = Date.now();
  let firstAt: number | null = null;
  // ~1.3 tokens per word; delay per word to approximate target tok/s.
  const perWordMs = (1 / targetTps) * 1.3 * 1000;
  // simulate ~520ms time-to-first-token typical of GPU clouds
  await sleep(520, signal);
  for (const w of words) {
    if (signal?.aborted) break;
    if (firstAt === null) {
      firstAt = Date.now();
      emit({ type: "race_first_token", provider: label, ttftMs: firstAt - start });
    }
    emit({ type: "race_delta", provider: label, text: w });
    await sleep(perWordMs * (w.trim() ? 1 : 0.2), signal);
  }
  const totalMs = Date.now() - start;
  const completionTokens = estimateTokens(REPRESENTATIVE_TEXT);
  const timing: Timing = {
    ttftMs: firstAt ? firstAt - start : 520,
    totalMs,
    completionTokens,
    promptTokens: estimateTokens(RACE_PROMPT),
    tokensPerSec: targetTps,
  };
  emit({ type: "race_done", provider: label, timing });
  return timing;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export function baselineLabel(): string {
  const cfg = baselineConfig();
  if (cfg) return cfg.label;
  return `GPU baseline (~${process.env.BASELINE_SIM_TPS ?? 75} tok/s, representative)`;
}

export async function runRace(emit: Emit, signal?: AbortSignal): Promise<void> {
  const baseline = baselineConfig();
  const oppLabel = baselineLabel();
  emit({ type: "race_start", providers: [CEREBRAS_LABEL, oppLabel] });

  const [cerebrasTiming, baselineTiming] = await Promise.all([
    streamReal(cerebras(), MODEL, CEREBRAS_LABEL, emit, signal).catch((e) => {
      emit({ type: "race_error", provider: CEREBRAS_LABEL, message: (e as Error).message });
      return null;
    }),
    baseline
      ? streamReal(baseline.client, baseline.model, oppLabel, emit, signal, true).catch((e) => {
          emit({ type: "race_error", provider: oppLabel, message: (e as Error).message });
          return null;
        })
      : streamRepresentative(oppLabel, emit, signal),
  ]);

  if (cerebrasTiming && baselineTiming) {
    const speedup = baselineTiming.totalMs / Math.max(1, cerebrasTiming.totalMs);
    emit({
      type: "race_summary",
      speedup,
      cerebrasTps: cerebrasTiming.tokensPerSec,
      baselineTps: baselineTiming.tokensPerSec,
    });
  }
}
