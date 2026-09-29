// 构建 frontend/public/data/prices.json —— 纯前端版唯一的行情来源。
// 在 GitHub Actions 上跑（会话沙箱对 Yahoo 限流 429，只有 runner 能抓）。
//
// 规则（零编造）：
//   · 用 Yahoo 复权收盘价（adjclose），与后端 yfinance auto_adjust 同口径；保留最近 4 年。
//   · 单个标的抓不到：沿用上一版文件里的该列，并写进 stale 清单（页面会显示）。
//   · 超过 20% 的标的抓不到，或上一版也没有：退出码 1，不写文件 —— 部署因此中止，线上保持原样。
//   · 上一版来自环境变量 PREV_URL（部署时指向线上 /data/prices.json）或本地已有文件。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { completedDateCutoff, completedRows } from './completed-session.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "frontend", "public", "data", "prices.json");
const uni = JSON.parse(readFileSync(join(root, "scripts", "universe.json"), "utf8"));
const symbols = [...uni.etf, ...uni.stock];
const UA = "Mozilla/5.0 (X11; Linux x86_64) gushen-price-builder/1.0 (+https://github.com/f-tiger/gushen)";
const KEEP_DAYS = 4 * 366;
const completedCutoff = completedDateCutoff();

async function prev() {
  if (process.env.PREV_URL) {
    try {
      const r = await fetch(process.env.PREV_URL, { headers: { "user-agent": UA } });
      if (r.ok) return await r.json();
      console.log(`previous file: HTTP ${r.status} at ${process.env.PREV_URL}`);
    } catch (e) {
      console.log(`previous file: ${e.message}`);
    }
  }
  return existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
}

async function fetchOne(sym) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5y&interval=1d&events=div%2Csplit`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" } });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) return { error: `HTTP ${r.status}` };
      const j = await r.json();
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp;
      const adj = res?.indicators?.adjclose?.[0]?.adjclose;
      if (!ts || !adj || ts.length !== adj.length) return { error: "no adjclose series" };
      const gmt = res.meta?.gmtoffset ?? 0; // 交易所本地日期
      const rows = ts.map((t, i) => [new Date((t + gmt) * 1000).toISOString().slice(0, 10), adj[i]]);
      return { rows: completedRows(rows, completedCutoff) };
    } catch (e) {
      if (attempt === 4) return { error: e.message };
      await new Promise((ok) => setTimeout(ok, 1500 * attempt));
    }
  }
}

const previous = await prev();
const got = {};
const stale = [];
const failed = [];
for (const s of symbols) {
  const r = await fetchOne(s);
  if (r.rows?.length) got[s] = new Map(r.rows);
  else {
    const col = previous?.close?.[s];
    if (col) {
      got[s] = new Map(completedRows(previous.dates.map((d, i) => [d, col[i]]), completedCutoff));
      stale.push(s);
    } else failed.push(s);
    console.log(`  ${s}: ${r.error}${col ? " → 沿用上一版" : " → 无上一版可用"}`);
  }
  await new Promise((ok) => setTimeout(ok, 250));
}

const bad = stale.length + failed.length;
if (bad > symbols.length * 0.2 || failed.length > symbols.length * 0.2) {
  console.error(`::error::${bad}/${symbols.length} 个标的没抓到（沿用 ${stale.length}、缺失 ${failed.length}），超过 20%，不写文件`);
  process.exit(1);
}

const allDates = [...new Set(Object.values(got).flatMap((m) => [...m.keys()]))].sort();
const asOf = allDates[allDates.length - 1];
const cut = new Date(asOf + "T00:00:00Z");
cut.setUTCDate(cut.getUTCDate() - KEEP_DAYS);
const dates = allDates.filter((d) => d >= cut.toISOString().slice(0, 10));
const close = {};
for (const [s, m] of Object.entries(got)) close[s] = dates.map((d) => (m.has(d) ? Number(m.get(d).toPrecision(8)) : null));

mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify({
    asOf,
    generated: new Date().toISOString(),
    source: "Yahoo Finance 复权收盘价（adjclose），纽约时间 17:00 前排除当日未完成日线",
    dates,
    close,
    stale,
  })
);
console.log(`prices.json: ${Object.keys(close).length} 个标的 · ${dates.length} 个交易日 · 截至 ${asOf}` +
  (stale.length ? ` · 沿用上一版 ${stale.join(",")}` : "") + (failed.length ? ` · 缺失 ${failed.join(",")}` : ""));
