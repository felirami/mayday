# Mayday — Social Launch Kit 📣

> **Track 2: People's Choice — Most Impressions on Social Media.**
> Judged on organic reach, engagement, content quality, and authentic excitement around **Cerebras + Gemma 4 31B**.
> **Required on every primary post:** the demo video, tag `@Cerebras` + `@googlegemma`, hashtag `#Gemma4`.

**Placeholders to fill before posting:** `[VIDEO]` `[REPO_URL]` `[LIVE_URL]` `[YOUR_HANDLE]` `[TEAM_HANDLES]`

The one-line pitch (memorize it): **An SRE pastes an alert. Six Gemma-4-31B agents on Cerebras swarm it in parallel, argue about the root cause, agree, and hand back a safe rollback command — in seconds.**

---

## 1. Hero X (Twitter) Post — 3 variants

Pick ONE as the launch post. The video is the star; the text just stops the scroll. Keep tags + hashtag intact in all three.

### Variant A — Speed-shock angle
```
I pasted a broken dashboard into a box.

6 AI agents read it, hunted the logs, found the root cause, ARGUED about it, agreed, and handed me the exact rollback command.

Total time: a few seconds.

Running Gemma 4 31B on @Cerebras. This is unfair. 👇

#Gemma4 @googlegemma
[VIDEO]
```
*(~255 chars before link)*

### Variant B — "Agents argue" angle
```
We built 6 AI agents and made them fight.

One finds the root cause. Another (the Skeptic 🛡️) tries to tear it apart. They argue, they agree, then they ship a safe fix.

Gemma 4 31B on @Cerebras, all in parallel, all in seconds. Watch 👇

#Gemma4 @googlegemma
[VIDEO]
```
*(~252 chars before link)*

### Variant C — Enterprise-pain angle
```
3am page. Checkout latency spiking. Money on fire. 🔥

Instead of 5 engineers grep'ing logs for an hour, I pasted the alert into Mayday.

6 Gemma 4 31B agents on @Cerebras found the bad deploy + the rollback in seconds.

MTTR → seconds. 👇

#Gemma4 @googlegemma
[VIDEO]
```
*(~258 chars before link)*

**Pinning:** Pin the winning variant to your profile for the full judging window. Pin the THREAD (below) right under it as a quote-RT.

---

## 2. Full X Thread (8 tweets)

Post the hero tweet, then reply to it with 2/ … 8/. Each ≤280 chars. Drop the GIF/clip on 1/ and 4/ for the algorithm.

**1/ (hook)**
```
We built "Mayday" in 24h: an AI Incident Commander.

You paste a broken dashboard + logs + runbook.
6 Gemma 4 31B agents on @Cerebras swarm it, argue, agree, and hand you a safe rollback.

In seconds. Not minutes. Seconds.

🧵👇 #Gemma4 @googlegemma
[VIDEO]
```

**2/ (the speed race)**
```
2/ The whole thing hinges on ONE thing: speed.

A 6-agent debate is unusable if each turn takes 30s.

On @Cerebras, Gemma 4 31B runs at ~1000–1850 tokens/sec. The same swarm on a typical GPU crawls.

We put a live race in the UI. It's not close. 🏎️💨
```

**3/ (how the swarm works)**
```
3/ Meet the swarm. They fan out IN PARALLEL:

👁️ OPTIC — reads the dashboard screenshot
📜 TRACE — hunts the logs
📚 ARCHIVE — pulls the runbook
🧠 SHERLOCK — forms the root cause
🛡️ DEVIL — challenges it
📣 MAYDAY — makes the call

6 specialists, one incident.
```

**4/ (the DEVIL-disagrees moment)**
```
4/ The best part: the agents don't just agree.

SHERLOCK 🧠 proposes a root cause.
DEVIL 🛡️ (our Skeptic) pushes back — "did you rule out the connection pool change?"

They debate. Then they converge.

This is what makes the answer trustworthy. 👇
[VIDEO]
```

**5/ (the demo incident)**
```
5/ Live demo: checkout-service latency spikes after a deploy.

The swarm traces it: that deploy bumped the DB connection pool max 20→100, exhausting Postgres connections.

Root cause found. Fix proposed:
`kubectl rollout undo`

Safe. Specific. Seconds.
```

**6/ (enterprise impact)**
```
6/ Why this matters in prod:

Downtime costs real companies thousands/min. MTTR is everything.

Mayday compresses triage — read, correlate, root-cause, decide — from a frantic war-room into a few seconds of parallel inference.

That's the whole pitch. ⏱️
```

**7/ (built in 24h + open source)**
```
7/ All of this: built in 24 hours for the @Cerebras x @googlegemma Gemma 4 hackathon.

6 agents. Real vision + logs + retrieval. A live tokens/sec meter. An argue-then-agree debate.

Powered start to finish by Gemma 4 31B on @Cerebras. Open source. 🛠️
```

**8/ (CTA)**
```
8/ Try it. Break it. Tell us what it gets wrong.

🔗 Live: [LIVE_URL]
💻 Repo: [REPO_URL]
🎥 Full demo: top of thread

Huge thanks to @Cerebras + @googlegemma for the speed and the model.

If 6 agents arguing in seconds is your thing — RT 1/ 🙏 #Gemma4
```

---

## 3. LinkedIn Post (enterprise / professional framing)

```
Every SRE knows the 3am page. Checkout latency is spiking, revenue is leaking, and five engineers are simultaneously grep'ing logs, squinting at dashboards, and digging up a runbook nobody's read in months. The bottleneck is never intelligence — it's coordination and time.

This weekend, for the Cerebras x Google DeepMind "Gemma 4" hackathon, we built Mayday: an AI Incident Commander.

You paste in the raw incident — a dashboard screenshot, the logs, and the runbook. Then a swarm of six specialized Gemma 4 31B agents, running on Cerebras, fans out in parallel:

• OPTIC reads the dashboard screenshot (vision)
• TRACE hunts the logs
• ARCHIVE retrieves the runbook
• SHERLOCK forms a root-cause hypothesis
• DEVIL — a dedicated Skeptic agent — challenges that hypothesis
• MAYDAY, the commander, issues the final decision

The detail I'm proudest of is the argument. SHERLOCK proposes a root cause; DEVIL tries to falsify it. They debate, then converge. A single-shot LLM gives you a confident guess. An adversarial swarm gives you a vetted conclusion — and that's the difference between something you'd actually run in production and something you wouldn't.

In our demo, a deploy had raised the Postgres connection pool max from 20 to 100, exhausting available connections. The swarm correctly identified the bad deploy and proposed a safe `kubectl rollout undo` — plus a ready-to-paste Slack update for the team.

The whole thing completes in seconds. That's not a UI trick; it's the model. Gemma 4 31B on Cerebras runs at roughly 1,000–1,850 tokens/sec, which is what makes a six-agent debate feel instant instead of agonizing. We even put a live tokens/sec meter and a Cerebras-vs-GPU speed race in the interface, because the speed is the product.

The business case is simple: enterprise downtime is measured in thousands of dollars per minute, and MTTR is the metric that bounds the bill. Mayday turns the slowest part of incident response — triage — into a few seconds of parallel inference, with a human always in the loop for the final call.

Built in 24 hours. Open source.

🎥 Demo: [VIDEO]
💻 Repo: [REPO_URL]
🌐 Live: [LIVE_URL]

Enormous thanks to the teams at Cerebras and Google DeepMind. #Gemma4 #AI #SRE #DevOps #IncidentResponse #LLM #Cerebras
```

---

## 4. Show HN

**Title:**
```
Show HN: Mayday – 6 Gemma 4 31B agents on Cerebras triage an incident in seconds
```

**First comment:**
```
Hi HN — we built this in 24 hours for the Cerebras x Google DeepMind Gemma 4 hackathon.

The idea: incident triage is a coordination problem, not an intelligence problem. So instead of one chatbot, Mayday runs six specialized Gemma 4 31B agents in parallel. You paste a dashboard screenshot + logs + a runbook, and they fan out: one reads the dashboard (vision), one hunts the logs, one retrieves the runbook, one forms a root-cause hypothesis, one (a Skeptic) tries to falsify it, and a commander makes the final call with a concrete rollback command.

The part we think is interesting is the adversarial step. A single LLM gives a confident guess; here the Skeptic agent argues with the root-cause agent until they converge, which catches a lot of plausible-but-wrong hypotheses. We have a recording of them disagreeing in the demo.

The reason it's usable at all is Cerebras. Gemma 4 31B runs at ~1,000–1,850 tok/s there, so a six-agent debate finishes in seconds rather than minutes. We added a live tokens/sec meter and a side-by-side speed race against a GPU baseline because the latency is genuinely the unlock — the same architecture on a slow backend just isn't pleasant to use.

Demo incident: a deploy raised the Postgres connection pool max 20→100 and exhausted connections; the swarm finds it and proposes `kubectl rollout undo`. Human stays in the loop — it proposes the command, it doesn't run it.

Repo: [REPO_URL]
Live demo: [LIVE_URL]
Video: [VIDEO]

Happy to answer questions about the agent orchestration, the prompts that keep the Skeptic honest, or how we wired up vision + logs + retrieval on Gemma 4. Feedback very welcome — especially failure cases.
```

---

## 5. r/LocalLLaMA Post

**Title:**
```
We ran 6 Gemma 4 31B agents in parallel on Cerebras (~1000–1850 tok/s) to triage a prod incident in seconds — argue-then-agree debate included
```

**Body:**
```
Built this in 24h for the Cerebras x Google DeepMind Gemma 4 hackathon and figured this sub would appreciate the model + inference details.

**The setup**
Mayday is an AI Incident Commander. You paste an alert (dashboard screenshot + raw logs + a runbook) and six specialized Gemma 4 31B agents swarm it in parallel:

- 👁️ OPTIC — reads the dashboard screenshot (vision)
- 📜 TRACE — hunts the logs
- 📚 ARCHIVE — retrieves the runbook
- 🧠 SHERLOCK — forms the root-cause hypothesis
- 🛡️ DEVIL — a Skeptic agent that challenges SHERLOCK
- 📣 MAYDAY — commander, makes the final call + rollback command

**Why Gemma 4 31B specifically**
It's big enough to do real root-cause reasoning and follow a multi-agent protocol, but the win is that it's small/fast enough to run the *whole swarm* without the latency killing the UX. The vision agent reading an actual dashboard screenshot is doing real work, not a gimmick.

**Why Cerebras**
The thing that makes a 6-agent debate practical is throughput. We were seeing ~1,000–1,850 tok/s on Gemma 4 31B. A multi-turn argument between agents that would feel painful at 30–50 tok/s on a local GPU finishes in seconds here. We literally put a live tokens/sec meter and a Cerebras-vs-GPU race in the UI because the speed difference is the demo.

**The argue-then-agree bit**
SHERLOCK proposes a root cause, DEVIL tries to falsify it ("did you rule out the pool change?"), they go a couple rounds, then converge. Single-shot prompting on the same model gives a confident wrong answer more often than I'd like; the adversarial pass meaningfully reduces that.

**Demo incident:** a deploy raised the Postgres connection pool max 20→100, exhausting connections and spiking checkout latency. Swarm finds it, proposes `kubectl rollout undo`. Human runs the command — agents only propose.

Repo (open source): [REPO_URL]
Live: [LIVE_URL]
Video: [VIDEO]

Happy to share the orchestration code, the system prompts that keep the Skeptic from rubber-stamping, and the vision pipeline. Roast it — I'm especially curious where it falls over on weirder incidents.
```

---

## 6. Posting Timing & Engagement Playbook

**Deadline anchor:** judging window closes **Monday, June 29, 10:00am PT**. Impressions and engagement accrue *over time*, so post EARLY in the window, not at the buzzer. A post made at 9:50am PT has 10 minutes to earn reach; a post made the night before has ~14 hours.

### Timeline

| When (PT) | Action |
|---|---|
| **Sun 6/28, evening (~5–7pm)** | Post the **hero X tweet + full thread** the moment the demo video is cut. This is your primary judged asset. Evening US = peak overlap with EU morning scrollers next day. |
| **Sun 6/28, +15 min** | Post the **LinkedIn** post and the **r/LocalLLaMA** post. Stagger by ~15 min so you can engage each as it lands. |
| **Sun 6/28, night** | Post **Show HN** (HN's sweet spot is roughly 8–11am ET weekdays, but a strong Show HN does fine Sunday night too — don't sit on it past the deadline). |
| **Sun 6/28 → Mon 6/29** | Reply to EVERY comment within minutes for the first 2 hours, then check every ~30 min. Replies = engagement signal = reach. |
| **Mon 6/29, ~7–8am PT** | Post **clip #2** (a different highlight, e.g. the DEVIL-disagrees moment) as a fresh tweet quoting your thread. A second bite at the algorithm before the deadline. |
| **Mon 6/29, ~9:30am PT** | Final push: quote-RT your own hero tweet with a "last call before judging 👇" nudge. |
| **Mon 6/29, 10am PT** | Deadline. Stop *posting new primary content*; keep *replying* (engagement still counts). |

### Seeding early engagement (organic only)
- **Pre-warm your team.** Every teammate posts from their own account and RTs the hero tweet within the first 10 minutes. Early velocity is what the algorithm rewards.
- **Reply, don't just RT.** Ask teammates/friends to leave a real comment or question — comments weigh far more than likes.
- **Tag thoughtfully.** `@Cerebras` and `@googlegemma` are required and they often amplify hackathon entries — make it easy for them to quote-RT (great video thumbnail, clear hook).
- **Cross-link.** Mention the live demo + repo in every platform so traffic compounds.
- **Post the video natively.** Upload `[VIDEO]` directly to X (native video gets far more reach than a YouTube link). Same for LinkedIn.

### Replying cadence
- First 2 hours: reply within minutes to everything. This is the window that determines whether a post takes off.
- Next 6 hours: check every 30 min.
- Have 2–3 "stinger" replies ready to drop under your own thread to keep it alive: the speed-race number, the rollback command, the link to the repo.

### Hashtags
- **Primary (required on every post):** `#Gemma4`
- **X secondary (use 1–2 max, more looks spammy):** `#Cerebras` `#AIagents`
- **LinkedIn (more is fine):** `#Gemma4 #Cerebras #AI #SRE #DevOps #IncidentResponse #LLM`
- Reddit/HN: no hashtags — they read as spam there.

### What NOT to do ⛔
- **No paid amplification.** No boosted posts, no promoted tweets, no buying impressions, likes, follows, or engagement. It's against the rules and disqualifying. Reach must be organic.
- **No engagement pods / follow-for-follow rings / bot accounts.** Authentic excitement is explicitly part of the judging.
- **Don't spam unrelated communities.** Post r/LocalLLaMA, not ten random subs — off-topic posts get removed and tank your credibility.
- **Don't drop the required tags or `#Gemma4`** — even on the thread replies and the clip posts, keep the hook tweet compliant.
- **Don't bury the video.** It must be on the first tweet, the LinkedIn post, and the Show/Reddit posts.
- **Don't over-hashtag X.** 1–2 beyond `#Gemma4`; walls of tags suppress reach.
- **Don't delete-and-repost** to chase timing — you lose all accumulated engagement.

---

## 7. Clip Captions (one-liners for demo moments)

Drop these as on-screen text, alt captions, or short standalone quote-tweets. Each ≤1 line, punchy.

1. "Six agents. One incident. Seconds to a fix." 📣
2. "Watch the Skeptic call BS on the root cause — then watch them agree." 🛡️🧠
3. "Gemma 4 31B on Cerebras: ~1,850 tokens/sec. The race isn't close." 🏎️💨
4. "Paste the dashboard. Get the rollback command. That's the whole loop." 👁️→📣
5. "This is what 6 AI agents arguing in parallel looks like." ⚡
6. "It found the bad deploy before I finished reading the alert." 😳
7. "`kubectl rollout undo` — root cause to safe fix in seconds." ✅
8. "MTTR used to be measured in war rooms. Now it's measured in seconds." ⏱️
9. "The connection pool went 20→100. The swarm caught it. We didn't have to." 🔍
10. "Built in 24 hours. Powered by Gemma 4 31B on Cerebras. Open source." 🛠️

---

*Reminder before you hit post: video attached? `@Cerebras` + `@googlegemma` tagged? `#Gemma4` present? Repo + live links filled in? Go. 🚀*
