// 带上下界的单纯形上的两个优化问题，替代后端 PyPortfolioOpt(cvxpy) 的求解器：
//   min_volatility： min w'Σw          s.t. Σw=1, lo ≤ w ≤ hi   （凸二次规划）
//   max_sharpe：     max μ'w/√(w'Σw)   s.t. 同上                 （拟凹；KKT 点即全局最优）
// 都用投影梯度法：投影到 {Σw=1, lo≤w≤hi} 用对乘子 λ 二分（精确投影）。
// 维度只有十几个标的，迭代几千次也在毫秒级。

import { dot, quad } from "./stats";

/** 把向量 v 投影到 {Σw = 1, lo ≤ w_i ≤ hi}（欧氏距离最近点）。不可行时抛错。 */
export function projectBoundedSimplex(v: number[], lo: number, hi: number): number[] {
  const n = v.length;
  if (lo * n > 1 + 1e-12 || hi * n < 1 - 1e-12) {
    throw new Error(
      `权重上限 ${(hi * 100).toFixed(0)}% × ${n} 个标的不足 100%，约束无解；请增加标的或放宽上限`
    );
  }
  const clip = (x: number) => Math.min(hi, Math.max(lo, x));
  const total = (lam: number) => v.reduce((s, x) => s + clip(x - lam), 0);
  let a = Math.min(...v) - hi - 1;
  let b = Math.max(...v) - lo + 1;
  for (let k = 0; k < 200; k++) {
    const m = (a + b) / 2;
    if (total(m) > 1) a = m;
    else b = m;
  }
  const lam = (a + b) / 2;
  return v.map((x) => clip(x - lam));
}

function lipschitz(S: number[][]): number {
  // 2·λmax(Σ) 的上界：2·迹（对称半正定矩阵的最大特征值 ≤ 迹）
  let tr = 0;
  for (let i = 0; i < S.length; i++) tr += S[i][i];
  return 2 * tr;
}

export function minVolatility(S: number[][], lo: number, hi: number): number[] {
  const n = S.length;
  const L = lipschitz(S) || 1;
  let w = projectBoundedSimplex(new Array(n).fill(1 / n), lo, hi);
  let y = w.slice();
  let tk = 1;
  for (let it = 0; it < 20000; it++) {
    // FISTA
    const g = S.map((row) => 2 * dot(row, y));
    const wNew = projectBoundedSimplex(
      y.map((yi, i) => yi - g[i] / L),
      lo,
      hi
    );
    const tNew = (1 + Math.sqrt(1 + 4 * tk * tk)) / 2;
    y = wNew.map((x, i) => x + ((tk - 1) / tNew) * (x - w[i]));
    const diff = Math.max(...wNew.map((x, i) => Math.abs(x - w[i])));
    w = wNew;
    tk = tNew;
    if (diff < 1e-13) break;
  }
  return w;
}

export function maxSharpe(mu: number[], S: number[][], lo: number, hi: number, rf = 0): number[] {
  const ex = mu.map((m) => m - rf);
  if (!ex.some((m) => m > 0)) {
    throw new Error("至少要有一个标的的历史期望收益高于无风险利率，最大夏普无解");
  }
  const n = mu.length;
  const sharpe = (w: number[]) => {
    const v = quad(w, S);
    return v > 0 ? dot(ex, w) / Math.sqrt(v) : -Infinity;
  };
  const grad = (w: number[]) => {
    const v = quad(w, S);
    const sd = Math.sqrt(v);
    const r = dot(ex, w);
    const Sw = S.map((row) => dot(row, w));
    return w.map((_, i) => ex[i] / sd - (r * Sw[i]) / (v * sd));
  };
  // 多起点：等权 + 每个正超额标的的「尽量集中」起点，取最优
  const starts: number[][] = [new Array(n).fill(1 / n)];
  ex.forEach((m, i) => {
    if (m > 0) {
      const s = new Array(n).fill(0);
      s[i] = 1;
      starts.push(s);
    }
  });
  let best: number[] | null = null;
  let bestVal = -Infinity;
  for (const s0 of starts) {
    let w = projectBoundedSimplex(s0, lo, hi);
    let step = 1;
    let val = sharpe(w);
    for (let it = 0; it < 5000; it++) {
      const g = grad(w);
      let moved = false;
      while (step > 1e-12) {
        const cand = projectBoundedSimplex(w.map((x, i) => x + step * g[i]), lo, hi);
        const cv = sharpe(cand);
        if (cv > val + 1e-15) {
          const diff = Math.max(...cand.map((x, i) => Math.abs(x - w[i])));
          w = cand;
          val = cv;
          step *= 1.5;
          moved = diff > 1e-13;
          break;
        }
        step /= 2;
      }
      if (!moved) break;
    }
    if (val > bestVal) {
      bestVal = val;
      best = w;
    }
  }
  return best as number[];
}
