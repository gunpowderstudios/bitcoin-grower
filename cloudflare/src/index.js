import { DurableObject } from "cloudflare:workers";
import { initialState, step, DEFAULT_RULES } from "../../bot/engine.js";

// SIMULATION ONLY: no Kraken private API, no authentication credentials, no orders.
const VERSION = "1.4.0";
const KRAKEN_TICKER = "https://api.kraken.com/0/public/Ticker?pair=XBTGBP";

async function getPrice() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(KRAKEN_TICKER, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("Ticker HTTP error");
    const data = await response.json();
    if (data.error?.length) throw new Error("Kraken ticker error");
    const price = Number(Object.values(data.result || {})[0]?.c?.[0]);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid ticker price");
    return price;
  } finally {
    clearTimeout(timeout);
  }
}

export class BitcoinGrowerState extends DurableObject {
  async fetch(request) {
    // DO is only addressable from the Worker via binding; do not make it publicly reachable.
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/internal/status") {
      const state = await this.ctx.storage.get("state");
      const last = await this.ctx.storage.get("lastCheck");
      return Response.json({
        version: VERSION, mode: "SIMULATION", tradingEnabled: false,
        state: state || null, lastCheck: last || null,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST" || pathname !== "/internal/tick") {
      return new Response("Not found", { status: 404 });
    }
    const input = await request.json();
    const price = input.price;
    const checkedAt = input.checkedAt;
    if (!Number.isFinite(price) || price <= 0 || typeof checkedAt !== "string" ||
        Number.isNaN(Date.parse(checkedAt))) return new Response("Invalid input", { status: 400 });
    const prev = await this.ctx.storage.get("lastCheck");
    // No duplicate executions for the same or older minute.
    if (prev && Date.parse(checkedAt) <= Date.parse(prev.checkedAt)) {
      return Response.json({ ignored: true });
    }
    let state = await this.ctx.storage.get("state");
    if (!state) state = initialState(price);


    // Only a virtual ledger: the step() function cannot contact Kraken or place orders.
    const result = step(state, price, checkedAt.slice(0, 10), DEFAULT_RULES);
    await this.ctx.storage.put("state", result.state);
    await this.ctx.storage.put("lastCheck", {
      checkedAt, price, reason: result.reason, action: result.action?.side || null
    });
    return Response.json({ version: VERSION, mode: "SIMULATION", tradingEnabled: false, action: result.action, paused: false });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }
    // Read-only, public-market-data status. No controls or private data exposed.
    const id = env.GROWER_STATE.idFromName("simulation-v1");
    const stub = env.GROWER_STATE.get(id);
    const response = await stub.fetch("https://internal/internal/status");
    const info = await response.json();
    return Response.json({
      app: "Bitcoin Grower", version: VERSION,
      mode: "SIMULATION", tradingEnabled: false,
      status: "SIMULATING", lastMarketCheck: info.lastCheck || null,
      virtual: info.state ? {
        initialGBP: 100,
        cashGBP: info.state.cashGBP,
        bitcoinBTC: info.state.btc,
        estimatedTotalGBP: info.lastCheck ? info.state.cashGBP + info.state.btc * info.lastCheck.price : null,
        trades: info.state.trades?.slice(-10) || [],
        nextBuyGBP: info.state.lot ? null : info.state.buyReference * (1 - DEFAULT_RULES.dipPct / 100),
        nextSellGBP: info.state.lot ? info.state.lot.price * (1 + DEFAULT_RULES.reboundPct / 100) : null
      } : null,
      // No balances or transaction history returned publicly.
    }, { headers: { "Cache-Control": "no-store" } });
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      const price = await getPrice();
      const id = env.GROWER_STATE.idFromName("simulation-v1");
      await env.GROWER_STATE.get(id).fetch("https://internal/internal/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, checkedAt: new Date(controller.scheduledTime).toISOString() }),
      });
    })());
  }
};
