/* Petits effets sonores synthétisés (aucun fichier audio nécessaire) */
(function (G) {
  'use strict';
  let ctx = null, master = null, noiseBuf = null;
  let boostNode = null, windNode = null, windGain = null;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = G.AudioContext || G.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function enabled() { return G.Save && G.Save.data.settings.sound; }

  function tone(freq, dur, type = 'sine', vol = 0.3, slideTo = null, delay = 0) {
    if (!enabled() || !ensure()) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, vol = 0.3, freq = 800, q = 1, slideTo = null) {
    if (!enabled() || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function loopNoise(freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master);
    src.start();
    return { src, f, g };
  }

  const Sfx = {
    unlock() { if (enabled()) ensure(); },
    launch() { noise(0.5, 0.35, 400, 0.8, 2000); },
    pickup(type) {
      if (type === 'coin') { tone(988, 0.08, 'square', 0.08); tone(1319, 0.15, 'square', 0.08, null, 0.07); }
      else if (type === 'boost') { tone(300, 0.25, 'sawtooth', 0.12, 900); }
      else if (type === 'speed') { tone(500, 0.2, 'triangle', 0.25, 1500); noise(0.25, 0.15, 3000, 1); }
      else if (type === 'lift') { tone(400, 0.35, 'sine', 0.3, 1200); }
    },
    bounce() { tone(180, 0.18, 'sine', 0.4, 90); },
    land() { noise(0.35, 0.3, 300, 0.7, 120); },
    skill() { tone(600, 0.12, 'triangle', 0.25); tone(900, 0.2, 'triangle', 0.25, null, 0.08); },
    click() { tone(700, 0.05, 'triangle', 0.12); },
    buy() { tone(880, 0.08, 'square', 0.08); tone(1175, 0.08, 'square', 0.08, null, 0.06); tone(1568, 0.16, 'square', 0.08, null, 0.12); },
    error() { tone(200, 0.15, 'square', 0.08, 150); },
    levelUp() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.2, null, i * 0.1)); },
    record() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'square', 0.07, null, i * 0.08)); },

    // Sons continus : vent (selon la vitesse) et boost
    update(speed, boosting, active) {
      if (!ctx || !enabled()) { if (windGain) this.silence(); return; }
      if (!windNode) { windNode = loopNoise(500, 0.6); windGain = windNode.g; }
      if (!boostNode) boostNode = loopNoise(180, 1.5);
      const t = ctx.currentTime;
      const w = active ? Math.min(0.12, speed / 400) : 0;
      windGain.gain.setTargetAtTime(w, t, 0.1);
      windNode.f.frequency.setTargetAtTime(300 + speed * 25, t, 0.1);
      boostNode.g.gain.setTargetAtTime(active && boosting ? 0.25 : 0, t, 0.05);
    },
    silence() {
      if (!ctx) return;
      const t = ctx.currentTime;
      if (windGain) windGain.gain.setTargetAtTime(0, t, 0.05);
      if (boostNode) boostNode.g.gain.setTargetAtTime(0, t, 0.05);
    },
  };

  G.Sfx = Sfx;
})(window);
