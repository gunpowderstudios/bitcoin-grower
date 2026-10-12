# Live-trading security gate — NOT enabled

The public GitHub Pages application and `bot/engine.js` are **paper-trading only**.
There is no login, API key, Kraken private API call, order execution, or unattended live trading here.

## Why this matters
A trading-enabled Kraken API key is capable of placing orders against **every eligible spot balance** in its Kraken account. The absence of withdrawal permissions does not prevent trading losses. A software-defined £100 budget is not equivalent to exchange-level account isolation.

## Preconditions for a future live deployment
1. Confirm that Kraken contains only the experimental £100 and no other material positions or funds. Check **spot balances** before enabling anything.
2. Choose a separate private compute host, authenticated management interface, and private secret store. Never host API credentials in GitHub Pages, browser code, repository files, screenshots, or chat.
3. Implement and test exchange-side spot-only rules, limit/market order size checks, accurate minimums and fees, fills and partial fills, idempotent order placement, persistence, loss controls, balance reconciliation, fresh-price checks, and real emergency shutdown.
4. Use a dedicated API key with **no withdrawal or funding permissions**; scope the minimal order and balance query permissions, IP restriction when feasible, and account 2FA.
5. Require a separate manual opt-in for each progressive phase: paper, live one-order test, unattended automation.
6. Build a remote stop mechanism that cancels pending orders and prevents new trading even if the dashboard is closed.
7. Review the bot's UK CGT recordkeeping, pooled cost basis and reporting treatment. Trading does not guarantee returns.

This repository does not yet satisfy the requirements to place live orders. **Do not paste secrets into it.**

## Local paper engine tests
Install Node.js 20+, then run `npm test` from the `bot` folder. Tests perform no network calls.
