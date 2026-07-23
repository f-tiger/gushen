// 后端接口封装。开发时通过 vite 代理 /api → http://localhost:8000

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
  const res = await fetch("/api/portfolio/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers, symbols }),
  });
  if (!res.ok) throw new Error((await res.json()).detail ?? res.statusText);
  return res.json();
}
