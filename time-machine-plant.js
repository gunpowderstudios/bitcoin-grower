// Bitcoin Garden Time Machine — the living plant (v1.13.4).
// Three simple stages: a shoot, a small tree, then an oak. One persistent SVG; parts cross-fade and sway with CSS.
// Milestone coins ripen on the leaves and drop to the ground like apples.
import { coinsFor } from './time-machine-engine.js?v=1.13.4';
const NS = 'http://www.w3.org/2000/svg';
const LEAF = 'M0 0 C6 -7 20 -8 30 0 C20 8 6 7 0 0Z';
const GROUND = 279; // y where fallen coins rest
const SLOT_DX = [-62, 58, -34, 36, -88, 84]; // where fallen coins land, either side of the trunk
// Where coins can ripen, per stage (leaf tips on the crown). The shoot is too young for fruit.
const SPOTS = [
  [],
  [[126, 170], [236, 170], [150, 150], [210, 148], [180, 122]],
  [[92, 134], [268, 134], [122, 158], [238, 158], [146, 98], [214, 98], [180, 68], [100, 108], [260, 108]]
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
  const leafLight = grad('tmLeafA', [[0, '#b9e87a'], [1, '#6cbf4e']]);
  const leafDark = grad('tmLeafB', [[0, '#5fb04b'], [1, '#2f7d3f']]);
  const crownTone = grad('tmCrown', [[0, '#4fa646'], [1, '#2c7440']]);
  grad('tmTrunk', [[0, '#a9764a'], [1, '#6b4429']]);
  grad('tmSoil', [[0, '#7a5638'], [1, '#4a3322']]);
  const coinG = el('radialGradient', { id: 'tmCoin', cx: '35%', cy: '30%', r: '75%' }, defs);
  el('stop', { offset: 0, 'stop-color': '#fff1a8' }, coinG); el('stop', { offset: 0.55, 'stop-color': '#f2c444' }, coinG); el('stop', { offset: 1, 'stop-color': '#c28a16' }, coinG);
  const glowG = el('radialGradient', { id: 'tmGlow' }, defs);
  el('stop', { offset: 0, 'stop-color': '#ffe58a', 'stop-opacity': 0.55 }, glowG); el('stop', { offset: 1, 'stop-color': '#ffe58a', 'stop-opacity': 0 }, glowG);
  const sym = el('symbol', { id: 'tmLeaf', overflow: 'visible' }, defs);
  el('path', { d: LEAF }, sym);
  el('path', { d: 'M2 0 C10 0 18 -.5 27 0', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 1, fill: 'none', 'stroke-linecap': 'round' }, sym);

  // ----- scenery -----
  const glow = el('circle', { class: 'tm-glow', cx: 190, cy: 110, r: 130, fill: 'url(#tmGlow)' }, svg);
  el('ellipse', { cx: 180, cy: 272, rx: 150, ry: 24, fill: 'url(#tmSoil)' }, svg);
  el('ellipse', { cx: 180, cy: 264, rx: 128, ry: 14, fill: '#8a6240', opacity: 0.55 }, svg);
  for (let i = 0; i < 9; i++) el('ellipse', { cx: 70 + rand() * 220, cy: 268 + rand() * 14, rx: 2 + rand() * 3, ry: 1.5 + rand() * 1.5, fill: '#3b291b', opacity: 0.55 }, svg);
  const grass = el('g', { fill: 'none', stroke: '#5fae4c', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, svg);
  [[96, 266], [118, 270], [236, 268], [300, 270], [64, 272]].forEach(([x, y]) => el('path', { d: `M${x} ${y} q-3 -9 -6 -13 M${x} ${y} q1 -10 2 -15 M${x} ${y} q4 -8 8 -11` }, grass));

  // ----- the plant, one group per stage, cross-fading and growing from the soil -----
  const sway = el('g', { class: 'tm-sway' }, svg);
  const parts = [];
  const part = n => { const g = el('g', { class: 'tm-part', 'data-n': n }, sway); parts[n] = g; return g; };
  const leaf = (parent, x, y, angle, scale, droopDir, tone = 'A') => {
    const outer = el('g', { transform: `translate(${x} ${y}) scale(${scale})` }, parent);
    const inner = el('g', { class: 'tm-leaf', style: `--a:${angle}deg;--dd:${droopDir * 38}deg` }, outer);
    el('use', { href: '#tmLeaf', fill: `url(#tmLeaf${tone})` }, inner);
    return inner;
  };
  const pair = (parent, x, y, spread, scale, tone) => { // a pair of leaves either side of a stem
    leaf(parent, x, y, -spread, scale, 1, tone); leaf(parent, x, y, -180 + spread, scale, -1, tone === 'A' ? 'B' : 'A');
  };
  const stem = (parent, d, w, color = '#6fb552') => el('path', { d, fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, parent);
  const blob = (parent, cx, cy, rx, ry) => el('ellipse', { cx, cy, rx, ry, fill: 'url(#tmCrown)' }, parent);
  const ring = (parent, cx, cy, rx, ry, n, scale, from = 0, to = 360) => {
    for (let i = 0; i < n; i++) {
      const t = (from + (to - from) * (i + rand() * 0.6) / n) * Math.PI / 180;
      const k = 0.58 + rand() * 0.22, x = cx + Math.cos(t) * rx * k, y = cy + Math.sin(t) * ry * k;
      const ang = Math.round(t * 180 / Math.PI + (rand() - 0.5) * 50);
      const right = Math.cos(t) >= 0;
      leaf(parent, x, y, ang, scale * (0.85 + rand() * 0.4), right ? 1 : -1, rand() > 0.5 ? 'A' : 'B');
    }
  };

  // 0 — a shoot
  const p0 = part(0);
  stem(p0, 'M180 264 C180 250 182 238 182 224', 5);
  leaf(p0, 181, 242, -28, 0.8, 1); leaf(p0, 181, 242, -152, 0.8, -1, 'B');
  leaf(p0, 182, 224, -52, 1.0, 1); leaf(p0, 182, 224, -128, 1.0, -1, 'B');
  leaf(p0, 182, 222, -90, 0.7, 1);
  // 1 — a small tree
  const p1 = part(1);
  el('path', { d: 'M170 266 C174 240 176 210 178 176 L186 176 C188 210 190 240 194 266Z', fill: 'url(#tmTrunk)' }, p1);
  stem(p1, 'M179 200 C168 190 158 184 148 174', 5, '#7e5333'); stem(p1, 'M185 194 C196 184 206 178 216 170', 5, '#7e5333');
  [[180, 138, 56, 42], [146, 160, 34, 26], [216, 158, 34, 26]].forEach(a => blob(p1, ...a));
  ring(p1, 180, 142, 66, 46, 20, 1.15);
  // 2 — an oak
  const p2 = part(2);
  el('path', { d: 'M150 268 C164 246 168 210 170 150 L192 150 C194 210 198 246 212 268 C196 262 166 262 150 268Z', fill: 'url(#tmTrunk)' }, p2);
  [['M172 210 C154 198 138 186 122 168', 9], ['M190 196 C210 182 228 170 246 152', 9], ['M178 160 C166 140 156 124 144 106', 6], ['M186 150 C198 130 208 114 222 96', 6]].forEach(([d, w]) => stem(p2, d, w, '#774d2f'));
  [[180, 100, 92, 62], [108, 128, 54, 42], [252, 128, 56, 44], [146, 62, 52, 38], [214, 62, 52, 38], [180, 150, 62, 28]].forEach(a => blob(p2, ...a));
  ring(p2, 180, 98, 108, 70, 44, 1.35);
  function coinShape(parent, r) {
    el('circle', { r, fill: 'url(#tmCoin)', stroke: '#b4801a', 'stroke-width': 1.2 }, parent);
    el('circle', { r: r * 0.72, fill: 'none', stroke: '#fbe89a', 'stroke-width': 0.8 }, parent);
    const t = el('text', { y: r * 0.36, 'text-anchor': 'middle', 'font-size': r * 1.05, 'font-weight': 700, fill: '#8c5f0e', 'font-family': 'system-ui,sans-serif' }, parent);
    t.textContent = '₿';
  }

  // ----- apples: coins ripen on a leaf, then drop to the ground -----
  const pile = el('g', { class: 'tm-pile' }, svg);
  const pileLabel = el('text', { x: 180, y: 296, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#ffe9a0', 'font-family': 'system-ui,sans-serif' }, svg);

  function setFruit(ratio, animate = true) {
    const n = coinsFor(ratio);
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
    pileLabel.textContent = n && Number.isFinite(ratio) ? 'Worth ' + (ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)) + '× what you planted' : '';
  }

  // ----- public controls -----
  const L = { dry: ['#d3d06c', '#a39a45'], crown: ['#8c9244', '#5c6a35'], dark: ['#9fa04a', '#6b6a30'] };
  function setState(nextStage, droop = 0) {
    droop = Math.max(0, Math.min(1, droop));
    svg.style.setProperty('--droop', droop.toFixed(3));
    const t = droop * 0.85;
    leafLight[0].setAttribute('stop-color', mix('#b9e87a', L.dry[0], t)); leafLight[1].setAttribute('stop-color', mix('#6cbf4e', L.dry[1], t));
    leafDark[0].setAttribute('stop-color', mix('#5fb04b', L.dark[0], t)); leafDark[1].setAttribute('stop-color', mix('#2f7d3f', L.dark[1], t));
    crownTone[0].setAttribute('stop-color', mix('#4fa646', L.crown[0], t)); crownTone[1].setAttribute('stop-color', mix('#2c7440', L.crown[1], t));
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
