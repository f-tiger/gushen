import { describe, it, expect } from "vitest";
import {
  validateConfig,
  DEFAULT_CONFIG,
  readWorkspace,
  riskView,
  monthlyReturns,
  stressImpact,
  contributionProjection,
  runResearch,
} from "./research";
import { backtest } from "./walkforward";
import fixture from "./__fixtures__/prices.synthetic.json";
const config = {
  ...DEFAULT_CONFIG,
  holdings: [
    { symbol: "AAA", weight: 50 },
    { symbol: "BBB", weight: 50 },
  ],
};
describe("research contracts and math", () => {
  it("rejects overweight, duplicate, nonfinite and missing-asset configurations", () => {
    expect(() =>
      validateConfig({
        ...config,
        holdings: [
          { symbol: "AAA", weight: 70 },
          { symbol: "BBB", weight: 50 },
        ],
      }),
    ).toThrow(/100%/);
    expect(() =>
      validateConfig({
        ...config,
        holdings: [
          { symbol: "AAA", weight: 50 },
          { symbol: "aaa", weight: 50 },
        ],
      }),
    ).toThrow(/重复/);
    expect(() => validateConfig({ ...config, costBps: Infinity })).toThrow();
    expect(() =>
      runResearch(fixture, {
        ...config,
        holdings: [
          { symbol: "UNKNOWN", weight: 50 },
          { symbol: "BBB", weight: 50 },
        ],
      }),
    ).toThrow(/没有|不包含/);
  });
  it("compares all strategies over identical execution dates and costs", () => {
    const r = runResearch(fixture, config);
    expect(new Set(r.strategies.map((s) => s.metrics.from)).size).toBe(1);
    expect(
      r.strategies.every((s) => s.metrics.cost_bps === config.costBps),
    ).toBe(true);
    expect(r.strategies[0].metrics.total_return).toBeCloseTo(
      r.strategies[1].metrics.total_return,
      12,
    );
    for (const s of r.strategies) {
      expect(
        s.metrics.curve[s.metrics.curve.length - 1].nav / config.capital - 1,
      ).toBeCloseTo(s.metrics.total_return, 12);
      expect(
        Object.values(s.metrics.final_weights).reduce((a, b) => a + b, 0),
      ).toBeCloseTo(1, 12);
    }
  });
  it("includes entry cost in the plotted curve and compounds month buckets exactly", () => {
    const dates = [
      "2026-01-27",
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
      "2026-02-02",
      "2026-02-03",
    ];
    const r = backtest(
      {
        dates,
        cols: ["A", "B"],
        px: [
          [100, 100, 100, 100, 200, 200],
          [100, 100, 100, 100, 100, 100],
        ],
      },
      "equal_weight",
      3,
      100,
      100,
      [0, 1],
      { fixedWeights: { A: 0.5, B: 0.5 } },
    );
    expect(r.curve[0].nav).toBe(100);
    expect(r.curve[1].nav).toBe(99);
    expect(
      monthlyReturns(r.curve).reduce((v, m) => v * (1 + m.ret), 1) - 1,
    ).toBeCloseTo(r.total_return, 12);
    expect(r.total_cost).toBeCloseTo(1.495, 12);
  });
  it("quarterly strategy does not silently rebalance in February", () => {
    const dates = [
      "2026-01-27",
      "2026-01-28",
      "2026-01-29",
      "2026-01-30",
      "2026-02-02",
      "2026-04-01",
    ];
    const r = backtest(
      {
        dates,
        cols: ["A", "B"],
        px: [dates.map(() => 100), dates.map(() => 100)],
      },
      "equal_weight",
      3,
      100,
      0,
      [0, 1],
      { rebalanceMonths: 3 },
    );
    expect(r.rebalances.map((x) => x.executionDate)).toEqual([
      "2026-01-30",
      "2026-04-01",
    ]);
  });
  it("undefined constant-series correlations are null, not false zero risk", () => {
    const r = riskView(
      {
        dates: ["a", "b", "c", "d"],
        cols: ["A", "B"],
        px: [
          [100, 100, 100, 100],
          [100, 110, 100, 120],
        ],
      },
      [
        { symbol: "A", weight: 50 },
        { symbol: "B", weight: 50 },
      ],
    );
    expect(r.correlations[0][1]).toBeNull();
    expect(r.effectiveHoldings).toBe(2);
    expect(r.contribution[1]).toBeCloseTo(1);
  });
  it("stress impacts add up to portfolio dollars without invented probabilities", () => {
    const r = stressImpact(config.holdings, { AAA: -20, BBB: 10 }, 1000);
    expect(r.change).toBeCloseTo(-50);
    expect(r.after).toBeCloseTo(950);
    expect(() => stressImpact(config.holdings, { AAA: NaN }, 1000)).toThrow();
  });
  it("monthly contributions occur after growth and zero-growth is exact", () => {
    expect(contributionProjection(1000, 100, 1, 0).value).toBeCloseTo(2200);
    const r = contributionProjection(100, 10, 1 / 12, 0.12);
    expect(r.value).toBeCloseTo(100 * 1.12 ** (1 / 12) + 10, 12);
  });
  it("restores validated configuration only and rejects unsafe or oversized imports", () => {
    expect(
      readWorkspace(
        JSON.stringify({
          version: 1,
          config,
          journal: [],
          results: { forged: true },
        }),
      ),
    ).toEqual({ version: 1, config, journal: [] });
    expect(() => readWorkspace("x".repeat(2000001))).toThrow(/2 MB/);
    expect(() =>
      readWorkspace(
        JSON.stringify({
          version: 1,
          config,
          journal: [
            {
              id: "1",
              title: "x",
              thesis: "a",
              counter: "b",
              evidence: "javascript:alert(1)",
              reviewDate: "2026-10-01",
              createdAt: "2026-09-29",
              status: "open",
            },
          ],
        }),
      ),
    ).toThrow(/http/);
  });
});
