# 🌱 Bitcoin Grower

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

Version: **1.8.0** (displayed in the app from `version.json`).\n\n## Versioning\nFor each app update, increment the semantic version in `version.json` and keep `bot/package.json` and this README synchronized. The app displays the version in the header and footer. Never place credentials in the repository.
\n## Cloudflare simulation Worker\nThe prepared v1.8.0 Worker (requires deployment with Wrangler) is in `cloudflare/`. It uses a five-minute scheduled public Kraken price check and SQLite-backed Durable Object state; its virtual trading now runs automatically and it cannot place real orders. See `cloudflare/README.md` for deployment instructions.\n
## Owner-only simulation dashboard
After deploying the new Worker, open `https://bitcoin-grower-bot.tim-c02.workers.dev/dashboard` to view persistent virtual balances, decisions and trades. Protect the Worker using Cloudflare Access (All traffic). Public GitHub Pages is a separate, browser-only demo for friends, not this owner dashboard. No live trading is supported.

## v1.6 monitoring
Protected Cloudflare dashboard adds up to seven days of stored price/portfolio snapshots, a progress indicator and up to 100 virtual trades. Real trading remains disabled.

## v1.7 unified navigation and future gardens
The public GitHub Pages app and Access-protected Cloudflare dashboard now have matching Demo Garden / My Garden navigation. This is navigation, **not a shared login or shared datastore**. Demo runs locally only while the browser tab is open and resets on reload; the single private Cloudflare Durable Object `simulation-v1` runs independent virtual checks. Do not place Cloudflare state or Kraken keys in the public app.

Future multi-user requirements: independently authenticated identities, separate per-user Durable Object IDs derived server-side from verified identity (never untrusted query strings), independent per-user budgets and rules, admin/owner isolation, rate limits, lifecycle and deletion, audit logging, and server-side authorization on every private endpoint. Each future live trader should initially own their own private deployment and restricted exchange keys in a secret store; never expose or share keys through GitHub or browsers. Do not implement shared live trading without security and regulatory review.

## v1.8 Time Machine
Public historical BTC/GBP daily-close backtest at `time-machine.html`, with adjustable GBP starting pot, date range, step size, dip/harvest rules, accelerated replay, growing plant, trading journal, result statistics, and buy-and-hold comparison. Tries a third-party GBP CSV archive automatically; users can upload a `Date,BTC_GBP` CSV if unavailable. Dates must be covered exactly and large gaps reject the test. Historical accuracy and source coverage must be checked independently. Daily close is not proof an order could have filled, and past results do not predict future performance. Time Machine is entirely client-side and cannot trade on Kraken.
