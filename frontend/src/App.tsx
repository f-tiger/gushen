import { useState } from "react";
import { recommend, explainPortfolio, type RecommendResponse } from "./api";

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

  async function onSubmit() {
    setLoading(true);
    setError("");
    setResult(null);
    setExplanation("");
    try {
      const syms = symbols.split(",").map((s) => s.trim()).filter(Boolean);
      const rec = await recommend(answers, syms);
      setResult(rec);
      // 拿到组合后请求 AI 解读（无 key 时后端返回确定性回退文本）
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

  return (
    <div style={{ maxWidth: 640, margin: "40px auto", fontFamily: "system-ui", padding: 16 }}>
      <h1>股神 · AI 智能投顾</h1>
      <p style={{ color: "#666" }}>
        回答风险问卷 → 生成风险画像 → 用推荐算法构建组合。
        <br />
        <small>⚠️ 仅供教育/信息参考，不构成投资建议。</small>
      </p>

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
            历史估算：年化收益 {(result.portfolio.expected_annual_return * 100).toFixed(1)}% ·
            波动 {(result.portfolio.annual_volatility * 100).toFixed(1)}% · 夏普{" "}
            {result.portfolio.sharpe_ratio.toFixed(2)}
            <br />
            <small>历史数据估算，非未来预测。</small>
          </p>

          {explanation && (
            <div style={{ marginTop: 16 }}>
              <h3>AI 解读</h3>
              <p style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, borderRadius: 6 }}>
                {explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
