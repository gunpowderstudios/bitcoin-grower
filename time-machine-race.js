// The Bitcoin Garden — four gardens growing side by side (v1.12.0). Same money, same dates; only the pruning differs.
import { simulate, plantFor, formatGBP, signedGBP, signedPct, PRESETS, HOLD } from './time-machine-engine.js?v=1.12.0';
import { createPlant } from './time-machine-plant.js?v=1.12.0';

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DURATION = 24000; // ms for the whole journey
const fmtDate = d => Number(d.slice(8)) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRace($) {
  const R = { beds: [], N: 0, cursor: 0, state: 'idle', raf: 0, last: 0 };
  const stop = () => { cancelAnimationFrame(R.raf); R.raf = 0; };

  function build(steps, base) {
    const defs = [...Object.values(PRESETS).map(p => ({ key: p.key, emoji: p.emoji, name: p.name, set: { dipPct: p.dipPct, risePct: p.risePct, sellPct: p.sellPct } })),
      { key: 'hold', emoji: HOLD.emoji, name: HOLD.name, set: { strategy: 'hold' }, hold: true }];
    const box = $('beds'); box.replaceChildren(); R.beds = [];
    defs.forEach((d, n) => {
      const sim = simulate(steps, { ...base, ...d.set });
      const banked = []; let sum = 0, k = 0;
      for (const f of sim.frames) { while (k < f.events) { if (sim.events[k].side === 'SELL') sum += sim.events[k].gbp; k++; } banked.push(sum); }
      const el = document.createElement('div'); el.className = 'bed'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', d.name);
      el.innerHTML = '<div class="badges"></div><svg class="plant" aria-hidden="true"></svg><div class="bedinfo"><b class="bn"></b><strong class="bv"></strong><span class="bg"></span><small class="bs"></small></div>';
      el.querySelector('.bn').textContent = d.emoji + ' ' + d.name;
      box.appendChild(el);
      const plant = createPlant(el.querySelector('svg.plant'), 'bd' + n);
      R.beds.push({ ...d, sim, banked, el, plant, last: -1, lastSells: 0,
        v: el.querySelector('.bv'), g: el.querySelector('.bg'), s: el.querySelector('.bs'), badges: el.querySelector('.badges') });
    });
    R.N = R.beds[0].sim.frames.length;
    const sc = $('raceScrub'); sc.min = 0; sc.max = R.N - 1; sc.value = 0;
  }

  function update(idx, animate) {
    idx = Math.max(0, Math.min(R.N - 1, Math.round(idx)));
    $('raceDate').textContent = fmtDate(R.beds[0].sim.frames[idx].date);
    $('raceScrub').value = idx;
    for (const b of R.beds) {
      const f = b.sim.frames[idx], start = b.sim.settings.amount, ratio = f.total / start, pl = plantFor(ratio, true);
      b.plant.setState(pl.stage, pl.droop);
      if (f.sells !== b.lastSells) { b.plant.setCoins(f.sells, animate && f.sells > b.lastSells && !reduceMotion(), b.banked[idx]); b.lastSells = f.sells; }
      b.v.textContent = formatGBP(f.total);
      const pnl = f.total - start, up = pnl > 0.004, down = pnl < -0.004;
      b.g.className = 'bg ' + (up ? 'gain' : down ? 'loss' : '');
      b.g.textContent = (up ? '▲ ' : down ? '▼ ' : '■ ') + signedPct(100 * (f.total / start - 1));
      b.s.textContent = b.hold ? 'No selling, ever' : f.sells + (f.sells === 1 ? ' sale' : ' sales') + (f.sells ? ' · ' + formatGBP(b.banked[idx]).replace(/\.00$/, '') + ' banked' : '');
      b.el.querySelector('.bn').title = pl.name;
    }
    R.cursor = idx;
  }

  function finish() {
    stop(); R.state = 'done'; $('racePlay').textContent = '▶ Play again';
    const last = R.beds.map(b => ({ b, end: b.sim.summary.end, fall: b.sim.summary.maxDrawdown }));
    const top = last.reduce((a, c) => (c.end > a.end ? c : a)), smooth = last.reduce((a, c) => (c.fall < a.fall ? c : a));
    for (const b of R.beds) b.badges.replaceChildren();
    const badge = (b, t) => { const s = document.createElement('span'); s.className = 'badge2'; s.textContent = t; b.badges.appendChild(s); };
    badge(top.b, '🏆 Biggest pot');
    badge(smooth.b, top.b === smooth.b ? '🛡️ Smoothest too' : '🛡️ Smoothest ride');
    $('raceNote').textContent = top.b === smooth.b
      ? top.b.name + ' finished with the biggest pot (' + formatGBP(top.end) + ') and the smallest fall along the way (' + Math.round(top.fall) + '%) over this period.'
      : top.b.name + ' finished with the biggest pot (' + formatGBP(top.end) + ') but fell as far as ' + Math.round(top.fall) + '% along the way. ' + smooth.b.name + ' had the smoothest ride (biggest fall ' + Math.round(smooth.fall) + '%) but finished with ' + formatGBP(smooth.end) + '. Over a different period the order could be completely different.';
  }
  function frame(t) {
    const dt = Math.min(100, t - R.last); R.last = t;
    R.cursor += dt * R.N / DURATION;
    if (R.cursor >= R.N - 1) { update(R.N - 1, true); finish(); return; }
    update(R.cursor, true);
    R.raf = requestAnimationFrame(frame);
  }
  function play() {
    if (R.state === 'done') { reset(); }
    R.state = 'playing'; R.last = performance.now(); $('racePlay').textContent = '⏸ Pause'; $('raceNote').textContent = '';
    for (const b of R.beds) b.badges.replaceChildren();
    R.raf = requestAnimationFrame(frame);
  }
  function pause() { stop(); R.state = 'paused'; $('racePlay').textContent = '▶ Play'; }
  function reset() { stop(); for (const b of R.beds) { b.plant.reset(); b.lastSells = 0; b.badges.replaceChildren(); } R.cursor = 0; R.state = 'ready'; update(0, false); $('raceNote').textContent = ''; }

  $('racePlay').onclick = () => (R.state === 'playing' ? pause() : play());
  $('raceRestart').onclick = () => { reset(); play(); };
  $('raceScrub').oninput = e => {
    if (R.state === 'playing') pause();
    const i = Number(e.target.value);
    if (i < R.cursor) for (const b of R.beds) { b.plant.reset(); b.lastSells = 0; }
    update(i, false); if (i >= R.N - 1) finish();
  };
  return {
    open(steps, base) {
      stop(); build(steps, base); $('race').hidden = false; R.state = 'ready'; R.cursor = 0; update(0, false);
      $('raceNote').textContent = '';
      if (reduceMotion()) { update(R.N - 1, false); finish(); } else play();
    },
    close() { stop(); R.state = 'idle'; $('race').hidden = true; },
    get state() { return R.state; }, get beds() { return R.beds; }, get cursor() { return R.cursor; }
  };
}
