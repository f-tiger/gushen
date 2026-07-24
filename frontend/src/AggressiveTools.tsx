import { useState } from "react";
import {
  screenStocks,
  kellySize,
  buildBarbell,
  type ScreenCandidate,
  type KellyResponse,
  type BarbellResponse,
} from "./api";

const card = { border: "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 20 };

function Screener() {
  const [symbols, setSymbols] = useState("NVDA,SMCI,AMD,TSLA,PLTR,MU,MRVL");
  const [mode, setMode] = useState<"momentum" | "multibagger">("multibagger");
  const [rows, setRows] = useState<ScreenCandidate[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setLoading(true); setErr(""); setRows([]);
    try {
      const syms = symbols.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await screenStocks(syms, mode);
      setRows(r.candidates); setNote(r.note);
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
    finally { setLoading(false); }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>成长筛选器</h3>
      <p style={{ color: "#666", marginTop: 0 }}>
        multibagger 模式基于 464 只 10 倍股实证：奖励远离高点 + 高 FCF yield；momentum 模式追当前强势。
      </p>
      <input value={symbols} onChange={(e) => setSymbols(e.target.value)} style={{ width: "100%", padding: 8 }} />
      <div style={{ margin: "8px 0" }}>
        <label style={{ marginRight: 12 }}>
          <input type="radio" checked={mode === "multibagger"} onChange={() => setMode("multibagger")} /> 猎多倍股
        </label>
        <label>
          <input type="radio" checked={mode === "momentum"} onChange={() => setMode("momentum")} /> 追强势
        </label>
        <button onClick={run} disabled={loading} style={{ marginLeft: 12, padding: "6px 14px" }}>
          {loading ? "筛选中…" : "筛选"}
        </button>
      </div>
      {err && <p style={{ color: "crimson" }}>错误：{err}</p>}
      {rows.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}>
              <th>标的</th><th>评分</th><th>6m动量</th><th>趋势</th><th>年化波动</th><th>最大回撤</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.symbol} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td>{c.symbol}</td>
                <td>{c.score.toFixed(2)}</td>
                <td>{c.momentum["6m"] != null ? (c.momentum["6m"]! * 100).toFixed(0) + "%" : "—"}</td>
                <td>{c.trend}</td>
                <td style={{ color: "#b45" }}>{(c.risk.annualized_vol * 100).toFixed(0)}%</td>
                <td style={{ color: "#c33" }}>{(c.risk.max_drawdown * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {note && <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>{note}</p>}
    </div>
  );
}

function KellyCalc() {
  const [bankroll, setBankroll] = useState(1_000_000);
  const [winProb, setWinProb] = useState(0.15);
  const [winMult, setWinMult] = useState(10);
  const [res, setRes] = useState<KellyResponse | null>(null);
  const [err, setErr] = useState("");

  async function run() {
    setErr(""); setRes(null);
    try { setRes(await kellySize(bankroll, winProb, winMult)); }
    catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>凯利仓位计算器</h3>
      <p style={{ color: "#666", marginTop: 0 }}>博高倍时该押多少才不被打死。没有真实优势时会告诉你「别押」。</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <label>本金¥<br /><input type="number" value={bankroll} onChange={(e) => setBankroll(+e.target.value)} style={{ width: 120 }} /></label>
        <label>胜率<br /><input type="number" step="0.01" value={winProb} onChange={(e) => setWinProb(+e.target.value)} style={{ width: 80 }} /></label>
        <label>目标倍数<br /><input type="number" value={winMult} onChange={(e) => setWinMult(+e.target.value)} style={{ width: 80 }} /></label>
        <button onClick={run} style={{ padding: "6px 14px" }}>计算</button>
      </div>
      {err && <p style={{ color: "crimson" }}>错误：{err}</p>}
      {res && (
        <div style={{ marginTop: 10 }}>
          <p>建议单注：<b>{(res.capped_fraction * 100).toFixed(2)}%</b>（¥{res.recommended_amount.toLocaleString()}）</p>
          <p style={{ color: "#444" }}>{res.note}</p>
        </div>
      )}
    </div>
  );
}

function BarbellBuilder() {
  const [core, setCore] = useState("SPY,TLT,GLD");
  const [sat, setSat] = useState("NVDA,SMCI");
  const [safe, setSafe] = useState(0.8);
  const [res, setRes] = useState<BarbellResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setLoading(true); setErr(""); setRes(null);
    try {
      const c = core.split(",").map((s) => s.trim()).filter(Boolean);
      const s = sat.split(",").map((x) => x.trim()).filter(Boolean);
      setRes(await buildBarbell(c, s, safe));
    } catch (e) { setErr(String(e instanceof Error ? e.message : e)); }
    finally { setLoading(false); }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>杠铃组合构造器</h3>
      <p style={{ color: "#666", marginTop: 0 }}>大部分保命核心 + 一小块定义化风险的进攻 sleeve。任何一注归零都不致命。</p>
      <label>保命核心<br /><input value={core} onChange={(e) => setCore(e.target.value)} style={{ width: "100%", padding: 6 }} /></label>
      <label style={{ display: "block", marginTop: 6 }}>进攻端<br /><input value={sat} onChange={(e) => setSat(e.target.value)} style={{ width: "100%", padding: 6 }} /></label>
      <div style={{ marginTop: 8 }}>
        保命比例：<b>{(safe * 100).toFixed(0)}%</b>
        <input type="range" min={0.5} max={0.95} step={0.05} value={safe} onChange={(e) => setSafe(+e.target.value)} style={{ width: "100%" }} />
        <button onClick={run} disabled={loading} style={{ padding: "6px 14px" }}>{loading ? "构造中…" : "构造杠铃"}</button>
      </div>
      {err && <p style={{ color: "crimson" }}>错误：{err}</p>}
      {res && (
        <table style={{ borderCollapse: "collapse", width: "100%", marginTop: 10 }}>
          <tbody>
            {Object.entries(res.weights).map(([s, w]) => (
              <tr key={s}><td style={{ padding: 4 }}>{s}</td><td style={{ padding: 4 }}>{(w * 100).toFixed(1)}%</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AggressiveTools() {
  return (
    <div>
      <p style={{ color: "#666" }}>
        进攻型工具：找高弹性候选 → 算仓位（不被打死）→ 组杠铃。每个都同时给你上行与下行，
        <b>不承诺命中</b>——高倍上行有多大、归零风险就有多大。
      </p>
      <Screener />
      <KellyCalc />
      <BarbellBuilder />
    </div>
  );
}
