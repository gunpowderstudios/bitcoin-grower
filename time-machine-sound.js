// Bitcoin Garden Time Machine — gentle synthesised sounds (v1.13.0).
// No audio files, no downloads, no tracking. Sound is ON by default, but browsers (Safari/iOS, Chrome) only
// allow audio after a click/tap, so it starts with the visitor's first click or tap anywhere on the page. Effects are rate-limited so fast-forwarding stays pleasant.
export function createSound() {
  let ctx = null, master = null, enabled = false, noiseBuf = null;
  const lastAt = {}, recent = [];

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    return ctx;
  }
  /** Call from a click/tap handler. Resumes a suspended context and plays an inaudible buffer (iOS unlock). */
  function unlock() {
    try {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
      s.buffer = b; s.connect(ctx.destination); s.start(0);
      return true;
    } catch { return false; }
  }
  function allowed(kind, minGap, perTwoSeconds = 99) {
    const now = performance.now();
    if (now - (lastAt[kind] || -1e9) < minGap) return false;
    while (recent.length && now - recent[0] > 2000) recent.shift();
    if (recent.length >= perTwoSeconds) return false;
    lastAt[kind] = now; recent.push(now);
    return true;
  }
  function tone(freq, start, dur, { type = 'sine', gain = 0.07, to = null, attack = 0.012 } = {}) {
    const t0 = ctx.currentTime + start, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master); osc.start(t0); osc.stop(t0 + dur + 0.03);
  }
  function noise(start, dur, { freq = 3200, q = 0.8, gain = 0.035 } = {}) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t0 = ctx.currentTime + start, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.05);
  }

  const effects = {
    // soft metallic "clink" for a harvest
    clink(fast) {
      if (!allowed('clink', fast ? 700 : 220, 4)) return;
      const p = 1 + (Math.random() - 0.5) * 0.06;
      tone(1568 * p, 0, 0.32, { gain: 0.05 }); tone(2349 * p, 0.01, 0.22, { gain: 0.03 }); tone(3136 * p, 0.0, 0.08, { type: 'triangle', gain: 0.02 });
      tone(1760 * p, 0.09, 0.28, { gain: 0.035 });
    },
    // a quiet low "plop" when seeds are planted (a buy)
    plant(fast) { if (!allowed('plant', fast ? 900 : 350, 3)) return; tone(220, 0, 0.18, { gain: 0.06, to: 150 }); },
    // gentle rising whoosh + rustle when the plant reaches a new stage
    grow(fast) {
      if (!allowed('grow', 600, 2)) return;
      tone(330, 0, 0.55, { gain: 0.045, to: 587, attack: 0.08 }); tone(494, 0.12, 0.5, { gain: 0.03, to: 880, attack: 0.08 });
      if (!fast) noise(0.05, 0.45, { freq: 2600, gain: 0.03 });
    },
    rustle(fast) { if (fast || !allowed('rustle', 1200, 1)) return; noise(0, 0.35, { freq: 3800, q: 1.2, gain: 0.025 }); },
    // little tune when the journey ends
    done() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => { tone(f, i * 0.13, 0.7, { gain: 0.06, attack: 0.02 }); tone(f * 2, i * 0.13, 0.35, { type: 'triangle', gain: 0.012 }); });
      tone(1568, 0.62, 0.5, { gain: 0.035 });
    }
  };

  function play(kind, { fast = false } = {}) {
    if (!enabled || !ctx) return;
    try {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      effects[kind]?.(fast);
    } catch { /* never let audio break the game */ }
  }
  function setEnabled(on) {
    enabled = !!on;
    if (enabled) {
      if (!unlock()) { enabled = false; return false; }
      play('grow', { fast: true });
    }
    return enabled;
  }
  /** Mark sound as on without creating audio yet; the first click, tap or key press unlocks it. */
  function enableWhenAllowed() {
    enabled = true;
    const go = () => { for (const ev of ['click', 'touchend', 'keydown']) document.removeEventListener(ev, go, true); if (enabled) unlock(); };
    for (const ev of ['click', 'touchend', 'keydown']) document.addEventListener(ev, go, true);
  }
  document.addEventListener('visibilitychange', () => { if (ctx && document.hidden) ctx.suspend?.().catch(() => {}); });
  return { play, setEnabled, enableWhenAllowed, unlock, get enabled() { return enabled; } };
}
