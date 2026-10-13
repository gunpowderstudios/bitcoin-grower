// Bitcoin Garden Time Machine — page controller (v1.13.12). Simulation only: no accounts, keys or trading.
import {
  VERSION, DEFAULTS, parseCSV, describeData, validateSettings, selectRange, simulate, plantFor, STAGES,
  addDays, addYears, dayNumber, formatGBP, signedGBP, signedPct
} from './time-machine-engine.js?v=1.13.12';
import { createPlant } from './time-machine-plant.js?v=1.13.12';
import { createSound } from './time-machine-sound.js?v=1.13.12';
import { loadHistory } from './price-data.js?v=1.13.12';
import { createRace } from './time-machine-race.js?v=1.13.12';
import { forecast, describe as describeForecast, futureFrames, SINCE_CHOICES } from './forecast-engine.js?v=1.13.12';
import { startLine, buyLine, sellLine, moodLine, endLine } from './gardener-lines.js?v=1.13.12';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const DURATION = { slow: 70000, normal: 28000, fast: 10000 }; // how long a whole journey takes at each speed (ms)
const MIN_FRAMES_PER_SEC = 4;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const plant = createPlant($('plant'));
const gardener = { say() {}, clear() {}, text: '' }; // the little gardener and speech bubbles are switched off for now (code kept in time-machine-gardener.js)
const fwRace = createRace($, { section: 'fwRace', beds: 'fwBeds', date: 'fwDate', scrub: 'fwScrub', play: 'fwPlay', restart: 'fwRestart', note: 'fwNote' }, {
  uid: 'fw', onCoinsFall: () => { if (sound.enabled) window.setTimeout(() => sound.play('clink', { fast: false }), 1900); }, finishNote: beds => 'Over the chosen time, the typical run ended at ' + formatGBP(beds[1].sim.summary.end) + ', the rough patch at ' + formatGBP(beds[0].sim.summary.end) + ' and the good run at ' + formatGBP(beds[2].sim.summary.end) + '. The real future could land anywhere, even outside this range.'
});
const sound = createSound();
sound.enableWhenAllowed(); // sound is on by default; it starts with the visitor's first click or tap
const S = {
  data: null, sourceNote: '', steps: null, sim: null, cursor: 0, state: 'idle', speed: 'normal',
  raf: 0, last: 0, acc: 0, lastYear: '', lastStage: 0, droopMark: { t: 0, v: 0 }, lastPerk: 0, lastToast: 0,
  shownLog: -1, chart: null, markers: 0, lastFast: false
};
$('version').textContent = 'v' + VERSION;

// ---------------------------------------------------------------- helpers
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const parts = d => ({ y: d.slice(0, 4), m: Number(d.slice(5, 7)) - 1, d: Number(d.slice(8, 10)) });
const fmtDate = d => { const p = parts(d); return p.d + ' ' + MONTHS[p.m] + ' ' + p.y; };
const fmtLong = d => { const p = parts(d); return p.d + ' ' + FULL_MONTHS[p.m] + ' ' + p.y; };
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const todayish = () => S.data?.last || new Date().toISOString().slice(0, 10);
function showError(msg) { const e = $('error'); e.textContent = msg || ''; e.hidden = !msg; }
function setStatus(msg) { $('status').textContent = msg; }

// ---------------------------------------------------------------- data loading
async function loadPrices() {
  try {
    const { points, rejected, note } = await loadHistory();
    acceptData(points, note + (rejected ? ' (' + rejected + ' unreadable rows were skipped.)' : ''));
  } catch (e) {
    $('source').textContent = 'We couldn’t load Bitcoin’s price history (' + e.message + '). Check your connection and reload, or choose your own Date,BTC_GBP file below. We will never make up prices.';
    setStatus('Prices unavailable — see “About the prices” below.');
    $('goHint').textContent = 'Waiting for Bitcoin’s history to load.';
  }
}
function acceptData(points, note) {
  const info = describeData(points);
  S.data = { points, ...info };
  const stale = dayNumber(todayish()) < Math.floor(Date.now() / 86400000) - 21;
  $('source').textContent = note;
  $('coverage').textContent = info.count.toLocaleString('en-GB') + ' daily prices from ' + fmtLong(info.first) + ' to ' + fmtLong(info.last) +
    (info.gaps.length ? ' · ' + info.gaps.length + ' gap' + (info.gaps.length > 1 ? 's' : '') + ' in the data (journeys that cross a big gap are refused)' : ' · no gaps') +
    (stale ? ' · newest price is from ' + fmtLong(info.last) : '') + (info.first < '2014-01-01' ? ' · prices before 2014 are sparse and less reliable.' : '');
  $('from').min = info.first; $('from').max = addDays(info.last, -7);
  $('to').min = addDays(info.first, 7); $('to').max = info.last;
  buildPresets();
  const q = new URLSearchParams(location.search);
  if (q.get('from')) $('from').value = q.get('from');
  if (q.get('to')) $('to').value = q.get('to');
  if (q.get('amount')) $('amount').value = q.get('amount');
  if ($('from').value < info.first || $('from').value > $('from').max) $('from').value = info.first <= '2017-01-01' ? '2017-01-01' : addYears(info.last, -5);
  syncPresets(); updateDateHint();
  $('go').disabled = false; $('fwGo').disabled = false; $('goHint').textContent = 'You’ll watch your plant grow as time moves forward. Nothing here uses real money.';
  resetToIdle();
}

// ---------------------------------------------------------------- presets & inputs
function buildPresets() {
  const last = todayish();
  const list = [['The very start (' + S.data.first.slice(0, 4) + ')', S.data.first], ['2017', '2017-01-01'], ['2020', '2020-01-01'], ['2022', '2022-01-01'], ['5 years ago', addYears(last, -5)]];
  const box = $('presets'); box.replaceChildren();
  for (const [label, date] of list) {
    if (date < S.data.first || date > addDays(S.data.last, -7)) continue;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = label; b.dataset.date = date; b.setAttribute('aria-pressed', 'false');
    b.onclick = () => { $('from').value = date; showError(''); syncPresets(); updateDateHint(); };
    box.appendChild(b);
  }
}
function syncPresets() { for (const b of $('presets').children) b.setAttribute('aria-pressed', String(b.dataset.date === $('from').value)); }
function updateFirstPrice() {
  if (!S.data?.points?.length) return;
  const first = S.data.points[0];
  const picked = S.data.points.find(p => p.date >= $('from').value);
  const text = 'Earliest price in this data: ' + formatGBP(first.price) + ' per BTC on ' + fmtLong(first.date) + '. ';
  $('firstPrice').textContent = text + (picked
    ? 'On your chosen date, one BTC cost ' + formatGBP(picked.price) + ' (' + fmtLong(picked.date) + ').'
    : 'Choose a supported start date to see its price.');
}
function updateDateHint() {
  updateFirstPrice();
  const from = $('from').value;
  if (!from || !S.data) return;
  const end = $('to').value || S.data.last;
  const yrs = (dayNumber(end) - dayNumber(from)) / 365.25;
  $('dateHint').textContent = yrs > 0
    ? 'You’ll travel from ' + fmtLong(from) + ' to ' + fmtLong(end) + ' (about ' + (yrs >= 1.5 ? yrs.toFixed(1) + ' years' : Math.round(yrs * 12) + ' months') + ').'
    : 'Pick a date before ' + fmtLong(end) + '.';
  const day = yrs > 0 ? S.data.points.find(p => p.date >= from) : null;
  if (day && dayNumber(day.date) - dayNumber(from) <= 3) $('dateHint').textContent += ' One Bitcoin cost ' + formatGBP(day.price) + ' on ' + (day.date === from ? 'that day' : fmtLong(day.date)) + '.';
  if (yrs > 0 && from < '2014-01-01') $('dateHint').textContent += ' Heads up: prices before 2014 are sparse and less reliable, and Bitcoin was tiny then, so results can look enormous. Bitcoin began in 2009, but ' + fmtLong(S.data.first) + ' is the earliest day we have prices for.';
}
function readSettings() {
  return validateSettings({
    amount: $('amount').value === '' ? NaN : $('amount').value, buyPct: $('buyPct').value, dipPct: $('dipPct').value,
    risePct: $('risePct').value, sellPct: $('sellPct').value, feePct: $('feePct').value, strategy: 'hold'
  });
}
$('from').addEventListener('input', () => { showError(''); syncPresets(); updateDateHint(); });
$('to').addEventListener('input', () => { showError(''); updateDateHint(); });
$('amount').addEventListener('input', () => { showError(''); if (S.state === 'idle') showIdleFigures(); });
$('defaults').onclick = () => { for (const k of ['buyPct', 'dipPct', 'risePct', 'sellPct', 'feePct']) $(k).value = DEFAULTS[k]; showError(''); };

// ---------------------------------------------------------------- idle (nothing running yet)
function showIdleFigures() {
  const a = Number($('amount').value);
  const v = Number.isFinite(a) && a > 0 ? a : DEFAULTS.amount;
  $('figStart').textContent = formatGBP(v); $('figNow').textContent = formatGBP(v);
  setPnl(0, 0, true);
}
function resetToIdle() {
  stopLoop(); S.state = 'idle'; S.sim = null; S.steps = null; S.chart = null;
  plant.reset(); S.lastStage = 0; $('stage').textContent = STAGES[0];
  $('scene').classList.remove('playing');
  $('scene').style.setProperty('--sky1', '#1b1f4a'); $('scene').style.setProperty('--sky2', '#37306b');
  $('year').textContent = '⏳'; $('daymonth').textContent = 'Choose a date, then press the green button'; $('whenLabel').textContent = 'Ready to travel'; S.lastYear = '';
  $('tlFill').style.width = '0'; $('tlKnob').style.left = '0'; $('timeline').querySelectorAll('.tick').forEach(n => n.remove());
  $('summary').hidden = true;
  $('journal').innerHTML = '<tr><td colspan="4">Nothing yet — press play!</td></tr>';
  for (const id of ['play', 'month', 'finish', 'restart']) $(id).disabled = true;
  $('play').textContent = '▶ Play';
  showIdleFigures();
  drawEmptyChart();
  setStatus('Choose an amount and a date, then press the big green button.');
}
function drawEmptyChart() {
  const c = $('chart'); c.replaceChildren();
  const t = svgEl('text', { x: 350, y: 130, 'text-anchor': 'middle' }, c);
  t.textContent = 'Your chart will draw itself as you travel through time';
}

// ---------------------------------------------------------------- starting a journey
function begin(autoplay) {
  showError('');
  try {
    const settings = readSettings();
    const steps = selectRange(S.data.points, $('from').value, $('to').value || undefined);
    S.sim = simulate(steps, settings); S.steps = steps;
  } catch (e) { showError(e.message); $('error').scrollIntoView({ block: 'nearest' }); return false; }
  if (sound.enabled) sound.unlock();
  $('figStart').textContent = formatGBP(S.sim.settings.amount);
  buildTimelineTicks(); buildChart();
  restart(autoplay);
  $('journey').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  return true;
}
function restart(autoplay) {
  stopLoop(); S.cursor = 0; S.state = 'ready'; S.lastStage = 0; S.shownLog = -1; S.markers = 0; S.acc = 0;
  plant.reset(); S.droopMark = { t: performance.now(), v: 0 };
  $('summary').hidden = true; gardener.clear(); S.mood = new Set(); S.prevRatio = 1;
  for (const id of ['play', 'month', 'finish', 'restart']) $(id).disabled = false;
  $('chart').querySelectorAll('.mk').forEach(n => n.remove());
  render({ instant: true });
  { const st = S.sim.settings; gardener.say(startLine({ amount: st.amount, fromLabel: fmtLong(S.sim.frames[0].date) }), { priority: 2, ms: 6500 }); }
  setStatus('Ready! Press play to start travelling forward.');
  syncButtons();
  if (autoplay) play();
}

// ---------------------------------------------------------------- playback
function rate() { // frames per millisecond
  const n = S.sim.frames.length;
  return Math.max(n / DURATION[S.speed], MIN_FRAMES_PER_SEC / 1000);
}
function play() {
  if (S.state === 'done') restart(false);
  if (!S.sim || S.state === 'playing') return;
  if (sound.enabled) sound.unlock();
  S.state = 'playing'; S.last = performance.now(); S.acc = 0;
  S.raf = requestAnimationFrame(loop);
  $('scene').classList.add('playing'); $('whenLabel').textContent = 'Travelling through time…';
  setStatus('Travelling forward through real Bitcoin history…');
  syncButtons();
}
function pause(msg = true) {
  stopLoop();
  if (S.state === 'playing') { S.state = 'paused'; if (msg) setStatus('Paused. Press resume when you’re ready.'); $('whenLabel').textContent = 'Paused'; }
  $('scene').classList.remove('playing');
  syncButtons();
}
function stopLoop() { if (S.raf) cancelAnimationFrame(S.raf); S.raf = 0; }
function loop(ts) {
  if (S.state !== 'playing') return;
  const dt = Math.min(250, ts - S.last); S.last = ts;
  S.acc += dt * rate();
  const n = Math.floor(S.acc);
  if (n >= 1) {
    S.acc -= n;
    S.lastFast = rate() * 1000 > 150;
    S.cursor = Math.min(S.sim.frames.length - 1, S.cursor + n);
    render({ fast: S.lastFast, steps: n });
    if (S.cursor >= S.sim.frames.length - 1) { complete(); return; }
  }
  S.raf = requestAnimationFrame(loop);
}
function syncButtons() {
  $('play').textContent = S.state === 'playing' ? '⏸ Pause' : S.state === 'done' ? '↺ Play again' : S.state === 'paused' ? '▶ Resume' : '▶ Play';
  $('go').textContent = S.state === 'idle' ? '🌱 Plant my money & travel forward!' : '🌱 Start a fresh journey with these choices';
}
$('play').onclick = () => (S.state === 'playing' ? pause() : play());
$('restart').onclick = () => restart(false);
$('month').onclick = () => {
  if (!S.sim) return; if (S.state === 'done') return;
  pause(false); if (S.state === 'ready') S.state = 'paused';
  S.cursor = Math.min(S.sim.frames.length - 1, S.cursor + 30);
  render({ fast: true, steps: 30 });
  if (S.cursor >= S.sim.frames.length - 1) complete(); else { syncButtons(); $('whenLabel').textContent = 'Paused'; setStatus('Skipped ahead 30 days.'); }
};
$('finish').onclick = () => {
  if (!S.sim) return;
  pause(false); S.cursor = S.sim.frames.length - 1;
  render({ instant: true }); complete(true);
};
$('go').onclick = () => begin(true);
$('again').onclick = () => { $('setup').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); $('from').focus({ preventScroll: true }); };
$('replay').onclick = () => { restart(true); $('journey').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); };
for (const b of $('speed').querySelectorAll('button')) b.onclick = () => {
  S.speed = b.dataset.speed;
  $('speed').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
};
$('showHold').onchange = () => { if (!S.sim) return; buildChart(); render({ instant: true, quiet: true }); };
$('sound').onclick = () => {
  const on = sound.setEnabled(!sound.enabled);
  $('sound').setAttribute('aria-pressed', String(on));
  $('sound').textContent = on ? '🔊 Sound on' : '🔇 Sound off';
};

// ---------------------------------------------------------------- rendering a moment in time
function setPnl(pnl, pct, idle = false) {
  const box = $('figPnl'), up = pnl > 0.004, down = pnl < -0.004;
  box.className = 'fig' + (up ? ' gain' : down ? ' loss' : '');
  $('pnlLabel').textContent = idle ? 'Profit or loss so far' : up ? 'I’ve made' : down ? 'I’ve lost' : 'No gain or loss yet';
  $('pnl').textContent = signedGBP(pnl);
  $('pnlPct').textContent = idle ? 'Press the green button to begin' : up ? '▲ ' + signedPct(pct) + ' profit' : down ? '▼ ' + signedPct(pct) + ' loss' : '■ 0.0% — level with where you started';
}
function render({ instant = false, fast = false, quiet = false, steps = 1 } = {}) {
  const { frames, events, settings } = S.sim, f = frames[S.cursor], N = frames.length;
  const start = settings.amount, pnl = f.total - start, pct = 100 * (f.total / start - 1);
  // date
  const p = parts(f.date);
  if (p.y !== S.lastYear) { S.lastYear = p.y; $('year').textContent = p.y; if (!instant && !reduceMotion()) { $('year').classList.remove('flip'); void $('year').offsetWidth; $('year').classList.add('flip'); } }
  $('daymonth').textContent = p.d + ' ' + FULL_MONTHS[p.m];
  // money
  $('figNow').textContent = formatGBP(f.total); setPnl(pnl, pct);
  // plant
  const ratio = f.total / start, pl = plantFor(ratio, true);
  plant.setState(pl.stage, pl.droop);
  plant.setFruit(ratio, !instant && !quiet && !reduceMotion());
  $('stage').textContent = pl.name + (pl.droop > 0.35 ? ' · drooping 😟' : '');
  const now = performance.now();
  if (now - S.droopMark.t > 1500) { if (S.droopMark.v - pl.droop > 0.1 && now - S.lastPerk > 3000) { plant.perk(); S.lastPerk = now; } S.droopMark = { t: now, v: pl.droop }; }
  if (!instant && !quiet && pl.stage > S.lastStage) { sound.play('grow', { fast }); sound.play('rustle', { fast }); setStatus('Your plant grew into a ' + pl.name.toLowerCase() + '!'); }
  S.lastStage = pl.stage;
  // sky: dusk in the distant past, daylight by the present
  const prog = S.cursor / (N - 1);
  $('scene').style.setProperty('--sky1', mixHex('#1b1f4a', '#3f86c4', prog)); $('scene').style.setProperty('--sky2', mixHex('#37306b', '#f6d58a', prog));
  // timeline
  $('tlFill').style.width = (prog * 100).toFixed(2) + '%'; $('tlKnob').style.left = (prog * 100).toFixed(2) + '%';
  { const line = moodLine({ ratio, prevRatio: S.prevRatio ?? 1, seen: S.mood || (S.mood = new Set()) }); S.prevRatio = ratio; if (line && !instant && !quiet) gardener.say(line, { priority: 1 }); }
  // trades since last render
  const seen = S.shownLog < 0 ? 0 : S.shownLog;
  if (f.events !== seen || S.shownLog < 0) {
    const fresh = events.slice(Math.min(seen, f.events), f.events);
    const sells = fresh.filter(e => e.side === 'SELL'), buys = fresh.filter(e => e.side === 'BUY');
    if (!instant && !quiet && fresh.length) {
      const e = fresh.at(-1), at = events.indexOf(e), prev = events[at - 1];
      if (e.side === 'BUY') gardener.say(buyLine({ price: e.price, prevPrice: prev ? prev.price : frames[0].price, amount: e.gbp }), { priority: 2 });
      else { let b = null; for (let k = at - 1; k >= 0; k--) if (events[k].side === 'BUY') { b = events[k]; break; } gardener.say(sellLine({ price: e.price, buyPrice: b?.price, sellPct: settings.sellPct, gbp: e.gbp }), { priority: 2 }); }
      if (sells.length) sound.play('clink', { fast }); else if (buys.length) sound.play('plant', { fast });
      announceTrades(fresh, fast);
    }
    renderLog(events, f.events);
    S.shownLog = f.events;
  }
  updateChart();
}
function announceTrades(fresh, fast) {
  const now = performance.now();
  if (now - S.lastToast < 700) return;
  S.lastToast = now;
  const sells = fresh.filter(e => e.side === 'SELL'), buys = fresh.filter(e => e.side === 'BUY');
  let text;
  if (fresh.length === 1) {
    const e = fresh[0];
    text = e.side === 'SELL' ? '🪙 Harvest: sold some and banked ' + formatGBP(e.gbp) + ' · ' + fmtDate(e.date) : '🌱 Planted ' + formatGBP(e.gbp) + ' of Bitcoin · ' + fmtDate(e.date);
  } else text = (buys.length ? '🌱 ' + buys.length + ' planted' : '') + (buys.length && sells.length ? ' · ' : '') + (sells.length ? '🪙 ' + sells.length + ' harvests (sold some)' : '');
  toast(text, sells.length ? 'sell' : 'buy');
  setStatus(text.replace(/[🪙🌱]/gu, '').trim());
}
function toast(text, cls) {
  const box = $('toasts'), t = document.createElement('div');
  t.className = 'toast ' + cls; t.textContent = text; box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 3500);
}
function renderLog(events, count) {
  const body = $('journal'); body.replaceChildren();
  if (!count) { body.insertRow().insertCell().colSpan = 4; body.rows[0].cells[0].textContent = 'No buys or harvests yet.'; return; }
  for (let i = count - 1, shown = 0; i >= 0 && shown < 300; i--, shown++) {
    const e = events[i], row = body.insertRow();
    for (const v of [fmtDate(e.date), e.side === 'BUY' ? '🌱 Planted Bitcoin' : '🪙 Harvested', formatGBP(e.price), formatGBP(e.gbp)]) row.insertCell().textContent = v;
  }
}
function mixHex(a, b, t) {
  const h = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  return '#' + h(a).map((v, i) => Math.round(v + (h(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- timeline & chart
function ticksFor(first, last, maxTicks) {
  const out = [], d0 = dayNumber(first), d1 = dayNumber(last), span = d1 - d0;
  const fy = Number(first.slice(0, 4)), ly = Number(last.slice(0, 4));
  if (span > 600) {
    const step = Math.max(1, Math.ceil((ly - fy) / maxTicks));
    for (let y = fy + 1; y <= ly; y += step) { const d = y + '-01-01'; if (d > first && d <= last) out.push({ d, label: String(y) }); }
  } else {
    const months = Math.max(1, Math.ceil(span / 30 / maxTicks));
    let y = fy, m = Number(first.slice(5, 7));
    for (let i = 0; i < 120; i++) {
      m += i === 0 ? 1 : months; while (m > 12) { m -= 12; y++; }
      const d = y + '-' + String(m).padStart(2, '0') + '-01';
      if (d > last) break; if (d > first) out.push({ d, label: MONTHS[m - 1] + (m === 1 || !out.length ? ' ' + y : '') });
    }
  }
  return out;
}
function buildTimelineTicks() {
  const tl = $('timeline'); tl.querySelectorAll('.tick').forEach(n => n.remove());
  const f = S.sim.frames, d0 = dayNumber(f[0].date), d1 = dayNumber(f.at(-1).date);
  const max = window.innerWidth < 520 ? 4 : 8;
  for (const t of ticksFor(f[0].date, f.at(-1).date, max)) {
    const s = document.createElement('span'); s.className = 'tick'; s.textContent = t.label;
    s.style.left = (100 * (dayNumber(t.d) - d0) / (d1 - d0)).toFixed(2) + '%'; tl.appendChild(s);
  }
}
const W = 700, X0 = 62, X1 = 688, Y0 = 16, Y1 = 214;
function buildChart() {
  const { frames, events, settings } = S.sim, N = frames.length, start = settings.amount, showHold = false;
  const d0 = dayNumber(frames[0].date), d1 = dayNumber(frames.at(-1).date);
  let lo = start, hi = start;
  for (const f of frames) { lo = Math.min(lo, f.total); hi = Math.max(hi, f.total); if (showHold) { lo = Math.min(lo, f.hold); hi = Math.max(hi, f.hold); } }
  const pad = (hi - lo) * 0.08 || start * 0.05; lo = Math.max(0, lo - pad); hi += pad;
  const X = f => X0 + (dayNumber(f.date) - d0) / (d1 - d0) * (X1 - X0), Y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0);
  const keep = new Set([0, N - 1]); const stepSz = Math.max(1, Math.floor(N / 340));
  for (let i = 0; i < N; i += stepSz) keep.add(i); for (const e of events) keep.add(e.i);
  const idx = [...keep].sort((a, b) => a - b);
  const base = Y(start);
  S.chart = { idx, X, Y, base, lo, hi, d0, d1, px: idx.map(i => X(frames[i]).toFixed(1)), py: idx.map(i => Y(frames[i].total).toFixed(1)), hy: idx.map(i => Y(frames[i].hold).toFixed(1)), showHold };
  const c = $('chart'); c.replaceChildren();
  const defs = svgEl('defs', {}, c);
  svgEl('rect', { x: X0, y: Y0 - 8, width: X1 - X0 + 8, height: base - Y0 + 8 }, svgEl('clipPath', { id: 'tmUp' }, defs));
  svgEl('rect', { x: X0, y: base, width: X1 - X0 + 8, height: Y1 - base + 8 }, svgEl('clipPath', { id: 'tmDown' }, defs));
  for (const [v, y] of [[hi, Y(hi)], [lo, Y(lo)]]) {
    svgEl('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: '#2f5139', 'stroke-width': 1 }, c);
    svgEl('text', { x: X0 - 6, y: y + 4, 'text-anchor': 'end' }, c).textContent = formatGBP(v).replace(/\.00$/, '');
  }
  svgEl('line', { x1: X0, x2: X1, y1: base, y2: base, stroke: '#ffe9a0', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, c);
  svgEl('text', { x: X1, y: base - 6, 'text-anchor': 'end', style: 'fill:#ffe9a0' }, c).textContent = 'planted ' + formatGBP(start).replace(/\.00$/, '');
  for (const t of ticksFor(frames[0].date, frames.at(-1).date, window.innerWidth < 520 ? 4 : 8)) {
    const x = X0 + (dayNumber(t.d) - d0) / (d1 - d0) * (X1 - X0);
    svgEl('line', { x1: x, x2: x, y1: Y1, y2: Y1 + 5, stroke: '#5d8a68' }, c);
    svgEl('text', { x, y: Y1 + 20, 'text-anchor': 'middle' }, c).textContent = t.label;
  }
  S.chart.areaUp = svgEl('path', { fill: 'rgba(120,230,100,.26)', 'clip-path': 'url(#tmUp)' }, c);
  S.chart.areaDown = svgEl('path', { fill: 'rgba(255,120,110,.30)', 'clip-path': 'url(#tmDown)' }, c);
  S.chart.hold = svgEl('path', { fill: 'none', stroke: '#f4c84a', 'stroke-width': 2, 'stroke-dasharray': '5 4', display: showHold ? 'inline' : 'none' }, c);
  S.chart.lineUp = svgEl('path', { fill: 'none', stroke: '#8cf06a', 'stroke-width': 3, 'stroke-linejoin': 'round', 'clip-path': 'url(#tmUp)' }, c);
  S.chart.lineDown = svgEl('path', { fill: 'none', stroke: '#ff8f86', 'stroke-width': 3, 'stroke-linejoin': 'round', 'clip-path': 'url(#tmDown)' }, c);
  S.chart.mk = svgEl('g', {}, c); S.chart.dot = svgEl('circle', { r: 5.5, fill: '#fff', stroke: '#2a6a2a', 'stroke-width': 2 }, c);
  S.markers = 0;
}
function updateChart() {
  const ch = S.chart; if (!ch) return;
  const { frames, events } = S.sim, cur = S.cursor, f = frames[cur];
  let k = 0; while (k < ch.idx.length && ch.idx[k] <= cur) k++;
  const xs = ch.px.slice(0, k), ys = ch.py.slice(0, k), hs = ch.hy.slice(0, k);
  const cx = ch.X(f).toFixed(1), cy = ch.Y(f.total).toFixed(1);
  if (ch.idx[k - 1] !== cur) { xs.push(cx); ys.push(cy); hs.push(ch.Y(f.hold).toFixed(1)); }
  const line = xs.map((x, i) => (i ? 'L' : 'M') + x + ' ' + ys[i]).join(' ');
  ch.lineUp.setAttribute('d', line); ch.lineDown.setAttribute('d', line);
  const area = line + ' L' + xs.at(-1) + ' ' + ch.base.toFixed(1) + ' L' + xs[0] + ' ' + ch.base.toFixed(1) + 'Z';
  ch.areaUp.setAttribute('d', area); ch.areaDown.setAttribute('d', area);
  if (ch.showHold) ch.hold.setAttribute('d', xs.map((x, i) => (i ? 'L' : 'M') + x + ' ' + hs[i]).join(' '));
  ch.dot.setAttribute('cx', cx); ch.dot.setAttribute('cy', cy);
  // buy / harvest markers
  if (S.markers > f.events) { ch.mk.replaceChildren(); S.markers = 0; }
  for (; S.markers < f.events; S.markers++) {
    const e = events[S.markers], x = ch.X(frames[e.i]), y = ch.Y(frames[e.i].total);
    if (S.markers > 150 && S.markers % 2) continue; // keep very busy charts readable
    if (e.side === 'SELL') svgEl('circle', { cx: x, cy: y, r: 5, fill: '#f4c84a', stroke: '#7a5200', 'stroke-width': 1.5 }, ch.mk);
    else svgEl('path', { d: `M${x - 5} ${y - 9} L${x + 5} ${y - 9} L${x} ${y - 1}Z`, fill: '#bfeaa0', stroke: '#2a6a2a', 'stroke-width': 1.2 }, ch.mk);
  }
}

function showPurchaseMath() {
  const sim = S.sim;
  if (!sim?.frames?.length) return;
  const frames = sim.frames, s = sim.summary, first = frames[0], last = frames.at(-1);
  const fee = sim.settings.feePct / 100;
  const buys = sim.events.filter(e => e.side === 'BUY');
  const box = $('purchaseMathBody');
  box.replaceChildren();
  const line = (label, value) => {
    const p = document.createElement('p');
    const b = document.createElement('b'); b.textContent = label + ': ';
    p.append(b, document.createTextNode(value)); box.appendChild(p);
  };
  line('Starting price', formatGBP(first.price) + ' per BTC on ' + fmtLong(first.date));
  line('Ending price', formatGBP(last.price) + ' per BTC on ' + fmtLong(last.date));
  line('Original pot', formatGBP(s.start));
  if (sim.settings.strategy === 'hold') {
    line('Original purchase', buys[0] ? fmtLong(buys[0].date) + ': ' + formatGBP(buys[0].gbp) + ' bought ' + buys[0].btc.toFixed(8) + ' BTC at ' + formatGBP(buys[0].price) + '/BTC' : '—');
    line('Purchase fee', formatGBP(s.feesPaid));
    line('Final Bitcoin value', s.btc.toFixed(8) + ' BTC × ' + formatGBP(last.price) + ' = ' + formatGBP(s.end));
  } else {
    line('First purchase', buys[0] ? fmtLong(buys[0].date) + ': ' + formatGBP(buys[0].gbp) + ' at ' + formatGBP(buys[0].price) + '/BTC, buying ' + buys[0].btc.toFixed(8) + ' BTC after fees' : 'No dip triggered a purchase');
    line('Total virtual purchases and sales', s.buys + ' purchases / ' + s.sells + ' sales');
    line('Total estimated trading fees', formatGBP(s.feesPaid));
    line('Final cash', formatGBP(s.cash));
    line('Bitcoin still held', s.btc.toFixed(8) + ' BTC × ' + formatGBP(last.price) + ' = ' + formatGBP(s.btc * last.price));
    line('Final pot value', formatGBP(s.cash) + ' cash + ' + formatGBP(s.btc * last.price) + ' Bitcoin = ' + formatGBP(s.end));
  }
  line('Profit or loss', formatGBP(s.end) + ' − ' + formatGBP(s.start) + ' = ' + signedGBP(s.profit) + ' (' + signedPct(s.pct) + ')');
  const note = document.createElement('p');note.className='hint';
  note.textContent='Calculations use historical daily prices provided by the selected dataset, with estimated fees. They are not proof these trades could have been executed. Especially early Bitcoin prices may be sparse.';
  box.appendChild(note);
}

// ---------------------------------------------------------------- finishing
function complete(instant = false) {
  stopLoop(); S.state = 'done'; $('scene').classList.remove('playing');
  $('whenLabel').textContent = 'Journey complete!';
  for (const id of ['month', 'finish']) $(id).disabled = true;
  syncButtons(); showSummary();
  sound.play('done');
  const sm = $('summary'); sm.hidden = false;
  $('chart').setAttribute('aria-label', 'Chart of your pot from ' + fmtLong(S.sim.summary.from) + ' to ' + fmtLong(S.sim.summary.to) + ': started at ' + formatGBP(S.sim.summary.start) + ', ended at ' + formatGBP(S.sim.summary.end));
  setStatus('Journey complete! Your final results are below.');
  sm.scrollIntoView({ behavior: reduceMotion() || instant ? 'auto' : 'smooth', block: 'start' });
  $('sum-heading').focus({ preventScroll: true });
}
function showSummary() {
  gardener.say('Your historical Bitcoin journey is complete!', { priority: 3, ms: 7000 });
  showPurchaseMath();
  const s = S.sim.summary, up = s.profit > 0.004, down = s.profit < -0.004;
  const years = s.days / 365.25, span = years >= 1.5 ? years.toFixed(1) + ' years' : Math.round(s.days / 30.44) + ' months';
  const big = $('sumBig');
  big.replaceChildren();
  const strong = document.createElement('span'); strong.className = up ? 'gain' : down ? 'loss' : '';
  strong.textContent = up ? signedGBP(s.profit) + ' (' + signedPct(s.pct) + ')' : down ? formatGBP(-s.profit) + ' (' + signedPct(s.pct).replace('−','') + ')' : 'no change';
  big.append('Your ' + formatGBP(s.start) + ' planted on ' + fmtLong(s.from) + ' would have ' + (up ? 'grown to ' : down ? 'shrunk to ' : 'stayed at ') + formatGBP(s.end) + ' by ' + fmtLong(s.to) + ' — a ' + (down ? 'loss' : up ? 'profit' : 'result') + ' of ', strong, ' over ' + span + '.');
  $('sStart').textContent = formatGBP(s.start); $('sEnd').textContent = formatGBP(s.end);
  $('sPnlBox').className = 'fig' + (up ? ' gain' : down ? ' loss' : '');
  $('sPnlLabel').textContent = up ? 'Total profit' : down ? 'Total loss' : 'Total profit or loss';
  $('sPnl').textContent = signedGBP(s.profit);
  $('sPct').textContent = (up ? '▲ ' : down ? '▼ ' : '■ ') + signedPct(s.pct);
  $('sTrades').textContent = '1 purchase';
  $('vsMe').textContent = formatGBP(s.end); $('vsMePct').textContent = signedPct(s.pct);
  $('vsHold').textContent = formatGBP(s.hold); $('vsHoldPct').textContent = signedPct(s.holdPct);
  const d = s.vsHold, close = Math.abs(d) < s.start * 0.005;
  $('vsText').textContent = close ? 'The two ended up almost exactly the same.'
    : d > 0 ? 'In this period the Grower strategy finished ' + formatGBP(d) + ' ahead of simply buying Bitcoin on day one and waiting.'
      : 'In this period, simply buying Bitcoin on day one and waiting would have finished ' + formatGBP(-d) + ' ahead of the Grower strategy. Buy-and-hold puts everything into Bitcoin straight away, so it gains more when Bitcoin climbs — and falls further when it drops.';
  $('sumFine').textContent = 'One-time purchase fee: ' + formatGBP(s.feesPaid) + ' · Biggest fall from a high point: ' + s.maxDrawdown.toFixed(1) + '%' +
    (s.skippedBuys ? ' · ' + s.skippedBuys + ' time' + (s.skippedBuys > 1 ? 's' : '') + ' the strategy wanted to buy but had no cash left' : '') +
    '. Buy-and-hold pays the same fee once. Both numbers are measured at the final day’s closing price.';
}

// ---------------------------------------------------------------- your own price file
$('csv').onchange = async e => {
  const file = e.target.files?.[0]; if (!file) return;
  try {
    const { points, rejected } = parseCSV(await file.text());
    acceptData(points, 'Your file “' + file.name + '” is being used. We can’t check where its prices came from, so please make sure they’re right.' + (rejected ? ' (' + rejected + ' unreadable rows were skipped.)' : ''));
  } catch (err) { showError(err.message); }
};

// pause if the tab is hidden so the story doesn't race ahead unseen
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'playing') pause(); });
let lastW = window.innerWidth;
window.addEventListener('resize', () => { if (window.innerWidth === lastW) return; lastW = window.innerWidth; if (S.sim) { buildTimelineTicks(); buildChart(); render({ instant: true, quiet: true }); } });

// test hook (read-only view of state; used by automated tests)
// ---------------------------------------------------------------- forward in time (a history-based forecast)
const FW = { days: 365 };
function setMode(mode) {
  const fwd = mode === 'fwd';
  $('backMode').hidden = fwd; $('fwdMode').hidden = !fwd;
  $('modeBack').setAttribute('aria-pressed', String(!fwd)); $('modeFwd').setAttribute('aria-pressed', String(fwd));
  if (fwd && S.state === 'playing') pause();
}
$('modeBack').onclick = () => setMode('back'); $('modeFwd').onclick = () => setMode('fwd');
setMode('fwd');
for (const b of $('fwHorizons').querySelectorAll('button')) b.onclick = () => { FW.days = Number(b.dataset.days); $('fwHorizons').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); };
$('fwGo').onclick = () => {
  $('fwError').hidden = true;
  try {
    const today = new Date().toISOString().slice(0, 10), amount = Number($('fwAmount').value);
    const f = forecast(S.data.points, { amount, horizonDays: FW.days, since: SINCE_CHOICES[$('fwSince').value] });
    const beds = [['p10', '🐻', 'Tough Times', 'What if Bitcoin has a difficult bear market?'], ['p50', '🌤️', 'Middle Ground', 'What if Bitcoin performs somewhere in the middle?'], ['p90', '🐂', 'Boom Times', 'What if Bitcoin enjoys a strong bull market?']].map(([k, emoji, name, sub]) => {
      const frames = futureFrames(f.fan, k, today);
      return { key: k, emoji, name, sub, sim: { settings: { amount }, frames, events: [], summary: { end: frames.at(-1).total, maxDrawdown: 0 } } };
    });
    fwRace.openBeds(beds);
    $('fwCaution').textContent = describeForecast(f, formatGBP).caution;
    $('fwRace').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); $('fwrace-heading').focus({ preventScroll: true });
  } catch (e) { $('fwError').textContent = e.message; $('fwError').hidden = false; }
};
window.__fwRace = fwRace; window.__setMode = setMode;
window.__tm = { gardener, get state() { return S.state; }, get cursor() { return S.cursor; }, get sim() { return S.sim; }, plant };

showIdleFigures(); drawEmptyChart(); syncButtons();
loadPrices();
