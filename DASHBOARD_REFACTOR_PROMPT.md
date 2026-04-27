# Handoff: Calm dashboard + full Markets (copy everything below the line to Claude)

---

You are working in the **StockAppV1** repo. Implement a **simpler, calmer Dashboard** by **removing** advanced / overlapping UI. **Do not** copy dashboard blocks onto **Markets** when Markets **already** shows the same information—there is **no use** in adding duplicates; **delete from Dashboard** and rely on the existing Markets page.

## Goals

1. **Dashboard** should feel **minimal and calming**: generous whitespace, little motion, few simultaneous panels—still **useful** (personal + light context, not a blank page).
2. **Markets** is already the home for macro, breadth, sentiment, scanners, and global assets. **Only add** something to Markets if that **exact capability does not exist there yet** (e.g. a widget unique to the old dashboard). Otherwise: **remove from Dashboard only**.
3. **Never duplicate** the same story on two pages. If the dashboard needs a *tiny* summary, use **one** compact component or a **single** combined fetch—not a second full copy of breadth + sentiment cards.

## Current layout (for reference)

- **Dashboard** (`client/src/pages/Dashboard.jsx`): `TradingViewTickerTape`, "Global asset pulse" (`GlobalAssetMarquee`), market breadth + derived "Market regime" (`MarketBreadthGauge` + `useMemo` block), `MarketSentiment`, `WatchlistMiniWidget`, `SectorStrengthGrid` + `RelatedStrengthWidget` + `MiniPriceChart`, `VolatilityHeatmapWidget`, "Top 20 (Most Active)" table (`/api/market-summary`).
- **Markets** (`client/src/pages/Markets.jsx`): Already has global macro "command center" (`/api/global-assets` via mini terminals), tabs (e.g. Overview / Scanners), `LightweightSpyChart`, scanners, `MarketInternalsPanel` + breadth, sentiment strip—**overlaps conceptually** with much of the dashboard.
- **Sectors** (`client/src/pages/Sectors.jsx`): Separate RS / quadrant view (`/api/sectors`); not the same as dashboard SPDR grid. Add sector dashboard pieces **only** to a page that does not already cover them; **do not** duplicate.

## What to do

### A. Strip and simplify `Dashboard.jsx`

- **Remove** from the dashboard:  
  `TradingViewTickerTape`, "Global asset pulse" / `GlobalAssetMarquee`, full `MarketBreadthGauge` + **market regime** panel, full `MarketSentiment`, `SectorStrengthGrid` and `RelatedStrengthWidget` / `MiniPriceChart` block, `VolatilityHeatmapWidget`, and the large **Top 20** table **unless** you keep a **very small** variant (e.g. Top 5 with "See more on Markets" link).  
  These overlap Markets (or are redundant with it) except where noted in B—**do not re-add the same UIs to Markets.**
- **Keep** `WatchlistMiniWidget` as a primary dashboard element.
- **Add** a calm **session / context** line (e.g. US RTH open vs closed in plain language, ET)—small typography, not another card.
- **Add** one **compact "market at a glance"** strip: e.g. major index (or 2) + day % from existing APIs **without** reintroducing the old marquee. Prefer reusing or lightly wrapping data from `market-summary` or a **minimal** dedicated snippet—do not paste three full dashboard cards back in.
- **Add** a clear **CTA** to deeper views: e.g. link/buttons to **Markets** (full context), **Alerts**, and/or **Watchlist** as appropriate. Copy should be short and non-hypey.
- Reduce visual noise: fewer `dash-module-enter` staggered blocks if the page is short; avoid empty hero titles.

### B. What to do on Markets (add **only** if missing)

- **Default:** after stripping the dashboard, **change nothing** on Markets for: global/macro, breadth, sentiment, scanners, charts—**Markets already has these.** Removing `GlobalAssetMarquee` in favor of the existing "Global macro command center" is **not** "moving" a widget; it is **dropping a duplicate** from the dashboard.
- **Add to Markets only** features that are **not** already represented there, for example:  
  - `SectorStrengthGrid` (SPDR) + related / `MiniPriceChart` **if** you confirm Markets has **no** equivalent section.  
  - `VolatilityHeatmapWidget` **if** Markets has no vol-heatmap.  
  - **TradingView ticker** **if** you want it somewhere and it is not already on Markets; otherwise **delete** it from the dashboard and **do not** add it.  
- If a capability **already exists** on Markets, **do not** port the dashboard’s version—**one page, one presentation.**

### C. Navigation & copy

- Update `Layout` nav labels or subtitles only if it improves **discoverability** (e.g. Markets described as the full market view). No unrelated redesign.
- Optional: add a one-line **description** under the Dashboard H1 (calm, short).

### D. API & performance

- After the split, `Dashboard` should call **fewer** endpoints on load than today. If you **do** add new sections to Markets, consider **lazy-load** (e.g. `React.lazy` or load when tab visible).
- Preserve existing error handling patterns (`loadJson` catches, user-facing messages).

### E. Quality bar

- **No** broken imports or dead state (remove unused `useState` / `useCallback` from `Dashboard` after the move).  
- Match existing **Tailwind** / component style (`DashboardCard`, `TableShell`, etc.).  
- Run the client build / lint and fix any issues you introduce.

## Files likely touched

- `client/src/pages/Dashboard.jsx` (major)  
- `client/src/pages/Markets.jsx` (only if you **must** add a **unique** widget not already there—otherwise **leave unchanged**)
- Possibly `client/src/components/Layout.jsx`, and any small new component for the "at a glance" strip or session line  
- `client/src/App.jsx` only if routes change (prefer not to add routes unless needed)

## Acceptance checklist

- [ ] Dashboard: calm, minimal; watchlist + session line + compact market context + light movers or link to Markets; **no** ticker spam by default.  
- [ ] Markets: **not bloated** with dashboard clones—if macro/breadth/sentiment already exist there, **do not** add second copies. **Only** add **SPDR/related**, **vol heatmap**, or **ticker** if those capabilities are **genuinely missing** on Markets.  
- [ ] No duplicate breadth/sentiment/macro **story** on both pages.  
- [ ] Build passes; UX copy is short and clear.

---

_End of handoff prompt._
