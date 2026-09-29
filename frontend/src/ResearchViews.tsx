import { t, tr, themeColor } from "./locale";
import { useState } from "react";
import {
  contributionProjection,
  monthlyReturns,
  stressImpact,
  underwater,
  type ResearchResult,
  type JournalEntry,
} from "./engine/research";
import { money, pct } from "./WorkbenchChart";

export function Comparison({ result }: { result: ResearchResult }) {
  const [id, setId] = useState("custom");
  const s = result.strategies.find((x) => x.id === id)!,
    m = s.metrics;
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("策略的收益与代价")}</h2>
            <p>
              {t(
                "同一标的池、执行日期、单边成本与换仓频率。策略参数未做历史寻优。",
              )}
            </p>
          </div>
          <span className="tag">{t("美元 · 历史模拟")}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("策略")}</th>
                <th>{t("累计收益")}</th>
                <th>{t("年化收益")}</th>
                <th>{t("年化波动")}</th>
                <th>{t("最大回撤")}</th>
                <th>{t("交易成本")}</th>
                <th>{t("换仓次数")}</th>
              </tr>
            </thead>
            <tbody>
              {tr(
                result.strategies.map((x) => (
                  <tr key={x.id}>
                    <th>
                      <i
                        className="dot"
                        style={{ background: themeColor(x.id) }}
                      />
                      {tr(x.name)}
                    </th>
                    <td>{tr(pct(x.metrics.total_return))}</td>
                    <td>{tr(pct(x.metrics.cagr))}</td>
                    <td>{tr(pct(x.metrics.annual_volatility))}</td>
                    <td className="negative">
                      {tr(pct(x.metrics.max_drawdown))}
                    </td>
                    <td>{tr(money(x.metrics.total_cost))}</td>
                    <td>{tr(x.metrics.n_rebalances)}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="fine">
          {t(
            "换仓次数包含首次建仓。年化以 252 个交易日换算；未计末日清仓成本。收益排序不是策略推荐。",
          )}
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("逐月观察，而非只看终点")}</h2>
            <p>{t("首尾月份可能不完整，月份收益包含实际扣除的成本。")}</p>
          </div>
          <label>
            {t("查看策略")}
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {tr(
                result.strategies.map((x) => (
                  <option key={x.id} value={x.id}>
                    {tr(x.name)}
                  </option>
                )),
              )}
            </select>
          </label>
        </div>
        <div className="months">
          {tr(
            monthlyReturns(m.curve).map((x) => (
              <div
                className={x.ret >= 0 ? "month up" : "month down"}
                key={x.month}
              >
                <span>{tr(x.month)}</span>
                <strong>
                  {tr(x.ret > 0 ? "+" : "")}
                  {tr(pct(x.ret))}
                </strong>
              </div>
            )),
          )}
        </div>
      </section>
      <section className="panel">
        <h2>{t("持仓与换仓账本")}</h2>
        <p>{t("期末权重随价格漂移，不等于设定目标，也不是下一次交易指令。")}</p>
        <div className="weight-strip">
          {tr(
            Object.entries(m.final_weights).map(([symbol, w]) => (
              <div key={symbol}>
                <b>{tr(symbol)}</b>
                <strong>{tr(pct(w))}</strong>
              </div>
            )),
          )}
        </div>
        <details>
          <summary>
            {t("展开")}
            {tr(m.rebalances.length)} {t("笔建仓 / 换仓记录")}
          </summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("信息截止")}</th>
                  <th>{t("收盘执行")}</th>
                  <th>{t("成交额 / 净值")}</th>
                  <th>{t("成本")}</th>
                  <th>{t("执行目标权重")}</th>
                </tr>
              </thead>
              <tbody>
                {tr(
                  m.rebalances.map((r) => (
                    <tr key={r.executionDate}>
                      <td>{tr(r.signalAsOf)}</td>
                      <td>{tr(r.executionDate)}</td>
                      <td>{tr(pct(r.turnover))}</td>
                      <td>{tr(money(r.cost))}</td>
                      <td>
                        {tr(
                          Object.entries(r.weights)
                            .map(([k, v]) => `${k} ${pct(v)}`)
                            .join(" / "),
                        )}
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        </details>
      </section>
    </>
  );
}

export function Risk({ result }: { result: ResearchResult }) {
  const r = result.risk,
    dd = underwater(result.strategies[0].metrics.curve);
  return (
    <>
      <div className="metric-row">
        <div>
          <span>{t("最大目标仓位")}</span>
          <strong>
            {tr(r.largest.symbol)} <small>{tr(r.largest.weight)}%</small>
          </strong>
          <p>{t("按标的代码计算")}</p>
        </div>
        <div>
          <span>{t("有效持仓数")}</span>
          <strong>{tr(r.effectiveHoldings.toFixed(2))}</strong>
          <p>{t("1 ÷ 权重平方和")}</p>
        </div>
        <div>
          <span>{t("最长水下期")}</span>
          <strong>
            {tr(dd.longestSessions)}
            <small> {t("交易日")}</small>
          </strong>
          <p>{t("我的组合未重回历史峰值的连续天数")}</p>
        </div>
        <div>
          <span>{t("当前水下期")}</span>
          <strong>
            {tr(dd.currentSessions)}
            <small> {t("交易日")}</small>
          </strong>
          <p>
            {t("最深回撤日期")}
            {tr(dd.worstDate)}
          </p>
        </div>
      </div>
      <section className="panel">
        <h2>{t("相关性：分开买，可能一起跌")}</h2>
        <p>
          {t(
            "比较窗口内的日收益相关系数。接近 +1 表示同向变化；这是历史关系，不是未来的保护。",
          )}
        </p>
        <div className="table-scroll">
          <table className="correlation">
            <thead>
              <tr>
                <th>{t("标的")}</th>
                {tr(
                  r.assets.map((a) => <th key={a.symbol}>{tr(a.symbol)}</th>),
                )}
              </tr>
            </thead>
            <tbody>
              {tr(
                r.assets.map((a, i) => (
                  <tr key={a.symbol}>
                    <th>{tr(a.symbol)}</th>
                    {tr(
                      r.correlations[i].map((v, j) => (
                        <td
                          key={j}
                          style={{
                            background:
                              v === null
                                ? "var(--bg3)"
                                : v >= 0
                                  ? `rgba(var(--corr-positive),${0.05 + Math.abs(v) * 0.24})`
                                  : `rgba(var(--corr-negative),${0.05 + Math.abs(v) * 0.24})`,
                          }}
                        >
                          {tr(v === null ? "—" : v.toFixed(2))}
                        </td>
                      )),
                    )}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="fine">
          {t(
            "无波动序列无法定义相关系数，显示「—」。未穿透 ETF 底层持仓，因此不能识别基金之间的股票重叠。",
          )}
        </p>
      </section>
      <section className="panel">
        <h2>{t("哪部分承担风险？")}</h2>
        <p>
          {t(
            "按当前目标权重与窗口内协方差，分解组合方差；这是静态估计，不是历史回测损益归因。",
          )}
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{t("标的")}</th>
                <th>{t("目标权重")}</th>
                <th>{t("方差贡献")}</th>
                <th>{t("标的累计收益")}</th>
                <th>{t("标的年化波动")}</th>
                <th>{t("标的最大回撤")}</th>
              </tr>
            </thead>
            <tbody>
              {tr(
                r.assets.map((a, i) => (
                  <tr key={a.symbol}>
                    <th>{tr(a.symbol)}</th>
                    <td>
                      {tr(
                        result.config.holdings.find(
                          (h) => h.symbol === a.symbol,
                        )?.weight,
                      )}
                      %
                    </td>
                    <td>
                      {tr(
                        r.contribution[i] === null
                          ? "—"
                          : pct(r.contribution[i]!),
                      )}
                    </td>
                    <td>{tr(pct(a.totalReturn))}</td>
                    <td>{tr(pct(a.volatility))}</td>
                    <td className="negative">{tr(pct(a.maxDrawdown))}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        <p className="fine">
          {t(
            "方差贡献合计约 100%；负值表示该标的在这个样本中降低组合方差。标的收益不扣组合交易成本。",
          )}
        </p>
      </section>
    </>
  );
}

export function Scenarios({ result }: { result: ResearchResult }) {
  const holdings = result.config.holdings;
  const [shocks, setShocks] = useState<Record<string, number>>({});
  const [initial, setInitial] = useState(result.config.capital),
    [monthly, setMonthly] = useState(500),
    [years, setYears] = useState(10),
    [target, setTarget] = useState(250000),
    [rates, setRates] = useState([-5, 3, 8]);
  let stress: ReturnType<typeof stressImpact> | null = null,
    stressError = "",
    goalError = "";
  let projections: ReturnType<typeof contributionProjection>[] = [];
  try {
    stress = stressImpact(holdings, shocks, result.config.capital);
  } catch (e) {
    stressError = (e as Error).message;
  }
  try {
    if (!Number.isFinite(target) || target < 0)
      throw new Error(t("目标金额不能为负数"));
    projections = rates.map((rate) =>
      contributionProjection(initial, monthly, years, rate / 100),
    );
  } catch (e) {
    goalError = (e as Error).message;
  }
  return (
    <>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("如果持仓同时遭遇冲击")}</h2>
            <p>
              {t(
                "对目标权重施加一次性价格变化，不假定发生概率，不包含换仓、费用与汇率。",
              )}
            </p>
          </div>
          <span className="tag">{t("假设情景")}</span>
        </div>
        <div className="button-row">
          <button
            onClick={() =>
              setShocks(
                Object.fromEntries(holdings.map((h) => [h.symbol, -20])),
              )
            }
          >
            {t("全部下跌 20%")}
          </button>
          <button
            onClick={() =>
              setShocks(
                Object.fromEntries(
                  holdings.map((h) => [
                    h.symbol,
                    h.symbol === result.risk.largest.symbol ? -35 : 0,
                  ]),
                ),
              )
            }
          >
            {t("最大仓位下跌 35%")}
          </button>
          <button onClick={() => setShocks({})}>{t("清零")}</button>
        </div>
        <div className="scenario-grid">
          <div>
            {tr(
              holdings.map((h) => (
                <label className="shock-row" key={h.symbol}>
                  <span>
                    <b>{tr(h.symbol)}</b>
                    <small>
                      {t("目标")}
                      {tr(h.weight)}%
                    </small>
                  </span>
                  <input
                    aria-label={t("{0} 冲击百分比", [h.symbol])}
                    type="number"
                    min="-100"
                    max="200"
                    value={shocks[h.symbol] ?? 0}
                    onChange={(e) =>
                      setShocks({
                        ...shocks,
                        [h.symbol]: Number(e.target.value),
                      })
                    }
                  />
                  <span>%</span>
                </label>
              )),
            )}
          </div>
          <div className="scenario-result">
            <span>{t("假设冲击后的资产")}</span>
            <strong>{tr(stress ? money(stress.after) : "—")}</strong>
            <p
              className={stress && stress.change < 0 ? "negative" : "positive"}
            >
              {tr(
                stress
                  ? `${money(stress.change)} / ${pct(stress.return)}`
                  : t("请输入有效假设"),
              )}
            </p>
            <small>
              {t("基于研究本金")}
              {tr(money(result.config.capital))}
              {t("，并非实时账户余额。")}
            </small>
          </div>
        </div>
        {tr(
          stressError && (
            <p role="alert" className="error">
              {tr(stressError)}
            </p>
          ),
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{t("目标需要多少投入？")}</h2>
            <p>
              {t(
                "每月末追加投入，按用户设定的固定年增长率复利；不从历史收益推断未来。",
              )}
            </p>
          </div>
          <span className="tag">{t("确定性测算")}</span>
        </div>
        <div className="form-grid four">
          <label>
            {t("起始本金 / USD")}
            <input
              type="number"
              min="0"
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
            />
          </label>
          <label>
            {t("每月投入 / USD")}
            <input
              type="number"
              min="0"
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
            />
          </label>
          <label>
            {t("年限")}
            <input
              type="number"
              min="1"
              max="50"
              step="1"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </label>
          <label>
            {t("目标金额 / USD")}
            <input
              type="number"
              min="0"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="projection-grid">
          {tr(
            rates.map((rate, i) => (
              <div key={i}>
                <label>
                  {t("情景")}
                  {tr(i + 1)} {t("· 假设年增长率 %")}
                  <input
                    type="number"
                    min="-99"
                    max="100"
                    value={rate}
                    onChange={(e) =>
                      setRates(
                        rates.map((r, j) =>
                          i === j ? Number(e.target.value) : r,
                        ),
                      )
                    }
                  />
                </label>
                <strong>
                  {tr(projections[i] ? money(projections[i].value) : "—")}
                </strong>
                <p>
                  {tr(
                    projections[i]
                      ? t("累计投入 {0}", [money(projections[i].paid)])
                      : t("检查输入"),
                  )}
                </p>
                <small>
                  {tr(
                    projections[i]
                      ? projections[i].value >= target
                        ? t("在该假设下高于目标 {0}", [
                            money(projections[i].value - target),
                          ])
                        : t("在该假设下距目标 {0}", [
                            money(target - projections[i].value),
                          ])
                      : "",
                  )}
                </small>
              </div>
            )),
          )}
        </div>
        {tr(
          goalError && (
            <p role="alert" className="error">
              {tr(goalError)}
            </p>
          ),
        )}
        {tr(
          projections.length === 3 && (
            <details>
              <summary>{t("逐年查看三种假设")}</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t("年末")}</th>
                      <th>{t("累计投入")}</th>
                      {tr(
                        rates.map((r, i) => (
                          <th key={i}>
                            {tr(r)}
                            {t("% 假设")}
                          </th>
                        )),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tr(
                      projections[0].path.map((p, i) => (
                        <tr key={i}>
                          <th>{tr(p.year.toFixed(p.year % 1 ? 1 : 0))}</th>
                          <td>{tr(money(p.paid))}</td>
                          {tr(
                            projections.map((s, j) => (
                              <td key={j}>{tr(money(s.path[i].value))}</td>
                            )),
                          )}
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            </details>
          ),
        )}
        <p className="fine">
          {t(
            "默认 -5%、3%、8% 只是可编辑的演示假设，没有预测或概率含义。未计税费、通胀与投入时间变化。",
          )}
        </p>
      </section>
    </>
  );
}

const emptyEntry = () => ({
  title: "",
  thesis: "",
  counter: "",
  evidence: "",
  reviewDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
});
export function Journal({
  entries,
  onChange,
}: {
  entries: JournalEntry[];
  onChange: (v: JournalEntry[]) => void;
}) {
  const [draft, setDraft] = useState(emptyEntry),
    [error, setError] = useState("");
  function add() {
    setError("");
    if (!draft.title.trim() || !draft.thesis.trim())
      return setError(t("请填写研究标题和待验证判断"));
    if (entries.length >= 50)
      return setError(t("最多保存 50 条日志，请先导出或整理"));
    if (draft.evidence && !/^https?:\/\//i.test(draft.evidence))
      return setError(t("证据链接需以 http:// 或 https:// 开头"));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.reviewDate))
      return setError(t("请选择复盘日期"));
    onChange([
      {
        ...draft,
        title: draft.title.trim(),
        id: crypto.randomUUID(),
        status: "open",
        createdAt: new Date().toISOString(),
      },
      ...entries,
    ]);
    setDraft(emptyEntry());
  }
  const open = entries.filter((e) => e.status === "open").length;
  return (
    <>
      <div className="journal-intro">
        <div>
          <h2>{t("把判断写下来，留给未来检验")}</h2>
          <p>
            {t(
              "先写证据、再写反例，最后约定复盘日期。保存于当前浏览器，不会自动通知或跨设备同步。",
            )}
          </p>
        </div>
        <span className="journal-count">
          {tr(open)}
          <small>{t("条待复盘")}</small>
        </span>
      </div>
      <section className="panel">
        <h2>{t("新增研究记录")}</h2>
        <div className="form-grid">
          <label>
            {t("研究标题")}
            <input
              maxLength={120}
              placeholder={t("例如：AI 产业组合是否过度集中？")}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            {t("复盘日期")}
            <input
              type="date"
              value={draft.reviewDate}
              onChange={(e) =>
                setDraft({ ...draft, reviewDate: e.target.value })
              }
            />
          </label>
          <label>
            {t("待验证判断")}
            <textarea
              maxLength={4000}
              rows={3}
              placeholder={t("我的判断是什么？什么事实会支持它？")}
              value={draft.thesis}
              onChange={(e) => setDraft({ ...draft, thesis: e.target.value })}
            />
          </label>
          <label>
            {t("反证与失效条件")}
            <textarea
              maxLength={4000}
              rows={3}
              placeholder={t("出现什么事实，我会承认判断不成立？")}
              value={draft.counter}
              onChange={(e) => setDraft({ ...draft, counter: e.target.value })}
            />
          </label>
        </div>
        <label>
          {t("证据来源链接（可选）")}
          <input
            type="url"
            maxLength={2000}
            placeholder="https://…"
            value={draft.evidence}
            onChange={(e) => setDraft({ ...draft, evidence: e.target.value })}
          />
        </label>
        <div className="button-row">
          <button className="primary" onClick={add}>
            {t("记录到研究日志")}
          </button>
          <span className="fine">
            {t("添加后请点击顶部「保存本机」或「导出配置」。")}
          </span>
        </div>
        {tr(
          error && (
            <p role="alert" className="error">
              {tr(error)}
            </p>
          ),
        )}
      </section>
      {tr(
        entries.length === 0 ? (
          <section className="empty-state">
            <span>{t("01 / 写下第一个可验证的判断")}</span>
            <h3>{t("好的研究，也应能被证伪。")}</h3>
            <p>{t("日志里没有预填的“成功案例”。从你自己的问题开始。")}</p>
          </section>
        ) : (
          entries.map((e) => (
            <article className="panel journal-entry" key={e.id}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr(e.status === "reviewed" ? t("已复盘") : t("待复盘"))} ·
                    {tr(" ")}
                    {tr(e.reviewDate)}
                  </span>
                  <h3>{e.title}</h3>
                </div>
                <button
                  onClick={() =>
                    onChange(
                      entries.map((x) =>
                        x.id === e.id
                          ? {
                              ...x,
                              status: x.status === "open" ? "reviewed" : "open",
                            }
                          : x,
                      ),
                    )
                  }
                >
                  {tr(e.status === "open" ? t("标记已复盘") : t("重新打开"))}
                </button>
              </div>
              <p className="preserve">{e.thesis}</p>
              {tr(
                e.counter && (
                  <div className="counter">
                    <b>{t("反证与失效条件")}</b>
                    <p className="preserve">{e.counter}</p>
                  </div>
                ),
              )}
              {tr(
                e.evidence && (
                  <a
                    href={e.evidence}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("查看证据来源 ↗")}
                  </a>
                ),
              )}
              <details className="delete-entry">
                <summary>{t("管理记录")}</summary>
                <p className="fine">
                  {t("删除只更改本次工作区；保存本机后才覆盖已保存版本。")}
                </p>
                <button
                  onClick={() => onChange(entries.filter((x) => x.id !== e.id))}
                >
                  {t("删除这条记录")}
                </button>
              </details>
            </article>
          ))
        ),
      )}
    </>
  );
}
