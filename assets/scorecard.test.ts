/**
 * scorecard.test.ts — regression guard for the pure aggregator functions.
 * RELATIVE import (not @/) so vitest intercepts it without extra config.
 * Adjust the path to wherever you placed scorecard.ts.
 */
import { describe, it, expect } from "vitest";
import { aggregate, weaknesses, renderMarkdown, type Judgment } from "../../evals/agents/scorecard";

const j = (id: string, dimension: string, score: number): Judgment => ({
  id, agent: "sales", dimension, criteria: [], overall: score, reason: "",
});

describe("aggregate", () => {
  it("mean, n, fails and weak_cases per dimension", () => {
    const rows = aggregate([j("a", "voice", 3), j("b", "voice", 1), j("c", "grounding", 2)]);
    const voice = rows.find((r) => r.dimension === "voice")!;
    expect(voice.mean).toBe(2);
    expect(voice.n).toBe(2);
    expect(voice.fails).toBe(1);        // only the score-1 one (<2)
    expect(voice.weak_cases).toEqual(["b"]);
  });
  it("sorts by mean ASC (weakness on top)", () => {
    const rows = aggregate([j("a", "strong", 3), j("b", "weak", 1)]);
    expect(rows[0].dimension).toBe("weak");
  });
});

describe("weaknesses", () => {
  it("filters dimensions with mean < threshold", () => {
    const rows = aggregate([j("a", "strong", 3), j("b", "weak", 1.5)]);
    const w = weaknesses(rows, 2.0);
    expect(w).toHaveLength(1);
    expect(w[0].dimension).toBe("weak");
  });
});

describe("renderMarkdown", () => {
  it("includes agent and dimension", () => {
    const md = renderMarkdown(aggregate([j("a", "voice", 3)]));
    expect(md).toContain("sales");
    expect(md).toContain("voice");
  });
});
