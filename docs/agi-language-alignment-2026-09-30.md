# AGI visual and language alignment

Task brief: align Gushen with the existing AGI investment hub by language, complete English and Simplified Chinese content, preserve research during switching, and verify both published routes.

The source design uses two established variants: `/invest` has a dark surface, purple accent and green secondary color; `/zh/invest` has white surfaces, blue accents and green secondary color. Gushen now adopts these tokens, the AGI dot-and-wordmark, system font stack, borders and language-aware cross-site links while retaining its analysis workspace layout.

`/en/` and `/zh/` each ship a localized title, description, canonical, static summary and reciprocal hreflang. The root is the default English entry. Switching language updates the URL and display without remounting research state; browser back/forward works. User-authored journal entries and custom research names remain unchanged. Generated example names, labels, validation errors, legacy calculators, chart legends, printed reports and report metadata are localized. Currency units remain explicit; switching language never performs a currency conversion.

Verification: 51 engine/localization tests and production build; Chromium checks all seven views plus legacy goal/screener/portfolio/Kelly results, invalid weights, English text coverage, both themes, 390px layouts, language switching with notes/results, back/forward, local save/reload, JSON export and English printing. Browser QA uses synthetic prices only; production rebuilds actual prices and runs the existing six snapshot scenarios. Deployment verification now checks both localized routes and canonicals.
