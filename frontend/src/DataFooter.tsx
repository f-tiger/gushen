import { useEffect, useState } from "react";
import { dataInfo, type DataInfo } from "./api";

// 页面底部：数据截止日、来源、可选代码。纯前端版没有实时行情，所有结果都基于这份数据。
export default function DataFooter() {
  const [info, setInfo] = useState<DataInfo | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    dataInfo().then(setInfo).catch((e) => setErr(String(e instanceof Error ? e.message : e)));
  }, []);
  if (err) return <p style={{ color: "crimson", fontSize: 13 }}>行情数据加载失败：{err}</p>;
  if (!info) return <p style={{ color: "#888", fontSize: 13 }}>正在加载行情数据…</p>;
  return (
    <div style={{ borderTop: "1px solid #eee", marginTop: 28, paddingTop: 12, fontSize: 13, color: "#666" }}>
      <p style={{ margin: "0 0 6px" }}>
        行情数据截至 <b>{info.asOf}</b>（{info.source}）。全部计算在你的浏览器里完成，不上传任何输入。
      </p>
      {info.stale.length > 0 && (
        <p style={{ margin: "0 0 6px", color: "#9a6700" }}>
          这些标的本次更新没抓到，沿用上一版数据：{info.stale.join(", ")}
        </p>
      )}
      <p style={{ margin: 0 }}>可选代码（{info.symbols.length}）：{info.symbols.join(", ")}</p>
    </div>
  );
}
