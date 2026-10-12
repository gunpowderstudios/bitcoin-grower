# Cloudflare Worker — Bitcoin Grower v1.6.0

**Status:** Code prepared in GitHub. **Not deployed to Cloudflare yet.** SIMULATION ACTIVE; no private Kraken connections; no orders.

The source lives in `cloudflare/src/index.js` and uses the shared pure decision engine from `bot/engine.js`. Durable Object storage remembers the virtual pot and most recent market check. A cron trigger checks Kraken's **public** BTC/GBP ticker every five minutes. The simulated trading engine runs on each scheduled check with virtual balances only; no private Kraken endpoint is called.

## Deploy via Wrangler (recommended)

1. Install Node.js 20+ and Wrangler (Cloudflare's official CLI) on your own machine.
2. Log in locally to Cloudflare with `npx wrangler login` — **do not send tokens or screenshots of secrets to anyone**.
3. From the `cloudflare` directory run `npx wrangler deploy --config wrangler.toml` using the existing Worker name `bitcoin-grower-bot`.
4. After deployment, confirm the Worker has a Durable Object binding named `GROWER_STATE` and a five-minute Cron Trigger.
5. Visit the authenticated Worker URL. Its response should show `version: 1.6.0`, `mode: SIMULATION`, `tradingEnabled: false`, `status: PAUSED`. Wait five minutes for `lastMarketCheck`.
6. Recheck **Cloudflare Access / All traffic** and its authentication policy. Do not add live credentials or trading permissions.

The Cloudflare browser editor alone is **not** a dependable route for deploying these Durable Object migrations and project-level bindings. The `wrangler.toml` file declares the required SQLite class migration and binding.

## Security

- There are no secret inputs and no Kraken account calls.
- `GROWER_STATE` is only accessible as an internal binding.
- The public Worker interface is read-only; no state-changing HTTP endpoints.
- The DO updates the virtual cash, BTC, one open lot and journal after each scheduled tick. No real orders can be placed.
- A future mode switch must be **authenticated server-side**, cannot be enabled by merely changing client JavaScript, and must require explicit user confirmation after an independent safety review.
- When eventually implemented, the live bot needs exchange reconciliation, minimum orders, partial fill handling, idempotency, durable budgets, remote halt and restricted credentials (no withdrawals).

**Do not put Kraken API keys, secrets, passwords or cookies in this repository.**

## v1.5 dashboard
The Worker offers `/dashboard` as an HTML view of the existing read-only `/` status. Same-origin access avoids exposing tokens through GitHub Pages. Confirm Access really denies unauthenticated/incognito visitors before treating the status as private. Simulated data only, no credentials.

## v1.6
After deployment, scheduled checks store at most 2016 historical points (approximately 7 days) for indexed chart display. History starts upon upgrade. Dashboard remains simulation-only.
