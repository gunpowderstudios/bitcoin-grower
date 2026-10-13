// The Bitcoin Garden — what the little gardener says (v1.13.1). Pure text helpers, no DOM, no network.
// Plain English only: it explains what the strategy is doing, never tells anyone what to buy or sell.
import { formatGBP } from './time-machine-engine.js';

const pct = n => Math.max(1, Math.round(Math.abs(n))) + '%';
const share = p => p >= 100 ? 'all of it' : p === 50 ? 'half of it' : p === 25 ? 'a quarter of it' : Math.round(p) + '% of it';

export function startLine({ amount, fromLabel }) {
  return 'Hello! I’m planting ' + formatGBP(amount).replace(/\.00$/, '') + ' on ' + fromLabel + '. I’ll plant a little more when the price drops, and sell some when it rises.';
}
export function buyLine({ price, prevPrice, amount }) {
  const drop = prevPrice > 0 ? 100 * (1 - price / prevPrice) : NaN;
  return 'The price has dropped about ' + (Number.isFinite(drop) && drop > 0 ? pct(drop) : '5%') + ' since my last move, so I’m planting ' + formatGBP(amount).replace(/\.00$/, '') + ' of Bitcoin while it’s cheaper.';
}
export function sellLine({ price, buyPrice, sellPct, gbp }) {
  const rise = buyPrice > 0 ? 100 * (price / buyPrice - 1) : NaN;
  return 'It’s up about ' + (Number.isFinite(rise) && rise > 0 ? pct(rise) : '10%') + ' on what I planted, so I’m selling ' + share(sellPct) + ' and banking ' + formatGBP(gbp) + '.' + (sellPct >= 100 ? '' : ' The rest keeps growing.');
}
/** Milestones for the whole pot. `seen` is a Set of keys already said this journey. Returns text or null. */
export function moodLine({ ratio, prevRatio, seen }) {
  const once = (k, text) => (seen.has(k) ? null : (seen.add(k), text));
  if (!Number.isFinite(ratio)) return null;
  if (ratio >= 5) { const t = once('x5', 'Wow, the pot is five times what we planted! Bitcoin has done that, but it’s never guaranteed.'); if (t) return t; }
  if (ratio >= 2) { const t = once('x2', 'The pot has doubled! Good weather, but remember it can turn.'); if (t) return t; }
  if (ratio <= 0.5) { const t = once('half', 'Ouch, a proper storm: the pot has lost half its value. Bitcoin can fall this far, and it might not come back.'); if (t) return t; }
  if (ratio <= 0.8) { const t = once('drop', 'Storm clouds! The pot is down about ' + pct(100 * (1 - ratio)) + '. Dips like this happen. Sometimes the plant recovers, sometimes not.'); if (t) return t; }
  if (ratio >= 1 && seen.has('drop') && prevRatio < 1) { const t = once('recover', 'The sun’s back out. The pot has climbed back to where it started.'); if (t) return t; }
  return null;
}
export function endLine(summary) {
  const up = summary.profit > 0.004, down = summary.profit < -0.004;
  const end = formatGBP(summary.end);
  return up ? 'We made it to today! The pot ended at ' + end + '. Scroll down to see how that compares with simply buying and holding.'
    : down ? 'We made it to today, but the pot ended at ' + end + ', below what we planted. That can happen with Bitcoin.' : 'We made it to today and ended almost exactly where we started.';
}
