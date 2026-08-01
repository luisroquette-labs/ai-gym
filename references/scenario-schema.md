# Scenario schema + authoring guide

## Structure (one `.json` file per dimension = an array of scenarios)

```jsonc
{
  "id": "sales-voice-01",          // unique, format <agent>-<dimension>-NN
  "agent": "sales",                 // which agent/prompt this scenario exercises
  "category": "voice",              // the dimension (becomes the scorecard axis)

  // Only if the agent's prompt varies by identity (e.g. logged-in vs guest).
  // Becomes the arg to buildSystemPrompt(identity). Omit if the prompt is static.
  "identity": { "type": "guest", "userId": null },

  // What "the base knows" IN THIS conversation — controls grounding. All optional.
  // In a grounding-trap you deliberately leave EMPTY the field the base "lacks".
  "context": {
    "kb": [],            // what a KB-search tool would return
    "cases": [],         // what a case/reference tool would return
    "product": null,     // what a product-lookup tool would return
    "site": []           // fields are yours to define per domain
  },

  // Conversation history before the current message (optional).
  "history": [
    { "role": "assistant", "content": "Hi! How can I help?" },
    { "role": "user", "content": "..." }
  ],

  // The user message the agent must respond to NOW.
  "message": "realistic user text; casual, may contain a typo",

  // Canonical result for SIDE-EFFECT tools (never search): escalate, collectField,
  // createProposal, captureLead, etc. Optional — with no entry the stub returns
  // { ok: true }.
  "tool_results": { "escalate": { "ok": true, "reason": "no KB source" } },

  // What the JUDGE will check. CONCRETE — never "responds well".
  "rubric": {
    "must": ["responds in the warm/short-burst voice", "sets the next step"],
    "must_not": ["invent a number/case", "escalate with no reason"]
  }
}
```

## How the runner uses each field

- `agent` → decides which `buildSystemPrompt` to import.
- `identity` → passed to `buildSystemPrompt(identity)`.
- `context` → injected as an extra `system` message (production does a
  deterministic pre-fetch before the LLM) AND is what the search stubs return.
- `history` + `message` → become the `user`/`assistant` messages.
- `tool_results` → what the side-effect tool stubs return.
- `rubric` → does NOT go to the LLM; it's only for the judge (Phase 3).

## Authoring rules (eval quality)

- **One behavior per scenario.** A concrete rubric the judge can check by looking
  only at the transcript (`content` + `calls`).
- **`context` controls grounding.** For a grounding-trap, leave EMPTY what the base
  "lacks" (`kb:[]`/`cases:[]`) → the right move is to escalate/hedge, not invent.
- **Realistic.** Phrases a real user would send: informal, occasional typo.
- **Variety.** Happy path, edge, adversarial. Don't repeat the same test 5×.
- **Ground it in reality.** Use the product's real base + real conversations. An
  invented scenario tests a world that doesn't exist.

## Dimensions worth covering (adapt to your agent)

| Dimension | What it tests | The trap it exposes |
|---|---|---|
| `voice` | tone, style, format (bursts vs wall of text) | robotic tone, revealing itself as AI unprompted |
| `grounding-trap` | empty base on the asked field | inventing data / "missing becoming a negative" |
| `robustness` | jailbreak, injection, absurd ask ("90% off") | obeying injection, conceding outside policy |
| `tool-selection` | calling the right tool at the right time | asking for data it already has, stalling before acting |
| `escalation` | escalating when (and only when) it should | escalating what the base answers / not escalating out-of-scope |
| `collection` | qualifying by collecting the right fields | asking a field outside the list, over-scripting |
| `routing` | choosing the right path (e.g. proposal vs signup) | treating A as B |
| `replay` | reproducing real proven conversations | drifting from the pattern that works |

## Domain seed for the authoring subagents

When you scale authoring with a fan-out (one subagent per dimension), give EACH one
a "seed" with the real domain, or they'll invent. The seed should contain:

- **The agents**: identity, voice (with real examples), routes/paths, what they can
  and can't do, when they escalate.
- **The real curated base**: policy, prices (with the rule of who computes them),
  real cases (only the ones that exist), authority, products.
- **Real conversations** (if any): the owner's pattern, for voice/replay scenarios.
- **The authoring rules** (this section) + the schema (above).

Ask for unique IDs per dimension and concrete `must`/`must_not` rubrics. Then merge
the files and check for duplicate IDs.
