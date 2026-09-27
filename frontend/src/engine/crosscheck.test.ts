// 前端引擎 vs 后端 Python 原版的逐项对照。基准由 scripts/crosscheck/make_fixture.py 用后端代码生成。
// 容差：解析式/确定性步骤（等权、逆波动、动量、HRP、凯利、目标、选股）要求到取整精度一致；
// 均值方差两法后端用 cvxpy 求解器、这里用投影梯度，允许权重差 ≤ 0.002。
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frameFor, seriesFor, type PriceFile } from "./data";
import { explainPortfolio } from "./explain";
import { optimize } from "./optimizer";
import { analyzeGoal, backtest, buildBarbell, scoreAnswers, sizeBet } from "./planning";
import { screen } from "./screener";

const dir = new URL("./__fixtures__/", import.meta.url);
const P: PriceFile = JSON.parse(readFileSync(new URL("prices.synthetic.json", dir), "utf8"));
const E = JSON.parse(readFileSync(new URL("expected.json", dir), "utf8"));

const close = (a: number, b: number, tol: number, what: string) =>
  expect(Math.abs(a - b), `${what}: ts=${a} py=${b}`).toBeLessThanOrEqual(tol);

function sameWeights(ts: Record<string, number>, py: Record<string, number>, tol: number, what: string) {
  const keys = new Set([...Object.keys(ts), ...Object.keys(py)]);
  for (const k of keys) close(ts[k] ?? 0, py[k] ?? 0, tol, `${what} ${k}`);
}

const exact = new Set(["equal_weight", "inverse_vol", "momentum", "hrp"]);

describe("optimize", () => {
  for (const c of E.optimize) {
    it(`${c.method} ${c.symbols.join(",")} ${c.days}d bounds=${c.bounds}`, () => {
      const { frame } = frameFor(P, c.symbols, c.days);
      const r = optimize(frame, c.method, c.bounds);
      const tol = exact.has(c.method) ? 1e-4 : 2e-3;
      sameWeights(r.weights, c.result.weights, tol, c.method);
      close(r.expected_annual_return, c.result.expected_annual_return, exact.has(c.method) ? 1e-4 : 2e-3, "ret");
      close(r.annual_volatility, c.result.annual_volatility, exact.has(c.method) ? 1e-4 : 2e-3, "vol");
      if (exact.has(c.method)) expect(Object.keys(r.weights)).toEqual(Object.keys(c.result.weights));
    });
  }
});

describe("risk profile + recommend + explain", () => {
  E.recommend.forEach((c: any, i: number) => {
    it(`answers #${i} → ${c.profile.level}`, () => {
      const prof = scoreAnswers(c.answers);
      expect(prof).toEqual(c.profile);
      const { frame } = frameFor(P, c.symbols, 365);
      const r = optimize(frame, prof.recommended_method, [0, prof.max_weight]);
      const tol = exact.has(prof.recommended_method) ? 1e-4 : 2e-3;
      sameWeights(r.weights, c.portfolio.weights, tol, prof.recommended_method);
    });
  });
  E.explain.forEach((c: any, i: number) => {
    it(`explain #${i} matches the backend template byte for byte`, () => {
      expect(explainPortfolio(c.profile, c.portfolio).explanation).toBe(c.result.explanation);
    });
  });
});

describe("backtest + goal", () => {
  for (const c of E.backtest) {
    it(`backtest ${c.method}`, () => {
      const { frame } = frameFor(P, c.symbols, c.days);
      const m = backtest(frame, c.method);
      expect(m.n_rebalances).toBe(c.metrics.n_rebalances);
      close(m.cagr, c.raw.cagr, 1e-6, "cagr");
      close(m.annual_volatility, c.raw.vol, 1e-6, "vol");
      close(m.max_drawdown, c.metrics.max_drawdown, 1e-4, "mdd");
    });
  }
  for (const c of E.goal) {
    it(`goal ${c.initial}→${c.target} in ${c.years}y`, () => {
      const { frame } = frameFor(P, c.symbols, 1095);
      const bt = backtest(frame, "hrp");
      const g = analyzeGoal(c.initial, c.target, c.years, bt.cagr, bt.annual_volatility);
      expect(g.verdict).toBe(c.result.verdict);
      expect(g.assumptions).toEqual(c.result.assumptions);
      close(g.prob_success, c.result.prob_success, 1e-4, "prob");
      close(g.required_cagr, c.result.required_cagr, 1e-9, "required");
      for (const k of ["median", "p5", "p95"] as const) close(g.projection[k], c.result.projection[k], 0.02, k);
      expect(g.message).toBe(c.result.message);
    });
  }
});

describe("kelly", () => {
  for (const c of E.kelly) {
    it(`kelly ${c.args}`, () => {
      const [b, p, m] = c.args;
      const r = sizeBet(b, p, m);
      expect(r.full_kelly).toBe(c.result.full_kelly);
      expect(r.capped_fraction).toBe(c.result.capped_fraction);
      expect(r.recommended_amount).toBe(c.result.recommended_amount);
      expect(r.note).toBe(c.result.note);
    });
  }
});

describe("barbell", () => {
  for (const c of E.barbell) {
    it(`barbell sat=${c.sat.join(",")}`, () => {
      const core = frameFor(P, c.core, 365).frame;
      const sat = c.sat.length >= 2 ? frameFor(P, c.sat, 365).frame : null;
      const r = buildBarbell(core, sat, c.sat, c.safe);
      sameWeights(r.weights, c.result.weights, 2e-3, "barbell");
    });
  }
});

describe("screener", () => {
  for (const c of E.screen) {
    it(`screen ${c.mode}`, () => {
      const series: Record<string, number[]> = {};
      for (const s of c.symbols) series[s] = seriesFor(P, s, c.days)!;
      const r = screen(series, 10, c.mode);
      expect(r.map((x) => x.symbol)).toEqual(c.result.map((x: any) => x.symbol));
      r.forEach((x, i) => {
        const y = c.result[i];
        close(x.score, y.score, 1e-4, `${x.symbol} score`);
        expect(x.trend).toBe(y.trend);
        expect(x.breakout).toBe(y.breakout);
        close(x.risk.max_drawdown, y.risk.max_drawdown, 1e-4, "mdd");
        close(x.risk.annualized_vol, y.risk.annualized_vol, 1e-4, "vol");
      });
    });
  }
});
