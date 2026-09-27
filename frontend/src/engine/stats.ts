// 数值基础件 —— 与后端 pandas/numpy 的口径逐项对齐（见 test/crosscheck.test.ts）。
// 约定：价格帧按「列」存放，px[j][t] = 第 j 个标的在第 t 个交易日的复权收盘价，
// 所有列等长、无缺失（加载时已按交易日取交集，等价于 pandas 的 DataFrame(...).dropna()）。

export const TRADING_DAYS = 252;

export interface Frame {
  dates: string[]; // ISO 日期，升序
  cols: string[]; // 标的代码
  px: number[][]; // px[列][行]
}

/** 与 Python round(x, d) 对齐：toFixed 按二进制值的精确十进制展开取最近，不经过 x·10^d 的乘法误差
 *  （Math.round(x*1e4)/1e4 会在临界值上和 Python 取得不一样，交叉测试当场抓到过）。
 *  唯一差别是恰好落在 .5 的二进制值：Python 取偶，toFixed 取大——这类值在这里几乎不出现。 */
export function round(x: number, d: number): number {
  if (!Number.isFinite(x)) return x;
  const r = Number(x.toFixed(d));
  return r === 0 ? 0 : r; // 去掉 -0
}

export function sum(a: number[]): number {
  let s = 0;
  for (const v of a) s += v;
  return s;
}

export function mean(a: number[]): number {
  return a.length ? sum(a) / a.length : NaN;
}

/** 样本标准差（ddof=1），同 pandas .std()。 */
export function std(a: number[]): number {
  const n = a.length;
  if (n < 2) return NaN;
  const m = mean(a);
  let s = 0;
  for (const v of a) s += (v - m) * (v - m);
  return Math.sqrt(s / (n - 1));
}

/** 简单收益率序列（长度 n-1），同 pandas pct_change().dropna()。 */
export function pctChange(p: number[]): number[] {
  const out: number[] = [];
  for (let t = 1; t < p.length; t++) out.push(p[t] / p[t - 1] - 1);
  return out;
}

/** 样本协方差矩阵（ddof=1），输入为按列的收益。 */
export function covMatrix(R: number[][]): number[][] {
  const n = R.length;
  const T = n ? R[0].length : 0;
  const mu = R.map(mean);
  const C = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let s = 0;
      for (let t = 0; t < T; t++) s += (R[i][t] - mu[i]) * (R[j][t] - mu[j]);
      const v = s / (T - 1);
      C[i][j] = v;
      C[j][i] = v;
    }
  }
  return C;
}

export function corrFromCov(C: number[][]): number[][] {
  const d = C.map((row, i) => Math.sqrt(row[i]));
  return C.map((row, i) => row.map((v, j) => v / (d[i] * d[j])));
}

export function quad(w: number[], C: number[][]): number {
  let s = 0;
  for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) s += w[i] * C[i][j] * w[j];
  return s;
}

export function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** 取帧的若干列（保持给定顺序）。 */
export function selectCols(f: Frame, cols: string[]): Frame {
  const idx = cols.map((c) => f.cols.indexOf(c));
  return { dates: f.dates, cols, px: idx.map((i) => f.px[i]) };
}

/** 取帧的末尾 k 行（同 iloc[-k:]）。 */
export function tailRows(f: Frame, k: number): Frame {
  const start = Math.max(0, f.dates.length - k);
  return { dates: f.dates.slice(start), cols: f.cols, px: f.px.map((c) => c.slice(start)) };
}

/** 取到第 t 行为止（含）的帧（同 loc[:day]）。 */
export function headRows(f: Frame, tInclusive: number): Frame {
  return { dates: f.dates.slice(0, tInclusive + 1), cols: f.cols, px: f.px.map((c) => c.slice(0, tInclusive + 1)) };
}

/** 误差函数（双精度）：|x|≤2.5 用泰勒级数，否则用 erfc 的连分式（Lentz）。 */
export function erf(x: number): number {
  if (x < 0) return -erf(-x);
  if (x <= 2.5) {
    let term = x;
    let s = x;
    const x2 = x * x;
    for (let n = 1; n < 200; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      s += add;
      if (Math.abs(add) < 1e-17 * Math.abs(s)) break;
    }
    return (2 / Math.sqrt(Math.PI)) * s;
  }
  return 1 - erfc(x);
}

function erfc(x: number): number {
  // erfc(x) = exp(-x²)/√π · 1/(x + 1/2/(x + 1/(x + 3/2/(x + ...))))
  const tiny = 1e-300;
  let f = x;
  if (f === 0) f = tiny;
  let C = f;
  let D = 0;
  for (let n = 1; n < 500; n++) {
    const a = n / 2;
    D = x + a * D;
    if (D === 0) D = tiny;
    C = x + a / C;
    if (C === 0) C = tiny;
    D = 1 / D;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}

export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
