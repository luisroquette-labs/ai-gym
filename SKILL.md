---
name: ai_gym
description: >-
  Train AI agent prompts by MEASUREMENT instead of vibes — stand up an eval
  harness (real prompt + real LLM + STUBBED tools = zero side effects), author
  scenarios with pass/fail rubrics, judge transcripts with subagents, aggregate
  a scorecard by dimension, run a TOURNAMENT of prompt variants, kill LLM noise
  with N-runs, and ship only the change measurement proved. Use whenever the user
  wants to improve/refine/test the system prompt of an AI agent, chatbot, or LLM
  pipeline; compare two prompt versions; find why an agent hallucinates, leaks
  data, or escalates wrong; build a regression eval for a prompt; or run
  "agent battles / a prompt tournament". Triggers on requests like "make my
  agent's prompt better", "this bot keeps making things up", "which prompt
  version is better", "write a test for my bot's behavior", "I need an eval for
  my agents" — even without the word "eval". Target stack: TS/Node + vitest; the
  LLM provider is pluggable (your project supplies the client). Works with any
  subagent-capable coding agent (Claude Code, Codex, etc.).
---

# AI Gym — Eval-Driven Prompt Refinement (Agent Prompt Tournament)

An agent's prompt is code: it deserves measurement, not gut feeling. This is the
complete method to **prove** a prompt change actually improves behavior — not just
"feels better" — before it reaches production.

## Why this exists (read before touching code)

LLMs are not deterministic, even at `temperature: 0`. "I tweaked the prompt and it
looks good" is a sample of one, dominated by noise. A plausible edit can be a **net
wash** — the win on one case eaten by a regression on another you never saw. The
only defense is: an objective per-behavior rubric + an independent judge + **N-runs
comparing baseline-vs-edited per case**. Without it, you ship a regression disguised
as an improvement.

The harness also isolates the agent from the world: **real prompt + real LLM +
STUBBED tools**. The tools record the call and return the scenario's canonical
context — they never create a real ticket, order, or record. You measure the
agent's reasoning without touching anything real.

## The cycle in 7 steps (the map)

`harness` → `scenarios` → `judge` → `scorecard` → `attack weakness` → `N-runs` → `ship`

0. **Harness** — real prompt + real LLM + stubbed tools (zero side effects).
1. **Scenarios** — one behavior per scenario, a `must` / `must_not` rubric.
2. **Baseline** — run them all, produce transcripts.
3. **Judge** — Claude subagents score 0-3 against the rubric.
4. **Scorecard** — aggregate by dimension, rank the weaknesses.
5. **Attack** — a tournament of variants OR a surgical root-cause fix.
6. **N-runs** — 3× baseline-vs-edited per case to kill the noise.
7. **Ship** — only what measurement proved, surgically, in an isolated worktree.

Details for each step live in "The full loop (A → Z)" below.

## The 4 seams you fill per project (personalization)

The harness is generic; 4 points change per agent. Find them first:

1. **Real system prompt** — import the function that builds the prompt in
   production (`buildSystemPrompt(identity)`); never copy the text (a copy drifts).
2. **Real tools + stubbed handlers** — import your production tool *defs*
   (`.tools`), but swap each handler for a stub that only records the call and
   returns the scenario's `context`. Never the real handlers.
3. **LLM client (pluggable)** — your project passes a `callModel(messages, tools)`
   that talks to its provider (any OpenAI-compatible LLM, or your own wrapper).
   The harness doesn't care which.
4. **Grounding / knowledge base** — what "the base knows" (KB, catalog, policy).
   Lives in each scenario's `context` field; it's what the search stubs return.

## The full loop (A → Z)

Run the phases in order. Each has a verification. Fine detail lives in
`references/` — read the referenced file when you reach that phase.

### Phase 0 — Stand up the harness
- Copy the templates from `assets/` into the project: `runner.ts`, `scorecard.ts`,
  `scorecard.test.ts`. Put them under `evals/agents/`.
- Fill the 4 seams (above). `runner.ts` marks each with `// FILL IN:`.
- Add to `package.json`: `"eval:run"`, `"eval:scorecard"`,
  `"eval:agents": "npm run eval:run && npm run eval:scorecard"`.
- Run with `npx tsx --env-file=.env.local` (resolves `@/` + TS, loads env).
- **`.gitignore`** the run artifacts: `out/ out-*/ judgments/ judgments-*/ nruns/`.
- Verify: `npm run eval:run` with no scenarios must not crash (empty loop).

### Phase 1 — Author scenarios
- Each scenario = **one testable behavior** with a concrete `must[]` / `must_not[]`
  rubric. Full schema + guide in **`references/scenario-schema.md`**.
- Cover dimensions, not just the happy path: voice/style, grounding-trap (empty
  base → the right move is to hedge/escalate, never invent), robustness
  (jailbreak/injection/absurd request), tool-selection, escalation, data
  collection, routing.
- **Ground in reality**: use the real knowledge base + real conversations. An
  invented scenario tests a world that doesn't exist.
- Scale authoring with a fan-out of subagents (one per dimension), but give each
  the domain seed (`references/scenario-schema.md` shows the seed).
- Verify: 40-60 scenarios, unique IDs `<agent>-<dimension>-NN`, each with a
  `must`/`must_not` a judge can check objectively.

### Phase 2 — Run the baseline
- `npm run eval:run` → transcripts in `out/<id>.json` = `{content, calls, used, error?}`.
- Verify: count == number of scenarios, `errors: 0`. A network error or
  iteration-ceiling on one scenario → re-run just it (may be transient noise).

### Phase 3 — Judge
- **Judging is NOT an npm script.** The judges are subagents that read the rubric
  + the transcript and score 0-3. Judge prompt + scoring rules in
  **`references/judging.md`**.
- Fan-out: one subagent per scenario file, writing `judgments/<id>.json`.
- Hard rule: violating any `must_not` caps at ≤1.0; `error`/empty content/
  iteration-ceiling → 0.

### Phase 4 — Scorecard → find weaknesses
- `npm run eval:scorecard` aggregates by (agent × dimension), sorts by mean ASC
  (weakness on top), lists `fails` (score < 2) and weak cases.
- Verify: read `scorecard.md`. Dimensions with mean < ~2.5 and cases scoring < 2
  are the target. Note the numbers — that's your comparison baseline.

### Phase 5 — Attack the weaknesses (tournament OR surgical fix)
- Two strategies in **`references/tournament-and-nruns.md`**:
  - **Tournament** (broad/structural weakness): generate N prompt variants from
    distinct angles (subagents), judge them, run a regression pass over the whole
    suite, synthesize the winner by grafting the best of the runners-up.
  - **Surgical fix** (few cases): read the weak case's transcript, find the root
    cause, edit the minimum. **Always in an isolated worktree**, never on main.
- Verify: `npx tsc --noEmit` clean + the prompt's guard tests green (if a guard
  breaks, **move the assertion to the new wording — never loosen it**; see
  `references/deploy-discipline.md`).

### Phase 6 — N-runs: kill the noise
- **The phase that separates a real win from luck.** Run 3× (baseline) and 3×
  (edited), compare the **mean per case**. Method + the env-override trick in
  **`references/tournament-and-nruns.md`**.
- Gold standard: `EVAL_PROMPT_<AGENT>=path/to/baseline.txt` runs the baseline in
  the SAME harness as the edited prompt → isolates the edit from noise, case by
  case.
- Verdict: a real win = edited > baseline consistently across the 3. A tie or drop
  on one case kills the edit even if another case improves. Sum the net.
- Verify: you can say, per case, "this is a real fix / this is noise / this is
  collateral from my edit". If you can't, run more.

### Phase 7 — Ship surgically
- Ship only what measurement proved. Full discipline in
  **`references/deploy-discipline.md`**: isolated worktree, explicit-path
  `git add` (never `-A`), the whole suite as the gate, one build, guards follow
  the truth.
- Verify: `git log --oneline origin/main..HEAD` shows only YOUR commit before you
  push. Safety invariants (e.g. no cross-account data leaks) stay at baseline.

## Hard-won gotchas (they cost hours if ignored)

- **A single run lies.** Every conclusion from one run is suspect until N-runs. The
  biggest value of this method is in Phase 6.
- **A plausible edit ≠ a good edit.** Reinforcing one behavior (e.g. "collect more
  fields") can make the agent overeager and break another (e.g. stop escalating
  out-of-scope requests). Only per-case baseline-vs-edited N-runs reveal it.
- **"Missing data becoming a negative."** An empty search (the base lacks X) → the
  agent answers "X doesn't exist / can't be done" as fact. Almost always the right
  move is to hedge/escalate. It's the single most recurring bug — test it
  explicitly with grounding-traps.
- **Stable base-fact vs fact-that-needs-a-source.** A stable offer state ("the
  course is free via signup") can live in the prompt; price/case/spec only from the
  base per call. Confusing the two causes hallucination OR punting.
- **zsh: `for id in $VAR`** (VAR="a b c") does NOT word-split — it iterates once
  with the whole string. In N-runs that makes the `mv`s silently no-op and every
  run overwrites `out/`. Use literal ids in the loop, or `${=VAR}`.
- **zsh: `rm dir/*.json`** aborts on a non-matching glob (nomatch) — it can wipe a
  baseline. Use `mv` after the run, or `2>/dev/null`.
- **Grounding-traps induce iteration-ceilings** (the model loops searching instead
  of escalating) in both baseline and variants — that's dimension noise, not a
  variant regression. Don't conclude a regression from an isolated ceiling; re-run.

## Files in this skill

- `assets/runner.ts` — the runner template (real prompt + pluggable LLM + stubbed
  tools + a tool-calling loop with a ceiling). Marked with `// FILL IN:`.
- `assets/scorecard.ts` — pure aggregation (`aggregate`/`weaknesses`/`renderMarkdown`) + main.
- `assets/scorecard.test.ts` — a test for the pure functions (a regression guard).
- `assets/scenarios.example.json` — 3 example scenarios (voice, grounding-trap, robustness).
- `references/scenario-schema.md` — scenario schema + authoring guide + domain seed.
- `references/judging.md` — judge prompt + scoring rules + fan-out.
- `references/tournament-and-nruns.md` — variant tournament + N-runs + env override.
- `references/deploy-discipline.md` — worktree, guard-follows-truth, gate, one build.
