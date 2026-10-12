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

Version: **1.3.3** (displayed in the app from `version.json`).\n\n## Versioning\nFor each app update, increment the semantic version in `version.json` and keep `bot/package.json` and this README synchronized. The app displays the version in the header and footer. Never place credentials in the repository.
\n## Cloudflare simulation Worker\nThe prepared v1.3.3 Worker (not yet deployed) is in `cloudflare/`. It uses a five-minute scheduled public Kraken price check and SQLite-backed Durable Object state; its simulated trading remains paused and it cannot place real orders. See `cloudflare/README.md` for deployment instructions.\n