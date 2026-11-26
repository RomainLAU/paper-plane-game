# ✈ Aéro Papier

Jeu mobile 2D (format paysage) : lance ton avion en papier le plus loin possible !
Chaque mètre parcouru rapporte de l'argent 💰 et de l'XP ⭐.

Jouable dans le navigateur (mobile **et** ordinateur), installable comme une application (PWA), fonctionne hors-ligne.
Aucune dépendance, aucune étape de build : HTML + CSS + JavaScript.

## Comment jouer

| Action | Mobile | Clavier | Souris | Manette |
|---|---|---|---|---|
| Viser | glisser vers l'arrière | ⬆️ ⬇️ (ou Z/S, W/S) | glisser vers l'arrière, molette | stick gauche / croix |
| Lancer | relâcher | maintenir **Espace** (la jauge monte puis redescend), relâcher | relâcher | maintenir puis relâcher **A** |
| Planer | maintenir le doigt | maintenir **Espace** ou ⬆️ | maintenir clic gauche | maintenir **A** |
| Boost | bouton 🔥 | **B**, **Maj**, ➡️ ou **D** | maintenir clic droit | **RT**, **RB** ou **B** |
| Compétences actives | boutons en bas à gauche | **1**, **2**, **3** (second lancer : **R**) | clic | **X**, **Y**, **LB** |
| Pause | bouton en haut à gauche | **Échap** ou **P** (puis **R** relancer, **H** hangar) | clic | **Start** |
| Menus | — | **Entrée** lancer/relancer · **Échap** hangar · ⬅️➡️ onglets · **C** cartes | — | **A** lancer · **B** hangar |
| Son / plein écran | Options | **M** / **F** | — | — |

Planer fait monter le nez de l'avion : il ralentit et descend moins vite… mais s'il va trop lentement, il décroche !

### Bonus sur la carte
Les bonus apparaissent autour de l'altitude où vole l'avion, et de nouveaux types se débloquent en montant :

| Altitude | Bonus | Effet |
|---|---|---|
| partout | 🔥 orange | recharge le boost |
| partout | ⚡ jaune | regain de vitesse |
| partout | ⏫ vert | courant ascendant (reprend de l'altitude sans perdre de vitesse) |
| partout | 💲 pièces | argent en plus |
| > 35 m | 🐦 oiseaux | chaque oiseau touché fait remonter un peu |
| > 50 m | 🎈 montgolfière | gros rebond vers le haut |
| > 90 m | ⭐ étoile | garde l'altitude pendant 4,5 s et accélère |
| > 90 m | 💎 diamants | valent 5 pièces |
| > 130 m | 🌬️ courant-jet | bande de vent : reste dedans pour accélérer |

### Vol
Quand l'avion va plus vite que sa vitesse de croisière, il monte (45° maximum) ; quand il ralentit, il se remet à plat en douceur puis plane. Trop lent, il pique pour reprendre de la vitesse.

### Améliorations (argent)
Lancer puissant, Tremplin (hauteur de départ), Ailes planeuses (garde la hauteur), Pliage aérodynamique (vitesse), Réservoir de boost, Turbine (puissance du boost), Aimant à bonus, Bonus renforcés, Prime au mètre.

### Cartes
Chaque carte est plus dure mais rapporte plus. Atteindre une certaine distance débloque la suivante :

| Carte | Débloquée par | Gains | Difficultés | Aides |
|---|---|---|---|---|
| 🌾 Prairie | — | ×1 | — | — |
| 🏜️ Désert | 600 m en Prairie | ×1,6 | gravité +10 %, vent de face, tempêtes de sable | — |
| 🏔️ Montagnes | 700 m dans le Désert | ×2,3 | pics à survoler, rafales descendantes | — |
| 🏝️ Archipel | 750 m en Montagnes | ×3 | l'eau arrête le vol (sauf rebond), mouettes | — |
| ⛈️ Orage | 800 m dans l'Archipel | ×4 | pluie, nuages électriques, rafales | — |
| 🪨 Canyon | 800 m dans l'Orage | ×5 | piliers de roche, vautours | rafales dans le dos |
| 🏙️ Ville | 800 m dans le Canyon | ×6 | gratte-ciel, pigeons, rafales entre les tours | air chaud des toits |
| 🌋 Volcan | 800 m en Ville | ×7,5 | lave qui brûle l'avion, nuages de cendres | thermiques au-dessus de la lave |
| 🧊 Banquise | 900 m sur le Volcan | ×9 | fort vent de face, blizzard | glace très glissante, chouettes |

### Chocs
Si l'avion rentre trop fort dans le sol, un pilier ou un immeuble, **son nez se plie** (il plane moins bien pour le reste du vol). Un choc encore plus fort, de face contre un mur ou en piqué, **l'écrase en boule de papier** et termine le vol. La lave le brûle. Le Rebond et la compétence Origami renforcé protègent.

### Diamants 💎
Monnaie rare, à part de l'argent : quelques diamants dans le ciel (un peu plus en altitude), 3 diamants à l'ouverture d'une nouvelle carte, 1 diamant par palier de 500 m de record sur chaque carte. Ils servent uniquement à acheter des cosmétiques exclusifs dans l'onglet Avion : modèles Grue en origami, Hirondelle, Navette ; couleurs Corail, Encre, Holographique, Galaxie ; motifs Cœurs, Cahier, Journal, Carte au trésor ; traînées Encre, Étincelles, Confettis.

### Argent
0,25 $ par mètre et 3 $ par pièce, multipliés par la Prime au mètre, la compétence Fortune et les gains de la carte.

### Personnalisation de l'avion (onglet « Avion »)
L'avion **évolue avec ton niveau** (mode Auto) : Classique → Planeur (niv. 3) → Flèche (5) → Faucon (8) → Delta (12) → Jet (16) → Phénix (20).
On peut aussi choisir son modèle, sa couleur (12), son motif (rayures, pois, étoiles, flammes, damier) et sa traînée (bleue, feu, néon, dorée, arc-en-ciel), débloqués en montant de niveau. C'est purement esthétique.

### Décor
Prairie avec maisons, granges, moulins, plusieurs espèces d'arbres et ombres portées ; le ciel s'assombrit en montant jusqu'à une nuit étoilée avec la lune et des étoiles filantes.

### Compétences (XP)
Chaque niveau donne 1 point de compétence. On commence **sans aucun emplacement** ; les 4 emplacements se débloquent aux niveaux **2, 6, 12 et 20**.
Chaque compétence a 3 niveaux.
- Nouvelles : Origami renforcé 🧱 (résiste aux chocs), Glissade 🛷, Vent arrière 🍃, Chasseur de trésor 🗝️ (plus de diamants), Battement d'ailes 🦅 (actif), Bouclier de papier 🛡️ (actif, ignore les pièges)
- Passives : Rebond 🏀, Plume 🪶 (gravité réduite), Érudit 📚 (+XP), Super aimant 🌀, Fortune 💎 (+argent), Recharge ♻️ (le boost se recharge après une pause, jusqu'à 1/2/3 s par vol), Chance 🍀 (plus de bonus)
- Actives : Second lancer 🔁, Ascension 🌪️, Nitro ⚡, Vol plané 🛩️

## Interface : le cahier d'écolier
Toute l'interface reprend un cahier français à grands carreaux (réglure Seyès) : encre bleue de stylo-plume, marge rouge où le niveau est noté comme par un professeur, coup de surligneur sur ce qu'on peut acheter, intercalaires de couleur pour les onglets, feuilles scotchées pour la pause, les résultats et les cartes.
- Polices (hébergées dans `fonts/`, licence OFL) : **Playwrite FR Moderne**, inspirée de l'écriture cursive enseignée à l'école en France, pour les titres et les gros chiffres ; **Atkinson Hyperlegible** pour tout le reste.
- Couleurs : papier `#fbfcff`, lignes `#b4c4ec`, marge `#e2545e`, encre `#1d3487`, crayon `#5a6075`, surligneur `#ffe95c`.
- Focus clavier visible, mouvements réduits respectés (`prefers-reduced-motion`).

## Sauvegarde
La progression est enregistrée automatiquement à la fin de chaque vol, dans le `localStorage` **et** dans IndexedDB, et le jeu demande au navigateur un stockage persistant (`navigator.storage.persist()`).

⚠️ Sur iPhone (Safari), les données d'un site non visité pendant 7 jours peuvent être effacées : **ajoute le jeu à l'écran d'accueil** (Partager → « Sur l'écran d'accueil »), ce qui supprime cette limite. Dans **Options**, un **code de sauvegarde** peut être exporté/importé pour ne jamais rien perdre (ou changer d'appareil).

## Lancer en local
Le jeu peut s'ouvrir directement (`index.html`), mais pour profiter du mode hors-ligne/installable il faut un serveur :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Mise en ligne (GitHub Pages)
Le workflow `.github/workflows/pages.yml` publie le jeu automatiquement (environ 30 s) à chaque push sur la branche par défaut (`claude/gallant-hawking-e1xbx5`, ou `main` si elle est créée). Le jeu charge toujours la dernière version quand il y a du réseau, et se recharge tout seul au hangar quand une mise à jour arrive.
Dans le dépôt GitHub : **Settings → Pages → Source : GitHub Actions**. Le jeu sera ensuite accessible sur `https://<utilisateur>.github.io/paper-plane-game/`, à ouvrir sur le téléphone puis à ajouter à l'écran d'accueil.

## Structure
```
index.html             page + HUD + menus
css/style.css          styles « cahier d'écolier » (paysage, zones sûres des encoches)
fonts/                 polices Playwrite FR Moderne et Atkinson Hyperlegible
js/data.js             améliorations, compétences, niveaux, calcul des stats
js/planes.js           modèles d'avion, couleurs, motifs, traînées
js/maps.js             cartes (difficulté, gains, pièges)
js/physics.js          physique du vol (portance/traînée/décrochage), terrain, bonus
js/render.js           rendu Canvas (ciel, parallaxe, décor, avion, effets)
js/ui.js               hangar, onglets, résultats, pause, HUD
js/audio.js            effets sonores synthétisés (WebAudio)
js/save.js             sauvegarde persistante + export/import
js/main.js             boucle de jeu, contrôles
sw.js                  service worker (hors-ligne)
manifest.webmanifest   PWA (plein écran, paysage)
```
