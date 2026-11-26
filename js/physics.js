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
  // Canyon : sol de roche ondulé, des piliers de pierre à survoler
  function canyon(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 60);
    return Math.max(0, 2.5 + 2 * Math.sin(x / 47) + 1.2 * Math.sin(x / 19 + 2) + 2.5 * Math.sin(x / 167)) * ramp;
  }
  // Volcan : sol de lave refroidie, avec des bassins de lave en fusion
  const LAVA_CELL = 64;
  function lavaPool(x) {
    const i = Math.floor(x / LAVA_CELL);
    if (i < 1 || hash(i * 9.7 + 4) > 0.5) return null;
    const c = i * LAVA_CELL + 22 + hash(i * 3.1) * 22, w = 6 + hash(i * 5.9) * 9;
    return Math.abs(x - c) < w ? { c, w } : null;
  }
  function volcanoBase(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 50);
    return Math.max(0, 3.5 + 2.5 * Math.sin(x / 57) + 1.6 * Math.sin(x / 21 + 1) + 3 * Math.sin(x / 190 + 2)) * ramp;
  }
  function volcano(x) {
    const pool = lavaPool(x);
    if (!pool) return volcanoBase(x);
    return Math.max(0, Math.min(volcanoBase(pool.c - pool.w), volcanoBase(pool.c + pool.w)) - 1.2);
  }
  // Banquise : glace lisse et congères
  function ice(x) {
    if (x < 15) return 0;
    const ramp = Math.min(1, (x - 15) / 60);
    return Math.max(0, 1.5 + 1.4 * Math.sin(x / 83) + 0.7 * Math.sin(x / 29 + 1)) * ramp;
  }
  // Sol visuel (sans les obstacles solides)
  function terrain(x) {
    switch (TERRAIN) {
      case 'dunes': return dunes(x);
      case 'peaks': return peaks(x);
      case 'islands': return islands(x);
      case 'canyon': return canyon(x);
      case 'city': return 0;
      case 'volcano': return volcano(x);
      case 'ice': return ice(x);
      default: return hills(x);
    }
  }

  // ---------------------------------------------------------------- Obstacles solides
  // Piliers de pierre (canyon) et immeubles (ville) : on peut se poser sur le dessus,
  // mais foncer dedans de face écrase l'avion.
  const SOLID_CELL = { canyon: 95, city: 34 };
  function solidInCell(i) {
    if (TERRAIN === 'canyon') {
      if (i < 1 || hash(i * 4.3 + 1) > 0.72) return null;
      const c = i * 95 + 30 + hash(i * 2.9) * 40, w = 5 + hash(i * 6.1) * 8;
      const h = (14 + hash(i * 1.7) * 26) * Math.min(1.5, 0.7 + i * 0.06);
      return { x0: c - w / 2, x1: c + w / 2, top: Math.max(canyon(c - w / 2), canyon(c + w / 2)) + h, kind: 'pillar', seed: i };
    }
    if (TERRAIN === 'city') {
      if (i < 2 || hash(i * 3.7 + 2) > 0.8) return null;
      const x0 = i * 34 + 3 + hash(i * 5.3) * 6;
      const x1 = Math.min(x0 + 12 + hash(i * 7.7) * 14, (i + 1) * 34 - 3);
      const h = (8 + Math.pow(hash(i * 1.3), 1.5) * 34) * Math.min(1.6, 0.6 + i * 0.02);
      return { x0, x1, top: h, kind: 'building', seed: i };
    }
    return null;
  }
  function solidAt(x) {
    const cell = SOLID_CELL[TERRAIN];
    if (!cell) return null;
    const i = Math.floor(x / cell);
    for (let j = i - 1; j <= i + 1; j++) {
      const so = solidInCell(j);
      if (so && x >= so.x0 && x <= so.x1) return so;
    }
    return null;
  }
  function solidsBetween(a, b) {
    const cell = SOLID_CELL[TERRAIN], out = [];
    if (!cell) return out;
    for (let i = Math.floor(a / cell) - 1; i <= Math.ceil(b / cell) + 1; i++) {
      const so = solidInCell(i);
      if (so && so.x1 >= a && so.x0 <= b) out.push(so);
    }
    return out;
  }
  function isLava(x) { return TERRAIN === 'volcano' && !!lavaPool(x); }

  // Sol physique : terrain + dessus des obstacles
  function ground(x) {
    const t = terrain(x);
    const so = solidAt(x);
    return so ? Math.max(t, so.top) : t;
  }

  // ---------------------------------------------------------------- Avion
  function newPlane(stats, actives) {
    return {
      state: 'aim', // aim | flying | sliding | stopped
      x: 0, y: stats.launchHeight + 0.6, vx: 0, vy: 0,
      fuel: stats.tank,
      boosting: false, gliding: false,
      liftT: 0, liftDur: 1, liftRate0: 0, liftRate: 0, nitroT: 0, glideT: 0, starT: 0, inJet: false,
      inSand: false, inGust: false, sink: 0, rise: 0,
      crumple: 0, burnt: false, shieldT: 0, diamonds: 0,
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
    } else if (id === 'flap') {
      // battement d'ailes : petit coup vers le haut et un peu de vitesse
      startLift(p, stats, 6, 0.45);
      const sp = Math.hypot(p.vx, p.vy);
      setVelocity(p, sp + 2.5, Math.atan2(p.vy, p.vx));
    } else if (id === 'shield') {
      p.shieldT = [0, 6, 8, 10][a.lvl];
    }
    return true;
  }

  // input = { glide: bool, boost: bool } ; ev = tableau d'événements (sons/effets)
  function step(p, s, dt, input, ev) {
    p.time += dt;
    if (p.state === 'flying') {
      const speed = Math.hypot(p.vx, p.vy) || 0.001;

      let cl = s.cl, cd = s.cd;
      if (p.crumple > 0) { cd *= 1 + 0.8 * p.crumple; cl *= 1 - 0.25 * p.crumple; } // avion plié : plane moins bien
      if (p.shieldT > 0) p.shieldT -= dt;
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
      if (p.inGust) thrust += 8 * s.bonus * Math.min(1, 30 / speed); // rafale dans le dos

      const calm = 1 - (s.tailwind || 0);          // compétence Vent arrière
      D += (s.headwind || 0) * calm;               // vent de face
      if (p.inSand) D = D * (1 + calm) + 1.5 * calm; // tempête de sable / blizzard
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

      const prevX = p.x, prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liftRate = 0;
      if (p.liftT > 0) {
        p.liftRate = p.liftRate0 * (p.liftT / p.liftDur);
        p.y += p.liftRate * dt;
        p.liftT -= dt;
      }
      if (p.sink > 0 && !holdAlt) p.y -= p.sink * dt; // rafale descendante : l'air plonge
      if (p.rise > 0) p.y += p.rise * dt;              // thermique / bouche d'aération

      const gh = ground(p.x);
      const water = s.map && s.map.water && gh < 0;
      const floor = water ? 0 : gh;
      if (p.y <= floor && !water) {
        // ---- Impact : vitesse avec laquelle l'avion rentre dans la surface ----
        const wall = gh > prevY + 0.3 && prevY > ground(prevX) - 0.05; // le sol « saute » devant : c'est un mur
        let vn;
        if (wall) vn = Math.max(0, p.vx);
        else {
          const surf = Math.atan((ground(p.x + 0.3) - ground(p.x - 0.3)) / 0.6);
          vn = sp * Math.sin(Math.max(0, surf - Math.atan2(p.vy, p.vx)));
        }
        const T = 11 * (s.toughness || 1);             // seuil d'écrasement
        const lava = isLava(p.x) && !wall;
        const bend = amt => { p.crumple = Math.min(1, p.crumple + amt); };
        if (wall) {
          p.x = prevX - 0.05;
          if (p.bouncesLeft > 0 && sp > 4) {
            p.bouncesLeft--;
            bend(vn > T ? 0.5 : 0.15);
            p.y = Math.max(prevY, ground(p.x) + 0.05);
            setVelocity(p, sp * s.bounceKeep * 0.8, 0.8);
            ev.push(vn > T * 0.6 ? 'bend' : 'bounce');
          } else {
            bend(vn > T ? 1 : vn > T * 0.6 ? 0.5 : 0.2);
            p.state = 'falling'; p.vx = 0; p.vy = Math.min(0, p.vy); p.y = prevY; p.boosting = false;
            ev.push(vn > T ? 'crash' : 'bonk');
          }
          if (p.x > p.maxX) p.maxX = p.x;
          return;
        }
        if (lava) {
          if (p.bouncesLeft > 0 && sp > 4) {
            p.bouncesLeft--; bend(0.3);
            setVelocity(p, sp * s.bounceKeep, 0.42); p.y = floor + 0.05;
            ev.push('sizzle');
          } else {
            p.crumple = 1; p.burnt = true; p.y = floor;
            p.state = 'stopped'; p.vx = 0; p.vy = 0; p.boosting = false;
            ev.push('burn');
          }
          if (p.x > p.maxX) p.maxX = p.x;
          return;
        }
        if (vn > T && !(p.bouncesLeft > 0)) {
          // Écrasé : l'avion finit en boule de papier
          p.crumple = 1; p.y = floor;
          p.state = 'stopped'; p.vx = 0; p.vy = 0; p.boosting = false;
          ev.push('crash');
          if (p.x > p.maxX) p.maxX = p.x;
          return;
        }
        if (vn > T) { bend(0.5); ev.push('bend'); }
        else if (vn > T * 0.6) { bend(0.3); ev.push('bend'); }
      }
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
      let dec = 5 + 0.08 * p.vx * p.vx;
      if (s.map && s.map.ice) dec *= 0.3;           // la glace glisse
      dec *= s.slideMult || 1;                        // compétence Glissade
      dec += Math.max(0, slope) * 14;                 // glisser en montée freine fort
      p.vx -= dec * dt;
      if (p.vx <= 0.2) {
        p.vx = 0;
        p.state = 'stopped';
        ev.push('stop');
      }
      const nx = p.x + p.vx * dt, ng = ground(nx);
      if (ng > p.y + 0.6) {                           // bute contre un mur
        p.vx = 0; p.state = 'stopped'; p.crumple = Math.min(1, p.crumple + 0.15); ev.push('bonk');
      } else if (ng < p.y - 1) {                      // tombe du toit
        p.x = nx; p.state = 'flying'; p.vy = 0;
      } else if (isLava(nx)) {
        p.x = nx; p.y = ng; p.vx = 0; p.state = 'stopped'; p.crumple = 1; p.burnt = true; ev.push('burn');
      } else {
        p.x = nx;
        p.y = ng;
      }
      if (s.map && s.map.water && p.y < 0) { // glisse jusque dans l'eau
        p.y = 0; p.vx = 0; p.state = 'stopped'; ev.push('splash');
      }
    } else if (p.state === 'falling') {
      // après un choc contre un mur : l'avion tombe le long de la paroi
      p.vy -= GRAV * s.gravity * dt;
      p.y += p.vy * dt;
      const gf = ground(p.x);
      if (p.y <= gf) { p.y = gf; p.vy = 0; p.state = 'stopped'; ev.push('stop'); }
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
  // Les diamants (monnaie rare des cosmétiques) sont un peu plus fréquents en altitude.
  const SPAWN_TABLE = [
    ['boost', 26, 0], ['speed', 24, 0], ['lift', 24, 0], ['coin', 24, 0], ['diamond', 6, 0],
    ['birds', 26, 35], ['balloon', 14, 50], ['star', 10, 90], ['diamond', 8, 80], ['jet', 16, 130],
  ];

  function pickType(r, alt, s) {
    const pool = SPAWN_TABLE.filter(t => alt >= t[2]);
    const w = t => t[1] * (t[0] === 'diamond' ? (s.diamondMult || 1) : 1);
    let tot = 0;
    for (const t of pool) tot += w(t);
    let v = r() * tot;
    for (const t of pool) { v -= w(t); if (v <= 0) return t[0]; }
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
      const type = pickType(r, alt, s);
      const P = world.pickups;
      if (type === 'coin') {
        for (let i = 0; i < 5; i++) P.push({ type, x: x + i * 2.6, y: y + Math.sin((i / 4) * Math.PI) * 2.5, r: 0.9 });
      } else if (type === 'diamond') {
        P.push({ type, x, y, r: 1.1 });
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
      if (hzTot > 0 && x > 60 && r() < Math.min(0.85, hzTot / 100)) {
        let v = r() * hzTot, pick = hz[0];
        for (const h of hz) { v -= h[1]; if (v <= 0) { pick = h; break; } }
        const hType = pick[0], skin = pick[3];
        const hx = x + 8 + r() * 12;
        const halt = Math.max(pick[2] || 3, pa - 4 + (r() + r() - 1) * Math.max(14, Math.min(35, pa * 0.2)));
        const hy = ground(hx) + halt;
        if (hType === 'sand') P.push({ type: 'sand', skin, x: hx, y: hy, len: 45 + r() * 50, h: 7 });
        else if (hType === 'down') P.push({ type: 'down', skin, x: hx, y: hy, w: 12 + r() * 8, h: 22 });
        else if (hType === 'up') {
          if (skin === 'vent') {
            // bouche d'aération sur un toit : colonne d'air chaud qui monte
            const so = solidAt(hx);
            if (so) P.push({ type: 'up', skin, x: (so.x0 + so.x1) / 2, y: so.top + 9, w: Math.min(9, so.x1 - so.x0), h: 9, rise: 10 });
          } else {
            let tx = hx;
            for (let k = 0; k < 60; k += 3) { const pool = lavaPool(hx + k); if (pool) { tx = pool.c; break; } }
            P.push({ type: 'up', skin, x: tx, y: Math.max(terrain(tx) + 18, hy), w: 14 + r() * 10, h: 26, rise: 9 });
          }
        } else if (hType === 'gust') P.push({ type: 'gust', skin, x: hx, y: hy, len: 50 + r() * 50, h: 6 });
        else if (hType === 'gull') {
          const n = 1 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) P.push({ type: 'gull', skin, x: hx + i * 4, y: hy + (r() - 0.5) * 5, r: skin === 'vulture' ? 1.4 : 1.1, vx: -(4 + r() * 4), phase: r() * 6 });
        } else if (hType === 'storm') P.push({ type: 'storm', skin, x: hx, y: hy, r: 3.2, vx: -1.5, phase: r() * 10 });
        else if (hType === 'birds') {
          const n = 2 + Math.floor(r() * 3);
          for (let i = 0; i < n; i++) P.push({ type: 'bird', skin, x: hx + i * 3.5, y: hy + (r() - 0.5) * 4, r: 1.1, vx: 2 + r() * 2, phase: r() * 6 });
        }
      }
      // Les bonus se raréfient avec la distance
      world.genX += (17 + r() * 21) * (1 + x / 700) / s.density;
    }
    // Nettoyage
    if (world.pickups.length > 200) world.pickups = world.pickups.filter(pk => !pk.taken);
  }

  const NO_MAGNET = { bird: 1, balloon: 1, jet: 1, gull: 1, storm: 1, sand: 1, down: 1, up: 1, gust: 1 };
  const ZONES = { jet: 1, sand: 1, gust: 1 };
  const COLUMNS = { down: 1, up: 1 };
  const HAZARDS = { gull: 1, storm: 1, sand: 1, down: 1 };

  // Déplacement des bonus mobiles, aimant + collecte. Renvoie la liste des bonus ramassés.
  function collect(world, p, s, dt) {
    const got = [];
    p.inJet = false;
    p.inSand = false;
    p.inGust = false;
    p.sink = 0;
    p.rise = 0;
    const shielded = p.shieldT > 0;
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
          if (pk.type === 'sand' && shielded) { if (!pk.entered) { pk.entered = true; got.push({ type: 'shield', x: p.x, y: p.y }); } continue; }
          if (pk.type === 'jet') p.inJet = true; else if (pk.type === 'gust') p.inGust = true; else p.inSand = true;
          if (!pk.entered) { pk.entered = true; got.push(pk); if (pk.type !== 'sand') p.pickups++; }
        }
        continue;
      }
      if (COLUMNS[pk.type]) {
        if (p.x > pk.x + pk.w + 40) { pk.taken = true; continue; }
        if (p.state === 'flying' && Math.abs(p.x - pk.x) < pk.w / 2 && Math.abs(p.y - pk.y) < pk.h) {
          if (pk.type === 'down' && shielded) { if (!pk.entered) { pk.entered = true; got.push({ type: 'shield', x: p.x, y: p.y }); } continue; }
          if (pk.type === 'down') p.sink = 9; else p.rise = pk.rise * s.bonus;
          if (!pk.entered) { pk.entered = true; got.push(pk); if (pk.type === 'up') p.pickups++; }
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
        if (HAZARDS[pk.type] && shielded) { got.push({ type: 'shield', x: pk.x, y: pk.y }); continue; }
        got.push(pk);
        applyPickup(p, s, pk.type, pk.skin);
      } else if (d < s.magnet && !NO_MAGNET[pk.type]) {
        const pull = Math.min(1, (60 * dt) / Math.max(d, 0.5)) * 0.6;
        pk.x += dx * pull + p.vx * dt * 0.9;
        pk.y += dy * pull + p.vy * dt * 0.9;
      }
    }
    return got;
  }

  function applyPickup(p, s, type, skin) {
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
      p.diamonds++;
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
      setVelocity(p, sp * (skin === 'vulture' ? 0.65 : 0.72), Math.atan2(p.vy, p.vx) - (skin === 'vulture' ? 0.3 : 0.1));
    } else if (type === 'storm') {
      // Nuage électrique : décharge, grosse perte de vitesse
      p.pickups--;
      const sp = Math.hypot(p.vx, p.vy);
      setVelocity(p, sp * (skin === 'ash' ? 0.7 : 0.62), Math.min(Math.atan2(p.vy, p.vx), 0) - 0.25);
    }
  }

  G.Physics = { GRAV, ground, terrain, solidAt, solidsBetween, isLava, setTerrain, newPlane, launch, step, useSkill, newWorld, generate, collect, PICKUP_TYPES };
})(typeof window !== 'undefined' ? window : globalThis);
