<div align="center">

# 🏋️ AI Gym

### Train your AI agents with **measurement**, not vibes.

*A drop-in skill for AI coding agents ([Claude Code](https://claude.com/claude-code), [Codex](https://openai.com/codex/), and any subagent-capable agent) that turns "I tweaked the prompt and it feels better" into a proven, regression-safe change.*

`eval harness` · `scenario rubrics` · `subagent judges` · `prompt tournament` · `N-runs` · `surgical ship`

</div>

---

## The problem nobody measures

You change your agent's system prompt. You read one reply. It looks better. You ship it.

Then a customer hits a case you didn't look at — and the bot invents a price, leaks the wrong account, or refuses something it should have answered. **Because an LLM is not deterministic, one reply is a sample of one.** A plausible edit is often a *net wash*: the win on one case eaten by a regression on another you never saw.

"Prompt engineering" without measurement is lifting with your eyes closed.

## What AI Gym does

AI Gym is the **training regimen** for an agent's prompt. It stands up a real eval loop and makes you *prove* an improvement before it reaches production:

```
harness → scenarios → judge → scorecard → attack weakness → N-runs → ship
```

- **Harness** — runs the agent with its **real prompt + real LLM + STUBBED tools**. Tools record the call and return canonical context; they never create a real ticket, order, or record. You measure the agent's *reasoning* without touching anything real.
- **Scenarios** — one behavior per scenario, with a concrete `must` / `must_not` rubric. Voice, grounding-traps, jailbreaks, tool-selection, escalation, data collection, routing.
- **Judges** — subagents score every transcript 0–3 against the rubric. Violating a `must_not` caps the score; hallucinating a fact tanks it.
- **Scorecard** — aggregates by dimension and ranks the weaknesses.
- **Tournament** — spins up prompt variants from different angles, judges them across the *whole* suite, and synthesizes the winner.
- **N-runs** — runs baseline-vs-edited **3× per case** so noise can't masquerade as a win.
- **Ship** — only the change measurement proved, surgically, in an isolated worktree.

## Why it's different

| Most prompt tools | AI Gym |
|---|---|
| Eyeball one output | **N-runs** — 3× baseline-vs-edited per case, so noise never wins |
| Hit real APIs while testing | **Stubbed tools** — zero side effects, never touches production |
| "Looks good, ship it" | **A rubric a judge can fail** — `must` / `must_not` per behavior |
| One prompt, iterated blindly | **A tournament** of variants scored across the whole suite |
| Hope you didn't break anything | **A regression scorecard** — every dimension, every ship |

The core insight baked into the whole method: **a single run lies.** The one phase people skip — running the change enough times to separate a real fix from luck — is the one that saves you from shipping a regression in disguise.

## Works with

Built as a **Claude Skill** (`SKILL.md`), but the method and the templates are agent-agnostic. Drive it with **Claude Code**, **Codex**, or any coding agent that can spawn subagents for the judging fan-out. The LLM *under test* is fully pluggable — your project supplies the client (any OpenAI-compatible provider, or your own wrapper).

**Target stack for the templates:** TypeScript / Node + [vitest](https://vitest.dev/). The methodology itself is stack-agnostic.

## What's inside

```
ai-gym/
├── SKILL.md                          # the A→Z playbook (the skill itself)
├── references/
│   ├── scenario-schema.md            # scenario JSON schema + authoring guide
│   ├── judging.md                    # judge prompt + scoring rules
│   ├── tournament-and-nruns.md       # variant tournament + N-runs recipe
│   └── deploy-discipline.md          # worktree, guard-follows-truth, gate
└── assets/
    ├── runner.ts                     # harness template (pluggable LLM, stubbed tools)
    ├── scorecard.ts                  # pure aggregation (aggregate/weaknesses/render)
    ├── scorecard.test.ts             # regression guard for the aggregator
    └── scenarios.example.json        # 3 example scenarios to copy
```

## Quickstart

**1. Install the skill**

*Claude Code* — clone into your skills directory:
```bash
git clone https://github.com/luisroquette-labs/ai-gym.git ~/.claude/skills/ai_gym
```

*Codex / other agents* — clone anywhere and point your agent at `SKILL.md`:
```bash
git clone https://github.com/luisroquette-labs/ai-gym.git
```

**2. Copy the templates into your project** (`evals/agents/`), then fill the **4 seams** the harness marks with `// FILL IN:`

| Seam | What you provide |
|---|---|
| **Real prompt** | import your production `buildSystemPrompt()` — never copy the text |
| **Real tools** | import your tool *defs*, swap handlers for stubs that just record + return context |
| **LLM client** | a `callModel(messages, tools)` that talks to your provider |
| **Grounding** | what "the base knows" — lives in each scenario's `context` |

**3. Run the loop**
```bash
npm run eval:run        # real prompt + real LLM + stubbed tools → transcripts
# → judges (subagents) score the transcripts against each rubric
npm run eval:scorecard  # aggregate into a scorecard by dimension
```

Then attack the weakest dimension, prove the fix with N-runs, and ship. The full step-by-step is in `SKILL.md`.

## Who it's for

Anyone shipping an LLM agent that talks to real people — support bots, sales agents, copilots, RAG assistants — and is tired of finding regressions in production instead of in an eval.

## Origin

Distilled from repeatedly refining **production agents that talk to real customers** — where a wrong prompt edit isn't a failing test, it's a wrong answer to a paying user. Every gotcha in `SKILL.md` was paid for in a real incident.

## License

MIT — see [LICENSE](LICENSE). Use it, fork it, ship better agents.

---

<div align="center">

**AI Gym** — the first in a collection of Claude Skills by [**@luisroquette**](https://github.com/luisroquette).

*Your agents don't get stronger by hoping. They get stronger under load — and you only know it when you measure the reps.*

</div>
