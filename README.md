# 🌱 The Bitcoin Garden

A friendly, **simulation-only** look at Bitcoin in pounds. Nothing here trades, holds or touches real money, and there are no accounts, keys or sign-ins.

## Try it
Open `index.html` in a browser, or enable **GitHub Pages** (repository **Settings → Pages → Deploy from a branch → main / root**). The site is at `https://gunpowderstudios.github.io/bitcoin-grower/`.

## What's on the site
**Today's Prices** (`index.html`): the live Bitcoin price in pounds (public, key-free tickers: Kraken, then CoinGecko, refreshed about every 30 seconds while the tab is visible; if neither responds the newest daily close is shown and labelled), a chart with 1H / 24H / 1W / 1M / 1Y / All tabs, and a history-based "weather forecast" of where an amount might end up.

**Time Machine** (`time-machine.html`) has three tabs:
- **🚀 Forward in time** (opens first): plant (or already own) an amount today and watch three gardens grow: *Tough Times*, *Middle Ground* and *Boom Times*. They are the 10th, 50th and 90th percentile of what happened after every past planting day. History, not a prediction.
- **🦖 Back in time**: buy once on a past date and hold to the newest price. One purchase, one fee, no selling.
- **✂️ Pruning**: plant today, choose a pruning level (tree worth ×1.5, ×2, ×3 or ×5 what you planted) and a horizon. Each time the tree reaches that level, a coin is pruned: what you planted is sold and kept in your pocket (fees included). It replays that rule from every past planting day, plays the three representative stretches, and compares pruning with simply holding, including how often pruning came out ahead. Holding usually wins in Bitcoin's history, and the page says so.

**The plant.** A shoot, then a small tree (pot worth 1.2× what you planted), then an oak (2×). Growth follows the value of the pot, never the calendar; a losing pot droops. Milestone coins ripen at 1.1×, 1.25×, 1.5×, 2×, 3×, 5×, 10× and 25× and drop to the ground. In Pruning, each coin is one really pruned. Animations respect `prefers-reduced-motion`; optional synthesised sound (Web Audio, no audio files) is on by default once the visitor first clicks.

## Safety and privacy
**This site does not trade real money.** Never enter a login, key, password, wallet address or account number into it. It has no private exchange connection, server, analytics or credential storage. Never put API keys into this repository, browser JavaScript, a screenshot or an AI chat. Real automated trading would need a secure private backend and a restricted key with no withdrawal permission; **do not add real trading to this static site.**

## Important limitations
- Prices are daily closes from a third-party GBP archive (`typedcypher/historical-bitcoin-prices`, GPL-3.0, from 2012). The page falls back to `data/btc-gbp-daily.csv` if you add one, then to a CSV import. Prices are never invented, and pre-2014 prices are thin.
- A daily close is not proof an order could have filled. Fees are estimates; tax, slippage and outages are ignored.
- Overlapping windows and the early-years bias in the history are stated on the page. Past results do not predict future ones.
- Not an HMRC capital-gains calculation, and not investment advice.

## Code layout
Plain ES modules, no build step. Pure logic is unit tested (`npm test` in the repository root, Node 22): `time-machine-engine.js` (simulation: `hold`, `cashin`, plus an unused legacy `grow` rule; plant stages and coins), `forecast-engine.js` (percentile forecasts and `cashInForecast`), `price-data.js`, `live-price.js`, `price-ranges.js`. Page code: `garden.js` (Today's Prices), `time-machine.js`, `time-machine-plant.js`, `time-machine-race.js`, `time-machine-sound.js`. Bump the version in `version.json`, `package.json`, `bot/package.json`, `VERSION`, the HTML version tags, every `?v=` import query and the line below together.

Version: **1.14.7** (displayed in the app from `version.json`).

## Sharing
Share the GitHub Pages link; each visitor runs their own simulation in their own browser.

## Cloudflare simulation Worker
`cloudflare/` holds the separate, owner-only paper-trading Worker (five-minute public Kraken price check, SQLite-backed Durable Object, virtual trades only, cannot place real orders). It imports only `bot/engine.js`, is independent of the site code above, and was not changed in v1.14.3. See `cloudflare/README.md`.

## Owner-only simulation dashboard
After deploying the new Worker, open `https://bitcoin-grower-bot.tim-c02.workers.dev/dashboard` to view persistent virtual balances, decisions and trades. Protect the Worker using Cloudflare Access (All traffic). Public GitHub Pages is a separate, browser-only demo for friends, not this owner dashboard. No live trading is supported.

## Monitoring (Cloudflare dashboard)
Protected Cloudflare dashboard adds up to seven days of stored price/portfolio snapshots, a progress indicator and up to 100 virtual trades. Real trading remains disabled.

## Navigation and future gardens
The public GitHub Pages app and Access-protected Cloudflare dashboard now have matching Demo Garden / My Garden navigation. This is navigation, **not a shared login or shared datastore**. Demo runs locally only while the browser tab is open and resets on reload; the single private Cloudflare Durable Object `simulation-v1` runs independent virtual checks. Do not place Cloudflare state or Kraken keys in the public app.

Future multi-user requirements: independently authenticated identities, separate per-user Durable Object IDs derived server-side from verified identity (never untrusted query strings), independent per-user budgets and rules, admin/owner isolation, rate limits, lifecycle and deletion, audit logging, and server-side authorization on every private endpoint. Each future live trader should initially own their own private deployment and restricted exchange keys in a secret store; never expose or share keys through GitHub or browsers. Do not implement shared live trading without security and regulatory review.

## Release notes (short)
- **1.14.3** Tidy-up, no interface changes: removed the retired gardener, the old Grower strategy's hidden settings and the compare toggle from the site; fixed leftover wording; refreshed the browser tests and this README.
- **1.14.7** Back in time quick dates are in date order (1 week, 1 month, 1 year, 5 years, very start); 2017, 2020 and 2022 removed.
- **1.14.6** Back in time shows the facts straight away: what your amount, planted on the chosen day, would be worth at the newest price (price then and now, Bitcoin owned, multiple). The animated journey is still below.
- **1.14.5** Back in time: quick date choices for 1 week, 1 month and 1 year ago.
- **1.14.2** Third tab renamed **Pruning**; coins are orange Bitcoin coins with a stem and leaf.
- **1.14.1** The third tab looks forward from today rather than back.
- **1.14.0** Third Time Machine tab added (then called Cash in).
- **1.13.x** Simpler friendlier garden: flat 2D shoot / small tree / oak; milestone coins; Forward in time opens first with Tough Times / Middle Ground / Boom Times; Back in time became a single buy-and-hold; plain-English forecast legend; "(or already own)" wording; version numbers and `?v=` cache-busters kept in step.
- **1.11.x** Today's Prices with chart range tabs; footer; Just hold.
- **1.9–1.10** Today's Prices forecast; sound on by default.
- **1.8** Time Machine introduced.
- **1.6–1.7** Cloudflare dashboard monitoring and shared navigation (the dashboard still says "Playground" in its nav; left alone).

## v1.14.4 · Bitcoin Chatter
Added a third public navigation tab after Time Machine. Displays up to 12 latest Bitcoin headlines from a public no-key, CORS-capable third-party news feed, linking to original publishers, with graceful failure handling. No Cloudflare deployment or trading logic changes.
