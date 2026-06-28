// Smoke-tests every Cerebras/Gemma-4 feature Mayday depends on.
// Run: node --env-file=.env.local scripts/test-cerebras.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const key = process.env.CEREBRAS_API_KEY;
if (!key) {
  console.error("✗ CEREBRAS_API_KEY not set. Run with: node --env-file=.env.local scripts/test-cerebras.mjs");
  process.exit(1);
}

const client = new OpenAI({ apiKey: key, baseURL: "https://api.cerebras.ai/v1" });
const MODEL = "gemma-4-31b";
let pass = 0;
let fail = 0;
const ok = (m) => { console.log("  ✓", m); pass++; };
const bad = (m, e) => { console.log("  ✗", m, "→", e?.message ?? e); fail++; };

// 1. Basic chat + time_info
console.log("\n[1] basic chat + time_info");
try {
  const r = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "Reply with exactly: PONG" }],
    max_completion_tokens: 16,
    reasoning_effort: "none",
  });
  console.log("  reply:", JSON.stringify(r.choices[0].message.content));
  ok("chat completion");
  if (r.time_info) { console.log("  time_info:", JSON.stringify(r.time_info)); ok("time_info present"); }
  else bad("time_info missing", "no time_info on response");
  if (r.usage) console.log("  usage:", JSON.stringify(r.usage));
} catch (e) { bad("basic chat", e); }

// 2. Streaming + usage + tok/s
console.log("\n[2] streaming + usage");
try {
  const start = Date.now();
  let first = null, text = "", completion = 0, genTime = null;
  const stream = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "List 5 causes of high DB latency, one line each." }],
    stream: true,
    stream_options: { include_usage: true },
    max_completion_tokens: 300,
    reasoning_effort: "none",
  });
  for await (const c of stream) {
    const d = c.choices?.[0]?.delta?.content ?? "";
    if (d && first === null) first = Date.now() - start;
    text += d;
    if (c.usage?.completion_tokens) completion = c.usage.completion_tokens;
    if (c.time_info?.completion_time) genTime = c.time_info.completion_time;
  }
  const total = Date.now() - start;
  console.log(`  TTFT=${first}ms total=${total}ms tokens=${completion} genTime=${genTime}s tok/s=${genTime ? (completion/genTime).toFixed(0) : "?"}`);
  ok("streaming");
  if (completion > 0) ok("usage.completion_tokens"); else bad("usage", "no completion tokens");
} catch (e) { bad("streaming", e); }

// 3. Multimodal image input (the sample dashboard)
console.log("\n[3] multimodal image (sample dashboard)");
try {
  const imgPath = path.join(root, "public", "sample-incident-dashboard.png");
  const b64 = fs.readFileSync(imgPath).toString("base64");
  const r = await client.chat.completions.create({
    model: MODEL,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: "This is an observability dashboard. In one line, what metric is anomalous and roughly when?" },
        { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } },
      ],
    }],
    max_completion_tokens: 120,
    reasoning_effort: "none",
  });
  console.log("  vision:", JSON.stringify(r.choices[0].message.content));
  ok("image input accepted");
} catch (e) { bad("multimodal image", e); }

// 4. Structured output (strict JSON schema)
console.log("\n[4] structured output (strict schema)");
try {
  const r = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: "Classify incident severity for: checkout 5xx at 7%. Return JSON." }],
    max_completion_tokens: 200,
    reasoning_effort: "none",
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "sev",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            severity: { type: "string", enum: ["SEV1", "SEV2", "SEV3"] },
            reason: { type: "string" },
          },
          required: ["severity", "reason"],
        },
      },
    },
  });
  const parsed = JSON.parse(r.choices[0].message.content);
  console.log("  parsed:", JSON.stringify(parsed));
  ok("structured output parsed");
} catch (e) { bad("structured output", e); }

console.log(`\n── ${pass} passed, ${fail} failed ──`);
process.exit(fail > 0 ? 1 : 0);
