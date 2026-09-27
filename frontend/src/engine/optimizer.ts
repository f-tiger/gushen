// 组合优化引擎 —— 移植自 backend/app/services/portfolio/optimizer.py（本项目技术核心）。
// 原则不变：不裸用历史均值方差；默认 HRP / 风险平价；均值方差类用 Ledoit-Wolf 收缩。
// 所有指标都是「历史估算，非未来预测」。

import { hrpWeights } from "./hrp";
import { ledoitWolf } from "./ledoitWolf";
import { maxSharpe, minVolatility } from "./solver";
import { covMatrix, dot, Frame, mean, pctChange, quad, round, std, TRADING_DAYS } from "./stats";

export const METHODS = ["hrp", "inverse_vol", "min_volatility", "max_sharpe", "equal_weight", "momentum"] as const;
export type Method = (typeof METHODS)[number];

export interface OptimizeResult {
  method: string;
  weights: Record<string, number>;
  expected_annual_return: number;
  annual_volatility: number;
  sharpe_ratio: number;
}

/** 丢弃极小权重并归一化（同后端 _clean）。 */
function clean(weights: Record<string, number>, cutoff = 1e-4): Record<string, number> {
  const w: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) if (Math.abs(v) > cutoff) w[k] = v;
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  if (total <= 0) {
    const n = Object.keys(weights).length;
    return Object.fromEntries(Object.keys(weights).map((k) => [k, round(1 / n, 4)]));
  }
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, round(v / total, 4)]));
}

/** PyPortfolioOpt clean_weights(cutoff=1e-4, rounding=5)。 */
function pypfoptClean(cols: string[], w: number[]): Record<string, number> {
  return Object.fromEntries(cols.map((c, i) => [c, Math.abs(w[i]) < 1e-4 ? 0 : round(w[i], 5)]));
}

function returnsOf(f: Frame): number[][] {
  return f.px.map(pctChange);
}

function performance(weights: Record<string, number>, f: Frame, rf = 0): [number, number, number] {
  const cols = Object.keys(weights);
  const R = cols.map((c) => pctChange(f.px[f.cols.indexOf(c)]));
  const w = cols.map((c) => weights[c]);
  const annRet = dot(w, R.map(mean)) * TRADING_DAYS;
  const annVol = Math.sqrt(quad(w, covMatrix(R))) * Math.sqrt(TRADING_DAYS);
  const sharpe = annVol > 0 ? (annRet - rf) / annVol : 0;
  return [annRet, annVol, sharpe];
}

function equalWeight(f: Frame): Record<string, number> {
  return Object.fromEntries(f.cols.map((c) => [c, 1 / f.cols.length]));
}

/** 进攻型动量集中：只留动量最强的 top_k 个，按正动量加权。⚠️ 高集中 = 高上行也高下行。 */
function momentumWeights(f: Frame, lookback = 126, topK = 3): Record<string, number> {
  const T = f.dates.length;
  if (T <= lookback) return equalWeight(f);
  const mom = f.px.map((p) => Math.max(0, p[T - 1] / p[T - 1 - lookback] - 1));
  const order = mom.map((m, i) => ({ m, i })).sort((a, b) => b.m - a.m);
  const k = Math.max(1, Math.min(topK, f.cols.length));
  const winners = order.slice(0, k);
  const total = winners.reduce((s, x) => s + x.m, 0);
  if (total <= 0) return equalWeight(f);
  const keep = new Map(winners.map((x) => [x.i, x.m]));
  return Object.fromEntries(f.cols.map((c, i) => [c, (keep.get(i) ?? 0) / total]));
}

/** 逆波动率加权 —— 风险平价的轻量近似。 */
function inverseVol(f: Frame): Record<string, number> {
  const inv = returnsOf(f).map((r) => {
    const s = std(r);
    return s > 0 && Number.isFinite(s) ? 1 / s : 0;
  });
  const total = inv.reduce((a, b) => a + b, 0);
  if (total <= 0) return equalWeight(f);
  return Object.fromEntries(f.cols.map((c, i) => [c, inv[i] / total]));
}

function pypfoptOptimize(f: Frame, method: Method, bounds: [number, number]): Record<string, number> {
  const R = returnsOf(f);
  if (method === "hrp") {
    const w = hrpWeights(covMatrix(R));
    // HRPOpt 的结果按代码排序（hrp.sort_index()）
    const sorted = f.cols.map((c, i) => ({ c, w: w[i] })).sort((a, b) => (a.c < b.c ? -1 : a.c > b.c ? 1 : 0));
    return pypfoptClean(sorted.map((x) => x.c), sorted.map((x) => x.w));
  }
  // 均值方差族：CAGR 期望收益 + Ledoit-Wolf 收缩协方差（年化）
  const T = R[0].length;
  const mu = R.map((r) => r.reduce((p, x) => p * (1 + x), 1) ** (TRADING_DAYS / T) - 1);
  const S = ledoitWolf(R).cov.map((row) => row.map((v) => v * TRADING_DAYS));
  const [lo, hi] = bounds;
  const w = method === "min_volatility" ? minVolatility(S, lo, hi) : maxSharpe(mu, S, lo, hi, 0);
  return pypfoptClean(f.cols, w);
}

/** 对给定价格帧求解目标权重。f：已按交易日取交集、无缺失。 */
export function optimize(
  f: Frame,
  method: string = "hrp",
  weightBounds: [number, number] = [0, 1],
  riskFree = 0
): OptimizeResult {
  if (!(METHODS as readonly string[]).includes(method)) {
    throw new Error(`未知方法 ${method}，可选：${METHODS.join(", ")}`);
  }
  if (f.cols.length < 2) throw new Error("组合至少需要 2 个标的");
  let raw: Record<string, number>;
  if (method === "equal_weight") raw = equalWeight(f);
  else if (method === "inverse_vol") raw = inverseVol(f);
  else if (method === "momentum") raw = momentumWeights(f);
  else raw = pypfoptOptimize(f, method as Method, weightBounds);

  const weights = clean(raw);
  const [r, v, s] = performance(weights, f, riskFree);
  return {
    method,
    weights,
    expected_annual_return: round(r, 4),
    annual_volatility: round(v, 4),
    sharpe_ratio: round(s, 4),
  };
}
