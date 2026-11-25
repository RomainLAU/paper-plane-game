# ✈ Aéro Papier

Jeu mobile 2D (format paysage) : lance ton avion en papier le plus loin possible !
Chaque mètre parcouru rapporte de l'argent 💰 et de l'XP ⭐.

Jouable dans le navigateur (mobile **et** ordinateur), installable comme une application (PWA), fonctionne hors-ligne.
Aucune dépendance, aucune étape de build : HTML + CSS + JavaScript.

## Comment jouer

| Action | Mobile | Ordinateur |
|---|---|---|
| Viser et lancer | Glisser vers l'arrière puis relâcher | Clic-glisser vers l'arrière puis relâcher |
| Ralentir / planer | Maintenir le doigt sur l'écran | Maintenir le clic ou **Espace** |
| Boost | Bouton 🔥 en bas à droite | **B** ou **Maj** |
| Compétences actives | Boutons en bas à gauche | **1**, **2**, **3** |
| Pause | Bouton en haut à gauche | **Échap** |

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

### Compétences (XP)
Chaque niveau donne 1 point de compétence. On commence **sans aucun slot** ; les 3 slots se débloquent aux niveaux **2, 6 et 12**.
Chaque compétence a 3 niveaux.
- Passives : Rebond 🏀, Plume 🪶 (gravité réduite), Érudit 📚 (+XP), Super aimant 🌀, Fortune 💎 (+argent), Recharge ♻️ (boost qui se recharge), Chance 🍀 (plus de bonus)
- Actives : Second lancer 🔁, Ascension 🌪️, Nitro ⚡, Vol plané 🛩️

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
css/style.css          styles (paysage, zones sûres des encoches)
js/data.js             améliorations, compétences, niveaux, calcul des stats
js/physics.js          physique du vol (portance/traînée/décrochage), terrain, bonus
js/render.js           rendu Canvas (ciel, parallaxe, décor, avion, effets)
js/ui.js               hangar, onglets, résultats, pause, HUD
js/audio.js            effets sonores synthétisés (WebAudio)
js/save.js             sauvegarde persistante + export/import
js/main.js             boucle de jeu, contrôles
sw.js                  service worker (hors-ligne)
manifest.webmanifest   PWA (plein écran, paysage)
```
