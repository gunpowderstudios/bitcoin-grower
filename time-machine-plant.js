// Bitcoin Garden Time Machine — the living plant (v1.14.0).
// Three simple stages: a shoot, a small tree, then an oak. One persistent SVG; parts cross-fade and sway with CSS.
// Milestone coins ripen on the leaves and drop to the ground like apples.
import { coinsFor } from './time-machine-engine.js?v=1.14.0';
const NS = 'http://www.w3.org/2000/svg';
const LEAF = 'M0 0 C6 -7 20 -8 30 0 C20 8 6 7 0 0Z';
const GROUND = 270; // y where fallen coins rest
const SLOT_DX = [-62, 58, -34, 36, -88, 84, -112, 110]; // where fallen coins land, either side of the trunk
// Where coins can ripen, per stage (leaf tips on the crown).
const SPOTS = [
  [[166, 226], [198, 226]],
  [[150, 180], [210, 180], [165, 146], [196, 144], [180, 112]],
  [[110, 118], [250, 118], [150, 66], [212, 66], [180, 92], [180, 134], [104, 148], [260, 150], [140, 134]]
];
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function createPlant(svg, uid = 'tm') {
  const rand = rng(1830);
  svg.setAttribute('viewBox', '0 -50 360 350');
  svg.setAttribute('role', 'img');
  svg.replaceChildren();
  let stage = 0, coins = 0;
  const fallen = [];

  // ----- gradients (their colours are updated as the plant wilts or perks up) -----
  const defs = el('defs', {}, svg);
  const grad = (id, stops, extra = {}) => {
    const g = el('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1, ...extra }, defs);
    return stops.map(([o, c]) => el('stop', { offset: o, 'stop-color': c }, g));
  };
  // Flat 2D look: every "gradient" is a single colour, kept as a gradient only so droop can re-tint it.
  const leafLight = grad('tmLeafA', [[0, '#8cc65a'], [1, '#8cc65a']]);
  const leafDark = grad('tmLeafB', [[0, '#6aaa48'], [1, '#6aaa48']]);
  const crownTone = grad('tmCrown', [[0, '#7fb355'], [1, '#7fb355']]);
  const sym = el('symbol', { id: 'tmLeaf', overflow: 'visible' }, defs);
  el('path', { d: LEAF }, sym);

  // ----- scenery: flat ground -----
  el('ellipse', { cx: 180, cy: 272, rx: 150, ry: 22, fill: '#8a6240' }, svg);
  el('ellipse', { cx: 180, cy: 266, rx: 132, ry: 12, fill: '#9c7149' }, svg);
  const grass = el('g', { fill: 'none', stroke: '#6aaa48', 'stroke-width': 2.4, 'stroke-linecap': 'round' }, svg);
  [[96, 266], [118, 270], [236, 268], [300, 270], [64, 272]].forEach(([x, y]) => el('path', { d: `M${x} ${y} q-3 -9 -6 -13 M${x} ${y} q1 -10 2 -15 M${x} ${y} q4 -8 8 -11` }, grass));

  // ----- the plant, one flat group per stage, cross-fading and growing from the soil -----
  const TRUNK = '#7d5a40';
  const sway = el('g', { class: 'tm-sway' }, svg);
  const parts = [];
  const part = n => { const g = el('g', { class: 'tm-part', 'data-n': n }, sway); parts[n] = g; return g; };
  const leaf = (parent, x, y, angle, scale, droopDir, tone = 'A') => {
    const outer = el('g', { transform: `translate(${x} ${y}) scale(${scale})` }, parent);
    const inner = el('g', { class: 'tm-leaf', style: `--a:${angle}deg;--dd:${droopDir * 38}deg` }, outer);
    el('use', { href: '#tmLeaf', fill: `url(#tmLeaf${tone})` }, inner);
    return inner;
  };
  const stem = (parent, d, w, color = TRUNK) => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, parent);
  const disc = (parent, cx, cy, r) => el('circle', { cx, cy, r, fill: 'url(#tmCrown)' }, parent);

  // 0 — a shoot
  const p0 = part(0);
  stem(p0, 'M180 266 C180 252 182 240 182 224', 5, '#6aaa48');
  leaf(p0, 181, 244, -28, 0.85, 1); leaf(p0, 181, 244, -152, 0.85, -1, 'B');
  leaf(p0, 182, 224, -55, 1.05, 1); leaf(p0, 182, 224, -125, 1.05, -1, 'B');
  // 1 — a small tree
  const p1 = part(1);
  el('path', { d: 'M173 268 L178 196 L188 196 L193 268Z', fill: TRUNK }, p1);
  [[180, 112, 26], [180, 148, 38], [180, 182, 50]].forEach(a => disc(p1, ...a));
  stem(p1, 'M183 222 L183 150', 6); stem(p1, 'M182 212 L166 190', 5); stem(p1, 'M184 196 L200 172', 5);
  // 2 — an oak
  const p2 = part(2);
  el('path', { d: 'M166 268 C174 244 176 204 174 150 L194 150 C192 204 194 244 204 268Z', fill: TRUNK }, p2);
  [[180, 90, 54], [122, 116, 40], [240, 116, 42], [150, 66, 34], [212, 66, 34], [180, 132, 52], [104, 148, 28], [258, 150, 28]].forEach(a => disc(p2, ...a));
  stem(p2, 'M184 240 L184 118', 9); stem(p2, 'M182 200 L152 160', 7); stem(p2, 'M186 190 L218 150', 7); stem(p2, 'M183 150 L150 118', 6);
  function coinShape(parent, r) { // the classic flat orange Bitcoin coin
    el('circle', { r, fill: '#f7931a' }, parent);
    el('circle', { r: r * 0.82, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 0.9 }, parent);
    const t = el('text', { y: r * 0.38, 'text-anchor': 'middle', 'font-size': r * 1.2, 'font-weight': 800, fill: '#ffffff', 'font-family': 'system-ui,sans-serif', transform: 'rotate(-12)' }, parent);
    t.textContent = '₿';
  }

  // ----- apples: coins ripen on a leaf, then drop to the ground -----
  const pile = el('g', { class: 'tm-pile' }, svg);
  const pileLabel = el('text', { x: 180, y: 297, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#ffe9a0', 'font-family': 'system-ui,sans-serif' }, svg);

  // Normally coins mark milestones (how many times what you planted the pot is worth). In cash-in mode the caller passes
  // opts.count (apples really picked) and opts.label instead.
  function setFruit(ratio, animate = true, opts = {}) {
    const total = Number.isFinite(opts.count) ? Math.max(0, opts.count) : coinsFor(ratio);
    const n = Math.min(total, SLOT_DX.length);
    while (fallen.length > n) fallen.pop().remove();
    const before = fallen.length;
    for (let i = before; i < n; i++) {
      const slotX = 180 + SLOT_DX[i % SLOT_DX.length], slotY = GROUND + ((i * 5) % 7) - 3;
      const g = el('g', { transform: `translate(${slotX} ${slotY})` }, pile);
      const inner = el('g', { class: 'tm-coin' }, g);
      coinShape(inner, 10.5);
      if (animate) {
        const spots = SPOTS[stage] && SPOTS[stage].length ? SPOTS[stage] : SPOTS[1];
        const spot = spots.reduce((a, b) => Math.abs(b[0] - slotX) < Math.abs(a[0] - slotX) ? b : a);
        inner.style.setProperty('--dx', (spot[0] - slotX) + 'px'); inner.style.setProperty('--dy', (spot[1] - slotY) + 'px');
        inner.style.animationDelay = ((i - before) * 0.9) + 's';
        inner.classList.add('apple');
      }
      fallen.push(g);
    }
    coins = n;
    pileLabel.textContent = typeof opts.label === 'string' ? opts.label : (n && Number.isFinite(ratio) ? 'Worth ' + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)) + '× what you planted' : '');
  }

  // ----- public controls -----
  const L = { dry: '#c9c764', dark: '#b3a850', crown: '#a3aa55' }; // flat colours the leaves fade to when the pot is down
  function setState(nextStage, droop = 0) {
    droop = Math.max(0, Math.min(1, droop));
    svg.style.setProperty('--droop', droop.toFixed(3));
    const t = droop * 0.85;
    const tint = (stops, base, dry) => stops.forEach(st => st.setAttribute('stop-color', mix(base, dry, t)));
    tint(leafLight, '#8cc65a', L.dry); tint(leafDark, '#6aaa48', L.dark); tint(crownTone, '#7fb355', L.crown);
    if (nextStage !== stage || !svg.dataset.ready) {
      const up = nextStage > stage;
      stage = nextStage;
      parts.forEach((g, n) => { g.classList.toggle('on', n === stage); g.classList.toggle('past', n < stage); g.classList.toggle('future', n > stage); });
      svg.dataset.stage = stage; svg.dataset.ready = '1';
      if (up && stage > 0) { svg.classList.remove('grew'); void svg.getBoundingClientRect(); svg.classList.add('grew'); }
    }
    svg.classList.toggle('droopy', droop > 0.05);
  }
  function perk() { svg.classList.remove('perk'); void svg.getBoundingClientRect(); svg.classList.add('perk'); }
  function reset() { setFruit(0, false); stage = -1; delete svg.dataset.ready; setState(0, 0); }

  setState(0, 0);
  if (uid !== 'tm') { // several plants on one page: give the colour gradients that change (leaves, crown) their own ids
    const swap = v => v && v.replace(/#tm(LeafA|LeafB|Crown)\)/g, '#' + uid + '$1)');
    svg.querySelectorAll('*').forEach(n => {
      const id = n.getAttribute('id'); if (id === 'tmLeafA' || id === 'tmLeafB' || id === 'tmCrown') n.setAttribute('id', uid + id.slice(2));
      for (const a of ['fill', 'stroke']) { const v = n.getAttribute(a); if (v && v.includes('#tm')) n.setAttribute(a, swap(v)); }
    });
  }
  return { setState, setFruit, perk, reset, get stage() { return stage; }, get coins() { return coins; } };
}
