// Ledoit-Wolf 协方差收缩（目标 = 常数方差 μI），逐行复刻 sklearn.covariance.ledoit_wolf，
// 这正是后端 PyPortfolioOpt CovarianceShrinkage(...).ledoit_wolf() 默认调用的实现。
// 输入：按列的日收益 R[资产][时间]；输出：收缩后的**日**协方差（调用方再 ×252 年化）。

export function ledoitWolf(R: number[][]): { cov: number[][]; shrinkage: number } {
  const p = R.length;
  const n = R[0].length;
  // 去均值（assume_centered=False）
  const X = R.map((col) => {
    let m = 0;
    for (const v of col) m += v;
    m /= n;
    return col.map((v) => v - m);
  });
  // 有偏经验协方差 X'X/n
  const emp = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  for (let i = 0; i < p; i++)
    for (let j = i; j < p; j++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += X[i][t] * X[j][t];
      emp[i][j] = emp[j][i] = s / n;
    }
  if (p === 1) return { cov: emp, shrinkage: 0 };

  const X2 = X.map((c) => c.map((v) => v * v));
  const empTrace = X2.map((c) => c.reduce((a, b) => a + b, 0) / n); // 各列方差
  const mu = empTrace.reduce((a, b) => a + b, 0) / p;

  // delta_ = sum((X'X)²)/n² ；beta_ = sum(X2' X2)
  let deltaRaw = 0;
  let betaRaw = 0;
  for (let i = 0; i < p; i++)
    for (let j = 0; j < p; j++) {
      let xx = 0;
      let x2x2 = 0;
      for (let t = 0; t < n; t++) {
        xx += X[i][t] * X[j][t];
        x2x2 += X2[i][t] * X2[j][t];
      }
      deltaRaw += xx * xx;
      betaRaw += x2x2;
    }
  deltaRaw /= n * n;
  let beta = (1 / (p * n)) * (betaRaw / n - deltaRaw);
  let delta = deltaRaw - 2 * mu * empTrace.reduce((a, b) => a + b, 0) + p * mu * mu;
  delta /= p;
  beta = Math.min(beta, delta);
  const shrinkage = beta === 0 ? 0 : beta / delta;

  const cov = emp.map((row, i) => row.map((v, j) => (1 - shrinkage) * v + (i === j ? shrinkage * mu : 0)));
  return { cov, shrinkage };
}
