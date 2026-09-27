// 层次风险平价（HRP），逐步复刻 PyPortfolioOpt 1.6 HRPOpt.optimize(linkage_method="single")：
//   相关性距离 √clip((1−ρ)/2) → scipy 单链接聚类 → to_tree().pre_order() 叶序 →
//   递归二分，按簇的逆方差组合方差分配 α。
// scipy 的链接矩阵里每次合并记 [较小簇 id, 较大簇 id]，这里照做，叶序才一致。

import { corrFromCov } from "./stats";

type Node = { id: number; left?: Node; right?: Node };

function singleLinkage(dist: number[][]): Node {
  const n = dist.length;
  // 活动簇：id → 成员
  const members = new Map<number, number[]>();
  const nodes = new Map<number, Node>();
  for (let i = 0; i < n; i++) {
    members.set(i, [i]);
    nodes.set(i, { id: i });
  }
  let next = n;
  while (members.size > 1) {
    let best = Infinity;
    let pair: [number, number] = [-1, -1];
    const ids = [...members.keys()].sort((a, b) => a - b);
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        let d = Infinity;
        for (const x of members.get(ids[a])!) for (const y of members.get(ids[b])!) d = Math.min(d, dist[x][y]);
        if (d < best) {
          best = d;
          pair = [ids[a], ids[b]];
        }
      }
    const [lo, hi] = pair; // lo < hi，同 scipy label()
    const node: Node = { id: next, left: nodes.get(lo), right: nodes.get(hi) };
    members.set(next, [...members.get(lo)!, ...members.get(hi)!]);
    nodes.set(next, node);
    members.delete(lo);
    members.delete(hi);
    nodes.delete(lo);
    nodes.delete(hi);
    next++;
  }
  return [...nodes.values()][0];
}

function preOrder(node: Node, out: number[] = []): number[] {
  if (!node.left && !node.right) out.push(node.id);
  else {
    preOrder(node.left!, out);
    preOrder(node.right!, out);
  }
  return out;
}

function clusterVar(cov: number[][], items: number[]): number {
  const inv = items.map((i) => 1 / cov[i][i]);
  const s = inv.reduce((a, b) => a + b, 0);
  const w = inv.map((x) => x / s);
  let v = 0;
  for (let a = 0; a < items.length; a++)
    for (let b = 0; b < items.length; b++) v += w[a] * cov[items[a]][items[b]] * w[b];
  return v;
}

/** 返回各资产（按输入顺序索引）的 HRP 原始权重。cov 为样本协方差（ddof=1）。 */
export function hrpWeights(cov: number[][]): number[] {
  const n = cov.length;
  const corr = corrFromCov(cov);
  const dist = corr.map((row) => row.map((r) => Math.sqrt(Math.min(1, Math.max(0, (1 - r) / 2)))));
  for (let i = 0; i < n; i++) dist[i][i] = 0;
  const order = preOrder(singleLinkage(dist));

  const w = new Array(n).fill(1);
  let clusters: number[][] = [order];
  while (clusters.length > 0) {
    const nextClusters: number[][] = [];
    for (const c of clusters) {
      if (c.length > 1) {
        const h = Math.floor(c.length / 2);
        nextClusters.push(c.slice(0, h), c.slice(h));
      }
    }
    clusters = nextClusters;
    for (let i = 0; i < clusters.length; i += 2) {
      const first = clusters[i];
      const second = clusters[i + 1];
      const v1 = clusterVar(cov, first);
      const v2 = clusterVar(cov, second);
      const alpha = 1 - v1 / (v1 + v2);
      for (const k of first) w[k] *= alpha;
      for (const k of second) w[k] *= 1 - alpha;
    }
  }
  return w;
}
