# 股神 Gushen · AI 智能投顾（美股）

依据用户目标与风险画像，用**确定性优化算法**自动构建/再平衡美股投资组合，用**模拟盘**验证策略，用 **LLM** 做风险画像访谈与组合解读。最终用于指导真实投资。

> ⚠️ 本项目为信息/教育用途，输出不构成投资建议。数据源与合规存在硬约束，详见 `docs/`。

## 文档

| 文档 | 内容 |
|------|------|
| [`docs/architecture.md`](docs/architecture.md) | 架构设计（模块、分层、路线图） |
| [`docs/research.md`](docs/research.md) | 调研：数据/技术/合规硬约束 |
| [`docs/research-robo-advisor.md`](docs/research-robo-advisor.md) | 调研：算法选型/产品/差异化 |

## 技术栈

- **后端**：Python 3.11 · FastAPI · SQLAlchemy · PyPortfolioOpt
- **前端**：React + TypeScript + Vite
- **存储**：PostgreSQL（+ TimescaleDB / pgvector）· Redis
- **AI**：Claude API
- **行情**：yfinance（历史）/ Finnhub（实时，免费档）— ⚠️ 仅原型可用，商用须付费授权

## 核心设计：数值算法 vs LLM 分层

| 确定性数值算法 | LLM（Claude） |
|----------------|---------------|
| 组合优化、权重、再平衡、回测 | 风险画像访谈、组合解读、投研问答、教育 |

**LLM 绝不做数值计算/报价**——所有数字经工具调用取回。组合决策留可审计痕迹。

## 快速开始

### 方式一：Docker Compose（推荐）

```bash
docker compose up --build
# 后端 API:  http://localhost:8000/docs
```

### 方式二：本地开发

**后端**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # 按需填 FINNHUB_API_KEY / ANTHROPIC_API_KEY
uvicorn app.main:app --reload  # http://localhost:8000/docs
```

**前端**
```bash
cd frontend
npm install
npm run dev                    # http://localhost:5173
```

### 运行测试

```bash
cd backend && source .venv/bin/activate && pytest
```

## 已实现（P0–P3 骨架）

- ✅ FastAPI 骨架 + 配置 + ORM 模型（用户/画像/组合/持仓/订单）
- ✅ 行情抽象层 + yfinance / Finnhub 适配器
- ✅ **组合优化引擎**：HRP / 逆波动率 / 最小方差 / 最大夏普 / 等权（Ledoit-Wolf 收缩）
- ✅ 风险画像确定性映射（问卷 → 档位 → 推荐方法）
- ✅ API：`/market/*`、`/portfolio/optimize`、`/portfolio/recommend`、`/portfolio/risk-profile`
- ✅ 前端最小页面：问卷 → 画像 → 推荐组合
- ✅ 优化引擎单元测试（含合成数据验证）

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/market/quote/{symbol}` | 最新报价 |
| GET | `/api/market/bars/{symbol}?days=180` | 历史 K 线 |
| GET | `/api/portfolio/methods` | 可用优化方法 |
| POST | `/api/portfolio/risk-profile` | 问卷 → 风险画像 |
| POST | `/api/portfolio/optimize` | 指定方法优化组合 |
| POST | `/api/portfolio/recommend` | 问卷 → 画像 → 推荐组合（一步） |

## 路线图（详见 architecture.md §9）

P0 地基 → P1 行情 → **P2 组合引擎** → **P3 模拟验证** → P4 风险画像 → P5 AI 表达 → P6 再平衡 → P7 真实指导（须先定合规姿态）

当前进度：**P0–P2 骨架 + P4 画像映射已落地**；待补：模拟/回测框架、AI 表达层、再平衡、数据库迁移。
