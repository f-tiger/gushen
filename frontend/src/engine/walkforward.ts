import { optimize } from './optimizer';
import { Frame, mean, std, TRADING_DAYS } from './stats';

export interface RebalanceRecord {
  signalAsOf: string;
  executionDate: string;
  weights: Record<string, number>;
  turnover: number;
  cost: number;
}
export interface BacktestMetrics {
  total_return: number;
  cagr: number;
  annual_arithmetic_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
  max_drawdown: number;
  n_rebalances: number;
  method_version: string;
  from: string;
  to: string;
  cost_bps: number;
  rebalances: RebalanceRecord[];
}

// Prior-session data -> next available monthly session CLOSE. Positions drift
// between trades; returns before that close belong to the existing holdings.
export function backtest(f: Frame, method = 'hrp', lookbackWindow = 126,
  initial = 100_000, costBps = 5, weightBounds: [number, number] = [0, 1]): BacktestMetrics {
  const T = f.dates.length;
  if (!Number.isInteger(lookbackWindow) || lookbackWindow < 3 || T <= lookbackWindow + 1) throw new Error('历史数据长度不足以覆盖回测窗口');
  if (!Number.isFinite(initial) || initial <= 0 || !Number.isFinite(costBps) || costBps < 0 || costBps >= 5000) throw new Error('本金和成本参数无效');
  if (f.cols.length < 2 || f.px.length !== f.cols.length || new Set(f.cols).size !== f.cols.length ||
    f.px.some(p => p.length !== T || p.some(x => !Number.isFinite(x) || x <= 0)) ||
    f.dates.some((d, i) => !/^\d{4}-\d{2}-\d{2}$/.test(d) || (i > 0 && d <= f.dates[i - 1]))) throw new Error('价格帧必须按日期递增、完整对齐且价格为正');
  let positions = f.cols.map(() => 0), cash = initial, previousNav = initial, peak = initial, mdd = 0;
  const returns: number[] = [], rebalances: RebalanceRecord[] = [];
  for (let t = lookbackWindow; t < T; t++) {
    positions = positions.map((v, i) => v * f.px[i][t] / f.px[i][t - 1]);
    let nav = cash + positions.reduce((a, b) => a + b, 0);
    if (t === lookbackWindow || f.dates[t].slice(0, 7) !== f.dates[t - 1].slice(0, 7)) {
      const window: Frame = { cols: f.cols, dates: f.dates.slice(t - lookbackWindow, t), px: f.px.map(p => p.slice(t - lookbackWindow, t)) };
      // A failed optimizer is reported, never silently replaced by another strategy.
      const raw = optimize(window, method, weightBounds).weights;
      const total = Object.values(raw).reduce((a, b) => a + b, 0);
      if (!(total > 0) || Object.values(raw).some(v => !Number.isFinite(v) || v < 0)) throw new Error('目标权重无效');
      const target = f.cols.map(c => (raw[c] || 0) / total);
      const turnover = target.reduce((sum, w, i) => sum + Math.abs(w - positions[i] / nav), 0);
      const cost = nav * turnover * costBps / 10_000;
      nav -= cost;
      positions = target.map(w => nav * w); cash = 0;
      rebalances.push({ signalAsOf: f.dates[t - 1], executionDate: f.dates[t],
        weights: Object.fromEntries(f.cols.map((c, i) => [c, target[i]])), turnover, cost });
    }
    returns.push(nav / previousNav - 1); previousNav = nav;
    peak = Math.max(peak, nav); mdd = Math.min(mdd, nav / peak - 1);
  }
  const cagr = (previousNav / initial) ** (TRADING_DAYS / returns.length) - 1;
  const annVol = std(returns) * Math.sqrt(TRADING_DAYS);
  return { total_return: previousNav / initial - 1, cagr,
    annual_arithmetic_return: mean(returns) * TRADING_DAYS,
    annual_volatility: annVol, sharpe_ratio: annVol > 0 ? mean(returns) * TRADING_DAYS / annVol : 0,
    max_drawdown: mdd, n_rebalances: rebalances.length, method_version: 'walk-forward-close-v2',
    from: f.dates[lookbackWindow], to: f.dates[T - 1], cost_bps: costBps, rebalances };
}
