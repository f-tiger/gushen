import { useState } from "react";
import {
  recommend,
  explainPortfolio,
  analyzeGoal,
  type RecommendResponse,
  type GoalResponse,
} from "./api";
import AggressiveTools from "./AggressiveTools";
import DataFooter from "./DataFooter";

type Tab = "advisor" | "aggressive";

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const btn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        padding: "6px 14px", marginRight: 8, cursor: "pointer",
        borderRadius: 6, border: "1px solid #ccc",
        background: tab === t ? "#222" : "#fff", color: tab === t ? "#fff" : "#222",
      }}
    >
      {label}
    </button>
  );
  return (
    <div style={{ margin: "12px 0 20px" }}>
      {btn("advisor", "智能投顾")}
      {btn("aggressive", "进攻工具")}
    </div>
  );
}

const VERDICT_CN: Record<string, { label: string; color: string }> = {
  realistic: { label: "现实可行", color: "#1a7f37" },
  aggressive: { label: "偏激进", color: "#9a6700" },
  very_aggressive: { label: "极激进", color: "#bc4c00" },
  unrealistic: { label: "不现实", color: "#cf222e" },
};

const QUESTIONS: { key: string; label: string }[] = [
  { key: "horizon", label: "投资期限（0:<1年 → 3:>10年）" },
  { key: "drawdown_tolerance", label: "回撤承受（0:<5% → 3:>30%）" },
  { key: "experience", label: "投资经验（0:无 → 3:丰富）" },
  { key: "income_stability", label: "收入稳定性（0:不稳定 → 3:很稳定）" },
  { key: "goal", label: "投资目标（0:保本 → 3:激进增值）" },
];

export default function App() {
  const [answers, setAnswers] = useState<Record<string, number>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.key, 1]))
  );
  const [symbols, setSymbols] = useState("SPY,QQQ,GLD,TLT");
  const [result, setResult] = useState<RecommendResponse | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [tab, setTab] = useState<Tab>("advisor");

  // 目标可行性
  const [initial, setInitial] = useState(1_000_000);
  const [target, setTarget] = useState(10_000_000);
  const [years, setYears] = useState(1);
  const [goal, setGoal] = useState<GoalResponse | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalError, setGoalError] = useState("");

  async function onAnalyzeGoal() {
    setGoalLoading(true);
    setGoalError("");
    setGoal(null);
    try {
      const syms = symbols.split(",").map((s) => s.trim()).filter(Boolean);
      setGoal(await analyzeGoal(initial, target, years, syms));
    } catch (e) {
      setGoalError(String(e instanceof Error ? e.message : e));
    } finally {
      setGoalLoading(false);
    }
  }

  async function onSubmit() {
    setLoading(true);
    setError("");
    setResult(null);
    setExplanation("");
    try {
      const syms = symbols.split(",").map((s) => s.trim()).filter(Boolean);
      const rec = await recommend(answers, syms);
      setResult(rec);
      // 组合解读：纯前端版固定用确定性模板（不调用任何大模型）
      try {
        const exp = await explainPortfolio(rec.profile, rec.portfolio);
        setExplanation(exp.explanation);
      } catch {
        /* 解读失败不影响主流程 */
      }
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  if (tab === "aggressive") {
    return (
      <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui", padding: 16 }}>
        <nav aria-label="AGI 子站导航" style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, marginBottom: 16 }}><a href="https://agiscorecard.com/cn">AGI 首页</a><a href="https://agiscorecard.com/zh/invest">投资研究</a><a href="https://compass.agiscorecard.com/zh/">投资罗盘</a></nav>
      <h1>股神 · 进攻工具</h1>
        <TabBar tab={tab} setTab={setTab} />
        <AggressiveTools />
        <DataFooter />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui", padding: 16 }}>
      <nav aria-label="AGI 子站导航" style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 14, marginBottom: 16 }}><a href="https://agiscorecard.com/cn">AGI 首页</a><a href="https://agiscorecard.com/zh/invest">投资研究</a><a href="https://compass.agiscorecard.com/zh/">投资罗盘</a></nav>
      <h1>股神 · AI 智能投顾</h1>
      <TabBar tab={tab} setTab={setTab} />
      <p style={{ color: "#666" }}>
        回答风险问卷 → 生成风险画像 → 用推荐算法构建组合。
        <br />
        <small>⚠️ 仅供教育/信息参考，不构成投资建议。</small>
      </p>

      <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 24 }}>
        <h3 style={{ marginTop: 0 }}>目标可行性分析</h3>
        <p style={{ color: "#666", marginTop: 0 }}>
          计算目标所需收益，比较同一标的池的历史模拟，并查看明确假设下的情景概率。
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label>
            初始（¥）
            <br />
            <input type="number" value={initial} onChange={(e) => setInitial(Number(e.target.value))} style={{ width: 130 }} />
          </label>
          <label>
            目标（¥）
            <br />
            <input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: 130 }} />
          </label>
          <label>
            年限
            <br />
            <input type="number" value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ width: 70 }} />
          </label>
          <button onClick={onAnalyzeGoal} disabled={goalLoading} style={{ padding: "8px 16px" }}>
            {goalLoading ? "分析中…" : "分析可行性"}
          </button>
        </div>
        {goalError && <p style={{ color: "crimson" }}>错误：{goalError}</p>}
        {goal && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 18 }}>
              需要年化 <b>{(goal.required_cagr * 100).toFixed(0)}%</b> · 模型情景概率{" "}
              <b>{(goal.prob_success * 100).toFixed(2)}%</b> · 判定{" "}
              <b style={{ color: VERDICT_CN[goal.verdict]?.color }}>
                {VERDICT_CN[goal.verdict]?.label ?? goal.verdict}
              </b>
            </p>
            <p style={{ color: "#444" }}>{goal.message}</p>
            <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, overflowX: 'auto' }}>
              <b>历史验证账本 · {goal.evaluation.method_version}</b>
              <p style={{ fontSize: 13 }}>{goal.evaluation.from} → {goal.evaluation.to} · 每笔成交额成本 {goal.evaluation.cost_bps} 基点 · 未计税费、额外滑点和终止清仓成本。</p>
              <table style={{ width: '100%', fontSize: 13, textAlign: 'right' }}>
                <thead><tr><th scope="col">同一标的池</th><th scope="col">累计</th><th scope="col">年化</th><th scope="col">最大回撤</th></tr></thead>
                <tbody>{[['HRP', goal.evaluation], ['等权基准', goal.equalWeight]].map(([label, raw]) => {
                  const m = raw as typeof goal.evaluation;
                  return <tr key={String(label)}><th scope="row">{String(label)}</th><td>{(m.total_return * 100).toFixed(2)}%</td><td>{(m.cagr * 100).toFixed(2)}%</td><td>{(m.max_drawdown * 100).toFixed(2)}%</td></tr>;
                })}</tbody>
              </table>
              <p style={{ fontSize: 13 }}>用前一交易日及更早数据形成权重，在月内首个可用交易日收盘换仓；期间持仓随价格漂移。当前标的池仍存在选择与幸存者偏差；这不是实盘业绩或经校准的未来成功率。</p>
              {!!goal.skipped.length && <p>未纳入：{goal.skipped.join('、')}</p>}
              <button type="button" onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(goal, null, 2)], { type: 'application/json' }));
                const a = document.createElement('a'); a.href = url; a.download = 'gushen-research-audit.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}>下载方法、换仓日期与成本账本</button>
            </div>
            <p style={{ color: "#666", fontSize: 13 }}>
              {goal.years} 年后模型区间（假设历史算术收益与波动参数保持不变）：中位 ¥{goal.projection.median.toLocaleString()} ·
              5% 分位 ¥{goal.projection.p5.toLocaleString()} · 95% 分位 ¥{goal.projection.p95.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      <h3>风险问卷</h3>
      {QUESTIONS.map((q) => (
        <div key={q.key} style={{ marginBottom: 8 }}>
          <label>
            {q.label}：<b>{answers[q.key]}</b>
            <input
              type="range"
              min={0}
              max={3}
              value={answers[q.key]}
              onChange={(e) =>
                setAnswers({ ...answers, [q.key]: Number(e.target.value) })
              }
              style={{ width: "100%" }}
            />
          </label>
        </div>
      ))}

      <h3>标的池（逗号分隔，建议用 ETF）</h3>
      <input
        value={symbols}
        onChange={(e) => setSymbols(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />

      <button onClick={onSubmit} disabled={loading} style={{ marginTop: 16, padding: "8px 16px" }}>
        {loading ? "生成中…" : "生成组合"}
      </button>

      {error && <p style={{ color: "crimson" }}>错误：{error}</p>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <h3>风险画像</h3>
          <p>
            评分 <b>{result.profile.score}</b> · 档位 <b>{result.profile.level}</b> · 推荐方法{" "}
            <b>{result.profile.recommended_method}</b> · 目标期限{" "}
            {result.profile.target_horizon_years} 年
          </p>
          {result.skipped && result.skipped.length > 0 && (
            <p style={{ color: "#9a6700" }}>数据集里没有、已跳过：{result.skipped.join(", ")}</p>
          )}
          <h3>推荐组合（{result.portfolio.method}）</h3>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <tbody>
              {Object.entries(result.portfolio.weights).map(([sym, w]) => (
                <tr key={sym}>
                  <td style={{ padding: 4 }}>{sym}</td>
                  <td style={{ padding: 4 }}>{(w * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#666", marginTop: 8 }}>
            样本内拟合（不是回测）：历史年化均值 {(result.portfolio.expected_annual_return * 100).toFixed(1)}% ·
            波动 {(result.portfolio.annual_volatility * 100).toFixed(1)}% · 夏普{" "}
            {result.portfolio.sharpe_ratio.toFixed(2)}
            <br />
            <small>历史数据估算，非未来预测。</small>
          </p>

          {explanation && (
            <div style={{ marginTop: 16 }}>
              <h3>组合解读（模板生成）</h3>
              <p style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
                {explanation}
              </p>
            </div>
          )}
        </div>
      )}
      <DataFooter />
    </div>
  );
}

