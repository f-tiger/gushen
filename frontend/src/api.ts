// 后端接口封装。
// 开发时通过 vite 代理 /api → http://localhost:8000。
// 生产（如 Cloudflare Pages）需把后端部署到可访问地址，并在构建时设置
// VITE_API_BASE_URL（例：https://api.example.com），否则 /api 请求无后端可达。
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  return res.json();
}

// ---- 进攻工具 ----

export interface ScreenCandidate {
  symbol: string;
  score: number;
  momentum: { "3m": number | null; "6m": number | null; "12m": number | null };
  near_52w_high: number;
  breakout: boolean;
  trend: string;
  risk: { annualized_vol: number; max_drawdown: number };
}

export function screenStocks(
  symbols: string[],
  mode: "momentum" | "multibagger"
): Promise<{ mode: string; candidates: ScreenCandidate[]; note: string }> {
  return postJson("/api/analysis/screen", { symbols, mode, top_k: 10 });
}

export interface KellyResponse {
  full_kelly: number;
  fractional_kelly: number;
  capped_fraction: number;
  recommended_amount: number;
  note: string;
}

export function kellySize(
  bankroll: number,
  win_prob: number,
  win_multiple: number
): Promise<KellyResponse> {
  return postJson("/api/planning/kelly", { bankroll, win_prob, win_multiple });
}

export interface BarbellResponse {
  weights: Record<string, number>;
  safe_pct: number;
  note?: string;
}

export function buildBarbell(
  core_symbols: string[],
  satellite_symbols: string[],
  safe_pct: number
): Promise<BarbellResponse> {
  return postJson("/api/portfolios/barbell", { core_symbols, satellite_symbols, safe_pct });
}

export interface RecommendResponse {
  profile: {
    score: number;
    level: string;
    recommended_method: string;
    max_weight: number;
    target_horizon_years: number;
  };
  portfolio: {
    method: string;
    weights: Record<string, number>;
    expected_annual_return: number;
    annual_volatility: number;
    sharpe_ratio: number;
  };
}

export async function recommend(
  answers: Record<string, number>,
  symbols: string[]
): Promise<RecommendResponse> {
  const res = await fetch(apiUrl("/api/portfolio/recommend"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, symbols }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  return res.json();
}

export interface GoalResponse {
  initial: number;
  target: number;
  years: number;
  required_cagr: number;
  prob_success: number;
  verdict: string;
  projection: { median: number; p5: number; p95: number };
  message: string;
  assumptions: { expected_return: number; expected_vol: number };
}

export async function analyzeGoal(
  initial: number,
  target: number,
  years: number,
  symbols: string[]
): Promise<GoalResponse> {
  const res = await fetch(apiUrl("/api/planning/goal"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initial, target, years, symbols, method: "hrp" }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  return res.json();
}

export async function explainPortfolio(
  profile: RecommendResponse["profile"],
  portfolio: RecommendResponse["portfolio"]
): Promise<{ source: string; explanation: string }> {
  const res = await fetch(apiUrl("/api/ai/explain-portfolio"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile, portfolio }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  return res.json();
}
