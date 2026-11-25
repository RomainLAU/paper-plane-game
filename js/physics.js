/* Physique du vol, terrain et génération des bonus */
(function (G) {
  'use strict';
  const GRAV = 9.81;
  const MAX_CLIMB = 1.25;   // angle max de montée (rad)
  const MAX_DIVE = -1.45;   // angle max de piqué (rad)
  const MAX_SPEED = 120;
  const PITCH_DAMP = 10;    // amortissement de l'oscillation montée/piqué

  // ---------------------------------------------------------------- Terrain
  function ground(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 50);
    const h = 2 + 1.6 * Math.sin(x / 41) + 1.1 * Math.sin(x / 17 + 1.3) + 2.2 * Math.sin(x / 113 + 0.5)
      + 1.5 * Math.sin(x / 271 + 2.1);
    return Math.max(0, h) * ramp;
  }

  // ---------------------------------------------------------------- Avion
  function newPlane(stats, actives) {
    return {
      state: 'aim', // aim | flying | sliding | stopped
      x: 0, y: stats.launchHeight + 0.6, vx: 0, vy: 0,
      fuel: stats.tank,
      boosting: false, gliding: false,
      liftT: 0, liftDur: 1, liftRate0: 0, liftRate: 0, nitroT: 0, glideT: 0,
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
      const dx = p.vx / speed, dy = p.vy / speed;
      const nx = -dy, ny = dx; // normale "vers le haut" de la trajectoire

      let cl = s.cl, cd = s.cd;
      p.gliding = !!input.glide;
      if (p.gliding) { cl *= 1.45; cd *= 1.22; }

      let L = cl * speed * speed;
      if (speed < s.vStall) L *= (speed / s.vStall) * (speed / s.vStall); // décrochage
      // Amortissement : l'excès de portance (trop de vitesse) fait monter en pente douce
      // au lieu de cabrer brutalement puis piquer. Au-delà de ~35° de montée, il ramène le nez.
      const gamma = Math.atan2(p.vy, p.vx);
      const trim = GRAV * s.gravity * Math.cos(gamma);
      let excess = L - trim;
      if (excess > 0) excess = Math.min(excess, 0.5 * GRAV) * Math.max(-1, Math.min(1, 1 - gamma / 0.6));
      else excess = Math.max(excess, -0.35 * GRAV); // nez qui redescend progressivement quand l'avion est lent
      // Stabilité : ramène doucement l'avion vers sa pente de plané (évite les montagnes russes)
      excess -= PITCH_DAMP * (gamma + Math.atan(cd / cl)); // cl/cd courants : planer aplatit la pente visée
      L = Math.min(trim + excess, s.liftMax);
      let D = cd * speed * speed + 0.25;
      let grav = GRAV * s.gravity;

      if (p.glideT > 0) { p.glideT -= dt; grav = 0; D *= 0.5; }

      let ax = nx * L - dx * D;
      let ay = ny * L - dy * D - grav;

      // Poussée : boost + nitro
      let thrust = 0;
      p.boosting = false;
      if (p.nitroT > 0) { p.nitroT -= dt; thrust += s.thrust * 1.8 + 10; p.boosting = true; }
      if (input.boost && p.fuel > 0) {
        thrust += s.thrust;
        p.fuel = Math.max(0, p.fuel - dt);
        p.boosting = true;
      } else if (s.regen > 0) {
        p.fuel = Math.min(s.tank, p.fuel + s.regen * dt);
      }
      // Puissance limitée : le boost pousse moins fort quand l'avion va déjà très vite
      thrust *= Math.min(1, 16 / speed);
      ax += dx * thrust; ay += dy * thrust;


      p.vx += ax * dt;
      p.vy += ay * dt;
      if (p.glideT > 0 && p.vy < 0) p.vy = 0;

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

      const gh = ground(p.x);
      if (p.y <= gh) {
        p.y = gh;
        if (p.bouncesLeft > 0 && sp > 4) {
          p.bouncesLeft--;
          setVelocity(p, sp * s.bounceKeep, 0.42);
          p.y = gh + 0.05;
          ev.push('bounce');
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
      const dec = 5 + 0.08 * p.vx * p.vx;
      p.vx -= dec * dt;
      if (p.vx <= 0.2) {
        p.vx = 0;
        p.state = 'stopped';
        ev.push('stop');
      }
      p.x += p.vx * dt;
      p.y = ground(p.x);
    }
    if (p.x > p.maxX) p.maxX = p.x;
  }

  // ---------------------------------------------------------------- Bonus sur la carte
  const PICKUP_TYPES = ['boost', 'speed', 'lift', 'coin'];

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

  function generate(world, untilX) {
    const r = world.rng, s = world.stats;
    while (world.genX < untilX) {
      const x = world.genX;
      const roll = r();
      const alt = 2.5 + Math.pow(r(), 1.35) * s.spawnAlt;
      const y = ground(x) + alt;
      if (roll < 0.26) world.pickups.push({ type: 'boost', x, y, r: 1.3 });
      else if (roll < 0.5) world.pickups.push({ type: 'speed', x, y, r: 1.3 });
      else if (roll < 0.74) world.pickups.push({ type: 'lift', x, y, r: 1.4 });
      else {
        // Arc de pièces
        const n = 5;
        for (let i = 0; i < n; i++) {
          world.pickups.push({ type: 'coin', x: x + i * 2.6, y: y + Math.sin((i / (n - 1)) * Math.PI) * 2.5, r: 0.9 });
        }
      }
      // Les bonus se raréfient avec la distance
      world.genX += (24 + r() * 26) * (1 + x / 900) / s.density;
    }
    // Nettoyage
    if (world.pickups.length > 200) world.pickups = world.pickups.filter(pk => !pk.taken);
  }

  // Aimant + collecte. Renvoie la liste des bonus ramassés.
  function collect(world, p, s, dt) {
    const got = [];
    if (p.state !== 'flying' && p.state !== 'sliding') return got;
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const dx = p.x - pk.x, dy = p.y - pk.y;
      if (dx > 40) { pk.taken = true; pk.missed = true; continue; }
      if (dx < -s.magnet - 5) continue;
      const d = Math.hypot(dx, dy);
      if (d < pk.r + 0.9) {
        pk.taken = true;
        got.push(pk);
        applyPickup(p, s, pk.type);
      } else if (d < s.magnet) {
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
    }
  }

  G.Physics = { GRAV, ground, newPlane, launch, step, useSkill, newWorld, generate, collect, PICKUP_TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
