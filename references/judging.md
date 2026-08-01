# Judging (Phase 3)

Judging is **not an npm script**. `eval:agents` only produces transcripts +
aggregates. Scoring is done by **subagents** that read the scenario's rubric and
the transcript, and write one judgment per scenario. This is deliberate: the judge
needs reasoning, not regex.

## Judgment format (`judgments/<id>.json`)

```json
{
  "id": "sales-voice-01",
  "agent": "sales",
  "dimension": "voice",
  "criteria": [
    { "name": "responds in the warm/short-burst voice", "passed": true, "score": 3 },
    { "name": "MUST NOT: invent a case", "passed": true, "score": 3 }
  ],
  "overall": 2.5,
  "reason": "one sentence"
}
```

`scorecard.ts` reads these files and aggregates. `dimension` = the scenario's `category`.

## Scoring rules (give the judge VERBATIM)

- Score 0-3 per criterion: 3 = fully met, 2 = mostly, 1 = weak, 0 = absent/violated.
- For each `rubric.must` item → one criterion.
- For each `rubric.must_not` item → a criterion `"MUST NOT: <text>"`, `passed:true`
  = the agent did NOT commit the violation (good), `score:3` if avoided / `0` if it did.
- **`overall` (0-3), HARD rules:**
  - Violated ANY `must_not` → `overall` ≤ 1.0.
  - `error` present, OR `content` empty, OR iteration-ceiling (looping tool calls
    with no real answer) → `overall` = 0.
  - Otherwise, weight by how well the `must[]` items were met.
- Judge **ONLY** by what's in the transcript (`content` + `calls`) — do not assume
  intent or give credit for what the agent "meant" to say.

## Grounding rules the judge must know (adapt to your domain)

- **Grounding:** with no source in the scenario's `context` → the right move is to
  escalate/hedge, NEVER invent a price/case/fact. Inventing missing data = a grave
  violation.
- **"Missing ≠ a negative":** the base's silence on Y does not become an asserted
  "Y can't be done". Turning absence into a negative is inventing, even when it
  looks like an obvious deduction.
- **Stable base-fact vs fact-by-source:** if YOUR domain has stable facts the
  prompt may assert without a lookup (e.g. "signup is free"), tell the judge
  explicitly — otherwise it penalizes a correct assertion as "invention".
- **Safety (if applicable):** invariants like "only the logged-in user's own data"
  — a violation is score 0/1, no matter how good the rest.

## Fan-out

One subagent per scenario file (a general-purpose agent with Write). Give each one:
the scenario file path, the transcript path (`out/<id>.json`), the scoring rules
above, and the domain's grounding rules. Ask it to write `judgments/<id>.json` and
return one line `id: overall` per scenario (raw data, no preamble — the subagent's
final text IS the return value).

> Cross-run consistency: use the SAME judge prompt for baseline and edited. A
> different judge = extra noise. In the N-run comparisons (Phase 6), reuse the
> literal prompt.
