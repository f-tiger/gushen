import { t, tr } from "./locale";
import { useState } from "react";
import {
  screenStocks,
  kellySize,
  buildBarbell,
  type ScreenCandidate,
  type KellyResponse,
  type BarbellResponse,
} from "./api";

const card = {
  border: "1px solid #ddd",
  borderRadius: 8,
  padding: 16,
  marginBottom: 20,
};

function Screener() {
  const [symbols, setSymbols] = useState("NVDA,SMCI,AMD,TSLA,PLTR,MU,MRVL");
  const [mode, setMode] = useState<"momentum" | "multibagger">("multibagger");
  const [rows, setRows] = useState<ScreenCandidate[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setLoading(true);
    setErr("");
    setRows([]);
    try {
      const syms = symbols
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const r = await screenStocks(syms, mode);
      setRows(r.candidates);
      setNote(r.note);
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{t("价格特征筛选器")}</h3>
      <p style={{ color: "#666", marginTop: 0 }}>
        {t(
          "两种价格评分规则：回撤与中期趋势，或近期动量。未使用财报、估值或现金流数据，分数不代表上涨概率。",
        )}
      </p>
      <input
        value={symbols}
        onChange={(e) => setSymbols(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />
      <div style={{ margin: "8px 0" }}>
        <label style={{ marginRight: 12 }}>
          <input
            type="radio"
            checked={mode === "multibagger"}
            onChange={() => setMode("multibagger")}
          />{" "}
          {t("回撤与趋势")}
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "momentum"}
            onChange={() => setMode("momentum")}
          />{" "}
          {t("近期动量")}
        </label>
        <button
          onClick={run}
          disabled={loading}
          style={{ marginLeft: 12, padding: "6px 14px" }}
        >
          {tr(loading ? t("筛选中…") : t("筛选"))}
        </button>
      </div>
      {tr(
        err && (
          <p style={{ color: "crimson" }}>
            {t("错误：")}
            {tr(err)}
          </p>
        ),
      )}
      {tr(
        rows.length > 0 && (
          <div className="table-scroll">
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{ textAlign: "left", borderBottom: "1px solid #ccc" }}
                >
                  <th>{t("标的")}</th>
                  <th>{t("评分")}</th>
                  <th>{t("6m动量")}</th>
                  <th>{t("趋势")}</th>
                  <th>{t("年化波动")}</th>
                  <th>{t("最大回撤")}</th>
                </tr>
              </thead>
              <tbody>
                {tr(
                  rows.map((c) => (
                    <tr
                      key={c.symbol}
                      style={{ borderBottom: "1px solid #f0f0f0" }}
                    >
                      <td>{tr(c.symbol)}</td>
                      <td>{tr(c.score.toFixed(2))}</td>
                      <td>
                        {tr(
                          c.momentum["6m"] != null
                            ? (c.momentum["6m"]! * 100).toFixed(0) + "%"
                            : "—",
                        )}
                      </td>
                      <td>{tr(c.trend)}</td>
                      <td style={{ color: "#b45" }}>
                        {tr((c.risk.annualized_vol * 100).toFixed(0))}%
                      </td>
                      <td style={{ color: "#c33" }}>
                        {tr((c.risk.max_drawdown * 100).toFixed(0))}%
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ),
      )}
      {tr(
        note && (
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
            {tr(note)}
          </p>
        ),
      )}
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
    setErr("");
    setRes(null);
    try {
      setRes(await kellySize(bankroll, winProb, winMult));
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{t("凯利仓位计算器")}</h3>
      <p style={{ color: "#666", marginTop: 0 }}>
        {t(
          "根据手动输入的胜率与盈亏假设计算分数凯利。假设有误时，计算结果也可能导致严重亏损。",
        )}
      </p>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "flex-end",
        }}
      >
        <label>
          {t("本金¥")}
          <br />
          <input
            type="number"
            value={bankroll}
            onChange={(e) => setBankroll(+e.target.value)}
            style={{ width: 120 }}
          />
        </label>
        <label>
          {t("胜率")}
          <br />
          <input
            type="number"
            step="0.01"
            value={winProb}
            onChange={(e) => setWinProb(+e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <label>
          {t("目标倍数")}
          <br />
          <input
            type="number"
            value={winMult}
            onChange={(e) => setWinMult(+e.target.value)}
            style={{ width: 80 }}
          />
        </label>
        <button onClick={run} style={{ padding: "6px 14px" }}>
          {t("计算")}
        </button>
      </div>
      {tr(
        err && (
          <p style={{ color: "crimson" }}>
            {t("错误：")}
            {tr(err)}
          </p>
        ),
      )}
      {tr(
        res && (
          <div style={{ marginTop: 10 }}>
            <p>
              {t("模型仓位：")}
              <b>{tr((res.capped_fraction * 100).toFixed(2))}%</b>（¥
              {tr(res.recommended_amount.toLocaleString())}）
            </p>
            <p style={{ color: "#444" }}>
              {t("假设胜率并非预测；分数凯利和仓位上限不保证本金安全。")}
            </p>
          </div>
        ),
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
    setLoading(true);
    setErr("");
    setRes(null);
    try {
      const c = core
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const s = sat
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
      setRes(await buildBarbell(c, s, safe));
    } catch (e) {
      setErr(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>{t("杠铃组合构造器")}</h3>
      <p style={{ color: "#666", marginTop: 0 }}>
        {t(
          "比较核心组合与卫星组合的配置。股票、债券和黄金均可能亏损，较高核心比例不保证本金安全。",
        )}
      </p>
      <label>
        {t("核心组合")}
        <br />
        <input
          value={core}
          onChange={(e) => setCore(e.target.value)}
          style={{ width: "100%", padding: 6 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 6 }}>
        {t("进攻端")}
        <br />
        <input
          value={sat}
          onChange={(e) => setSat(e.target.value)}
          style={{ width: "100%", padding: 6 }}
        />
      </label>
      <div style={{ marginTop: 8 }}>
        {t("核心比例：")}
        <b>{tr((safe * 100).toFixed(0))}%</b>
        <input
          type="range"
          min={0.5}
          max={0.95}
          step={0.05}
          value={safe}
          onChange={(e) => setSafe(+e.target.value)}
          style={{ width: "100%" }}
        />
        <button
          onClick={run}
          disabled={loading}
          style={{ padding: "6px 14px" }}
        >
          {tr(loading ? t("构造中…") : t("构造杠铃"))}
        </button>
      </div>
      {tr(
        err && (
          <p style={{ color: "crimson" }}>
            {t("错误：")}
            {tr(err)}
          </p>
        ),
      )}
      {tr(
        res && (
          <div className="table-scroll">
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                marginTop: 10,
              }}
            >
              <tbody>
                {tr(
                  Object.entries(res.weights).map(([s, w]) => (
                    <tr key={s}>
                      <td style={{ padding: 4 }}>{tr(s)}</td>
                      <td style={{ padding: 4 }}>
                        {tr((w * 100).toFixed(1))}%
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        ),
      )}
      {tr(
        res?.note && (
          <p style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
            {t("假设胜率并非预测；分数凯利和仓位上限不保证本金安全。")}
          </p>
        ),
      )}
    </div>
  );
}

export default function AggressiveTools() {
  return (
    <div>
      <p style={{ color: "#666" }}>
        {t(
          "专项计算用于比较方法与假设，不产生交易指令。请结合风险透视与研究日志复核结论。",
        )}
      </p>
      <Screener />
      <KellyCalc />
      <BarbellBuilder />
    </div>
  );
}
