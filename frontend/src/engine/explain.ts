// 组合解读 + 合规守卫 —— 移植自 backend/app/services/ai/explain.py 的确定性回退与 compliance/guard.py。
// 纯前端版不调用任何大模型（没有后端就不能保管 API key，也不应把 key 放进浏览器），
// 所以解读永远是模板文本，界面上如实标注「模板生成」。公开网页固定用 education_only 口径。

import type { OptimizeResult } from "./optimizer";
import type { Profile } from "./planning";

const LEVEL_CN: Record<string, string> = {
  conservative: "保守",
  moderate_conservative: "稳健偏保守",
  moderate: "稳健",
  moderate_aggressive: "稳健偏进取",
  aggressive: "进取",
};

export const DISCLAIMER = "以上仅供教育参考，不构成投资建议。";
const PERSONALIZED_MARKERS = ["你应该买", "建议你买入", "立即买入", "马上卖出", "全仓"];

export function sanitize(text: string): string {
  let out = text;
  for (const m of PERSONALIZED_MARKERS) out = out.split(m).join("可考虑（仅作示例说明）");
  return out.includes(DISCLAIMER) ? out : out.trimEnd() + "\n" + DISCLAIMER;
}

export function explainPortfolio(profile: Profile, portfolio: OptimizeResult): { source: string; explanation: string } {
  const level = LEVEL_CN[profile.level] ?? profile.level;
  const top = Object.entries(portfolio.weights).sort((a, b) => b[1] - a[1]);
  const alloc = top.map(([s, w]) => `${s} ${(w * 100).toFixed(0)}%`).join("、");
  const text =
    `根据你的风险画像（评分 ${profile.score}，档位「${level}」），系统用 ${portfolio.method} 方法构建了如下组合：${alloc}。\n` +
    `该方法在同类资产间做了分散配置以平衡风险。历史数据估算：年化收益约 ${(portfolio.expected_annual_return * 100).toFixed(1)}%、波动约 ` +
    `${(portfolio.annual_volatility * 100).toFixed(1)}%、夏普 ${portfolio.sharpe_ratio.toFixed(2)}——这是对历史的回顾，并非未来预测。\n` +
    DISCLAIMER;
  return { source: "template", explanation: sanitize(text) };
}
