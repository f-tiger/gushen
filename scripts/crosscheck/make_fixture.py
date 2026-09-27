"""用后端 Python 原版算一份基准结果，给前端 TS 引擎做逐项对照（frontend/src/engine/crosscheck.test.ts）。

运行：pip install numpy pandas scipy scikit-learn pyportfolioopt
      PYTHONPATH=backend python3 scripts/crosscheck/make_fixture.py
输出：frontend/src/engine/__fixtures__/{prices.synthetic.json, expected.json}

数据是固定种子的合成行情（不是任何真实标的），只用来验证两套实现算出同样的数。
加载逻辑照抄后端路由的 _load_prices / _load_series：按「截止日往前 N 个自然日」取窗，
多标的按交易日取交集（DataFrame(...).dropna()）。
"""
from __future__ import annotations

import json
import os
import sys
import types
from datetime import date, timedelta

import numpy as np
import pandas as pd

# explain.py 会 import AI 客户端与 pydantic 配置；这里只用它的确定性回退，桩掉这两个模块。
cfg = types.ModuleType("app.core.config")
cfg.settings = types.SimpleNamespace(compliance_mode="education_only")
sys.modules["app.core.config"] = cfg
cli = types.ModuleType("app.services.ai.client")
cli.SYSTEM_GUARDRAILS = ""
cli.ai_available = lambda: False
cli.chat = None
sys.modules["app.services.ai.client"] = cli

from app.services.ai.explain import explain_portfolio  # noqa: E402
from app.services.analysis.screener import screen  # noqa: E402
from app.services.backtest.engine import backtest  # noqa: E402
from app.services.planning.goal import analyze_goal  # noqa: E402
from app.services.planning.kelly import size_bet  # noqa: E402
from app.services.portfolio.barbell import build_barbell  # noqa: E402
from app.services.portfolio.optimizer import optimize  # noqa: E402
from app.services.profiling.risk_profile import score_answers  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "frontend", "src", "engine", "__fixtures__")

# ---- 合成行情：单因子 + 个体噪声的对数正态随机游走，工作日日历 ----
rng = np.random.default_rng(20260927)
SPEC = {  # 代码: (年化漂移, 年化波动, 因子载荷)
    "AAA": (0.08, 0.16, 0.9), "BBB": (0.12, 0.28, 1.2), "CCC": (0.03, 0.07, -0.2),
    "DDD": (0.05, 0.12, 0.1), "EEE": (0.30, 0.55, 1.5), "FFF": (-0.10, 0.45, 1.3),
    "GGG": (0.20, 0.40, 1.1), "HHH": (0.15, 0.35, 0.8), "III": (0.00, 0.25, 0.6),
    "JJJ": (0.25, 0.60, 1.4),
}
dates = pd.bdate_range("2022-01-03", "2026-09-25")
n = len(dates)
factor = rng.normal(0, 0.01, n)
close: dict[str, list] = {}
for sym, (mu, sig, beta) in SPEC.items():
    idio = rng.normal(0, 1, n)
    dvol = sig / np.sqrt(252)
    r = mu / 252 - 0.5 * dvol**2 + beta * factor * 0.6 + idio * dvol * 0.8
    px = 100 * np.exp(np.cumsum(r))
    vals = [round(float(v), 4) for v in px]
    close[sym] = vals
# 一个中途才开始有数据的标的 + 若干缺失日，检验对齐逻辑
close["JJJ"][:300] = [None] * 300
for k in (500, 777, 1000):
    close["CCC"][k] = None

as_of = dates[-1].date().isoformat()
iso = [d.date().isoformat() for d in dates]
prices_file = {"asOf": as_of, "generated": "fixture", "source": "synthetic (seed 20260927)",
               "dates": iso, "close": close}


def series(sym: str, days: int) -> pd.Series:
    start = (dates[-1] - timedelta(days=days)).date().isoformat()
    s = pd.Series(close[sym], index=pd.to_datetime(iso), dtype="float64")
    s = s[s.index >= pd.Timestamp(start)]
    return s.dropna()


def frame(syms: list[str], days: int) -> pd.DataFrame:
    return pd.DataFrame({s: series(s, days) for s in syms}).sort_index().dropna()


out: dict = {"optimize": [], "recommend": [], "backtest": [], "goal": [], "kelly": [],
             "barbell": [], "screen": [], "explain": []}

POOL = ["AAA", "BBB", "CCC", "DDD", "EEE"]
for method in ["equal_weight", "inverse_vol", "momentum", "hrp", "min_volatility", "max_sharpe"]:
    for syms, days, bounds in [(POOL, 365, (0.0, 1.0)), (["AAA", "CCC", "DDD", "GGG", "HHH", "JJJ"], 730, (0.0, 0.35))]:
        r = optimize(frame(syms, days), method, weight_bounds=bounds).to_dict()
        out["optimize"].append({"symbols": syms, "days": days, "bounds": list(bounds), "method": method, "result": r})

for answers in [
    {"horizon": 0, "drawdown_tolerance": 0, "experience": 0, "income_stability": 1, "goal": 0},
    {"horizon": 1, "drawdown_tolerance": 1, "experience": 1, "income_stability": 1, "goal": 1},
    {"horizon": 2, "drawdown_tolerance": 2, "experience": 1, "income_stability": 2, "goal": 1},
    {"horizon": 3, "drawdown_tolerance": 2, "experience": 2, "income_stability": 2, "goal": 3},
    {"horizon": 3, "drawdown_tolerance": 3, "experience": 3, "income_stability": 3, "goal": 3},
]:
    syms = ["AAA", "BBB", "CCC", "DDD", "EEE", "GGG"]
    prof = score_answers(answers)
    res = optimize(frame(syms, 365), prof.recommended_method, weight_bounds=(0.0, prof.max_weight)).to_dict()
    out["recommend"].append({"answers": answers, "symbols": syms, "profile": prof.to_dict(), "portfolio": res})
    out["explain"].append({"profile": prof.to_dict(), "portfolio": res,
                           "result": explain_portfolio(prof.to_dict(), res)})

for method in ["hrp", "inverse_vol", "equal_weight"]:
    bt = backtest(frame(["AAA", "BBB", "CCC", "DDD"], 1095), method)
    out["backtest"].append({"symbols": ["AAA", "BBB", "CCC", "DDD"], "days": 1095, "method": method,
                            "metrics": bt.metrics.to_dict(), "raw": {"cagr": bt.metrics.cagr,
                                                                     "vol": bt.metrics.annual_volatility}})

for syms, (init, tgt, yrs) in [(["AAA", "BBB", "CCC", "DDD"], (1_000_000, 10_000_000, 1)),
                               (["AAA", "BBB", "CCC", "DDD"], (100_000, 200_000, 7)),
                               (["AAA", "DDD", "GGG"], (50_000, 60_000, 3))]:
    bt = backtest(frame(syms, 1095), "hrp")
    g = analyze_goal(init, tgt, yrs, bt.metrics.cagr, bt.metrics.annual_volatility).to_dict()
    g["assumptions"] = {"expected_return": round(bt.metrics.cagr, 4), "expected_vol": round(bt.metrics.annual_volatility, 4)}
    out["goal"].append({"symbols": syms, "initial": init, "target": tgt, "years": yrs, "result": g})

for args in [(1_000_000, 0.15, 10), (1_000_000, 0.05, 10), (250_000, 0.4, 3), (10_000, 0.6, 2)]:
    out["kelly"].append({"args": list(args), "result": size_bet(*args).to_dict()})

core = frame(["AAA", "CCC", "DDD"], 365)
bb = build_barbell(core, frame(["EEE", "GGG", "JJJ"], 365), 0.8, per_bet_cap=0.10)
out["barbell"].append({"core": ["AAA", "CCC", "DDD"], "sat": ["EEE", "GGG", "JJJ"], "safe": 0.8, "result": bb})
# 单标的进攻端：后端路由里的分支
core_w = optimize(core, "min_volatility").weights
w1 = {s: round(w * 0.7, 4) for s, w in core_w.items()}
w1["EEE"] = round(w1.get("EEE", 0) + 0.3, 4)
out["barbell"].append({"core": ["AAA", "CCC", "DDD"], "sat": ["EEE"], "safe": 0.7,
                       "result": {"weights": w1, "safe_pct": 0.7}})

for mode in ["momentum", "multibagger"]:
    pm = {s: series(s, 400) for s in SPEC}
    out["screen"].append({"mode": mode, "symbols": list(SPEC), "days": 400,
                          "result": [c.to_dict() for c in screen(pm, 10, mode)]})

os.makedirs(OUT, exist_ok=True)
with open(os.path.join(OUT, "prices.synthetic.json"), "w") as fh:
    json.dump(prices_file, fh, separators=(",", ":"))
with open(os.path.join(OUT, "expected.json"), "w") as fh:
    json.dump(out, fh, ensure_ascii=False, indent=1)
print("fixture written:", {k: len(v) for k, v in out.items()})
