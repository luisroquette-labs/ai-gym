# Variant tournament + N-runs (Phases 5 and 6)

## Tournament (when the weakness is broad/structural)

When a whole dimension is weak (not just one case), don't guess a rewrite — run a
tournament:

1. **Generate N variants** of the prompt via subagents, each with a DISTINCT angle
   (e.g. "tool-protocol first", "few-shot first", "collection first"). Diverse
   angles > N identical attempts.
2. **Judge each variant** over the WHOLE suite (not only the weak dimension) — a
   variant that fixes X but breaks Y is no good.
3. **Synthesize the winner**: take the highest mean and graft in the best of the
   runners-up where they won. The synthesis usually beats any pure variant.
4. **Regression pass**: run the whole suite on the winner, compare to baseline
   dimension by dimension. No dimension may regress on purpose.

Keep each variant as a file (`variants/<agent>-vN.txt`) — it becomes the comparable
baseline in the N-runs and the audit trail.

## Surgical fix (when it's a few cases)

1. Read the weak case's transcript (`out/<id>.json`) + the scenario (rubric +
   context + message). The root cause almost always shows in comparing "what the
   rubric asked" × "what `content`/`calls` did".
2. Edit the MINIMUM in the prompt. In an isolated worktree, never on main.
3. Go to Phase 6 (N-runs) before any ship.

## N-runs — the heart of the method (Phase 6)

An LLM is not deterministic even at `temperature: 0`. One run is a sample of one.
You need 3 (or 5) and the **baseline-vs-edited per-case** comparison.

### The env prompt-override trick

Make `runner.ts` accept `EVAL_PROMPT_<AGENT>=path/to/prompt.txt` — if set, it uses
the file's content as the system prompt instead of the imported function (see the
`assets/runner.ts` override section). This lets you run **baseline and edited in the
SAME harness, changing only one variable**:

- **Edited**: no env → uses the already-edited `prompt.ts` (in the worktree).
- **Baseline**: `EVAL_PROMPT_SALES=variants/sales-vCurrent.txt` → runs today's
  production prompt, byte for byte, in the same harness.

Now the only difference between the two columns is the edit — everything else
(scenario, tools, LLM, judge) is identical. That's what isolates the edit's effect
from noise.

### Recipe (5 cases, 3× each, baseline vs edited)

```bash
# build a file with just the N cases that moved (movers): scenarios-movers.json
V="$PWD/variants/agent-vCurrent.txt"   # today's production prompt
for i in 1 2 3; do
  EVAL_PROMPT_AGENT="$V" npm run eval:run -- evals/agents/scenarios-movers.json
  mkdir -p out-base-r$i
  # LITERAL ids in the loop — zsh does NOT word-split $VAR (else the mv's no-op)
  for id in case-01 case-02 case-03 case-04 case-05; do mv -f out/$id.json out-base-r$i/$id.json; done
  npm run eval:run -- evals/agents/scenarios-movers.json            # edited (no env)
  mkdir -p out-edit-r$i
  for id in case-01 case-02 case-03 case-04 case-05; do mv -f out/$id.json out-edit-r$i/$id.json; done
done
```

Then judge the 6 batches (one subagent per batch, same judge prompt) and compute
the **mean per case** for each column.

### Reading the verdict

Per case, compare `mean_edited` × `mean_baseline`:

- **Real fix**: edited > baseline consistently across the 3 (e.g. 0.67 → 2.20).
- **Noise**: baseline and edited tie, or one number is an outlier (e.g. baseline
  1.5 but re-runs give 2.5/2.5/2.0 → the 1.5 was the outlier).
- **Collateral (a regression from YOUR edit)**: a case the baseline got right now
  fails on the edited (e.g. 2.50 → 1.50). This kills the edit even if another case
  improves.

**Sum the net.** A plausible edit can be a net wash: the win on one case eaten by a
regression on another. If it's a wash or net-negative, the edit does not ship — or
you isolate which sub-change caused the collateral and remove only that.

### Isolating sub-changes

If the edit has 2+ parts and the net is a wash, test each part alone (revert one,
re-run N-runs). That's how you discover "part A fixes it, part B is inert AND causes
collateral" → ship only A. It costs one more N-run round, but it's the difference
between shipping an improvement and shipping a regression in disguise.
