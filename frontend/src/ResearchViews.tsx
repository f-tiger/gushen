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
            <h2>策略的收益与代价</h2>
            <p>
              同一标的池、执行日期、单边成本与换仓频率。策略参数未做历史寻优。
            </p>
          </div>
          <span className="tag">美元 · 历史模拟</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>策略</th>
                <th>累计收益</th>
                <th>年化收益</th>
                <th>年化波动</th>
                <th>最大回撤</th>
                <th>交易成本</th>
                <th>换仓次数</th>
              </tr>
            </thead>
            <tbody>
              {result.strategies.map((x) => (
                <tr key={x.id}>
                  <th>
                    <i className="dot" style={{ background: x.color }} />
                    {x.name}
                  </th>
                  <td>{pct(x.metrics.total_return)}</td>
                  <td>{pct(x.metrics.cagr)}</td>
                  <td>{pct(x.metrics.annual_volatility)}</td>
                  <td className="negative">{pct(x.metrics.max_drawdown)}</td>
                  <td>{money(x.metrics.total_cost)}</td>
                  <td>{x.metrics.n_rebalances}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          换仓次数包含首次建仓。年化以 252
          个交易日换算；未计末日清仓成本。收益排序不是策略推荐。
        </p>
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>逐月观察，而非只看终点</h2>
            <p>首尾月份可能不完整，月份收益包含实际扣除的成本。</p>
          </div>
          <label>
            查看策略
            <select value={id} onChange={(e) => setId(e.target.value)}>
              {result.strategies.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="months">
          {monthlyReturns(m.curve).map((x) => (
            <div
              className={x.ret >= 0 ? "month up" : "month down"}
              key={x.month}
            >
              <span>{x.month}</span>
              <strong>
                {x.ret > 0 ? "+" : ""}
                {pct(x.ret)}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>持仓与换仓账本</h2>
        <p>期末权重随价格漂移，不等于设定目标，也不是下一次交易指令。</p>
        <div className="weight-strip">
          {Object.entries(m.final_weights).map(([symbol, w]) => (
            <div key={symbol}>
              <b>{symbol}</b>
              <strong>{pct(w)}</strong>
            </div>
          ))}
        </div>
        <details>
          <summary>展开 {m.rebalances.length} 笔建仓 / 换仓记录</summary>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>信息截止</th>
                  <th>收盘执行</th>
                  <th>成交额 / 净值</th>
                  <th>成本</th>
                  <th>执行目标权重</th>
                </tr>
              </thead>
              <tbody>
                {m.rebalances.map((r) => (
                  <tr key={r.executionDate}>
                    <td>{r.signalAsOf}</td>
                    <td>{r.executionDate}</td>
                    <td>{pct(r.turnover)}</td>
                    <td>{money(r.cost)}</td>
                    <td>
                      {Object.entries(r.weights)
                        .map(([k, v]) => `${k} ${pct(v)}`)
                        .join(" / ")}
                    </td>
                  </tr>
                ))}
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
          <span>最大目标仓位</span>
          <strong>
            {r.largest.symbol} <small>{r.largest.weight}%</small>
          </strong>
          <p>按标的代码计算</p>
        </div>
        <div>
          <span>有效持仓数</span>
          <strong>{r.effectiveHoldings.toFixed(2)}</strong>
          <p>1 ÷ 权重平方和</p>
        </div>
        <div>
          <span>最长水下期</span>
          <strong>
            {dd.longestSessions}
            <small> 交易日</small>
          </strong>
          <p>我的组合未重回历史峰值的连续天数</p>
        </div>
        <div>
          <span>当前水下期</span>
          <strong>
            {dd.currentSessions}
            <small> 交易日</small>
          </strong>
          <p>最深回撤日期 {dd.worstDate}</p>
        </div>
      </div>
      <section className="panel">
        <h2>相关性：分开买，可能一起跌</h2>
        <p>
          比较窗口内的日收益相关系数。接近 +1
          表示同向变化；这是历史关系，不是未来的保护。
        </p>
        <div className="table-scroll">
          <table className="correlation">
            <thead>
              <tr>
                <th>标的</th>
                {r.assets.map((a) => (
                  <th key={a.symbol}>{a.symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.assets.map((a, i) => (
                <tr key={a.symbol}>
                  <th>{a.symbol}</th>
                  {r.correlations[i].map((v, j) => (
                    <td
                      key={j}
                      style={{
                        background:
                          v === null
                            ? "#f4f6f8"
                            : v >= 0
                              ? `rgba(23,63,104,${0.05 + Math.abs(v) * 0.24})`
                              : `rgba(18,125,120,${0.05 + Math.abs(v) * 0.24})`,
                      }}
                    >
                      {v === null ? "—" : v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          无波动序列无法定义相关系数，显示「—」。未穿透 ETF
          底层持仓，因此不能识别基金之间的股票重叠。
        </p>
      </section>
      <section className="panel">
        <h2>哪部分承担风险？</h2>
        <p>
          按当前目标权重与窗口内协方差，分解组合方差；这是静态估计，不是历史回测损益归因。
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>标的</th>
                <th>目标权重</th>
                <th>方差贡献</th>
                <th>标的累计收益</th>
                <th>标的年化波动</th>
                <th>标的最大回撤</th>
              </tr>
            </thead>
            <tbody>
              {r.assets.map((a, i) => (
                <tr key={a.symbol}>
                  <th>{a.symbol}</th>
                  <td>
                    {
                      result.config.holdings.find((h) => h.symbol === a.symbol)
                        ?.weight
                    }
                    %
                  </td>
                  <td>
                    {r.contribution[i] === null ? "—" : pct(r.contribution[i]!)}
                  </td>
                  <td>{pct(a.totalReturn)}</td>
                  <td>{pct(a.volatility)}</td>
                  <td className="negative">{pct(a.maxDrawdown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fine">
          方差贡献合计约
          100%；负值表示该标的在这个样本中降低组合方差。标的收益不扣组合交易成本。
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
      throw new Error("目标金额不能为负数");
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
            <h2>如果持仓同时遭遇冲击</h2>
            <p>
              对目标权重施加一次性价格变化，不假定发生概率，不包含换仓、费用与汇率。
            </p>
          </div>
          <span className="tag">假设情景</span>
        </div>
        <div className="button-row">
          <button
            onClick={() =>
              setShocks(
                Object.fromEntries(holdings.map((h) => [h.symbol, -20])),
              )
            }
          >
            全部下跌 20%
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
            最大仓位下跌 35%
          </button>
          <button onClick={() => setShocks({})}>清零</button>
        </div>
        <div className="scenario-grid">
          <div>
            {holdings.map((h) => (
              <label className="shock-row" key={h.symbol}>
                <span>
                  <b>{h.symbol}</b>
                  <small>目标 {h.weight}%</small>
                </span>
                <input
                  aria-label={`${h.symbol} 冲击百分比`}
                  type="number"
                  min="-100"
                  max="200"
                  value={shocks[h.symbol] ?? 0}
                  onChange={(e) =>
                    setShocks({ ...shocks, [h.symbol]: Number(e.target.value) })
                  }
                />
                <span>%</span>
              </label>
            ))}
          </div>
          <div className="scenario-result">
            <span>假设冲击后的资产</span>
            <strong>{stress ? money(stress.after) : "—"}</strong>
            <p
              className={stress && stress.change < 0 ? "negative" : "positive"}
            >
              {stress
                ? `${money(stress.change)} / ${pct(stress.return)}`
                : "请输入有效假设"}
            </p>
            <small>
              基于研究本金 {money(result.config.capital)}，并非实时账户余额。
            </small>
          </div>
        </div>
        {stressError && (
          <p role="alert" className="error">
            {stressError}
          </p>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>目标需要多少投入？</h2>
            <p>
              每月末追加投入，按用户设定的固定年增长率复利；不从历史收益推断未来。
            </p>
          </div>
          <span className="tag">确定性测算</span>
        </div>
        <div className="form-grid four">
          <label>
            起始本金 / USD
            <input
              type="number"
              min="0"
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
            />
          </label>
          <label>
            每月投入 / USD
            <input
              type="number"
              min="0"
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
            />
          </label>
          <label>
            年限
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
            目标金额 / USD
            <input
              type="number"
              min="0"
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="projection-grid">
          {rates.map((rate, i) => (
            <div key={i}>
              <label>
                情景 {i + 1} · 假设年增长率 %
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
                {projections[i] ? money(projections[i].value) : "—"}
              </strong>
              <p>
                {projections[i]
                  ? `累计投入 ${money(projections[i].paid)}`
                  : "检查输入"}
              </p>
              <small>
                {projections[i]
                  ? projections[i].value >= target
                    ? `在该假设下高于目标 ${money(projections[i].value - target)}`
                    : `在该假设下距目标 ${money(target - projections[i].value)}`
                  : ""}
              </small>
            </div>
          ))}
        </div>
        {goalError && (
          <p role="alert" className="error">
            {goalError}
          </p>
        )}
        {projections.length === 3 && (
          <details>
            <summary>逐年查看三种假设</summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>年末</th>
                    <th>累计投入</th>
                    {rates.map((r, i) => (
                      <th key={i}>{r}% 假设</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projections[0].path.map((p, i) => (
                    <tr key={i}>
                      <th>{p.year.toFixed(p.year % 1 ? 1 : 0)}</th>
                      <td>{money(p.paid)}</td>
                      {projections.map((s, j) => (
                        <td key={j}>{money(s.path[i].value)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <p className="fine">
          默认 -5%、3%、8%
          只是可编辑的演示假设，没有预测或概率含义。未计税费、通胀与投入时间变化。
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
      return setError("请填写研究标题和待验证判断");
    if (entries.length >= 50)
      return setError("最多保存 50 条日志，请先导出或整理");
    if (draft.evidence && !/^https?:\/\//i.test(draft.evidence))
      return setError("证据链接需以 http:// 或 https:// 开头");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.reviewDate))
      return setError("请选择复盘日期");
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
          <h2>把判断写下来，留给未来检验</h2>
          <p>
            先写证据、再写反例，最后约定复盘日期。保存于当前浏览器，不会自动通知或跨设备同步。
          </p>
        </div>
        <span className="journal-count">
          {open}
          <small>条待复盘</small>
        </span>
      </div>
      <section className="panel">
        <h2>新增研究记录</h2>
        <div className="form-grid">
          <label>
            研究标题
            <input
              maxLength={120}
              placeholder="例如：AI 产业组合是否过度集中？"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            复盘日期
            <input
              type="date"
              value={draft.reviewDate}
              onChange={(e) =>
                setDraft({ ...draft, reviewDate: e.target.value })
              }
            />
          </label>
          <label>
            待验证判断
            <textarea
              maxLength={4000}
              rows={3}
              placeholder="我的判断是什么？什么事实会支持它？"
              value={draft.thesis}
              onChange={(e) => setDraft({ ...draft, thesis: e.target.value })}
            />
          </label>
          <label>
            反证与失效条件
            <textarea
              maxLength={4000}
              rows={3}
              placeholder="出现什么事实，我会承认判断不成立？"
              value={draft.counter}
              onChange={(e) => setDraft({ ...draft, counter: e.target.value })}
            />
          </label>
        </div>
        <label>
          证据来源链接（可选）
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
            记录到研究日志
          </button>
          <span className="fine">
            添加后请点击顶部「保存本机」或「导出配置」。
          </span>
        </div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </section>
      {entries.length === 0 ? (
        <section className="empty-state">
          <span>01 / 写下第一个可验证的判断</span>
          <h3>好的研究，也应能被证伪。</h3>
          <p>日志里没有预填的“成功案例”。从你自己的问题开始。</p>
        </section>
      ) : (
        entries.map((e) => (
          <article className="panel journal-entry" key={e.id}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {e.status === "reviewed" ? "已复盘" : "待复盘"} ·{" "}
                  {e.reviewDate}
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
                {e.status === "open" ? "标记已复盘" : "重新打开"}
              </button>
            </div>
            <p className="preserve">{e.thesis}</p>
            {e.counter && (
              <div className="counter">
                <b>反证与失效条件</b>
                <p className="preserve">{e.counter}</p>
              </div>
            )}
            {e.evidence && (
              <a href={e.evidence} target="_blank" rel="noopener noreferrer">
                查看证据来源 ↗
              </a>
            )}
            <details className="delete-entry">
              <summary>管理记录</summary>
              <p className="fine">
                删除只更改本次工作区；保存本机后才覆盖已保存版本。
              </p>
              <button
                onClick={() => onChange(entries.filter((x) => x.id !== e.id))}
              >
                删除这条记录
              </button>
            </details>
          </article>
        ))
      )}
    </>
  );
}
