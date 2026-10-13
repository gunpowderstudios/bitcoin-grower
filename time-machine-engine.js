// Bitcoin Garden Time Machine — pure simulation logic (v1.13.3).
// No DOM, no network, no credentials, no exchange access: this module only does
// arithmetic on historical prices so it can be tested in Node and reused by the page.
export const VERSION = '1.14.2';

export const DEFAULTS = Object.freeze({
  amount: 100,   // £ planted at the start
  buyPct: 10,    // each buy spends this % of the starting pot
  dipPct: 5,     // buy after the price falls this % from the reference price
  risePct: 10,   // harvest after the price rises this % above the buy price
  sellPct: 50,   // harvest this % of the bitcoin bought in that purchase
  feePct: 0.4,   // fee charged on every virtual trade
  cashAt: 2      // 'cash in' mode: pick apples (sell what you planted) whenever the tree is worth this many times what you planted
});

const DAY = 86400000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GAP_DAYS = 3;       // a weekend-sized hole is tolerated, more is rejected
const MIN_JOURNEY_DAYS = 7;

export function isRealDate(s) {
  if (typeof s !== 'string' || !ISO.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}
export const dayNumber = s => Math.round(Date.parse(s + 'T00:00:00Z') / DAY);
export function addDays(s, n) { return new Date(Date.parse(s + 'T00:00:00Z') + n * DAY).toISOString().slice(0, 10); }
export function addYears(s, n) {
  const d = new Date(Date.parse(s + 'T00:00:00Z'));
  const month = d.getUTCMonth();
  d.setUTCFullYear(d.getUTCFullYear() + n);
  if (d.getUTCMonth() !== month) d.setUTCDate(0); // 29 Feb -> 28 Feb
  return d.toISOString().slice(0, 10);
}

// ---------- data loading ----------
const clean = v => String(v ?? '').replace(/^﻿/, '').replaceAll('"', '').trim();

/** Parse a "Date,BTC_GBP" style CSV. Never invents or repairs prices: bad rows are dropped and counted. */
export function parseCSV(text) {
  const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) throw new Error('The price file is empty.');
  const heads = lines.shift().split(',').map(h => clean(h).toLowerCase());
  const dateCol = heads.indexOf('date'), priceCol = heads.indexOf('btc_gbp');
  if (dateCol < 0 || priceCol < 0) throw new Error('The price file needs "Date" and "BTC_GBP" columns (prices must be in pounds sterling).');
  let rejected = 0;
  const map = new Map();
  for (const line of lines) {
    const parts = line.split(',');
    const date = clean(parts[dateCol]).slice(0, 10);
    const raw = clean(parts[priceCol]);
    const price = raw === '' ? NaN : Number(raw);
    if (!isRealDate(date) || !Number.isFinite(price) || price <= 0) { rejected++; continue; }
    map.set(date, price); // a repeated date keeps its last value
  }
  const points = [...map].map(([date, price]) => ({ date, price })).sort((a, b) => a.date.localeCompare(b.date));
  const duplicates = lines.length - rejected - points.length;
  if (points.length < 30) throw new Error('Too few valid daily GBP Bitcoin prices (' + points.length + ').');
  return { points, rejected, duplicates };
}

/** Describe coverage and holes in a price series. */
export function describeData(points) {
  const gaps = [];
  for (let i = 1; i < points.length; i++) {
    const g = dayNumber(points[i].date) - dayNumber(points[i - 1].date);
    if (g > 1) gaps.push({ from: points[i - 1].date, to: points[i].date, days: g - 1 });
  }
  return { count: points.length, first: points[0].date, last: points.at(-1).date, gaps, maxGap: gaps.reduce((m, g) => Math.max(m, g.days), 0) };
}

// ---------- settings ----------
export function validateSettings(input = {}) {
  const s = {
    strategy: input.strategy === 'hold' ? 'hold' : input.strategy === 'cashin' ? 'cashin' : 'grow',
    amount: Number(input.amount ?? DEFAULTS.amount), buyPct: Number(input.buyPct ?? DEFAULTS.buyPct),
    dipPct: Number(input.dipPct ?? DEFAULTS.dipPct), risePct: Number(input.risePct ?? DEFAULTS.risePct),
    sellPct: Number(input.sellPct ?? DEFAULTS.sellPct), feePct: Number(input.feePct ?? DEFAULTS.feePct),
    cashAt: Number(input.cashAt ?? DEFAULTS.cashAt)
  };
  const bad = (k, lo, hi) => !Number.isFinite(s[k]) || s[k] < lo || s[k] > hi;
  if (bad('amount', 1, 1e6)) throw new Error('Please plant between £1 and £1,000,000.');
  if (bad('buyPct', 1, 100)) throw new Error('"Spend per buy" must be between 1% and 100% of your pot.');
  if (bad('dipPct', 0.5, 90)) throw new Error('"Buy after a fall of" must be between 0.5% and 90%.');
  if (bad('risePct', 0.5, 500)) throw new Error('"Harvest after a rise of" must be between 0.5% and 500%.');
  if (bad('sellPct', 1, 100)) throw new Error('"Harvest this much" must be between 1% and 100%.');
  if (bad('feePct', 0, 10)) throw new Error('The fee must be between 0% and 10%.');
  if (bad('cashAt', 1.1, 100)) throw new Error('“Prune at” must be between 1.1× and 100× what you planted.');
  return s;
}

// ---------- choosing the journey ----------
/** Pick the daily prices between two dates (inclusive). Throws friendly errors; never fills gaps. */
export function selectRange(points, from, to) {
  if (!points?.length) throw new Error('Bitcoin prices have not loaded yet.');
  if (!isRealDate(from)) throw new Error('Please choose a date to travel back to.');
  const first = points[0].date, last = points.at(-1).date;
  if (!to) to = last;
  if (!isRealDate(to)) throw new Error('The end date is not a real date.');
  if (from < first) throw new Error('Our price history starts on ' + first + '. Please choose a later date.');
  if (from > last) throw new Error('That date is in the future! The latest price we have is for ' + last + '.');
  if (to > last) to = last;
  if (from >= to) throw new Error('Please choose a start date before the end date.');
  const steps = points.filter(p => p.date >= from && p.date <= to);
  if (steps.length < 2) throw new Error('There are no prices for those dates.');
  if (dayNumber(steps[0].date) - dayNumber(from) > MAX_GAP_DAYS) throw new Error('There is no price data near ' + from + '. The nearest is ' + steps[0].date + '.');
  if (dayNumber(to) - dayNumber(steps.at(-1).date) > MAX_GAP_DAYS) throw new Error('There is no price data near ' + to + '.');
  if (dayNumber(steps.at(-1).date) - dayNumber(steps[0].date) < MIN_JOURNEY_DAYS) throw new Error('Please travel back at least a week so there is something to watch.');
  for (let i = 1; i < steps.length; i++) {
    const g = dayNumber(steps[i].date) - dayNumber(steps[i - 1].date);
    if (g > MAX_GAP_DAYS) throw new Error('Prices are missing between ' + steps[i - 1].date + ' and ' + steps[i].date + ', so we cannot replay that period honestly. Please pick different dates.');
  }
  return steps;
}

// ---------- the Grower strategy ----------
/**
 * Replays the Grower strategy over daily closing prices (simulation only).
 *  - Wait for the price to fall `dipPct` below the reference price (the start price, then the last buy/harvest price).
 *  - Buy `buyPct` of the starting pot (if enough cash is left). Only one purchase is "open" at a time.
 *  - When the price rises `risePct` above that purchase, sell `sellPct` of it (a "harvest"); the reference price resets
 *    to the harvest price and any remaining bitcoin is kept.
 *  - Every trade costs `feePct`. No borrowing, no shorting.
 * "Buy and hold" puts the whole pot into Bitcoin on day one (paying the same fee once) and does nothing else.
 */
export function simulate(steps, rawSettings) {
  const s = validateSettings(rawSettings);
  const fee = s.feePct / 100, buyAmount = s.amount * s.buyPct / 100, sellFrac = s.sellPct / 100;
  const first = steps[0].price;
  let cash = s.amount, btc = 0, ref = first, lot = null;
  let buys = 0, sells = 0, skipped = 0, feesPaid = 0, peak = s.amount, worst = 0, best = s.amount;
  const events = [], frames = [];
  for (let i = 0; i < steps.length; i++) {
    const { date, price } = steps[i];
    if (s.strategy === 'hold' || s.strategy === 'cashin') {
      if (i === 0) {
        const qty = s.amount * (1 - fee) / price;
        cash = 0; btc = qty; buys = 1; feesPaid += s.amount * fee;
        events.push({ i, date, side: 'BUY', price, gbp: s.amount, btc: qty });
      } else if (s.strategy === 'cashin' && btc * price >= s.cashAt * s.amount - 1e-9) {
        // pick apples: sell what you planted (at today's price) and put it in your pocket; the rest keeps growing
        const qty = Math.min(btc, s.amount / price), gross = qty * price, net = gross * (1 - fee);
        btc = Math.max(0, btc - qty); cash += net; feesPaid += gross - net; sells++;
        events.push({ i, date, side: 'SELL', price, gbp: net, btc: qty });
      }
    } else if (lot && price >= lot.price * (1 + s.risePct / 100) - 1e-9) {
      const qty = Math.min(btc, lot.btc * sellFrac), gross = qty * price, net = gross * (1 - fee);
      btc = Math.max(0, btc - qty); cash += net; feesPaid += gross - net; sells++;
      events.push({ i, date, side: 'SELL', price, gbp: net, btc: qty });
      lot = null; ref = price;
    } else if (!lot && price <= ref * (1 - s.dipPct / 100) + 1e-9) {
      if (cash + 1e-9 >= buyAmount) {
        const qty = buyAmount * (1 - fee) / price;
        cash = Math.max(0, cash - buyAmount); btc += qty; feesPaid += buyAmount * fee; buys++;
        events.push({ i, date, side: 'BUY', price, gbp: buyAmount, btc: qty });
        lot = { price, btc: qty }; ref = price;
      } else { skipped++; }
    }
    const total = cash + btc * price;
    const hold = s.amount * (1 - fee) * price / first;
    peak = Math.max(peak, total); best = Math.max(best, total);
    worst = Math.max(worst, 100 * (peak - total) / peak);
    frames.push({ i, date, price, cash, btc, total, hold, buys, sells, events: events.length });
  }
  const last = frames.at(-1);
  const summary = {
    start: s.amount, end: last.total, profit: last.total - s.amount, pct: 100 * (last.total / s.amount - 1),
    buys, sells, skippedBuys: skipped, feesPaid, best, maxDrawdown: worst,
    hold: last.hold, holdProfit: last.hold - s.amount, holdPct: 100 * (last.hold / s.amount - 1),
    vsHold: last.total - last.hold, cash: last.cash, btc: last.btc,
    from: steps[0].date, to: last.date, days: dayNumber(last.date) - dayNumber(steps[0].date)
  };
  return { settings: s, frames, events, summary };
}

// ---------- plant growth ----------
export const STAGES = Object.freeze(['Shoot', 'Small tree', 'Oak']);
/** Lowest pot ratio (value / starting pot) for stages 1-2. Below the first it is still a little shoot. */
export const STAGE_RATIOS = Object.freeze([1.2, 2]);
/** Milestones (x what you planted). Each one, once passed, ripens a coin that drops from the leaves to the ground. */
export const MILESTONES = Object.freeze([1.1, 1.25, 1.5, 2, 3, 5, 10, 25]);
/** How many milestone coins are on the ground for a pot worth `ratio` times what was planted. */
export function coinsFor(ratio) {
  if (!Number.isFinite(ratio)) return 0;
  return MILESTONES.filter(m => ratio >= m).length;
}

/**
 * Map the pot's value to a plant: a shoot, a small tree, then an oak. The plant follows the money, never the calendar:
 * a pot that has lost value stays a drooping shoot and a pot worth 3x what was planted is an oak.
 * `droop` (0-1) rises as the pot falls below what was planted.
 */
export function plantFor(ratio, started = true) {
  if (!started || !Number.isFinite(ratio)) return { stage: 0, droop: 0, name: STAGES[0] };
  let stage = 0;
  STAGE_RATIOS.forEach((min, k) => { if (ratio >= min) stage = k + 1; });
  const droop = ratio < 0.995 ? Math.min(1, (1 - ratio) / 0.25) : 0;
  return { stage, droop, name: STAGES[stage] };
}

// ---------- formatting helpers (shared by page and tests) ----------
export function formatGBP(n) {
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
export function signedGBP(n) { return (n > 0.004 ? '+' : n < -0.004 ? '−' : '') + formatGBP(Math.abs(n)); }
export function signedPct(n) { return (n > 0.004 ? '+' : n < -0.004 ? '−' : '') + Math.abs(n).toFixed(1) + '%'; }
