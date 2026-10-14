// The Bitcoin Garden — live BTC/GBP price from public, key-free endpoints.
// Read-only GET requests to public price tickers. No accounts, no keys, no trading.
const KRAKEN = 'https://api.kraken.com/0/public/Ticker?pair=XBTGBP';
const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp&include_24hr_change=true';

const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : NaN; };

/** Kraken Ticker -> { price, changePct (since today's UTC open) } */
export function parseKraken(json) {
  if (!json || (json.error && json.error.length) || !json.result) throw new Error('Kraken returned an error');
  const t = Object.values(json.result)[0];
  const price = num(t?.c?.[0]), open = num(t?.o);
  if (!Number.isFinite(price)) throw new Error('Kraken price missing');
  return { price, changePct: Number.isFinite(open) ? 100 * (price / open - 1) : null, changeLabel: 'since midnight UTC', source: 'Kraken' };
}
/** CoinGecko simple price -> { price, changePct (24h) } */
export function parseCoinGecko(json) {
  const b = json?.bitcoin, price = num(b?.gbp);
  if (!Number.isFinite(price)) throw new Error('CoinGecko price missing');
  const ch = Number(b.gbp_24h_change);
  return { price, changePct: Number.isFinite(ch) ? ch : null, changeLabel: 'in the last 24 hours', source: 'CoinGecko' };
}

async function getJSON(url, ms = 8000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl.signal });
    if (!r.ok) throw new Error('server answered ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

/** Try each public source in turn. Resolves with {price, changePct, changeLabel, source, at} or rejects. */
export async function fetchLive() {
  const tries = [[KRAKEN, parseKraken], [COINGECKO, parseCoinGecko]];
  let last;
  for (const [url, parse] of tries) {
    try { return { ...parse(await getJSON(url)), at: Date.now() }; } catch (e) { last = e; }
  }
  throw last || new Error('No live price available');
}

// ---------------------------------------------------------------- short-term charts (1H, 24H, 1W, 1M)
const KRAKEN_OHLC = interval => 'https://api.kraken.com/0/public/OHLC?pair=XBTGBP&interval=' + interval;
const COINGECKO_CHART = days => 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=gbp&days=' + days;

/** Kraken OHLC -> last `count` closes as [{x (ms), v}] */
export function parseKrakenOHLC(json, count) {
  if (!json || (json.error && json.error.length) || !json.result) throw new Error('Kraken returned an error');
  const key = Object.keys(json.result).find(k => k !== 'last'), rows = json.result[key];
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('Kraken chart data missing');
  const out = rows.map(r => ({ x: Number(r[0]) * 1000, v: num(r[4]) })).filter(s => Number.isFinite(s.x) && Number.isFinite(s.v));
  if (out.length < 2) throw new Error('Kraken chart data unreadable');
  return out.slice(-count);
}
/** CoinGecko market_chart -> [{x (ms), v}] */
export function parseCoinGeckoChart(json) {
  const rows = json?.prices;
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('CoinGecko chart data missing');
  const out = rows.map(r => ({ x: Number(r[0]), v: num(r[1]) })).filter(s => Number.isFinite(s.x) && Number.isFinite(s.v));
  if (out.length < 2) throw new Error('CoinGecko chart data unreadable');
  return out;
}

/** Short-term series for a range config from price-ranges.js. Tries Kraken, then CoinGecko. Resolves {series, source}. */
export async function fetchSeries(range, trimToWindow) {
  let last;
  if (range.kraken) {
    try { return { series: parseKrakenOHLC(await getJSON(KRAKEN_OHLC(range.kraken.interval)), range.kraken.count), source: 'Kraken' }; } catch (e) { last = e; }
  }
  if (range.gecko) {
    try { return { series: trimToWindow(parseCoinGeckoChart(await getJSON(COINGECKO_CHART(range.gecko.days), 12000)), range.ms), source: 'CoinGecko' }; } catch (e) { last = e; }
  }
  throw last || new Error('No chart data available');
}
