import { t, tr, localizedLink, getLanguage, researchName } from "./locale";
import { useEffect, useRef, useState } from "react";
import { loadPrices, type PriceFile } from "./engine/data";
import {
  DEFAULT_CONFIG,
  PRESETS,
  readWorkspace,
  runResearch,
  validateConfig,
  type ResearchConfig,
  type ResearchResult,
  type JournalEntry,
} from "./engine/research";
import WorkbenchChart, { money, pct } from "./WorkbenchChart";
import { Comparison, Risk, Scenarios, Journal } from "./ResearchViews";
import LegacyAdvisor from "./LegacyAdvisor";
import "./workbench.css";
import LanguageSwitch, { useLanguage } from "./LanguageSwitch";
import "./agi-theme.css";

const STORAGE = "gushen-research-workspace-v1";
const NAV = [
  ["overview", "组合总览", "01"],
  ["compare", "策略比较", "02"],
  ["risk", "风险透视", "03"],
  ["scenarios", "情景推演", "04"],
  ["journal", "研究日志", "05"],
  ["tools", "工具箱", "06"],
  ["method", "方法与数据", "07"],
] as const;
type Page = (typeof NAV)[number][0];
const TITLES: Record<Page, [string, string]> = {
  overview: [
    "先理解组合，再做决定。",
    "从资产配置、历史表现到风险证据，建立可复查的投资研究。",
  ],
  compare: [
    "收益只是结果的一部分。",
    "在相同窗口中比较策略，同时检查交易成本、回撤与持仓漂移。",
  ],
  risk: [
    "看见组合里隐藏的关联。",
    "用集中度、相关性和风险贡献，检查分散是否只是表面现象。",
  ],
  scenarios: [
    "把“如果”变成可以计算的问题。",
    "调整冲击与长期投入假设，观察结果如何变化。",
  ],
  journal: [
    "让每一次判断留下依据。",
    "记录判断、反证和复盘日期，为下一次决策保留上下文。",
  ],
  tools: [
    "按问题选择计算方法。",
    "保留风险问卷、目标模型与专项计算，便于交叉检查。",
  ],
  method: [
    "结果应该经得起追问。",
    "数据来源、计算顺序、适用边界和导出记录，都放在明处。",
  ],
};
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function restore() {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? readWorkspace(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  useLanguage();
  const [saved] = useState(restore),
    [config, setConfig] = useState<ResearchConfig>(
      saved?.config ?? {
        ...structuredClone(DEFAULT_CONFIG),
        name: t(DEFAULT_CONFIG.name),
      },
    ),
    [journal, setJournal] = useState<JournalEntry[]>(saved?.journal ?? []);
  const [prices, setPrices] = useState<PriceFile | null>(null),
    [result, setResult] = useState<ResearchResult | null>(null),
    [page, setPage] = useState<Page>("overview"),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [unsaved, setUnsaved] = useState(false);
  const [hasSaved, setHasSaved] = useState(!!saved);
  const importRef = useRef<HTMLInputElement>(null),
    headingRef = useRef<HTMLHeadingElement>(null);
  const stale =
    !!result && JSON.stringify(config) !== JSON.stringify(result.config);
  useEffect(() => {
    let active = true;
    loadPrices()
      .then((p) => {
        if (!active) return;
        setPrices(p);
        setResult(runResearch(p, config));
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!unsaved) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [unsaved]);
  function edit(next: ResearchConfig) {
    setConfig(next);
    setUnsaved(true);
    setError("");
    setNotice("");
  }
  function navigate(p: Page) {
    setPage(p);
    setTimeout(() => headingRef.current?.focus(), 0);
  }
  function run() {
    setError("");
    setBusy(true);
    setTimeout(() => {
      try {
        if (!prices) throw new Error(t("行情尚未加载，请稍后重试"));
        const c = validateConfig(config);
        setResult(runResearch(prices, c));
        setConfig(c);
        setEditing(false);
        setNotice(t("研究已更新：三种策略使用相同窗口。"));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 30);
  }
  function save() {
    try {
      const workspace = readWorkspace(
        JSON.stringify({ version: 1, config, journal }),
      );
      localStorage.setItem(STORAGE, JSON.stringify(workspace));
      setUnsaved(false);
      setHasSaved(true);
      setNotice(
        t("已保存到当前浏览器。清理浏览器数据会删除记录，请导出备份。"),
      );
      setError("");
    } catch (e) {
      setError(t("保存失败：{0}", [(e as Error).message]));
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error(t("文件超过 2 MB"));
      const w = readWorkspace(await file.text());
      setConfig(w.config);
      setJournal(w.journal);
      setResult(null);
      setEditing(true);
      setPage("overview");
      setUnsaved(true);
      setError("");
      setNotice(
        t(
          "配置与日志已导入。请运行研究以计算结果，导入文件中的历史结果不会被采信。",
        ),
      );
    } catch (e) {
      setError(t("导入失败：{0}；现有研究已保留。", [(e as Error).message]));
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  function exportConfig() {
    try {
      download(
        readWorkspace(JSON.stringify({ version: 1, config, journal })),
        "gushen-workspace.json",
      );
      setError("");
      setNotice(t("已导出配置与研究日志。"));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const total = config.holdings.reduce((n, h) => n + h.weight, 0),
    m = result?.strategies[0].metrics;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href={localizedLink("https://agiscorecard.com/cn")}
        >
          <span className="brand-mark" aria-hidden="true" />
          <span>
            {t("AGI 记分牌")}
            <small>{t("股神 / 投资研究")}</small>
          </span>
        </a>
        <div className="sidebar-label">{t("投资研究工作台")}</div>
        <nav aria-label={t("研究功能")}>
          {tr(
            NAV.map(([id, label, num]) => (
              <button
                key={id}
                className={page === id ? "nav-item active" : "nav-item"}
                aria-current={page === id ? "page" : undefined}
                onClick={() => navigate(id)}
              >
                <span>{tr(num)}</span>
                {tr(label)}
                {tr(
                  id === "journal" && journal.length > 0 && (
                    <b>
                      {tr(journal.filter((j) => j.status === "open").length)}
                    </b>
                  ),
                )}
              </button>
            )),
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          {t("浏览器内计算")}
          <p>
            {t("组合与日志由你掌握")}
            <br />
            {t("无需账户 · 不上传研究输入")}
          </p>
          <a href={localizedLink("https://agiscorecard.com/zh/invest")}>
            {t("← AGI 投资研究")}
          </a>
          <a href={localizedLink("https://compass.agiscorecard.com/zh/")}>
            {t("投资罗盘 · 13F 研究 ↗")}
          </a>
          <a href={localizedLink("https://invest.agiscorecard.com/")}>
            {t("SunWatch · 观点追踪 ↗")}
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            AGI <span>/</span> {t("投资研究")}
            <span>/</span> {t("股神")}
          </div>
          <div className="top-actions">
            <LanguageSwitch />
            <span className="save-status">
              {tr(
                unsaved
                  ? t("有未保存更改")
                  : hasSaved
                    ? t("已保存本机")
                    : t("示例工作区"),
              )}
            </span>
            <button onClick={save}>{t("保存本机")}</button>
            <details className="file-menu">
              <summary>{t("导入 / 导出")}</summary>
              <div>
                <button onClick={() => importRef.current?.click()}>
                  {t("导入研究 JSON")}
                </button>
                <button onClick={exportConfig}>{t("导出配置与日志")}</button>
                <button
                  disabled={!result || stale}
                  onClick={() =>
                    result &&
                    download(
                      {
                        version: 1,
                        config: result.config,
                        journal,
                        report: {
                          createdAt: new Date().toISOString(),
                          ...result,
                          language: getLanguage(),
                          strategies: result.strategies.map((s) => ({
                            ...s,
                            name: t(s.name),
                          })),
                          warnings: result.warnings.map((w) => t(w)),
                          source: {
                            ...result.source,
                            description: t(result.source.description),
                          },
                        },
                      },
                      "gushen-research-report.json",
                    )
                  }
                >
                  {t("导出完整报告")}
                </button>
                <button
                  disabled={!result || stale}
                  onClick={() => window.print()}
                >
                  {t("打印 / 保存 PDF")}
                </button>
              </div>
            </details>
            <input
              className="visually-hidden"
              type="file"
              accept=".json,application/json"
              ref={importRef}
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
          </div>
        </header>
        <main id="main-content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {t("研究工作台")} / {tr(NAV.find((x) => x[0] === page)?.[2])}
              </span>
              <h1 tabIndex={-1} ref={headingRef}>
                {tr(TITLES[page][0])}
              </h1>
              <p>{tr(TITLES[page][1])}</p>
            </div>
            <div className="data-stamp">
              <span className="status-dot" />
              {t("行情截止")}
              <strong>{tr(prices?.asOf ?? t("加载中"))}</strong>
              <small>{t("收盘快照 · 非实时")}</small>
            </div>
          </div>
          <div aria-live="polite">
            {tr(notice && <p className="notice">{tr(notice)}</p>)}
          </div>
          {tr(
            error && (
              <div role="alert" className="error">
                {tr(error)}
                {tr(
                  !prices && (
                    <button
                      onClick={() => {
                        setError("");
                        loadPrices()
                          .then((p) => {
                            setPrices(p);
                            setResult(runResearch(p, config));
                          })
                          .catch((e) => setError((e as Error).message));
                      }}
                    >
                      {t("重试加载行情")}
                    </button>
                  ),
                )}
              </div>
            ),
          )}
          <section className="research-bar">
            <div>
              <span className="eyebrow">{t("当前研究")}</span>
              <strong>{researchName(config.name)}</strong>
              <span className="research-symbols">
                {tr(
                  config.holdings.map((h) => h.symbol || t("未填")).join(" / "),
                )}
              </span>
            </div>
            <div className="research-controls">
              <span>
                {tr(money(config.capital))}
                <small>
                  {tr(config.rebalanceMonths === 1 ? t("每月") : t("每季度"))}
                  {t("换仓 ·")}
                  {tr(" ")}
                  {tr(config.costBps)} bp
                </small>
              </span>
              <button
                aria-expanded={editing}
                onClick={() => setEditing(!editing)}
              >
                {tr(editing ? t("收起设置") : t("编辑组合"))}
              </button>
              <button
                className="primary"
                disabled={busy || !prices}
                onClick={run}
              >
                {tr(busy ? t("计算中…") : t("运行研究"))}
                <span aria-hidden="true"> ↗</span>
              </button>
            </div>
          </section>
          {tr(
            editing && (
              <section className="panel editor">
                <div className="section-heading">
                  <div>
                    <h2>{t("定义这次研究")}</h2>
                    <p>
                      {t(
                        "示例用于学习，并非投资推荐。更换标的后，比较窗口会按共同历史重新对齐。",
                      )}
                    </p>
                  </div>
                </div>
                <div className="preset-row">
                  {tr(
                    PRESETS.map((p) => (
                      <button
                        key={p.name}
                        onClick={() =>
                          edit({
                            ...config,
                            name: t(p.name),
                            holdings: structuredClone(p.holdings),
                          })
                        }
                      >
                        <b>{tr(p.name)}</b>
                        <small>{tr(p.note)}</small>
                      </button>
                    )),
                  )}
                </div>
                <div className="form-grid">
                  <label>
                    {t("研究名称")}
                    <input
                      value={researchName(config.name)}
                      maxLength={80}
                      onChange={(e) =>
                        edit({ ...config, name: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    {t("模拟本金 / USD")}
                    <input
                      type="number"
                      min="100"
                      value={config.capital}
                      onChange={(e) =>
                        edit({ ...config, capital: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
                <div className="holdings-editor">
                  {tr(
                    config.holdings.map((h, i) => (
                      <div key={i}>
                        <label>
                          {t("标的")}
                          {tr(i + 1)}
                          <input
                            list="available-symbols"
                            value={h.symbol}
                            maxLength={10}
                            onChange={(e) =>
                              edit({
                                ...config,
                                holdings: config.holdings.map((v, j) =>
                                  i === j
                                    ? {
                                        ...v,
                                        symbol: e.target.value.toUpperCase(),
                                      }
                                    : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <label>
                          {t("目标权重 %")}
                          <input
                            type="number"
                            min="0.01"
                            max="100"
                            step="0.1"
                            value={h.weight}
                            onChange={(e) =>
                              edit({
                                ...config,
                                holdings: config.holdings.map((v, j) =>
                                  i === j
                                    ? { ...v, weight: Number(e.target.value) }
                                    : v,
                                ),
                              })
                            }
                          />
                        </label>
                        <button
                          className="remove"
                          aria-label={t("移除 {0}", [h.symbol || "标的"])}
                          disabled={config.holdings.length <= 2}
                          onClick={() =>
                            edit({
                              ...config,
                              holdings: config.holdings.filter(
                                (_, j) => i !== j,
                              ),
                            })
                          }
                        >
                          ×
                        </button>
                      </div>
                    )),
                  )}
                </div>
                <datalist id="available-symbols">
                  {tr(
                    prices &&
                      Object.keys(prices.close)
                        .sort()
                        .map((s) => <option key={s} value={s} />),
                  )}
                </datalist>
                <div className="button-row">
                  <button
                    disabled={config.holdings.length >= 10}
                    onClick={() =>
                      edit({
                        ...config,
                        holdings: [
                          ...config.holdings,
                          { symbol: "", weight: 0 },
                        ],
                      })
                    }
                  >
                    {t("＋ 添加标的")}
                  </button>
                  <button
                    onClick={() => {
                      const n = config.holdings.length,
                        w = Math.floor(10000 / n) / 100;
                      edit({
                        ...config,
                        holdings: config.holdings.map((h, i) => ({
                          ...h,
                          weight:
                            i === n - 1
                              ? Number((100 - w * (n - 1)).toFixed(2))
                              : w,
                        })),
                      });
                    }}
                  >
                    {t("平均分配")}
                  </button>
                  <span
                    className={
                      Math.abs(total - 100) > 0.005 ? "negative" : "positive"
                    }
                  >
                    {t("合计")}
                    {tr(total.toFixed(2))}%
                  </span>
                </div>
                <div className="form-grid three">
                  <label>
                    {t("行情窗口")}
                    <select
                      value={config.historyDays}
                      onChange={(e) =>
                        edit({ ...config, historyDays: Number(e.target.value) })
                      }
                    >
                      {tr(
                        [1, 2, 3, 4].map((n) => (
                          <option key={n} value={365 * n}>
                            {t("近")}
                            {tr(n)} {t("年（含预热期）")}
                          </option>
                        )),
                      )}
                    </select>
                  </label>
                  <label>
                    {t("单边成本 / 基点")}
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={config.costBps}
                      onChange={(e) =>
                        edit({ ...config, costBps: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    {t("换仓频率")}
                    <select
                      value={config.rebalanceMonths}
                      onChange={(e) =>
                        edit({
                          ...config,
                          rebalanceMonths: Number(e.target.value) as 1 | 3,
                        })
                      }
                    >
                      <option value="1">{t("月度")}</option>
                      <option value="3">{t("自然季度")}</option>
                    </select>
                  </label>
                </div>
                <p className="fine">
                  {t(
                    "1 基点 = 0.01%。单边成本对买入和卖出的成交额分别计费。支持代码见「方法与数据」。",
                  )}
                </p>
              </section>
            ),
          )}
          {tr(
            stale && (
              <div className="stale-notice">
                {t("设置已修改。下方仍是「")}
                {result ? researchName(result.config.name) : null}
                {t("」上次运行的结果，请点击「运行研究」更新。")}
              </div>
            ),
          )}
          <div className="screen-views">
            {tr(
              page === "overview" && result && m && (
                <>
                  <div className="metric-row">
                    <div>
                      <span>{t("期末模拟资产")}</span>
                      <strong>
                        {tr(money(m.curve[m.curve.length - 1].nav))}
                      </strong>
                      <p>
                        {t("初始本金")}
                        {tr(money(result.config.capital))}
                      </p>
                    </div>
                    <div>
                      <span>{t("累计收益")}</span>
                      <strong
                        className={
                          m.total_return >= 0 ? "positive" : "negative"
                        }
                      >
                        {tr(m.total_return > 0 ? "+" : "")}
                        {tr(pct(m.total_return))}
                      </strong>
                      <p>{t("我的目标权重 · 扣设定成本")}</p>
                    </div>
                    <div>
                      <span>{t("历史最大回撤")}</span>
                      <strong className="negative">
                        {tr(pct(m.max_drawdown))}
                      </strong>
                      <p>{t("峰值到低谷的最大跌幅")}</p>
                    </div>
                    <div>
                      <span>{t("可比较交易日")}</span>
                      <strong>
                        {tr(result.dates.sessions)}
                        <small> {t("天")}</small>
                      </strong>
                      <p>
                        {t("另用")}
                        {tr(result.dates.training)} {t("日形成初始参数")}
                      </p>
                    </div>
                  </div>
                  <div className="overview-grid">
                    <WorkbenchChart strategies={result.strategies} />
                    <aside className="interpretation">
                      <span className="eyebrow">{t("研究线索")}</span>
                      <h2>{t("接下来，检查这三件事。")}</h2>
                      <button onClick={() => navigate("risk")}>
                        <span>{t("01 / 仓位是否集中")}</span>
                        <b>
                          {t("最大仓位")}
                          {tr(result.risk.largest.symbol)} ·{tr(" ")}
                          {tr(result.risk.largest.weight)}%
                        </b>
                        <small>{t("查看相关性与方差贡献 →")}</small>
                      </button>
                      <button onClick={() => navigate("compare")}>
                        <span>{t("02 / 收益是否值得风险")}</span>
                        <b>
                          {t("同池等权回撤")}
                          {tr(" ")}
                          {tr(pct(result.strategies[1].metrics.max_drawdown))}
                        </b>
                        <small>{t("比较策略与逐月表现 →")}</small>
                      </button>
                      <button onClick={() => navigate("journal")}>
                        <span>{t("03 / 判断能否被验证")}</span>
                        <b>
                          {tr(
                            journal.filter((j) => j.status === "open").length,
                          )}
                          {tr(" ")}
                          {t("条研究等待复盘")}
                        </b>
                        <small>{t("记录证据与失效条件 →")}</small>
                      </button>
                    </aside>
                  </div>
                  <div className="bottom-grid">
                    <section className="panel">
                      <h2>{t("目标配置")}</h2>
                      <p>{t("目标权重用于每次换仓；日间持仓会随价格变化。")}</p>
                      <div className="allocation-bar">
                        {tr(
                          result.config.holdings.map((h, i) => (
                            <span
                              key={h.symbol}
                              style={{
                                width: `${h.weight}%`,
                                background: [
                                  "var(--accent)",
                                  "var(--allocation2)",
                                  "var(--accent2)",
                                  "var(--allocation4)",
                                  "var(--warn)",
                                  "var(--allocation6)",
                                ][i % 6],
                              }}
                              title={`${h.symbol} ${h.weight}%`}
                            />
                          )),
                        )}
                      </div>
                      <div className="allocation-list">
                        {tr(
                          result.config.holdings.map((h) => (
                            <div key={h.symbol}>
                              <b>{tr(h.symbol)}</b>
                              <span>{tr(h.weight)}%</span>
                            </div>
                          )),
                        )}
                      </div>
                    </section>
                    <section className="research-note">
                      <span className="eyebrow">{t("从研究到复盘")}</span>
                      <h2>{t("AI 时代，先管理你的判断。")}</h2>
                      <p>
                        {t(
                          "用 AI 产业示例探索集中风险；用证据日志保存判断；用同窗口比较检查方法。这里不提供自动买卖信号。",
                        )}
                      </p>
                      <button onClick={() => navigate("scenarios")}>
                        {t("推演一次不利情景 →")}
                      </button>
                    </section>
                  </div>
                </>
              ),
            )}
            {tr(page === "compare" && result && <Comparison result={result} />)}
            {tr(page === "risk" && result && <Risk result={result} />)}
            {tr(
              page === "scenarios" && result && (
                <Scenarios
                  key={JSON.stringify(result.config)}
                  result={result}
                />
              ),
            )}
            {tr(
              page === "journal" && (
                <Journal
                  entries={journal}
                  onChange={(v) => {
                    setJournal(v);
                    setUnsaved(true);
                  }}
                />
              ),
            )}
            {tr(
              page === "tools" && (
                <section className="panel legacy">
                  <p className="notice">
                    {t(
                      "这些独立计算器不会修改当前研究组合。金额使用其各自标注的单位；模型输出不是经校准的未来成功率。",
                    )}
                  </p>
                  <LegacyAdvisor />
                </section>
              ),
            )}
            {tr(
              page === "method" && <Method result={result} prices={prices} />,
            )}
            {tr(
              !result &&
                ["overview", "compare", "risk", "scenarios"].includes(page) && (
                  <section className="empty-state">
                    <span>
                      {tr(
                        prices
                          ? t("准备好你的研究问题")
                          : t("正在读取行情快照"),
                      )}
                    </span>
                    <h2>
                      {tr(
                        prices
                          ? t("运行一次，建立比较基线。")
                          : t("数据到达后将展示默认示例。"),
                      )}
                    </h2>
                    <p>
                      {t(
                        "选择 2–10 个标的，设置权重、窗口与成本。不会连接券商或执行交易。",
                      )}
                    </p>
                    {tr(
                      prices && (
                        <button className="primary" onClick={run}>
                          {t("运行研究")}
                        </button>
                      ),
                    )}
                  </section>
                ),
            )}
          </div>
          {tr(
            result && (
              <div className="print-report">
                <h1>{t("股神 · 投资研究报告")}</h1>
                <h2>{researchName(result.config.name)}</h2>
                <p>
                  {tr(result.dates.from)} {t("至")}
                  {tr(result.dates.to)} {t("· 本金")}
                  {tr(" ")}
                  {tr(money(result.config.capital))} {t("· 成本")}
                  {tr(result.config.costBps)} bp ·{" "}
                  {tr(
                    result.config.rebalanceMonths === 1 ? t("月度") : t("季度"),
                  )}
                  {t("换仓")}
                </p>
                <p>
                  {t("目标配置：")}
                  {tr(
                    result.config.holdings
                      .map((h) => `${h.symbol} ${h.weight}%`)
                      .join(" / "),
                  )}
                </p>
                <WorkbenchChart strategies={result.strategies} />
                <Comparison result={result} />
                <Risk result={result} />
                <Method result={result} prices={prices} />
                <h2>{t("研究日志")}</h2>
                {tr(
                  journal.map((j) => (
                    <section key={j.id}>
                      <h3>
                        {j.title} · {tr(j.reviewDate)} ·{tr(" ")}
                        {tr(j.status === "open" ? t("待复盘") : t("已复盘"))}
                      </h3>
                      <p>{j.thesis}</p>
                      <p>
                        {t("反证：")}
                        {tr(j.counter || t("未填写"))}
                      </p>
                      <p>{j.evidence}</p>
                    </section>
                  )),
                )}
              </div>
            ),
          )}
          <footer className="page-footer">
            <span>{t("股神 Gushen · AGI 投资研究子站")}</span>
            <span>
              {t("教育研究工具 · 不构成投资建议 · 历史表现不保证未来收益")}
            </span>
            <a href="https://github.com/f-tiger/gushen">{t("公开源码 ↗")}</a>
          </footer>
        </main>
      </div>
    </div>
  );
}

function Method({
  result,
  prices,
}: {
  result: ResearchResult | null;
  prices: PriceFile | null;
}) {
  return (
    <>
      <section className="panel">
        <h2>{t("行情与覆盖范围")}</h2>
        <dl className="method-grid">
          <div>
            <dt>{t("行情来源")}</dt>
            <dd>{tr(prices?.source ?? t("加载中"))}</dd>
          </div>
          <div>
            <dt>{t("快照生成时间（UTC）")}</dt>
            <dd>{tr(prices?.generated ?? "—")}</dd>
          </div>
          <div>
            <dt>{t("实际比较窗口")}</dt>
            <dd>
              {tr(
                result
                  ? `${result.dates.from} → ${result.dates.to}`
                  : t("请先运行研究"),
              )}
            </dd>
          </div>
          <div>
            <dt>{t("预热窗口")}</dt>
            <dd>
              {tr(
                result
                  ? t("从 {0} 起，126 个交易日", [result.dates.availableFrom])
                  : t("126 个共同交易日"),
              )}
            </dd>
          </div>
        </dl>
        <p>
          {t(
            "仅使用各标的都有有效价格的共同日期，不填补缺失价格。数据构建在纽约时间 17:00 前排除当日价格，避免将未完成的日线当作收盘价。",
          )}
        </p>
        {tr(
          !!prices?.stale?.length && (
            <p className="stale-notice">
              {t("沿用上版数据的标的：")}
              {tr(prices.stale.join("、"))}
              {t("。它们可能缩短共同窗口。")}
            </p>
          ),
        )}
        <details>
          <summary>
            {t("查看支持的")}
            {tr(prices ? Object.keys(prices.close).length : 0)} {t("个代码")}
          </summary>
          <p className="symbol-cloud">
            {tr(
              prices
                ? Object.keys(prices.close).sort().join(" · ")
                : t("加载中"),
            )}
          </p>
        </details>
      </section>
      <section className="panel">
        <h2>{t("从信息到执行，按顺序计算")}</h2>
        <ol className="method-steps">
          <li>
            <b>{t("固定研究对象")}</b>
            <p>
              {t(
                "选择当前标的池和目标权重。比较包含固定目标权重、同池等权和层次风险平价（HRP），不是从历史表现里挑选赢家。",
              )}
            </p>
          </li>
          <li>
            <b>{t("只用执行前的信息")}</b>
            <p>
              {t(
                "HRP 每次使用前一交易日及更早的 126 个收盘价估计权重。首次在预热结束后的交易日收盘建仓；随后在每月或自然季度首个可用交易日收盘换仓。",
              )}
            </p>
          </li>
          <li>
            <b>{t("跟踪漂移并扣除成本")}</b>
            <p>
              {t(
                "换仓日收盘前收益归旧持仓，建仓与买卖成本按设定基点扣除。两次换仓之间不偷偷恢复目标权重。金额均为美元，不处理外汇。",
              )}
            </p>
          </li>
          <li>
            <b>{t("给结论保留边界")}</b>
            <p>
              {t(
                "所有历史结果仍有当前标的池的选择与幸存者偏差。价格分析不包含财报、估值、ETF 持仓穿透或实时新闻。没有自动交易、AI 预测或收益承诺。",
              )}
            </p>
          </li>
        </ol>
        <p className="fine">
          {t(
            "账本方法版本：walk-forward-close-v2。年化波动为日收益样本标准差 × √252；最大回撤以扣费后的净值峰值计算。风险贡献使用静态目标权重和日收益协方差。",
          )}
        </p>
        {tr(
          result?.warnings.map((w) => (
            <p className="fine" key={w}>
              • {tr(w)}
            </p>
          )),
        )}
      </section>
      <section className="panel">
        <h2>{t("保存、导出与研究资料")}</h2>
        <p>
          {t(
            "「保存本机」保存配置与最多 50 条日志到当前浏览器。导出 JSON 可以转移到另一台设备；导入后必须重新运行，文件中的结果不会直接展示。清理浏览器存储会删除本机记录。",
          )}
        </p>
        <p>
          {t(
            "情景推演为临时计算，不写入配置或完整报告；需要保留假设时，请在研究日志中记录。打印报告包含已运行配置、比较、风险、方法与日志。",
          )}
        </p>
        <div className="source-links">
          <a
            href="https://www.investor.gov/introduction-investing/getting-started/asset-allocation"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Investor.gov · 资产配置与分散 ↗")}
          </a>
          <a
            href="https://www.portfoliovisualizer.com/backtest-portfolio"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("Portfolio Visualizer · 组合比较方法参考 ↗")}
          </a>
          <a
            href="https://portfolioslab.com/docs/performance-analysis/portfolio-analysis"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("PortfoliosLab · 组合分析功能参考 ↗")}
          </a>
          <a
            href="https://github.com/f-tiger/gushen"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t("源码、计算测试与部署记录 ↗")}
          </a>
        </div>
      </section>
    </>
  );
}
