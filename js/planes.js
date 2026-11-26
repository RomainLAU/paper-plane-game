/* Avions : modèles (évoluent avec le niveau), couleurs, motifs, traînées. Purement esthétique. */
(function (G) {
  'use strict';

  // Coordonnées en fraction de la longueur L, nez en (0.5, 0), y négatif = vers le haut.
  const MODELS = [
    { id: 'classic', name: 'Classique', level: 1,
      body: [[0.5, 0], [-0.45, 0.02], [-0.5, 0.17]],
      wing: [[0.5, 0], [-0.5, -0.3], [-0.38, 0.01]],
      folds: [[[0.46, -0.01], [-0.44, -0.12]]] },
    { id: 'glider', name: 'Planeur', level: 3,
      body: [[0.5, 0], [-0.4, 0.02], [-0.47, 0.13]],
      wing: [[0.5, 0], [0.08, -0.12], [-0.38, -0.36], [-0.5, -0.34], [-0.36, 0.01]],
      folds: [[[0.45, -0.01], [-0.42, -0.17]]] },
    { id: 'arrow', name: 'Flèche', level: 5,
      body: [[0.56, 0], [-0.46, 0.02], [-0.5, 0.11]],
      wing: [[0.56, 0], [-0.5, -0.22], [-0.42, 0.01]],
      folds: [[[0.5, -0.01], [-0.46, -0.08]], [[0.4, -0.02], [-0.47, -0.16]]] },
    { id: 'hawk', name: 'Faucon', level: 8,
      body: [[0.5, 0], [-0.3, 0.05], [-0.5, 0.21], [-0.44, 0.02]],
      wing: [[0.5, 0], [-0.38, -0.3], [-0.5, -0.3], [-0.4, 0.01]],
      extra: [[[-0.38, -0.3], [-0.47, -0.44], [-0.5, -0.3]]],
      folds: [[[0.46, -0.01], [-0.42, -0.13]]] },
    { id: 'delta', name: 'Delta', level: 12,
      body: [[0.5, 0], [-0.5, 0.0], [-0.5, 0.22]],
      wing: [[0.5, 0], [-0.5, -0.36], [-0.5, -0.06], [-0.3, 0.01]],
      nose: [[0.5, 0], [0.32, -0.06], [0.32, 0.04]],
      folds: [[[0.46, -0.01], [-0.48, -0.18]], [[0.3, -0.06], [-0.48, -0.3]]] },
    { id: 'jet', name: 'Jet', level: 16,
      body: [[0.5, 0], [0.3, 0.06], [-0.5, 0.13], [-0.5, 0.0]],
      wing: [[0.5, 0], [0.02, -0.08], [-0.33, -0.34], [-0.44, -0.34], [-0.3, 0.01]],
      extra: [[[-0.3, -0.02], [-0.47, -0.26], [-0.53, -0.26], [-0.5, 0.0]]],
      cockpit: true,
      folds: [[[0.44, -0.01], [-0.3, -0.08]]] },
    { id: 'phoenix', name: 'Phénix', level: 20,
      body: [[0.5, 0], [-0.3, 0.05], [-0.42, 0.2], [-0.55, 0.26], [-0.48, 0.1], [-0.56, 0.12], [-0.45, 0.01]],
      wing: [[0.5, 0], [0.1, -0.1], [-0.25, -0.3], [-0.42, -0.44], [-0.38, -0.3], [-0.52, -0.37], [-0.43, -0.2],
        [-0.55, -0.2], [-0.37, 0.01]],
      folds: [[[0.45, -0.01], [-0.3, -0.2]], [[0.2, -0.06], [-0.4, -0.32]]],
      aura: true },
    // ---- exclusifs, achetés avec des diamants
    { id: 'crane', name: 'Grue en origami', diamonds: 25,
      body: [[0.52, -0.22], [0.4, -0.06], [0.12, 0.06], [-0.3, 0.06], [-0.55, -0.24], [-0.3, -0.02], [0.18, -0.02], [0.44, -0.14]],
      wing: [[0.16, 0], [-0.02, -0.52], [-0.26, 0]],
      folds: [[[0.12, -0.01], [-0.05, -0.42]], [[0.4, -0.06], [0.52, -0.22]]] },
    { id: 'swallow', name: 'Hirondelle', diamonds: 30,
      body: [[0.5, 0], [-0.2, 0.04], [-0.58, 0.14], [-0.3, 0.02]],
      wing: [[0.5, 0], [0.05, -0.12], [-0.25, -0.34], [-0.15, -0.08], [-0.58, -0.16], [-0.3, 0.01]],
      folds: [[[0.45, -0.01], [-0.2, -0.1]]] },
    { id: 'shuttle', name: 'Navette', diamonds: 40,
      body: [[0.56, 0], [0.42, 0.08], [-0.5, 0.11], [-0.5, -0.02]],
      wing: [[0.32, -0.02], [-0.45, -0.3], [-0.5, -0.02]],
      extra: [[[-0.3, -0.04], [-0.48, -0.36], [-0.54, -0.36], [-0.52, -0.02]]],
      cockpit: true,
      folds: [[[0.3, -0.03], [-0.42, -0.24]]] },
  ];

  const COLORS = [
    { id: 'blanc', name: 'Blanc', level: 1, main: '#ffffff', shade: '#c9d6e6', line: '#8ea3bd', accent: '#3d8ff0' },
    { id: 'ciel', name: 'Ciel', level: 1, main: '#bfe4ff', shade: '#8cc3ea', line: '#4d8fc4', accent: '#ffffff' },
    { id: 'rose', name: 'Rose', level: 2, main: '#ffc9dc', shade: '#f29dbb', line: '#c9668b', accent: '#ffffff' },
    { id: 'menthe', name: 'Menthe', level: 2, main: '#c4f5d9', shade: '#8edcb0', line: '#4aa776', accent: '#ffffff' },
    { id: 'citron', name: 'Citron', level: 3, main: '#fff3a3', shade: '#f2dc63', line: '#bfa12a', accent: '#ff8a2b' },
    { id: 'orange', name: 'Orange', level: 4, main: '#ffc38a', shade: '#f49b52', line: '#c46a22', accent: '#ffffff' },
    { id: 'lavande', name: 'Lavande', level: 5, main: '#dccbff', shade: '#b69cf2', line: '#7c5cc4', accent: '#ffffff' },
    { id: 'rouge', name: 'Rouge', level: 6, main: '#ff6b6b', shade: '#d94646', line: '#9e2b2b', accent: '#ffe14d' },
    { id: 'kraft', name: 'Kraft', level: 7, main: '#d9b98c', shade: '#b8935f', line: '#7d5d33', accent: '#5a3d1e' },
    { id: 'nuit', name: 'Nuit', level: 9, main: '#2f3a5c', shade: '#1d243d', line: '#0f1426', accent: '#7fd3ff' },
    { id: 'or', name: 'Or', level: 14, main: '#ffd75e', shade: '#e0a92a', line: '#a87612', accent: '#fff6c2', shine: true },
    { id: 'arcenciel', name: 'Arc-en-ciel', level: 18, main: 'rainbow', shade: '#c9b6f2', line: '#7c5cc4', accent: '#ffffff' },
    { id: 'corail', name: 'Corail', diamonds: 6, main: '#ff9c86', shade: '#e06450', line: '#a83f2e', accent: '#fff3e0' },
    { id: 'encre', name: 'Encre', diamonds: 8, main: '#2a45a8', shade: '#13235e', line: '#0a1440', accent: '#ffe95c' },
    { id: 'holo', name: 'Holographique', diamonds: 10, main: 'holo', shade: '#c9d4f2', line: '#7a86b8', accent: '#ffffff', shine: true },
    { id: 'galaxie', name: 'Galaxie', diamonds: 12, main: 'galaxy', shade: '#2a1d5c', line: '#120a33', accent: '#ffffff' },
  ];

  const PATTERNS = [
    { id: 'none', name: 'Uni', level: 1 },
    { id: 'stripes', name: 'Rayures', level: 2 },
    { id: 'dots', name: 'Pois', level: 4 },
    { id: 'stars', name: 'Étoiles', level: 7 },
    { id: 'flames', name: 'Flammes', level: 10 },
    { id: 'checker', name: 'Damier', level: 13 },
    { id: 'hearts', name: 'Cœurs', diamonds: 5 },
    { id: 'seyes', name: 'Cahier', diamonds: 6 },
    { id: 'news', name: 'Journal', diamonds: 6 },
    { id: 'map', name: 'Carte au trésor', diamonds: 8 },
  ];

  const TRAILS = [
    { id: 'white', name: 'Blanche', level: 1, preview: ['#ffffff', '#ffffff'] },
    { id: 'sky', name: 'Bleue', level: 3, preview: ['#9fd8ff', '#3d8ff0'] },
    { id: 'fire', name: 'Feu', level: 6, preview: ['#ffe14d', '#ff4b2b'] },
    { id: 'neon', name: 'Néon', level: 9, preview: ['#3dffe6', '#ff3df2'] },
    { id: 'gold', name: 'Dorée', level: 13, preview: ['#fff3a0', '#e0a92a'] },
    { id: 'rainbow', name: 'Arc-en-ciel', level: 17, preview: ['#ff5d5d', '#5d7bff'] },
    { id: 'ink', name: 'Encre', diamonds: 8, preview: ['#2a45a8', '#13235e'], dots: true },
    { id: 'sparkle', name: 'Étincelles', diamonds: 10, preview: ['#fff3a0', '#ffffff'], dots: true },
    { id: 'confetti', name: 'Confettis', diamonds: 12, preview: ['#ff5d8a', '#3dd6f0'], dots: true },
  ];

  const byId = (list, id) => list.find(x => x.id === id);

  // Meilleur modèle débloqué pour un niveau donné
  function autoModel(level) {
    let m = MODELS[0];
    for (const x of MODELS) if (x.level && level >= x.level) m = x;
    return m;
  }
  // Un élément est disponible s'il est débloqué par le niveau, ou acheté avec des diamants
  function available(x, level, owned) {
    return x.diamonds ? (owned || []).includes(x.id) : level >= x.level;
  }

  // Apparence effective (si un élément choisi n'est plus débloqué, on revient au défaut)
  function resolve(look, level) {
    look = look || {};
    const pick = (list, id, def) => { const x = byId(list, id); return x && available(x, level, look.owned) ? x : byId(list, def); };
    const model = look.model && look.model !== 'auto' ? pick(MODELS, look.model, 'classic') : autoModel(level);
    return {
      model,
      color: pick(COLORS, look.color, 'blanc'),
      pattern: pick(PATTERNS, look.pattern, 'none'),
      trail: pick(TRAILS, look.trail, 'white'),
      auto: !look.model || look.model === 'auto',
    };
  }

  // Tout ce qui se débloque entre deux niveaux (pour l'écran de résultats)
  function unlocksBetween(from, to) {
    const out = [];
    const add = (list, kind) => list.forEach(x => { if (x.level && x.level > from && x.level <= to) out.push(`${kind} ${x.name}`); });
    add(MODELS, 'Avion');
    add(COLORS, 'Couleur');
    add(PATTERNS, 'Motif');
    add(TRAILS, 'Traînée');
    return out;
  }

  // ---------------------------------------------------------------- Dessin
  // Nez plié : tout ce qui est devant le pli (x > 0.12) tourne vers le bas et se tasse
  let BEND = 0;
  const FOLD_X = 0.05;
  function df(x, y) {
    if (BEND <= 0 || x <= FOLD_X) return [x, y];
    const dx = (x - FOLD_X) * (1 - 0.25 * BEND), a = BEND * 1.7;
    return [FOLD_X + dx * Math.cos(a) - y * Math.sin(a) * 0.3, y + dx * Math.sin(a) + y * 0.15 * BEND];
  }
  function path(ctx, pts, L) {
    ctx.beginPath();
    pts.forEach(([x0, y0], i) => { const [x, y] = df(x0, y0); if (i) ctx.lineTo(x * L, y * L); else ctx.moveTo(x * L, y * L); });
    ctx.closePath();
  }

  // Avion écrasé : une boule de papier froissée (calcinée si l'avion a brûlé)
  function drawBall(ctx, L, look, burnt) {
    const r = L * 0.2, n = 11, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, k = 0.78 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.35;
      pts.push([Math.cos(a) * r * k, Math.sin(a) * r * k - r * 0.75]);
    }
    const main = burnt ? '#3d3833' : (look.color.main.startsWith('#') ? look.color.main : look.color.shade);
    ctx.fillStyle = main;
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    ctx.fillStyle = burnt ? '#2a2622' : look.color.shade;
    for (let i = 0; i < n; i += 3) {
      ctx.beginPath(); ctx.moveTo(0, -r * 0.75); ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[(i + 1) % n][0], pts[(i + 1) % n][1]); ctx.closePath(); ctx.fill();
    }
    ctx.strokeStyle = burnt ? '#1a1714' : look.color.line;
    ctx.lineWidth = Math.max(1, L * 0.02);
    ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    ctx.lineWidth = Math.max(0.8, L * 0.012);
    ctx.beginPath();
    for (let i = 1; i < n; i += 2) { ctx.moveTo(pts[i][0] * 0.2, pts[i][1] * 0.2 - r * 0.6); ctx.lineTo(pts[i][0] * 0.85, pts[i][1] * 0.85 - r * 0.1); }
    ctx.stroke();
    if (burnt) {
      ctx.fillStyle = '#ff8a2b';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(pts[i * 2][0] * 0.7, pts[i * 2][1] * 0.7 - r * 0.2, Math.max(1, L * 0.02), 0, Math.PI * 2); ctx.fill(); }
    }
  }

  function mainFill(ctx, color, L, time) {
    if (color.main === 'galaxy') {
      const g = ctx.createLinearGradient(-L * 0.5, -L * 0.4, L * 0.5, 0.05 * L);
      g.addColorStop(0, '#1b1046'); g.addColorStop(0.5, '#4a2a9a'); g.addColorStop(1, '#1f5fb8');
      return g;
    }
    if (color.main === 'holo') {
      const g = ctx.createLinearGradient(-L * 0.5, -L * 0.4, L * 0.5, 0);
      const h = (time || 0) * 90;
      for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${(h + i * 70) % 360},85%,86%)`);
      return g;
    }
    if (color.main !== 'rainbow') return color.main;
    const g = ctx.createLinearGradient(-L * 0.5, -L * 0.4, L * 0.5, 0);
    const h = (time || 0) * 60;
    for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsl(${(h + i * 60) % 360},90%,72%)`);
    return g;
  }

  function drawPattern(ctx, pattern, color, model, L) {
    if (pattern.id === 'none') return;
    ctx.save();
    path(ctx, model.wing, L);
    ctx.clip();
    ctx.fillStyle = color.accent;
    ctx.globalAlpha = 0.85;
    if (pattern.id === 'stripes') {
      for (let k = -3; k <= 3; k++) {
        ctx.beginPath();
        const x0 = k * L * 0.22;
        ctx.moveTo(x0, 0.05 * L); ctx.lineTo(x0 + L * 0.08, 0.05 * L);
        ctx.lineTo(x0 - L * 0.12, -0.5 * L); ctx.lineTo(x0 - L * 0.2, -0.5 * L);
        ctx.fill();
      }
    } else if (pattern.id === 'dots') {
      for (let i = -5; i <= 5; i++) for (let j = 0; j <= 4; j++) {
        ctx.beginPath();
        ctx.arc(i * L * 0.12 + (j % 2) * L * 0.06, -j * L * 0.09, L * 0.025, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (pattern.id === 'stars') {
      const pts = [[0.1, -0.06], [-0.15, -0.15], [-0.35, -0.24], [-0.05, -0.04], [-0.3, -0.08], [0.25, -0.03]];
      for (const [px, py] of pts) star(ctx, px * L, py * L, L * 0.045);
    } else if (pattern.id === 'flames') {
      ctx.fillStyle = '#ff7a1f';
      flame(ctx, L, 1);
      ctx.fillStyle = '#ffd23f';
      flame(ctx, L, 0.6);
    } else if (pattern.id === 'hearts') {
      ctx.fillStyle = '#ff5d8a';
      for (const [px, py] of [[0.15, -0.05], [-0.12, -0.14], [-0.32, -0.22], [-0.05, -0.03], [-0.28, -0.07]]) heart(ctx, px * L, py * L, L * 0.05);
    } else if (pattern.id === 'seyes') {
      ctx.globalAlpha = 1;
      for (let j = 0; j < 12; j++) {
        ctx.fillStyle = j % 4 === 0 ? '#8aa3e0' : '#c4d1f1';
        ctx.fillRect(-L, -j * L * 0.035, 2 * L, Math.max(0.6, L * 0.006));
      }
      ctx.fillStyle = '#e2545e';
      ctx.fillRect(-L * 0.3, -L, Math.max(1, L * 0.012), 2 * L);
    } else if (pattern.id === 'news') {
      ctx.fillStyle = '#5a6075';
      for (let j = 1; j < 9; j++) for (let k = -5; k < 5; k++) {
        if ((j * 7 + k) % 5 === 0) continue;
        ctx.fillRect(k * L * 0.1, -j * L * 0.045, L * 0.08, Math.max(0.8, L * 0.012));
      }
      ctx.fillRect(-L * 0.3, -L * 0.42, L * 0.5, L * 0.03);
    } else if (pattern.id === 'map') {
      ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(1, L * 0.018); ctx.setLineDash([L * 0.04, L * 0.03]);
      ctx.beginPath(); ctx.moveTo(0.35 * L, -0.02 * L); ctx.quadraticCurveTo(0, -0.25 * L, -0.15 * L, -0.08 * L); ctx.quadraticCurveTo(-0.3 * L, -0.02 * L, -0.33 * L, -0.2 * L); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = Math.max(1.5, L * 0.025);
      ctx.beginPath(); ctx.moveTo(-0.38 * L, -0.25 * L); ctx.lineTo(-0.3 * L, -0.17 * L); ctx.moveTo(-0.3 * L, -0.25 * L); ctx.lineTo(-0.38 * L, -0.17 * L); ctx.stroke();
    } else if (pattern.id === 'checker') {
      const c = L * 0.08;
      for (let i = -7; i <= 7; i++) for (let j = 0; j <= 6; j++) {
        if ((i + j) % 2) ctx.fillRect(i * c, -j * c, c, c);
      }
    }
    ctx.restore();
  }

  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 ? r * 0.45 : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  function heart(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.9);
    ctx.bezierCurveTo(x - r * 1.4, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.4);
    ctx.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.4, y - r * 0.2, x, y + r * 0.9);
    ctx.fill();
  }

  function flame(ctx, L, k) {
    ctx.beginPath();
    ctx.moveTo(-0.55 * L, 0);
    ctx.quadraticCurveTo(-0.2 * L, -0.02 * L * k, (-0.55 + 0.75 * k) * L, -0.03 * L);
    ctx.quadraticCurveTo(-0.25 * L, -0.12 * L * k, (-0.55 + 0.5 * k) * L, -0.2 * L * k);
    ctx.quadraticCurveTo(-0.35 * L, -0.25 * L * k, (-0.55 + 0.3 * k) * L, -0.38 * L * k);
    ctx.lineTo(-0.55 * L, -0.4 * L);
    ctx.closePath();
    ctx.fill();
  }

  // Dessine l'avion à l'origine, orienté vers +x. look = résultat de resolve().
  function draw(ctx, L, look, time, crumple, burnt) {
    const { model, color, pattern } = look;
    time = time || 0;
    if (crumple >= 0.95) { drawBall(ctx, L, look, burnt); return; }
    BEND = crumple || 0;
    drawPlane(ctx, L, look, time);
    if (BEND > 0) {
      // partie repliée : plus sombre, avec des plis froissés
      ctx.save();
      path(ctx, model.wing, L);
      ctx.clip();
      ctx.fillStyle = `rgba(20,30,70,${0.12 + 0.2 * BEND})`;
      ctx.fillRect(FOLD_X * L, -L, L, 2 * L);
      ctx.strokeStyle = color.line; ctx.lineWidth = Math.max(1, L * 0.018);
      ctx.beginPath();
      ctx.moveTo(FOLD_X * L, -L * 0.4); ctx.lineTo(FOLD_X * L, L * 0.2);
      const n = 2 + Math.round(BEND * 3);
      for (let i = 1; i <= n; i++) {
        const xx = FOLD_X + (i / (n + 1)) * 0.3 * (1 - 0.45 * BEND);
        ctx.moveTo(xx * L, -L * 0.3); ctx.lineTo((xx + 0.04) * L, L * 0.3);
      }
      ctx.stroke();
      ctx.restore();
    }
    BEND = 0;
  }

  function drawPlane(ctx, L, look, time) {
    const { model, color, pattern } = look;
    if (model.aura) {
      const g = ctx.createRadialGradient(0, -L * 0.1, L * 0.05, 0, -L * 0.1, L * 0.75);
      g.addColorStop(0, `rgba(255,170,60,${0.35 + 0.1 * Math.sin(time * 6)})`);
      g.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, -L * 0.1, L * 0.75, 0, Math.PI * 2); ctx.fill();
    }
    ctx.lineJoin = 'round';
    // Dessous / quille
    ctx.fillStyle = color.shade;
    path(ctx, model.body, L);
    ctx.fill();
    // Ailerons (derrière l'aile)
    if (model.extra) for (const e of model.extra) {
      ctx.fillStyle = color.shade;
      path(ctx, e, L);
      ctx.fill();
      ctx.strokeStyle = color.line; ctx.lineWidth = Math.max(1, L * 0.02); ctx.stroke();
    }
    // Aile
    ctx.fillStyle = mainFill(ctx, color, L, time);
    path(ctx, model.wing, L);
    ctx.fill();
    if (color.main === 'galaxy') {
      ctx.save(); path(ctx, model.wing, L); ctx.clip();
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 14; i++) {
        const sx = (((i * 0.37) % 1) - 0.5) * L, sy = -(((i * 0.61) % 1) * 0.4) * L;
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 3 + i);
        ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.7, L * 0.008), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.restore();
    }
    drawPattern(ctx, pattern, color, model, L);
    if (color.shine) {
      ctx.save();
      path(ctx, model.wing, L);
      ctx.clip();
      const sx = ((time * 0.6) % 1.6 - 0.8) * L;
      const g = ctx.createLinearGradient(sx - L * 0.15, 0, sx + L * 0.15, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.7)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-L, -L, 2 * L, 2 * L);
      ctx.restore();
    }
    ctx.strokeStyle = color.line;
    ctx.lineWidth = Math.max(1, L * 0.022);
    path(ctx, model.wing, L);
    ctx.stroke();
    // Plis
    ctx.lineWidth = Math.max(0.8, L * 0.016);
    for (const f of model.folds) {
      const a = df(f[0][0], f[0][1]), b = df(f[1][0], f[1][1]);
      ctx.beginPath();
      ctx.moveTo(a[0] * L, a[1] * L);
      ctx.lineTo(b[0] * L, b[1] * L);
      ctx.stroke();
    }
    if (model.nose) {
      ctx.fillStyle = color.accent;
      path(ctx, model.nose, L);
      ctx.fill();
    }
    if (model.cockpit) {
      ctx.fillStyle = 'rgba(90,190,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(L * 0.25, -L * 0.035, L * 0.08, L * 0.03, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(L * 0.27, -L * 0.045, L * 0.03, L * 0.01, -0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Couleur d'un segment de traînée (i/n = position, a = opacité)
  function trailColor(trail, i, n, a, time) {
    const t = i / n;
    switch (trail.id) {
      case 'sky': return `rgba(${Math.round(160 - 90 * t)},${Math.round(215 - 60 * t)},255,${a})`;
      case 'fire': return `hsla(${Math.round(55 - 45 * t)},100%,${Math.round(65 - 10 * t)}%,${a})`;
      case 'neon': return `hsla(${Math.round(175 + 130 * t)},100%,62%,${a})`;
      case 'gold': return `hsla(45,100%,${Math.round(75 - 15 * t)}%,${a})`;
      case 'rainbow': return `hsla(${Math.round((i * 14 + time * 180) % 360)},95%,62%,${a})`;
      case 'ink': return `rgba(29,52,135,${a})`;
      case 'sparkle': return i % 3 === 0 ? `rgba(255,255,255,${a})` : `hsla(48,100%,${70 + (i % 2) * 15}%,${a})`;
      case 'confetti': return `hsla(${Math.round((Math.sin(i * 91.7) * 43758.5453 % 1 + 1) % 1 * 360)},90%,60%,${a})`;
      default: return `rgba(255,255,255,${a})`;
    }
  }

  G.Planes = { MODELS, COLORS, PATTERNS, TRAILS, resolve, autoModel, available, unlocksBetween, draw, trailColor };
})(typeof window !== 'undefined' ? window : globalThis);
