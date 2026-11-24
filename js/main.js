/* Boucle principale, contrôles et déroulement d'une partie */
(function (G) {
  'use strict';
  const { Data, Physics, Save, Sfx, Renderer, UI } = G;
  const STEP = 1 / 120;
  const COIN_VALUE = 10;

  const canvas = document.getElementById('game');

  const S = {
    mode: 'menu',     // menu | play | results
    paused: false,
    stats: null, plane: null, world: null,
    trail: [], particles: [],
    aim: { active: false, angle: 0.5, power: 0, preview: [], sx: 0, sy: 0, pid: null },
    time: 0, acc: 0, endTimer: 0, banked: false,
    record: 0, lastDistance: 0,
    glidePointers: new Set(),
    keys: { glide: false, boost: false },
    boostHeld: false,
    drawAngle: null,
    hintShown: false,
  };

  // ---------------------------------------------------------------- Mise en place d'un vol
  function setupScene() {
    S.stats = Data.computeStats(Save.data);
    S.plane = Physics.newPlane(S.stats);
    S.world = Physics.newWorld(S.stats);
    S.trail = []; S.particles = [];
    S.aim.active = false; S.aim.preview = [];
    S.endTimer = 0; S.banked = false; S.acc = 0;
    S.drawAngle = null;
    S.record = Save.data.record;
    S.lastDistance = Save.data.lastDistance;
    S.glidePointers.clear();
    S.boostHeld = false;
    Renderer.updateCamera(S.plane, S.stats, 0, true);
  }

  function play() {
    maybeFullscreen();
    setupScene();
    S.mode = 'play';
    S.paused = false;
    UI.hideMenu(); UI.hideResults(); UI.hidePause();
    UI.buildHudSkills(S.stats);
    UI.hint("Glisse vers l'arrière puis relâche pour lancer ✈");
  }

  function toHangar() {
    S.mode = 'menu';
    S.paused = false;
    UI.hideResults(); UI.hidePause(); UI.hint(null);
    setupScene();
    UI.showMenu();
    Sfx.silence();
  }

  function liveMoney() {
    const p = S.plane;
    return Math.floor((Math.floor(p.maxX) + p.coins * COIN_VALUE) * S.stats.moneyMult);
  }

  // Calcule et enregistre les gains du vol
  function bank() {
    if (S.banked) return null;
    S.banked = true;
    const p = S.plane, d = Save.data;
    if (p.state === 'aim') return null;
    const dist = Math.floor(p.maxX);
    const money = liveMoney();
    const xp = Math.round((dist * 0.5 + p.pickups * 3) * S.stats.xpMult);
    const before = Data.levelInfo(d.xp).level;
    d.money += money;
    d.xp += xp;
    d.runs += 1;
    d.totalDistance += dist;
    d.lastDistance = dist;
    const newRecord = dist > d.record;
    if (newRecord) d.record = dist;
    const after = Data.levelInfo(d.xp).level;
    Save.write();
    return {
      dist, money, xp, newRecord, pickups: p.pickups,
      level: after, levelsGained: after - before,
      newSlots: Data.unlockedSlots(after) - Data.unlockedSlots(before),
    };
  }

  function finishRun() {
    const r = bank();
    S.mode = 'results';
    UI.hint(null);
    Sfx.silence();
    if (!r) { toHangar(); return; }
    UI.showResults(r);
    if (r.levelsGained > 0) { Sfx.levelUp(); UI.vibrate([30, 50, 30]); }
    else if (r.newRecord) Sfx.record();
  }

  function pause() {
    if (S.mode !== 'play' || S.paused) return;
    S.paused = true;
    S.glidePointers.clear(); S.keys.glide = false; S.keys.boost = false; S.boostHeld = false;
    UI.showPause();
    Sfx.silence();
  }
  function resume() { S.paused = false; UI.hidePause(); }

  function bankWithToast() {
    const r = bank();
    if (r && r.dist > 0) UI.toast(`+💰 ${UI.fmt(r.money)} · +${UI.fmt(r.xp)} XP${r.levelsGained ? ` · Niveau ${r.level} !` : ''}${r.newRecord ? ' · 🏆 Record !' : ''}`);
  }
  function restart() { bankWithToast(); play(); }
  function quit() { bankWithToast(); toHangar(); }

  function useSkill(id) {
    if (S.mode !== 'play' || S.paused) return;
    if (Physics.useSkill(S.plane, S.stats, id)) {
      Sfx.skill(); UI.vibrate(25);
      burst(S.plane.x, S.plane.y, id === 'nitro' ? '#8ce0ff' : id === 'updraft' ? '#7dffa0' : '#ffffff', 16, 10);
    } else if (S.plane.state !== 'aim') {
      Sfx.error();
    }
  }

  // ---------------------------------------------------------------- Effets
  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      S.particles.push({ x, y, vx: Math.cos(a) * v + S.plane.vx * 0.5, vy: Math.sin(a) * v + S.plane.vy * 0.5, life: 0.6, max: 0.6, color, size: 3 + Math.random() * 3, g: 0 });
    }
  }
  const PK_COLOR = { boost: '#ff8a2b', speed: '#ffd23f', lift: '#5be37a', coin: '#ffe066' };

  // ---------------------------------------------------------------- Visée
  function updateAim(cx, cy) {
    const a = S.aim;
    const pullX = a.sx - cx, pullY = cy - a.sy;
    const len = Math.hypot(pullX, pullY);
    const { W, H } = Renderer.size();
    a.power = Math.min(1, len / (Math.min(W, H) * 0.4));
    let ang = Math.atan2(pullY, pullX);
    a.angle = Math.max(-0.35, Math.min(1.3, ang));
    // Trajectoire prévue
    const ghost = Object.assign({}, S.plane, { uses: {} });
    Physics.launch(ghost, S.stats, a.angle, a.power);
    a.preview = [];
    const ev = [];
    for (let i = 0; i < 60 && ghost.state === 'flying'; i++) {
      Physics.step(ghost, S.stats, 1 / 30, {}, ev);
      if (i % 3 === 2) a.preview.push({ x: ghost.x, y: ghost.y });
    }
  }

  function doLaunch() {
    const a = S.aim;
    a.active = false;
    if (a.power < 0.08) return;
    Physics.launch(S.plane, S.stats, a.angle, a.power);
    Sfx.launch();
    UI.vibrate(20);
    if (Save.data.runs < 3) UI.hint('Maintiens l\'écran pour planer · 🔥 pour booster', 3500);
    else UI.hint(null);
  }

  // ---------------------------------------------------------------- Entrées
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    Sfx.unlock();
    if (S.mode !== 'play' || S.paused) return;
    const p = S.plane;
    if (p.state === 'aim') {
      if (S.aim.pid !== null && S.aim.active) return;
      S.aim.active = true; S.aim.pid = e.pointerId;
      S.aim.sx = e.clientX; S.aim.sy = e.clientY;
      S.aim.power = 0; S.aim.preview = [];
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    } else {
      S.glidePointers.add(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (S.aim.active && e.pointerId === S.aim.pid && S.plane.state === 'aim') updateAim(e.clientX, e.clientY);
  });
  function pointerEnd(e) {
    S.glidePointers.delete(e.pointerId);
    if (S.aim.active && e.pointerId === S.aim.pid) {
      S.aim.pid = null;
      if (e.type === 'pointerup' && S.mode === 'play' && !S.paused) doLaunch();
      else S.aim.active = false;
    }
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('contextmenu', e => e.preventDefault());

  G.addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'TEXTAREA') return;
    const k = e.key;
    if (k === ' ') { S.keys.glide = true; e.preventDefault(); }
    else if (k === 'b' || k === 'B' || k === 'Shift') S.keys.boost = true;
    else if (k === '1' || k === '2' || k === '3') {
      const a = S.stats && S.stats.actives[+k - 1];
      if (a) useSkill(a.id);
    } else if (k === 'Escape' || k === 'p' || k === 'P') {
      if (S.mode === 'play') { if (S.paused) resume(); else pause(); }
    } else if (k === 'Enter' && S.mode === 'results') play();
  });
  G.addEventListener('keyup', e => {
    const k = e.key;
    if (k === ' ') S.keys.glide = false;
    else if (k === 'b' || k === 'B' || k === 'Shift') S.keys.boost = false;
  });
  G.addEventListener('blur', () => {
    S.keys.glide = false; S.keys.boost = false; S.glidePointers.clear();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.mode === 'play' && S.plane && S.plane.state !== 'aim') pause();
    if (document.hidden) Sfx.silence();
  });
  G.addEventListener('resize', () => { Renderer.resize(); if (S.plane) Renderer.updateCamera(S.plane, S.stats, 0, S.mode !== 'play'); });

  // ---------------------------------------------------------------- Plein écran
  function toggleFullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        Promise.resolve(req.call(el)).then(() => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => UI.toast('Plein écran non disponible ici'));
      } else UI.toast('Plein écran non disponible ici');
    }
  }
  function maybeFullscreen() {
    const touch = G.matchMedia && G.matchMedia('(pointer: coarse)').matches;
    const standalone = G.matchMedia && G.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    if (touch && !standalone && !document.fullscreenElement && !maybeFullscreen.tried) {
      maybeFullscreen.tried = true;
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req) {
        try {
          Promise.resolve(req.call(el)).then(() => {
            if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
          }).catch(() => {});
        } catch (_) { /* ignore */ }
      }
    }
  }

  // ---------------------------------------------------------------- Boucle
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const p = S.plane;

    if (S.mode === 'play' && !S.paused) {
      S.time += dt;
      if (p.state === 'flying' || p.state === 'sliding') {
        S.acc += dt;
        const input = { glide: S.glidePointers.size > 0 || S.keys.glide, boost: S.boostHeld || S.keys.boost };
        const ev = [];
        while (S.acc >= STEP) {
          S.acc -= STEP;
          Physics.step(p, S.stats, STEP, input, ev);
          const got = Physics.collect(S.world, p, S.stats, STEP);
          for (const pk of got) {
            Sfx.pickup(pk.type);
            if (pk.type !== 'coin') UI.vibrate(15);
            burst(pk.x, pk.y, PK_COLOR[pk.type], pk.type === 'coin' ? 6 : 14, 8);
          }
        }
        for (const e of ev) {
          if (e === 'bounce') { Sfx.bounce(); UI.vibrate(30); burst(p.x, p.y, '#b08850', 10, 6); }
          else if (e === 'land') { Sfx.land(); UI.vibrate(40); burst(p.x, p.y, '#a07a48', 14, 5); }
        }
        // Fumée du boost
        if (p.boosting && Math.random() < 0.8) {
          const sp = Math.hypot(p.vx, p.vy) || 1;
          S.particles.push({
            x: p.x - (p.vx / sp) * 1.1, y: p.y - (p.vy / sp) * 1.1,
            vx: -p.vx * 0.1 + (Math.random() - 0.5) * 2, vy: -p.vy * 0.1 + (Math.random() - 0.5) * 2,
            life: 0.45, max: 0.45, color: p.nitroT > 0 ? '#9fe6ff' : '#ffb04a', size: 2.5 + Math.random() * 2.5, g: 0,
          });
        }
        // Poussière en glissade
        if (p.state === 'sliding' && p.vx > 2 && Math.random() < 0.5) {
          S.particles.push({ x: p.x, y: p.y, vx: -1 + Math.random(), vy: 1 + Math.random() * 2, life: 0.5, max: 0.5, color: '#b5925e', size: 2 + Math.random() * 3, g: 6 });
        }
        // Traînée
        const tl = S.trail[S.trail.length - 1];
        if (!tl || Math.hypot(tl.x - p.x, tl.y - p.y) > 0.6) {
          S.trail.push({ x: p.x, y: p.y });
          if (S.trail.length > 45) S.trail.shift();
        }
      } else if (p.state === 'stopped') {
        S.endTimer += dt;
        if (S.endTimer > 0.9) finishRun();
      }
      // Particules
      for (let i = S.particles.length - 1; i >= 0; i--) {
        const q = S.particles[i];
        q.life -= dt;
        if (q.life <= 0) { S.particles.splice(i, 1); continue; }
        q.vy -= (q.g || 0) * dt;
        q.x += q.vx * dt; q.y += q.vy * dt;
      }
      const { W } = Renderer.size();
      Physics.generate(S.world, p.x + W / Renderer.cam.ppm + 80);
      Renderer.updateCamera(p, S.stats, dt, false);
      UI.updateHud(p, S.stats, S.record, liveMoney());
    }

    if (p) {
      Renderer.draw({
        plane: p, stats: S.stats, world: S.world, trail: S.trail, particles: S.particles,
        aim: S.mode === 'play' && p.state === 'aim' ? S.aim : null,
        time: S.time, record: S.record, lastDistance: S.lastDistance, paused: S.paused || S.mode !== 'play',
        get drawAngle() { return S.drawAngle; }, set drawAngle(v) { S.drawAngle = v; },
      }, dt);
      if (S.mode === 'play' && !S.paused) Sfx.update(Math.hypot(p.vx, p.vy), p.boosting, p.state === 'flying');
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- Démarrage
  async function boot() {
    Renderer.init(canvas);
    await Save.init();
    UI.init({
      play, pause, resume, restart, quit, toHangar, useSkill, toggleFullscreen,
      setBoost: v => { S.boostHeld = v; },
    });
    setupScene();
    UI.showMenu();
    requestAnimationFrame(t => { last = t; frame(t); });

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }
  boot();
})(window);
