# Mayday — The AI Incident Commander

> A swarm of 6 Gemma 4 31B agents on Cerebras that triages a production incident from a dashboard screenshot, raw logs, and a runbook — and emits a safe, ready-to-execute remediation in **seconds**.

Built for the **Cerebras x Google DeepMind "Gemma 4" 24-Hour Hackathon** (June 28–29, 2026).

---

## Inspiration

At 3 AM, a pager goes off. An on-call SRE — half-awake — is staring at three things at once: a Grafana dashboard screenshot somebody dropped in Slack, a wall of raw log lines, and a runbook nobody has opened in six months. The clock is running, and so is the meter: enterprise downtime costs **$5,000–$9,000 per minute**. Every minute spent context-switching between those three artifacts is money on fire and customers churning.

The hard part of incident response isn't *fixing* the problem — it's *understanding* it fast enough to fix it before it gets worse. That understanding is inherently **multimodal** (a chart you read with your eyes, logs you grep, prose you recall) and inherently **collaborative** (you ping the person who knows the database, the person who knows the deploy, the person who'll tell you you're wrong).

We realized that's exactly the shape of a multi-agent system — *if* the agents are fast enough to run like a real war room instead of a slow relay race. That "if" is what Cerebras unlocks. At **~1,000–1,850 tokens/sec** with **~50–170 ms time-to-first-token**, Gemma 4 31B on Cerebras runs **10–25x faster** than typical GPU inference. Fast enough that six specialists can deliberate, challenge each other, and converge on an answer in the time it takes a human to finish reading the first log line.

So we built the on-call engineer we always wished we had: **Mayday**.

---

## What it does

An SRE pastes three things into Mayday:

1. **A dashboard SCREENSHOT** (latency/error-rate graphs — an actual image)
2. **Raw LOGS** (stack traces, error lines, deploy markers)
3. **A RUNBOOK** (free-text operational notes)

A swarm of **six specialized Gemma 4 31B agents** fans out and collaborates to produce, in seconds:

- **Severity** (SEV1–SEV4) and **blast radius** (who/what is affected)
- A **root-cause hypothesis** with a **confidence score**
- An **incident timeline** reconstructed from the evidence
- A **SAFE remediation command** plus an explicit **rollback risk** assessment
- A **ready-to-paste Slack update** for the incident channel

The six agents, each with a single job:

| Agent | Role | What it does |
|---|---|---|
| 👁️ **OPTIC** | Vision Analyst | Reads the dashboard **screenshot** (multimodal) — extracts the spike, the timestamp, the metric, the magnitude |
| 📜 **TRACE** | Log Analyst | Parses raw logs — finds the error signature, the deploy marker, the first failure |
| 📚 **ARCHIVE** | Runbook Retriever | Lightweight RAG over the pasted runbook — surfaces the relevant remediation steps |
| 🧠 **SHERLOCK** | Root-Cause Analyst | Synthesizes OPTIC + TRACE + ARCHIVE into a single causal hypothesis |
| 🛡️ **DEVIL** | Skeptic / Verifier | **Adversarially challenges** the hypothesis before anyone trusts it |
| 📣 **MAYDAY** | Incident Commander | Issues the final **structured-output** decision and the Slack update |

The whole run streams live, token by token, into the UI — including a per-agent **tokens/sec + TTFT meter** and a head-to-head **Cerebras-vs-GPU speed race** so judges can *see* the speed, not just read a number.

### The demo incident

`checkout-service` p99 latency jumps **120 ms → 2.4 s** and 5xx errors hit **6.8%**, right after deploy **v2.31.0**.

Mayday's verdict, in seconds: the deploy raised the Hikari DB connection-pool max from **20 → 100**, which **exhausted Postgres `max_connections` (100)**. Sessions queue, latency explodes, 5xx climbs. The fix:

```
kubectl rollout undo deploy/checkout-service
```

Crucially, **DEVIL catches the plausible-but-wrong answer**. The "obvious" read of a latency spike is "the database is slow" or "scale up the pods." Both are wrong here and would make it worse. DEVIL forces SHERLOCK to reconcile the hypothesis against the connection-count math before MAYDAY is allowed to recommend anything.

---

## How we built it

### Stack

- **Next.js 16** (App Router) + **React 19** + **Tailwind v4**
- **Server-Sent Events** to stream every agent's tokens to the browser in real time
- **OpenAI SDK**, pointed at `https://api.cerebras.ai/v1` (Cerebras is OpenAI-Chat-Completions compatible)
- **Gemma 4 31B** (`gemma-4-31b`) on **Cerebras** for all six agents
- Deployed on **Vercel**

### The orchestration flow

We model the incident response as a 4-stage DAG. The first stage is where Cerebras's speed compounds the hardest — three agents run **at the same time**, not in sequence.

```
            ┌──────────────────────── STAGE 1: PARALLEL FAN-OUT ────────────────────────┐
            │                                                                            │
  INPUT  →  │   👁️ OPTIC (vision)      📜 TRACE (logs)       📚 ARCHIVE (runbook RAG)    │
 (image +   │        │                      │                       │                    │
  logs +    │        └──────────────────────┴───────────────────────┘                    │
  runbook)  └──────────────────────────────────┬─────────────────────────────────────────┘
                                                ▼
                                STAGE 2:  🧠 SHERLOCK  (synthesize → hypothesis)
                                                ▼
                                STAGE 3:  🛡️ DEVIL     (adversarially challenge)
                                                ▼
                                STAGE 4:  📣 MAYDAY    (structured-output decision)
                                                ▼
                                   Severity · Blast radius · Confidence
                                   Timeline · SAFE command · Rollback risk
                                   Ready-to-paste Slack update
```

**Stage 1 — Parallel fan-out.** OPTIC, TRACE, and ARCHIVE are dispatched concurrently with `Promise.all` over three independent Cerebras streams. None of them depends on the others, so there's no reason to wait. On a GPU backend, three sequential 31B calls would be the dominant cost of the whole pipeline; on Cerebras they finish in roughly the wall-clock time of one. This is the single biggest reason Mayday feels instant.

**Stage 2 — Synthesis.** SHERLOCK receives the three structured findings and produces one causal hypothesis. It's a reasoning step, so we turn `reasoning_effort` up.

**Stage 3 — Adversarial challenge.** DEVIL is prompted to actively disprove SHERLOCK. This is the agent we're proudest of — it's the difference between a demo that sounds smart and a system you'd trust to touch production.

**Stage 4 — Command.** MAYDAY emits the final decision as **strict structured output** — guaranteed-valid JSON the UI renders directly, no fragile parsing.

### Exactly how we use Gemma 4 + Cerebras

We didn't just point an SDK at a fast endpoint — every distinctive Gemma 4 / Cerebras feature maps onto a specific piece of the product:

- **Multimodal vision (image in, text out).** OPTIC receives the dashboard as a base64-encoded image part alongside a text instruction in the same Chat Completions message (`content: [{ type: "image_url", ... }, { type: "text", ... }]`). Gemma 4 reads the *actual graph* — the shape of the spike, the axis values, the deploy annotation — instead of relying on a human to transcribe it. This is real multimodal intelligence doing load-bearing work, not a bolt-on.

- **Parallel fan-out for speed.** Stage 1's three concurrent streams are the architectural choice that turns raw token throughput into felt latency. Cerebras's per-request speed is what makes running three 31B models simultaneously *cheap enough to be the default*.

- **Structured outputs (strict JSON schema).** MAYDAY's final decision uses Cerebras's structured-output mode with a strict schema covering `severity`, `blast_radius`, `confidence`, `timeline[]`, `remediation` (`command` + `rollback_risk`), and `slack_update`. The model is constrained to emit schema-valid JSON, so the frontend renders a typed object with zero defensive parsing. Same trick gives OPTIC/TRACE/ARCHIVE clean, mergeable findings for SHERLOCK to consume.

- **`time_info` → live speed meter.** Cerebras returns a per-request `time_info` object (queue / prompt / completion / total time). We surface it directly as a **live tokens/sec and TTFT readout per agent**, and as the data behind the **Cerebras-vs-GPU race**. The speed claim isn't marketing copy — it's measured, on screen, every run.

- **`reasoning_effort` controls.** We tune effort per role to spend compute where it matters: `low` for OPTIC/TRACE/ARCHIVE (extraction tasks — fast, cheap, parallel), `high` for SHERLOCK and DEVIL (the genuine reasoning steps), `medium` for MAYDAY (decisive but bounded). Per-agent effort tuning is how the swarm stays fast *and* careful.

- **Tool calling (designed in).** The agent contracts are written as tool/function calls so that ARCHIVE's "retrieve from runbook" and MAYDAY's "propose command" are clean, typed interfaces — and so the same agents can be wired to **real** tools (PagerDuty, kubectl, Datadog) in production without re-architecting.

---

## The speed story

Incident response is the canonical place where **latency is the product**. The metric that matters is **MTTR** — Mean Time To Resolution — and MTTR is dominated by *time to understand*, the slowest, most human part of the loop.

Do the math on why milliseconds matter:

- Enterprise downtime runs **$5,000–$9,000 per minute**. A SEV1 that drags on for 30 minutes is a **$150k–$270k** event.
- A "fast" GPU-served 31B model emits maybe 50–80 tokens/sec with 1–2 seconds of TTFT. A six-agent, multi-stage deliberation on that backend takes **tens of seconds to minutes** — and that's *if* nothing retries. That's too slow to sit inside a live triage loop, so it becomes a batch tool you check *after* you've already started flailing.
- Cerebras runs Gemma 4 31B at **~1,000–1,850 tokens/sec** with **~50–170 ms TTFT** — **10–25x faster**. The entire six-agent swarm — parallel vision + log + runbook analysis, synthesis, adversarial review, and a structured command — resolves in **seconds**.

That speed difference isn't a nicer number on a benchmark; it's a **category change**. Slow inference makes multi-agent incident response a luxury you can't afford mid-incident. Fast inference makes it the thing you reach for *first*. Cerebras is what moves Mayday from "interesting demo" to "shave real minutes off every SEV1," and every shaved minute is thousands of dollars and a measurable dent in MTTR.

And because DEVIL's adversarial pass is cheap on Cerebras, **speed buys safety**: we can afford a dedicated verifier agent that catches the plausible-but-wrong remediation *before* it reaches a human — something you'd never bolt on if every extra agent cost you 30 seconds.

---

## Challenges we ran into

- **Streaming six agents over one connection.** Multiplexing parallel + sequential agent token streams into a single SSE channel — with per-agent routing, stage transitions, and the live `time_info` meter — took real care so the UI never blocked, dropped tokens, or interleaved the wrong agent's output.
- **Making DEVIL genuinely adversarial.** Early versions of DEVIL just politely agreed with SHERLOCK. We had to prompt it to *assume the hypothesis is wrong and prove it*, then feed its objections back into a reconciliation step — otherwise the verifier was decorative.
- **Structured output vs. streaming UX.** Strict-schema JSON is perfect for correctness but ugly to stream raw. We render MAYDAY's partial JSON progressively into a clean decision card instead of dumping braces on screen.
- **Multimodal prompt shape.** Getting the base64 image + text parts ordered and formatted so Gemma 4 reliably grounded its reading in the *actual* chart (not a hallucinated generic spike) took prompt iteration.
- **Latency budgeting across stages.** With everything this fast, the orchestration overhead (our own `await`s, SSE flushes) became visible. We had to make sure *our* code wasn't the bottleneck the model wasn't.

---

## Accomplishments we're proud of

- A **true multi-agent swarm** — six agents with distinct roles, a real parallel fan-out stage, and an **adversarial verifier** — not a single prompt wearing six hats.
- **Multimodal vision doing load-bearing work**: OPTIC reads an actual dashboard image, and that reading materially changes the diagnosis.
- **End-to-end resolution in seconds**, with the speed *proven live* via the `time_info` meter and the Cerebras-vs-GPU race — judges don't have to take our word for it.
- A **SAFE-by-design** output contract: every remediation ships with a rollback-risk assessment and survives an adversarial review first.
- It nails the demo incident **correctly and for the right reason** — connection-pool exhaustion, not the tempting "DB is slow / scale up" red herring.

---

## What we learned

- **Speed is an architecture enabler, not just a UX nicety.** When inference is 10–25x faster, designs that are absurd on GPUs — six agents, a parallel fan-out, a dedicated skeptic — become the *obvious* design. Cerebras changed what we were willing to build, not just how fast it ran.
- **Adversarial agents earn their keep.** A verifier whose only job is to attack the hypothesis caught failure modes a "confident single agent" sailed right past. Cheap inference is what makes that affordable.
- **Structured outputs are a contract, not a formatter.** Treating MAYDAY's schema as the interface between model and UI eliminated an entire class of parsing bugs and made the frontend trivial.
- **`time_info` is a gift for trust.** Putting real, per-request latency on screen turned "trust me, it's fast" into a live, undeniable demo.
- **Multimodal changes the input surface of ops tooling.** Once an agent can read a screenshot, the friction of "paste the dashboard" drops to near zero — which is exactly how on-call engineers actually share state.

---

## What's next

Mayday is a demo today; the path to production is concrete:

- **Real connectors.** Live integrations with **Grafana/Datadog** (pull metrics + render dashboards directly), **PagerDuty/Opsgenie** (ingest the page, post back to the incident), and **Slack** (post the update for real, in-channel).
- **Vector RAG over runbooks.** Replace ARCHIVE's lightweight in-context retrieval with a proper embedded vector store over an org's entire runbook + postmortem corpus, so it recalls the *one* relevant playbook out of thousands.
- **Human-in-the-loop approval.** MAYDAY proposes; a human approves with one click before any command executes. The remediation is never auto-run — the SRE stays in command.
- **Audit log.** Every agent's input, output, `time_info`, and the final decision persisted immutably — for postmortems, compliance, and continuously improving the agents on real incidents.
- **Tool execution with guardrails.** Wire the already-designed tool-calling contracts to gated, least-privilege `kubectl`/cloud actions behind the approval step.
- **Learning loop.** Feed resolved incidents back as few-shot exemplars so the swarm gets sharper on each team's specific stack.

---

## Track positioning

Mayday is built to compete across all three tracks; here's exactly how it maps to each set of judging criteria.

### Track 1 — Best Multi-Agent + Multimodal Use Case

- **Agent Collaboration** — A real 6-agent swarm with a structured DAG: a **parallel fan-out** (OPTIC + TRACE + ARCHIVE), a synthesizer (SHERLOCK), an **adversarial verifier** (DEVIL) that challenges before anything is trusted, and a commander (MAYDAY). Agents pass typed findings, not vibes.
- **Multimodal Intelligence** — OPTIC reads an **actual dashboard screenshot** with Gemma 4's vision; that reading is load-bearing and directly shapes the diagnosis. Image + text in the same multimodal message.
- **Speed in Action** — Parallel fan-out + ~1,000–1,850 tok/s on Cerebras resolves the whole swarm in **seconds**, proven on screen with a live `time_info` tokens/sec + TTFT meter and a Cerebras-vs-GPU race.
- **Innovation** — An adversarial skeptic agent that catches plausible-but-wrong remediations, plus a SAFE-by-design output (rollback risk + ready-to-paste Slack update). The whole pattern is only viable *because* inference is this fast.

### Track 2 — People's Choice (social impressions)

- **Instantly legible demo** — "paste a screenshot of a fire, get the fix in seconds" is a one-sentence hook anyone in tech feels in their gut.
- **The speed race is shareable** — a live Cerebras-vs-GPU meter racing across the screen is a screenshot/GIF that travels.
- **The DEVIL twist is a story** — "we gave the AI a built-in skeptic that catches its own wrong answers" is a memorable narrative beat.
- **Universal pain point** — every engineer has been the 3 AM on-call. The empathy is built in.

### Track 3 — Best Enterprise Use Case (incident response is an explicitly named target)

- **Business Impact** — Directly attacks **MTTR**, the metric tied to downtime cost. At **$5k–$9k/min**, shaving even a few minutes off each SEV1 is six figures saved per major incident. Clear, quantifiable ROI.
- **Production Readiness** — Designed for the real path: tool-calling contracts ready for PagerDuty/Datadog/kubectl, **human-in-the-loop approval** before any command runs, an **audit log**, and structured outputs that integrate cleanly with existing tooling.
- **Technical Excellence** — Streaming multi-stage orchestration over SSE, strict-schema structured outputs, per-agent `reasoning_effort` tuning, and a clean OpenAI-compatible Cerebras integration on a modern Next.js 16 / React 19 stack.
- **AI Differentiation** — Multimodal + multi-agent + adversarial verification, made *practical* by Cerebras inference speed. This isn't a feature that runs on any LLM at any latency — the architecture only works because Gemma 4 on Cerebras is fast enough to let six agents deliberate inside a live incident.

---

## Proof it works — and that it generalizes

Mayday isn't one cherry-picked demo. It's validated on **7 real-world incidents across 2 domains**, each with its own dashboard, logs, runbook, and hand-written ground truth:

- **Ops / SRE (5):** DB connection-pool exhaustion · Redis cache stampede · a memory-leak OOM storm · a bad feature-flag rollout · a downstream/3rd-party outage.
- **Security / SOC (2):** distributed credential stuffing · data exfiltration via a compromised credential.

The *same* six-agent swarm — no domain-specific agents — handles all seven, and it chooses the **correct class of remediation each time**: rollback, disable-the-feature-flag, fail-over (correctly concluding "it's not us"), and security containment. That diversity is the real test: a system that always says "roll it back" would fail the feature-flag and downstream cases. `scripts/eval.mjs` runs every incident end-to-end through the live swarm and grades the diagnosis with a Gemma-4 LLM judge:

> **7/7 correctly diagnosed · avg ~2.6s per incident · peak ~3,000 tok/s.** (see `docs/EVAL.md`)

This is the platform story: Mayday is a **multimodal diagnostic swarm** — *read the signals → fan out specialists → synthesize → adversarially verify → decide safely* — and incident response is just the flagship. The SOC domain (the same swarm triaging a live breach) is direct evidence it extends to cybersecurity, another Track 3 target.

## Prior art & how Mayday is different

AI-assisted incident response is a validated, high-value space — **Resolve.ai** ($1B valuation, Feb 2026), **incident.io AI SRE**, **Rootly**, **Cleric**, **Neubird**, and the open-source CNCF project **HolmesGPT** all operate here. We see that as proof the problem matters, not a reason to avoid it. The hackathon's own Track 3 names "incident response" as a target enterprise problem.

Mayday is built from scratch and is **not** a fork or reskin of any of these. Against the closest open-source comparable, HolmesGPT:

| | HolmesGPT (closest OSS) | **Mayday** |
|---|---|---|
| Architecture | single agentic loop | **6 specialized agents, parallel fan-out** |
| Multimodal | no vision | **reads the alert dashboard screenshot** (Gemma 4 vision) |
| Verification | none | **adversarial DEVIL agent** challenges the hypothesis |
| Inference | OpenAI / Anthropic / Gemini | **Gemma 4 31B on Cerebras** (~2s, with a live GPU speed race) |
| Input | live telemetry tool-calls | pasted screenshot + logs + runbook (works without integrations) |

Each of those four differences maps directly to this hackathon's thesis — **multimodal + multi-agent + Cerebras speed** — which is exactly why Mayday is a fit for it rather than a generic SRE tool.

---

*Mayday — because when production is on fire, you shouldn't have to wait on your tools.*
