// Bitcoin Grower — "weather forecast" engine (v1.9.1). Pure arithmetic on historical prices.
// It does NOT predict the price. It answers: "in the past, after an amount was planted, how
// did the value look N days later?" and reports the spread of what really happened.
import { dayNumber, addDays } from './time-machine-engine.js';

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
  return {
    headline: 'In 8 out of 10 past ' + unit + ', ' + fmt(f.amount) + ' ended up somewhere between ' + fmt(e.p10) + ' and ' + fmt(e.p90) + '.',
    middle: 'The middle of the range was ' + fmt(e.p50) + '.',
    up: 'It finished higher in ' + Math.round(e.upShare * 100) + ' of every 100 periods and lower in ' + Math.round(e.lossShare * 100) + '.',
    extremes: 'The very best past period ended at ' + fmt(e.best) + ' and the very worst at ' + fmt(e.worst) + '.',
    caution: 'Careful: this uses every starting day, but neighbouring days overlap. There are only about ' + separate + ' completely separate ' + (H === 30 ? 'months' : unit) + ' in the history used' + (separate < 20 ? ', so for this period treat it as a very rough guide.' : '.'),
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
