// Accuracy eval: runs every scenario through the real swarm (/api/incident) and
// grades the commander's diagnosis vs ground truth with a Gemma-4 LLM judge.
// Writes docs/EVAL.md and prints a summary table.
//
// Usage: node --env-file=.env.local scripts/eval.mjs [baseUrl]
//   baseUrl default: http://localhost:3009  (or set EVAL_BASE_URL)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const BASE = process.argv[2] || process.env.EVAL_BASE_URL || "http://localhost:3009";

const key = process.env.CEREBRAS_API_KEY;
if (!key) {
  console.error("✗ CEREBRAS_API_KEY not set. Run: node --env-file=.env.local scripts/eval.mjs");
  process.exit(1);
}
const judge = new OpenAI({ apiKey: key, baseURL: "https://api.cerebras.ai/v1" });

const scenDir = path.join(root, "lib", "data", "scenarios");
const scenarios = fs
  .readdirSync(scenDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(scenDir, f), "utf8")));

async function runSwarm(scenarioId) {
  const res = await fetch(`${BASE}/api/incident`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scenarioId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let report = null;
  let summary = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const d = line.split("\n").find((l) => l.startsWith("data:"));
      if (!d) continue;
      const e = JSON.parse(d.slice(5).trim());
      if (e.type === "report") report = e.report;
      if (e.type === "summary") summary = e;
    }
  }
  return { report, summary };
}

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rootCauseCorrect: { type: "boolean" },
    remediationCorrect: { type: "boolean" },
    note: { type: "string" },
  },
  required: ["rootCauseCorrect", "remediationCorrect", "note"],
};

async function grade(s, report) {
  const prompt = `You are grading an AI incident commander's diagnosis against ground truth. Be strict but fair.

GROUND TRUTH root cause: ${s.groundTruthRootCause}
EXPECTED remediation (class: ${s.remediationClass}): ${s.expectedRemediation}

COMMANDER root cause: ${report.rootCause}
COMMANDER remediation command: ${report.remediation.command}

Decide:
- rootCauseCorrect: does the commander identify essentially the SAME underlying cause (same mechanism), not just similar symptoms?
- remediationCorrect: is the commander's remediation the SAME class of safe action as expected (e.g. a rollback vs disabling a feature flag vs failing over to a backup vs scaling)? A different-but-equally-valid safe action for THIS root cause counts as correct; an action for the wrong root cause does not.
Return JSON.`;
  const r = await judge.chat.completions.create({
    model: "gemma-4-31b",
    messages: [{ role: "user", content: prompt }],
    max_completion_tokens: 300,
    reasoning_effort: "none",
    response_format: { type: "json_schema", json_schema: { name: "grade", strict: true, schema: JUDGE_SCHEMA } },
  });
  return JSON.parse(r.choices[0].message.content);
}

const rows = [];
console.log(`\nEval against ${BASE} — ${scenarios.length} scenarios\n`);
for (const s of scenarios) {
  process.stdout.write(`  running ${s.id} … `);
  try {
    const { report, summary } = await runSwarm(s.id);
    if (!report) {
      console.log("no report ✗");
      rows.push({ id: s.id, service: s.service, ok: false, note: "no report" });
      continue;
    }
    const g = await grade(s, report);
    const ok = g.rootCauseCorrect && g.remediationCorrect;
    rows.push({
      id: s.id,
      service: s.service,
      expSev: s.severity,
      gotSev: report.severity,
      rc: g.rootCauseCorrect,
      rem: g.remediationCorrect,
      ok,
      wallMs: summary?.wallMs ?? 0,
      peakTps: Math.round(summary?.peakTokensPerSec ?? 0),
      cmd: report.remediation.command,
      note: g.note,
    });
    console.log(`${ok ? "✓" : "✗"}  (${(summary?.wallMs ?? 0) / 1000}s, peak ${Math.round(summary?.peakTokensPerSec ?? 0)} tok/s)`);
  } catch (e) {
    console.log("error ✗ " + e.message);
    rows.push({ id: s.id, service: s.service, ok: false, note: e.message });
  }
}

const pass = rows.filter((r) => r.ok).length;
const times = rows.filter((r) => r.wallMs).map((r) => r.wallMs);
const avgS = times.length ? (times.reduce((a, b) => a + b, 0) / times.length / 1000).toFixed(2) : "—";
const peak = Math.max(0, ...rows.map((r) => r.peakTps || 0));

console.log(`\n── ${pass}/${rows.length} correct · avg ${avgS}s/incident · peak ${peak} tok/s ──\n`);

// Write docs/EVAL.md
const lines = [];
lines.push("# Mayday — Accuracy Eval\n");
lines.push(`Every scenario run end-to-end through the live 6-agent swarm on Gemma 4 31B / Cerebras, graded by a Gemma-4 LLM judge against hand-written ground truth.\n`);
lines.push(`**Result: ${pass}/${rows.length} incidents correctly diagnosed · avg ${avgS}s per incident · peak ${peak} tok/s.**\n`);
lines.push("| Incident | Severity (got/exp) | Root cause | Remediation | Time | Peak tok/s |");
lines.push("|---|---|---|---|---|---|");
for (const r of rows) {
  lines.push(
    `| \`${r.id}\` (${r.service}) | ${r.gotSev ?? "—"} / ${r.expSev ?? "—"} | ${r.rc ? "✅" : "❌"} | ${r.rem ? "✅" : "❌"} | ${r.wallMs ? (r.wallMs / 1000).toFixed(2) + "s" : "—"} | ${r.peakTps ?? "—"} |`
  );
}
lines.push("\n### Remediation diversity (proof it's not one trick)\n");
for (const s of scenarios) {
  lines.push(`- **${s.service}** — ${s.remediationClass}: \`${s.expectedRemediation}\``);
}
lines.push(`\n_Generated by \`scripts/eval.mjs\` against ${BASE}._`);
fs.mkdirSync(path.join(root, "docs"), { recursive: true });
fs.writeFileSync(path.join(root, "docs", "EVAL.md"), lines.join("\n"));
console.log("wrote docs/EVAL.md");
process.exit(pass === rows.length ? 0 : 1);
