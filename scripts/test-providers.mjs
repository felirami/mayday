// Benchmarks specific OpenRouter providers for google/gemma-4-31b-it so we can
// pick a fair, representative GPU baseline for the speed race.
// Run: node --env-file=.env.local scripts/test-providers.mjs
import OpenAI from "openai";

const key = process.env.BASELINE_API_KEY;
const client = new OpenAI({ apiKey: key, baseURL: "https://openrouter.ai/api/v1" });
const MODEL = "google/gemma-4-31b-it";
const PROMPT =
  "You are an SRE assistant. Write a concise incident remediation runbook: immediate mitigation, the exact rollback command, how to verify recovery, and one follow-up to prevent recurrence.";

// candidate providers (NVIDIA-GPU clouds; SambaNova excluded — it's an AI-chip, not a GPU)
const PROVIDERS = ["Together", "DeepInfra", "Novita", "WandB", "Venice", "Parasail", "SiliconFlow"];

async function bench(provider) {
  const start = Date.now();
  let firstAt = null,
    text = "",
    completion = 0;
  try {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: PROMPT }],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 400,
      temperature: 0.3,
      provider: { only: [provider], allow_fallbacks: false },
    });
    for await (const c of stream) {
      const dlt = c?.choices?.[0]?.delta?.content ?? "";
      if (dlt && firstAt === null) firstAt = Date.now();
      text += dlt;
      if (c?.usage?.completion_tokens) completion = c.usage.completion_tokens;
    }
    const total = Date.now() - start;
    const ttft = firstAt ? firstAt - start : total;
    const tokens = completion || Math.round(text.length / 4);
    const tps = tokens / Math.max(0.001, (total - ttft) / 1000);
    return { provider, ok: true, tps: Math.round(tps), totalMs: total, ttftMs: ttft, tokens };
  } catch (e) {
    return { provider, ok: false, err: (e?.message || String(e)).slice(0, 80) };
  }
}

console.log("Benchmarking Gemma 4 31B per provider (same prompt, 400 tok)…\n");
const results = [];
for (const p of PROVIDERS) {
  process.stdout.write(`  ${p.padEnd(12)} … `);
  const r = await bench(p);
  results.push(r);
  console.log(r.ok ? `${r.tps} tok/s  (${r.totalMs}ms, ttft ${r.ttftMs}ms, ${r.tokens}tok)` : `✗ ${r.err}`);
}
const ok = results.filter((r) => r.ok).sort((a, b) => a.tps - b.tps);
console.log("\nslowest → fastest (real GPU throughput):");
ok.forEach((r) => console.log(`  ${r.provider.padEnd(12)} ${r.tps} tok/s`));
