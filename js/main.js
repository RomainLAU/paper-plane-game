/* Boucle principale, contrôles et déroulement d'une partie */
(function (G) {
  'use strict';
  const { Data, Physics, Save, Sfx, Renderer, UI } = G;
  const STEP = 1 / 120;
  const COIN_VALUE = 3;     // $ par pièce
  const MONEY_PER_M = 0.25; // $ par mètre

  const canvas = document.getElementById('game');
  const DESKTOP = !!(G.matchMedia && G.matchMedia('(hover: hover) and (pointer: fine)').matches);
  if (DESKTOP) document.body.classList.add('desktop');

  const S = {
    mode: 'menu',     // menu | play | results
    paused: false,
    stats: null, plane: null, world: null,
    trail: [], particles: [], floaters: [],
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
    const d = Save.data;
    S.map = G.Maps.byId(d.currentMap);
    if (!G.Maps.isUnlocked(d, S.map.id)) S.map = G.Maps.MAPS[0];
    Physics.setTerrain(S.map.terrain);
    S.stats = G.Maps.apply(Data.computeStats(d), S.map);
    refreshLook();
    S.plane = Physics.newPlane(S.stats);
    S.world = Physics.newWorld(S.stats);
    S.trail = []; S.particles = []; S.floaters = [];
    S.aim.active = false; S.aim.preview = [];
    S.endTimer = 0; S.banked = false; S.acc = 0;
    S.drawAngle = null;
    const mr = d.maps[S.map.id] || { best: 0, last: 0 };
    S.record = mr.best;
    S.lastDistance = mr.last;
    S.glidePointers.clear();
    S.boostHeld = false;
    Renderer.updateCamera(S.plane, S.stats, 0, true);
  }

  function refreshLook() {
    S.look = G.Planes.resolve(Save.data.plane, Data.levelInfo(Save.data.xp).level);
  }

  function play() {
    maybeFullscreen();
    setupScene();
    S.mode = 'play';
    S.paused = false;
    UI.hideMenu(); UI.hideResults(); UI.hidePause();
    UI.buildHudSkills(S.stats);
    UI.hint(DESKTOP
      ? 'Vise avec les flèches haut et bas, puis maintiens Espace pour doser la puissance. Relâche pour lancer.<small>Tu peux aussi glisser vers l\'arrière avec la souris.</small>'
      : "Glisse vers l'arrière, puis relâche pour lancer.");
  }

  function toHangar() {
    if (S.updatePending) { location.reload(); return; }
    S.mode = 'menu';
    S.paused = false;
    UI.hideResults(); UI.hidePause(); UI.hint(null);
    setupScene();
    UI.showMenu();
    Sfx.silence();
  }

  function liveMoney() {
    const p = S.plane;
    return Math.floor((Math.floor(p.maxX) * MONEY_PER_M + p.coins * COIN_VALUE) * S.stats.moneyMult);
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
    d.record = Math.max(d.record, dist);
    const mr = d.maps[S.map.id] || (d.maps[S.map.id] = { unlocked: true, best: 0, last: 0 });
    const newRecord = dist > mr.best;
    if (newRecord) mr.best = dist;
    mr.last = dist;
    // Déblocage de la carte suivante
    let newMap = null;
    const idx = G.Maps.indexOf(S.map.id);
    const next = G.Maps.MAPS[idx + 1];
    if (next && S.map.unlockNext && dist >= S.map.unlockNext && !G.Maps.isUnlocked(d, next.id)) {
      d.maps[next.id] = Object.assign(d.maps[next.id] || { best: 0, last: 0 }, { unlocked: true });
      newMap = next;
    }
    // Diamants : ceux attrapés, + 3 à l'ouverture d'une carte, + 1 par palier de 500 m de record sur la carte
    let diamonds = p.diamonds;
    if (newMap) diamonds += 3;
    const step = Math.floor(mr.best / 500);
    if (step > (mr.milestone || 0)) { diamonds += step - (mr.milestone || 0); mr.milestone = step; }
    d.diamonds = (d.diamonds || 0) + diamonds;
    const after = Data.levelInfo(d.xp).level;
    Save.write();
    return {
      dist, money, xp, newRecord, pickups: p.pickups,
      level: after, levelsGained: after - before,
      newSlots: Data.unlockedSlots(after) - Data.unlockedSlots(before),
      cosmetics: G.Planes.unlocksBetween(before, after),
      newMap, map: S.map, diamonds, crashed: p.crumple >= 1, burnt: p.burnt,
    };
  }

  function finishRun() {
    const r = bank();
    S.mode = 'results';
    UI.hint(null);
    Sfx.silence();
    if (!r) { toHangar(); return; }
    UI.showResults(r);
    if (r.levelsGained > 0 || r.newMap) { Sfx.levelUp(); UI.vibrate([30, 50, 30]); }
    else if (r.newRecord) Sfx.record();
  }

  function pause() {
    if (S.mode !== 'play' || S.paused) return;
    S.paused = true;
    S.glidePointers.clear(); glideKeys.clear(); S.keys.boost = false; S.keys.mouseBoost = false; S.boostHeld = false;
    UI.showPause();
    Sfx.silence();
  }
  function resume() { S.paused = false; UI.hidePause(); }

  function bankWithToast() {
    const r = bank();
    if (r && r.dist > 0) UI.toast(`${UI.fmt(r.dist)} m comptés : +${UI.fmt(r.money)} $ et +${UI.fmt(r.xp)} XP${r.diamonds ? `, +${r.diamonds} 💎` : ''}${r.levelsGained ? `, niveau ${r.level}` : ''}${r.newRecord ? ', nouveau record' : ''}`);
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
  // éclats de papier après un choc
  function paperBits(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI, v = 3 + Math.random() * 6;
      S.particles.push({ x, y: y + 0.3, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9, max: 0.9, color: i % 3 ? '#ffffff' : '#c9d6e6', size: 2 + Math.random() * 2.5, g: 14 });
    }
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      S.particles.push({ x, y, vx: Math.cos(a) * v + S.plane.vx * 0.5, vy: Math.sin(a) * v + S.plane.vy * 0.5, life: 0.6, max: 0.6, color, size: 3 + Math.random() * 3, g: 0 });
    }
  }
  const PK_COLOR = { boost: '#ff8a2b', speed: '#ffd23f', lift: '#5be37a', coin: '#ffe066', bird: '#e8e8f0', balloon: '#ff7a7a', star: '#ffe14d', diamond: '#7fe3ff', jet: '#ffffff' , sand: '#e0b96a', down: '#9fc4ff', gull: '#ffffff', storm: '#d9e4ff'};
  const PK_TEXT_EXTRA = { shield: '🛡️ Bloqué', up: '⏫ Air chaud', gust: '💨 Vent dans le dos' };
  const PK_TEXT = { boost: '🔥 Boost', speed: '⚡ Vitesse', lift: '⏫ Ascendance', bird: '🐦 Hop !', balloon: '🎈 Boing !', star: '⭐ Étoile !', diamond: '💎 +5', jet: '🌬️ Courant-jet !' , sand: '🌪️ Tempête de sable !', down: '⬇️ Rafale !', gull: '🐦 Aïe !', storm: '⚡ Zap !'};
  function floater(x, y, text, color) {
    S.floaters.push({ x, y, text, color, life: 1.1, max: 1.1 });
    if (S.floaters.length > 12) S.floaters.shift();
  }

  // ---------------------------------------------------------------- Visée
  const AIM_MIN = -0.35, AIM_MAX = Math.PI / 4; // 45° max

  // Visée à la souris / au doigt (fronde)
  function updateAim(cx, cy) {
    const a = S.aim;
    const pullX = a.sx - cx, pullY = cy - a.sy;
    const len = Math.hypot(pullX, pullY);
    const { W, H } = Renderer.size();
    a.kb = false;
    setAim(Math.atan2(pullY, pullX), Math.min(1, len / (Math.min(W, H) * 0.4)));
  }

  function setAim(angle, power) {
    const a = S.aim;
    a.active = true;
    a.angle = Math.max(AIM_MIN, Math.min(AIM_MAX, angle));
    a.power = power;
    // Trajectoire prévue
    const ghost = Object.assign({}, S.plane, { uses: {} });
    Physics.launch(ghost, S.stats, a.angle, Math.max(0.35, power));
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
    a.charging = false;
    if (a.power < 0.08) return;
    Physics.launch(S.plane, S.stats, a.angle, a.power);
    glideKeys.clear(); // la touche de lancer encore enfoncée ne doit pas faire planer
    Sfx.launch();
    UI.vibrate(20);
    if (Save.data.runs < 3) UI.hint(DESKTOP
      ? 'Maintiens Espace pour planer, B pour booster, 1 2 3 pour tes compétences.'
      : "Maintiens l'écran pour planer, touche 🔥 pour booster.", 3500);
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

  // ---------------------------------------------------------------- Clavier
  // On utilise la position physique des touches (e.code) : ZQSD en AZERTY = WASD en QWERTY.
  const K = {
    up: c => c === 'ArrowUp' || c === 'KeyW',
    down: c => c === 'ArrowDown' || c === 'KeyS',
    act: c => c === 'Space' || c === 'Enter' || c === 'NumpadEnter',
    boost: c => c === 'KeyB' || c === 'ShiftLeft' || c === 'ShiftRight' || c === 'ArrowRight' || c === 'KeyD',
    skill: c => { const m = /^(?:Digit|Numpad)([1-3])$/.exec(c); return m ? +m[1] : 0; },
  };
  const kbAim = { up: false, down: false };
  const glideKeys = new Set(); // touches « planer » enfoncées

  function startCharge() {
    const a = S.aim;
    if (S.plane.state !== 'aim' || a.charging) return;
    a.charging = true; a.chargeT = 0; a.kb = true;
    if (a.kbAngle == null) a.kbAngle = 0.35;
  }

  G.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT')) return;
    const c = e.code;
    Sfx.unlock();
    let used = true;
    if (c === 'KeyM') { Save.data.settings.sound = !Save.data.settings.sound; Save.write(); if (!Save.data.settings.sound) Sfx.silence(); UI.toast(Save.data.settings.sound ? 'Son activé' : 'Son coupé', 1200); }
    else if (c === 'KeyF') toggleFullscreen();
    else if (S.mode === 'menu') {
      if (UI.mapsOpen()) { if (c === 'Escape' || K.act(c)) UI.closeMaps(); else used = false; }
      else if (K.act(c)) play();
      else if (c === 'KeyC') UI.openMaps();
      else if (c === 'ArrowLeft' || c === 'ArrowRight') UI.cycleTab(c === 'ArrowLeft' ? -1 : 1);
      else used = false;
    } else if (S.mode === 'results') {
      if (e.repeat) return;
      if (K.act(c)) play();
      else if (c === 'Escape' || c === 'KeyH') toHangar();
      else used = false;
    } else if (S.mode === 'play') {
      if (S.paused) {
        if (c === 'Escape' || c === 'KeyP' || K.act(c)) resume();
        else if (c === 'KeyR') restart();
        else if (c === 'KeyH' || c === 'KeyQ') quit();
        else used = false;
      } else if (c === 'Escape' || c === 'KeyP') pause();
      else if (S.plane.state === 'aim') {
        if (K.up(c)) kbAim.up = true;
        else if (K.down(c)) kbAim.down = true;
        else if (K.act(c)) { if (!e.repeat) startCharge(); }
        else used = false;
      } else {
        if ((c === 'Space' || K.up(c)) && !e.repeat) glideKeys.add(c);
        else if (K.boost(c)) S.keys.boost = true;
        else if (K.skill(c)) { if (!e.repeat) { const a = S.stats.actives[K.skill(c) - 1]; if (a) useSkill(a.id); } }
        else if (c === 'KeyR' && !e.repeat && S.stats.actives.some(x => x.id === 'relaunch')) useSkill('relaunch');
        else used = false;
      }
    } else used = false;
    if (used) e.preventDefault();
  });
  G.addEventListener('keyup', e => {
    const c = e.code;
    if (K.up(c)) kbAim.up = false;
    if (K.down(c)) kbAim.down = false;
    glideKeys.delete(c);
    if (K.boost(c)) S.keys.boost = false;
    if (K.act(c) && S.aim.charging) {
      S.aim.charging = false;
      if (S.mode === 'play' && !S.paused && S.plane.state === 'aim') doLaunch();
    }
  });

  // Visée au clavier / à la manette (appelé à chaque image pendant la visée)
  function updateKeyboardAim(dt, stickY) {
    const a = S.aim;
    const dir = (kbAim.up ? 1 : 0) - (kbAim.down ? 1 : 0) + (stickY || 0);
    if (dir === 0 && !a.charging && !a.kb) return;
    if (a.pid !== null && !a.kb) return; // visée souris en cours
    if (a.kbAngle == null) a.kbAngle = a.active ? a.angle : 0.35;
    a.kb = true;
    a.kbAngle = Math.max(AIM_MIN, Math.min(AIM_MAX, a.kbAngle + dir * 0.9 * dt));
    let power = a.kbPower != null ? a.kbPower : 0.75;
    if (a.charging) {
      // la jauge monte puis redescend : il faut relâcher au bon moment
      a.chargeT += dt;
      const t = (a.chargeT / 1.1) % 2;
      power = Math.max(0.1, t < 1 ? t : 2 - t);
      a.kbPower = power;
    }
    setAim(a.kbAngle, power);
  }

  // Après un clic, on retire le focus du bouton : sinon Espace / Entrée le « recliqueraient »
  document.addEventListener('pointerup', () => {
    const el = document.activeElement;
    if (el && el.tagName === 'BUTTON') el.blur();
  });

  // ---------------------------------------------------------------- Souris
  // Clic gauche maintenu = planer (déjà géré), clic droit maintenu = boost, molette = viser
  canvas.addEventListener('mousedown', e => { if (e.button === 2 && S.mode === 'play' && S.plane.state !== 'aim') S.keys.mouseBoost = true; });
  G.addEventListener('mouseup', e => { if (e.button === 2) S.keys.mouseBoost = false; });
  canvas.addEventListener('wheel', e => {
    if (S.mode !== 'play' || S.paused || S.plane.state !== 'aim') return;
    e.preventDefault();
    const a = S.aim;
    if (a.kbAngle == null) a.kbAngle = a.active ? a.angle : 0.35;
    a.kb = true;
    a.kbAngle = Math.max(AIM_MIN, Math.min(AIM_MAX, a.kbAngle - Math.sign(e.deltaY) * 0.05));
    setAim(a.kbAngle, a.kbPower != null ? a.kbPower : 0.75);
  }, { passive: false });

  // ---------------------------------------------------------------- Manette
  // A : planer / doser la puissance · RT ou B : boost · X Y LB : compétences · Start : pause · stick : viser
  const padPrev = {};
  function pollGamepad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = pads && Array.from(pads).find(x => x && x.connected);
    S.pad = { glide: false, boost: false };
    if (!gp) return 0;
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4));
    const pressed = i => b(i) && !padPrev[i];
    const released = i => !b(i) && padPrev[i];
    let stickY = 0;
    const ay = gp.axes[1] || 0;
    if (Math.abs(ay) > 0.25) stickY = -ay;
    if (b(12)) stickY = 1; if (b(13)) stickY = -1; // croix directionnelle
    if (S.mode === 'menu') { if (pressed(0) || pressed(9)) play(); }
    else if (S.mode === 'results') { if (pressed(0)) play(); else if (pressed(1)) toHangar(); }
    else if (S.mode === 'play') {
      if (S.paused) { if (pressed(9) || pressed(0)) resume(); else if (pressed(1)) quit(); }
      else if (pressed(9)) pause();
      else if (S.plane.state === 'aim') {
        if (pressed(0)) startCharge();
        if (released(0) && S.aim.charging) { S.aim.charging = false; doLaunch(); padPrev[0] = false; }
      } else {
        S.pad.glide = b(0);
        S.pad.boost = b(7) || b(1) || b(5);
        [2, 3, 4].forEach((bi, k) => { if (pressed(bi)) { const a = S.stats.actives[k]; if (a) useSkill(a.id); } });
      }
    }
    for (let i = 0; i < gp.buttons.length; i++) padPrev[i] = b(i);
    return stickY;
  }

  G.addEventListener('blur', () => {
    glideKeys.clear(); S.keys.boost = false; S.keys.mouseBoost = false; S.glidePointers.clear();
    kbAim.up = kbAim.down = false;
    if (S.aim.charging) { S.aim.charging = false; S.aim.active = false; }
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
        }).catch(() => UI.toast('Ce navigateur ne permet pas le plein écran'));
      } else UI.toast('Ce navigateur ne permet pas le plein écran');
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

    const stickY = pollGamepad(dt);
    if (S.mode === 'play' && !S.paused && p.state === 'aim') updateKeyboardAim(dt, stickY);
    if (S.mode === 'play' && !S.paused) {
      S.time += dt;
      if (p.state === 'flying' || p.state === 'sliding' || p.state === 'falling') {
        S.acc += dt;
        const pad = S.pad || {};
        const input = {
          glide: S.glidePointers.size > 0 || glideKeys.size > 0 || pad.glide,
          boost: S.boostHeld || S.keys.boost || S.keys.mouseBoost || pad.boost,
        };
        const ev = [];
        while (S.acc >= STEP) {
          S.acc -= STEP;
          Physics.step(p, S.stats, STEP, input, ev);
          const got = Physics.collect(S.world, p, S.stats, STEP);
          for (const pk of got) {
            Sfx.pickup(pk.type);
            if (pk.type !== 'coin') UI.vibrate(pk.type === 'star' || pk.type === 'balloon' ? 30 : 15);
            if (pk.type === 'balloon') pk.usedAt = S.time;
            const bx = pk.type === 'jet' ? p.x : pk.x, by = pk.type === 'jet' ? p.y : pk.y;
            if (pk.type !== 'jet' && pk.type !== 'sand' && pk.type !== 'down') burst(bx, by, PK_COLOR[pk.type], pk.type === 'coin' ? 6 : pk.type === 'star' ? 24 : 14, 8);
            const txt = PK_TEXT_EXTRA[pk.type] || PK_TEXT[pk.type];
            if (pk.type === 'diamond') floater(p.x, p.y + 2.5, '💎 Diamant !', '#9fe9ff');
            else if (txt && (pk.type !== 'bird' || !S.floaters.some(f => f.text === PK_TEXT.bird && f.life > 0.6))) {
              floater(p.x, p.y + 2.5, txt, pk.type === 'star' ? '#ffe14d' : ['gull', 'storm', 'down', 'sand'].includes(pk.type) ? '#ff8a8a' : '#ffffff');
            }
          }
        }
        for (const e of ev) {
          if (e === 'bounce') { Sfx.bounce(); UI.vibrate(30); burst(p.x, p.y, '#b08850', 10, 6); }
          else if (e === 'land') { Sfx.land(); UI.vibrate(40); burst(p.x, p.y, '#a07a48', 14, 5); }
          else if (e === 'crash') { Sfx.crunch(true); UI.vibrate([60, 40, 80]); paperBits(p.x, p.y, 22); floater(p.x, p.y + 3, 'Écrasé !', '#ffd0d4'); }
          else if (e === 'bend') { Sfx.crunch(false); UI.vibrate(40); paperBits(p.x, p.y, 8); floater(p.x, p.y + 3, 'Nez plié', '#ffffff'); }
          else if (e === 'bonk') { Sfx.crunch(false); UI.vibrate(40); paperBits(p.x, p.y, 8); floater(p.x, p.y + 3, 'Paf, un mur', '#ffffff'); }
          else if (e === 'burn') { Sfx.burn(); UI.vibrate([60, 40, 80]); burst(p.x, p.y + 0.5, '#ff7a1f', 24, 7); burst(p.x, p.y + 0.5, '#3a3a3a', 14, 4); floater(p.x, p.y + 3, 'Brûlé !', '#ffd0a0'); }
          else if (e === 'sizzle') { Sfx.burn(); burst(p.x, p.y, '#ff9a3c', 14, 6); floater(p.x, p.y + 3, 'Ça brûle !', '#ffd0a0'); }
          else if (e === 'ricochet') { Sfx.splash(true); UI.vibrate(30); burst(p.x, p.y, '#bfe9ff', 14, 7); }
          else if (e === 'splash') { Sfx.splash(false); UI.vibrate([40, 30, 40]); burst(p.x, 0.2, '#bfe9ff', 26, 9); floater(p.x, 3, '💦 Plouf !', '#ffffff'); }
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
      // Bonus générés juste hors de l'écran, autour de l'altitude actuelle de l'avion
      Physics.generate(S.world, Math.max(p.x + 60, Renderer.cam.left + W / Renderer.cam.ppm + 12), p.state === 'aim' ? S.stats.launchHeight : p.y - Physics.ground(p.x));
      if (p.state === 'aim') Physics.collect(S.world, p, S.stats, dt); // fait bouger oiseaux et montgolfières
      for (let i = S.floaters.length - 1; i >= 0; i--) { S.floaters[i].life -= dt; if (S.floaters[i].life <= 0) S.floaters.splice(i, 1); }
      Renderer.updateCamera(p, S.stats, dt, false);
      UI.updateHud(p, S.stats, S.record, liveMoney());
    }

    if (p) {
      Renderer.draw({
        plane: p, stats: S.stats, world: S.world, map: S.map, trail: S.trail, particles: S.particles, floaters: S.floaters, look: S.look,
        aim: S.mode === 'play' && p.state === 'aim' ? S.aim : null,
        time: S.time, record: S.record, lastDistance: S.lastDistance, paused: S.paused || S.mode !== 'play',
        get drawAngle() { return S.drawAngle; }, set drawAngle(v) { S.drawAngle = v; },
      }, dt);
      if (S.mode === 'play' && !S.paused) Sfx.update(Math.hypot(p.vx, p.vy), p.boosting, p.state === 'flying');
    }
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- Démarrage
  G.__game = S; // accès de débogage (console du navigateur)

  async function boot() {
    Renderer.init(canvas);
    await Save.init();
    UI.init({
      play, pause, resume, restart, quit, toHangar, useSkill, toggleFullscreen, refreshLook,
      mapChanged: () => setupScene(),
      setBoost: v => { S.boostHeld = v; },
    });
    setupScene();
    UI.showMenu();
    requestAnimationFrame(t => { last = t; frame(t); });

    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('sw.js').then(reg => reg.update()).catch(() => {});
      // Nouvelle version installée : on recharge tout de suite si on est au hangar, sinon au retour au hangar
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        if (S.mode === 'menu') location.reload();
        else S.updatePending = true;
      });
    }
  }
  boot();
})(window);
