/* Physique du vol, terrain et génération des bonus */
(function (G) {
  'use strict';
  const GRAV = 9.81;
  const MAX_CLIMB = Math.PI / 4; // angle max de montée : 45°
  const MAX_DIVE = -1.2;         // angle max de piqué (rad)
  const MAX_SPEED = 120;
  const CLIMB_GAIN = 0.9;   // pente de montée par unité de vitesse en trop (rapport à la croisière)
  const DIVE_GAIN = 0.8;    // pente de piqué quand l'avion est trop lent
  const TRACK_GAIN = 2.5;   // vitesse à laquelle l'avion rejoint la pente visée (1/s)
  const TURN_RATE = 1.2;    // rotation max (rad/s)

  // ---------------------------------------------------------------- Terrain (dépend de la carte)
  let TERRAIN = 'hills';
  function setTerrain(t) { TERRAIN = t || 'hills'; }
  function hash(n) { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); }

  function hills(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 50);
    const h = 2 + 1.6 * Math.sin(x / 41) + 1.1 * Math.sin(x / 17 + 1.3) + 2.2 * Math.sin(x / 113 + 0.5)
      + 1.5 * Math.sin(x / 271 + 2.1);
    return Math.max(0, h) * ramp;
  }
  function dunes(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 60);
    const h = 3 + 3 * Math.sin(x / 63) + 1.2 * Math.sin(x / 23 + 2) + 2 * Math.sin(x / 151 + 1);
    return Math.max(0, h) * ramp;
  }
  // Montagnes : collines + grands pics (de plus en plus hauts) à survoler
  const PEAK_CELL = 230;
  function peaks(x) {
    let h = hills(x) * 0.8;
    const i0 = Math.floor(x / PEAK_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (i < 1) continue;
      const c = i * PEAK_CELL + 60 + hash(i * 3.3) * 80;
      const w = 30 + hash(i * 7.1) * 30;
      const hh = (16 + hash(i * 1.9) * 30) * Math.min(1.6, 0.6 + i * 0.15);
      const d = (x - c) / w;
      h = Math.max(h, hh * Math.exp(-d * d) + hills(x) * 0.3);
    }
    return h;
  }
  // Archipel : fond marin à -5 m, des îles de temps en temps (l'île de départ porte la tour)
  const ISLAND_CELL = 170;
  function islands(x) {
    if (x < 18) return 0;
    if (x < 34) return -5 * ((x - 18) / 16);
    let h = -5;
    const i0 = Math.floor(x / ISLAND_CELL);
    for (let i = i0 - 1; i <= i0 + 1; i++) {
      if (i < 1) continue;
      const c = i * ISLAND_CELL + 40 + hash(i * 5.1) * 70;
      const hw = 14 + hash(i * 2.7) * 16;
      const top = 2 + hash(i * 8.3) * 2.5;
      const d = Math.abs(x - c) / hw;
      if (d < 1) h = Math.max(h, -5 + (top + 5) * Math.min(1, (1 - d * d) * 1.8));
    }
    return h;
  }
  function ground(x) {
    switch (TERRAIN) {
      case 'dunes': return dunes(x);
      case 'peaks': return peaks(x);
      case 'islands': return islands(x);
      default: return hills(x);
    }
  }

  // ---------------------------------------------------------------- Avion
  function newPlane(stats, actives) {
    return {
      state: 'aim', // aim | flying | sliding | stopped
      x: 0, y: stats.launchHeight + 0.6, vx: 0, vy: 0,
      fuel: stats.tank,
      boosting: false, gliding: false,
      liftT: 0, liftDur: 1, liftRate0: 0, liftRate: 0, nitroT: 0, glideT: 0, starT: 0, inJet: false,
      inSand: false, sink: 0,
      regenLeft: stats.regenBudget || 0, sinceBoost: 9,
      bouncesLeft: stats.bounces,
      maxX: 0, time: 0,
      coins: 0, pickups: 0,
      uses: Object.fromEntries((actives || stats.actives).map(a => [a.id, a.uses])),
    };
  }

  function launch(p, stats, angle, power) {
    const v = stats.launchSpeed * (0.25 + 0.75 * power);
    p.vx = Math.cos(angle) * v;
    p.vy = Math.sin(angle) * v;
    p.state = 'flying';
  }

  function setVelocity(p, speed, angle) {
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
  }

  // Courant ascendant : c'est la masse d'air qui monte, l'avion garde sa vitesse et son assiette
  // (au lieu d'être poussé à la verticale, ce qui lui faisait perdre toute sa vitesse puis piquer).
  function startLift(p, s, height, dur) {
    p.liftT = dur;
    p.liftDur = dur;
    p.liftRate0 = (2 * height) / dur; // vitesse de montée décroissante, intégrale = height
    const sp = Math.max(Math.hypot(p.vx, p.vy), s.vCruise * 1.2);
    let ang = Math.atan2(p.vy, p.vx);
    if (ang < 0) ang *= 0.3;          // sort l'avion de son piqué sans perte de vitesse
    ang = Math.min(ang, 0.12);        // vol presque à plat : c'est l'air qui monte
    setVelocity(p, sp, ang);
  }

  // Utilise une compétence active. Renvoie true si elle a été utilisée.
  function useSkill(p, stats, id) {
    const a = stats.actives.find(x => x.id === id);
    if (!a || !(p.uses[id] > 0)) return false;
    if (p.state !== 'flying' && !(p.state === 'sliding' && id === 'relaunch')) return false;
    p.uses[id]--;
    if (id === 'relaunch') {
      // Toujours assez de vitesse pour voler : jamais sous ~1,6× la vitesse de croisière
      if (p.state === 'sliding') { p.state = 'flying'; p.y = ground(p.x) + 0.3; }
      const cur = Math.hypot(p.vx, p.vy);
      const speed = Math.max(cur + 5, stats.launchSpeed * [0, 0.8, 1, 1.1][a.lvl], stats.vCruise * [0, 1.6, 1.8, 2][a.lvl]);
      setVelocity(p, speed, 0.18);
    } else if (id === 'updraft') {
      startLift(p, stats, 22 * stats.bonus, 1.4);
    } else if (id === 'nitro') {
      p.nitroT = [0, 2, 3, 3][a.lvl];
    } else if (id === 'glider') {
      p.glideT = [0, 3, 4.5, 6][a.lvl];
    }
    return true;
  }

  // input = { glide: bool, boost: bool } ; ev = tableau d'événements (sons/effets)
  function step(p, s, dt, input, ev) {
    p.time += dt;
    if (p.state === 'flying') {
      const speed = Math.hypot(p.vx, p.vy) || 0.001;

      let cl = s.cl, cd = s.cd;
      p.gliding = !!input.glide;
      if (p.gliding) { cl *= 1.45; cd *= 1.22; }

      const holdAlt = p.glideT > 0 || p.starT > 0;  // Vol plané / Étoile : pas de perte d'altitude
      const g = holdAlt ? 0 : GRAV * s.gravity;
      const gamma = Math.atan2(p.vy, p.vx);

      // --- Pente visée selon la vitesse (pilote "doux") ---
      // Vitesse de croisière : l'avion plane à sa pente naturelle. Plus il va vite, plus il monte
      // (jusqu'à 45° max). Plus il est lent, plus il pique (doucement) pour reprendre de la vitesse.
      const vc = Math.sqrt((GRAV * s.gravity) / cl);
      const glideAng = -Math.atan(cd / cl);
      let target;
      if (speed >= vc) target = glideAng + CLIMB_GAIN * (speed / vc - 1);
      else target = glideAng - DIVE_GAIN * (1 - speed / vc);
      if (speed < s.vStall) target -= 0.6 * (1 - speed / s.vStall); // décrochage
      if (holdAlt) target = Math.max(target, 0.05);
      if (p.inJet) target = Math.max(-0.03, Math.min(0.03, target)); // on "surfe" le courant-jet
      target = Math.max(MAX_DIVE, Math.min(MAX_CLIMB, target));

      // Vitesse de rotation limitée par la portance disponible (on ne cabre pas sans vitesse)
      let Lavail = cl * speed * speed;
      if (speed < s.vStall) Lavail *= (speed / s.vStall) * (speed / s.vStall);
      Lavail = Math.min(Lavail, s.liftMax) + (holdAlt ? GRAV : 0);
      const cosg = Math.cos(gamma);
      const maxUp = Math.min(TURN_RATE, (Lavail - g * cosg) / speed);
      const maxDown = -Math.min(TURN_RATE, (g * cosg) / speed + 0.25);
      let rate = (target - gamma) * TRACK_GAIN;
      rate = Math.max(maxDown, Math.min(maxUp, rate));
      const newGamma = gamma + rate * dt;

      // --- Vitesse le long de la trajectoire : gravité, traînée, poussée ---
      let D = cd * speed * speed + 0.25;
      if (p.glideT > 0) { p.glideT -= dt; D *= 0.5; }
      let thrust = 0;
      p.boosting = false;
      if (p.nitroT > 0) { p.nitroT -= dt; thrust += s.thrust * 1.8 + 10; p.boosting = true; }
      if (input.boost && p.fuel > 0) {
        thrust += s.thrust;
        p.fuel = Math.max(0, p.fuel - dt);
        p.boosting = true;
        p.sinceBoost = 0;
      } else {
        // Recharge : seulement après 1,5 s sans booster, et dans la limite d'un budget par vol
        p.sinceBoost += dt;
        if (s.regen > 0 && p.regenLeft > 0 && p.sinceBoost > 1.5 && p.fuel < s.tank) {
          const add = Math.min(s.regen * dt, p.regenLeft, s.tank - p.fuel);
          p.fuel += add;
          p.regenLeft -= add;
        }
      }
      // Puissance limitée : le boost pousse moins fort quand l'avion va déjà très vite
      thrust *= Math.min(1, 16 / speed);
      if (p.starT > 0) { p.starT -= dt; thrust += 7 * Math.min(1, 30 / speed); }
      if (p.inJet) thrust += 9 * s.bonus * Math.min(1, 35 / speed);

      D += s.headwind || 0;                       // vent de face
      if (p.inSand) D = D * 2 + 1.5;              // tempête de sable
      const newSpeed = Math.max(0.5, speed + (thrust - D - g * Math.sin(gamma)) * dt);
      setVelocity(p, newSpeed, newGamma);
      if (holdAlt && p.vy < 0) p.vy = 0;

      // Limites d'angle et de vitesse
      let sp = Math.hypot(p.vx, p.vy);
      let ang = Math.atan2(p.vy, p.vx);
      if (ang > MAX_CLIMB || ang < MAX_DIVE || sp > MAX_SPEED) {
        ang = Math.max(MAX_DIVE, Math.min(MAX_CLIMB, ang));
        sp = Math.min(sp, MAX_SPEED);
        setVelocity(p, sp, ang);
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liftRate = 0;
      if (p.liftT > 0) {
        p.liftRate = p.liftRate0 * (p.liftT / p.liftDur);
        p.y += p.liftRate * dt;
        p.liftT -= dt;
      }
      if (p.sink > 0 && !holdAlt) p.y -= p.sink * dt; // rafale descendante : l'air plonge

      const gh = ground(p.x);
      const water = s.map && s.map.water && gh < 0;
      const floor = water ? 0 : gh;
      if (p.y <= floor) {
        p.y = floor;
        if (p.bouncesLeft > 0 && sp > 4) {
          p.bouncesLeft--;
          setVelocity(p, sp * s.bounceKeep, 0.42);
          p.y = floor + 0.05;
          ev.push(water ? 'ricochet' : 'bounce');
        } else if (water) {
          // Plouf : l'eau arrête le vol
          p.state = 'stopped';
          p.vx = 0; p.vy = 0; p.y = 0;
          p.boosting = false;
          ev.push('splash');
        } else {
          p.state = 'sliding';
          p.vx = Math.max(p.vx, 0.5);
          p.vy = 0;
          p.boosting = false;
          ev.push('land');
        }
      }
    } else if (p.state === 'sliding') {
      p.gliding = false;
      const slope = ground(p.x + 0.5) - ground(p.x - 0.5);
      const dec = 5 + 0.08 * p.vx * p.vx + Math.max(0, slope) * 14; // glisser en montée freine fort
      p.vx -= dec * dt;
      if (p.vx <= 0.2) {
        p.vx = 0;
        p.state = 'stopped';
        ev.push('stop');
      }
      p.x += p.vx * dt;
      p.y = ground(p.x);
      if (s.map && s.map.water && p.y < 0) { // glisse jusque dans l'eau
        p.y = 0; p.vx = 0; p.state = 'stopped'; ev.push('splash');
      }
    }
    if (p.x > p.maxX) p.maxX = p.x;
  }

  // ---------------------------------------------------------------- Bonus sur la carte
  const PICKUP_TYPES = ['boost', 'speed', 'lift', 'coin', 'bird', 'balloon', 'star', 'diamond', 'jet'];

  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function newWorld(stats, seed) {
    return { pickups: [], genX: 28, rng: makeRng(seed || (Math.random() * 1e9)), stats };
  }

  // Bonus disponibles selon l'altitude (au-dessus du sol) : [type, poids, altitude mini]
  const SPAWN_TABLE = [
    ['boost', 26, 0], ['speed', 24, 0], ['lift', 24, 0], ['coin', 24, 0],
    ['birds', 26, 35], ['balloon', 14, 50], ['star', 10, 90], ['diamond', 12, 90], ['jet', 16, 130],
  ];

  function pickType(r, alt) {
    const pool = SPAWN_TABLE.filter(t => alt >= t[2]);
    let tot = 0;
    for (const t of pool) tot += t[1];
    let v = r() * tot;
    for (const t of pool) { v -= t[1]; if (v <= 0) return t[0]; }
    return pool[0][0];
  }

  // planeAlt : altitude actuelle de l'avion, pour placer des bonus là où il vole
  function generate(world, untilX, planeAlt) {
    const r = world.rng, s = world.stats;
    const pa = Math.max(0, planeAlt || 0);
    while (world.genX < untilX) {
      const x = world.genX;
      let alt;
      if (r() < 0.7) {
        // autour de l'altitude de l'avion (un peu en dessous : il descend en planant)
        alt = pa - 6 + (r() + r() - 1) * Math.max(16, Math.min(40, pa * 0.22));
      } else {
        alt = 2.5 + Math.pow(r(), 1.35) * Math.max(s.spawnAlt, pa * 1.3);
      }
      alt = Math.max(2.5, alt);
      const y = ground(x) + alt;
      const type = pickType(r, alt);
      const P = world.pickups;
      if (type === 'coin' || type === 'diamond') {
        const n = type === 'coin' ? 5 : 3;
        for (let i = 0; i < n; i++) {
          P.push({ type, x: x + i * 2.6, y: y + Math.sin((i / Math.max(1, n - 1)) * Math.PI) * 2.5, r: type === 'coin' ? 0.9 : 1.1 });
        }
      } else if (type === 'birds') {
        // Nuée d'oiseaux en V, qui volent lentement dans un sens ou dans l'autre
        const n = 3 + Math.floor(r() * 3);
        const vx = (r() < 0.5 ? -1 : 1) * (3 + r() * 4);
        const dir = Math.sign(vx);
        for (let i = 0; i < n; i++) {
          const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1);
          P.push({ type: 'bird', x: x - dir * Math.abs(k) * 2.2, y: y + k * 1.6, r: 1.0, vx, phase: r() * 6 });
        }
      } else if (type === 'balloon') {
        P.push({ type: 'balloon', x, y, r: 2.6, vy: 0.6, hue: Math.floor(r() * 4) });
      } else if (type === 'jet') {
        P.push({ type: 'jet', x, y, len: 70 + r() * 70, h: 6 });
      } else {
        P.push({ type, x, y, r: type === 'lift' ? 1.4 : type === 'star' ? 1.5 : 1.3 });
      }
      // Pièges de la carte (en plus des bonus)
      const hz = (s.map && s.map.hazards) || [];
      let hzTot = 0;
      for (const h of hz) hzTot += h[1];
      if (hzTot > 0 && x > 60 && r() < hzTot / 100) {
        let v = r() * hzTot, hType = hz[0][0];
        for (const h of hz) { v -= h[1]; if (v <= 0) { hType = h[0]; break; } }
        const hx = x + 8 + r() * 12;
        const halt = Math.max(3, pa - 4 + (r() + r() - 1) * Math.max(14, Math.min(35, pa * 0.2)));
        const hy = ground(hx) + halt;
        if (hType === 'sand') P.push({ type: 'sand', x: hx, y: hy, len: 45 + r() * 50, h: 7 });
        else if (hType === 'down') P.push({ type: 'down', x: hx, y: hy, w: 12 + r() * 8, h: 22 });
        else if (hType === 'gull') {
          const n = 1 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) P.push({ type: 'gull', x: hx + i * 4, y: hy + (r() - 0.5) * 5, r: 1.1, vx: -(4 + r() * 4), phase: r() * 6 });
        } else if (hType === 'storm') P.push({ type: 'storm', x: hx, y: hy, r: 3.2, vx: -1.5, phase: r() * 10 });
      }
      // Les bonus se raréfient avec la distance
      world.genX += (17 + r() * 21) * (1 + x / 900) / s.density;
    }
    // Nettoyage
    if (world.pickups.length > 200) world.pickups = world.pickups.filter(pk => !pk.taken);
  }

  const NO_MAGNET = { bird: 1, balloon: 1, jet: 1, gull: 1, storm: 1, sand: 1, down: 1 };
  const ZONES = { jet: 1, sand: 1 };

  // Déplacement des bonus mobiles, aimant + collecte. Renvoie la liste des bonus ramassés.
  function collect(world, p, s, dt) {
    const got = [];
    p.inJet = false;
    p.inSand = false;
    p.sink = 0;
    for (const pk of world.pickups) {
      if (pk.vx) pk.x += pk.vx * dt;
      if (pk.vy) pk.y += pk.vy * dt;
    }
    if (p.state !== 'flying' && p.state !== 'sliding') return got;
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      if (ZONES[pk.type]) {
        if (p.x > pk.x + pk.len + 40) { pk.taken = true; continue; }
        if (p.state === 'flying' && p.x >= pk.x && p.x <= pk.x + pk.len && Math.abs(p.y - pk.y) < pk.h) {
          if (pk.type === 'jet') p.inJet = true; else p.inSand = true;
          if (!pk.entered) { pk.entered = true; got.push(pk); if (pk.type === 'jet') p.pickups++; }
        }
        continue;
      }
      if (pk.type === 'down') {
        if (p.x > pk.x + pk.w + 40) { pk.taken = true; continue; }
        if (p.state === 'flying' && Math.abs(p.x - pk.x) < pk.w / 2 && Math.abs(p.y - pk.y) < pk.h) {
          p.sink = 9;
          if (!pk.entered) { pk.entered = true; got.push(pk); }
        }
        continue;
      }
      const dx = p.x - pk.x, dy = p.y - pk.y;
      if (dx > 40) { pk.taken = true; pk.missed = true; continue; }
      if (pk.used) continue;
      if (dx < -s.magnet - 5) continue;
      const d = Math.hypot(dx, dy);
      if (d < pk.r + 0.9) {
        if (pk.type === 'balloon' || pk.type === 'storm') pk.used = true; // reste visible
        else pk.taken = true;
        got.push(pk);
        applyPickup(p, s, pk.type);
      } else if (d < s.magnet && !NO_MAGNET[pk.type]) {
        const pull = Math.min(1, (60 * dt) / Math.max(d, 0.5)) * 0.6;
        pk.x += dx * pull + p.vx * dt * 0.9;
        pk.y += dy * pull + p.vy * dt * 0.9;
      }
    }
    return got;
  }

  function applyPickup(p, s, type) {
    p.pickups++;
    if (type === 'boost') {
      p.fuel = Math.min(s.tank, p.fuel + 1.0 * s.bonus);
    } else if (type === 'speed') {
      const sp = Math.hypot(p.vx, p.vy) || 1;
      const ang = Math.atan2(p.vy, p.vx);
      setVelocity(p, sp + 9 * s.bonus, Math.max(ang, -0.2));
    } else if (type === 'lift') {
      startLift(p, s, 11 * s.bonus, 0.9);
    } else if (type === 'coin') {
      p.coins++;
    } else if (type === 'diamond') {
      p.coins += 5;
    } else if (type === 'bird') {
      // petit coup de pouce vers le haut (cumulable si on traverse toute la nuée)
      const remaining = p.liftT > 0 ? p.liftRate0 * p.liftT * p.liftT / (2 * p.liftDur) : 0;
      startLift(p, s, remaining + 4 * s.bonus, 0.6);
    } else if (type === 'balloon') {
      startLift(p, s, 18 * s.bonus, 1.2);
    } else if (type === 'star') {
      p.starT = Math.max(p.starT, 4.5);
    } else if (type === 'gull') {
      // Mouette : on la percute, on perd de la vitesse
      p.pickups--;
      const sp = Math.hypot(p.vx, p.vy);
      setVelocity(p, sp * 0.72, Math.atan2(p.vy, p.vx) - 0.1);
    } else if (type === 'storm') {
      // Nuage électrique : décharge, grosse perte de vitesse
      p.pickups--;
      const sp = Math.hypot(p.vx, p.vy);
      setVelocity(p, sp * 0.62, Math.min(Math.atan2(p.vy, p.vx), 0) - 0.25);
    }
  }

  G.Physics = { GRAV, ground, setTerrain, newPlane, launch, step, useSkill, newWorld, generate, collect, PICKUP_TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
