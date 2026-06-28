# Mayday — Demo Video Script

> **Mayday** is an AI Incident Commander: an SRE pastes a dashboard screenshot + raw logs + a runbook, and a swarm of 6 Gemma-4-31B agents on **Cerebras** fans out in parallel to triage the incident and emit a safe remediation — in a few seconds.
>
> Built for the **Cerebras x Google DeepMind "Gemma 4"** 24-hour hackathon (June 28–29, 2026).
>
> **Hard rules for the submission video:** max 60 seconds · must visibly show Cerebras speed · side-by-side vs a GPU provider is recommended · **no API keys / no personal info / no DMs on screen.**

---

## ⭐ The one "wow" line to land

> **"Six AI agents diagnosed a production outage and shipped the fix — in less time than it takes to read the alert. That's Gemma 4 on Cerebras."**

Say it once, clearly, over the MAYDAY decision card (beat E). Everything else in the video exists to set up this line.

---

## 1. The 60-second shot list

Total: **60.0s**. Shoot to a hard 60 — judges stop watching at 0:61. Voiceover (VO) is written to be *spoken in the time given*; if a line runs long, cut words, not seconds.

| Time | On-screen action | On-screen text overlay | Voiceover |
|---|---|---|---|
| **0:00–0:05** | Cold open. Dark screen. A phone lights up with a PagerDuty-style push: `🔴 checkout-service — p99 2.4s · 6.8% 5xx`. Faint 3:00 AM clock in corner. Screen-shake on the buzz. | `3:47 AM` → then `PROD IS DOWN` | "It's 3 AM. Checkout is throwing 5xx's. Revenue is bleeding. And it's *your* page." |
| **0:05–0:09** | Hard cut to the Mayday app. SRE pastes three things fast: a Grafana **screenshot**, a block of **logs**, a **runbook**. Cursor hits a big red **DECLARE INCIDENT** button. | `Paste alert → screenshot · logs · runbook` | "So you paste what you've got — the dashboard, the logs, the runbook — and hit go." |
| **0:09–0:22** | **THE SPEED RACE.** Split screen. LEFT = "GPU provider" lane, a progress bar crawling, tokens dribbling, spinner spinning. RIGHT = "Cerebras" lane. Both start together. Cerebras bar *snaps* to full almost instantly; a live meter spikes. GPU lane is barely 15% done. Freeze with a big multiplier stamp. | LEFT: `GPU · 38 tok/s` · RIGHT: `CEREBRAS · 1,840 tok/s` · TTFT `92 ms` · slams in: **`~20× FASTER`** | "Here's the thing nobody tells you. On a normal GPU, you're *waiting* — staring at a spinner mid-outage. On Cerebras: eighteen hundred tokens a second. Done before the GPU even warms up." |
| **0:22–0:34** | **THE SWARM.** Cut to the war-room view. Three agent cards fire **at the same time**, text streaming live into all three: 👁️ **OPTIC** reading the screenshot ("pool saturation, deploy v2.31.0"), 📜 **TRACE** parsing logs ("`HikariPool timeout`, connections=100"), 📚 **ARCHIVE** pulling the runbook ("DB pool / Postgres limits"). Three tokens/sec meters all running hot. | `STAGE 1 · PARALLEL` · `OPTIC 👁️  TRACE 📜  ARCHIVE 📚` · `3 agents · live` | "Then six specialized Gemma 4 agents swarm it. Vision reads the chart. One agent parses the logs, another pulls the runbook — all *at once*, all streaming, because at this speed parallel is free." |
| **0:34–0:42** | **THE CONSENSUS BEAT.** 🧠 **SHERLOCK** card slides up: *"Root cause: connection pool exhaustion."* Then 🛡️ **DEVIL** card cuts in red, challenging: *"Wait — could it be a slow query, not the pool?"* Quick back-and-forth; DEVIL's check resolves, both cards turn green and lock together with a satisfying snap. | `SHERLOCK 🧠 hypothesis` → `DEVIL 🛡️ challenges…` → `✓ CONSENSUS` | "Sherlock forms the hypothesis. Then the Devil's-advocate agent *attacks* it — rules out the alternatives — and only then do they agree. Adversarial, not just confident." |
| **0:42–0:54** | **THE DECISION.** 📣 **MAYDAY** commander card snaps to full screen, structured: **SEV-2** badge · a 4-line timeline · **Root cause:** deploy v2.31.0 raised Hikari pool max 20→100, exhausting Postgres `max_connections=100` · a copy-able **safe rollback command** · a ready-to-paste **Slack update**. Cursor clicks **Copy command**, then **Copy Slack update**. | `MAYDAY 📣 · SEV-2` · code chip: `kubectl rollout undo deploy/checkout-service` · `✓ Slack update ready` | "And the commander decides. Severity, timeline, root cause — the deploy quadrupled the DB pool and blew past Postgres's connection limit. One safe rollback command. One Slack update, ready to paste. *(the wow line)* Six agents diagnosed a production outage and shipped the fix — in less time than it takes to read the alert." |
| **0:54–0:60** | Closing tag. Mayday logo center. Cerebras + Gemma wordmarks. URL. | **`Mayday`** · `AI Incident Commander` · `built on @Cerebras + @googlegemma Gemma 4` · `#Gemma4` | "Mayday. Built on Cerebras and Google's Gemma 4. Incidents, solved at the speed of inference." |

**Pacing notes**
- The single most important 13 seconds is **0:09–0:22** (the race). If anything is allowed extra polish/time, it's this. The speed has to be *felt*, not read.
- Keep VO under ~2.6 words/second. The 0:42–0:54 block is dense — if the wow line gets rushed, steal a second from the closing tag (it can play under music).
- Never show a loading state longer than it takes to say one short clause. Cerebras is the product; dead air kills it.

---

## 2. The 30-second alternate cut (for X / attention-span)

Punchier, race-first, no cold-open slow burn. Designed to autoplay muted with captions and still land.

| Time | On-screen action | Text overlay | VO (optional — works muted) |
|---|---|---|---|
| **0:00–0:03** | Straight into the alert + paste. No 3 AM build-up. | `Prod outage. Paste the alert.` | "Production's down. Watch this." |
| **0:03–0:12** | **The race, immediately.** GPU lane crawling vs Cerebras lane done. Big multiplier stamp. | `GPU 38 tok/s` vs `CEREBRAS 1,840 tok/s` → **`~20× FASTER`** | "GPU's still spinning. Cerebras already finished — 1,800 tokens a second." |
| **0:12–0:20** | Swarm + consensus, fast montage: OPTIC/TRACE/ARCHIVE streaming, then SHERLOCK vs DEVIL snapping to ✓ CONSENSUS. | `6 Gemma 4 agents · in parallel` · `agents disagree → consensus` | "Six Gemma 4 agents swarm it in parallel — and argue until they agree." |
| **0:20–0:27** | MAYDAY card: SEV-2, root cause one-liner, copy the rollback command + Slack update. | `kubectl rollout undo deploy/checkout-service` · `Slack update ready ✓` | "Root cause, safe rollback, Slack update — done. *Six agents fixed the outage faster than you can read the alert.*" |
| **0:27–0:30** | Logo + tags. | `Mayday · @Cerebras + @googlegemma Gemma 4 · #Gemma4` | "Mayday. Speed-of-inference incident response." |

**X post copy (paste-ready):**
> 3 AM page. checkout-service throwing 5xx. We built **Mayday** — 6 Gemma 4 agents on @Cerebras that swarm an outage, argue to consensus, and ship a safe rollback in seconds. GPU was still spinning. ~20× faster. #Gemma4 🚨

---

## 3. Recording checklist

**Tools**
- **Screen recorder:** macOS — [Screen Studio] (auto smooth zooms + cursor highlight; best for the swarm/race) or QuickTime as fallback. The auto-zoom on the tokens/sec meter is worth a lot.
- **Editor:** CapCut / Descript / Final Cut. Descript lets you trim VO by editing text — fastest way to hit a hard 60.
- **VO:** record a clean human take in a quiet room, OR use an ElevenLabs voice if no good mic. Music bed: low, driving, ducked under VO.

**Resolution / fps**
- Record at **2560×1600 (or 1920×1080) @ 60fps**. 60fps makes the streaming text and the race bar feel buttery — critical for selling speed.
- Export **1080p (1920×1080) @ 60fps, H.264, ~12–16 Mbps**. Vertical 1080×1920 crop for the X cut.
- Use a **light-on-dark UI theme** — the tokens/sec meters and green/red agent states pop, and it reads as "ops / war room."

**Privacy — do this BEFORE you hit record**
- [ ] **No API keys.** Run the demo against pre-warmed responses or a key injected via env var; never have a `.env`, terminal with the key, or network tab open.
- [ ] **Hide the Cerebras key everywhere:** close DevTools/Network tab, no `curl` with `Authorization:` headers on screen, scrub the URL bar of any `?key=`.
- [ ] **Turn on Do Not Disturb / Focus.** No Slack, iMessage, email, or calendar pop-ups. (A real DM sliding in is the classic hackathon-video facepalm.)
- [ ] **Clean browser:** one tab, no bookmarks bar, no extensions visible, generic profile (no personal avatar/email).
- [ ] **Demo data only:** the canned `checkout-service` incident. No real company names, no real customer data in the pasted logs/screenshot.
- [ ] Hide the macOS menu bar clock if it shows a real account; hide the dock.

**How to make the speed difference visceral (the whole game)**
- **Start both lanes on the same frame.** The eye needs a shared start line to feel the gap. A countdown "3·2·1·GO" wipe sells it.
- **Show the GPU lane genuinely crawling** — real-ish ~30–40 tok/s, spinner, a half-full bar — while Cerebras *snaps* to done. The contrast is the story.
- **Live tokens/sec meter that visibly spikes** to ~1,840 with the TTFT (~92 ms) ticking. Numbers moving > numbers static.
- **Stamp the multiplier** (`~20× FASTER`) with a sound effect/impact frame at the moment Cerebras finishes. One number people remember.
- **Run all three Stage-1 agents streaming simultaneously** — three columns filling at once is the visual proof that "parallel is free" at this speed.
- Add a subtle "whoosh + click" SFX when consensus locks (✓) and when the command is copied. Audio makes speed feel like *snap*.

**How many takes**
- **App run:** do **3–5 clean screen captures** end-to-end. Pre-warm the model so timings are best-case and deterministic. Keep the 2 fastest; you'll cut between them.
- **VO:** record **2–3 full passes**, then comp the best line reads. Nail the wow line in isolation 3–4 times — it's the one line that has to be perfect.
- Budget ~45–60 min total: it's a 60-second video, don't over-shoot. Lock picture first, then VO to picture, then music last.

---

## Final pre-submission gate
- [ ] Runtime ≤ **60.0s** (and the X cut ≤ 30.0s).
- [ ] Cerebras speed is **visibly shown** (race + live tokens/sec + multiplier).
- [ ] Side-by-side vs GPU present.
- [ ] **Zero** keys / personal info / notifications on any frame (scrub frame-by-frame).
- [ ] The wow line is audible and lands on the MAYDAY card.
- [ ] Closing tag reads exactly: **`Mayday — built on @Cerebras + @googlegemma Gemma 4 · #Gemma4`**.
