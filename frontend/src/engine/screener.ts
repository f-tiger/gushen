// 进攻型成长筛选 —— 移植自 backend/app/services/analysis/screener.py 与 technical.py。
// 立场不变：帮你发现并评估高上行标的，不承诺命中；每个候选同时给上行信号与下行风险。
// 纯前端版没有基本面数据，所以 multibagger 模式不融合 FCF yield（后端原本是「尽力取」）。

import { mean, pctChange, round, std, TRADING_DAYS } from "./stats";

export function momentum(p: number[], lookback: number): number {
  if (p.length <= lookback) return NaN;
  return p[p.length - 1] / p[p.length - 1 - lookback] - 1;
}

export function annualizedVol(p: number[]): number {
  return std(pctChange(p)) * Math.sqrt(TRADING_DAYS);
}

export function maxDrawdown(p: number[]): number {
  let peak = -Infinity;
  let mdd = 0;
  for (const v of p) {
    peak = Math.max(peak, v);
    mdd = Math.min(mdd, v / peak - 1);
  }
  return mdd;
}

function smaLast(p: number[], w: number): number | null {
  return p.length >= w ? mean(p.slice(p.length - w)) : null;
}

export function classifyTrend(p: number[]): string {
  const price = p[p.length - 1];
  const ma50 = smaLast(p, 50);
  const ma200 = smaLast(p, 200);
  if (ma50 === null || ma200 === null) return "insufficient_data";
  if (price > ma50 && ma50 > ma200) return "uptrend";
  if (price < ma50 && ma50 < ma200) return "downtrend";
  return "sideways";
}

function near52wHigh(p: number[]): number {
  const w = p.length >= 252 ? p.slice(p.length - 252) : p;
  const hi = Math.max(...w);
  return hi > 0 ? p[p.length - 1] / hi : 0;
}

function breakout(p: number[], lookback = 60): boolean {
  if (p.length < lookback + 1) return false;
  const prior = Math.max(...p.slice(p.length - lookback - 1, p.length - 1));
  return p[p.length - 1] > prior;
}

function growthScore(p: number[]): number {
  if (p.length < 130) return NaN;
  const m3 = momentum(p, 63);
  const m6 = momentum(p, 126);
  const m12 = p.length > 252 ? momentum(p, 252) : m6;
  return 0.25 * m3 + 0.35 * m6 + 0.2 * m12 + 0.15 * (near52wHigh(p) - 1) + 0.05 * (breakout(p) ? 1 : 0);
}

/** 猎多倍股评分（464 只 10 倍股实证）：奖励远离高点、弱化/反转短动量，保留温和中长期趋势。 */
function multibaggerScore(p: number[]): number {
  if (p.length < 130) return NaN;
  const m3 = momentum(p, 63);
  const m6 = momentum(p, 126);
  const m12 = p.length > 252 ? momentum(p, 252) : m6;
  return -0.2 * m3 - 0.15 * m6 + 0.15 * m12 + 0.5 * (1 - near52wHigh(p));
}

export interface ScreenCandidate {
  symbol: string;
  score: number;
  momentum: { "3m": number | null; "6m": number | null; "12m": number | null };
  near_52w_high: number;
  breakout: boolean;
  trend: string;
  risk: { annualized_vol: number; max_drawdown: number };
}

const r4 = (x: number) => (Number.isNaN(x) ? null : round(x, 4));

export function screen(series: Record<string, number[]>, topK = 10, mode: "momentum" | "multibagger" = "momentum"): ScreenCandidate[] {
  const out: (ScreenCandidate & { raw: number })[] = [];
  for (const [symbol, p] of Object.entries(series)) {
    const s = mode === "multibagger" ? multibaggerScore(p) : growthScore(p);
    if (Number.isNaN(s)) continue;
    out.push({
      raw: s,
      symbol,
      score: round(s, 4),
      momentum: { "3m": r4(momentum(p, 63)), "6m": r4(momentum(p, 126)), "12m": r4(p.length > 252 ? momentum(p, 252) : NaN) },
      near_52w_high: round(near52wHigh(p), 4),
      breakout: breakout(p),
      trend: classifyTrend(p),
      risk: { annualized_vol: round(annualizedVol(p), 4), max_drawdown: round(maxDrawdown(p), 4) },
    });
  }
  // 按未取整的分数排序（后端同样按原始分数排）；Array.sort 稳定，平分时保持输入顺序
  out.sort((a, b) => b.raw - a.raw);
  return out.slice(0, topK).map(({ raw: _raw, ...c }) => c);
}
