// 后端接口封装。
// 开发时通过 vite 代理 /api → http://localhost:8000。
// 生产（如 Cloudflare Pages）需把后端部署到可访问地址，并在构建时设置
// VITE_API_BASE_URL（例：https://api.example.com），否则 /api 请求无后端可达。
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
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
