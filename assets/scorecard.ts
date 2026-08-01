/**
 * scorecard.ts — aggregates judgments (judgments/<id>.json) into a scorecard by
 * (agent × dimension). Pure functions + a main that does the I/O.
 *
 * Run:  npx tsx --env-file=.env.local evals/agents/scorecard.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Judgment = {
  id: string;
  agent: string;
  dimension: string;
  criteria: { name: string; passed: boolean; score: number }[];
  overall: number;
  reason: string;
};
export type Row = { agent: string; dimension: string; mean: number; n: number; fails: number; weak_cases: string[] };

/** PURE: groups by (agent×dimension). mean=avg of overall, fails=overall<2,
 *  weak_cases=ids<2 sorted. Result sorted by mean ASC (weakness on top). */
export function aggregate(js: Judgment[]): Row[] {
  const groups = new Map<string, Judgment[]>();
  for (const j of js) {
    const k = `${j.agent} ${j.dimension}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(j);
  }
  const rows: Row[] = [];
  for (const [k, arr] of groups) {
    const [agent, dimension] = k.split(" ");
    const mean = arr.reduce((s, j) => s + j.overall, 0) / arr.length;
    const weak = arr.filter((j) => j.overall < 2).map((j) => j.id).sort();
    rows.push({ agent, dimension, mean: round2(mean), n: arr.length, fails: weak.length, weak_cases: weak });
  }
  return rows.sort((a, b) => a.mean - b.mean || a.agent.localeCompare(b.agent));
}

/** PURE: dimensions with mean < threshold, sorted ASC. The list the tournament attacks. */
export function weaknesses(rows: Row[], threshold = 2.0): { agent: string; dimension: string; mean: number }[] {
  return rows.filter((r) => r.mean < threshold).map(({ agent, dimension, mean }) => ({ agent, dimension, mean }));
}

/** PURE: a markdown table per agent. */
export function renderMarkdown(rows: Row[]): string {
  const agents = [...new Set(rows.map((r) => r.agent))].sort();
  let md = "# Evaluation Scorecard\n";
  for (const a of agents) {
    md += `\n## ${a}\n\n| Dimension | Mean | N | Fails | Weak Cases |\n|---|---|---|---|---|\n`;
    for (const r of rows.filter((x) => x.agent === a)) {
      md += `| ${r.dimension} | ${r.mean.toFixed(2)} | ${r.n} | ${r.fails} | ${r.weak_cases.join(", ") || "-"} |\n`;
    }
  }
  return md;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// —— main (I/O) ——
if (process.argv[1]?.endsWith("scorecard.ts")) {
  const dir = "evals/agents/judgments";
  if (!existsSync(dir)) { console.error(`no ${dir}/ — run the judges first (Phase 3)`); process.exit(1); }
  const js: Judgment[] = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const rows = aggregate(js);
  writeFileSync("evals/agents/scorecard.json", JSON.stringify(rows, null, 2));
  writeFileSync("evals/agents/scorecard.md", renderMarkdown(rows));
  console.log(renderMarkdown(rows));
  const w = weaknesses(rows);
  console.log("\nWeaknesses (mean < 2.0):", w.length ? "" : "none");
  for (const x of w) console.log(`  ${x.agent}/${x.dimension}: ${x.mean.toFixed(2)}`);
}
