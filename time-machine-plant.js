// Bitcoin Grower Time Machine — the living plant (v1.10.0).
// One persistent SVG: parts grow, fade and sway with CSS transitions instead of being redrawn.
// The picture is driven only by stage (0-6) and droop (0-1), both derived from the pot's real value.
const NS = 'http://www.w3.org/2000/svg';
const LEAF = 'M0 0 C6 -7 20 -8 30 0 C20 8 6 7 0 0Z';
const SPARK = 'M0 -11 L1.8 -1.8 L11 0 L1.8 1.8 L0 11 L-1.8 1.8 L-11 0 L-1.8 -1.8Z';
const COIN_SLOTS = (() => { // harvest coins stack up in a little pyramid beside the plant
  const out = []; const rows = [5, 4, 3, 2, 1];
  rows.forEach((n, r) => { for (let i = 0; i < n; i++) out.push({ x: 262 + (i - (n - 1) / 2) * 17 + 8, y: 276 - r * 13 }); });
  return out;
})();
const CANOPY_COINS = [[150, 70], [196, 52], [226, 88], [128, 104], [174, 100], [212, 124], [150, 134], [100, 76], [252, 70]];

function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const lerp = (a, b, t) => a + (b - a) * t;
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(lerp(v, hex(b)[i], t)).toString(16).padStart(2, '0')).join('');

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

export function createPlant(svg) {
  const rand = rng(1830);
  svg.setAttribute('viewBox', '0 -50 360 350');
  svg.setAttribute('role', 'img');
  svg.replaceChildren();
  let stage = 0, coins = 0;

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

  // 0 — seed in the soil
  const p0 = part(0);
  el('ellipse', { cx: 180, cy: 262, rx: 13, ry: 9, fill: '#6b4a2b', transform: 'rotate(-18 180 260)' }, p0);
  el('ellipse', { cx: 175, cy: 256, rx: 5, ry: 2.4, fill: '#a77b4b', transform: 'rotate(-18 177 259.5)' }, p0);
  el('path', { d: 'M174 264 q6 3 13 -1', stroke: '#4a321d', 'stroke-width': 1.2, fill: 'none', 'stroke-linecap': 'round' }, p0);
  // 1 — tiny shoot
  const p1 = part(1);
  stem(p1, 'M180 264 C180 254 181 247 182 240', 4);
  leaf(p1, 182, 240, -35, 0.55, 1); leaf(p1, 182, 240, -145, 0.55, -1, 'B');
  // 2 — seedling with two leaves
  const p2 = part(2);
  stem(p2, 'M180 264 C179 247 181 232 181 218', 5);
  leaf(p2, 181, 228, -22, 0.95, 1); leaf(p2, 181, 228, -158, 0.95, -1, 'B');
  leaf(p2, 181, 218, -78, 0.6, 1); leaf(p2, 181, 218, -102, 0.6, -1, 'B');
  // 3 — growing plant
  const p3 = part(3);
  stem(p3, 'M180 264 C176 236 184 208 181 168', 7);
  pair(p3, 179, 244, 22, 1.0); pair(p3, 181, 220, 28, 1.15, 'B'); pair(p3, 182, 196, 30, 1.1); pair(p3, 181, 174, 40, 0.9, 'B');
  leaf(p3, 181, 168, -90, 0.8, 1);
  // 4 — bush
  const p4 = part(4);
  blob(p4, 180, 218, 74, 44); blob(p4, 140, 232, 44, 28); blob(p4, 224, 230, 46, 30);
  stem(p4, 'M180 264 C178 240 182 206 180 160', 8); stem(p4, 'M178 262 C160 238 146 214 128 196', 6); stem(p4, 'M182 262 C202 238 216 214 234 196', 6);
  ring(p4, 180, 214, 78, 44, 26, 1.1);
  pair(p4, 180, 188, 35, 1.2); pair(p4, 181, 168, 45, 1.0, 'B'); leaf(p4, 180, 160, -90, 0.9, 1);
  // 5 — small tree
  const p5 = part(5);
  el('path', { d: 'M168 266 C173 238 175 208 177 168 L187 168 C189 208 190 238 196 266Z', fill: 'url(#tmTrunk)' }, p5);
  stem(p5, 'M178 206 C166 196 154 188 142 178', 6, '#7e5333'); stem(p5, 'M186 196 C200 186 212 178 224 166', 6, '#7e5333');
  [[180, 128, 66, 48], [132, 146, 40, 32], [228, 146, 42, 34], [180, 92, 44, 32]].forEach(a => blob(p5, ...a));
  ring(p5, 180, 124, 80, 56, 30, 1.2);
  // 6 — large golden tree
  const p6 = part(6);
  const aura = el('circle', { class: 'tm-aura', cx: 180, cy: 100, r: 120, fill: 'url(#tmGlow)' }, p6);
  aura.setAttribute('opacity', 0.9);
  el('path', { d: 'M156 268 C168 244 171 214 173 150 L189 150 C191 214 194 244 208 268 C196 262 164 262 156 268Z', fill: 'url(#tmTrunk)' }, p6);
  [['M176 214 C158 202 142 190 124 172', 8], ['M186 196 C206 182 224 170 244 150', 8], ['M180 160 C168 140 158 124 146 106', 6], ['M184 150 C196 130 206 114 220 96', 6]].forEach(([d, w]) => stem(p6, d, w, '#774d2f'));
  [[180, 96, 88, 62], [118, 120, 52, 40], [244, 118, 54, 42], [150, 58, 52, 36], [214, 56, 52, 38], [180, 146, 56, 28]].forEach(a => blob(p6, ...a));
  ring(p6, 180, 92, 104, 70, 46, 1.35);
  const canopy = el('g', { class: 'tm-canopy-coins' }, p6);
  CANOPY_COINS.forEach(([x, y], i) => {
    const c = el('g', { transform: `translate(${x} ${y})` }, canopy);
    const bob = el('g', { class: 'tm-hang', style: `animation-delay:${(i * 0.37).toFixed(2)}s` }, c);
    coinShape(bob, 9);
    el('path', { class: 'tm-spark', d: SPARK, fill: '#fff6c0', style: `animation-delay:${(i * 0.53).toFixed(2)}s` }, c);
  });

  function coinShape(parent, r) {
    el('circle', { r, fill: 'url(#tmCoin)', stroke: '#b4801a', 'stroke-width': 1.2 }, parent);
    el('circle', { r: r * 0.72, fill: 'none', stroke: '#fbe89a', 'stroke-width': 0.8 }, parent);
    const t = el('text', { y: r * 0.36, 'text-anchor': 'middle', 'font-size': r * 1.05, 'font-weight': 700, fill: '#8c5f0e', 'font-family': 'system-ui,sans-serif' }, parent);
    t.textContent = '₿';
  }

  // ----- harvested coins pile (in front, drawn last) -----
  const pile = el('g', { class: 'tm-pile' }, svg);
  const pileLabel = el('text', { x: 270, y: 296, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#ffe9a0', 'font-family': 'system-ui,sans-serif' }, svg);

  function setCoins(n, animate = true) {
    n = Math.max(0, n);
    const shown = Math.min(n, COIN_SLOTS.length), had = Math.min(coins, COIN_SLOTS.length);
    if (n < coins) pile.replaceChildren();
    const start = n < coins ? 0 : had;
    for (let i = start; i < shown; i++) {
      const s = COIN_SLOTS[i];
      const g = el('g', { transform: `translate(${s.x} ${s.y})` }, pile);
      const bounce = el('g', { class: 'tm-coin' + (animate ? ' drop' : '') }, g); coinShape(bounce, 8.5);
      if (animate) el('path', { class: 'tm-spark once', d: SPARK, fill: '#fff6c0' }, g);
    }
    coins = n;
    pileLabel.textContent = n ? (n === 1 ? '1 harvest' : n + ' harvests') : '';
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
  function reset() { setCoins(0, false); stage = -1; delete svg.dataset.ready; setState(0, 0); }

  setState(0, 0);
  return { setState, setCoins, perk, reset, get stage() { return stage; }, get coins() { return coins; } };
}
