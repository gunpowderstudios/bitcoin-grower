// The Bitcoin Garden — the little gardener who explains what is happening (v1.13.0). Decoration + speech bubble.
const NS = 'http://www.w3.org/2000/svg';
export function createGardener(host) {
  const wrap = document.createElement('div');
  wrap.className = 'gardener'; wrap.setAttribute('aria-hidden', 'true'); // the page's status line already announces what happens
  const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.hidden = true;
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 80 112'); svg.setAttribute('class', 'gsvg');
  const add = (tag, a) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
  add('ellipse', { cx: 29, cy: 107, rx: 11, ry: 5, fill: '#5a3a20' }); add('ellipse', { cx: 51, cy: 107, rx: 11, ry: 5, fill: '#5a3a20' });
  add('rect', { x: 20, y: 62, width: 40, height: 42, rx: 10, fill: '#3c78b4' });
  add('rect', { x: 27, y: 56, width: 26, height: 22, rx: 6, fill: '#f6e6c4' });
  add('rect', { x: 27, y: 66, width: 26, height: 30, rx: 5, fill: '#3c78b4' });
  add('circle', { cx: 31, cy: 70, r: 2.4, fill: '#f4c84a' }); add('circle', { cx: 49, cy: 70, r: 2.4, fill: '#f4c84a' });
  const arm = add('rect', { class: 'garm', x: 52, y: 60, width: 22, height: 8, rx: 4, fill: '#f6e6c4' });
  add('rect', { x: 6, y: 60, width: 22, height: 8, rx: 4, fill: '#f6e6c4' });
  add('circle', { cx: 40, cy: 40, r: 16, fill: '#f2c9a0' });
  add('circle', { cx: 33, cy: 40, r: 2, fill: '#3a2a1a' }); add('circle', { cx: 47, cy: 40, r: 2, fill: '#3a2a1a' });
  add('circle', { cx: 29, cy: 46, r: 3, fill: '#f0a58a', opacity: 0.55 }); add('circle', { cx: 51, cy: 46, r: 3, fill: '#f0a58a', opacity: 0.55 });
  add('path', { d: 'M33 47 Q40 54 47 47', fill: 'none', stroke: '#3a2a1a', 'stroke-width': 2, 'stroke-linecap': 'round' });
  add('ellipse', { cx: 40, cy: 29, rx: 30, ry: 7, fill: '#e8c36a', stroke: '#b98f2e', 'stroke-width': 1.2 });
  add('path', { d: 'M23 29 Q40 4 57 29Z', fill: '#e8c36a', stroke: '#b98f2e', 'stroke-width': 1.2 });
  add('rect', { x: 24, y: 23, width: 32, height: 5, rx: 2, fill: '#c0463a' });
  wrap.append(bubble, svg); host.appendChild(wrap);
  let timer = 0, shownAt = 0, shownPriority = 0;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return {
    /** Show a message. A newer message replaces an older one unless the older one is more important and still fresh. */
    say(text, { priority = 1, ms = 5200 } = {}) {
      if (!text) return false;
      const age = now() - shownAt;
      if (!bubble.hidden && age < 1800 && priority < shownPriority) return false;
      bubble.textContent = text; bubble.hidden = false; shownAt = now(); shownPriority = priority;
      wrap.classList.remove('talking'); void wrap.offsetWidth; wrap.classList.add('talking');
      clearTimeout(timer); timer = setTimeout(() => { bubble.hidden = true; wrap.classList.remove('talking'); }, ms);
      return true;
    },
    clear() { clearTimeout(timer); bubble.hidden = true; wrap.classList.remove('talking'); shownAt = 0; shownPriority = 0; },
    get text() { return bubble.hidden ? '' : bubble.textContent; }
  };
}
