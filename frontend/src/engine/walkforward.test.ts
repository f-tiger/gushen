import { describe, it, expect } from 'vitest';
import { optimize } from './optimizer';
import { backtest } from './walkforward';
import { analyzeGoal } from './planning';
const frame = (dates: string[], a: number[], b = a.map(() => 100)) => ({ dates, cols: ['A', 'B'], px: [a, b] });
const dates = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08', '2026-01-09', '2026-01-12'];
describe('self-financing walk-forward accounting', () => {
  it('counts entry cost from original cash even when all prices are flat', () => {
    const r = backtest(frame(dates, dates.map(() => 100)), 'equal_weight', 3, 100, 100);
    expect(r.total_return).toBeCloseTo(-.01, 12); expect(r.max_drawdown).toBeCloseTo(-.01, 12);
    expect(r.rebalances[0].cost).toBeCloseTo(1); expect(r.n_rebalances).toBe(1);
  });
  it('new weights do not receive the execution-day rally before their closing trade', () => {
    const r = backtest(frame(dates, [100, 100, 100, 200, 200, 200]), 'equal_weight', 3, 100, 0);
    expect(r.total_return).toBeCloseTo(0); expect(r.rebalances[0].signalAsOf).toBe('2026-01-07');
  });
  it('holdings drift instead of silently rebalancing every day', () => {
    const r = backtest(frame(dates, [100, 100, 100, 100, 200, 100]), 'equal_weight', 3, 100, 0);
    expect(r.total_return).toBeCloseTo(0, 12); // 50 dollars per stock -> 150 -> 100, not 112.5.
    expect(r.max_drawdown).toBeCloseTo(-1 / 3, 12);
  });
  it('rebalances on first available session after a month starts on a weekend', () => {
    const ds = ['2026-01-27', '2026-01-28', '2026-01-29', '2026-01-30', '2026-02-02', '2026-02-03'];
    const r = backtest(frame(ds, [100, 100, 100, 100, 200, 200]), 'equal_weight', 3, 100, 100);
    expect(r.rebalances.map(x => x.executionDate)).toEqual(['2026-01-30', '2026-02-02']);
    expect(r.rebalances[1].turnover).toBeCloseTo(1 / 3, 12); // drifted 2/3:1/3 -> 1/2:1/2
    expect(r.rebalances[1].cost).toBeCloseTo(.495, 12);
    expect(r.total_return).toBeCloseTo(.48005, 12);
  });
  it('future prices cannot change an already recorded target weight', () => {
    const a = backtest(frame(dates, [100, 102, 101, 105, 110, 100]), 'inverse_vol', 3, 100, 0);
    const b = backtest(frame(dates, [100, 102, 101, 105, 110, 10000]), 'inverse_vol', 3, 100, 0);
    expect(a.rebalances).toEqual(b.rebalances);
  });
  it('rejects missing prices and reports invalid optimizer choices', () => {
    expect(() => backtest(frame(dates, [100, 100, NaN, 100, 100, 100]), 'hrp', 3)).toThrow();
    expect(() => backtest(frame(dates, dates.map(() => 100)), 'unknown', 3)).toThrow();
  });
});
describe('goal model under explicit assumptions', () => {
  it('zero volatility has deterministic results and required CAGR is algebraic', () => {
    const g = analyzeGoal(100, 121, 2, .1, 0);
    expect(g.required_cagr).toBe(.1); expect(g.projection.median).toBe(121); expect(g.prob_success).toBe(1);
    expect(analyzeGoal(100, 122, 2, .1, 0).prob_success).toBe(0);
  });
  it('finite positive capital and finite model parameters are required', () => {
    expect(() => analyzeGoal(100, Infinity, 2, .1, .2)).toThrow();
    expect(() => analyzeGoal(100, 110, 2, .1, -.2)).toThrow();
  });
});

describe('risk-profile position caps', () => {
  const f = frame(dates, [100, 101, 102, 105, 104, 107], [100, 99, 102, 98, 103, 101]);
  it('two assets capped at 50% must each receive 50% for all supported heuristics', () => {
    for (const method of ['hrp', 'inverse_vol', 'momentum', 'equal_weight']) {
      expect(optimize(f, method, [0, .5]).weights).toEqual({ A: .5, B: .5 });
    }
  });
  it('an impossible cap is an error, never a silently oversized holding', () => {
    expect(() => optimize(f, 'hrp', [0, .2])).toThrow(/约束无解/);
  });
});
