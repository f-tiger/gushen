import { t } from "../locale";
// 风险画像 / 回测 / 目标可行性 / 凯利 / 杠铃 —— 分别移植自后端
// services/profiling/risk_profile.py、backtest/engine.py、planning/goal.py、planning/kelly.py、
// portfolio/barbell.py 与 api/routes/portfolio.py 的单标的杠铃分支。数字口径逐项对齐。

import { optimize } from "./optimizer";
import { Frame, normCdf, round } from "./stats";

// ---------------- 风险画像（确定性映射，可审计） ----------------

export const QUESTION_KEYS = [
  "horizon",
  "drawdown_tolerance",
  "experience",
  "income_stability",
  "goal",
] as const;

const LEVELS: [number, number, string, string, number][] = [
  [0, 20, "conservative", "min_volatility", 0.2],
  [20, 40, "moderate_conservative", "hrp", 0.25],
  [40, 60, "moderate", "hrp", 0.3],
  [60, 80, "moderate_aggressive", "inverse_vol", 0.35],
  [80, 101, "aggressive", "max_sharpe", 0.4],
];

export interface Profile {
  score: number;
  level: string;
  recommended_method: string;
  max_weight: number;
  target_horizon_years: number;
}

export function scoreAnswers(answers: Record<string, number>): Profile {
  const provided = QUESTION_KEYS.map((k) =>
    Math.max(0, Math.min(3, Math.trunc(Number(answers[k] ?? 0)))),
  );
  const raw = provided.reduce((a, b) => a + b, 0);
  const score = Math.round((raw / (3 * QUESTION_KEYS.length)) * 100);
  const horizon = ({ 0: 1, 1: 3, 2: 7, 3: 15 } as Record<number, number>)[
    provided[0]
  ];
  for (const [lo, hi, level, method, maxW] of LEVELS) {
    if (lo <= score && score < hi) {
      return {
        score,
        level,
        recommended_method: method,
        max_weight: maxW,
        target_horizon_years: horizon,
      };
    }
  }
  return {
    score,
    level: "moderate",
    recommended_method: "hrp",
    max_weight: 0.3,
    target_horizon_years: horizon,
  };
}

// v2 accounting is tested against hand-calculated cases, not the legacy Python bug.
export { backtest } from "./walkforward";
export type { BacktestMetrics } from "./walkforward";

// ---------------- 目标可行性（对数正态，不承诺收益） ----------------

export interface GoalResult {
  initial: number;
  target: number;
  years: number;
  required_cagr: number;
  prob_success: number;
  verdict: string;
  projection: { median: number; p5: number; p95: number };
  message: string;
  assumptions: { expected_return: number; expected_vol: number };
}

function classify(requiredCagr: number): string {
  if (requiredCagr <= 0.12) return "realistic";
  if (requiredCagr <= 0.25) return "aggressive";
  if (requiredCagr <= 0.5) return "very_aggressive";
  return "unrealistic";
}

const TAIL: Record<string, string> = {
  realistic: "该目标与长期股市回报相当，属可努力实现的范围。",
  aggressive: "该目标偏激进，需要较高风险敞口，谨慎评估回撤承受力。",
  very_aggressive: "该目标极其激进，通常伴随大幅回撤甚至重大亏损风险。",
  unrealistic:
    "该目标在分散投资框架下基本无法实现——这种量级的年化回报只有极端杠杆/单一投机才可能短暂博到，期望结果是重大亏损。建议下调目标或拉长期限。",
};

export function analyzeGoal(
  initial: number,
  target: number,
  years: number,
  expectedReturn: number,
  expectedVol: number,
): GoalResult {
  if (
    ![initial, target, years, expectedReturn, expectedVol].every(
      Number.isFinite,
    ) ||
    !(initial > 0) ||
    !(target > 0) ||
    !(years > 0) ||
    expectedVol < 0 ||
    expectedReturn <= -1
  )
    throw new Error(t("初始资金、目标与年限都必须为正数"));
  const requiredCagr = (target / initial) ** (1 / years) - 1;
  let prob: number, median: number, p5: number, p95: number;
  if (expectedVol > 0) {
    const drift =
      Math.log(initial) + (expectedReturn - 0.5 * expectedVol ** 2) * years;
    const sd = expectedVol * Math.sqrt(years);
    const z = (Math.log(target) - drift) / sd;
    prob = 1 - normCdf(z);
    median = Math.exp(drift);
    p5 = Math.exp(drift - 1.645 * sd);
    p95 = Math.exp(drift + 1.645 * sd);
  } else {
    const grown = initial * (1 + expectedReturn) ** years;
    prob = grown >= target ? 1 : 0;
    median = p5 = p95 = grown;
  }
  const verdict = classify(requiredCagr);
  const message =
    t(
      "达成该目标需要年化约 {0}%；在历史参数不变的对数正态模型假设下，情景概率约 {1}%。",
      [(requiredCagr * 100).toFixed(0), (prob * 100).toFixed(1)],
    ) + TAIL[verdict];
  return {
    initial: round(initial, 2),
    target: round(target, 2),
    years,
    required_cagr: round(requiredCagr, 4),
    prob_success: round(prob, 4),
    verdict,
    projection: {
      median: round(median, 2),
      p5: round(p5, 2),
      p95: round(p95, 2),
    },
    message,
    assumptions: {
      expected_return: round(expectedReturn, 4),
      expected_vol: round(expectedVol, 4),
    },
  };
}

// ---------------- 分数凯利 ----------------

export interface KellyResult {
  win_prob: number;
  win_multiple: number;
  loss_fraction: number;
  full_kelly: number;
  fractional_kelly: number;
  capped_fraction: number;
  recommended_amount: number;
  note: string;
}

export function kellyFraction(
  winProb: number,
  winPayoff: number,
  lossFraction = 1,
): number {
  const p = Math.max(0, Math.min(1, winProb));
  const q = 1 - p;
  if (winPayoff <= 0 || lossFraction <= 0) return 0;
  return Math.max(
    0,
    (p * winPayoff - q * lossFraction) / (lossFraction * winPayoff),
  );
}

const pct = (x: number, d: number) => `${(x * 100).toFixed(d)}%`;

export function sizeBet(
  bankroll: number,
  winProb: number,
  winMultiple: number,
  lossFraction = 1,
  kellyScale = 0.25,
  cap = 0.1,
): KellyResult {
  if (!(bankroll > 0)) throw new Error(t("本金必须为正数"));
  if (!(winProb > 0 && winProb < 1)) throw new Error(t("胜率须在 0 到 1 之间"));
  if (!(winMultiple > 1)) throw new Error(t("目标倍数须大于 1"));
  const full = kellyFraction(winProb, winMultiple - 1, lossFraction);
  const frac = full * kellyScale;
  const capped = Math.min(frac, cap);
  const amount = bankroll * capped;
  const note =
    full <= 0
      ? t(
          "在胜率 {0}、目标 {1}x 下，凯利判定为「无正期望优势，不应押注」——要么你的胜率被高估，要么赔率不够。硬去押=长期走向破产。",
          [pct(winProb, 0), winMultiple.toFixed(0)],
        )
      : t(
          "全凯利 {0}，取 {1} 分数凯利后 {2}，封顶 {3} → 建议单注 {4}（¥{5}）。分散到多次不相关押注，单注归零不致命。",
          [
            pct(full, 1),
            pct(kellyScale, 0),
            pct(frac, 1),
            pct(cap, 0),
            pct(capped, 1),
            Math.round(amount).toLocaleString("en-US"),
          ],
        );
  return {
    win_prob: winProb,
    win_multiple: winMultiple,
    loss_fraction: lossFraction,
    full_kelly: round(full, 4),
    fractional_kelly: round(frac, 4),
    capped_fraction: round(capped, 4),
    recommended_amount: round(amount, 2),
    note,
  };
}

// ---------------- 杠铃：多数保命 + 一小块凸性进攻 ----------------

export interface BarbellResult {
  weights: Record<string, number>;
  safe_pct: number;
  risk_pct?: number;
  per_bet_cap?: number;
  note: string;
}

export function buildBarbell(
  core: Frame,
  satellite: Frame | null,
  satSymbols: string[],
  safePct: number,
  perBetCap = 0.1,
): BarbellResult {
  if (!(safePct > 0 && safePct < 1))
    throw new Error(t("保命比例须在 0 到 1 之间"));
  const coreW = optimize(core, "min_volatility").weights;
  if (!satellite) {
    // 单标的进攻端：其余为保命核心（后端路由里的同名分支，不做单注封顶）
    const sym = satSymbols[0];
    const w: Record<string, number> = Object.fromEntries(
      Object.entries(coreW).map(([s, x]) => [s, round(x * safePct, 4)]),
    );
    w[sym] = round((w[sym] ?? 0) + (1 - safePct), 4);
    return {
      weights: w,
      safe_pct: safePct,
      note: t("单标的进攻端；其余为保命核心。归零不致命。"),
    };
  }
  const riskPct = 1 - safePct;
  const satW = optimize(satellite, "momentum").weights;
  const w: Record<string, number> = Object.fromEntries(
    Object.entries(coreW).map(([s, x]) => [s, x * safePct]),
  );
  for (const [s, x] of Object.entries(satW))
    w[s] = (w[s] ?? 0) + Math.min(x * riskPct, perBetCap);
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const weights =
    total > 0
      ? Object.fromEntries(
          Object.entries(w).map(([s, x]) => [s, round(x / total, 4)]),
        )
      : w;
  return {
    weights,
    safe_pct: safePct,
    risk_pct: round(riskPct, 4),
    per_bet_cap: perBetCap,
    note: t(
      "杠铃：{0} 保命核心（min_volatility）+ {1} 进攻 sleeve（momentum，单注封顶 {2}）。进攻端归零不致命，右尾一旦命中由凸性放大。",
      [pct(safePct, 0), pct(riskPct, 0), pct(perBetCap, 0)],
    ),
  };
}
