// The Bitcoin Garden — side-by-side gardens (used for the forward-in-time forecast).
import { plantFor, formatGBP, signedPct } from './time-machine-engine.js?v=1.14.4';
import { createPlant } from './time-machine-plant.js?v=1.14.4-fruit-2';

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DURATION = 24000; // ms for the whole journey
const fmtDate = d => Number(d.slice(8)) + ' ' + MONTHS[Number(d.slice(5, 7)) - 1] + ' ' + d.slice(0, 4);
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createRace($, ids = {}, opts = {}) {
  const I = { section: 'race', beds: 'beds', date: 'raceDate', scrub: 'raceScrub', play: 'racePlay', restart: 'raceRestart', note: 'raceNote', ...ids };
  const R = { beds: [], N: 0, cursor: 0, state: 'idle', raf: 0, last: 0 };
  const stop = () => { cancelAnimationFrame(R.raf); R.raf = 0; };

  function mount(list) { // list: [{key, emoji, name, sub?, cash?, sim:{settings:{amount}, frames, events, summary}}]
    const box = $(I.beds); box.replaceChildren(); R.beds = [];
    list.forEach((d, n) => {
      const el = document.createElement('div'); el.className = 'bed'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', d.name);
      el.innerHTML = '<div class="badges"></div><svg class="plant" aria-hidden="true"></svg><div class="bedinfo"><b class="bn"></b><strong class="bv"></strong><span class="bg"></span><small class="bs"></small></div>';
      el.querySelector('.bn').textContent = d.emoji + ' ' + d.name;
      box.appendChild(el);
      const plant = createPlant(el.querySelector('svg.plant'), (opts.uid || 'bd') + n);
      R.beds.push({ ...d, el, plant, last: -1,
        v: el.querySelector('.bv'), g: el.querySelector('.bg'), s: el.querySelector('.bs'), badges: el.querySelector('.badges') });
    });
    R.N = R.beds[0].sim.frames.length;
    const sc = $(I.scrub); sc.min = 0; sc.max = R.N - 1; sc.value = 0;
  }
  function update(idx, animate) {
    idx = Math.max(0, Math.min(R.N - 1, Math.round(idx)));
    $(I.date).textContent = fmtDate(R.beds[0].sim.frames[idx].date);
    $(I.scrub).value = idx;
    let fallingCoins = 0;
    for (const b of R.beds) {
      const beforeCoins = b.plant.coins;
      const f = b.sim.frames[idx], start = b.sim.settings.amount, ratio = f.total / start, pl = plantFor(ratio, true);
      b.plant.setState(pl.stage, pl.droop);
      // forecast gardens: coins mark milestones; Pruning gardens: coins are the ones really pruned
      b.plant.setFruit(ratio, animate && !reduceMotion(), b.cash ? { count: f.sells, label: '' } : {});
      if (animate && !reduceMotion() && b.plant.coins > beforeCoins) fallingCoins += b.plant.coins - beforeCoins;
      b.v.textContent = formatGBP(f.total);
      const pnl = f.total - start, up = pnl > 0.004, down = pnl < -0.004;
      b.g.className = 'bg ' + (up ? 'gain' : down ? 'loss' : '');
      b.g.textContent = (up ? '▲ ' : down ? '▼ ' : '■ ') + signedPct(100 * (f.total / start - 1));
      b.s.textContent = b.cash ? (f.sells ? '✂️ ' + f.sells + (f.sells === 1 ? ' coin' : ' coins') + ' pruned · ' + formatGBP(f.cash).replace(/\.00$/, '') + ' in pocket' : '✂️ nothing pruned yet') : (b.sub || '');
      b.el.querySelector('.bn').title = pl.name;
    }
    if (fallingCoins && typeof opts.onCoinsFall === 'function') opts.onCoinsFall(fallingCoins);
  }

  function finish() {
    stop(); R.state = 'done'; $(I.play).textContent = '▶ Play again';
    $(I.note).textContent = opts.finishNote ? opts.finishNote(R.beds) : '';
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
    R.state = 'playing'; R.last = performance.now(); $(I.play).textContent = '⏸ Pause'; $(I.note).textContent = '';
    for (const b of R.beds) b.badges.replaceChildren();
    R.raf = requestAnimationFrame(frame);
  }
  function pause() { stop(); R.state = 'paused'; $(I.play).textContent = '▶ Play'; }
  function reset() { stop(); for (const b of R.beds) { b.plant.reset(); b.badges.replaceChildren(); } R.cursor = 0; R.state = 'ready'; update(0, false); $(I.note).textContent = ''; }

  $(I.play).onclick = () => (R.state === 'playing' ? pause() : play());
  $(I.restart).onclick = () => { reset(); play(); };
  $(I.scrub).oninput = e => {
    if (R.state === 'playing') pause();
    const i = Number(e.target.value);
    if (i < R.cursor) for (const b of R.beds) { b.plant.reset(); }
    R.cursor = i; update(i, false); if (i >= R.N - 1) finish();
  };
  return {
    openBeds(list) {
      stop(); mount(list); $(I.section).hidden = false; R.state = 'ready'; R.cursor = 0; update(0, false); $(I.note).textContent = '';
      if (reduceMotion()) { update(R.N - 1, false); finish(); } else play();
    },
    close() { stop(); R.state = 'idle'; $(I.section).hidden = true; },
    get state() { return R.state; }, get beds() { return R.beds; }, get cursor() { return R.cursor; }
  };
}
