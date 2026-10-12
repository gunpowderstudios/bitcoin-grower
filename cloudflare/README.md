# Cloudflare Worker — Bitcoin Grower v1.3.0

**Status:** Code prepared in GitHub. **Not deployed to Cloudflare yet.** SIMULATION PAUSED; no private Kraken connections; no orders.

The source lives in `cloudflare/src/index.js` and uses the shared pure decision engine from `bot/engine.js`. Durable Object storage remembers the virtual pot and most recent market check. A cron trigger checks Kraken's **public** BTC/GBP ticker every five minutes. The simulated trading engine is intentionally paused during initial deployment, so prices are recorded but no virtual buy/sell events are executed yet.

## Deploy via Wrangler (recommended)

1. Install Node.js 20+ and Wrangler (Cloudflare's official CLI) on your own machine.
2. Log in locally to Cloudflare with `npx wrangler login` — **do not send tokens or screenshots of secrets to anyone**.
3. From the `cloudflare` directory run `npx wrangler deploy --config wrangler.toml` using the existing Worker name `bitcoin-grower-bot`.
4. After deployment, confirm the Worker has a Durable Object binding named `GROWER_STATE` and a five-minute Cron Trigger.
5. Visit the authenticated Worker URL. Its response should show `version: 1.3.0`, `mode: SIMULATION`, `tradingEnabled: false`, `status: PAUSED`. Wait five minutes for `lastMarketCheck`.
6. Recheck **Cloudflare Access / All traffic** and its authentication policy. Do not add live credentials or trading permissions.

The Cloudflare browser editor alone is **not** a dependable route for deploying these Durable Object migrations and project-level bindings. The `wrangler.toml` file declares the required SQLite class migration and binding.

## Security

- There are no secret inputs and no Kraken account calls.
- `GROWER_STATE` is only accessible as an internal binding.
- The public Worker interface is read-only; no state-changing HTTP endpoints.
- The DO currently records only the market check; the bot's simulated trading is hard-locked to paused.
- A future mode switch must be **authenticated server-side**, cannot be enabled by merely changing client JavaScript, and must require explicit user confirmation after an independent safety review.
- When eventually implemented, the live bot needs exchange reconciliation, minimum orders, partial fill handling, idempotency, durable budgets, remote halt and restricted credentials (no withdrawals).

**Do not put Kraken API keys, secrets, passwords or cookies in this repository.**
