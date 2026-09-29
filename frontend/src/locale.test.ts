import { afterEach, describe, expect, it } from "vitest";
import { setLanguage, t, tr, localizedLink, researchName } from "./locale";
import english from "./locales/en.json";
afterEach(() => setLanguage("zh", false));
describe("locale contract", () => {
  it("translates labels and formatted errors in both directions without changing numbers", () => {
    setLanguage("en", false);
    expect(t("风险透视")).toBe("Risk analysis");
    expect(t("保存失败：{0}", ["disk full"])).toBe("Could not save: disk full");
    expect(t("行情数据文件读取失败（HTTP 503）")).toBe(
      "Price file could not be loaded (HTTP 503)",
    );
    setLanguage("zh", false);
    expect(t("Risk analysis")).toBe("风险透视");
    expect(t("Could not save: disk full")).toBe("保存失败：disk full");
  });
  it("preserves user names but localizes generated example names and code labels", () => {
    setLanguage("en", false);
    expect(researchName("跨资产示例")).toBe("Cross-asset example");
    expect(researchName("我的风险透视笔记")).toBe("我的风险透视笔记");
    expect(localizedLink("https://agiscorecard.com/zh/invest")).toBe(
      "https://agiscorecard.com/invest",
    );
    setLanguage("zh", false);
    expect(tr("uptrend")).toBe("上升趋势");
    expect(researchName("Cross-asset example")).toBe("跨资产示例");
  });
  it("has English for every catalog entry with matching interpolation fields", () => {
    for (const [zh, en] of Object.entries(english)) {
      expect(en.trim()).not.toBe("");
      expect(en).not.toMatch(/[\u3400-\u9fff]/);
      expect([...(zh.match(/\{\d+\}/g) || [])].sort()).toEqual(
        [...(en.match(/\{\d+\}/g) || [])].sort(),
      );
    }
  });
});
