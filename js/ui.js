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
    $('m-level').textContent = `Niv. ${li.level}`;
    $('m-xp-text').textContent = `${fmt(li.current)} / ${fmt(li.needed)} XP`;
    $('m-xp-bar').style.width = `${(li.current / li.needed) * 100}%`;
    $('m-money').textContent = fmt(d.money);
    $('m-points').textContent = points;
    $('m-record').textContent = `${fmt(d.record)} m`;
    // Pastille sur l'onglet compétences s'il y a quelque chose à faire
    const nSlots = Data.unlockedSlots(li.level);
    const canBuy = Data.SKILLS.some(s => li.level >= s.req && (d.skills[s.id] || 0) < Data.SKILL_MAX && points >= Data.skillCost((d.skills[s.id] || 0) + 1));
    const freeSlot = d.slots.slice(0, nSlots).some(x => !x) && Data.SKILLS.some(s => (d.skills[s.id] || 0) > 0 && !d.slots.includes(s.id));
    $('skills-dot').classList.toggle('hidden', !(canBuy || freeSlot));
  }

  function renderUpgrades() {
    const d = Save.data;
    let html = '<div class="cards">';
    for (const up of Data.UPGRADES) {
      const l = d.upgrades[up.id] || 0;
      const maxed = l >= up.max;
      const cost = Data.upgradeCost(up, l);
      const can = !maxed && d.money >= cost;
      const val = up.fmt(up.value(l)) + (maxed ? '' : ` → ${up.fmt(up.value(l + 1))}`);
      html += `<div class="card ${maxed ? 'maxed' : ''}">
        <div class="ic">${up.icon}</div>
        <div class="info">
          <div class="name">${up.name} <span class="lvl">${l}/${up.max}</span></div>
          <div class="desc">${up.desc}</div>
          <div class="val">${val}</div>
        </div>
        <div class="actions">
          <button class="btn buy ${can ? 'ok' : ''}" data-buy="${up.id}" ${maxed ? 'disabled' : ''}>${maxed ? 'MAX' : '💰 ' + fmt(cost)}</button>
        </div>
      </div>`;
    }
    html += '</div>';
    $('tab-upgrades').innerHTML = html;
  }

  function renderSkills() {
    const d = Save.data;
    const li = Data.levelInfo(d.xp);
    const points = li.level - 1 - Data.spentSkillPoints(d.skills);
    const nSlots = Data.unlockedSlots(li.level);
    let html = `<p class="skill-intro">Chaque niveau gagné donne <b>1 point ✨</b> (tu en as <b>${points}</b>). Débloque des compétences puis équipe-les dans tes slots. Slots débloqués aux niveaux ${Data.SLOT_LEVELS.join(', ')}.</p>`;
    html += '<div class="slots"><span class="title">Slots</span>';
    for (let i = 0; i < 3; i++) {
      if (i >= nSlots) {
        html += `<div class="slot locked">🔒<small>Niv. ${Data.SLOT_LEVELS[i]}</small></div>`;
      } else if (d.slots[i]) {
        const s = Data.SKILLS.find(x => x.id === d.slots[i]);
        html += `<button class="slot filled" data-unequip="${i}" title="Retirer">${s ? s.icon : '?'}<span class="x">✕</span></button>`;
      } else {
        html += '<div class="slot"><small>vide</small></div>';
      }
    }
    html += '</div><div class="cards">';
    for (const s of Data.SKILLS) {
      const l = d.skills[s.id] || 0;
      const locked = li.level < s.req;
      const equipped = d.slots.slice(0, nSlots).includes(s.id);
      const cost = Data.skillCost(l + 1);
      const canUp = !locked && l < Data.SKILL_MAX && points >= cost;
      let pips = '';
      for (let k = 1; k <= Data.SKILL_MAX; k++) pips += `<span class="pip ${k <= l ? 'on' : ''}"></span>`;
      let actions = '';
      if (locked) actions = `<button class="btn buy" disabled>🔒 Niv. ${s.req}</button>`;
      else {
        if (l < Data.SKILL_MAX) actions += `<button class="btn buy ${canUp ? 'ok' : ''}" data-skillup="${s.id}">${l === 0 ? 'Débloquer' : 'Améliorer'} ✨${cost}</button>`;
        if (l > 0) actions += equipped
          ? `<button class="btn buy" data-unequip-id="${s.id}">Retirer</button>`
          : `<button class="btn buy equip" data-equip="${s.id}">Équiper</button>`;
      }
      const shown = Math.max(1, l);
      const next = l > 0 && l < Data.SKILL_MAX ? `<div class="val">Niv. ${l + 1} : ${s.desc(l + 1)}</div>` : '';
      html += `<div class="card skill ${locked ? 'locked' : ''} ${equipped ? 'equipped' : ''}">
        <div class="ic">${s.icon}</div>
        <div class="info">
          <div class="name">${s.name}<span class="type-badge ${s.type}">${s.type === 'active' ? 'ACTIF' : 'PASSIF'}</span><span class="pips">${pips}</span></div>
          <div class="desc">${s.desc(shown)}</div>
          ${next}
        </div>
        <div class="actions">${actions}</div>
      </div>`;
    }
    html += '</div>';
    $('tab-skills').innerHTML = html;
  }

  function renderOptions() {
    const d = Save.data;
    const installed = G.matchMedia && (G.matchMedia('(display-mode: standalone)').matches || G.matchMedia('(display-mode: fullscreen)').matches || navigator.standalone);
    const note = Save.persisted || installed
      ? `<div class="opt-note ok">✅ Ta progression est sauvegardée de façon persistante sur cet appareil.${installed ? '' : ' Pour encore plus de sécurité, installe le jeu sur ton écran d\'accueil.'}</div>`
      : `<div class="opt-note">💡 Ta progression est sauvegardée sur cet appareil. Pour qu'elle ne soit jamais effacée (notamment sur iPhone/Safari), <b>ajoute le jeu à ton écran d'accueil</b> (menu Partager → « Sur l'écran d'accueil ») et garde un <b>code de sauvegarde</b> ci-dessous.</div>`;
    $('tab-options').innerHTML = `<div class="opt-list">
      <div class="opt-row"><span>🔊 Son</span><button class="btn" data-opt="sound">${d.settings.sound ? 'Activé' : 'Coupé'}</button></div>
      <div class="opt-row"><span>📳 Vibrations</span><button class="btn" data-opt="vibration">${d.settings.vibration ? 'Activées' : 'Coupées'}</button></div>
      <div class="opt-row"><span>⛶ Plein écran</span><button class="btn" data-opt="fullscreen">Basculer</button></div>
      ${note}
      <div class="opt-row"><span>💾 Code de sauvegarde</span><button class="btn" data-opt="export">Exporter</button></div>
      <div id="export-box" class="hidden"><textarea class="code" id="export-code" readonly></textarea><button class="btn" data-opt="copy" style="margin-top:6px;width:100%">📋 Copier</button></div>
      <div class="opt-row"><span>📥 Restaurer une sauvegarde</span><button class="btn" data-opt="import">Importer</button></div>
      <div id="import-box" class="hidden"><textarea class="code" id="import-code" placeholder="Colle ton code ici (AP1-...)"></textarea><button class="btn primary" data-opt="do-import" style="margin-top:6px;width:100%">Restaurer</button></div>
      <div class="opt-note">🎮 <b>Commandes</b> — Glisse vers l'arrière puis relâche pour lancer. Maintiens l'écran (ou <b>Espace</b>) pour ralentir et planer. Bouton 🔥 (ou <b>B</b> / <b>Maj</b>) pour booster. Compétences actives : bouton en bas à gauche (ou <b>1</b>, <b>2</b>, <b>3</b>). Pause : <b>Échap</b>.</div>
      <div class="opt-note">🎁 <b>Bonus</b> — Partout : 🔥 recharge le boost · ⚡ vitesse · ⏫ courant ascendant · 💲 pièces.<br>
        Plus de 35 m : 🐦 oiseaux (chacun fait remonter un peu) · plus de 50 m : 🎈 montgolfière (gros rebond vers le haut) ·
        plus de 90 m : ⭐ étoile (garde ton altitude et accélère) et 💎 diamants · plus de 130 m : 🌬️ courant-jet (reste dedans pour accélérer).</div>
      <div class="opt-row"><span>📊 ${d.runs} lancers · ${fmt(d.totalDistance)} m au total</span></div>
      <div class="opt-row"><span>🗑️ Effacer la progression</span><button class="btn danger" data-opt="reset">Réinitialiser</button></div>
    </div>`;
  }

  function renderMenu() {
    renderProfile();
    if (currentTab === 'upgrades') renderUpgrades();
    else if (currentTab === 'skills') renderSkills();
    else renderOptions();
  }

  function setTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    for (const t of ['upgrades', 'skills', 'options']) $('tab-' + t).classList.toggle('hidden', t !== tab);
    renderMenu();
  }

  // ---------------------------------------------------------------- Actions du hangar
  function buyUpgrade(id) {
    const d = Save.data;
    const up = Data.UPGRADES.find(u => u.id === id);
    const l = d.upgrades[id] || 0;
    if (l >= up.max) return;
    const cost = Data.upgradeCost(up, l);
    if (d.money < cost) { Sfx.error(); toast(`Il te manque 💰 ${fmt(cost - d.money)}`); return; }
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
    if (points < cost) { Sfx.error(); toast(`Il te faut ✨${cost} point${cost > 1 ? 's' : ''} (monte de niveau en volant)`); return; }
    d.skills[id] = l + 1;
    // Équipe automatiquement si un slot est libre
    if (l === 0) {
      const nSlots = Data.unlockedSlots(li.level);
      const free = d.slots.findIndex((x, i) => i < nSlots && !x);
      if (free >= 0) { d.slots[free] = id; toast(`${s.icon} ${s.name} débloqué et équipé !`); }
      else if (nSlots === 0) toast(`${s.icon} ${s.name} débloqué ! Ton 1er slot arrive au niveau ${Data.SLOT_LEVELS[0]}.`);
      else toast(`${s.icon} ${s.name} débloqué ! Libère un slot pour l'équiper.`);
    }
    Save.write();
    Sfx.buy(); vibrate(15);
    renderMenu();
  }

  function equip(id) {
    const d = Save.data;
    const nSlots = Data.unlockedSlots(Data.levelInfo(d.xp).level);
    if (nSlots === 0) { Sfx.error(); toast(`Ton premier slot se débloque au niveau ${Data.SLOT_LEVELS[0]}`); return; }
    const free = d.slots.findIndex((x, i) => i < nSlots && !x);
    if (free < 0) { Sfx.error(); toast('Aucun slot libre : retire d\'abord une compétence'); return; }
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
        () => toast('Code copié ! Garde-le précieusement 📋'),
        () => { $('export-code').select(); document.execCommand && document.execCommand('copy'); toast('Sélectionne et copie le code'); });
      return;
    } else if (opt === 'import') { $('import-box').classList.remove('hidden'); return; }
    else if (opt === 'do-import') {
      try { Save.importCode($('import-code').value); toast('✅ Sauvegarde restaurée !'); Sfx.levelUp(); }
      catch (e) { toast('❌ Code invalide'); Sfx.error(); return; }
    } else if (opt === 'reset') {
      if (Date.now() - resetArmed > 3000) { resetArmed = Date.now(); toast('Appuie encore une fois pour TOUT effacer'); return; }
      Save.reset(); toast('Progression réinitialisée');
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
    $('res-title').textContent = r.dist >= 1000 ? 'Vol incroyable !' : r.dist >= 200 ? 'Beau vol !' : 'Atterrissage !';
    $('res-dist').textContent = `${fmt(r.dist)} m`;
    $('res-record').classList.toggle('hidden', !r.newRecord);
    $('res-money').textContent = `+${fmt(r.money)}`;
    $('res-xp').textContent = `+${fmt(r.xp)}`;
    $('res-pickups').textContent = r.pickups;
    let lv = '';
    if (r.levelsGained > 0) {
      lv = `⬆️ Niveau ${r.level} ! +${r.levelsGained} point${r.levelsGained > 1 ? 's' : ''} ✨`;
      if (r.newSlots > 0) lv += '<br>🔓 Nouveau slot de compétence débloqué !';
      const newSkills = Data.SKILLS.filter(s => s.req > r.level - r.levelsGained && s.req <= r.level);
      if (newSkills.length) lv += `<br>Nouvelle${newSkills.length > 1 ? 's' : ''} compétence${newSkills.length > 1 ? 's' : ''} : ${newSkills.map(s => s.icon + ' ' + s.name).join(', ')}`;
    }
    $('res-level').innerHTML = lv;
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
      b.innerHTML = `${a.icon}<span class="uses"></span><span class="key">${i + 1}</span>`;
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
    setText('hud-alt', `hauteur ${alt} m · ${kmh} km/h`);
    const beat = dist > record && record > 0;
    setText('hud-record', beat ? `🏆 NOUVEAU RECORD !` : `🏆 ${fmt(record)} m`);
    if (hudCache.beat !== beat) { hudCache.beat = beat; $('hud-record').style.background = beat ? 'rgba(255,190,30,0.85)' : ''; }
    setText('hud-money', `💰 +${fmt(liveMoney)}`);
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

  G.UI = { init, fmt, toast, vibrate, renderMenu, showMenu, hideMenu, showPause, hidePause, showResults, hideResults, buildHudSkills, updateHud, hint };
})(window);
