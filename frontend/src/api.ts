import { t } from "./locale";
// 纯前端版「接口」：函数名与返回结构和原先的后端 API 保持一致，界面代码不用改；
// 区别是全部在浏览器里计算，数据来自随站发布的 /data/prices.json（见 engine/data.ts）。
// 回看窗口沿用后端路由的默认值：推荐组合 365 天、杠铃 365 天、目标可行性 1095 天、选股 400 天。

import {
  frameFor,
  loadPrices,
  normalize,
  seriesFor,
  type PriceFile,
} from "./engine/data";
import { explainPortfolio as explainTemplate } from "./engine/explain";
import { optimize, type OptimizeResult } from "./engine/optimizer";
import {
  analyzeGoal as analyzeGoalCore,
  backtest,
  buildBarbell as buildBarbellCore,
  scoreAnswers,
  sizeBet,
  type GoalResult,
  type BacktestMetrics,
  type KellyResult,
  type Profile,
} from "./engine/planning";
import { screen, type ScreenCandidate } from "./engine/screener";

export type { ScreenCandidate };

export interface DataInfo {
  asOf: string;
  generated: string;
  source: string;
  symbols: string[];
  stale: string[];
}

export async function dataInfo(): Promise<DataInfo> {
  const p = await loadPrices();
  return {
    asOf: p.asOf,
    generated: p.generated,
    source: p.source,
    symbols: Object.keys(p.close).sort(),
    stale: p.stale ?? [],
  };
}

const skippedNote = (skipped: string[]) =>
  skipped.length ? t("数据集里没有、已跳过：{0}。", [skipped.join(", ")]) : "";

// ---- 进攻工具 ----

export async function screenStocks(
  symbols: string[],
  mode: "momentum" | "multibagger",
): Promise<{ mode: string; candidates: ScreenCandidate[]; note: string }> {
  const p: PriceFile = await loadPrices();
  const series: Record<string, number[]> = {};
  const skipped: string[] = [];
  for (const s of normalize(symbols)) {
    const x = seriesFor(p, s, 400);
    if (x) series[s] = x;
    else skipped.push(s);
  }
  if (!Object.keys(series).length)
    throw new Error(t("无可用行情数据。") + skippedNote(skipped));
  const candidates = screen(series, 10, mode);
  const base =
    mode === "multibagger"
      ? t(
          "回撤与趋势模式：奖励远离高点、弱化短动量；仅按价格规则评分，未使用基本面数据，分数不是上涨概率。",
        )
      : t("momentum 模式：追当前上行强度，非预测；高分通常高波动。");
  return {
    mode,
    candidates,
    note: base + t(" 集中押注上行大、下行也大。") + skippedNote(skipped),
  };
}

export type KellyResponse = KellyResult;

export async function kellySize(
  bankroll: number,
  win_prob: number,
  win_multiple: number,
): Promise<KellyResponse> {
  return sizeBet(bankroll, win_prob, win_multiple);
}

export interface BarbellResponse {
  weights: Record<string, number>;
  safe_pct: number;
  note?: string;
}

export async function buildBarbell(
  core_symbols: string[],
  satellite_symbols: string[],
  safe_pct: number,
): Promise<BarbellResponse> {
  const p = await loadPrices();
  const sat = normalize(satellite_symbols);
  if (!sat.length) throw new Error(t("进攻端至少需要 1 个标的"));
  const core = frameFor(p, core_symbols, 365);
  let satFrame = null;
  let skipped = core.skipped;
  if (sat.length >= 2) {
    const f = frameFor(p, sat, 365);
    satFrame = f.frame;
    skipped = skipped.concat(f.skipped);
  } else if (!p.close[sat[0]]) {
    throw new Error(t("数据集里没有 {0}。可选代码见页面底部。", [sat[0]]));
  }
  try {
    const r = buildBarbellCore(core.frame, satFrame, sat, safe_pct);
    return { ...r, note: (r.note ?? "") + skippedNote(skipped) };
  } catch (e) {
    throw new Error(
      t("杠铃构造失败: {0}", [e instanceof Error ? e.message : e]),
    );
  }
}

// ---- 智能投顾 ----

export interface RecommendResponse {
  profile: Profile;
  portfolio: OptimizeResult;
  skipped?: string[];
}

export async function recommend(
  answers: Record<string, number>,
  symbols: string[],
): Promise<RecommendResponse> {
  const profile = scoreAnswers(answers);
  const p = await loadPrices();
  const { frame, skipped } = frameFor(p, symbols, 365);
  try {
    const portfolio = optimize(frame, profile.recommended_method, [
      0,
      profile.max_weight,
    ]);
    return { profile, portfolio, skipped };
  } catch (e) {
    throw new Error(t("优化失败: {0}", [e instanceof Error ? e.message : e]));
  }
}

export type GoalResponse = GoalResult & {
  evaluation: BacktestMetrics;
  equalWeight: BacktestMetrics;
  skipped: string[];
};

export async function analyzeGoal(
  initial: number,
  target: number,
  years: number,
  symbols: string[],
): Promise<GoalResponse> {
  const p = await loadPrices();
  const { frame, skipped } = frameFor(p, symbols, 1095);
  // v2: prior data, next monthly session close, drifting holdings, explicit costs.
  const bt = backtest(frame, "hrp");
  const model = analyzeGoalCore(
    initial,
    target,
    years,
    bt.annual_arithmetic_return,
    bt.annual_volatility,
  );
  return {
    ...model,
    evaluation: bt,
    equalWeight: backtest(frame, "equal_weight"),
    skipped,
  };
}

export async function explainPortfolio(
  profile: RecommendResponse["profile"],
  portfolio: RecommendResponse["portfolio"],
): Promise<{ source: string; explanation: string }> {
  return explainTemplate(profile, portfolio);
}
