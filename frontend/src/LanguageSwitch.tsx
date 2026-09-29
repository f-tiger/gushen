import { useSyncExternalStore } from "react";
import { getLanguage, setLanguage, subscribeLanguage } from "./locale";
export const useLanguage = () =>
  useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
export default function LanguageSwitch() {
  const lang = useLanguage();
  return (
    <nav className="language-switch" aria-label="Language / 语言">
      <button
        lang="zh-CN"
        aria-pressed={lang === "zh"}
        onClick={() => setLanguage("zh")}
      >
        中文
      </button>
      <button
        lang="en"
        aria-pressed={lang === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </nav>
  );
}
