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
  // Lumière : le soleil est en haut à droite, les ombres partent vers la gauche.
  const SHADOW_DX = -0.45;

  function skyColors(y) {
    const t1 = clamp(y / 200, 0, 1);          // jour -> haute altitude
    const t2 = clamp((y - 200) / 350, 0, 1);  // haute altitude -> espace (nuit étoilée)
    return {
      top: t2 > 0 ? lerpColorRGB('#2a5fc4', '#060a22', t2) : lerpColorRGB('#4fb0ff', '#2a5fc4', t1),
      bottom: t2 > 0 ? lerpColorRGB('#7fb2ea', '#1d2a63', t2) : lerpColorRGB('#d6f1ff', '#7fb2ea', t1),
    };
  }
  function lerpColorRGB(a, b, t) { return lerpColor(a, b, t); }

  function drawSky(p, time) {
    const c = skyColors(p.y);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, c.top);
    g.addColorStop(1, c.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const starA = clamp((p.y - 140) / 220, 0, 1);
    if (starA > 0) { drawStars(starA, time); drawMoon(starA); }
  }

  function drawStars(a, time) {
    const span = W + 200;
    for (let i = 0; i < 160; i++) {
      const depth = 0.15 + hash(i * 1.3) * 0.5;
      const x = ((hash(i * 3.1) * span - cam.left * depth) % span + span) % span - 100;
      const y = hash(i * 7.7) * H * 0.9;
      const tw = 0.55 + 0.45 * Math.sin(time * (1 + hash(i * 2.2) * 3) + i);
      const r = 0.5 + hash(i * 5.3) * 1.5;
      ctx.fillStyle = `rgba(255,255,${hash(i * 9.1) > 0.8 ? 200 : 255},${a * tw})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // Étoile filante de temps en temps
    const period = 4.5, k = Math.floor(time / period), ph = (time % period) / 0.8;
    if (a > 0.5 && ph < 1 && hash(k * 3.3) < 0.75) {
      const x0 = W * (0.2 + hash(k) * 0.6), y0 = H * (0.05 + hash(k * 2.1) * 0.3);
      const x1 = x0 - 160 * ph, y1 = y0 + 70 * ph;
      const gr = ctx.createLinearGradient(x1, y1, x1 + 70, y1 - 30);
      gr.addColorStop(0, `rgba(255,255,255,${a * (1 - ph)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = gr; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + 70, y1 - 30); ctx.stroke();
    }
  }

  function drawMoon(a) {
    const x = W * 0.17, y = H * 0.2, r = 20;
    ctx.save();
    ctx.globalAlpha = a;
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 3);
    g.addColorStop(0, 'rgba(230,235,255,0.35)');
    g.addColorStop(1, 'rgba(230,235,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f3f1e4';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,175,160,0.5)';
    for (const [cx, cy, cr] of [[-6, -5, 4], [5, 3, 5], [-3, 8, 3], [8, -8, 2.5]]) {
      ctx.beginPath(); ctx.arc(x + cx, y + cy, cr, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSun(p, time) {
    const x = W * 0.8, y = H * 0.18 + clamp((sy(0) - H) * 0.02, -20, 60);
    const space = clamp((p.y - 200) / 350, 0, 1);
    // halo
    const halo = ctx.createRadialGradient(x, y, 10, x, y, 150);
    halo.addColorStop(0, `rgba(255,248,200,${0.75 - space * 0.4})`);
    halo.addColorStop(0.4, `rgba(255,235,160,${0.25 - space * 0.15})`);
    halo.addColorStop(1, 'rgba(255,235,160,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(x, y, 150, 0, Math.PI * 2); ctx.fill();
    // rayons qui tournent doucement
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 0.06);
    ctx.fillStyle = `rgba(255,245,190,${0.09 * (1 - space)})`;
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath();
      ctx.moveTo(0, -34);
      ctx.lineTo(6, -(70 + (i % 2) * 25));
      ctx.lineTo(-6, -(70 + (i % 2) * 25));
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // disque
    const d = ctx.createRadialGradient(x - 8, y - 8, 4, x, y, 30);
    d.addColorStop(0, '#fffef0');
    d.addColorStop(0.6, '#fff0a0');
    d.addColorStop(1, '#ffd34d');
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
  }

  // Nuage en relief : ombre en dessous, corps blanc, reflet en haut à droite
  function puffyCloud(x, y, r, alpha) {
    const puffs = [[0, 0, 1], [0.95, 0.2, 0.72], [-0.95, 0.25, 0.66], [0.35, -0.45, 0.75], [-0.4, -0.3, 0.6], [1.6, 0.4, 0.45], [-1.6, 0.45, 0.42]];
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#c6d6ec';
    ctx.beginPath();
    for (const [dx, dy, k] of puffs) { ctx.moveTo(x + dx * r + k * r, y + dy * r + r * 0.18); ctx.arc(x + dx * r, y + dy * r + r * 0.18, k * r, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const [dx, dy, k] of puffs) { ctx.moveTo(x + dx * r + k * r * 0.92, y + dy * r); ctx.arc(x + dx * r, y + dy * r, k * r * 0.92, 0, Math.PI * 2); }
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,240,0.8)';
    ctx.beginPath(); ctx.arc(x + r * 0.5, y - r * 0.55, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFarClouds() {
    const shift = cam.left * 1.2;
    for (let i = 0; i < 6; i++) {
      const span = W + 400;
      const x = ((i * 337 - shift) % span + span) % span - 200;
      const y = H * (0.12 + 0.07 * (i % 3)) + clamp((sy(0) - H) * 0.05, 0, 120);
      puffyCloud(x, y, 13 + (i % 3) * 6, 0.45);
    }
  }

  function drawRange(parallax, vpar, amp, wavelength, seed, color, opts) {
    const groundY = sy(cam.gh);
    const base = H * 0.86 + clamp((groundY - H * 0.86) * vpar, -H, H * 2);
    if (base - amp * 1.1 > H) return;
    const shift = cam.left * parallax;
    const pts = [];
    for (let x = 0; x <= W + 10; x += 10) {
      const u = (x + shift) / wavelength;
      const h = amp * (0.55 + 0.25 * Math.sin(u + seed) + 0.15 * Math.sin(u * 2.7 + seed * 3) + 0.05 * Math.sin(u * 7.3));
      pts.push([x, base - h]);
    }
    const shape = () => {
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(W, H);
      ctx.closePath();
    };
    ctx.fillStyle = color;
    shape();
    ctx.fill();
    if (opts && opts.snow) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, base - amp * 0.86);
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      shape();
      ctx.fill();
      ctx.restore();
    }
    if (opts && opts.trees) {
      ctx.fillStyle = opts.trees;
      for (let i = 0; i < pts.length; i++) {
        const wx = Math.floor((pts[i][0] + shift) / 10);
        const h = hash(wx * 0.37);
        if (h > 0.45) continue;
        const [x, y] = pts[i];
        const s = 5 + h * 9;
        ctx.beginPath();
        if (h < 0.25) { ctx.moveTo(x, y - s * 1.6); ctx.lineTo(x - s * 0.5, y + 1); ctx.lineTo(x + s * 0.5, y + 1); }
        else ctx.arc(x, y - s * 0.5, s * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
      puffyCloud(sx(x), sy(y), r * cam.ppm, 0.92 - clamp((cam.bottom - 150) / 400, 0, 0.35));
    }
  }

  // ---------------------------------------------------------------- Sol et décor
  function groundVisible() { return sy(cam.gh) < H + 300; }

  function drawGround() {
    if (sy(ground(cam.left)) > H + 400 && sy(0) > H + 400) return;
    const stepPx = 6;
    const top = [];
    for (let x = 0; x <= W + stepPx; x += stepPx) top.push([x, sy(ground(cam.left + x / cam.ppm))]);
    // Terre
    ctx.beginPath();
    ctx.moveTo(0, H + 2);
    for (const [x, y] of top) ctx.lineTo(x, y);
    ctx.lineTo(W + stepPx, H + 2);
    ctx.closePath();
    const gTop = sy(cam.gh + 6);
    const soil = ctx.createLinearGradient(0, gTop, 0, gTop + 6 * cam.ppm + 200);
    soil.addColorStop(0, '#9a7448');
    soil.addColorStop(1, '#5a4129');
    ctx.fillStyle = soil;
    ctx.fill();
    // Couche d'herbe
    const depth = Math.max(12, 1.4 * cam.ppm);
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = top.length - 1; i >= 0; i--) {
      const [x, y] = top[i];
      ctx.lineTo(x, y + depth + Math.sin((cam.left * cam.ppm + x) * 0.15) * depth * 0.18);
    }
    ctx.closePath();
    const grass = ctx.createLinearGradient(0, gTop, 0, gTop + 6 * cam.ppm + depth);
    grass.addColorStop(0, '#6fd456');
    grass.addColorStop(1, '#3f9f3a');
    ctx.fillStyle = grass;
    ctx.fill();
    // Liseré lumineux
    ctx.beginPath();
    top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = '#9cec7a';
    ctx.lineWidth = Math.max(2.5, cam.ppm * 0.22);
    ctx.stroke();
    if (cam.ppm < 5) return;
    // Cailloux dans la terre
    const right = cam.left + W / cam.ppm;
    ctx.fillStyle = 'rgba(70,50,30,0.35)';
    for (let i = Math.floor(cam.left / 2.3); i <= Math.ceil(right / 2.3); i++) {
      const h = hash(i * 4.7);
      if (h > 0.5) continue;
      const wx = i * 2.3 + h * 2;
      const y = sy(ground(wx)) + depth + 4 + hash(i * 8.1) * 2.5 * cam.ppm;
      if (y > H) continue;
      ctx.beginPath(); ctx.ellipse(sx(wx), y, 0.25 * cam.ppm, 0.15 * cam.ppm, 0, 0, Math.PI * 2); ctx.fill();
    }
    // Touffes d'herbe
    ctx.strokeStyle = '#3c9a36';
    ctx.lineWidth = Math.max(1, cam.ppm * 0.07);
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = Math.floor(cam.left / 0.8); i <= Math.ceil(right / 0.8); i++) {
      if (hash(i * 2.9) > 0.55) continue;
      const wx = i * 0.8 + hash(i) * 0.6;
      const bx = sx(wx), by = sy(ground(wx)) + 1;
      const bh = (0.35 + hash(i * 6.1) * 0.35) * cam.ppm;
      ctx.moveTo(bx, by); ctx.lineTo(bx - bh * 0.35, by - bh);
      ctx.moveTo(bx, by); ctx.lineTo(bx, by - bh * 1.2);
      ctx.moveTo(bx, by); ctx.lineTo(bx + bh * 0.35, by - bh);
    }
    ctx.stroke();
  }

  // Ombre portée au sol (vers la gauche)
  function groundShadow(x, w, h) {
    const gy = sy(ground(x));
    ctx.fillStyle = 'rgba(20,50,20,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx(x) + SHADOW_DX * h * cam.ppm * 0.6, gy + 1, (w * 0.5 + h * 0.35) * cam.ppm, Math.max(2, 0.28 * cam.ppm), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- Arbres
  const TREE_TYPES = ['round', 'pine', 'birch', 'apple', 'autumn', 'poplar', 'bush'];
  function drawTree(x, h, type, seed) {
    const ppm = cam.ppm;
    const bx = sx(x), by = sy(ground(x)) + 2;
    groundShadow(x, type === 'bush' ? 2 : 1.4, h * 0.8);
    const blob = (cx, cy, r, dark, mid, light) => {
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = mid; ctx.beginPath(); ctx.arc(cx + r * 0.12, cy - r * 0.1, r * 0.82, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = light; ctx.beginPath(); ctx.arc(cx + r * 0.35, cy - r * 0.35, r * 0.4, 0, Math.PI * 2); ctx.fill();
    };
    const trunk = (w, th, color) => {
      ctx.fillStyle = color || '#7a4b2a';
      ctx.fillRect(bx - w * ppm / 2, by - th * ppm, w * ppm, th * ppm);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(bx - w * ppm / 2, by - th * ppm, w * ppm * 0.35, th * ppm);
    };
    if (type === 'pine') {
      trunk(0.45, h * 0.25);
      const layers = 3;
      for (let k = 0; k < layers; k++) {
        const y0 = by - h * ppm * (0.2 + k * 0.22), w = h * ppm * (0.34 - k * 0.08);
        ctx.fillStyle = '#1f6b34';
        ctx.beginPath(); ctx.moveTo(bx, y0 - h * ppm * 0.42); ctx.lineTo(bx - w, y0); ctx.lineTo(bx + w, y0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2f8a45';
        ctx.beginPath(); ctx.moveTo(bx, y0 - h * ppm * 0.42); ctx.lineTo(bx, y0); ctx.lineTo(bx + w, y0); ctx.closePath(); ctx.fill();
      }
    } else if (type === 'birch') {
      trunk(0.35, h * 0.6, '#f2efe6');
      ctx.fillStyle = '#333';
      for (let k = 1; k < 5; k++) ctx.fillRect(bx - 0.15 * ppm, by - h * ppm * 0.12 * k, 0.22 * ppm, 0.08 * ppm);
      blob(bx, by - h * ppm * 0.7, h * ppm * 0.24, '#7fb83f', '#9ad04f', '#c1e67a');
    } else if (type === 'poplar') {
      trunk(0.35, h * 0.25);
      ctx.fillStyle = '#2d7f3b';
      ctx.beginPath(); ctx.ellipse(bx, by - h * ppm * 0.6, h * ppm * 0.13, h * ppm * 0.42, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#45a04c';
      ctx.beginPath(); ctx.ellipse(bx + h * ppm * 0.03, by - h * ppm * 0.64, h * ppm * 0.08, h * ppm * 0.34, 0, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'bush') {
      blob(bx - 0.5 * ppm, by - 0.6 * ppm, 0.8 * ppm, '#2a7d36', '#3a9e3f', '#62c25a');
      blob(bx + 0.5 * ppm, by - 0.5 * ppm, 0.7 * ppm, '#2a7d36', '#3a9e3f', '#62c25a');
    } else {
      trunk(0.5, h * 0.45);
      const r = h * ppm * 0.3, cy = by - h * ppm * 0.65;
      const pal = type === 'autumn' ? ['#c4561e', '#e8822e', '#ffb347'] : ['#2a7d36', '#3a9e3f', '#5fbf52'];
      blob(bx - r * 0.55, cy + r * 0.35, r * 0.7, ...pal);
      blob(bx + r * 0.55, cy + r * 0.3, r * 0.7, ...pal);
      blob(bx, cy, r, ...pal);
      if (type === 'apple') {
        ctx.fillStyle = '#e83b3b';
        for (let k = 0; k < 6; k++) {
          const a = hash(seed + k) * Math.PI * 2, d = hash(seed * 2 + k) * r * 0.8;
          ctx.beginPath(); ctx.arc(bx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, Math.max(1.5, 0.14 * ppm), 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // ---- Bâtiments
  const WALLS = ['#fff4e0', '#ffd9d9', '#d9ecff', '#fff7b3', '#e3f5da'];
  const ROOFS = ['#d9534f', '#8a4b2a', '#5a6478', '#c0662d'];
  const BUILD_CELL = 46;

  function buildingInfo(i) {
    if (i * BUILD_CELL < 30) return null;
    const h = hash(i * 13.7 + 5);
    if (i > 1 && h > 0.62) return null;
    const k = hash(i * 3.9 + 1);
    // une maison juste après la tour, puis un mélange maisons / granges / moulins
    const type = i === 1 ? 'house' : i === 2 ? 'mill' : k < 0.58 ? 'house' : k < 0.8 ? 'barn' : 'mill';
    const w = type === 'house' ? 7 : type === 'barn' ? 9 : 4.5;
    return { type, x: i * BUILD_CELL + 8 + hash(i * 2.1) * 22, w, seed: i };
  }
  function nearBuilding(x) {
    const i = Math.floor(x / BUILD_CELL);
    for (let j = i - 1; j <= i + 1; j++) {
      const b = buildingInfo(j);
      if (b && Math.abs(x - b.x) < b.w / 2 + 2.5) return true;
    }
    return false;
  }

  function foundation(x, w) {
    const gl = ground(x - w / 2), gr = ground(x + w / 2);
    return { top: Math.max(gl, gr), bottom: Math.min(gl, gr) };
  }

  function drawHouse(b, time) {
    const ppm = cam.ppm, { x, w, seed } = b;
    const f = foundation(x, w);
    const wallH = 3.6, roofH = 2.6;
    groundShadow(x, w, wallH + roofH);
    const L = sx(x - w / 2), R = sx(x + w / 2), base = sy(f.top), top = sy(f.top + wallH);
    ctx.fillStyle = '#9b8f80';
    ctx.fillRect(L, base, R - L, sy(f.bottom) - base + 3);
    // cheminée + fumée
    const chX = sx(x + w * 0.22);
    ctx.fillStyle = '#8a4b2a';
    ctx.fillRect(chX, sy(f.top + wallH + roofH * 0.95), 0.7 * ppm, roofH * 0.6 * ppm);
    for (let k = 0; k < 4; k++) {
      const t = ((time * 0.35 + k / 4 + seed * 0.13) % 1);
      ctx.fillStyle = `rgba(235,235,240,${0.55 * (1 - t)})`;
      ctx.beginPath();
      ctx.arc(chX + 0.35 * ppm - t * 1.5 * ppm, sy(f.top + wallH + roofH * 0.95 + t * 3.5), (0.3 + t * 0.6) * ppm, 0, Math.PI * 2);
      ctx.fill();
    }
    // murs
    ctx.fillStyle = WALLS[seed % WALLS.length];
    ctx.fillRect(L, top, R - L, base - top);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(L, top, (R - L) * 0.12, base - top);
    // toit
    ctx.fillStyle = ROOFS[seed % ROOFS.length];
    ctx.beginPath();
    ctx.moveTo(L - 0.5 * ppm, top);
    ctx.lineTo(sx(x), sy(f.top + wallH + roofH));
    ctx.lineTo(R + 0.5 * ppm, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.moveTo(L - 0.5 * ppm, top);
    ctx.lineTo(sx(x), sy(f.top + wallH + roofH));
    ctx.lineTo(sx(x), top);
    ctx.closePath();
    ctx.fill();
    // porte
    ctx.fillStyle = '#7a4b2a';
    ctx.fillRect(sx(x - 0.6), sy(f.top + 2.1), 1.2 * ppm, 2.1 * ppm);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(sx(x + 0.35), sy(f.top + 1.05), Math.max(1, 0.1 * ppm), 0, Math.PI * 2); ctx.fill();
    // fenêtres
    for (const wx of [x - w * 0.32, x + w * 0.32]) {
      const fx = sx(wx - 0.6), fy = sy(f.top + 2.8), fw = 1.2 * ppm, fh = 1.1 * ppm;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx - 0.12 * ppm, fy - 0.12 * ppm, fw + 0.24 * ppm, fh + 0.24 * ppm);
      ctx.fillStyle = '#8fd0ff';
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(fx + fw * 0.55, fy + fh * 0.1, fw * 0.3, fh * 0.3);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, 0.1 * ppm);
      ctx.beginPath(); ctx.moveTo(fx + fw / 2, fy); ctx.lineTo(fx + fw / 2, fy + fh); ctx.moveTo(fx, fy + fh / 2); ctx.lineTo(fx + fw, fy + fh / 2); ctx.stroke();
    }
    // clôture
    drawFence(x - w / 2 - 4, x - w / 2 - 0.6);
    drawFence(x + w / 2 + 0.6, x + w / 2 + 4);
  }

  function drawFence(x0, x1) {
    const ppm = cam.ppm;
    ctx.fillStyle = '#f4efe6';
    for (let fx = x0; fx <= x1; fx += 0.8) {
      const gy = sy(ground(fx));
      ctx.fillRect(sx(fx) - 0.1 * ppm, gy - 1.1 * ppm, 0.2 * ppm, 1.1 * ppm);
    }
    ctx.strokeStyle = '#f4efe6';
    ctx.lineWidth = Math.max(1, 0.12 * ppm);
    ctx.beginPath();
    for (const hy of [0.4, 0.85]) {
      ctx.moveTo(sx(x0), sy(ground(x0) + hy));
      ctx.lineTo(sx(x1), sy(ground(x1) + hy));
    }
    ctx.stroke();
  }

  function drawBarn(b) {
    const ppm = cam.ppm, { x, w } = b;
    const f = foundation(x, w);
    const wallH = 4.2;
    groundShadow(x, w, wallH + 3);
    const L = sx(x - w / 2), R = sx(x + w / 2), base = sy(f.top), top = sy(f.top + wallH);
    ctx.fillStyle = '#7d6a58';
    ctx.fillRect(L, base, R - L, sy(f.bottom) - base + 3);
    ctx.fillStyle = '#c8413b';
    ctx.fillRect(L, top, R - L, base - top);
    // planches
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 1; k < 9; k++) { const px = L + (R - L) * k / 9; ctx.moveTo(px, top); ctx.lineTo(px, base); }
    ctx.stroke();
    // toit mansardé
    ctx.fillStyle = '#7e2622';
    ctx.beginPath();
    ctx.moveTo(L - 0.4 * ppm, top);
    ctx.lineTo(sx(x - w * 0.32), sy(f.top + wallH + 2));
    ctx.lineTo(sx(x), sy(f.top + wallH + 3));
    ctx.lineTo(sx(x + w * 0.32), sy(f.top + wallH + 2));
    ctx.lineTo(R + 0.4 * ppm, top);
    ctx.closePath();
    ctx.fill();
    // grande porte avec croix
    const dx0 = sx(x - 1.4), dx1 = sx(x + 1.4), dy0 = sy(f.top + 3);
    ctx.fillStyle = '#a3322d';
    ctx.fillRect(dx0, dy0, dx1 - dx0, base - dy0);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1.5, 0.18 * ppm);
    ctx.strokeRect(dx0, dy0, dx1 - dx0, base - dy0);
    ctx.beginPath(); ctx.moveTo(dx0, dy0); ctx.lineTo(dx1, base); ctx.moveTo(dx1, dy0); ctx.lineTo(dx0, base); ctx.stroke();
    // lucarne
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx(x - 0.5), sy(f.top + wallH + 1.6), 1 * ppm, 1 * ppm);
    // bottes de foin
    for (const hx of [x + w / 2 + 1.2, x + w / 2 + 2.6]) {
      const gy = sy(ground(hx));
      ctx.fillStyle = '#e8c45a';
      ctx.beginPath(); ctx.arc(sx(hx), gy - 0.6 * ppm, 0.65 * ppm, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#c9a23a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx(hx), gy - 0.6 * ppm, 0.35 * ppm, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawMill(b, time) {
    const ppm = cam.ppm, { x } = b;
    const f = foundation(x, 4);
    const hgt = 8;
    groundShadow(x, 4, hgt + 3);
    ctx.fillStyle = '#f1ece2';
    ctx.beginPath();
    ctx.moveTo(sx(x - 2.2), sy(f.bottom) + 2);
    ctx.lineTo(sx(x - 1.2), sy(f.top + hgt));
    ctx.lineTo(sx(x + 1.2), sy(f.top + hgt));
    ctx.lineTo(sx(x + 2.2), sy(f.bottom) + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.beginPath();
    ctx.moveTo(sx(x - 2.2), sy(f.bottom) + 2); ctx.lineTo(sx(x - 1.2), sy(f.top + hgt)); ctx.lineTo(sx(x - 0.6), sy(f.top + hgt)); ctx.lineTo(sx(x - 1.2), sy(f.bottom) + 2);
    ctx.fill();
    ctx.fillStyle = '#7a4b2a';
    ctx.fillRect(sx(x - 0.55), sy(f.top + 1.8), 1.1 * ppm, 1.8 * ppm);
    ctx.fillStyle = '#5a6478';
    ctx.beginPath();
    ctx.moveTo(sx(x - 1.6), sy(f.top + hgt)); ctx.lineTo(sx(x), sy(f.top + hgt + 1.8)); ctx.lineTo(sx(x + 1.6), sy(f.top + hgt));
    ctx.closePath(); ctx.fill();
    // ailes
    const hx = sx(x), hy = sy(f.top + hgt - 0.3);
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(time * 0.9 + b.seed);
    for (let k = 0; k < 4; k++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#8a5a33';
      ctx.fillRect(-0.12 * ppm, 0, 0.24 * ppm, 5 * ppm);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(0.12 * ppm, 1 * ppm, 0.9 * ppm, 3.8 * ppm);
      ctx.strokeStyle = 'rgba(138,90,51,0.6)'; ctx.lineWidth = 1;
      ctx.strokeRect(0.12 * ppm, 1 * ppm, 0.9 * ppm, 3.8 * ppm);
    }
    ctx.restore();
    ctx.fillStyle = '#5a3d1e';
    ctx.beginPath(); ctx.arc(hx, hy, 0.35 * ppm, 0, Math.PI * 2); ctx.fill();
  }

  function drawDecor(state, time) {
    const right = cam.left + W / cam.ppm;
    if (!groundVisible()) return;
    // Bâtiments
    for (let i = Math.floor(cam.left / BUILD_CELL) - 1; i <= Math.ceil(right / BUILD_CELL) + 1; i++) {
      const b = buildingInfo(i);
      if (!b || b.x + 8 < cam.left || b.x - 8 > right) continue;
      if (b.type === 'house') drawHouse(b, time);
      else if (b.type === 'barn') drawBarn(b);
      else drawMill(b, time);
    }
    // Arbres, buissons, fleurs
    const cell = 7;
    for (let i = Math.max(2, Math.floor(cam.left / cell) - 1); i <= Math.ceil(right / cell) + 1; i++) {
      const h = hash(i + 11);
      const x = i * cell + hash(i + 0.5) * 5;
      if (nearBuilding(x)) continue;
      if (h < 0.34) {
        const type = TREE_TYPES[Math.floor(hash(i * 5.7) * TREE_TYPES.length)];
        drawTree(x, 4 + hash(i * 2.3) * 5, type, i);
      } else if (h < 0.48) {
        const colors = ['#ff6b8a', '#ffd93d', '#ffffff', '#b38bff'];
        for (let k = 0; k < 5; k++) {
          const fx = x + k * 0.55;
          const fy = sy(ground(fx) + 0.3 + hash(i + k) * 0.25);
          ctx.strokeStyle = '#3c9a36'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(sx(fx), sy(ground(fx))); ctx.lineTo(sx(fx), fy); ctx.stroke();
          ctx.fillStyle = colors[(i + k) % 4];
          ctx.beginPath(); ctx.arc(sx(fx), fy, Math.max(1.5, 0.2 * cam.ppm), 0, Math.PI * 2); ctx.fill();
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
    groundShadow(-0.2, 3, height * 0.5);
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

  const SPECIAL = {};

  function drawPickups(world, time) {
    const right = cam.left + W / cam.ppm;
    // Courants-jets d'abord (zones derrière le reste)
    for (const pk of world.pickups) {
      if (pk.type !== 'jet' || pk.taken || pk.x + pk.len < cam.left || pk.x > right) continue;
      SPECIAL.jet(pk, time);
    }
    for (const pk of world.pickups) {
      if (pk.type === 'jet') continue;
      if (pk.taken || pk.x < cam.left - 6 || pk.x > right + 6) continue;
      const x = sx(pk.x), y = sy(pk.y);
      if (y < -80 || y > H + 80) continue;
      if (SPECIAL[pk.type]) { SPECIAL[pk.type](pk, x, y, time); continue; }
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

  SPECIAL.bird = (pk, x, y, time) => {
    const S = Math.max(1.1 * cam.ppm, 16);
    const flap = Math.sin(time * 11 + pk.phase);
    const dir = pk.vx < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = '#2d3446';
    ctx.strokeStyle = '#2d3446';
    ctx.lineWidth = Math.max(2, S * 0.16);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-S * 0.9, -flap * S * 0.55);
    ctx.quadraticCurveTo(-S * 0.4, -S * 0.25 - flap * S * 0.2, 0, 0);
    ctx.quadraticCurveTo(S * 0.4, -S * 0.25 - flap * S * 0.2, S * 0.9, -flap * S * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(S * 0.1, S * 0.05, S * 0.32, S * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb02e';
    ctx.beginPath();
    ctx.moveTo(S * 0.42, 0); ctx.lineTo(S * 0.62, S * 0.05); ctx.lineTo(S * 0.42, S * 0.12);
    ctx.fill();
    ctx.restore();
  };

  const BALLOON_COLORS = [['#ff5d5d', '#ffd23f'], ['#3d8ff0', '#ffffff'], ['#8a5cff', '#5be37a'], ['#ff8a2b', '#3dd6f0']];
  SPECIAL.balloon = (pk, x, y, time) => {
    const R = Math.max(2.6 * cam.ppm, 24);
    const [c1, c2] = BALLOON_COLORS[pk.hue % 4];
    const squash = pk.used ? 1 + 0.12 * Math.max(0, Math.sin(time * 14)) * Math.exp(-((time - (pk.usedAt || time)) * 3)) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = pk.used ? 0.75 : 1;
    // cordes + nacelle
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-R * 0.45, R * 0.75); ctx.lineTo(-R * 0.22, R * 1.35);
    ctx.moveTo(R * 0.45, R * 0.75); ctx.lineTo(R * 0.22, R * 1.35);
    ctx.stroke();
    ctx.fillStyle = '#a86d3d';
    ctx.fillRect(-R * 0.25, R * 1.33, R * 0.5, R * 0.32);
    // enveloppe à rayures
    ctx.scale(1 / squash, squash);
    ctx.beginPath();
    ctx.moveTo(0, R * 0.95);
    ctx.bezierCurveTo(-R * 1.3, R * 0.2, -R * 1.05, -R * 1.05, 0, -R * 1.05);
    ctx.bezierCurveTo(R * 1.05, -R * 1.05, R * 1.3, R * 0.2, 0, R * 0.95);
    ctx.fillStyle = c1;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = c2;
    for (let k = -2; k <= 2; k += 2) ctx.fillRect(k * R * 0.3 - R * 0.15, -R * 1.2, R * 0.3, R * 2.4);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.ellipse(-R * 0.35, -R * 0.45, R * 0.25, R * 0.45, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  };

  SPECIAL.star = (pk, x, y, time) => {
    const R = Math.max(pk.r * cam.ppm, 17);
    const glow = ctx.createRadialGradient(x, y, R * 0.2, x, y, R * 2.2);
    glow.addColorStop(0, 'rgba(255,240,150,0.8)');
    glow.addColorStop(1, 'rgba(255,240,150,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(time * 1.5);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? R * 0.45 : R;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.strokeStyle = '#fff6c2';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  };

  SPECIAL.diamond = (pk, x, y, time) => {
    const R = Math.max(pk.r * cam.ppm, 11);
    const bob = Math.sin(time * 4 + pk.x) * R * 0.15;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.fillStyle = 'rgba(120,230,255,0.3)';
    ctx.beginPath(); ctx.arc(0, 0, R * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -R); ctx.lineTo(R * 0.8, -R * 0.2); ctx.lineTo(0, R); ctx.lineTo(-R * 0.8, -R * 0.2);
    ctx.closePath();
    ctx.fillStyle = '#5fdcff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-R * 0.8, -R * 0.2); ctx.lineTo(R * 0.8, -R * 0.2);
    ctx.moveTo(0, -R); ctx.lineTo(-R * 0.25, -R * 0.2); ctx.lineTo(0, R); ctx.lineTo(R * 0.25, -R * 0.2); ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  };

  SPECIAL.jet = (pk, time) => {
    const x0 = sx(pk.x), x1 = sx(pk.x + pk.len);
    const yc = sy(pk.y), hh = Math.max(pk.h * cam.ppm, 12);
    if (yc + hh < 0 || yc - hh > H) return;
    const g = ctx.createLinearGradient(0, yc - hh, 0, yc + hh);
    g.addColorStop(0, 'rgba(200,235,255,0)');
    g.addColorStop(0.5, 'rgba(200,235,255,0.35)');
    g.addColorStop(1, 'rgba(200,235,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, yc - hh, x1 - x0, hh * 2);
    // traits de vent qui défilent vers la droite
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const spacing = 9;
    for (let row = -2; row <= 2; row++) {
      const yy = yc + row * hh * 0.35;
      const off = ((time * 25 + row * 3.7) % spacing + spacing) % spacing;
      for (let m = off; m < pk.len; m += spacing) {
        const a = sx(pk.x + m), b = sx(pk.x + Math.min(pk.len, m + 3.5));
        if (b < 0 || a > W) continue;
        ctx.moveTo(a, yy); ctx.lineTo(b, yy);
      }
    }
    ctx.stroke();
    // flèches aux extrémités
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `bold ${Math.max(12, Math.min(20, hh * 0.5))}px system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (x0 > -40 && x0 < W) ctx.fillText('»»', x0 + 4, yc);
  };

  function drawFloaters(list) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const f of list) {
      const a = Math.max(0, Math.min(1, f.life / f.max * 1.5));
      ctx.globalAlpha = a;
      ctx.font = 'bold 16px system-ui, sans-serif';
      const x = sx(f.x), y = sy(f.y) - (1 - f.life / f.max) * 30;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeText(f.text, x, y);
      ctx.fillStyle = f.color || '#fff';
      ctx.fillText(f.text, x, y);
    }
    ctx.globalAlpha = 1;
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
  function planeSize() { return clamp(2.2 * cam.ppm, 38, 64); }

  function drawPlane(p, angle, time, look) {
    const x = sx(p.x), y = sy(p.y);
    const L = planeSize();
    // Ombre au sol, décalée par le soleil
    const gx = p.x, alt = p.y - ground(gx);
    const shX = gx + SHADOW_DX * alt * 0.5;
    const gy = sy(ground(shX));
    if (gy < H + 20 && alt < 70) {
      const a = clamp(0.3 - alt / 230, 0.04, 0.3);
      ctx.fillStyle = `rgba(0,30,0,${a})`;
      ctx.beginPath();
      ctx.ellipse(sx(shX), gy, L * 0.45 * (1 - alt / 140), L * 0.07, 0, 0, Math.PI * 2);
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
    G.Planes.draw(ctx, L, look, time);
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
    // Étoile : halo doré scintillant
    if (p.starT > 0) {
      ctx.strokeStyle = `rgba(255,215,60,${0.6 + 0.3 * Math.sin(time * 12)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, L * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fff3a0';
      for (let i = 0; i < 4; i++) {
        const a = time * 4 + i * Math.PI / 2;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * L * 0.8, y + Math.sin(a) * L * 0.8, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Bulle "vol plané" / "ascension"
    if (p.glideT > 0 || p.liftT > 0) {
      ctx.strokeStyle = p.glideT > 0 ? 'rgba(150,220,255,0.8)' : 'rgba(120,255,150,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, L * 0.75 + Math.sin(time * 10) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawTrail(trail, look, time) {
    if (trail.length < 2) return;
    ctx.lineCap = 'round';
    const n = trail.length;
    const strong = look.trail.id !== 'white';
    for (let i = 1; i < n; i++) {
      const a = (i / n) * (strong ? 0.8 : 0.55);
      ctx.strokeStyle = G.Planes.trailColor(look.trail, n - i, n, a, time);
      ctx.lineWidth = 1 + (i / n) * (strong ? 4 : 2.5);
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
    drawSky(p, st.time);
    drawSun(p, st.time);
    drawFarClouds();
    drawRange(0.6, 0.08, H * 0.34, 260, 1.3, '#9db3d6', { snow: true });
    drawRange(1.6, 0.2, H * 0.2, 170, 4.1, '#7cbf7e', { trees: '#5aa865' });
    drawWorldClouds();
    drawTower(st.stats.launchHeight);
    drawGround();
    drawDecor(st, st.time);
    // Voile nocturne sur le décor quand on monte très haut
    const night = clamp((p.y - 200) / 350, 0, 1);
    if (night > 0) { ctx.fillStyle = `rgba(10,16,55,${night * 0.38})`; ctx.fillRect(0, 0, W, H); }
    drawPickups(st.world, st.time);
    drawTrail(st.trail, st.look, st.time);
    drawParticles(st.particles);
    if (st.floaters) drawFloaters(st.floaters);
    let angle;
    if (p.state === 'aim') angle = st.aim && st.aim.active ? st.aim.angle : 0.2;
    else if (p.state === 'flying') angle = Math.atan2(p.vy + (p.liftRate || 0) * 0.5, p.vx) + (p.gliding ? 0.15 : 0);
    else angle = Math.atan2(ground(p.x + 0.5) - ground(p.x - 0.5), 1);
    st.drawAngle = st.drawAngle == null ? angle : lerp(st.drawAngle, angle, Math.min(1, dt * 12));
    drawPlane(p, st.drawAngle, st.time, st.look);
    drawAim(p, st.aim);
    const speed = p.state === 'flying' ? Math.hypot(p.vx, p.vy) : 0;
    drawSpeedLines(st.paused ? 0 : speed, st.paused ? 0 : dt);
  }

  G.Renderer = { init, resize, updateCamera, draw, cam, size: () => ({ W, H }) };
})(window);
