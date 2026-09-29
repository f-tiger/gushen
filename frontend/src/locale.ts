import english from "./locales/en.json";
export type Language = "en" | "zh";
const dictionary: Record<string, string> = english;
let language: Language =
  typeof window === "undefined"
    ? "zh"
    : window.location.pathname.startsWith("/zh")
      ? "zh"
      : "en";
const listeners = new Set<() => void>();
export const getLanguage = () => language;
export const subscribeLanguage = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const reverse = new Map(Object.entries(dictionary).map(([zh, en]) => [en, zh]));
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patterns = Object.entries(dictionary)
  .filter(([s]) => /\{\d+\}/.test(s))
  .flatMap(([zh, en]) =>
    [zh, en].map((source) => {
      const indices: number[] = [];
      const pattern = source
        .split(/(\{\d+\})/)
        .map((p) =>
          /^\{\d+\}$/.test(p)
            ? (indices.push(Number(p.slice(1, -1))), "([\\s\\S]*?)")
            : escape(p),
        )
        .join("");
      return { regex: new RegExp("^" + pattern + "$"), zh, en, indices };
    }),
  );
export function t(key: string, params: unknown[] = []): string {
  const zh = dictionary[key] !== undefined ? key : reverse.get(key);
  if (zh !== undefined) {
    const output = language === "en" ? dictionary[zh] : zh;
    return output.replace(/\{(\d+)\}/g, (all, i) =>
      params[i] === undefined ? all : String(params[i]),
    );
  }
  if (!params.length)
    for (const p of patterns) {
      const match = key.match(p.regex);
      if (match) {
        const values: Record<number, string> = {};
        p.indices.forEach((v, i) => (values[v] = match[i + 1]));
        return (language === "en" ? p.en : p.zh).replace(
          /\{(\d+)\}/g,
          (_, i) => values[i] ?? "",
        );
      }
    }
  // Some legacy errors concatenate known phrases with ticker symbols. Translate
  // these at the display boundary, never user-authored names or journal content.
  let value = key;
  const pairs = Object.entries(dictionary)
    .filter(([a, b]) => !a.includes("{") && a.length >= 5 && b.length >= 5)
    .sort((a, b) =>
      language === "en" ? b[0].length - a[0].length : b[1].length - a[1].length,
    );
  for (const [a, b] of pairs) {
    const from = language === "en" ? a : b,
      to = language === "en" ? b : a;
    if (value.includes(from)) value = value.split(from).join(to);
  }
  return value;
}
const codes: Record<string, [string, string]> = {
  hrp: ["层次风险平价", "Hierarchical risk parity"],
  inverse_vol: ["逆波动率", "Inverse volatility"],
  min_volatility: ["最小波动", "Minimum volatility"],
  max_sharpe: ["最大夏普", "Maximum Sharpe"],
  equal_weight: ["等权", "Equal weight"],
  momentum: ["动量", "Momentum"],
  conservative: ["保守", "Conservative"],
  moderate_conservative: ["稳健偏保守", "Moderately conservative"],
  moderate: ["稳健", "Moderate"],
  moderate_aggressive: ["稳健偏进取", "Moderately aggressive"],
  aggressive: ["进取", "Aggressive"],
  uptrend: ["上升趋势", "Uptrend"],
  downtrend: ["下降趋势", "Downtrend"],
  sideways: ["横盘", "Sideways"],
  insufficient_data: ["数据不足", "Insufficient data"],
};
export function tr<T>(value: T): T {
  return (
    typeof value === "string"
      ? (codes[value]?.[language === "zh" ? 0 : 1] ?? t(value))
      : value
  ) as T;
}
export function localizedLink(url: string): string {
  if (language === "zh") return url;
  return url
    .replace("https://agiscorecard.com/zh/", "https://agiscorecard.com/")
    .replace("https://agiscorecard.com/cn", "https://agiscorecard.com/")
    .replace(
      "https://compass.agiscorecard.com/zh/",
      "https://compass.agiscorecard.com/en/",
    )
    .replace(
      /^https:\/\/invest\.agiscorecard\.com\/$/,
      "https://invest.agiscorecard.com/en/",
    );
}
export function researchName(name: string) {
  const presets = ["跨资产示例", "AI 产业示例", "宽基与卫星示例"];
  return presets.some((p) => name === p || name === dictionary[p])
    ? t(name)
    : name;
}
export function updateLanguageMetadata() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  document.documentElement.dataset.language = language;
  document.title = t("股神 Gushen · 投资研究工作台");
  const url = `https://gushen.agiscorecard.com/${language}/`;
  const description =
    language === "en"
      ? "Build a US stock and ETF portfolio, compare target weights, equal weight and HRP over matched windows, inspect risk, test scenarios and maintain an evidence journal. Browser-based educational research."
      : "编辑美股与 ETF 组合，同窗口比较目标权重、等权与 HRP，检查风险、推演情景、保存证据日志和报告。浏览器内计算，仅供教育研究。";
  document.querySelector("link[rel=canonical]")?.setAttribute("href", url);
  for (const [selector, value] of [
    ['meta[property="og:url"]', url],
    ['meta[property="og:title"]', document.title],
    ['meta[property="og:description"]', description],
    ['meta[name="description"]', description],
    ['meta[name="theme-color"]', language === "en" ? "#0a0a0b" : "#ffffff"],
  ])
    document.querySelector(selector)?.setAttribute("content", value);
  const schema = document.querySelector('script[type="application/ld+json"]');
  if (schema) {
    try {
      const data = JSON.parse(schema.textContent || "{}");
      data.name = document.title;
      data.url = url;
      data.inLanguage = document.documentElement.lang;
      data.description = description;
      schema.textContent = JSON.stringify(data);
    } catch {
      /* Static metadata remains available if an unrelated schema is malformed. */
    }
  }
}
export function setLanguage(next: Language, push = true) {
  language = next;
  if (typeof window !== "undefined" && push) {
    history.pushState(null, "", `/${next}/${location.search}${location.hash}`);
  }
  updateLanguageMetadata();
  listeners.forEach((fn) => fn());
}
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () =>
    setLanguage(location.pathname.startsWith("/zh") ? "zh" : "en", false),
  );
  updateLanguageMetadata();
}
export const themeColor = (id: string) =>
  id === "hrp"
    ? "var(--accent2)"
    : id === "equal"
      ? "var(--warn)"
      : "var(--accent)";
