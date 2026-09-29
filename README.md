# 股神 Gushen · 投资研究工作台

线上应用：[简体中文](https://gushen.agiscorecard.com/zh/) · [English](https://gushen.agiscorecard.com/en/) · [AGI 投资研究](https://agiscorecard.com/zh/invest)

面向中文美股 / ETF 自主研究者，把「建立组合 → 同窗比较 → 风险解释 → 情景推演 → 保存复盘」连成可复查的工作流。研究用户自己的假设，不提供交易执行或收益承诺。

中英文各自沿用 AGI 主站的主题和导航；切换语言保留当前研究，个人日志不会自动翻译。语言与验收记录见 [AGI 对齐说明](docs/agi-language-alignment-2026-09-30.md)。

## 当前线上产品

- **组合总览**：2–10 个标的，自定义目标权重、美元本金、历史窗口、单边成本和月 / 季度换仓。3 组学习示例并非投资推荐。
- **策略比较**：固定目标权重、同池等权、HRP；同一执行窗口，净值 / 回撤图、月收益、期末漂移权重与换仓账本。
- **风险透视**：集中度、有效持仓数、相关矩阵、目标权重的方差贡献与水下期。
- **情景推演**：自定义价格冲击、每月末投入的确定性复利测算。所有增长率均为用户假设。
- **研究日志**：保存论点、反证、来源链接与复查日期。本机保存、JSON 导入导出、完整报告和打印 / PDF；无账户或自动提醒。
- **工具箱**：保留原风险问卷与专项计算；模板解读不调用 LLM。

React + TypeScript + Vite，浏览器内完成计算，不上传研究输入。静态价格快照由 GitHub Actions 重建并随 Cloudflare Pages 发布。生产分支为 `claude/skills-prompt-workflow-lb8d7j`；`backend/` 是历史参考实现，不运行在线上。

价格使用 Yahoo 复权收盘数据。纽约时间 17:00 前过滤当日未完成日线，包括旧数据回退路径。支持范围见 `scripts/universe.json`，数据截止日、生成时间和沿用旧列标记均在页面显示。数据使用权需按实际用途单独评估。

```bash
npm ci --prefix frontend
npm test --prefix frontend
node --test scripts/attach-agi-domain.test.mjs scripts/completed-session.test.mjs
# 本地开发先生成 frontend/public/data/prices.json，或下载线上公开快照。
npm run dev --prefix frontend
npm run build --prefix frontend
```

研究配置与最多 50 条日志只保存在本机浏览器，建议导出备份。情景推演的临时输入不会写入报告；要保留假设请记入日志。当前标的池仍有选择与幸存者偏差，历史模拟不是实盘业绩。教育研究用途，不构成投资建议。

产品深化与三轮 Prompt：[设计、依据和范围](docs/product-workbench-2026-09-29.md)。

## 历史架构与参考实现

下文保留原后端原型的设计与启动资料；并非当前线上部署拓扑。

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

## 已实现（P0–P6 骨架）

- ✅ FastAPI 骨架 + 配置 + ORM 模型（用户/画像/组合/持仓/订单）
- ✅ **鉴权**：bcrypt 密码哈希 + JWT，注册/登录/当前用户
- ✅ 行情抽象层 + yfinance / Finnhub 适配器
- ✅ **组合优化引擎**：HRP / 逆波动率 / 最小方差 / 最大夏普 / 等权（Ledoit-Wolf 收缩）
- ✅ 风险画像确定性映射（问卷 → 档位 → 推荐方法）
- ✅ **回测/模拟框架（算法验证器）**：walk-forward 周期再平衡、NAV 曲线、指标、多方法横评
- ✅ **组合持久化 + 模拟执行**：目标权重 → 整数股持仓/订单，用户隔离
- ✅ **P6 再平衡引擎**：阈值触发的偏离检测 → 调仓计划（可执行落库）
- ✅ **AI 表达层**：Claude 组合解读 + 工具接地问答（数字经行情源取回；无 key 时确定性回退）
- ✅ **合规守卫**：默认 `education_only`，强制免责声明 + 软化个性化措辞（见 docs/compliance-stance.md）
- ✅ **RAG 脚手架**：关键词回退检索（pgvector 就绪接口）
- ✅ Alembic 迁移脚手架 + dev 建表脚本
- ✅ 前端最小页面：问卷 → 画像 → 推荐组合 + AI 解读
- ✅ 单元 + API 测试 **43 项**（优化/回测/执行/再平衡/鉴权/合规，含合成数据 + TestClient）

## 主要 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` · `/login` | 注册 / 登录（返回 JWT） |
| GET | `/api/auth/me` | 当前用户（需 Bearer） |
| GET | `/api/market/quote/{symbol}` · `/bars/{symbol}` | 报价 / 历史 K 线 |
| GET | `/api/portfolio/methods` | 可用优化方法 |
| POST | `/api/portfolio/risk-profile` | 问卷 → 风险画像 |
| POST | `/api/portfolio/optimize` · `/recommend` | 优化 / 问卷→画像→推荐组合 |
| POST | `/api/portfolios` · GET `/portfolios` | 创建 / 列出组合（需登录，持久化） |
| POST | `/api/portfolios/{id}/execute` | 模拟执行（目标权重→持仓/订单） |
| POST | `/api/portfolios/{id}/rebalance` | 再平衡评估 / 执行（阈值触发） |
| POST | `/api/backtest/compare` · `/run` | 多方法横评 / 单方法回测 |
| GET | `/api/ai/status` | AI 是否可用 |
| POST | `/api/ai/explain-portfolio` | 组合解读（数字入参，LLM 只表达） |
| POST | `/api/ai/ask` | 工具接地问答（报价经行情源取回） |

## 数据库迁移

```bash
cd backend
# 快速起步（dev）：直接建表
python -m app.db.init_db
# 或用 Alembic（DB 可连接后）
alembic revision --autogenerate -m "init"
alembic upgrade head
```

## 路线图（详见 architecture.md §9）

P0 地基 → P1 行情 → **P2 组合引擎** → **P3 模拟验证** → P4 风险画像 → P5 AI 表达 → P6 再平衡 → P7 真实指导（须先定合规姿态）

当前进度：**P0–P6 骨架已落地**（鉴权、组合引擎、回测验证、画像映射、AI 表达、组合持久化、再平衡、合规守卫、RAG 关键词回退）。

待补（生产化）：真实 pgvector 向量检索（替换关键词回退）、定时再平衡任务、行情商用授权接入、前端扩展（组合/回测/问答页）、`advisory` 合规姿态（须先完成 docs/compliance-stance.md 的清单）。
