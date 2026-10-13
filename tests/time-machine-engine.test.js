import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  VERSION, DEFAULTS, parseCSV, describeData, validateSettings, selectRange, simulate, plantFor,
  addDays, addYears, isRealDate, signedGBP, signedPct, formatGBP
} from '../time-machine-engine.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
const series = (prices, start = '2024-01-01') => prices.map((price, i) => ({ date: addDays(start, i), price }));

// ---------- data loading ----------
test('parseCSV reads Date and BTC_GBP from a multi-currency file, in any order, with quotes and BOM', () => {
  const csv = '﻿"Date","BTC_USD","BTC_GBP"\n"2024-01-03",120,100\n2024-01-01,100,80\n2024-01-02,110,90\n';
  const pad = Array.from({ length: 40 }, (_, i) => `${addDays('2024-02-01', i)},1,50`).join('\n');
  const { points } = parseCSV(csv + pad);
  assert.equal(points[0].date, '2024-01-01'); assert.equal(points[0].price, 80); assert.equal(points[2].price, 100);
  assert.ok(points.every((p, i) => i === 0 || p.date > points[i - 1].date), 'sorted ascending');
});
test('parseCSV drops bad rows, counts them and never invents prices', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `${addDays('2024-01-01', i)},${100 + i}`);
  const bad = ['2024-13-45,100', '2024-02-30,100', 'hello,100', '2024-03-01,', '2024-03-02,-5', '2024-03-03,abc', '2024-03-04,0'];
  const { points, rejected } = parseCSV('Date,BTC_GBP\n' + [...rows, ...bad].join('\n'));
  assert.equal(points.length, 40); assert.equal(rejected, bad.length);
});
test('parseCSV keeps the last value for a repeated date and reports duplicates', () => {
  const rows = Array.from({ length: 40 }, (_, i) => `${addDays('2024-01-01', i)},${100 + i}`);
  const { points, duplicates } = parseCSV('Date,BTC_GBP\n' + [...rows, '2024-01-01,555'].join('\n'));
  assert.equal(points.length, 40); assert.equal(points[0].price, 555); assert.equal(duplicates, 1);
});
test('parseCSV rejects wrong currency, empty and tiny files', () => {
  assert.throws(() => parseCSV('Date,BTC_USD\n2024-01-01,5'), /BTC_GBP/);
  assert.throws(() => parseCSV(''), /empty/);
  assert.throws(() => parseCSV('Date,BTC_GBP\n2024-01-01,5'), /Too few/);
});
test('describeData finds coverage and gaps', () => {
  const pts = [...series(Array(10).fill(1)), ...series(Array(10).fill(1), '2024-01-16')];
  const d = describeData(pts);
  assert.equal(d.first, '2024-01-01'); assert.equal(d.last, '2024-01-25'); assert.equal(d.gaps.length, 1);
  assert.deepEqual(d.gaps[0], { from: '2024-01-10', to: '2024-01-16', days: 5 }); assert.equal(d.maxGap, 5);
});
test('date helpers', () => {
  assert.ok(isRealDate('2024-02-29')); assert.ok(!isRealDate('2023-02-29')); assert.ok(!isRealDate('2024-1-1'));
  assert.equal(addYears('2024-02-29', -1), '2023-02-28'); assert.equal(addDays('2024-12-31', 1), '2025-01-01');
});

// ---------- choosing a journey ----------
test('selectRange validates dates and refuses to bridge missing data', () => {
  const pts = series(Array(60).fill(10));
  assert.equal(selectRange(pts, '2024-01-01').length, 60);
  assert.equal(selectRange(pts, '2024-01-10', '2024-01-20').length, 11);
  assert.throws(() => selectRange(pts, '2023-12-01'), /starts on 2024-01-01/);
  assert.throws(() => selectRange(pts, '2030-01-01'), /future/);
  assert.throws(() => selectRange(pts, '2024-02-01', '2024-01-05'), /before the end/);
  assert.throws(() => selectRange(pts, '2024-01-01', '2024-01-04'), /at least a week/);
  assert.throws(() => selectRange(pts, ''), /choose a date/i);
  assert.throws(() => selectRange(pts, 'banana'), /choose a date/i);
  assert.throws(() => selectRange([], '2024-01-01'), /not loaded/);
  const holed = [...series(Array(20).fill(10)), ...series(Array(20).fill(10), '2024-02-01')];
  assert.throws(() => selectRange(holed, '2024-01-01', '2024-02-20'), /missing between/);
  assert.equal(selectRange(holed, '2024-02-01', '2024-02-20').length, 20); // a clean window is fine
});
test('selectRange tolerates a weekend-sized hole at the start but not a big one', () => {
  const small = [...series(Array(3).fill(10)), ...series(Array(40).fill(10), '2024-01-06')]; // 2 missing days (4th, 5th)
  assert.equal(selectRange(small, '2024-01-04')[0].date, '2024-01-06');
  const big = [...series(Array(3).fill(10)), ...series(Array(40).fill(10), '2024-01-10')];  // 6 missing days
  assert.throws(() => selectRange(big, '2024-01-04', '2024-02-05'), /no price data near/);
});

// ---------- settings ----------
test('validateSettings applies defaults and rejects nonsense', () => {
  assert.deepEqual(validateSettings({}), DEFAULTS);
  for (const bad of [{ amount: 0 }, { amount: -5 }, { amount: NaN }, { amount: 2e6 }, { buyPct: 0 }, { buyPct: 101 }, { dipPct: 0 }, { dipPct: 95 },
    { risePct: 0 }, { sellPct: 0 }, { sellPct: 101 }, { feePct: -1 }, { feePct: 11 }, { amount: 'abc' }])
    assert.throws(() => validateSettings(bad), /Please|must be/, JSON.stringify(bad));
  assert.equal(validateSettings({ amount: 1 }).amount, 1);
});

// ---------- the Grower strategy: hand-calculated ----------
test('simulate matches a hand calculation (buy the dip, harvest the rise, reset reference, fees)', () => {
  const steps = series([100, 100, 94, 94, 103.4, 100, 98, 98, 120]);
  const { frames, events, summary } = simulate(steps, DEFAULTS);
  const fee = 0.004;
  // day 2: price 94 <= 100*0.95 -> buy £10
  const q1 = 10 * (1 - fee) / 94;
  assert.deepEqual(events.map(e => e.side + '@' + e.date.slice(8)), ['BUY@03', 'SELL@05', 'BUY@07', 'SELL@09']);
  near(events[0].btc, q1); assert.equal(events[0].gbp, 10);
  near(frames[2].cash, 90); near(frames[2].btc, q1);
  // day 4: 103.4 = 94*1.10 -> harvest 50% of that purchase
  const sold = q1 / 2, net = sold * 103.4 * (1 - fee);
  near(events[1].btc, sold); near(events[1].gbp, net);
  near(frames[4].cash, 90 + net); near(frames[4].btc, q1 - sold);
  // reference price is now the harvest price 103.4: day 5 (100) is only -3.3%, day 6 (98) is -5.2% -> buy
  assert.equal(frames[5].buys, 1); assert.equal(frames[6].buys, 2);
  const q2 = 10 * (1 - fee) / 98;
  near(events[2].btc, q2);
  near(frames[6].cash, 90 + net - 10); near(frames[6].btc, q1 - sold + q2);
  // final day price 120: lot2 bought at 98 -> 98*1.1=107.8 <= 120 -> harvest half
  assert.equal(frames.at(-1).sells, 2);
  const last = frames.at(-1);
  near(last.total, last.cash + last.btc * 120);
  near(summary.end, last.total); near(summary.profit, last.total - 100); near(summary.pct, last.total - 100);
  assert.equal(summary.buys, 2); assert.equal(summary.sells, 2);
});
test('buy-and-hold comparison includes the same one-off fee', () => {
  const steps = series([200, 210, 220, 230, 240, 250, 260, 270, 300]);
  const { frames, summary } = simulate(steps, { amount: 1000, feePct: 0.4 });
  near(frames[0].hold, 1000 * 0.996);
  near(summary.hold, 1000 * 0.996 * 300 / 200);
  near(summary.holdPct, 100 * (0.996 * 1.5 - 1));
  near(summary.vsHold, summary.end - summary.hold);
});
test('every harvest sells only a share of its own purchase and never touches other bitcoin', () => {
  const steps = series([100, 90, 110, 100, 90, 120]);
  const { events, frames } = simulate(steps, { amount: 100, sellPct: 100 });
  const buys = events.filter(e => e.side === 'BUY'), sells = events.filter(e => e.side === 'SELL');
  assert.equal(buys.length, 2); assert.equal(sells.length, 2);
  sells.forEach((s, i) => near(s.btc, buys[i].btc)); // 100% of the purchase
  near(frames.at(-1).btc, 0, 1e-12);
});
test('only one purchase is open at a time; cash runs out gracefully', () => {
  // falling forever: one buy, never a second while the first is still open
  const falling = series(Array.from({ length: 40 }, (_, i) => 100 * Math.pow(0.97, i)));
  const r = simulate(falling, DEFAULTS);
  assert.equal(r.summary.buys, 1); assert.equal(r.summary.sells, 0);
  // saw-tooth with a huge buy size runs out of cash and records skipped buys
  const saw = series(Array.from({ length: 80 }, (_, i) => [100, 100, 92, 98][i % 4]));
  const s = simulate(saw, { amount: 100, buyPct: 60, risePct: 5, sellPct: 10 }); // harvesting 10% leaves too little cash for another £60 buy
  assert.equal(s.summary.buys, 1); assert.ok(s.summary.skippedBuys > 0);
  assert.ok(s.frames.every(f => f.cash >= -1e-9));
});

// ---------- market shapes ----------
test('rising market: nothing to buy, pot stays at the amount planted while buy-and-hold climbs', () => {
  const r = simulate(series(Array.from({ length: 60 }, (_, i) => 100 + i * 2)), DEFAULTS);
  assert.equal(r.summary.buys, 0); near(r.summary.end, 100); near(r.summary.profit, 0);
  assert.ok(r.summary.hold > 100);
});
test('falling market: pot loses less than buy-and-hold, plant must not look rich', () => {
  const r = simulate(series(Array.from({ length: 60 }, (_, i) => 100 - i)), DEFAULTS);
  assert.ok(r.summary.end < 100 && r.summary.end > r.summary.hold);
  assert.ok(plantFor(r.summary.end / 100).stage <= 2);
});
test('sideways market inside the buy band: no trades, no change', () => {
  const r = simulate(series(Array.from({ length: 60 }, (_, i) => 100 + (i % 2 ? 2 : -2))), DEFAULTS);
  assert.equal(r.events.length, 0); near(r.summary.pct, 0);
});
test('volatile market: repeated buys and harvests, and the result equals the ledger', () => {
  const r = simulate(series(Array.from({ length: 200 }, (_, i) => 100 + 25 * Math.sin(i / 3))), DEFAULTS);
  assert.ok(r.summary.buys > 3 && r.summary.sells > 3);
  const last = r.frames.at(-1);
  near(r.summary.end, last.cash + last.btc * last.price, 1e-9);
  assert.ok(r.summary.feesPaid > 0);
});

// ---------- invariants on random walks ----------
test('invariants hold on many random price paths and settings (money is conserved)', () => {
  let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let n = 0; n < 200; n++) {
    let p = 50 + rnd() * 500; const prices = [];
    for (let i = 0; i < 30 + Math.floor(rnd() * 400); i++) { p = Math.max(0.5, p * (1 + (rnd() - 0.5) * 0.14)); prices.push(p); }
    const set = { amount: [1, 10, 100, 12345][n % 4], buyPct: 1 + rnd() * 60, dipPct: 1 + rnd() * 15, risePct: 1 + rnd() * 30, sellPct: 1 + rnd() * 99, feePct: rnd() * 2 };
    const { frames, events, summary, settings } = simulate(series(prices), set);
    let spent = 0, got = 0;
    for (const e of events) e.side === 'BUY' ? spent += e.gbp : got += e.gbp;
    const last = frames.at(-1);
    near(last.cash, settings.amount - spent + got, 1e-6 * settings.amount + 1e-9);
    near(last.total, last.cash + last.btc * last.price, 1e-9 * last.total + 1e-9);
    assert.ok(frames.every(f => f.cash >= -1e-9 && f.btc >= -1e-12 && Number.isFinite(f.total)));
    assert.ok(frames.every((f, i) => i === 0 || (f.buys >= frames[i - 1].buys && f.sells >= frames[i - 1].sells)));
    assert.equal(summary.buys, events.filter(e => e.side === 'BUY').length);
    assert.equal(summary.sells, events.filter(e => e.side === 'SELL').length);
    assert.ok(summary.maxDrawdown >= 0 && summary.maxDrawdown <= 100);
    // with zero fee and no trades the pot is exactly what was planted
    if (!events.length) near(last.total, settings.amount, 1e-9);
  }
});
test('small starting amounts work (£1)', () => {
  const r = simulate(series(Array.from({ length: 120 }, (_, i) => 100 + 20 * Math.sin(i / 4))), { amount: 1 });
  assert.ok(Number.isFinite(r.summary.end) && r.summary.end > 0);
  assert.equal(formatGBP(r.summary.start), '£1.00');
});

// ---------- plant follows the money ----------
test('plantFor maps value to stage monotonically and droops only below the amount planted', () => {
  assert.equal(plantFor(1, false).stage, 0);
  let prev = -1;
  for (const r of [0.2, 0.59, 0.6, 0.89, 0.9, 1, 1.04, 1.05, 1.24, 1.25, 1.99, 2, 4.99, 5, 50]) { const s = plantFor(r).stage; assert.ok(s >= prev, 'monotonic at ' + r); prev = s; }
  assert.equal(plantFor(1).stage, 2); assert.equal(plantFor(1).droop, 0);
  assert.equal(plantFor(5).stage, 6); assert.equal(plantFor(0.5).stage, 0);
  assert.ok(plantFor(0.9).droop > 0 && plantFor(0.7).droop > plantFor(0.9).droop && plantFor(0.1).droop === 1);
  assert.equal(plantFor(1.3).droop, 0);
  assert.ok(plantFor(0.99).stage <= 2, 'a losing pot is never a big tree');
});

// ---------- formatting ----------
test('signed money and percentages use real plus/minus signs', () => {
  assert.equal(signedGBP(12.345), '+£12.35'); assert.equal(signedGBP(-12.3), '−£12.30'); assert.equal(signedGBP(0), '£0.00');
  assert.equal(signedPct(23.456), '+23.5%'); assert.equal(signedPct(-3), '−3.0%'); assert.equal(signedPct(0), '0.0%');
  assert.equal(formatGBP(1234567.5), '£1,234,567.50'); assert.equal(formatGBP(NaN), '—');
});

// ---------- project hygiene ----------
const read = f => fs.readFileSync(new URL('../' + f, import.meta.url), 'utf8');
test('version is 1.13.2 everywhere it should be', () => {
  assert.equal(VERSION, '1.13.2');
  assert.equal(JSON.parse(read('version.json')).version, '1.13.2');
  assert.equal(JSON.parse(read('package.json')).version, '1.13.2');
  assert.equal(JSON.parse(read('bot/package.json')).version, '1.13.2');
  assert.match(read('time-machine.html'), /id="version">v1\.13\.2</);
  assert.match(read('README.md'), /1\.10\.0/);
  assert.match(read('index.html'), /id="version">v1\.13\.2</);
});
test('every element id the page script uses exists in the HTML', () => {
  for (const [page, script] of [['time-machine.html', 'time-machine.js'], ['time-machine.html', 'time-machine-race.js'], ['index.html', 'garden.js']]) {
    const html = read(page), js = read(script);
    const used = new Set([...js.matchAll(/\$\('([A-Za-z][\w-]*)'\)/g)].map(m => m[1]));
    const have = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    assert.deepEqual([...used].filter(id => !have.has(id)), [], page);
  }
});
test('time machine code has no secrets, exchange APIs or order placement', () => {
  for (const f of ['time-machine.js', 'time-machine-engine.js', 'time-machine-plant.js', 'time-machine-sound.js', 'time-machine.html', 'index.html', 'garden.js', 'forecast-engine.js', 'price-data.js']) {
    const text = read(f);
    assert.doesNotMatch(text, /api[_-]?key|api[_-]?secret|private[_-]?key|krakenapi|api\.kraken|AddOrder|Authorization|Bearer /i, f);
  }
  const urls = [...read('time-machine.js').matchAll(/https?:\/\/[^'"\s)]+/g)].map(m => m[0]);
  assert.ok(urls.every(u => /raw\.githubusercontent\.com\/typedcypher|bitcoin-grower-bot|github/.test(u) || u.includes('w3.org')), urls.join('\n'));
  assert.doesNotMatch(read('live-price.js'), /api[_-]?key|api[_-]?secret|AddOrder|Authorization|\/private\/|Bearer /i);
  const live = [...read('live-price.js').matchAll(/https:\/\/[^'"\s)]+/g)].map(m => m[0]);
  assert.ok(live.every(u => /^https:\/\/api\.(kraken\.com\/0\/public\/|coingecko\.com\/api\/v3\/(simple\/price|coins\/bitcoin\/market_chart))/.test(u)), live.join('\n')); // public read-only endpoints only
});
test('optional bundled price file, if present, is valid daily BTC/GBP', { skip: !fs.existsSync(new URL('../data/btc-gbp-daily.csv', import.meta.url)) }, () => {
  const { points } = parseCSV(read('data/btc-gbp-daily.csv'));
  assert.ok(describeData(points).maxGap <= 3);
});

// ---------- the gardener's lines ----------
import { startLine, buyLine, sellLine, moodLine, endLine } from '../gardener-lines.js';
test('gardener lines: plain English, correct numbers, no advice', () => {
  assert.match(startLine({ amount: 1000, fromLabel: '1 January 2017' }), /planting £1,000 on 1 January 2017/);
  assert.match(buyLine({ price: 90, prevPrice: 100, amount: 10 }), /dropped about 10%.*£10 of Bitcoin/);
  assert.match(sellLine({ price: 110, buyPrice: 100, sellPct: 50, gbp: 5.5 }), /up about 10%.*selling half of it.*£5\.50.*rest keeps growing/);
  assert.match(sellLine({ price: 110, buyPrice: 100, sellPct: 100, gbp: 11 }), /all of it/);
  assert.doesNotMatch(sellLine({ price: 110, buyPrice: 100, sellPct: 100, gbp: 11 }), /rest keeps growing/);
  const all = [startLine({ amount: 1, fromLabel: 'x' }), buyLine({ price: 1, prevPrice: 2, amount: 1 }), sellLine({ price: 2, buyPrice: 1, sellPct: 25, gbp: 1 }), endLine({ profit: 5, end: 105, maxDrawdown: 40 })].join(' ');
  assert.doesNotMatch(all, /you should|guarantee|will rise|get rich/i);
});
test('gardener mood lines fire once each and mention storms honestly', () => {
  const seen = new Set();
  assert.equal(moodLine({ ratio: 1.1, prevRatio: 1, seen }), null);
  assert.match(moodLine({ ratio: 0.79, prevRatio: 0.9, seen }), /Storm clouds.*down about 21%/);
  assert.equal(moodLine({ ratio: 0.78, prevRatio: 0.79, seen }), null);
  assert.match(moodLine({ ratio: 0.49, prevRatio: 0.6, seen }), /half its value.*might not come back/);
  assert.match(moodLine({ ratio: 1.02, prevRatio: 0.9, seen }), /sun’s back out/);
  assert.match(moodLine({ ratio: 2.1, prevRatio: 1.9, seen }), /doubled/);
  assert.match(endLine({ profit: -5, end: 95, maxDrawdown: 30 }), /below what we planted/);
});
