# 部署说明

本项目是**前端静态站 + Python 后端**的组合。两者部署方式不同——请先读「架构现实」。

## 架构现实（重要）

- **前端**（React/Vite 静态产物）→ 可上 **Cloudflare Pages**。✅
- **后端**（FastAPI + numpy / cvxpy / PyPortfolioOpt 科学计算栈）→ **Cloudflare Workers 跑不了**
  （Workers 不支持这类重型 Python 原生依赖）。❌ 需另行托管。

所以「上线 Cloudflare」= 前端上 Pages；后端要单独放到能跑 Python 的地方。

## 前端：Cloudflare Pages（已配置自动部署）

`.github/workflows/deploy-frontend.yml` 会在推送时自动构建并部署前端到 Pages。

**需要在 GitHub 仓库配置：**
- Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`
- （可选）Variables：`VITE_API_BASE_URL` = 后端地址（如 `https://gushen-api.fly.dev`）
- Cloudflare 侧需存在名为 `gushen` 的 Pages 项目（首次可在 Cloudflare 控制台创建，或用
  `wrangler pages project create gushen`）。

配好后，推送即自动上线；也可在 Actions 页手动触发（workflow_dispatch）。

> 若不设 `VITE_API_BASE_URL`，前端会请求同源 `/api`，静态站无后端时这些请求会失败——
> 页面能打开，但优化/分析等功能需要后端。

## 后端：选一个能跑 Python 的托管

推荐任一：

- **本地/自用**（最简单）：`docker compose up --build`，前端 `VITE_API_BASE_URL` 指向 `http://localhost:8000`。
- **Fly.io / Render / Railway**：用 `backend/Dockerfile` 部署，拿到公网地址后填进 `VITE_API_BASE_URL`。
  记得配置环境变量：`SECRET_KEY`、`DATABASE_URL`、`FINNHUB_API_KEY`、`ANTHROPIC_API_KEY`。

部署后端后，把其地址设为前端的 `VITE_API_BASE_URL` 并重新触发前端部署，即可端到端联通。

## 快速自查

```bash
# 前端本地构建（CI 也这么做）
cd frontend && npm ci && npm run build   # 产物在 frontend/dist

# 后端本地起 + 测试
cd backend && pip install -r requirements.txt && pytest && uvicorn app.main:app
```
