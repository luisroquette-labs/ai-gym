/**
 * runner.ts — agent-prompt eval harness (TEMPLATE).
 *
 * Runs each scenario with: real prompt + real LLM (pluggable) + STUBBED tools
 * (zero side effects). Writes the transcript to out/<id>.json.
 *
 * Run:  npx tsx --env-file=.env.local evals/agents/runner.ts [file-or-folder]
 * Prompt override (N-runs): EVAL_PROMPT_<AGENT>=path/to/prompt.txt (see FILL IN #3b)
 *
 * The 4 seams to fill are marked with  // FILL IN:
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ————————————————————————————————————————————————————————————————
// FILL IN #1 — your agent's REAL system prompt (import it, don't copy)
// import { buildSystemPrompt } from "@/lib/agent/prompt";
// FILL IN #2 — your agent's real tool DEFS (defs only; handlers become stubs below)
// import { buildToolCatalog } from "@/lib/agent/catalog";
// FILL IN #3 — your project's pluggable LLM client (OpenAI-compatible):
//   callModel({ messages, tools }) => { content: string, tool_calls?: ToolCall[] }
// import { callModel } from "@/lib/agent/model";
// ————————————————————————————————————————————————————————————————

type Msg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: ToolCall[]; tool_call_id?: string; name?: string };
type ToolCall = { id: string; function: { name: string; arguments: string } };
type Scenario = {
  id: string; agent: string; category: string;
  identity?: unknown;
  context?: Record<string, unknown>;
  history?: { role: "user" | "assistant"; content: string }[];
  message: string;
  tool_results?: Record<string, unknown>;
  rubric?: unknown;
};

const OUT = "evals/agents/out";
const DEFAULT_SCENARIOS = "evals/agents/scenarios/"; // a folder = run all
const MAX_ITER = 4; // tool-calling ceiling (reproducibility)

function loadScenarios(target: string): Scenario[] {
  const files = target.endsWith(".json")
    ? [target]
    : readdirSync(target).filter((f) => f.endsWith(".json")).map((f) => join(target, f));
  return files.flatMap((f) => {
    const d = JSON.parse(readFileSync(f, "utf8"));
    return Array.isArray(d) ? d : (d.scenarios ?? [d]);
  });
}

/** scenario system prompt: env override (N-runs) OR the imported real prompt. */
function systemPromptFor(s: Scenario): string {
  // FILL IN #3b — env override, one per agent (the key to baseline-vs-edited N-runs):
  const envKey = `EVAL_PROMPT_${s.agent.toUpperCase()}`;
  const override = process.env[envKey];
  if (override) return readFileSync(override, "utf8");

  // FILL IN #1b — call your agent's real function (pass identity if any):
  // return buildSystemPrompt(s.identity as any);
  throw new Error("FILL IN #1b: return the real system prompt for agent " + s.agent);
}

/** real tool defs + STUBBED handlers. The stub only records the call and returns
 *  the scenario's context (search) or tool_results[name] (side-effect). */
function buildStubbedTools(s: Scenario, record: (name: string, args: unknown) => void) {
  // FILL IN #2b — take the real DEFS from your agent's catalog:
  //   const defs = buildToolCatalog(...).tools;  // [{ type:"function", function:{ name, description, parameters } }]
  const defs: { function: { name: string } }[] = []; // FILL IN
  const handlers: Record<string, (args: unknown) => unknown> = {};
  for (const t of defs) {
    const name = t.function.name;
    handlers[name] = (args) => {
      record(name, args);
      // search → return the context slice; side-effect → tool_results[name] ?? {ok:true}
      const fromContext = s.context?.[name as keyof typeof s.context];
      if (fromContext !== undefined) return fromContext;
      return s.tool_results?.[name] ?? { ok: true };
    };
  }
  return { defs, handlers };
}

async function runScenario(s: Scenario): Promise<void> {
  const calls: { name: string; args: unknown }[] = [];
  const { defs, handlers } = buildStubbedTools(s, (name, args) => calls.push({ name, args }));

  const messages: Msg[] = [{ role: "system", content: systemPromptFor(s) }];
  const ctxNonEmpty = s.context && Object.values(s.context).some((v) => Array.isArray(v) ? v.length : v != null);
  if (ctxNonEmpty) messages.push({ role: "system", content: "BASE CONTEXT:\n" + JSON.stringify(s.context) });
  for (const h of s.history ?? []) messages.push({ role: h.role, content: h.content });
  messages.push({ role: "user", content: s.message });

  let content = "";
  try {
    for (let iter = 0; iter < MAX_ITER; iter++) {
      // FILL IN #3c — call your client. It must return { content, tool_calls? }.
      const resp: { content: string; tool_calls?: ToolCall[] } = await (async () => {
        throw new Error("FILL IN #3c: call callModel({ messages, tools: defs })");
      })();
      if (resp.tool_calls?.length) {
        // the assistant message MUST carry tool_calls: the role:"tool" messages
        // below reference tool_call_id — without this the API rejects the next call.
        messages.push({ role: "assistant", content: resp.content ?? "", tool_calls: resp.tool_calls });
        for (const tc of resp.tool_calls) {
          const args = safeJson(tc.function.arguments);
          const out = handlers[tc.function.name]?.(args) ?? { ok: true };
          messages.push({ role: "tool", tool_call_id: tc.id, name: tc.function.name, content: JSON.stringify(out) });
        }
        continue; // let the model react to the tool result
      }
      content = resp.content ?? "";
      break;
    }
    if (!content) throw new Error("tool-calling loop ceiling reached");
    write(s, { content, calls, used: calls.map((x) => x.name) });
  } catch (e) {
    write(s, { content, calls, used: calls.map((x) => x.name), error: String((e as Error).message ?? e) });
  }
}

function write(s: Scenario, extra: Record<string, unknown>) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, `${s.id}.json`), JSON.stringify({ id: s.id, agent: s.agent, category: s.category, ...extra }, null, 2));
}
function safeJson(str: string) { try { return JSON.parse(str); } catch { return {}; } }

(async () => {
  const target = process.argv[2] ?? DEFAULT_SCENARIOS;
  const scenarios = loadScenarios(target);
  console.log(`[eval] ${scenarios.length} scenario(s) from ${target}`);
  for (const s of scenarios) {
    process.stdout.write(`[eval] ${s.id}... `);
    await runScenario(s); // sequential: reproducible + won't blow rate limits
    console.log("ok");
  }
})();
