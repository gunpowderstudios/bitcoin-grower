# 🌱 Bitcoin Garden

A friendly, mobile-ready BTC/GBP **paper trading** experiment. Plant on dips, harvest portions after a rebound, and compare your virtual portfolio against simply buying and holding Bitcoin.

## Try it
Open `index.html` in a browser, or enable **GitHub Pages** in repository **Settings → Pages → Deploy from a branch → main / (root)**. Your site will then be available at `https://gunpowderstudios.github.io/bitcoin-grower/` once GitHub confirms publication.

## What it does
- Streams publicly available BTC/GBP ticker prices from Kraken via WebSocket v2, when reachable.
- Starts with a simulated £100 in cash. **No actual deposit, Kraken account or API access required.**
- Simulates a £10 purchase after each configured 5% fall from its price reference.
- Once a lot rebounds by 10% from that lot's purchase price, sells 50% of it **once**, retaining the remainder.
- Tracks cash, Bitcoin, simulated fees, realised P/L, trade history, and a simple buy-and-hold comparison.
- Has a clear pause/reset control, sample movement button, and CSV trade journal export.

## Safety and privacy
**This app does not trade real money.** No login, key, password, wallet address, account number, trading permission or external sign-in should ever be entered into it. It contains no private Kraken connection, server, analytics, third-party script, or credential storage. The Kraken WebSocket endpoint supplies public market data only.

Never put API keys into a public GitHub repository, browser JavaScript, a screenshot, a support message, or an AI chat. Real automated trading would require a secure private backend and a separately restricted Kraken API key with **no withdrawal permission**, safe order isolation and risk limits. **Do not add real trading to this static site.**

## Important limitations
- Simulation state is **in browser memory** and resets on a reload. Export trades before leaving the page.
- Keep the browser tab open for automatic simulated price monitoring; the app is not a hosted 24/7 bot.
- Small £10 purchases and subsequent half sales may not meet Kraken live order minimums; no live order-minimum validation is applied.
- Fees are estimates; prices, slippage, fills, taxes, outages and adverse trends can lead to losses.
- The bot buys only if enough simulated cash remains; no borrowing, derivatives or leverage.
- The simple harvest calculation tracks sale proceeds relative to the proportional portion of each lot's original cost; it is **not** an HMRC capital-gains calculation (UK pooling and 30-day rules may apply).
- Sample price movements are clearly marked, and do not represent live quotes.
- This is educational software, not investment advice. Never assume automated trading can guarantee returns.

## Sharing with friends
You can share the GitHub Pages link; each visitor runs an independent simulated garden in their own browser. No account registration or access to your Kraken account is involved.

Version: **1.14.2** (displayed in the app from `version.json`).\n\n## Versioning\nFor each app update, increment the semantic version in `version.json` and keep `bot/package.json` and this README synchronized. The app displays the version in the header and footer. Never place credentials in the repository.
\n## Cloudflare simulation Worker\nThe prepared v1.8.1 Worker (requires deployment with Wrangler) is in `cloudflare/`. It uses a five-minute scheduled public Kraken price check and SQLite-backed Durable Object state; its virtual trading now runs automatically and it cannot place real orders. See `cloudflare/README.md` for deployment instructions.\n
## Owner-only simulation dashboard
After deploying the new Worker, open `https://bitcoin-grower-bot.tim-c02.workers.dev/dashboard` to view persistent virtual balances, decisions and trades. Protect the Worker using Cloudflare Access (All traffic). Public GitHub Pages is a separate, browser-only demo for friends, not this owner dashboard. No live trading is supported.

## v1.6 monitoring
Protected Cloudflare dashboard adds up to seven days of stored price/portfolio snapshots, a progress indicator and up to 100 virtual trades. Real trading remains disabled.

## v1.7 unified navigation and future gardens
The public GitHub Pages app and Access-protected Cloudflare dashboard now have matching Demo Garden / My Garden navigation. This is navigation, **not a shared login or shared datastore**. Demo runs locally only while the browser tab is open and resets on reload; the single private Cloudflare Durable Object `simulation-v1` runs independent virtual checks. Do not place Cloudflare state or Kraken keys in the public app.

Future multi-user requirements: independently authenticated identities, separate per-user Durable Object IDs derived server-side from verified identity (never untrusted query strings), independent per-user budgets and rules, admin/owner isolation, rate limits, lifecycle and deletion, audit logging, and server-side authorization on every private endpoint. Each future live trader should initially own their own private deployment and restricted exchange keys in a secret store; never expose or share keys through GitHub or browsers. Do not implement shared live trading without security and regulatory review.

## v1.8 Time Machine
Public historical BTC/GBP daily-close backtest at `time-machine.html`, with adjustable GBP starting pot, date range, step size, dip/harvest rules, accelerated replay, growing plant, trading journal, result statistics, and buy-and-hold comparison. Tries a third-party GBP CSV archive automatically; users can upload a `Date,BTC_GBP` CSV if unavailable. Dates must be covered exactly and large gaps reject the test. Historical accuracy and source coverage must be checked independently. Daily close is not proof an order could have filled, and past results do not predict future performance. Time Machine is entirely client-side and cannot trade on Kraken.

### v1.8.1 Time Machine delight
Subtle SVG plant/coin animations, optional Web Audio synthesised chimes for harvests and stage growth. Sound is on by default from v1.9.1 (browsers only allow audio after the first click or tap), with an obvious on/off button. No downloaded audio or additional third-party dependencies. Browser reduced-motion preferences respected. Playback simulation only.

### v1.8.2 simple Time Machine
Beginner-first flow: amount, historical start date, Play. Defaults to latest available historical end date; advanced strategy controls remain optional. Shows large profit/loss and percentage as journey proceeds, with plain-language replay buttons.

### v1.8.3 Time Machine: a friendlier, livelier journey
* **Three obvious steps** (amount, date, one big green button) with presets for 2017, 2020, 2022 and "5 years ago". The journey always ends at the newest available price. Strategy settings (spend per buy, buy/harvest percentages, fee, optional stop date) live in *Advanced settings*.
* **Calculation fixes.** Buy-and-hold now pays the same one-off fee as the strategy (it previously ignored fees, flattering the comparison). After a harvest the reference price now resets to the harvest price, matching the paper engine in `bot/engine.js`. The buy size is now a % of the starting pot (default 10%, i.e. £10 on £100), so amounts other than £100 behave sensibly, and £1 or more can be planted. Bad rows in price files are skipped and counted, impossible dates are rejected and gaps of more than three days refuse the journey rather than guessing.
* **Living plant.** One persistent SVG with seven stages (seed, shoot, seedling, growing plant, bush, small tree, golden Bitcoin tree). Growth follows the *value of the pot* (ratio to the amount planted, see `STAGE_RATIOS`), never the calendar: a losing pot stays small and its leaves droop; recovery perks it up. Harvests drop gold coins into a pile; sparkles, sway and unfurling leaves respect `prefers-reduced-motion`.
* **Sound** (Web Audio, synthesised, off by default): coin clink for harvests, soft plop for buys, growth whoosh and rustle for new stages, and a completion tune. Effects are rate-limited and quieter at fast playback.
* **Time travel.** Large year/date display, sky that moves from dusk to daylight, animated timeline, a chart that draws as time advances (green above the amount planted, red below), Slow/Normal/Fast, Skip 30 days, Show final results, Start again, toasts for buys and harvests, and an end-of-journey summary with the buy-and-hold comparison.
* **Code layout.** `time-machine-engine.js` (pure logic, unit tested), `time-machine-plant.js`, `time-machine-sound.js`, `time-machine.js` (page controller), `time-machine.css`. Run `npm test` in the repository root.
* **Data.** Prices are fetched live from the third-party `typedcypher/historical-bitcoin-prices` CSV (GPL-3.0, derived from Kaggle data and converted to GBP with daily exchange rates). If that fails the page tries `data/btc-gbp-daily.csv` (not shipped by default - add a `Date,BTC_GBP` file there if you want a saved fallback, mindful of the source's licence) and then offers a CSV import. Prices are never invented.
* The Cloudflare Worker and My Garden dashboard were **not** changed or redeployed in this release (they still report their own v1.8.2 until next deployed).

## v1.9.0 Today's Garden (replaces the Playground)
The site's front page (`index.html`) is now **Today's Garden**, a simple, simulation-only page for non-technical visitors:
* **Live price.** Bitcoin in pounds from public, key-free, read-only tickers (Kraken, then CoinGecko), refreshed about every 30 seconds while the page is open and paused when the tab is hidden. If neither responds the newest daily close is shown and labelled as such. (Browser access to these tickers could not be tested from the build sandbox; the logic is unit-tested against sample responses.)
* **The garden plant.** Shows what a £100 seed planted one year ago would be worth today, with the same pot-value-driven plant as the Time Machine, plus 1-week, 1-month and 1-year changes.
* **The weather forecast.** Not a prediction: every past day since a chosen start year (2017 by default) is treated as a pretend planting day, and the page shows where 5 in 10 and 8 in 10 of the results landed after 1 month, 1 year or 5 years for any amount. Overlapping windows, ignored fees/tax and the early-years bias are stated on the page. See `forecast-engine.js`.
* Shared loaders: `price-data.js` (history) and `live-price.js` (live price). The Time Machine now uses `price-data.js`. Navigation across pages: My Garden / Today's Garden / Time Machine.
* The Cloudflare Worker and My Garden dashboard are unchanged (their navigation still says "Playground", which now points at Today's Garden).


### v1.9.1
Time Machine sound is now **on by default** (browsers only allow audio after the first click or tap, so it starts then); the button still toggles it.

## v1.10.0 Pruning styles
The Time Machine now offers three ready-made **pruning styles** (Light: sell a quarter of each purchase; Medium: half, the previous default; Heavy: sell it all) as picture cards in step 3. Buy/harvest steps stay at 5% down / 10% up so there is always something to watch. After every journey it runs **all three styles over the same dates** and shows them side by side with buy-and-hold, with a "Watch" button on each row. Editing the advanced numbers by hand switches to a custom row. Pure logic: `PRESETS` and `compareAll` in `time-machine-engine.js`.

## v1.11.0 Today's Prices and chart tabs
* The front page is renamed **Today's Prices** (was Today's Garden).
* New tabs above the price chart: **1H, 24H, 1W, 1M, 1Y, All**, with the % change over the chosen period and a hover/touch tooltip.
* 1Y and All use the daily history. 1H and 24H use public, key-free Kraken candles (CoinGecko as a fallback) and show a clear message if neither is reachable. 1W and 1M use finer live candles, falling back to daily history.
* New files: `price-ranges.js` (range config and helpers). `live-price.js` gains `parseKrakenOHLC`, `parseCoinGeckoChart` and `fetchSeries` (public GETs only).
* The Cloudflare Worker is untouched.
* The **My Garden** link has been removed from the public pages' navigation for now. The Cloudflare Worker and its dashboard are untouched and still run.

## v1.11.1
* Chart axis can no longer dip below £0 (the All view showed "£-7,140").
* The "£100 planted…" sentence now follows the selected tab (an hour ago … 2014). The plant itself stays on the one-year result.

## v1.11.2
* Removed the animated plant from Today's Prices (it duplicated the year-ago figures). The plant stays in the Time Machine. The "£100 seed" sentence remains, with a 🌱.

## v1.11.3
* Footer on both pages: "Bitcoin Garden © Gunpowder Studios 2026", linking to gunpowderstudios.co.uk in a new tab (yellow).

## v1.11.4
* Time Machine step 3 explains pruning in plain English, with a "What's pruning?" worked example.

## v1.11.5
* Clearer harvests: the plant's coin pile now reads "N sales · £X banked", the coins hanging in the tree are gone, and labels say a harvest is a sale that banks some profit.

## v1.11.6
* Time Machine gets a fourth choice, **Just hold**: everything in on day one, never sold. It plays through the same plant, chart and summary, and the results table compares it with the three pruning styles. Engine: `simulate(steps, {strategy:"hold"})`.

## v1.14.2 · ✂️ Pruning
- The third Time Machine tab is now called **Pruning** (was Cash in), with wording to match: you prune coins off the tree and keep that money in your pocket.
- Coins are now orange Bitcoin coins with a little stem and leaf on top, like an apple.

## v1.14.1 · 🍎 Cash in now looks forward
- The third Time Machine tab is **Cash in**, and it is forward-looking: plant today, choose when to pick apples (tree worth ×1.5, ×2, ×3 or ×5 what you planted) and how far ahead to look.
- We replay what happened after every past planting day with that rule (each pick sells what you planted into your pocket, fees included), then play three real past stretches from today: Tough Times, Middle Ground and Boom Times. Apples drop to the ground as they are picked.
- A table compares cashing in with just holding for each garden and says how often cashing in came out ahead. History, not a prediction; simulation only.
- Engine: `strategy: 'cashin'` / `cashAt` in `simulate()` and `cashInForecast()` in `forecast-engine.js`.

## v1.13.13 · Trees grow sooner
- Small tree now appears at 1.2× what you planted and the oak at 2× (was 1.5× and 3×), so typical forecasts visibly grow.
- Coins now ripen at 1.1×, 1.25×, 1.5×, 2×, 3×, 5×, 10× and 25×.

## v1.13.12 · Review fixes
- Made every version number and `?v=` cache-buster match (the pages had drifted between 1.13.7, 1.13.10 and 1.13.11, so browsers could keep stale scripts).
- Coin “clink” sound now plays when the coin lands, not while it is still hanging on the tree.
- Fixed the bot's package version and the version unit test.

## v1.13.10 · Forward label
- Time Machine forward box now reads “If you planted (or already own) this much today…”, so people can enter what they already hold.

## v1.13.6 · Simpler scene
- Switched off the little gardener and his speech bubbles in the Time Machine for now (code kept, not used).

## v1.13.5 · Flat, friendly trees
- Redrew the shoot, small tree and oak as flat 2D shapes (solid greens, simple brown trunks) with no shading.
- Milestone coins now use the classic orange Bitcoin logo and rest on the ground under the tree.

## v1.13.4 · A simpler, friendlier garden
- The plant is now just three stages: a **shoot**, a **small tree** (pot worth 1.5× what you planted) and an **oak** (3×).
- **Milestone coins** ripen on the leaves at 1.5×, 2×, 3×, 5×, 10× and 25× what you planted, then drop to the ground like apples. They mark how far the pot has climbed; they are not banked profit or real money.
- Same plant is used in the forward-forecast gardens. Still simulation only.

## v1.13.3
* "When would you like to travel back to?" gets a **The very start (2012)** button for the earliest day we have prices, with a plain warning that pre-2014 prices are thin and results can look enormous.
* The date hint now also says what one Bitcoin cost on the chosen start day (when we have a price for it).

## v1.13.3 · Historical price transparency
Time Machine now shows the earliest date and first BTC/GBP price in the actually loaded data, the chosen start day's price, and an expandable breakdown of purchase fees, BTC acquired, final valuation and profit/loss. It distinguishes Bitcoin's 2009 launch from the beginning of reliable price coverage. Earlier unsupported data are not invented. Extending back before 2012 requires a validated earlier BTC/GBP price series.

## v1.13.3 · Bitcoin Garden branding
Renamed app-facing branding from Bitcoin Grower to Bitcoin Garden. Existing repository and deployment URLs are intentionally unchanged until the GitHub repository is renamed and hosting paths are updated. Historical strategy descriptions and the persistent Cloudflare bot remain operationally unchanged.

## v1.13.3
* Wording: "The Bitcoin Garden" in page titles, header, notices and footer. Fixed the version unit test left on 1.11.7. The Cloudflare Worker files were not changed in this version.

## v1.13.3
* Forecast box wording: "If I planted it today…".

## v1.13.3
* **A little gardener** now narrates the Time Machine in speech bubbles: what the strategy is doing and why (plant on a dip, prune on a rise), storm and sunshine moments, and a closing line. Plain English, never advice. Files: `gardener-lines.js` (pure text), `time-machine-gardener.js` (character).
* **Four gardens, side by side**: after a journey, a button grows Light, Medium, Heavy and Just hold at the same time from the same start, with the biggest pot and the smoothest ride flagged. File: `time-machine-race.js`. `createPlant(svg, uid)` can now be used several times per page.

## v1.13.3
* The Time Machine now asks which way to travel: **🦖 Back in time** (the existing journey) or **🚀 Forward in time**, a history-based forecast shown as three gardens (a rough patch, a typical run, a good run: the 10th, 50th and 90th percentile of what happened after every past planting day) with the same honesty notes as the Today's Prices forecast. `futureFrames()` in `forecast-engine.js`; `createRace()` can now mount any set of beds.

## v1.13.3
* Removed the pruning styles (Light/Medium/Heavy, "Just hold" card, the three-style table and the four-gardens race). The Time Machine journey uses the usual strategy again, with the buy-and-hold comparison. The forward-in-time forecast and the gardener stay. Advanced settings still let you change how much is sold.

## v1.13.3
* Fixed the forward-in-time forecast getting stuck at day one: the playback position was being rounded every frame so it never advanced. Added a test that checks it really moves.

## v1.13.3 · Simple historical Bitcoin calculator
Historical Time Machine now makes a single Bitcoin purchase on the selected start date and holds it through historical daily prices. No dip-buying, pruning or selling. Clearer descriptions and one-purchase summary; future projections stay separate and hypothetical. Cloudflare background bot is unchanged.

## v1.13.10 · Simpler forward scenarios and bull/bear education
Renamed forward scenarios to Tough Times (bear), Middle Ground, Boom Times (bull), each with plain-English descriptions. Added expandable explanation of bull and bear markets and the historical ~4-year cycle, explicitly warning that it is not a prediction or reliable schedule. No changes to underlying percentile forecast calculations or Cloudflare bot.

## v1.13.10 · Forward-first navigation
Time Machine now opens with Forward in Time selected and shown first, while retaining Back in Time as the second option. Forecast and historical calculations unchanged.

## v1.13.10 · Forecast garden coin sounds and version display
Forward-in-time three-garden playback now triggers a rate-limited, gentle synthesised coin clink when new milestone coins fall. Respects existing sound enable control and reduced-motion preference; scrubbing does not trigger audio. Synchronised Time Machine HTML version badge, JS engine version, imports and cache query strings to prevent stale version display. No forecast maths or Cloudflare bot changes.

## v1.13.11 · Plain-English forecast chart legend
On Today's Prices, renamed wide area to Possible Ups & Downs, middle area to More Typical Outcomes, and centre line to Middle Ground. Added a small disclosure explaining middle 80%, middle 50%, and historical median. Forecast calculations unchanged.
