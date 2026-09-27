// 行情数据层 —— 替代后端 services/market（yfinance）。
// 数据来自随站点一起发布的静态文件 /data/prices.json，由 GitHub Actions 每个交易日收盘后
// 用 Yahoo 复权收盘价重建（scripts/build-prices.mjs）。浏览器不直连任何行情接口。
//
// 回看窗口按「数据截止日往前推 N 个自然日」取，等价于后端的 date.today() - lookback_days
// （纯前端没有实时行情，截止日就是文件里的 asOf，界面上明示）。

import type { Frame } from "./stats";

export interface PriceFile {
  asOf: string; // 最后一个交易日
  generated: string; // 生成时间（UTC ISO）
  source: string;
  dates: string[];
  close: Record<string, (number | null)[]>; // 与 dates 等长，缺失为 null
  stale?: string[]; // 本次抓取失败、沿用上次数据的标的
}

let cache: Promise<PriceFile> | null = null;

export function loadPrices(url = `${import.meta.env.BASE_URL}data/prices.json`): Promise<PriceFile> {
  if (!cache) {
    cache = fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`行情数据文件读取失败（HTTP ${r.status}）`);
      return (await r.json()) as PriceFile;
    });
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

/** 测试与脚本用：直接注入数据，绕过 fetch。 */
export function setPrices(p: PriceFile) {
  cache = Promise.resolve(p);
}

function startIso(asOf: string, lookbackDays: number): string {
  const d = new Date(asOf + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - lookbackDays);
  return d.toISOString().slice(0, 10);
}

export function normalize(symbols: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of symbols) {
    const u = s.trim().toUpperCase().replace(/\./g, "-");
    if (u && !seen.has(u)) {
      seen.add(u);
      out.push(u);
    }
  }
  return out;
}

/** 单标的序列（去缺失），同后端 _load_series。 */
export function seriesFor(p: PriceFile, symbol: string, lookbackDays: number): number[] | null {
  const col = p.close[symbol];
  if (!col) return null;
  const start = startIso(p.asOf, lookbackDays);
  const out: number[] = [];
  p.dates.forEach((d, i) => {
    const v = col[i];
    if (d >= start && v !== null && v !== undefined) out.push(v);
  });
  return out.length ? out : null;
}

/** 多标的对齐价格帧（按交易日取交集），同后端 _load_prices：
 *  数据里没有的代码跳过并报告；可用的少于 2 个就报错。 */
export function frameFor(p: PriceFile, symbols: string[], lookbackDays: number): { frame: Frame; skipped: string[] } {
  const syms = normalize(symbols);
  const have = syms.filter((s) => p.close[s]);
  const skipped = syms.filter((s) => !p.close[s]);
  if (have.length < 2) {
    throw new Error(
      `可用行情标的不足 2 个，无法优化。` + (skipped.length ? `数据集里没有：${skipped.join(", ")}。` : "") + "可选代码见页面底部。"
    );
  }
  const start = startIso(p.asOf, lookbackDays);
  const rows: number[] = [];
  p.dates.forEach((d, i) => {
    if (d >= start && have.every((s) => p.close[s][i] !== null && p.close[s][i] !== undefined)) rows.push(i);
  });
  const frame: Frame = {
    dates: rows.map((i) => p.dates[i]),
    cols: have,
    px: have.map((s) => rows.map((i) => p.close[s][i] as number)),
  };
  return { frame, skipped };
}
