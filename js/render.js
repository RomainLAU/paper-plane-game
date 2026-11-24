/* Rendu Canvas 2D */
(function (G) {
  'use strict';
  const { ground } = G.Physics;

  let canvas, ctx, W = 0, H = 0, dpr = 1;
  const cam = { ppm: 20, left: -8, bottom: -2, gh: 0 };
  const speedLines = [];

  function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  function lerpColor(c1, c2, t) {
    const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
    const r = Math.round(lerp(a >> 16, b >> 16, t));
    const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
    const bl = Math.round(lerp(a & 255, b & 255, t));
    return `rgb(${r},${g},${bl})`;
  }

  const sx = x => (x - cam.left) * cam.ppm;
  const sy = y => H - (y - cam.bottom) * cam.ppm;

  function init(c) {
    canvas = c;
    ctx = canvas.getContext('2d');
    resize();
  }

  function resize() {
    dpr = Math.min(G.devicePixelRatio || 1, 2);
    W = G.innerWidth; H = G.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
  }

  // ---------------------------------------------------------------- Caméra
  function updateCamera(p, stats, dt, instant) {
    const k = instant ? 1 : Math.min(1, dt * 2.2);
    const gh = ground(p.x);
    cam.gh = instant ? gh : lerp(cam.gh, gh, Math.min(1, dt * 3));
    const alt = Math.max(0, p.y - cam.gh);
    const VH = clamp((alt + 7) / 0.6, 19, 240);
    const targetPpm = H / VH;
    cam.ppm = lerp(cam.ppm, targetPpm, k);
    const anchorX = p.state === 'aim' ? 0.28 : 0.3;
    cam.left = p.x - (W * anchorX) / cam.ppm;
    const viewM = H / cam.ppm;
    const bottomA = cam.gh - 0.1 * viewM;
    const bottomB = p.y - 0.72 * viewM;
    const target = Math.max(bottomA, bottomB);
    cam.bottom = instant ? target : lerp(cam.bottom, target, Math.min(1, dt * 6));
    // L'avion ne doit jamais sortir de l'écran
    cam.bottom = clamp(cam.bottom, p.y - 0.85 * viewM, p.y - 0.08 * viewM);
  }

  // ---------------------------------------------------------------- Fond
  function drawSky(p) {
    const t = clamp(p.y / 380, 0, 1);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, lerpColor('#4fb0ff', '#13226b', t));
    g.addColorStop(1, lerpColor('#d6f1ff', '#4f7fd0', t));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Soleil
    const sunX = W * 0.8 - (cam.left * 0.05) % (W * 0.1);
    const sunY = H * 0.2 + clamp((sy(0) - H) * 0.02, -20, 60);
    const rg = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 70);
    rg.addColorStop(0, 'rgba(255,250,210,1)');
    rg.addColorStop(0.35, 'rgba(255,240,170,0.8)');
    rg.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = rg;
    ctx.beginPath(); ctx.arc(sunX, sunY, 70, 0, Math.PI * 2); ctx.fill();
  }

  function drawFarClouds() {
    const shift = cam.left * 1.2;
    for (let i = 0; i < 6; i++) {
      const span = W + 400;
      const x = ((i * 337 - shift) % span + span) % span - 200;
      const y = H * (0.12 + 0.07 * (i % 3)) + clamp((sy(0) - H) * 0.05, 0, 120);
      cloudShape(x, y, 16 + (i % 3) * 7, 'rgba(255,255,255,0.4)');
    }
  }

  function drawRange(parallax, vpar, amp, wavelength, seed, color) {
    const groundY = sy(cam.gh);
    const base = H * 0.86 + clamp((groundY - H * 0.86) * vpar, -H, H * 2);
    if (base - amp * 1.1 > H) return;
    const shift = cam.left * parallax;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let x = 0; x <= W + 10; x += 10) {
      const u = (x + shift) / wavelength;
      const h = amp * (0.55 + 0.25 * Math.sin(u + seed) + 0.15 * Math.sin(u * 2.7 + seed * 3) + 0.05 * Math.sin(u * 7.3));
      ctx.lineTo(x, base - h);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function cloudShape(x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.arc(x + r * 0.9, y + r * 0.15, r * 0.75, 0, Math.PI * 2);
    ctx.arc(x - r * 0.9, y + r * 0.2, r * 0.65, 0, Math.PI * 2);
    ctx.arc(x + r * 0.3, y - r * 0.45, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawWorldClouds() {
    const cell = 55;
    const right = cam.left + W / cam.ppm;
    const top = cam.bottom + H / cam.ppm;
    for (let i = Math.floor((cam.left - 40) / cell); i <= Math.ceil((right + 40) / cell); i++) {
      if (hash(i * 7.31) > 0.6) continue;
      const x = i * cell + hash(i * 3.1) * 40;
      const y = 22 + Math.pow(hash(i * 1.77), 1.4) * 320;
      const r = 4 + hash(i * 9.9) * 7;
      if (y + r * 2 < cam.bottom || y - r * 2 > top) continue;
      cloudShape(sx(x), sy(y), r * cam.ppm, 'rgba(255,255,255,0.85)');
    }
  }

  // ---------------------------------------------------------------- Sol et décor
  function drawGround() {
    const groundTopMax = sy(ground(cam.left));
    if (groundTopMax > H + 400 && sy(0) > H + 400) return;
    const stepPx = 6;
    ctx.beginPath();
    ctx.moveTo(0, H + 2);
    for (let x = 0; x <= W + stepPx; x += stepPx) {
      ctx.lineTo(x, sy(ground(cam.left + x / cam.ppm)));
    }
    ctx.lineTo(W + stepPx, H + 2);
    ctx.closePath();
    const top = sy(cam.gh + 6);
    const g = ctx.createLinearGradient(0, top, 0, top + 6 * cam.ppm + 120);
    g.addColorStop(0, '#5cc84a');
    g.addColorStop(0.35, '#3fa63a');
    g.addColorStop(1, '#2b7a2c');
    ctx.fillStyle = g;
    ctx.fill();
    // Bordure d'herbe
    ctx.beginPath();
    for (let x = 0; x <= W + stepPx; x += stepPx) {
      const y = sy(ground(cam.left + x / cam.ppm));
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = '#86e06a';
    ctx.lineWidth = Math.max(3, cam.ppm * 0.35);
    ctx.stroke();
  }

  function drawTree(x, h, variant) {
    const gy = ground(x);
    const bx = sx(x), by = sy(gy);
    const ppm = cam.ppm;
    ctx.fillStyle = '#7a4b2a';
    ctx.fillRect(bx - 0.25 * ppm, by - h * 0.45 * ppm, 0.5 * ppm, h * 0.45 * ppm + 2);
    const greens = ['#2f8f3a', '#3a9e3f', '#2a7d36'];
    ctx.fillStyle = greens[variant % 3];
    if (variant % 2 === 0) {
      ctx.beginPath();
      ctx.arc(bx, by - h * 0.62 * ppm, h * 0.3 * ppm, 0, Math.PI * 2);
      ctx.arc(bx - h * 0.18 * ppm, by - h * 0.48 * ppm, h * 0.22 * ppm, 0, Math.PI * 2);
      ctx.arc(bx + h * 0.2 * ppm, by - h * 0.5 * ppm, h * 0.22 * ppm, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(bx, by - h * ppm);
      ctx.lineTo(bx - h * 0.28 * ppm, by - h * 0.3 * ppm);
      ctx.lineTo(bx + h * 0.28 * ppm, by - h * 0.3 * ppm);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawDecor(state) {
    const right = cam.left + W / cam.ppm;
    if (sy(cam.gh) > H + 300) return;
    // Arbres et buissons
    const cell = 9;
    for (let i = Math.max(2, Math.floor(cam.left / cell) - 1); i <= Math.ceil(right / cell) + 1; i++) {
      const h = hash(i + 11);
      if (h < 0.3) {
        drawTree(i * cell + hash(i + 0.5) * 6, 4 + hash(i * 2.3) * 5, Math.floor(hash(i * 5.7) * 6));
      } else if (h < 0.42) {
        const x = i * cell + hash(i + 0.7) * 6;
        ctx.fillStyle = '#2f9a3c';
        ctx.beginPath();
        ctx.arc(sx(x), sy(ground(x)), 0.9 * cam.ppm, Math.PI, 0);
        ctx.fill();
      } else if (h < 0.47) {
        // fleurs
        const x = i * cell + hash(i + 0.9) * 6;
        const colors = ['#ff6b8a', '#ffd93d', '#ffffff'];
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = colors[(i + k) % 3];
          ctx.beginPath();
          ctx.arc(sx(x + k * 0.6), sy(ground(x + k * 0.6) + 0.25), Math.max(1.5, 0.18 * cam.ppm), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Panneaux de distance
    const fs = clamp(cam.ppm * 0.7, 9, 16);
    const every = cam.ppm < 4 ? 100 : 25;
    for (let m = Math.max(every, Math.ceil(cam.left / every) * every); m <= right + every; m += every) {
      const big = m % 100 === 0;
      const gy = ground(m);
      const x = sx(m), y = sy(gy);
      const ph = (big ? 2.2 : 1.2) * cam.ppm;
      ctx.fillStyle = '#e8e0d0';
      ctx.fillRect(x - 1.5, y - ph, 3, ph);
      if (big) {
        ctx.font = `bold ${fs}px system-ui, sans-serif`;
        const label = `${m} m`;
        const tw = ctx.measureText(label).width + 10;
        ctx.fillStyle = '#ffffff';
        roundRect(x - tw / 2, y - ph - fs - 6, tw, fs + 6, 4);
        ctx.fill();
        ctx.fillStyle = '#334';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y - ph - fs / 2 - 3);
      }
    }
    // Drapeaux : record et dernier lancer
    if (state.record > 5) drawFlag(state.record, '#ff3b4f', 'RECORD');
    if (state.lastDistance > 5 && Math.abs(state.lastDistance - state.record) > 3) drawFlag(state.lastDistance, '#3b8bff', 'DERNIER');
  }

  function drawFlag(x, color, label) {
    const right = cam.left + W / cam.ppm;
    if (x < cam.left - 10 || x > right + 10) return;
    const gy = ground(x);
    const bx = sx(x), by = sy(gy);
    const h = Math.max(60, 6 * cam.ppm);
    ctx.fillStyle = '#ddd';
    ctx.fillRect(bx - 2, by - h, 4, h);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx + 2, by - h);
    ctx.lineTo(bx + 2 + h * 0.55, by - h + h * 0.15);
    ctx.lineTo(bx + 2, by - h + h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText(label, bx + 1, by - h - 3);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, bx, by - h - 4);
  }

  function drawTower(height) {
    if (sx(3) < -50) return;
    const ppm = cam.ppm;
    const x0 = sx(-1.6), x1 = sx(1.2), top = sy(height), bot = sy(0);
    ctx.strokeStyle = '#8a5a33';
    ctx.lineWidth = Math.max(3, 0.3 * ppm);
    ctx.beginPath();
    ctx.moveTo(x0, bot); ctx.lineTo(x0 + 0.3 * ppm, top);
    ctx.moveTo(x1, bot); ctx.lineTo(x1 - 0.3 * ppm, top);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, 0.15 * ppm);
    const n = Math.max(1, Math.round(height / 3));
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ya = sy((height * i) / n), yb = sy((height * (i + 1)) / n);
      ctx.moveTo(x0, ya); ctx.lineTo(x1, yb);
      ctx.moveTo(x1, ya); ctx.lineTo(x0, yb);
    }
    ctx.stroke();
    // plateforme
    ctx.fillStyle = '#a86d3d';
    ctx.fillRect(sx(-2.2), top - 0.35 * ppm, 3.6 * ppm, 0.4 * ppm);
    ctx.fillStyle = '#c98a52';
    ctx.fillRect(sx(-2.2), top - 0.35 * ppm, 3.6 * ppm, 0.12 * ppm);
  }

  // ---------------------------------------------------------------- Bonus
  const PK_COLORS = { boost: ['#ff9a3c', '#ff5a1f'], speed: ['#ffe24a', '#f5a400'], lift: ['#6ef08a', '#1fae4a'], coin: ['#ffe680', '#e0a800'] };

  function drawPickups(world, time) {
    const right = cam.left + W / cam.ppm;
    for (const pk of world.pickups) {
      if (pk.taken || pk.x < cam.left - 3 || pk.x > right + 3) continue;
      const x = sx(pk.x), y = sy(pk.y);
      if (y < -40 || y > H + 40) continue;
      const isCoin = pk.type === 'coin';
      const R = Math.max(pk.r * cam.ppm, isCoin ? 9 : 15);
      const [c1, c2] = PK_COLORS[pk.type];
      const pulse = 1 + 0.08 * Math.sin(time * 6 + pk.x);
      if (!isCoin) {
        ctx.fillStyle = c1 + '55';
        ctx.beginPath(); ctx.arc(x, y, R * 1.45 * pulse, 0, Math.PI * 2); ctx.fill();
      }
      const g = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, R * 0.1, x, y, R);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.3, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      if (isCoin) ctx.ellipse(x, y, R * Math.abs(Math.cos(time * 3 + pk.x)) + 1, R, 0, 0, Math.PI * 2);
      else ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawPickupIcon(pk.type, x, y, R);
    }
  }

  function drawPickupIcon(type, x, y, R) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, R * 0.18);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const s = R * 0.55;
    if (type === 'boost') {
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.8, s * 0.9, 0, s);
      ctx.bezierCurveTo(-s * 0.8, s * 0.9, -s * 0.9, -s * 0.1, -s * 0.2, -s * 0.3);
      ctx.bezierCurveTo(-s * 0.1, 0, 0, -s * 0.4, 0, -s);
      ctx.fill();
    } else if (type === 'speed') {
      ctx.beginPath();
      ctx.moveTo(s * 0.25, -s);
      ctx.lineTo(-s * 0.5, s * 0.1);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(-s * 0.25, s);
      ctx.lineTo(s * 0.5, -s * 0.15);
      ctx.lineTo(0, -s * 0.15);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'lift') {
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.05); ctx.lineTo(0, -s * 0.65); ctx.lineTo(s * 0.6, -s * 0.05);
      ctx.moveTo(-s * 0.6, s * 0.55); ctx.lineTo(0, -s * 0.05); ctx.lineTo(s * 0.6, s * 0.55);
      ctx.stroke();
    } else if (type === 'coin') {
      ctx.fillStyle = '#a86f00';
      ctx.font = `bold ${Math.round(R * 1.2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- Avion
  function planeSize() { return clamp(1.9 * cam.ppm, 30, 58); }

  function drawPlane(p, angle, time) {
    const x = sx(p.x), y = sy(p.y);
    const L = planeSize();
    // Ombre au sol
    const gy = sy(ground(p.x));
    const alt = p.y - ground(p.x);
    if (gy < H + 20 && alt < 60) {
      const a = clamp(0.3 - alt / 200, 0.05, 0.3);
      ctx.fillStyle = `rgba(0,0,0,${a})`;
      ctx.beginPath();
      ctx.ellipse(x, gy, L * 0.45 * (1 - alt / 120), L * 0.08, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-angle);
    // Flamme du boost
    if (p.boosting) {
      const f = 0.7 + Math.random() * 0.5;
      const big = p.nitroT > 0 ? 1.6 : 1;
      ctx.fillStyle = 'rgba(255,120,30,0.9)';
      ctx.beginPath();
      ctx.moveTo(-L * 0.42, -L * 0.07);
      ctx.lineTo(-L * (0.42 + 0.55 * f * big), 0);
      ctx.lineTo(-L * 0.42, L * 0.07);
      ctx.fill();
      ctx.fillStyle = p.nitroT > 0 ? 'rgba(140,220,255,0.95)' : 'rgba(255,230,90,0.95)';
      ctx.beginPath();
      ctx.moveTo(-L * 0.42, -L * 0.04);
      ctx.lineTo(-L * (0.42 + 0.3 * f * big), 0);
      ctx.lineTo(-L * 0.42, L * 0.04);
      ctx.fill();
    }
    // Corps (dessous)
    ctx.fillStyle = '#c9d6e6';
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.lineTo(-L * 0.45, L * 0.02);
    ctx.lineTo(-L * 0.5, L * 0.17);
    ctx.closePath();
    ctx.fill();
    // Aile (dessus)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(L * 0.5, 0);
    ctx.lineTo(-L * 0.5, -L * 0.3);
    ctx.lineTo(-L * 0.38, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8ea3bd';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Pli
    ctx.beginPath();
    ctx.moveTo(L * 0.46, -L * 0.01);
    ctx.lineTo(-L * 0.44, -L * 0.12);
    ctx.stroke();
    // Effet "plané" : petites lignes d'air sur l'aile
    if (p.gliding && p.state === 'flying') {
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const o = ((time * 3 + i / 3) % 1);
        ctx.beginPath();
        ctx.moveTo(L * (0.3 - o * 0.9), -L * (0.38 + i * 0.07));
        ctx.lineTo(L * (0.1 - o * 0.9), -L * (0.38 + i * 0.07));
        ctx.stroke();
      }
    }
    ctx.restore();
    // Bulle "vol plané" / "ascension"
    if (p.glideT > 0 || p.liftT > 0) {
      ctx.strokeStyle = p.glideT > 0 ? 'rgba(150,220,255,0.8)' : 'rgba(120,255,150,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, L * 0.75 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTrail(trail) {
    if (trail.length < 2) return;
    ctx.lineCap = 'round';
    for (let i = 1; i < trail.length; i++) {
      const a = i / trail.length;
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.55})`;
      ctx.lineWidth = 1 + a * 2.5;
      ctx.beginPath();
      ctx.moveTo(sx(trail[i - 1].x), sy(trail[i - 1].y));
      ctx.lineTo(sx(trail[i].x), sy(trail[i].y));
      ctx.stroke();
    }
  }

  function drawParticles(parts) {
    for (const q of parts) {
      const a = clamp(q.life / q.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(sx(q.x), sy(q.y), q.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSpeedLines(speed, dt) {
    if (speed > 28 && speedLines.length < 30 && Math.random() < (speed - 28) / 40) {
      speedLines.push({ x: W + 20, y: Math.random() * H, len: 40 + Math.random() * 80, v: 900 + Math.random() * 600 });
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const l = speedLines[i];
      l.x -= l.v * dt;
      if (l.x + l.len < 0) { speedLines.splice(i, 1); continue; }
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
    }
    ctx.stroke();
  }

  // ---------------------------------------------------------------- Visée
  function drawAim(p, aim) {
    if (!aim || !aim.active) return;
    // Trajectoire prévue
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < aim.preview.length; i++) {
      const pt = aim.preview[i];
      ctx.beginPath();
      ctx.arc(sx(pt.x), sy(pt.y), Math.max(1.5, 3.5 - i * 0.08), 0, Math.PI * 2);
      ctx.fill();
    }
    // Flèche de puissance
    const x = sx(p.x), y = sy(p.y);
    const len = 40 + aim.power * 90;
    const ex = x + Math.cos(aim.angle) * len, ey = y - Math.sin(aim.angle) * len;
    const col = aim.power < 0.5 ? lerpColor('#5be36b', '#ffd23f', aim.power * 2) : lerpColor('#ffd23f', '#ff4b3a', (aim.power - 0.5) * 2);
    ctx.strokeStyle = col;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(aim.angle) * 12, ey - Math.sin(aim.angle) * 12);
    ctx.lineTo(ex + Math.cos(aim.angle + 2.3) * 12, ey - Math.sin(aim.angle + 2.3) * 12);
    ctx.lineTo(ex + Math.cos(aim.angle - 2.3) * 12, ey - Math.sin(aim.angle - 2.3) * 12);
    ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 3;
    const label = `${Math.round(aim.power * 100)}%  ${Math.round(aim.angle * 180 / Math.PI)}°`;
    ctx.strokeText(label, x, y + 34);
    ctx.fillText(label, x, y + 34);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------------------------------------------------------------- Image complète
  function draw(st, dt) {
    const p = st.plane;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawSky(p);
    drawFarClouds();
    drawRange(0.6, 0.08, H * 0.32, 260, 1.3, 'rgba(120,150,200,0.55)');
    drawRange(1.6, 0.2, H * 0.2, 170, 4.1, 'rgba(90,160,110,0.75)');
    drawWorldClouds();
    drawTower(st.stats.launchHeight);
    drawGround();
    drawDecor(st);
    drawPickups(st.world, st.time);
    drawTrail(st.trail);
    drawParticles(st.particles);
    let angle;
    if (p.state === 'aim') angle = st.aim && st.aim.active ? st.aim.angle : 0.2;
    else if (p.state === 'flying') angle = Math.atan2(p.vy, p.vx) + (p.gliding ? 0.15 : 0);
    else angle = Math.atan2(ground(p.x + 0.5) - ground(p.x - 0.5), 1);
    st.drawAngle = st.drawAngle == null ? angle : lerp(st.drawAngle, angle, Math.min(1, dt * 12));
    drawPlane(p, st.drawAngle, st.time);
    drawAim(p, st.aim);
    const speed = p.state === 'flying' ? Math.hypot(p.vx, p.vy) : 0;
    drawSpeedLines(st.paused ? 0 : speed, st.paused ? 0 : dt);
  }

  G.Renderer = { init, resize, updateCamera, draw, cam, size: () => ({ W, H }) };
})(window);
