/* Sauvegarde persistante : localStorage + copie IndexedDB + stockage persistant demandé au navigateur.
   Export / import d'un code de sauvegarde pour ne jamais perdre sa progression. */
(function (G) {
  'use strict';
  const KEY = 'aeropapier_save_v1';
  const DB_NAME = 'aeropapier';
  const STORE = 'kv';

  function defaults() {
    return {
      version: 1,
      money: 0,
      xp: 0,
      record: 0,
      lastDistance: 0,
      totalDistance: 0,
      runs: 0,
      upgrades: {},
      skills: {},
      slots: [null, null, null, null],
      diamonds: 0,
      settings: { sound: true, vibration: true },
      plane: { model: 'auto', color: 'blanc', pattern: 'none', trail: 'white', owned: [] },
      currentMap: 'prairie',
      maps: { prairie: { unlocked: true, best: 0, last: 0 } },
      updatedAt: 0,
    };
  }

  function sanitize(obj) {
    const d = defaults();
    if (!obj || typeof obj !== 'object') return d;
    const out = Object.assign(d, obj);
    out.upgrades = Object.assign({}, obj.upgrades || {});
    out.skills = Object.assign({}, obj.skills || {});
    out.settings = Object.assign(defaults().settings, obj.settings || {});
    out.plane = Object.assign(defaults().plane, obj.plane || {});
    if (!Array.isArray(out.plane.owned)) out.plane.owned = [];
    // Cartes : records par carte (reprise de l'ancien record unique pour la Prairie)
    out.maps = {};
    const src = obj.maps || {};
    for (const id in src) out.maps[id] = Object.assign({ unlocked: false, best: 0, last: 0 }, src[id]);
    if (!out.maps.prairie) out.maps.prairie = { unlocked: true, best: +obj.record || 0, last: +obj.lastDistance || 0 };
    out.maps.prairie.unlocked = true;
    if (!out.maps[out.currentMap] || !out.maps[out.currentMap].unlocked) out.currentMap = 'prairie';
    out.slots = Array.isArray(obj.slots) ? obj.slots.slice(0, 4) : [null, null, null, null];
    while (out.slots.length < 4) out.slots.push(null);
    for (const k of ['money', 'xp', 'record', 'totalDistance', 'runs', 'updatedAt', 'lastDistance', 'diamonds']) {
      out[k] = Number.isFinite(+out[k]) ? +out[k] : 0;
    }
    return out;
  }

  // ---------------------------------------------------------------- IndexedDB (copie de secours)
  function idbOpen() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in G)) return reject(new Error('no idb'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet() {
    try {
      const db = await idbOpen();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const r = tx.objectStore(STORE).get(KEY);
        r.onsuccess = () => resolve(r.result || null);
        r.onerror = () => resolve(null);
      });
    } catch (e) { return null; }
  }
  async function idbSet(value) {
    try {
      const db = await idbOpen();
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch (e) { /* ignore */ }
  }

  function lsGet() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function lsSet(value) {
    try { localStorage.setItem(KEY, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  const Save = {
    data: defaults(),
    persisted: false,

    async init() {
      const a = lsGet();
      const b = await idbGet();
      // On garde la sauvegarde la plus récente des deux
      let best = a;
      if (b && (!a || (b.updatedAt || 0) > (a.updatedAt || 0))) best = b;
      this.data = sanitize(best);
      if (best) this.write(false);
      try {
        if (navigator.storage && navigator.storage.persist) {
          this.persisted = await navigator.storage.persisted();
          if (!this.persisted) this.persisted = await navigator.storage.persist();
        }
      } catch (e) { /* ignore */ }
      return this.data;
    },

    write(touch = true) {
      if (touch) this.data.updatedAt = Date.now();
      lsSet(this.data);
      idbSet(JSON.parse(JSON.stringify(this.data)));
    },

    exportCode() {
      const json = JSON.stringify(this.data);
      return 'AP1-' + btoa(unescape(encodeURIComponent(json)));
    },

    importCode(code) {
      code = (code || '').trim();
      if (code.startsWith('AP1-')) code = code.slice(4);
      const json = decodeURIComponent(escape(atob(code)));
      const obj = JSON.parse(json);
      if (!obj || typeof obj !== 'object' || !('xp' in obj)) throw new Error('Code invalide');
      this.data = sanitize(obj);
      this.write();
      return this.data;
    },

    reset() {
      const settings = this.data.settings;
      this.data = defaults();
      this.data.settings = settings;
      this.write();
    },
  };

  G.Save = Save;
})(window);
