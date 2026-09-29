import { useEffect, useState } from "react";
import type { StrategyResult } from "./engine/research";

export const pct = (n: number, digits = 1) =>
  Number.isFinite(n) ? `${(n * 100).toFixed(digits)}%` : "—";
export const money = (n: number) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n)
    : "—";

export default function WorkbenchChart({
  strategies,
}: {
  strategies: StrategyResult[];
}) {
  const [mode, setMode] = useState<"nav" | "drawdown">("nav");
  const [index, setIndex] = useState<number | null>(null);
  const [compact, setCompact] = useState(window.innerWidth < 680);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 680px)"),
      update = () => setCompact(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const curves = strategies.map((s) => s.metrics.curve),
    n = curves[0].length;
  const values = curves.flatMap((c) => c.map((p) => p[mode]));
  let lo = Math.min(...values),
    hi = Math.max(...values);
  const pad = (hi - lo) * 0.1 || 1;
  lo -= pad;
  hi += pad;
  const W = compact ? 430 : 920,
    H = compact ? 265 : 310,
    L = compact ? 52 : 76,
    R = 18,
    T = 20,
    B = 38;
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R),
    y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const selected = index === null ? n - 1 : Math.min(index, n - 1);
  return (
    <section className="chart-block" aria-label="历史模拟曲线">
      <div className="section-heading">
        <div>
          <h2>让三种策略在同一窗口比较</h2>
          <p>
            {curves[0][1].date} — {curves[0][n - 1].date} · 已扣设定交易成本
          </p>
        </div>
        <div className="segmented" aria-label="曲线指标">
          <button aria-pressed={mode === "nav"} onClick={() => setMode("nav")}>
            资产曲线
          </button>
          <button
            aria-pressed={mode === "drawdown"}
            onClick={() => setMode("drawdown")}
          >
            历史回撤
          </button>
        </div>
      </div>
      <div className="chart-readout">
        <span>{curves[0][selected].date}</span>
        {strategies.map((s, i) => (
          <span key={s.id}>
            <i style={{ background: s.color }} />
            {s.name}{" "}
            <strong>
              {mode === "nav"
                ? money(curves[i][selected].nav)
                : pct(curves[i][selected].drawdown, 2)}
            </strong>
          </span>
        ))}
      </div>
      <svg
        className="performance-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={
          mode === "nav"
            ? "三种策略的美元资产历史曲线"
            : "三种策略从历史峰值回落的比例"
        }
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setIndex(
            Math.round(
              Math.max(
                0,
                Math.min(
                  1,
                  (((e.clientX - r.left) / r.width) * W - L) / (W - L - R),
                ),
              ) *
                (n - 1),
            ),
          );
        }}
        onPointerLeave={() => setIndex(null)}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const v = lo + ((hi - lo) * i) / 4;
          return (
            <g key={i}>
              <line x1={L} y1={y(v)} x2={W - R} y2={y(v)} stroke="#e4ebf0" />
              <text x={L - 12} y={y(v) + 4} textAnchor="end">
                {mode === "nav" ? `${(v / 1000).toFixed(0)}k` : pct(v, 0)}
              </text>
            </g>
          );
        })}
        {strategies.map((s, i) => (
          <path
            key={s.id}
            d={curves[i]
              .map(
                (p, j) =>
                  `${j ? "L" : "M"}${x(j).toFixed(1)},${y(p[mode]).toFixed(1)}`,
              )
              .join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth={i === 0 ? 3 : 2}
            strokeDasharray={i === 1 ? "5 4" : undefined}
          />
        ))}
        <line
          x1={x(selected)}
          x2={x(selected)}
          y1={T}
          y2={H - B}
          stroke="#8396a8"
          strokeDasharray="3 4"
        />
        {curves.map((c, i) => (
          <circle
            key={i}
            cx={x(selected)}
            cy={y(c[selected][mode])}
            r="4"
            fill={strategies[i].color}
            stroke="white"
            strokeWidth="2"
          />
        ))}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 10}
            textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          >
            {curves[0][i].date}
          </text>
        ))}
      </svg>
      <label className="chart-scrubber">
        查看交易日
        <input
          aria-label="查看曲线交易日"
          type="range"
          min="0"
          max={n - 1}
          value={selected}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
      </label>
      <p className="fine">
        曲线包含建仓前的本金基点；首日收盘建仓，首日只扣建仓成本。历史模拟不代表未来表现。
      </p>
    </section>
  );
}
