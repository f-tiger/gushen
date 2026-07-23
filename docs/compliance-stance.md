# 合规姿态（默认决策）

> 状态：**已采用默认姿态 = `education_only`（仅教育/非个性化）**
> 依据：`docs/research.md` §5（Lowe v. SEC 出版商豁免、SEC 2025 对 AI 的审查）
> 说明：用户将合规列为非重点，但「指导真实投资」需要一个明确、安全的默认姿态。本文件记录该默认，并留出升级路径。代码层由 `settings.compliance_mode` + `app/services/compliance/guard.py` 强制执行。

## 为什么需要这条

美国《投资顾问法》下，**针对特定用户/组合的个性化投资建议**通常需注册为投资顾问（RIA）。
「出版商豁免」（Lowe v. SEC）只保护**非个性化、真实、公开发行**的投资评论。
智能投顾天然偏个性化，是合规敞口最大的形态——因此必须先明确姿态，避免无意中越线。

## 三种姿态

| 模式 | 含义 | 代价 | 适用 |
|------|------|------|------|
| **`education_only`（默认）** | AI/组合内容保持**非个性化、教育口吻**；组合作为「示例/演示」，附免责声明；不下个性化买卖指令 | 低；留在豁免区内 | 起步、验证期 |
| `advisory` | 提供真正的个性化投资建议 | 需注册 RIA、承担合规与披露义务 | 商业化、持牌后 |
| （混合） | 教育内容公开 + 个性化功能仅对持牌范围内用户开放 | 中；需分层与法务设计 | 过渡 |

## 代码如何执行

- `settings.compliance_mode`（默认 `education_only`，可用环境变量 `COMPLIANCE_MODE` 覆盖）。
- `app/services/compliance/guard.py`：
  - `ensure_disclaimer()` —— 所有对外投资文本强制附「仅供教育参考，不构成投资建议」。
  - `sanitize()` —— `education_only` 下软化「你应该买/立即买入/全仓」等个性化指令性措辞。
- AI 表达层（`explain` / `qa`）的所有输出均经 `sanitize()` 过滤（防御性，不依赖 LLM 自觉）。
- 组合/再平衡 API 的建议性响应均带 `disclaimer` 字段。

## 升级到 `advisory` 前的清单（TODO）

1. 咨询证券律师，确认注册义务（RIA / 州注册 / 豁免）。
2. 落地 Form ADV、合规手册、监督流程。
3. 记录并披露 **AI 使用方式与监督机制**（SEC 2025 检查重点）。
4. 组合决策的**可审计留痕**（已具备：`orders`/`positions` + 优化 `method` 记录）。
5. 数据源商用授权到位（见 `research.md` §1）。

> ⚠️ 未完成上述清单前，不要把 `compliance_mode` 切到 `advisory`。
