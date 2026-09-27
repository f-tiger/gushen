import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 纯前端版：没有后端，也就没有 /api 代理。行情数据是 public/data/prices.json（部署时生成）。
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
