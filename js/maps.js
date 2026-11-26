/* Cartes : chaque carte est plus dure (gravité, frottements, vent, pièges) mais rapporte plus.
   Atteindre la distance "unlock" sur une carte débloque la suivante. */
(function (G) {
  'use strict';

  const MAPS = [
    {
      id: 'prairie', name: 'Prairie', icon: '🌾',
      desc: 'Collines verdoyantes, maisons et moulins.',
      gravity: 1, drag: 1, headwind: 0, bonus: 1, reward: 1,
      terrain: 'hills', hazards: [],
      unlockNext: 600,
      malus: [],
    },
    {
      id: 'desert', name: 'Désert', icon: '🏜️',
      desc: 'Dunes brûlantes et tempêtes de sable.',
      gravity: 1.1, drag: 1.1, headwind: 0.4, bonus: 0.9, reward: 1.6,
      terrain: 'dunes', hazards: [['sand', 22, 0]],
      unlockNext: 700,
      malus: ['Gravité +10%', 'Vent de face', 'Tempêtes de sable (freinent)'],
    },
    {
      id: 'mountains', name: 'Montagnes', icon: '🏔️',
      desc: 'Pics enneigés à survoler et rafales descendantes.',
      gravity: 1.2, drag: 1.15, headwind: 0.6, bonus: 0.85, reward: 2.3,
      terrain: 'peaks', hazards: [['down', 20, 0]],
      unlockNext: 750,
      malus: ['Gravité +20%', 'Vent de face', 'Montagnes sur la route', 'Rafales descendantes'],
    },
    {
      id: 'ocean', name: 'Archipel', icon: '🏝️',
      desc: "Des îles au milieu de l'océan : toucher l'eau arrête le vol !",
      gravity: 1.25, drag: 1.2, headwind: 0.8, bonus: 0.8, reward: 3,
      terrain: 'islands', water: true, hazards: [['gull', 24, 4]],
      unlockNext: 800,
      malus: ['Gravité +25%', "L'eau arrête le vol (sauf rebond)", 'Mouettes (font perdre de la vitesse)'],
    },
    {
      id: 'storm', name: 'Orage', icon: '⛈️',
      desc: 'Pluie battante, nuages électriques et rafales.',
      gravity: 1.35, drag: 1.3, headwind: 1.0, bonus: 0.75, reward: 4,
      terrain: 'hills', hazards: [['storm', 20, 8], ['down', 12, 0]],
      unlockNext: 800,
      malus: ['Gravité +35%', 'Pluie (frottements +30%)', 'Nuages électriques', 'Rafales descendantes'],
    },
    {
      id: 'canyon', name: 'Canyon', icon: '🪨',
      desc: 'Piliers de roche géants, rafales dans le dos et vautours.',
      gravity: 1.35, drag: 1.2, headwind: 0.5, bonus: 0.8, reward: 5,
      terrain: 'canyon', hazards: [['gust', 18, 4], ['gull', 18, 6, 'vulture'], ['down', 8, 0]],
      unlockNext: 800,
      malus: ['Gravité +35%', 'Piliers de roche (foncer dedans écrase l\'avion)', 'Vautours (font perdre vitesse et altitude)'],
      perks: ['Rafales dans le dos'],
    },
    {
      id: 'city', name: 'Ville', icon: '🏙️',
      desc: "Des gratte-ciel à éviter. L'air chaud des toits t'aide à monter.",
      gravity: 1.4, drag: 1.25, headwind: 0.7, bonus: 0.8, reward: 6,
      terrain: 'city', hazards: [['up', 26, 0, 'vent'], ['gull', 20, 5, 'pigeon'], ['down', 10, 0]],
      unlockNext: 800,
      malus: ['Gravité +40%', 'Immeubles sur la route', 'Pigeons', 'Rafales entre les tours'],
      perks: ["Bouches d'aération sur les toits"],
    },
    {
      id: 'volcano', name: 'Volcan', icon: '🌋',
      desc: "Bassins de lave, cendres brûlantes et thermiques très puissants.",
      gravity: 1.45, drag: 1.3, headwind: 0.5, bonus: 0.75, reward: 7.5,
      terrain: 'volcano', lava: true, hazards: [['up', 18, 0, 'thermal'], ['storm', 20, 6, 'ash'], ['down', 8, 0]],
      unlockNext: 900,
      malus: ['Gravité +45%', 'La lave brûle l\'avion', 'Nuages de cendres'],
      perks: ['Thermiques au-dessus de la lave'],
    },
    {
      id: 'ice', name: 'Banquise', icon: '🧊',
      desc: 'Blizzard de face, aurores et chouettes des neiges. La glace fait glisser très loin.',
      gravity: 1.5, drag: 1.2, headwind: 1.2, bonus: 0.75, reward: 9,
      terrain: 'ice', ice: true, hazards: [['sand', 20, 0, 'blizzard'], ['birds', 16, 10, 'owl'], ['down', 10, 0]],
      unlockNext: null,
      malus: ['Gravité +50%', 'Fort vent de face', 'Blizzard (freine)'],
      perks: ['Glace très glissante', 'Chouettes qui font remonter'],
    },
  ];

  const byId = id => MAPS.find(m => m.id === id) || MAPS[0];
  const indexOf = id => MAPS.findIndex(m => m.id === id);

  // Applique les modificateurs d'une carte aux stats de l'avion
  function apply(stats, map) {
    stats.map = map;
    stats.gravity *= map.gravity;
    stats.cd *= map.drag;
    stats.headwind = map.headwind;
    stats.density *= map.bonus;
    stats.moneyMult *= map.reward;
    stats.xpMult *= 1 + (map.reward - 1) * 0.5;
    return stats;
  }

  function isUnlocked(save, id) {
    if (id === 'prairie') return true;
    return !!(save.maps && save.maps[id] && save.maps[id].unlocked);
  }

  G.Maps = { MAPS, byId, indexOf, apply, isUnlocked };
})(typeof window !== 'undefined' ? window : globalThis);
