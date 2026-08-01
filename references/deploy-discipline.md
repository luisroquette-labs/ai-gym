# Shipping surgically (Phase 7)

Agent prompts are usually LIVE. A wrong edit is a wrong agent talking to real users.
Ship only what measurement proved, and only that.

## Isolated worktree (never edit on main)

Do all the edit+measure work in a separate worktree, created from `origin/main`:

```bash
git worktree add /tmp/proj-prompt-fix -b prompt-fix origin/main
ln -sfn /path/to/real/node_modules /tmp/proj-prompt-fix/node_modules
ln -sfn /path/to/real/.env.local   /tmp/proj-prompt-fix/.env.local
```

Why: more than one line of work on the same local branch makes a `git push` carry
another session's commits along. One worktree per task avoids that.

## Guard tests follow the TRUTH

If you have tests asserting the prompt's anchors and one breaks after the edit:

- Check the **invariant** is still in the prompt (only the wording changed). If so,
  **move the assertion to the new wording — never loosen/delete** the guard.
- Prefer asserting the **real invariant** over a fragile proxy. E.g.
  `not.toMatch(/tool.*guest/)` is fragile co-occurrence (it matches the legitimate
  "NEVER call tool"); replace it with the positive truth:
  `toMatch(/no access to tool/) + toMatch(/guides to capture/)`.
- If an invariant genuinely disappeared → stop, it's a bug in the edit, not the test.

## Explicit stage + gate + one build

```bash
git add lib/agent/prompt.ts src/__tests__/agent-prompt.test.ts   # EXPLICIT paths
```

- **Never `git add -A`** in a shared working copy — it sweeps another session's file
  + the eval artifacts (`out-*`, `judgments-*`). Only the sources.
- **Gate**: `npx tsc --noEmit` clean + `npm test` (whole suite) green. If a pre-push
  hook runs the suite, it's the final gate.
- **Confirm what you're pushing**: `git log --oneline origin/main..HEAD` must show
  ONLY your commit. Someone else's commit in the list → stop, tell the owner.
- **One build**: if `git push` already triggers the deploy (Git integration on), do
  NOT run the deploy CLI afterward — that's a duplicate build. Let the git-triggered
  build be the only one.

## What does NOT belong in the repo

- Run artifacts: `out/ out-*/ judgments/ judgments-*/ nruns/` — in `.gitignore`.
- Intermediate scorecards and raw transcripts. What's worth keeping: the functional
  harness, the scenarios, the winning variants (`variants/*.txt`), and the final
  scorecard if you want a record.

## Final checklist before the push

1. `npx tsc --noEmit` clean.
2. `npm test` green (includes the prompt guards, following the truth).
3. N-runs proved net-positive (Phase 6) — no wash, no collateral.
4. Safety invariants (no cross-account leaks, etc.) at baseline in the scorecard.
5. `git log origin/main..HEAD` = only your commit.
6. Only the source files staged (no `out-*`/`judgments-*`).
7. Push → one build. Do not run the deploy CLI afterward.
