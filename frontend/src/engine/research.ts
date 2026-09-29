import { t } from "../locale";
import { frameFor, type PriceFile } from "./data";
import {
  covMatrix,
  pctChange,
  quad,
  std,
  TRADING_DAYS,
  type Frame,
} from "./stats";
import { backtest, type BacktestMetrics, type CurvePoint } from "./walkforward";

export interface Holding {
  symbol: string;
  weight: number;
}
export interface ResearchConfig {
  name: string;
  holdings: Holding[];
  capital: number;
  historyDays: number;
  costBps: number;
  rebalanceMonths: 1 | 3;
}
export interface JournalEntry {
  id: string;
  title: string;
  thesis: string;
  counter: string;
  evidence: string;
  reviewDate: string;
  status: "open" | "reviewed";
  createdAt: string;
}
export interface Workspace {
  version: 1;
  config: ResearchConfig;
  journal: JournalEntry[];
}
export const DEFAULT_CONFIG: ResearchConfig = {
  name: "跨资产示例",
  holdings: [
    { symbol: "SPY", weight: 35 },
    { symbol: "QQQ", weight: 25 },
    { symbol: "GLD", weight: 20 },
    { symbol: "TLT", weight: 20 },
  ],
  capital: 100000,
  historyDays: 1095,
  costBps: 5,
  rebalanceMonths: 1,
};
export const PRESETS = [
  {
    name: "跨资产示例",
    note: "观察股票、黄金与债券 ETF 的共同表现。",
    holdings: DEFAULT_CONFIG.holdings,
  },
  {
    name: "AI 产业示例",
    note: "观察相关股票的集中与同涨同跌风险。",
    holdings: [
      { symbol: "NVDA", weight: 25 },
      { symbol: "MSFT", weight: 25 },
      { symbol: "GOOGL", weight: 25 },
      { symbol: "AMZN", weight: 25 },
    ],
  },
  {
    name: "宽基与卫星示例",
    note: "比较宽基、主题与其他资产的配置影响。",
    holdings: [
      { symbol: "SPY", weight: 50 },
      { symbol: "QQQ", weight: 20 },
      { symbol: "GLD", weight: 15 },
      { symbol: "TLT", weight: 15 },
    ],
  },
];
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const number = (v: unknown, lo: number, hi: number) =>
  typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
export function validateConfig(value: unknown): ResearchConfig {
  if (!object(value)) throw new Error(t("配置格式不正确"));
  const v = value;
  if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 80)
    throw new Error(t("研究名称须为 1–80 个字符"));
  if (
    !Array.isArray(v.holdings) ||
    v.holdings.length < 2 ||
    v.holdings.length > 10
  )
    throw new Error(t("请保留 2–10 个标的"));
  const holdings = v.holdings.map((h) => {
    if (
      !object(h) ||
      typeof h.symbol !== "string" ||
      !number(h.weight, 0.01, 100)
    )
      throw new Error(t("每个标的的权重须大于 0 且不超过 100%"));
    const symbol = h.symbol.trim().toUpperCase().replace(/\./g, "-");
    if (!/^[A-Z0-9-]{1,10}$/.test(symbol))
      throw new Error(t("请输入有效的标的代码"));
    return { symbol, weight: h.weight as number };
  });
  if (new Set(holdings.map((h) => h.symbol)).size !== holdings.length)
    throw new Error(t("标的不能重复"));
  if (Math.abs(holdings.reduce((s, h) => s + h.weight, 0) - 100) > 0.005)
    throw new Error(t("权重合计须为 100%，可使用「平均分配」"));
  if (!number(v.capital, 100, 1e10))
    throw new Error(t("模拟本金须在 100–100 亿美元之间"));
  if (![365, 730, 1095, 1460].includes(v.historyDays as number))
    throw new Error(t("历史窗口无效"));
  if (!number(v.costBps, 0, 100))
    throw new Error(t("单边交易成本须在 0–100 基点之间"));
  if (v.rebalanceMonths !== 1 && v.rebalanceMonths !== 3)
    throw new Error(t("换仓频率无效"));
  return {
    name: v.name.trim(),
    holdings,
    capital: v.capital as number,
    historyDays: v.historyDays as number,
    costBps: v.costBps as number,
    rebalanceMonths: v.rebalanceMonths,
  };
}
export function readWorkspace(text: string): Workspace {
  if (text.length > 2_000_000)
    throw new Error(t("文件超过 2 MB，请导入研究配置 JSON"));
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t("无法读取 JSON 文件"));
  }
  if (!object(raw) || raw.version !== 1)
    throw new Error(t("不支持的研究文件版本"));
  const config = validateConfig(raw.config);
  if (!Array.isArray(raw.journal) || raw.journal.length > 50)
    throw new Error(t("日志格式无效，最多保存 50 条"));
  const journal: JournalEntry[] = raw.journal.map((x) => {
    if (
      !object(x) ||
      ![
        "id",
        "title",
        "thesis",
        "counter",
        "evidence",
        "reviewDate",
        "createdAt",
      ].every((k) => typeof x[k] === "string") ||
      !["open", "reviewed"].includes(String(x.status))
    )
      throw new Error(t("日志记录格式无效"));
    const j = x as unknown as JournalEntry;
    if (
      j.id.length > 100 ||
      j.title.length > 120 ||
      j.thesis.length > 4000 ||
      j.counter.length > 4000 ||
      j.evidence.length > 2000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(j.reviewDate) ||
      !Number.isFinite(Date.parse(j.createdAt))
    )
      throw new Error(t("日志字段过长或日期无效"));
    if (j.evidence && !/^https?:\/\//i.test(j.evidence))
      throw new Error(t("证据链接只支持 http 或 https"));
    return {
      id: j.id,
      title: j.title,
      thesis: j.thesis,
      counter: j.counter,
      evidence: j.evidence,
      reviewDate: j.reviewDate,
      status: j.status,
      createdAt: j.createdAt,
    };
  });
  if (new Set(journal.map((j) => j.id)).size !== journal.length)
    throw new Error(t("日志编号重复"));
  return { version: 1, config, journal };
}
export interface RiskView {
  concentration: number;
  effectiveHoldings: number;
  largest: Holding;
  correlations: (number | null)[][];
  contribution: (number | null)[];
  assets: {
    symbol: string;
    totalReturn: number;
    volatility: number;
    maxDrawdown: number;
  }[];
}
export function riskView(f: Frame, holdings: Holding[]): RiskView {
  const weights = f.cols.map(
      (s) => holdings.find((h) => h.symbol === s)!.weight / 100,
    ),
    R = f.px.map(pctChange),
    cov = covMatrix(R),
    variance = quad(weights, cov);
  const correlations = cov.map((row, i) =>
    row.map((v, j) =>
      cov[i][i] > 1e-20 && cov[j][j] > 1e-20
        ? Math.max(-1, Math.min(1, v / Math.sqrt(cov[i][i] * cov[j][j])))
        : null,
    ),
  );
  const concentration = weights.reduce((s, w) => s + w * w, 0);
  return {
    concentration,
    effectiveHoldings: 1 / concentration,
    largest: [...holdings].sort((a, b) => b.weight - a.weight)[0],
    correlations,
    contribution: weights.map((w, i) =>
      variance > 1e-20
        ? (w * cov[i].reduce((s, c, j) => s + c * weights[j], 0)) / variance
        : null,
    ),
    assets: f.cols.map((symbol, i) => {
      let peak = f.px[i][0],
        mdd = 0;
      for (const p of f.px[i]) {
        peak = Math.max(peak, p);
        mdd = Math.min(mdd, p / peak - 1);
      }
      return {
        symbol,
        totalReturn: f.px[i][f.px[i].length - 1] / f.px[i][0] - 1,
        volatility: std(R[i]) * Math.sqrt(TRADING_DAYS),
        maxDrawdown: mdd,
      };
    }),
  };
}
export function monthlyReturns(
  curve: CurvePoint[],
): { month: string; ret: number }[] {
  let prev = curve[0].nav;
  const ends = new Map<string, number>();
  for (const p of curve.slice(1)) ends.set(p.date.slice(0, 7), p.nav);
  return [...ends].map(([month, nav]) => {
    const ret = nav / prev - 1;
    prev = nav;
    return { month, ret };
  });
}
export function underwater(curve: CurvePoint[]): {
  longestSessions: number;
  currentSessions: number;
  worstDate: string;
} {
  let longest = 0,
    current = 0,
    worst = curve[0];
  for (const p of curve.slice(1)) {
    current = p.drawdown < -1e-10 ? current + 1 : 0;
    longest = Math.max(longest, current);
    if (p.drawdown < worst.drawdown) worst = p;
  }
  return {
    longestSessions: longest,
    currentSessions: current,
    worstDate: worst.date,
  };
}
export function stressImpact(
  holdings: Holding[],
  shocks: Record<string, number>,
  capital: number,
) {
  if (!Number.isFinite(capital) || capital <= 0)
    throw new Error(t("模拟本金无效"));
  const parts = holdings.map((h) => {
    const shock = shocks[h.symbol] ?? 0;
    if (!Number.isFinite(shock) || shock < -100 || shock > 200)
      throw new Error(t("冲击假设须在 -100%–200% 之间"));
    return {
      symbol: h.symbol,
      shock,
      pct: ((h.weight / 100) * shock) / 100,
      amount: (((capital * h.weight) / 100) * shock) / 100,
    };
  });
  const change = parts.reduce((s, x) => s + x.amount, 0);
  return { parts, change, after: capital + change, return: change / capital };
}
export function contributionProjection(
  initial: number,
  monthly: number,
  years: number,
  annual: number,
) {
  if (
    ![initial, monthly, years, annual].every(Number.isFinite) ||
    initial < 0 ||
    monthly < 0 ||
    years <= 0 ||
    years > 50 ||
    annual <= -1 ||
    annual > 1
  )
    throw new Error(t("请检查本金、月投入、年限（不超过 50 年）和年增长率"));
  const months = Math.round(years * 12),
    rate = (1 + annual) ** (1 / 12) - 1;
  let value = initial;
  const path = [{ year: 0, value, paid: initial }];
  for (let m = 1; m <= months; m++) {
    value = value * (1 + rate) + monthly;
    if (m % 12 === 0 || m === months)
      path.push({ year: m / 12, value, paid: initial + monthly * m });
  }
  return { value, paid: initial + monthly * months, path };
}
export interface StrategyResult {
  id: string;
  name: string;
  color: string;
  metrics: BacktestMetrics;
}
export interface ResearchResult {
  config: ResearchConfig;
  source: {
    asOf: string;
    generated: string;
    description: string;
    stale: string[];
  };
  strategies: StrategyResult[];
  risk: RiskView;
  dates: {
    from: string;
    to: string;
    training: number;
    sessions: number;
    availableFrom: string;
  };
  warnings: string[];
}
export function runResearch(
  prices: PriceFile,
  input: ResearchConfig,
): ResearchResult {
  const config = validateConfig(input),
    symbols = config.holdings.map((h) => h.symbol);
  const { frame, skipped } = frameFor(prices, symbols, config.historyDays);
  if (skipped.length)
    throw new Error(
      t("当前数据不包含 ") + skipped.join("、") + t("，请更换标的后再运行"),
    );
  const lookback = 126;
  if (frame.dates.length < lookback + 21)
    throw new Error(t("共同历史不足：至少需要 126 日预热和 21 个可比较交易日"));
  const total = config.holdings.reduce((s, h) => s + h.weight, 0),
    fixedWeights = Object.fromEntries(
      config.holdings.map((h) => [h.symbol, h.weight / total]),
    );
  const kinds = [
    {
      id: "custom",
      name: t("我的目标权重"),
      color: "#173f68",
      method: "equal_weight",
    },
    {
      id: "equal",
      name: t("同池等权"),
      color: "#ae711b",
      method: "equal_weight",
    },
    { id: "hrp", name: t("层次风险平价"), color: "#127d78", method: "hrp" },
  ];
  const strategies = kinds.map((k) => ({
    id: k.id,
    name: k.name,
    color: k.color,
    metrics: backtest(
      frame,
      k.method,
      lookback,
      config.capital,
      config.costBps,
      [0, 1],
      {
        rebalanceMonths: config.rebalanceMonths,
        fixedWeights: k.id === "custom" ? fixedWeights : undefined,
      },
    ),
  }));
  const riskFrame = {
    cols: frame.cols,
    dates: frame.dates.slice(lookback - 1),
    px: frame.px.map((p) => p.slice(lookback - 1)),
  };
  const stale = (prices.stale ?? []).filter((s) => symbols.includes(s));
  const warnings = [
    t("按当前标的池回看历史，存在选择与幸存者偏差；不是实盘业绩。"),
    t("计入指定单边交易成本；税、额外滑点、现金利息与汇率未建模。"),
  ];
  if (stale.length)
    warnings.unshift(t("沿用上一版行情：") + stale.join("、") + "。");
  return {
    config,
    source: {
      asOf: prices.asOf,
      generated: prices.generated,
      description: prices.source,
      stale,
    },
    strategies,
    risk: riskView(riskFrame, config.holdings),
    dates: {
      from: strategies[0].metrics.from,
      to: strategies[0].metrics.to,
      training: lookback,
      sessions: frame.dates.length - lookback,
      availableFrom: frame.dates[0],
    },
    warnings,
  };
}
