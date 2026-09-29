import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
const root = new URL("../dist/", import.meta.url),
  base = readFileSync(new URL("index.html", root), "utf8");
const descriptions = {
  en: "Build a US stock and ETF portfolio, compare target weights, equal weight and HRP over matched windows, inspect risk, test scenarios and maintain an evidence journal. Browser-based educational research.",
  zh: "编辑美股与 ETF 组合，同窗口比较目标权重、等权与 HRP，检查风险、推演情景、保存证据日志和报告。浏览器内计算，仅供教育研究。",
};
const alternates =
  '<link rel="alternate" hreflang="en" href="https://gushen.agiscorecard.com/en/" />\n<link rel="alternate" hreflang="zh-Hans" href="https://gushen.agiscorecard.com/zh/" />\n<link rel="alternate" hreflang="x-default" href="https://gushen.agiscorecard.com/en/" />';
for (const lang of ["en", "zh"]) {
  const title =
      lang === "en"
        ? "Gushen · Portfolio Research Workbench"
        : "股神 Gushen · 投资研究工作台",
    url = `https://gushen.agiscorecard.com/${lang}/`;
  let html = base
    .replace(
      /<html lang="[^"]+"/,
      '<html lang="' + (lang === "en" ? "en" : "zh-CN") + '"',
    )
    .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /(<meta (?:name="description"|property="og:description") content=")[^"]*/g,
      (_, p) => p + descriptions[lang],
    )
    .replace(/(<meta property="og:title" content=")[^"]*/, (_, p) => p + title)
    .replace(/(<meta property="og:url" content=")[^"]*/, (_, p) => p + url)
    .replace(/(<link rel="canonical" href=")[^"]*/, (_, p) => p + url);
  html = html.replace(
    "</head>",
    `${alternates}\n<meta name="theme-color" content="${lang === "en" ? "#0a0a0b" : "#ffffff"}" />\n<style>body{background:var(--bg,${lang === "en" ? "#0a0a0b" : "#ffffff"});color:var(--text,${lang === "en" ? "#e8e8ec" : "#0a0a0b"})}</style>\n</head>`,
  );
  html = html.replace(
    /(<script type="application\/ld\+json">)\s*([\s\S]*?)(<\/script>)/,
    (_, a, j, b) => {
      const d = JSON.parse(j);
      d.name = title;
      d.url = url;
      d.inLanguage = lang === "en" ? "en" : "zh-CN";
      d.description = descriptions[lang];
      if (lang === "en")
        d.featureList = [
          "Editable portfolios and three examples",
          "Matched target-weight, equal-weight and HRP simulations",
          "Portfolio value, drawdown, monthly returns and cost ledger",
          "Concentration, correlation and variance contributions",
          "Hypothetical stress and monthly contribution scenarios",
          "Local evidence journal, JSON transfer and printable reports",
          "Risk questionnaire and specialist calculators",
        ];
      return a + JSON.stringify(d) + b;
    },
  );
  if (lang === "en")
    html = html.replace(
      /<main style=[\s\S]*?<\/main>/,
      `<main style="max-width:760px;margin:40px auto;font-family:system-ui;padding:16px"><h1>Gushen · Portfolio Research Workbench</h1><p>Understand your portfolio. Then decide. Edit US stock and ETF allocations, compare three strategies over matched windows, inspect risk and keep an evidence journal.</p><ul><li>Target-weight, equal-weight and HRP simulations with 126 warm-up sessions, monthly or quarterly rebalancing and explicit costs.</li><li>User-defined price shocks and deterministic month-end contribution scenarios. Assumptions are not forecasts.</li><li>Local saving, JSON import/export and printable research reports. Yahoo adjusted daily prices; no live brokerage connection.</li></ul><p>Enable JavaScript to use the workbench. Educational research, not investment advice or guaranteed returns.</p><p><a href="https://agiscorecard.com/invest">AGI investment research</a> · <a href="/zh/" lang="zh-CN">中文</a></p></main>`,
    );
  else
    html = html.replace(
      "</main>",
      '<p><a href="/en/" lang="en">English</a></p></main>',
    );
  mkdirSync(new URL(lang + "/", root), { recursive: true });
  writeFileSync(new URL(lang + "/index.html", root), html);
  if (lang === "en") writeFileSync(new URL("index.html", root), html);
}
console.log(
  "Built /en/ and /zh/ with localized metadata, static summaries and reciprocal hreflang.",
);
