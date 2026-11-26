/* Données du jeu : améliorations, compétences, progression, calcul des statistiques */
(function (G) {
  'use strict';

  const GRAVITY = 9.81;
  const BASE_CL = 0.05;     // coefficient de portance (par v²)
  const BASE_CD = 0.0143;   // coefficient de traînée (par v²) -> finesse de base ≈ 3.5

  // ---------------------------------------------------------------- Améliorations (argent)
  const UPGRADES = [
    { id: 'launch', icon: '💪', name: 'Lancer puissant', desc: 'Lance plus fort',
      max: 15, base: 15, growth: 1.42, value: l => 13 + 2.2 * l, stat: 'Vitesse de lancer', fmt: v => `${v.toFixed(0)} m/s` },
    { id: 'height', icon: '🗼', name: 'Tremplin', desc: 'Lance de plus haut',
      max: 12, base: 22, growth: 1.5, value: l => 6 + 3 * l, stat: 'Hauteur', fmt: v => `${v} m` },
    { id: 'wings', icon: '🕊️', name: 'Ailes planeuses', desc: 'Garde mieux sa hauteur',
      max: 15, base: 25, growth: 1.45, value: l => 1 + 0.1 * l, stat: 'Finesse', fmt: v => `×${v.toFixed(1).replace('.', ',')}` },
    { id: 'aero', icon: '📐', name: 'Pliage aérodynamique', desc: "Moins de frottements, vole plus vite",
      max: 12, base: 30, growth: 1.5, value: l => 1 + 0.08 * l, stat: 'Vitesse de croisière', fmt: v => `×${Math.sqrt(v).toFixed(2).replace('.', ',')}` },
    { id: 'tank', icon: '🛢️', name: 'Réservoir', desc: 'Plus de boost en stock',
      max: 10, base: 35, growth: 1.5, value: l => 1.2 + 0.35 * l, stat: 'Boost', fmt: v => `${v.toFixed(1).replace('.', ',')} s` },
    { id: 'thrust', icon: '🚀', name: 'Turbine', desc: 'Boost plus puissant',
      max: 10, base: 40, growth: 1.5, value: l => 9 + 1.6 * l, stat: 'Poussée', fmt: v => `${v.toFixed(0)}` },
    { id: 'magnet', icon: '🧲', name: 'Aimant', desc: 'Attire les bonus proches',
      max: 8, base: 50, growth: 1.6, value: l => 1.5 + 1 * l, stat: 'Rayon', fmt: v => `${v.toFixed(1).replace('.', ',')} m` },
    { id: 'bonus', icon: '✨', name: 'Bonus renforcés', desc: 'Bonus ramassés plus efficaces',
      max: 10, base: 45, growth: 1.55, value: l => 1 + 0.1 * l, stat: 'Effet', fmt: v => `×${v.toFixed(1).replace('.', ',')}` },
    { id: 'money', icon: '💰', name: 'Prime au mètre', desc: "Plus d'argent par mètre",
      max: 15, base: 60, growth: 1.5, value: l => 1 + 0.1 * l, stat: 'Gains', fmt: v => `×${v.toFixed(1).replace('.', ',')}` },
  ];

  function upgradeCost(up, level) {
    return Math.round(up.base * Math.pow(up.growth, level));
  }

  // ---------------------------------------------------------------- Compétences (XP / niveaux)
  // Chaque compétence a 3 niveaux. Coût en points de compétence : niveau 1 = 1, niveau 2 = 2, niveau 3 = 3.
  const SKILLS = [
    { id: 'bounce', type: 'passive', icon: '🏀', name: 'Rebond', req: 2,
      desc: l => `Rebondit ${l} fois sur le sol (${[0, 60, 70, 80][l]}% de la vitesse conservée)` },
    { id: 'relaunch', type: 'active', icon: '🔁', name: 'Second lancer', req: 2,
      uses: l => [0, 1, 1, 2][l],
      desc: l => `Relance l'avion avec un grand regain de vitesse, même au sol (puissance ${['', '★', '★★', '★★★'][l]}, ${[0, 1, 1, 2][l]}× par vol)` },
    { id: 'feather', type: 'passive', icon: '🪶', name: 'Plume', req: 3,
      desc: l => `Gravité réduite de ${[0, 8, 14, 20][l]}%` },
    { id: 'updraft', type: 'active', icon: '🌪️', name: 'Ascension', req: 4,
      uses: l => [0, 1, 2, 3][l],
      desc: l => `Un courant d'air te fait monter d'environ 22 m sans perdre de vitesse (${[0, 1, 2, 3][l]}× par vol)` },
    { id: 'scholar', type: 'passive', icon: '📚', name: 'Érudit', req: 4,
      desc: l => `+${[0, 20, 40, 60][l]}% d'XP gagnée` },
    { id: 'supermagnet', type: 'passive', icon: '🌀', name: 'Super aimant', req: 5,
      desc: l => `Rayon de l'aimant ×${[1, 2, 3, 4][l]}` },
    { id: 'fortune', type: 'passive', icon: '💎', name: 'Fortune', req: 5,
      desc: l => `+${[0, 15, 30, 45][l]}% d'argent gagné` },
    { id: 'nitro', type: 'active', icon: '⚡', name: 'Nitro', req: 6,
      uses: l => [0, 1, 1, 2][l],
      desc: l => `Super boost gratuit pendant ${[0, 2, 3, 3][l]} s (${[0, 1, 1, 2][l]}× par vol)` },
    { id: 'regen', type: 'passive', icon: '♻️', name: 'Recharge', req: 7,
      desc: l => `Après 1,5 s sans booster, le boost se recharge doucement : jusqu'à ${[0, 1, 2, 3][l]} s récupérées par vol` },
    { id: 'luck', type: 'passive', icon: '🍀', name: 'Chance', req: 8,
      desc: l => `+${[0, 30, 60, 100][l]}% de bonus sur la carte` },
    { id: 'glider', type: 'active', icon: '🛩️', name: 'Vol plané', req: 10,
      uses: () => 1,
      desc: l => `L'avion ne perd plus d'altitude pendant ${[0, 3, 4.5, 6][l]} s (1× par vol)` },
  ];
  const SKILL_MAX = 3;
  const SLOT_LEVELS = [2, 6, 12]; // niveau requis pour chaque slot

  function skillCost(nextLevel) { return nextLevel; }

  // ---------------------------------------------------------------- XP / niveaux
  function xpForNext(level) { return Math.round(80 * Math.pow(level, 1.5)); }
  function levelInfo(totalXp) {
    let level = 1, rest = totalXp;
    while (rest >= xpForNext(level)) { rest -= xpForNext(level); level++; }
    return { level, current: rest, needed: xpForNext(level) };
  }
  function spentSkillPoints(skills) {
    let s = 0;
    for (const id in skills) { const l = skills[id] || 0; s += (l * (l + 1)) / 2; }
    return s;
  }
  function unlockedSlots(level) { return SLOT_LEVELS.filter(l => level >= l).length; }

  // ---------------------------------------------------------------- Statistiques effectives
  function computeStats(save) {
    const u = id => save.upgrades[id] || 0;
    const upVal = id => UPGRADES.find(x => x.id === id).value(u(id));
    const level = levelInfo(save.xp).level;
    const nSlots = unlockedSlots(level);
    const equipped = save.slots.slice(0, nSlots).filter(Boolean);
    const sk = id => (equipped.includes(id) ? (save.skills[id] || 0) : 0);

    // Ailes : meilleure finesse (moins de traînée). Pliage : vitesse de croisière plus élevée.
    const aero = upVal('aero');
    const cl = BASE_CL / aero;
    const cd = BASE_CD / upVal('wings') / (1 + (aero - 1) * 1.25);
    const launchSpeed = upVal('launch');
    const launchHeight = upVal('height');
    const bonus = upVal('bonus');

    const s = {
      cl, cd,
      vCruise: Math.sqrt(GRAVITY / cl),
      vStall: 0.55 * Math.sqrt(GRAVITY / cl),
      liftMax: 2.3 * GRAVITY,
      gravity: 1 - [0, 0.08, 0.14, 0.2][sk('feather')],
      launchSpeed, launchHeight,
      tank: upVal('tank'),
      thrust: upVal('thrust'),
      magnet: upVal('magnet') * [1, 2, 3, 4][sk('supermagnet')],
      bonus,
      moneyMult: upVal('money') * (1 + [0, 0.15, 0.3, 0.45][sk('fortune')]),
      xpMult: 1 + [0, 0.2, 0.4, 0.6][sk('scholar')],
      bounces: sk('bounce'),
      bounceKeep: [0, 0.6, 0.7, 0.8][sk('bounce')],
      regen: [0, 0.2, 0.25, 0.3][sk('regen')],
      regenBudget: [0, 1, 2, 3][sk('regen')], // secondes de boost récupérables par vol
      density: 1 + [0, 0.3, 0.6, 1][sk('luck')],
      // Altitude max à laquelle on fait apparaître des bonus : dépend de l'énergie de lancer
      spawnAlt: Math.max(16, Math.min(140, launchHeight + (launchSpeed * launchSpeed) / (2 * GRAVITY) * 0.6)),
      actives: [],
      passives: [],
    };
    for (const id of equipped) {
      const def = SKILLS.find(x => x.id === id);
      const lvl = save.skills[id] || 0;
      if (!def || lvl <= 0) continue;
      if (def.type === 'active') s.actives.push({ id, lvl, icon: def.icon, name: def.name, uses: def.uses(lvl) });
      else s.passives.push({ id, lvl, icon: def.icon, name: def.name });
    }
    return s;
  }

  G.Data = {
    GRAVITY, UPGRADES, SKILLS, SKILL_MAX, SLOT_LEVELS,
    upgradeCost, skillCost, xpForNext, levelInfo, spentSkillPoints, unlockedSlots, computeStats,
  };
})(typeof window !== 'undefined' ? window : globalThis);
