// The Bitcoin Garden — "weather forecast" engine. Pure arithmetic on historical prices.
// It does NOT predict the price. It answers: "in the past, after an amount was planted, how
// did the value look N days later?" and reports the spread of what really happened.
import { dayNumber, addDays, simulate } from './time-machine-engine.js';

export const HORIZONS = Object.freeze({ month: 30, year: 365, fiveYears: 1825 });
export const MIN_SAMPLES = 150;

/** Linear-interpolated percentile (p in 0-100) of an ascending-sorted array. */
export function percentile(sorted, p) {
  if (!sorted.length) return NaN;
  const idx = (sorted.length - 1) * p / 100, lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** All d-day growth ratios (later price / earlier price) for windows that start on or after `since`. */
export function windowRatios(points, d, since) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    if (points[i].date < since) continue;
    const j = i + d;
    if (j >= points.length) break;
    if (dayNumber(points[j].date) - dayNumber(points[i].date) !== d) continue; // only genuine d-day windows
    out.push(points[j].price / points[i].price);
  }
  return out;
}

/**
 * Range of outcomes from history.
 * Returns bands (10th/25th/50th/75th/90th percentile) of the pot's value for planting `amount` today,
 * at ~`steps` points between now and `horizonDays`, plus the share of past windows that ended higher.
 */
export function forecast(points, { amount = 100, horizonDays = 365, since = '2014-01-01', steps = 48 } = {}) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter an amount above £0.');
  if (!Number.isInteger(horizonDays) || horizonDays < 7 || horizonDays > 3650) throw new Error('Please choose a period between a week and ten years.');
  const fan = [{ day: 0, p10: amount, p25: amount, p50: amount, p75: amount, p90: amount }];
  let final = null;
  const days = new Set();
  for (let k = 1; k <= steps; k++) days.add(Math.max(1, Math.round(horizonDays * k / steps)));
  for (const d of [...days].sort((a, b) => a - b)) {
    const r = windowRatios(points, d, since).sort((a, b) => a - b);
    if (r.length < MIN_SAMPLES) throw new Error('Not enough price history for that period. Try a shorter period or an earlier "history since" choice.');
    const row = { day: d, p10: amount * percentile(r, 10), p25: amount * percentile(r, 25), p50: amount * percentile(r, 50), p75: amount * percentile(r, 75), p90: amount * percentile(r, 90) };
    fan.push(row);
    if (d === horizonDays) final = { ...row, samples: r.length, best: amount * r.at(-1), worst: amount * r[0], upShare: r.filter(x => x > 1).length / r.length, lossShare: r.filter(x => x < 1).length / r.length, halvedShare: r.filter(x => x < 0.5).length / r.length };
  }
  const first = points.find(p => p.date >= since);
  return { amount, horizonDays, since, fan, end: final, spanDays: first ? dayNumber(points.at(-1).date) - dayNumber(first.date) : 0 };
}

/** Plain-English summary of a forecast result. `fmt` formats pounds. */
export function describe(f, fmt) {
  const e = f.end, H = f.horizonDays;
  const unit = H === 30 ? 'months' : H % 365 === 0 ? (H / 365) + '-year stretches' : H + '-day stretches';
  const spanDays = f.spanDays ?? 0, separate = Math.floor(spanDays / H);
  const noun = H === 30 ? 'month' : H % 365 === 0 ? (H / 365) + '-year stretch' : H + '-day stretch';
  return {
    headline: 'In 8 out of 10 past ' + unit + ', ' + fmt(f.amount) + ' ended up somewhere between ' + fmt(e.p10) + ' and ' + fmt(e.p90) + '.',
    middle: 'The middle of the range was ' + fmt(e.p50) + '.',
    up: 'It finished higher in ' + Math.round(e.upShare * 100) + ' of every 100 periods and lower in ' + Math.round(e.lossShare * 100) + '.',
    extremes: 'The very best past period ended at ' + fmt(e.best) + ' and the very worst at ' + fmt(e.worst) + '.',
    caution: 'Careful: this uses every starting day, but neighbouring days overlap. There ' + (separate === 1 ? 'is' : 'are') + ' only about ' + separate + ' completely separate ' + (separate === 1 ? noun : noun + (noun.endsWith('stretch') ? 'es' : 's')) + ' in the history used' + (separate < 20 ? ', so for this period treat it as a very rough guide.' : '.'),
    samples: e.samples, separate
  };
}

export const SINCE_CHOICES = Object.freeze({ all: '2014-01-01', y2017: '2017-01-01', y2020: '2020-01-01' });
export { addDays };

/** % change from `days` days before the newest historical day to `price` (the live price). null if no suitable day. */
export function changeSince(points, days, price) {
  if (!points.length || !Number.isFinite(price)) return null;
  const target = addDays(points.at(-1).date, -days);
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].date <= target) return dayNumber(target) - dayNumber(points[i].date) <= 3 ? { pct: 100 * (price / points[i].price - 1), ref: points[i] } : null;
  }
  return null;
}

/**
 * Turn one band of the forecast (p10 = rough patch, p50 = typical, p90 = good run) into smooth "frames" for the garden to play:
 * `n` points from today to the end of the period, each {date, total, sells:0, events:0}. Straight-line steps between the forecast's own points.
 */
export function futureFrames(fan, key, today, n = 120) {
  if (!fan?.length || !['p10', 'p25', 'p50', 'p75', 'p90'].includes(key)) throw new Error('Unknown forecast band.');
  const H = fan.at(-1).day, out = [];
  for (let i = 0; i < n; i++) {
    const day = H * i / (n - 1);
    let k = 1; while (k < fan.length - 1 && fan[k].day < day) k++;
    const a = fan[k - 1], b = fan[k], t = b.day === a.day ? 1 : Math.min(1, Math.max(0, (day - a.day) / (b.day - a.day)));
    out.push({ i, date: addDays(today, Math.round(day)), total: a[key] + (b[key] - a[key]) * t, sells: 0, events: 0 });
  }
  return out;
}

/**
 * "Cash in" forecast: what would pruning have done over the next `horizonDays`?
 * For every past planting day (since `since`) we replay the real prices that followed, with the cash-in rule
 * (sell `amount` of Bitcoin each time the pot's Bitcoin is worth `cashAt` x what you planted) and with simply holding.
 * The three gardens are real past stretches, picked by their cash-in result: a rough patch (10th), a typical one (50th) and a good one (90th).
 * They are re-dated to start today. Still history, not a prediction.
 */
export function cashInForecast(points, { amount = 100, horizonDays = 365, since = '2014-01-01', cashAt = 2, feePct = 0.4 } = {}, today = new Date().toISOString().slice(0, 10)) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Please enter an amount above £0.');
  if (!Number.isInteger(horizonDays) || horizonDays < 7 || horizonDays > 3650) throw new Error('Please choose a period between a week and ten years.');
  const fee = feePct / 100, stride = Math.max(1, Math.round(horizonDays / 365)), runs = [];
  for (let i = 0; i < points.length; i += stride) {
    if (points[i].date < since) continue;
    const j = i + horizonDays;
    if (j >= points.length) break;
    if (dayNumber(points[j].date) - dayNumber(points[i].date) !== horizonDays) continue;
    // light version of simulate(): same arithmetic, no frames
    let btc = amount * (1 - fee) / points[i].price, cash = 0, sells = 0;
    for (let k = i + 1; k <= j; k++) {
      const price = points[k].price;
      if (btc * price >= cashAt * amount - 1e-9) { const q = Math.min(btc, amount / price), net = q * price * (1 - fee); btc -= q; cash += net; sells++; }
    }
    const last = points[j].price;
    runs.push({ i, j, end: cash + btc * last, hold: amount * (1 - fee) * last / points[i].price, sells });
  }
  if (runs.length < 40) throw new Error('Not enough price history for that period. Try a shorter period or an earlier "history since" choice.');
  const byEnd = [...runs].sort((a, b) => a.end - b.end), pick = p => byEnd[Math.round((byEnd.length - 1) * p / 100)];
  const beds = {};
  for (const [key, p] of [['p10', 10], ['p50', 50], ['p90', 90]]) {
    const r = pick(p), steps = points.slice(r.i, r.j + 1);
    const sim = simulate(steps, { strategy: 'cashin', amount, cashAt, feePct });
    const d0 = dayNumber(steps[0].date);
    const frames = sim.frames.map(f => ({ ...f, date: addDays(today, dayNumber(f.date) - d0) }));
    beds[key] = { sim: { ...sim, frames }, hold: sim.summary.hold, pastFrom: steps[0].date, pastTo: steps.at(-1).date };
  }
  const ends = byEnd.map(r => r.end), holds = runs.map(r => r.hold).sort((a, b) => a - b);
  return {
    amount, horizonDays, since, cashAt, samples: runs.length, beds,
    cashIn: { p10: percentile(ends, 10), p50: percentile(ends, 50), p90: percentile(ends, 90) },
    holding: { p10: percentile(holds, 10), p50: percentile(holds, 50), p90: percentile(holds, 90) },
    aheadShare: runs.filter(r => r.end > r.hold + 1e-9).length / runs.length,
    pickedShare: runs.filter(r => r.sells > 0).length / runs.length
  };
}
