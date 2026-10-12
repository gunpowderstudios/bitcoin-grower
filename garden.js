// Bitcoin Grower — Today's Garden page controller (v1.9.0). Simulation only; read-only public price data.
import { VERSION, plantFor, formatGBP, signedPct, addDays, dayNumber, describeData } from './time-machine-engine.js?v=1.9.0';
import { createPlant } from './time-machine-plant.js?v=1.9.0';
import { loadHistory } from './price-data.js?v=1.9.0';
import { fetchLive } from './live-price.js?v=1.9.0';
import { forecast, describe, changeSince, SINCE_CHOICES } from './forecast-engine.js?v=1.9.0';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = d => Number(d.slice(8)) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
const money0 = n => formatGBP(n).replace(/\.00$/, '');
const axis = n => '£' + Math.round(n).toLocaleString('en-GB');

$('version').textContent = 'v' + VERSION;
const plant = createPlant($('plant'));
const S = { points: null, live: null, price: null, horizon: 365, timer: 0, tick: 0 };

// ---------------------------------------------------------------- live price
function setChange(el, pct) {
  el.className = 'fig' + (pct > 0.05 ? ' gain' : pct < -0.05 ? ' loss' : '');
  el.querySelector('strong').textContent = pct == null ? '—' : (pct > 0.05 ? '▲ ' : pct < -0.05 ? '▼ ' : '■ ') + signedPct(pct);
}
function renderPrice() {
  const l = S.live, price = S.price;
  $('price').textContent = Number.isFinite(price) ? formatGBP(price) : '£—';
  const ch = $('change');
  if (l && l.changePct != null) {
    const up = l.changePct > 0.05, down = l.changePct < -0.05;
    ch.className = 'chg ' + (up ? 'up' : down ? 'down' : '');
    ch.textContent = (up ? '▲ ' : down ? '▼ ' : '■ ') + signedPct(l.changePct) + ' ' + l.changeLabel;
  } else { ch.className = 'chg'; ch.textContent = l ? '' : 'Last daily closing price'; }
  $('dot').className = 'dot ' + (l ? 'live' : 'stale');
  $('liveSource').textContent = l ? 'Live price: read-only public ticker from ' + l.source + ', refreshed about every 30 seconds while this page is open.' : 'Live price: not available right now, so the newest daily closing price is shown instead.';
  renderUpdated();
}
function renderUpdated() {
  if (!S.live) { $('updated').textContent = S.points ? 'Showing the daily close for ' + fmtDate(S.points.at(-1).date) : 'Connecting…'; return; }
  const s = Math.max(0, Math.round((Date.now() - S.live.at) / 1000));
  $('updated').textContent = 'Live from ' + S.live.source + ' · updated ' + (s < 5 ? 'just now' : s < 90 ? s + ' seconds ago' : Math.round(s / 60) + ' minutes ago');
}
async function refreshLive() {
  try { S.live = await fetchLive(); S.price = S.live.price; }
  catch { if (S.live && Date.now() - S.live.at > 5 * 60000) S.live = null; if (!S.live) S.price = S.points?.at(-1).price ?? S.price; }
  renderPrice(); renderSeed(); drawYearChart();
}
function startTimers() {
  stopTimers();
  S.timer = setInterval(refreshLive, 30000); S.tick = setInterval(renderUpdated, 1000);
}
function stopTimers() { clearInterval(S.timer); clearInterval(S.tick); }
document.addEventListener('visibilitychange', () => { if (document.hidden) stopTimers(); else if (S.points) { refreshLive(); startTimers(); } });

// ---------------------------------------------------------------- the seed planted a year ago
function renderSeed() {
  if (!S.points || !Number.isFinite(S.price)) return;
  for (const [id, d] of [['c7', 7], ['c30', 30], ['c365', 365]]) { const c = changeSince(S.points, d, S.price); setChange($(id).parentElement, c ? c.pct : null); if (!c) $(id).textContent = '—'; }
  const y = changeSince(S.points, 365, S.price);
  if (!y) { $('seedText').textContent = 'We need a year of price history to grow your garden.'; return; }
  const worth = 100 * (1 + y.pct / 100), pl = plantFor(worth / 100, true);
  plant.setState(pl.stage, pl.droop);
  $('stage').textContent = pl.name + (pl.droop > 0.35 ? ' · drooping 😟' : '');
  const diff = worth - 100;
  $('seedText').textContent = 'A £100 seed planted a year ago (' + fmtDate(y.ref.date) + ') would be worth ' + formatGBP(worth) + ' today — ' + (diff >= 0 ? 'up ' : 'down ') + formatGBP(Math.abs(diff)) + ' (' + signedPct(y.pct) + ').';
}

// ---------------------------------------------------------------- charts
function drawYearChart() {
  const c = $('yearChart'); c.replaceChildren();
  if (!S.points) return;
  const end = S.points.at(-1).date, from = addDays(end, -365);
  const pts = S.points.filter(p => p.date >= from);
  if (pts.length < 30) return;
  const series = pts.map(p => ({ d: dayNumber(p.date), v: p.price }));
  if (Number.isFinite(S.price)) series.push({ d: series.at(-1).d + 0.001, v: S.price });
  const X0 = 74, X1 = 688, Y0 = 14, Y1 = 192, d0 = series[0].d, d1 = series.at(-1).d;
  let lo = Infinity, hi = -Infinity; for (const s of series) { lo = Math.min(lo, s.v); hi = Math.max(hi, s.v); }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
  const X = d => X0 + (d - d0) / (d1 - d0) * (X1 - X0), Y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0);
  for (const v of [hi, lo]) { svgEl('line', { x1: X0, x2: X1, y1: Y(v), y2: Y(v), stroke: '#2f5139' }, c); svgEl('text', { x: X0 - 6, y: Y(v) + 4, 'text-anchor': 'end' }, c).textContent = axis(v); }
  const step = Math.max(1, Math.floor(series.length / 300)), line = series.filter((_, i) => i % step === 0 || i === series.length - 1).map((s, i) => (i ? 'L' : 'M') + X(s.d).toFixed(1) + ' ' + Y(s.v).toFixed(1)).join(' ');
  svgEl('path', { d: line + ` L${X1} ${Y1} L${X0} ${Y1}Z`, fill: 'rgba(120,230,100,.18)' }, c);
  svgEl('path', { d: line, fill: 'none', stroke: '#8cf06a', 'stroke-width': 3, 'stroke-linejoin': 'round' }, c);
  svgEl('circle', { cx: X(d1), cy: Y(series.at(-1).v), r: 5.5, fill: '#fff', stroke: '#2a6a2a', 'stroke-width': 2 }, c);
  for (let k = 0; k <= 4; k++) {
    const dn = d0 + (d1 - d0) * k / 4, date = new Date(dn * 86400000).toISOString().slice(0, 10);
    svgEl('text', { x: X(dn), y: 212, 'text-anchor': k === 0 ? 'start' : k === 4 ? 'end' : 'middle' }, c).textContent = MONTHS[Number(date.slice(5, 7)) - 1] + ' ' + date.slice(2, 4).replace(/^/, '’');
  }
}
function drawFan(f) {
  const c = $('fanChart'); c.replaceChildren();
  const X0 = 74, X1 = 612, Y0 = 16, Y1 = 238, H = f.horizonDays;
  let lo = Math.min(f.amount, ...f.fan.map(r => r.p10)), hi = Math.max(f.amount, ...f.fan.map(r => r.p90));
  const pad = (hi - lo) * 0.08; lo = Math.max(0, lo - pad); hi += pad;
  const X = d => X0 + d / H * (X1 - X0), Y = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0);
  for (const v of [hi, lo]) { svgEl('line', { x1: X0, x2: X1, y1: Y(v), y2: Y(v), stroke: '#2f5139' }, c); svgEl('text', { x: X0 - 6, y: Y(v) + 4, 'text-anchor': 'end' }, c).textContent = axis(v); }
  const band = (a, b, fill) => { const up = f.fan.map((r, i) => (i ? 'L' : 'M') + X(r.day).toFixed(1) + ' ' + Y(r[b]).toFixed(1)).join(' '); const down = [...f.fan].reverse().map(r => 'L' + X(r.day).toFixed(1) + ' ' + Y(r[a]).toFixed(1)).join(' '); svgEl('path', { d: up + ' ' + down + 'Z', fill }, c); };
  band('p10', 'p90', 'rgba(244,200,74,.22)'); band('p25', 'p75', 'rgba(244,200,74,.45)');
  svgEl('line', { x1: X0, x2: X1, y1: Y(f.amount), y2: Y(f.amount), stroke: '#ffe9a0', 'stroke-width': 1.5, 'stroke-dasharray': '6 5' }, c);
  svgEl('text', { x: X0 + 4, y: Y(f.amount) - 6, style: 'fill:#ffe9a0' }, c).textContent = 'planted ' + money0(f.amount);
  svgEl('path', { d: f.fan.map((r, i) => (i ? 'L' : 'M') + X(r.day).toFixed(1) + ' ' + Y(r.p50).toFixed(1)).join(' '), fill: 'none', stroke: '#ffe9a0', 'stroke-width': 3, 'stroke-linejoin': 'round' }, c);
  const e = f.end;
  for (const [k, label, dy] of [['p90', 'top end', 0], ['p50', 'middle', 0], ['p10', 'low end', 0]]) {
    svgEl('circle', { cx: X1, cy: Y(e[k]), r: 4, fill: '#ffe9a0' }, c);
    const t = svgEl('text', { x: X1 + 8, y: Y(e[k]) + 4 + dy, style: 'fill:#fff' }, c); t.textContent = money0(e[k]);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (let k = 0; k <= 4; k++) {
    const d = Math.round(H * k / 4), date = addDays(today, d);
    svgEl('text', { x: X(d), y: 262, 'text-anchor': k === 0 ? 'start' : k === 4 ? 'end' : 'middle' }, c).textContent = k === 0 ? 'Today' : (H <= 90 ? Number(date.slice(8)) + ' ' + MONTHS[Number(date.slice(5, 7)) - 1] : MONTHS[Number(date.slice(5, 7)) - 1] + ' ’' + date.slice(2, 4));
  }
  $('fanChart').setAttribute('aria-label', 'Range of possible values for ' + money0(f.amount) + ' after ' + H + ' days: 8 in 10 past cases ended between ' + money0(e.p10) + ' and ' + money0(e.p90));
}
function renderForecast() {
  if (!S.points) return;
  $('error').hidden = true;
  const amount = Number($('fAmount').value);
  try {
    const f = forecast(S.points, { amount, horizonDays: S.horizon, since: SINCE_CHOICES[$('since').value] });
    const d = describe(f, money0);
    $('fHeadline').textContent = d.headline; $('fMiddle').textContent = d.middle; $('fUp').textContent = d.up;
    $('fCaution').textContent = d.caution;
    $('fExtremes').textContent = d.extremes + ' Based on ' + d.samples.toLocaleString('en-GB') + ' past planting days since ' + $('since').selectedOptions[0].textContent.split(' ')[0] + '.';
    drawFan(f);
  } catch (e) { $('fHeadline').textContent = e.message; $('fMiddle').textContent = $('fUp').textContent = $('fExtremes').textContent = $('fCaution').textContent = ''; $('fanChart').replaceChildren(); }
}
for (const b of $('horizons').querySelectorAll('button')) b.onclick = () => { S.horizon = Number(b.dataset.days); $('horizons').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); renderForecast(); };
let deb = 0; $('fAmount').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(renderForecast, 150); });
$('since').onchange = renderForecast;

// ---------------------------------------------------------------- go
(async function init() {
  try {
    const { points, rejected, note } = await loadHistory();
    S.points = points; S.price = points.at(-1).price;
    const info = describeData(points);
    $('source').textContent = note + (rejected ? ' (' + rejected + ' unreadable rows were skipped.)' : '');
    $('coverage').textContent = info.count.toLocaleString('en-GB') + ' daily prices from ' + fmtDate(info.first) + ' to ' + fmtDate(info.last) + (info.gaps.length ? ' · ' + info.gaps.length + ' gaps in the data.' : ' · no gaps.');
  } catch (e) {
    $('source').textContent = 'We couldn’t load Bitcoin’s price history (' + e.message + '). Please reload. We never make up prices.';
    $('error').textContent = 'Price history is unavailable right now, so the forecast can’t be drawn.'; $('error').hidden = false;
    $('fHeadline').textContent = 'Forecast unavailable.';
    try { S.live = await fetchLive(); S.price = S.live.price; renderPrice(); } catch { $('change').textContent = 'No price available right now.'; }
    return;
  }
  renderPrice(); renderSeed(); drawYearChart(); renderForecast();
  await refreshLive(); startTimers();
})();
window.__garden = { S };
