// Bitcoin Grower — chart time ranges for the price page (v1.11.1). Pure helpers, no network.
import { addDays, dayNumber } from './time-machine-engine.js';

/**
 * Each tab: how far back it looks, and how to get the data.
 *  - kraken: public OHLC candles (interval in minutes, how many to keep)
 *  - gecko:  CoinGecko market_chart `days` (fallback), keeping only the last `ms` milliseconds
 *  - history: from the daily history (always available)
 */
export const RANGES = Object.freeze({
  '1h': { label: '1H', words: 'the last hour', ms: 3600e3, kraken: { interval: 1, count: 60 }, gecko: { days: 1 }, intraday: true },
  '24h': { label: '24H', words: 'the last 24 hours', ms: 86400e3, kraken: { interval: 5, count: 288 }, gecko: { days: 1 }, intraday: true },
  '1w': { label: '1W', words: 'the last week', ms: 7 * 86400e3, kraken: { interval: 60, count: 168 }, gecko: { days: 7 }, history: { days: 7 } },
  '1m': { label: '1M', words: 'the last month', ms: 30 * 86400e3, kraken: { interval: 240, count: 180 }, gecko: { days: 30 }, history: { days: 30 } },
  '1y': { label: '1Y', words: 'the last year', ms: 365 * 86400e3, history: { days: 365 } },
  all: { label: 'All', words: 'all the history we trust (since 2014)', ms: Infinity, history: { since: '2014-01-01' } }
});
export const RANGE_ORDER = Object.freeze(['1h', '24h', '1w', '1m', '1y', 'all']);

/** Daily history -> [{x (ms), v}] for a range (works for 1W, 1M, 1Y, All). */
export function historySeries(points, key) {
  const r = RANGES[key];
  if (!r?.history || !points?.length) return [];
  const end = points.at(-1).date;
  const from = r.history.since ?? addDays(end, -r.history.days);
  return points.filter(p => p.date >= from).map(p => ({ x: Date.parse(p.date + 'T00:00:00Z'), v: p.price }));
}

/** First-to-last change of a series: { from, to, pct } or null. */
export function changeOver(series) {
  if (!series || series.length < 2) return null;
  const a = series[0].v, b = series.at(-1).v;
  return { from: a, to: b, pct: 100 * (b / a - 1) };
}

/** Keep only samples inside the last `ms` before the newest one (used to trim CoinGecko's day-sized chunks). */
export function trimToWindow(series, ms) {
  if (!series.length || !Number.isFinite(ms)) return series;
  const cut = series.at(-1).x - ms;
  return series.filter(s => s.x >= cut);
}

/** Thin a long series to at most `max` points, always keeping the first and last. */
export function downsample(series, max = 400) {
  if (series.length <= max) return series;
  const step = (series.length - 1) / (max - 1), out = [];
  for (let i = 0; i < max; i++) out.push(series[Math.round(i * step)]);
  return out;
}

/** Axis label for a time value, chosen to suit the span being shown. */
export function axisLabel(x, spanMs) {
  const d = new Date(x);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  if (spanMs <= 2 * 86400e3) return pad(d.getHours()) + ':' + pad(d.getMinutes());
  if (spanMs <= 45 * 86400e3) return d.getDate() + ' ' + MONTHS[d.getMonth()];
  if (spanMs <= 800 * 86400e3) return MONTHS[d.getMonth()] + ' ’' + String(d.getFullYear()).slice(2);
  return String(d.getFullYear());
}
export function tooltipLabel(x, spanMs) {
  const d = new Date(x);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = n => String(n).padStart(2, '0');
  const day = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  return spanMs <= 45 * 86400e3 ? day + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) : day;
}
export { dayNumber };
