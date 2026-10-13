import test from 'node:test';
import assert from 'node:assert/strict';
import { percentile, windowRatios, forecast, describe, changeSince, HORIZONS, MIN_SAMPLES } from '../forecast-engine.js';
import { parseKraken, parseCoinGecko } from '../live-price.js';
import { addDays, formatGBP } from '../time-machine-engine.js';

const series = (prices, start = '2015-01-01') => prices.map((price, i) => ({ date: addDays(start, i), price }));
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} vs ${b}`);

test('percentile interpolates and handles edges', () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0), 1); assert.equal(percentile([1, 2, 3, 4, 5], 100), 5);
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3); near(percentile([10, 20], 25), 12.5);
  assert.ok(Number.isNaN(percentile([], 50)));
});
test('windowRatios counts genuine d-day windows from the start date only', () => {
  const pts = series([1, 2, 4, 8, 16, 32]);
  assert.deepEqual(windowRatios(pts, 2, '2015-01-01'), [4, 4, 4, 4]);
  assert.deepEqual(windowRatios(pts, 2, '2015-01-03'), [4, 4]);
  assert.deepEqual(windowRatios(pts, 9, '2015-01-01'), []);
  const holed = [...series([1, 1, 1]), { date: '2015-01-10', price: 5 }, { date: '2015-01-11', price: 5 }];
  assert.equal(windowRatios(holed, 1, '2015-01-01').length, 3); // the gap-spanning pairs are skipped
});
test('constant prices: every band equals the amount planted', () => {
  const pts = series(Array(900).fill(100));
  const f = forecast(pts, { amount: 250, horizonDays: 30, since: '2015-01-01' });
  for (const r of f.fan) for (const k of ['p10', 'p25', 'p50', 'p75', 'p90']) near(r[k], 250);
  assert.equal(f.end.upShare, 0); assert.equal(f.end.lossShare, 0);
});
test('steady 1% daily growth gives exact compounding bands and bands are ordered', () => {
  const pts = series(Array.from({ length: 800 }, (_, i) => 100 * Math.pow(1.01, i)));
  const f = forecast(pts, { amount: 100, horizonDays: 30, since: '2015-01-01' });
  near(f.end.p50, 100 * Math.pow(1.01, 30), 1e-6); near(f.end.p10, f.end.p90, 1e-6);
  assert.equal(f.end.upShare, 1);
});
test('random walk: bands are ordered, start at the amount, widen over time and use the right count', () => {
  let seed = 3; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let p = 100; const pts = series(Array.from({ length: 3000 }, () => (p *= 1 + (rnd() - 0.5) * 0.08)));
  const f = forecast(pts, { amount: 100, horizonDays: HORIZONS.year, since: '2015-01-01' });
  assert.equal(f.fan[0].day, 0); assert.equal(f.fan[0].p50, 100); assert.equal(f.fan.at(-1).day, 365);
  for (const r of f.fan) { assert.ok(r.p10 <= r.p25 && r.p25 <= r.p50 && r.p50 <= r.p75 && r.p75 <= r.p90, JSON.stringify(r)); }
  assert.ok(f.fan.at(-1).p90 - f.fan.at(-1).p10 > f.fan[5].p90 - f.fan[5].p10, 'range widens with time');
  assert.equal(f.end.samples, 3000 - 365);
  near(f.end.upShare + f.end.lossShare + (1 - f.end.upShare - f.end.lossShare), 1);
  assert.ok(f.end.worst <= f.end.p10 && f.end.best >= f.end.p90);
});
test('forecast scales linearly with the amount', () => {
  let p = 100; let s = 9; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const pts = series(Array.from({ length: 1500 }, () => (p *= 1 + (rnd() - 0.5) * 0.06)));
  const a = forecast(pts, { amount: 100, horizonDays: 90, since: '2015-01-01' }), b = forecast(pts, { amount: 7, horizonDays: 90, since: '2015-01-01' });
  near(a.end.p50 / 100, b.end.p50 / 7, 1e-9);
});
test('forecast refuses bad inputs and thin history instead of guessing', () => {
  const pts = series(Array(900).fill(100));
  assert.throws(() => forecast(pts, { amount: 0 }), /above/);
  assert.throws(() => forecast(pts, { amount: NaN }), /above/);
  assert.throws(() => forecast(pts, { amount: 100, horizonDays: 3 }), /between/);
  assert.throws(() => forecast(series(Array(200).fill(1)), { amount: 100, horizonDays: 365, since: '2015-01-01' }), /Not enough/);
  assert.throws(() => forecast(pts, { amount: 100, horizonDays: 365, since: '2016-12-01' }), /Not enough/); // too few windows after 'since'
  assert.ok(MIN_SAMPLES > 0);
});
test('describe produces plain English with the real numbers', () => {
  const pts = series(Array.from({ length: 900 }, (_, i) => 100 + (i % 50)));
  const f = forecast(pts, { amount: 100, horizonDays: 365, since: '2015-01-01' });
  const d = describe(f, formatGBP);
  assert.match(d.headline, /8 out of 10 past/);
  assert.match(d.headline, /£100\.00 ended up somewhere between/); assert.match(d.up, /of every 100/);
  assert.equal(describe(forecast(pts, { amount: 100, horizonDays: 30, since: '2015-01-01' }), formatGBP).headline.includes('past months'), true);
  assert.match(d.headline, /past 1-year stretches/); assert.match(d.caution, /about 2 completely separate 1-year stretches|completely separate/);
  assert.equal(describe(forecast(pts, { amount: 100, horizonDays: 365, since: '2015-01-01' }), formatGBP).separate, Math.floor(f.spanDays / 365));
});
test('changeSince compares live price with the same day in the past', () => {
  const pts = series(Array.from({ length: 400 }, (_, i) => 100 + i));
  const c = changeSince(pts, 7, 600);
  assert.equal(c.ref.date, addDays(pts.at(-1).date, -7)); near(c.pct, 100 * (600 / c.ref.price - 1));
  assert.equal(changeSince(pts, 1000, 600), null); assert.equal(changeSince([], 7, 5), null); assert.equal(changeSince(pts, 7, NaN), null);
});
test('Kraken and CoinGecko responses are parsed; errors and junk are rejected', () => {
  const k = parseKraken({ error: [], result: { XXBTZGBP: { c: ['62000.5', '0.1'], o: '61000.0' } } });
  near(k.price, 62000.5); near(k.changePct, 100 * (62000.5 / 61000 - 1)); assert.equal(k.source, 'Kraken');
  assert.throws(() => parseKraken({ error: ['EQuery:Unknown asset pair'], result: {} }));
  assert.throws(() => parseKraken({ error: [], result: { X: { c: ['abc'] } } })); assert.throws(() => parseKraken(null));
  const g = parseCoinGecko({ bitcoin: { gbp: 61999, gbp_24h_change: -2.5 } });
  near(g.price, 61999); near(g.changePct, -2.5); assert.equal(parseCoinGecko({ bitcoin: { gbp: 5 } }).changePct, null);
  assert.throws(() => parseCoinGecko({})); assert.throws(() => parseCoinGecko({ bitcoin: { gbp: 0 } }));
});

// ---------- v1.11.4 chart ranges ----------
import { RANGES, RANGE_ORDER, historySeries, changeOver, trimToWindow, downsample } from '../price-ranges.js';
import { parseKrakenOHLC, parseCoinGeckoChart } from '../live-price.js';
test('range tabs: 1H, 24H, 1W, 1M, 1Y, All in order', () => {
  assert.deepEqual(RANGE_ORDER.map(k => RANGES[k].label), ['1H', '24H', '1W', '1M', '1Y', 'All']);
});
test('historySeries and changeOver', () => {
  const pts = series(Array.from({ length: 400 }, (_, i) => 100 + i));
  assert.equal(historySeries(pts, '1w').length, 8);
  assert.equal(historySeries(pts, '1y').length, 366);
  const c = changeOver(historySeries(pts, '1w')); near(c.pct, 100 * (499 / 492 - 1), 1e-9);
  assert.equal(changeOver([{ x: 1, v: 1 }]), null);
});
test('trimToWindow and downsample', () => {
  const s = Array.from({ length: 1000 }, (_, i) => ({ x: i * 60000, v: i + 1 }));
  assert.equal(trimToWindow(s, 3600e3).length, 61);
  const d = downsample(s, 100); assert.equal(d.length, 100); assert.equal(d[0], s[0]); assert.equal(d.at(-1), s.at(-1));
});
test('candle parsers', () => {
  const k = parseKrakenOHLC({ error: [], result: { XXBTZGBP: [[1000, '1', '2', '0', '5'], [1060, '1', '2', '0', '6'], [1120, '1', '2', '0', '7']], last: 1 } }, 2);
  assert.deepEqual(k, [{ x: 1060000, v: 6 }, { x: 1120000, v: 7 }]);
  assert.deepEqual(parseCoinGeckoChart({ prices: [[1000, 5], [2000, 6]] }), [{ x: 1000, v: 5 }, { x: 2000, v: 6 }]);
  assert.throws(() => parseKrakenOHLC({ error: ['x'] }, 5)); assert.throws(() => parseCoinGeckoChart({}));
});
