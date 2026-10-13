// Bitcoin Garden — shared historical BTC/GBP price loader (v1.11.11).
// Live source first, then an optional saved copy at ./data/btc-gbp-daily.csv. Prices are never invented.
import { parseCSV } from './time-machine-engine.js?v=1.11.11';

export const LIVE_URL = 'https://raw.githubusercontent.com/typedcypher/historical-bitcoin-prices/main/data/daily_bitcoin_prices.csv';
export const LOCAL_URL = './data/btc-gbp-daily.csv';
export const SOURCE_TEXT = 'Daily Bitcoin prices in pounds (BTC/GBP) come from the open “historical-bitcoin-prices” dataset by typedcypher (GPL-3.0 licence), which is built from Kaggle Bitcoin price data and converted to pounds using daily exchange rates (the previous day’s rate is reused at weekends).';

async function fetchText(url, ms = 15000) {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { cache: 'no-cache', signal: ctl.signal });
    if (!r.ok) throw new Error('server answered ' + r.status);
    return await r.text();
  } finally { clearTimeout(timer); }
}

/** Resolves { points, rejected, note }; rejects with an Error whose message names the first problem. */
export async function loadHistory() {
  const tries = [
    { url: LIVE_URL, note: SOURCE_TEXT + ' Loaded live from GitHub.' },
    { url: LOCAL_URL, note: SOURCE_TEXT + ' The live source could not be reached, so a saved copy from this site is being used.' }
  ];
  const problems = [];
  for (const t of tries) {
    try { const { points, rejected } = parseCSV(await fetchText(t.url)); return { points, rejected, note: t.note }; }
    catch (e) { problems.push(e.message || String(e)); }
  }
  throw new Error(problems[0]);
}
