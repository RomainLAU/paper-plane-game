/* Interface : hangar, onglets, résultats, pause, HUD */
(function (G) {
  'use strict';
  const { Data, Save, Sfx } = G;
  const $ = id => document.getElementById(id);
  let H = {}; // callbacks fournis par main.js
  let currentTab = 'upgrades';
  let resetArmed = 0;

  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace('.', ',') + ' M';
    if (n >= 1e5) return Math.round(n / 1e3) + ' k';
    return n.toLocaleString('fr-FR');
  }

  function toast(msg, ms = 2200) {
    const t = $('toast');
    t.innerHTML = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), ms);
  }

  function vibrate(ms) {
    if (Save.data.settings.vibration && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  // ---------------------------------------------------------------- Hangar
  function renderProfile() {
    const d = Save.data;
    const li = Data.levelInfo(d.xp);
    const points = li.level - 1 - Data.spentSkillPoints(d.skills);
    $('m-level').textContent = li.level;
    $('m-xp-text').textContent = `${fmt(li.current)} / ${fmt(li.needed)} XP`;
    $('m-xp-bar').style.width = `${(li.current / li.needed) * 100}%`;
    $('m-money').textContent = `${fmt(d.money)} $`;
    $('m-points').textContent = points;
    $('m-diamonds').textContent = `${fmt(d.diamonds || 0)} 💎`;
    const map = G.Maps.byId(d.currentMap);
    $('m-record').textContent = `${fmt((d.maps[map.id] || {}).best || 0)} m`;
    $('m-map').textContent = `${map.icon} ${map.name}`;
    // Pastille sur l'onglet compétences s'il y a quelque chose à faire
    const nSlots = Data.unlockedSlots(li.level);
    const canBuy = Data.SKILLS.some(s => li.level >= s.req && (d.skills[s.id] || 0) < Data.SKILL_MAX && points >= Data.skillCost((d.skills[s.id] || 0) + 1));
    const freeSlot = d.slots.slice(0, nSlots).some(x => !x) && Data.SKILLS.some(s => (d.skills[s.id] || 0) > 0 && !d.slots.includes(s.id));
    $('skills-dot').classList.toggle('hidden', !(canBuy || freeSlot));
    const seen = d.plane.seenLevel || 1;
    $('plane-dot').classList.toggle('hidden', !(li.level > seen && G.Planes.unlocksBetween(seen, li.level).length));
  }

  function ticks(level, max) {
    let t = '';
    for (let k = 1; k <= max; k++) t += `<i class="${k <= level ? 'on' : ''}"></i>`;
    return `<span class="ticks" role="img" aria-label="Niveau ${level} sur ${max}">${t}</span>`;
  }

  function renderUpgrades() {
    const d = Save.data;
    let html = '<ul class="lines two-cols">';
    for (const up of Data.UPGRADES) {
      const l = d.upgrades[up.id] || 0;
      const maxed = l >= up.max;
      const cost = Data.upgradeCost(up, l);
      const can = !maxed && d.money >= cost;
      const value = maxed
        ? `${up.stat} <b>${up.fmt(up.value(l))}</b>`
        : `${up.stat} <b>${up.fmt(up.value(l))}</b>, puis ${up.fmt(up.value(l + 1))}`;
      html += `<li class="line">
        <span class="sticker" aria-hidden="true">${up.icon}</span>
        <div>
          <div class="line-name">${up.name}</div>
          <div class="line-desc">${up.desc}</div>
          <div class="line-value">${value}</div>
        </div>
        ${ticks(l, up.max)}
        ${maxed ? '<span class="price done">Au max</span>'
          : `<button class="price ${can ? 'can' : ''}" data-buy="${up.id}" aria-label="Acheter ${up.name} pour ${fmt(cost)} $">${fmt(cost)} $</button>`}
      </li>`;
    }
    html += '</ul>';
    $('tab-upgrades').innerHTML = html;
  }

  function renderSkills() {
    const d = Save.data;
    const li = Data.levelInfo(d.xp);
    const points = li.level - 1 - Data.spentSkillPoints(d.skills);
    const nSlots = Data.unlockedSlots(li.level);
    let html = `<p class="intro">Chaque niveau gagné te donne un point. Dépense tes points pour débloquer ou améliorer une compétence, puis range-la dans un emplacement pour l'emporter en vol. Il te reste <b>${points} point${points > 1 ? 's' : ''}</b>.</p>`;
    html += '<div class="slots" aria-label="Emplacements de compétences">';
    for (let i = 0; i < Data.SLOT_LEVELS.length; i++) {
      if (i >= nSlots) {
        html += `<div class="slot locked">au niveau ${Data.SLOT_LEVELS[i]}</div>`;
      } else if (d.slots[i]) {
        const sk = Data.SKILLS.find(x => x.id === d.slots[i]);
        html += `<button class="slot filled" data-unequip="${i}" aria-label="Retirer ${sk ? sk.name : ''}" title="Retirer">${sk ? sk.icon : '?'}<span class="x" aria-hidden="true">✕</span></button>`;
      } else {
        html += '<div class="slot"><small>libre</small></div>';
      }
    }
    html += '</div><ul class="lines two-cols">';
    for (const sk of Data.SKILLS) {
      const l = d.skills[sk.id] || 0;
      const locked = li.level < sk.req;
      const equipped = d.slots.slice(0, nSlots).includes(sk.id);
      const cost = Data.skillCost(l + 1);
      const canUp = !locked && l < Data.SKILL_MAX && points >= cost;
      let actions = '';
      if (locked) actions = `<span class="price">au niveau ${sk.req}</span>`;
      else {
        if (l < Data.SKILL_MAX) actions += `<button class="price ${canUp ? 'can' : ''}" data-skillup="${sk.id}">${l === 0 ? 'Débloquer' : 'Améliorer'}, ${cost} pt${cost > 1 ? 's' : ''}</button>`;
        if (l > 0) actions += equipped
          ? `<button class="price" data-unequip-id="${sk.id}">Retirer</button>`
          : `<button class="price equip" data-equip="${sk.id}">Équiper</button>`;
      }
      const shown = Math.max(1, l);
      const next = l > 0 && l < Data.SKILL_MAX ? `<div class="line-value">Niveau ${l + 1} : ${sk.desc(l + 1)}</div>` : '';
      html += `<li class="line stacked ${locked ? 'locked' : ''}">
        <span class="sticker" aria-hidden="true">${sk.icon}</span>
        <div>
          <div class="line-name">${sk.name}<span class="line-kind">${sk.type === 'active' ? 'à déclencher' : 'toujours active'}${equipped ? ', équipée' : ''}</span></div>
          <div class="line-desc">${sk.desc(shown)}</div>
          ${next}
        </div>
        ${ticks(l, Data.SKILL_MAX)}
        <div class="line-actions">${actions}</div>
      </li>`;
    }
    html += '</ul>';
    $('tab-skills').innerHTML = html;
  }

  function renderOptions() {
    const d = Save.data;
    const installed = G.matchMedia && (G.matchMedia('(display-mode: standalone)').matches || G.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone);
    const note = Save.persisted || installed
      ? `<p class="paper-note ok">Ta progression est enregistrée durablement sur cet appareil.${installed ? '' : " Installer le jeu sur l'écran d'accueil la protège encore mieux."}</p>`
      : `<p class="paper-note">Ta progression est enregistrée sur cet appareil. Pour qu'elle ne soit jamais effacée, surtout sur iPhone, <b>ajoute le jeu à ton écran d'accueil</b> (Partager, puis « Sur l'écran d'accueil ») et garde ton code de sauvegarde.</p>`;
    const check = (opt, on, label) => `<button class="check" data-opt="${opt}" aria-pressed="${on}"><span class="box" aria-hidden="true"></span>${label}</button>`;
    $('tab-options').innerHTML = `<ul class="settings">
      <li class="setting"><span class="setting-name">Son</span>${check('sound', d.settings.sound, d.settings.sound ? 'Activé' : 'Coupé')}</li>
      <li class="setting"><span class="setting-name">Vibrations</span>${check('vibration', d.settings.vibration, d.settings.vibration ? 'Activées' : 'Coupées')}</li>
      <li class="setting"><span class="setting-name">Plein écran</span><button class="btn" data-opt="fullscreen">Passer en plein écran</button></li>
      <li class="setting"><span class="setting-name">Code de sauvegarde<small>Copie ce code quelque part pour retrouver ta progression sur un autre appareil.</small></span><button class="btn" data-opt="export">Afficher le code</button></li>
    </ul>
    <div id="export-box" class="box-row hidden"><textarea class="code" id="export-code" readonly aria-label="Code de sauvegarde"></textarea><button class="btn" data-opt="copy">Copier le code</button></div>
    <ul class="settings">
      <li class="setting"><span class="setting-name">Restaurer une sauvegarde<small>Colle un code pour remplacer la progression actuelle.</small></span><button class="btn" data-opt="import">Coller un code</button></li>
    </ul>
    <div id="import-box" class="box-row hidden"><textarea class="code" id="import-code" placeholder="AP1-…" aria-label="Code à restaurer"></textarea><button class="btn btn-ink" data-opt="do-import">Restaurer cette sauvegarde</button></div>
    ${note}
    <h3 class="section-title">Commandes</h3>
    <table class="controls">
      <thead><tr><th></th><th>Écran tactile</th><th>Clavier</th><th>Souris</th><th>Manette</th></tr></thead>
      <tbody>
        <tr><th>Viser</th><td>glisser vers l'arrière</td><td>flèches haut et bas, ou Z et S</td><td>glisser vers l'arrière, molette</td><td>stick gauche</td></tr>
        <tr><th>Lancer</th><td>relâcher</td><td>maintenir Espace pour doser, puis relâcher</td><td>relâcher</td><td>maintenir puis relâcher A</td></tr>
        <tr><th>Planer</th><td>maintenir le doigt</td><td>maintenir Espace ou flèche haut</td><td>maintenir le clic gauche</td><td>maintenir A</td></tr>
        <tr><th>Booster</th><td>bouton 🔥</td><td>B, Maj, flèche droite ou D</td><td>maintenir le clic droit</td><td>RT, RB ou B</td></tr>
        <tr><th>Compétences</th><td>boutons en bas à gauche</td><td>1, 2, 3, et R pour le second lancer</td><td>clic sur le bouton</td><td>X, Y et LB</td></tr>
        <tr><th>Pause</th><td>bouton en haut à gauche</td><td>Échap ou P</td><td>clic sur le bouton</td><td>Start</td></tr>
      </tbody>
    </table>
    <p class="paper-note">Au hangar : Entrée lance l'avion, les flèches gauche et droite changent d'onglet, C ouvre les cartes. M coupe le son, F passe en plein écran.</p>
    <h3 class="section-title">Bonus du ciel</h3>
    <p class="paper-note">Partout : 🔥 recharge le boost, ⚡ redonne de la vitesse, ⏫ fait monter, 💲 rapporte de l'argent. Au-dessus de 35 m, les oiseaux 🐦 te font remonter un peu. Au-dessus de 50 m, les montgolfières 🎈 te font rebondir. Au-dessus de 90 m, l'étoile ⭐ garde ton altitude et t'accélère, et les diamants 💎 valent cinq pièces. Au-dessus de 130 m, reste dans le courant-jet 🌬️ pour accélérer.</p>
    <ul class="settings">
      <li class="setting"><span class="setting-name">Ton carnet de vol<small>${d.runs} lancer${d.runs > 1 ? 's' : ''}, ${fmt(d.totalDistance)} m parcourus en tout.</small></span></li>
      <li class="setting"><span class="setting-name">Effacer la progression<small>Argent, niveaux, compétences et cartes repartent de zéro.</small></span><button class="btn btn-danger" data-opt="reset">Tout effacer</button></li>
    </ul>`;
  }

  // ---------------------------------------------------------------- Onglet Avion
  let previewRaf = 0;
  let buyArmed = null, buyArmedAt = 0;
  function renderPlane() {
    const d = Save.data, P = G.Planes;
    const level = Data.levelInfo(d.xp).level;
    const look = P.resolve(d.plane, level);
    d.plane.seenLevel = level;
    Save.write(false);
    const next = P.MODELS.find(m => m.level && m.level > level);
    const lock = lv => `<span class="lock">au niveau ${lv}</span>`;
    const owned = d.plane.owned || [];
    // un élément : disponible (niveau atteint ou acheté), à acheter en diamants, ou verrouillé par le niveau
    const state = x => P.available(x, level, owned) ? 'ok' : x.diamonds ? 'shop' : 'locked';
    const attrs = (kind, x) => {
      const st = state(x);
      if (st === 'ok') return `data-look="${kind}:${x.id}"`;
      if (st === 'shop') return `data-buy-look="${kind}:${x.id}"`;
      return `data-locked="${x.level}"`;
    };
    const label = (x, name) => {
      const st = state(x);
      if (st === 'ok') return name;
      if (st === 'shop') return `<span class="gem">${x.diamonds} 💎</span>`;
      return lock(x.level);
    };
    let html = `<div class="plane-top">
      <canvas id="plane-preview"></canvas>
      <div class="plane-info">
        <div class="plane-name">${look.model.name}</div>
        <p>${look.auto ? "Ton avion change de modèle tout seul quand tu montes de niveau." : 'Tu as choisi ce modèle toi-même.'}</p>
        <p class="next">${next ? `Prochain modèle : ${next.name}, au niveau ${next.level}` : 'Tu as tous les modèles gagnés par niveau. Les autres s\'achètent en diamants.'}</p>
      </div>
    </div>`;
    html += '<h3 class="group-title">Modèle</h3><div class="chips">';
    html += `<button class="chip ${look.auto ? 'sel' : ''}" data-look="model:auto"><canvas class="mini" data-m="${P.autoModel(level).id}"></canvas><span>Auto</span></button>`;
    for (const m of P.MODELS) {
      html += `<button class="chip ${state(m)} ${!look.auto && look.model.id === m.id ? 'sel' : ''}" ${attrs('model', m)} title="${m.name}">
        <canvas class="mini" data-m="${m.id}"></canvas><span>${label(m, m.name)}</span></button>`;
    }
    html += '</div><h3 class="group-title">Couleur du papier</h3><div class="swatches">';
    const SPECIAL_BG = {
      rainbow: 'linear-gradient(135deg,#ff8a8a,#ffe680,#8affa8,#8ad8ff,#c08aff)',
      holo: 'linear-gradient(135deg,#ffd6f0,#d6f0ff,#e6ffd6,#fff3c4)',
      galaxy: 'radial-gradient(circle at 30% 30%, #ffffff 0 1px, transparent 2px), radial-gradient(circle at 70% 60%, #ffffff 0 1px, transparent 2px), linear-gradient(135deg,#1b1046,#4a2a9a,#1f5fb8)',
    };
    for (const c of P.COLORS) {
      const st = state(c);
      const bg = SPECIAL_BG[c.main] || `linear-gradient(135deg, ${c.main} 55%, ${c.shade} 55%)`;
      const small = st === 'ok' ? c.name : st === 'shop' ? `<span class="gem">${c.diamonds} 💎</span>` : 'niveau ' + c.level;
      html += `<button class="swatch ${st} ${look.color.id === c.id ? 'sel' : ''}" ${attrs('color', c)} aria-label="${c.name}" title="${c.name}"><span class="paper" style="background:${bg}"></span><small>${small}</small></button>`;
    }
    html += '</div><h3 class="group-title">Motif</h3><div class="chips">';
    for (const pt of P.PATTERNS) {
      html += `<button class="chip ${state(pt)} ${look.pattern.id === pt.id ? 'sel' : ''}" ${attrs('pattern', pt)} title="${pt.name}">
        <canvas class="mini" data-p="${pt.id}"></canvas><span>${label(pt, pt.name)}</span></button>`;
    }
    html += '</div><h3 class="group-title">Traînée</h3><div class="chips">';
    for (const t of P.TRAILS) {
      const bg = t.id === 'rainbow' ? 'linear-gradient(90deg,#ff5d5d,#ffd23f,#5be37a,#3dd6f0,#8a5cff)'
        : t.dots ? `radial-gradient(circle, ${t.preview[0]} 0 2px, transparent 3px) 0 0 / 8px 10px, ${t.preview[1]}22`
        : `linear-gradient(90deg, ${t.preview[0]}, ${t.preview[1]})`;
      html += `<button class="chip trail ${state(t)} ${look.trail.id === t.id ? 'sel' : ''}" ${attrs('trail', t)} title="${t.name}">
        <i style="background:${bg}"></i><span>${label(t, t.name)}</span></button>`;
    }
    html += `</div><p class="paper-note">L'apparence ne change pas les performances. Monte de niveau pour débloquer de nouveaux modèles, couleurs, motifs et traînées. Les pièces marquées 💎 s'achètent uniquement avec des diamants : tu en as <b>${fmt(d.diamonds || 0)}</b>. Les diamants se trouvent rarement dans le ciel, et tu en gagnes en ouvrant une carte ou tous les 500 m de record.</p>`;
    $('tab-plane').innerHTML = html;

    // Miniatures
    const dpr = Math.min(G.devicePixelRatio || 1, 2);
    $('tab-plane').querySelectorAll('canvas.mini').forEach(cv => {
      const w = cv.clientWidth || 70, h = cv.clientHeight || 40;
      cv.width = w * dpr; cv.height = h * dpr;
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const l = Object.assign({}, look);
      if (cv.dataset.m) l.model = P.MODELS.find(m => m.id === cv.dataset.m);
      if (cv.dataset.m && cv.dataset.m !== look.model.id && !P.available(l.model, level, owned)) l.color = P.COLORS[0];
      if (cv.dataset.p) l.pattern = P.PATTERNS.find(x => x.id === cv.dataset.p);
      c.translate(w / 2 + 2, h / 2 + 5);
      c.rotate(-0.12);
      P.draw(c, Math.min(w * 0.8, h * 1.4), l, 0.5);
    });
    startPreview(look);
  }

  function startPreview(look) {
    cancelAnimationFrame(previewRaf);
    const cv = $('plane-preview');
    if (!cv) return;
    const dpr = Math.min(G.devicePixelRatio || 1, 2);
    const w = cv.clientWidth || 220, h = cv.clientHeight || 110;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    const t0 = performance.now();
    const frame = now => {
      if (!document.body.contains(cv) || currentTab !== 'plane' || $('menu').classList.contains('hidden')) return;
      const t = (now - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#9fd2ff'); g.addColorStop(1, '#e6f4ff');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      // nuages qui défilent
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        const x = ((i * 97 - t * 40) % (w + 80) + w + 80) % (w + 80) - 40, y = 18 + (i % 2) * 50;
        c.beginPath(); c.arc(x, y, 12, 0, 7); c.arc(x + 14, y + 3, 9, 0, 7); c.arc(x - 13, y + 4, 8, 0, 7); c.fill();
      }
      // traînée
      const px = w * 0.55, py = h * 0.5 + Math.sin(t * 2) * 8, L = Math.min(w * 0.45, 120);
      const n = 26;
      c.lineCap = 'round';
      for (let i = 1; i < n; i++) {
        const k0 = i - 1, k1 = i;
        const x0 = px - L * 0.45 - (n - k0) * 6, y0 = h * 0.5 + Math.sin((t - (n - k0) * 0.035) * 2) * 8 + 2;
        const x1 = px - L * 0.45 - (n - k1) * 6, y1 = h * 0.5 + Math.sin((t - (n - k1) * 0.035) * 2) * 8 + 2;
        c.strokeStyle = G.Planes.trailColor(look.trail, n - i, n, (i / n) * 0.85, t);
        c.lineWidth = 1 + (i / n) * 4;
        c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      }
      c.save();
      c.translate(px, py);
      c.rotate(-Math.cos(t * 2) * 0.12);
      G.Planes.draw(c, L, look, t);
      c.restore();
      previewRaf = requestAnimationFrame(frame);
    };
    previewRaf = requestAnimationFrame(frame);
  }

  function onLook(e) {
    let b = e.target.closest('[data-look]');
    if (b) {
      const [kind, id] = b.dataset.look.split(':');
      Save.data.plane[kind] = id;
      Save.write();
      H.refreshLook();
      Sfx.click();
      renderPlane();
      return;
    }
    b = e.target.closest('[data-buy-look]');
    if (b) {
      const [kind, id] = b.dataset.buyLook.split(':');
      const list = { model: G.Planes.MODELS, color: G.Planes.COLORS, pattern: G.Planes.PATTERNS, trail: G.Planes.TRAILS }[kind];
      const item = list.find(x => x.id === id);
      const d = Save.data;
      if ((d.diamonds || 0) < item.diamonds) { Sfx.error(); toast(`Il te manque ${item.diamonds - (d.diamonds || 0)} 💎 pour ${item.name}`); return; }
      if (buyArmed !== b.dataset.buyLook || Date.now() - buyArmedAt > 3000) {
        buyArmed = b.dataset.buyLook; buyArmedAt = Date.now();
        Sfx.click(); toast(`Touche encore pour acheter ${item.name} pour ${item.diamonds} 💎`);
        return;
      }
      buyArmed = null;
      d.diamonds -= item.diamonds;
      d.plane.owned = (d.plane.owned || []).concat(id);
      d.plane[kind] = id;
      Save.write();
      H.refreshLook();
      Sfx.buy(); vibrate(20);
      toast(`${item.name} acheté et équipé`);
      renderMenu();
      return;
    }
    b = e.target.closest('[data-locked]');
    if (b) { Sfx.error(); toast(`Disponible au niveau ${b.dataset.locked}`); }
  }

  // ---------------------------------------------------------------- Cartes
  function renderMaps() {
    const d = Save.data, M = G.Maps;
    let html = '';
    M.MAPS.forEach((m, i) => {
      const ok = M.isUnlocked(d, m.id);
      const rec = (d.maps[m.id] || {}).best || 0;
      const prev = M.MAPS[i - 1];
      const prevBest = prev ? ((d.maps[prev.id] || {}).best || 0) : 0;
      const sel = d.currentMap === m.id;
      const gain = String(m.reward).replace('.', ',');
      let status;
      if (ok) status = `<div class="map-desc">Ton record : ${fmt(rec)} m${m.unlockNext ? `. Atteins ${m.unlockNext} m pour ouvrir la carte suivante.` : '.'}</div>`;
      else {
        const pct = Math.min(100, (prevBest / prev.unlockNext) * 100);
        status = `<div class="map-lock">Atteins ${prev.unlockNext} m sur ${prev.name} pour l'ouvrir (ton record : ${fmt(prevBest)} m)</div>
          <div class="progress" role="img" aria-label="${Math.round(pct)} %"><i style="width:${pct}%"></i></div>`;
      }
      const tag = ok ? 'button' : 'div';
      html += `<li><${tag} class="map-line ${ok ? '' : 'locked'} ${sel ? 'sel' : ''}" ${ok ? `data-map="${m.id}"` : ''}>
        <span class="map-icon" aria-hidden="true">${m.icon}</span>
        <span>
          <span class="map-name">${m.name}${sel ? '<small>carte actuelle</small>' : ''}</span>
          <span class="map-desc" style="display:block">${m.desc}</span>
          <span class="map-gain" style="display:block">Gains ×${gain}</span>
          ${m.perks ? `<span class="map-gain" style="display:block">Aide : ${m.perks.join(', ').toLowerCase()}</span>` : ''}
          ${m.malus.length ? `<span class="map-malus" style="display:block">${m.malus.map((x, k) => k ? x[0].toLowerCase() + x.slice(1) : x).join(', ')}</span>` : ''}
          ${status}
        </span>
      </${tag}></li>`;
    });
    $('maps-list').innerHTML = html;
  }

  function renderMenu() {
    renderProfile();
    if (currentTab === 'upgrades') renderUpgrades();
    else if (currentTab === 'skills') renderSkills();
    else if (currentTab === 'plane') renderPlane();
    else renderOptions();
  }

  function setTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    for (const t of ['upgrades', 'skills', 'plane', 'options']) $('tab-' + t).classList.toggle('hidden', t !== tab);
    renderMenu();
  }

  // ---------------------------------------------------------------- Actions du hangar
  function buyUpgrade(id) {
    const d = Save.data;
    const up = Data.UPGRADES.find(u => u.id === id);
    const l = d.upgrades[id] || 0;
    if (l >= up.max) return;
    const cost = Data.upgradeCost(up, l);
    if (d.money < cost) { Sfx.error(); toast(`Il te manque ${fmt(cost - d.money)} $`); return; }
    d.money -= cost;
    d.upgrades[id] = l + 1;
    Save.write();
    Sfx.buy(); vibrate(15);
    renderMenu();
  }

  function upgradeSkill(id) {
    const d = Save.data;
    const s = Data.SKILLS.find(x => x.id === id);
    const li = Data.levelInfo(d.xp);
    const l = d.skills[id] || 0;
    const points = li.level - 1 - Data.spentSkillPoints(d.skills);
    const cost = Data.skillCost(l + 1);
    if (li.level < s.req || l >= Data.SKILL_MAX) return;
    if (points < cost) { Sfx.error(); toast(`Il te faut ${cost} point${cost > 1 ? 's' : ''}. Vole pour monter de niveau.`); return; }
    d.skills[id] = l + 1;
    // Équipe automatiquement si un slot est libre
    if (l === 0) {
      const nSlots = Data.unlockedSlots(li.level);
      const free = d.slots.findIndex((x, i) => i < nSlots && !x);
      if (free >= 0) { d.slots[free] = id; toast(`${s.name} débloquée et équipée`); }
      else if (nSlots === 0) toast(`${s.name} débloquée. Ton premier emplacement s'ouvre au niveau ${Data.SLOT_LEVELS[0]}.`);
      else toast(`${s.name} débloquée. Libère un emplacement pour l'équiper.`);
    }
    Save.write();
    Sfx.buy(); vibrate(15);
    renderMenu();
  }

  function equip(id) {
    const d = Save.data;
    const nSlots = Data.unlockedSlots(Data.levelInfo(d.xp).level);
    if (nSlots === 0) { Sfx.error(); toast(`Ton premier emplacement s'ouvre au niveau ${Data.SLOT_LEVELS[0]}`); return; }
    const free = d.slots.findIndex((x, i) => i < nSlots && !x);
    if (free < 0) { Sfx.error(); toast('Tes emplacements sont pleins. Retire d\'abord une compétence.'); return; }
    d.slots[free] = id;
    Save.write(); Sfx.click(); renderMenu();
  }

  function unequip(i) {
    Save.data.slots[i] = null;
    Save.write(); Sfx.click(); renderMenu();
  }

  function onOption(opt) {
    const d = Save.data;
    if (opt === 'sound') { d.settings.sound = !d.settings.sound; Save.write(); if (!d.settings.sound) Sfx.silence(); else Sfx.click(); }
    else if (opt === 'vibration') { d.settings.vibration = !d.settings.vibration; Save.write(); vibrate(30); }
    else if (opt === 'fullscreen') { H.toggleFullscreen(); return; }
    else if (opt === 'export') {
      $('export-box').classList.remove('hidden');
      $('export-code').value = Save.exportCode();
      $('export-code').select();
      return;
    } else if (opt === 'copy') {
      const code = $('export-code').value;
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(
        () => toast('Code copié'),
        () => { $('export-code').select(); document.execCommand && document.execCommand('copy'); toast('Sélectionne le code puis copie-le'); });
      return;
    } else if (opt === 'import') { $('import-box').classList.remove('hidden'); return; }
    else if (opt === 'do-import') {
      try { Save.importCode($('import-code').value); toast('Sauvegarde restaurée'); Sfx.levelUp(); }
      catch (e) { toast('Ce code ne correspond à aucune sauvegarde. Vérifie qu\'il commence par AP1-.'); Sfx.error(); return; }
    } else if (opt === 'reset') {
      if (Date.now() - resetArmed > 3000) { resetArmed = Date.now(); toast('Appuie encore une fois pour tout effacer'); return; }
      Save.reset(); toast('Progression effacée');
    }
    renderMenu();
  }

  // ---------------------------------------------------------------- Écrans
  function showMenu() { $('menu').classList.remove('hidden'); $('hud').classList.add('hidden'); renderMenu(); }
  function hideMenu() { $('menu').classList.add('hidden'); $('hud').classList.remove('hidden'); }
  function showPause() { $('pause').classList.remove('hidden'); }
  function hidePause() { $('pause').classList.add('hidden'); }
  function hideResults() { $('results').classList.add('hidden'); }

  function showResults(r) {
    $('res-title').textContent = r.burnt ? 'Avion brûlé' : r.crashed ? 'Avion écrasé' : r.dist >= 1000 ? 'Vol incroyable' : r.dist >= 200 ? 'Beau vol' : 'Atterrissage';
    $('res-dist').textContent = `${fmt(r.dist)} m`;
    $('res-record').classList.toggle('hidden', !r.newRecord);
    $('res-money').textContent = `+${fmt(r.money)} $`;
    $('res-xp').textContent = `+${fmt(r.xp)} XP`;
    $('res-pickups').textContent = r.pickups;
    $('res-diamonds').textContent = `+${r.diamonds || 0} 💎`;
    $('res-diamonds').classList.toggle('hidden', !r.diamonds);
    $('res-dia-label').classList.toggle('hidden', !r.diamonds);
    const notes = [];
    if (r.levelsGained > 0) {
      notes.push(`Niveau ${r.level}, +${r.levelsGained} point${r.levelsGained > 1 ? 's' : ''}`);
      if (r.newSlots > 0) notes.push('Nouvel emplacement de compétence');
      const newSkills = Data.SKILLS.filter(sk => sk.req > r.level - r.levelsGained && sk.req <= r.level);
      if (newSkills.length) notes.push(`À découvrir : ${newSkills.map(sk => sk.name).join(', ')}`);
    }
    if (r.newMap) notes.push(`Nouvelle carte ouverte : ${r.newMap.name}`);
    let html = notes.join('<br>');
    if (r.cosmetics && r.cosmetics.length) html += `<small>Nouveau dans l'onglet Avion : ${r.cosmetics.join(', ').toLowerCase()}</small>`;
    $('res-level').innerHTML = html;
    $('results').classList.remove('hidden');
  }

  // ---------------------------------------------------------------- HUD
  const hudCache = {};
  function setText(id, txt) { if (hudCache[id] !== txt) { hudCache[id] = txt; $(id).textContent = txt; } }

  function buildHudSkills(stats) {
    const box = $('hud-skills');
    box.innerHTML = '';
    if (stats.passives.length) {
      const list = document.createElement('div');
      list.className = 'passive-list';
      for (const ps of stats.passives) {
        const c = document.createElement('div');
        c.className = 'passive-chip';
        c.dataset.id = ps.id;
        c.title = ps.name;
        c.innerHTML = `${ps.icon}${ps.id === 'bounce' ? '<span class="uses"></span>' : ''}`;
        list.appendChild(c);
      }
      box.appendChild(list);
    }
    stats.actives.forEach((a, i) => {
      const b = document.createElement('button');
      b.className = 'skill-btn';
      b.dataset.id = a.id;
      b.title = a.name;
      b.setAttribute('aria-label', a.name);
      b.innerHTML = `<span aria-hidden="true">${a.icon}</span><span class="uses"></span><span class="key">${i + 1}</span>`;
      b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); H.useSkill(a.id); });
      box.appendChild(b);
    });
    for (const k in hudCache) delete hudCache[k];
  }

  function updateHud(p, stats, record, liveMoney) {
    const dist = Math.floor(p.maxX);
    setText('hud-dist', `${fmt(dist)} m`);
    const alt = Math.max(0, Math.round(p.y - G.Physics.ground(p.x)));
    const kmh = Math.round(Math.hypot(p.vx, p.vy) * 3.6);
    setText('hud-alt', `${alt} m de haut`);
    setText('hud-speed', `${kmh} km/h`);
    const beat = dist > record && record > 0;
    setText('hud-record', beat ? 'Nouveau record' : `Record ${fmt(record)} m`);
    if (hudCache.beat !== beat) { hudCache.beat = beat; $('hud-record').classList.toggle('beat', beat); }
    setText('hud-money', p.diamonds ? `+${fmt(liveMoney)} $   +${p.diamonds} 💎` : `+${fmt(liveMoney)} $`);
    const frac = stats.tank > 0 ? p.fuel / stats.tank : 0;
    const off = (276.5 * (1 - frac)).toFixed(1);
    if (hudCache.off !== off) { hudCache.off = off; $('boost-ring-fg').style.strokeDashoffset = off; }
    const empty = p.fuel <= 0.001 && !(p.nitroT > 0);
    if (hudCache.empty !== empty) { hudCache.empty = empty; $('btn-boost').classList.toggle('empty', empty); }
    for (const b of $('hud-skills').querySelectorAll('.skill-btn')) {
      const u = p.uses[b.dataset.id] || 0;
      const key = 'u_' + b.dataset.id;
      if (hudCache[key] !== u) { hudCache[key] = u; b.querySelector('.uses').textContent = u; b.classList.toggle('used', u <= 0); }
    }
    const bc = $('hud-skills').querySelector('.passive-chip[data-id="bounce"]');
    if (bc && hudCache.bounce !== p.bouncesLeft) {
      hudCache.bounce = p.bouncesLeft;
      bc.querySelector('.uses').textContent = p.bouncesLeft;
      bc.classList.toggle('spent', p.bouncesLeft <= 0);
    }
  }

  let hintTimer = null;
  function hint(msg, ms) {
    const h = $('hint');
    clearTimeout(hintTimer);
    if (!msg) { h.classList.remove('show'); return; }
    h.innerHTML = msg;
    h.classList.add('show');
    if (ms) hintTimer = setTimeout(() => h.classList.remove('show'), ms);
  }

  // ---------------------------------------------------------------- Initialisation
  function init(handlers) {
    H = handlers;
    document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { Sfx.click(); setTab(b.dataset.tab); }));
    $('btn-play').addEventListener('click', () => { Sfx.unlock(); H.play(); });
    $('btn-pause').addEventListener('pointerdown', e => { e.stopPropagation(); H.pause(); });
    $('btn-resume').addEventListener('click', () => H.resume());
    $('btn-restart').addEventListener('click', () => H.restart());
    $('btn-quit').addEventListener('click', () => H.quit());
    $('btn-res-hangar').addEventListener('click', () => H.toHangar());
    $('btn-res-again').addEventListener('click', () => H.play());

    $('tab-upgrades').addEventListener('click', e => {
      const b = e.target.closest('[data-buy]');
      if (b) buyUpgrade(b.dataset.buy);
    });
    $('tab-skills').addEventListener('click', e => {
      let b;
      if ((b = e.target.closest('[data-skillup]'))) upgradeSkill(b.dataset.skillup);
      else if ((b = e.target.closest('[data-equip]'))) equip(b.dataset.equip);
      else if ((b = e.target.closest('[data-unequip]'))) unequip(+b.dataset.unequip);
      else if ((b = e.target.closest('[data-unequip-id]'))) unequip(Save.data.slots.indexOf(b.dataset.unequipId));
    });
    $('tab-plane').addEventListener('click', onLook);
    $('btn-map').addEventListener('click', () => { Sfx.click(); renderMaps(); $('maps').classList.remove('hidden'); });
    $('btn-maps-close').addEventListener('click', () => $('maps').classList.add('hidden'));
    $('maps-list').addEventListener('click', e => {
      const c = e.target.closest('[data-map]');
      if (!c) { if (e.target.closest('.map-line.locked')) { Sfx.error(); toast('Cette carte est encore fermée'); } return; }
      Save.data.currentMap = c.dataset.map;
      Save.write();
      Sfx.click();
      H.mapChanged();
      $('maps').classList.add('hidden');
      renderMenu();
    });
    $('tab-options').addEventListener('click', e => {
      const b = e.target.closest('[data-opt]');
      if (b) onOption(b.dataset.opt);
    });

    // Boost
    const boost = $('btn-boost');
    const press = v => { H.setBoost(v); boost.classList.toggle('pressed', v); };
    boost.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); try { boost.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } press(true); });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) boost.addEventListener(ev, () => press(false));
  }

  const TABS = ['upgrades', 'skills', 'plane', 'options'];
  function cycleTab(d) { setTab(TABS[(TABS.indexOf(currentTab) + d + TABS.length) % TABS.length]); Sfx.click(); }
  function openMaps() { renderMaps(); $('maps').classList.remove('hidden'); }
  function closeMaps() { $('maps').classList.add('hidden'); }
  function mapsOpen() { return !$('maps').classList.contains('hidden'); }

  G.UI = { init, cycleTab, openMaps, closeMaps, mapsOpen, fmt, toast, vibrate, renderMenu, showMenu, hideMenu, showPause, hidePause, showResults, hideResults, buildHudSkills, updateHud, hint };
})(window);
