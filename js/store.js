'use strict';
/* ---------- lagring og endringer ----------
   Data ligger i IndexedDB, med localStorage som reserve.
   Alle endringer i data går gjennom commit(): den lagrer, merker for
   backup, tegner på nytt og gjør endringen mulig å angre. */
let state = null;

const store = {
  db: null, ok: true,
  async init() {
    try {
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('dogn', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    } catch (e) { this.db = null; }
  },
  async read(key, lsKey) {
    if (this.db) {
      try {
        const v = await new Promise((res, rej) => { const q = this.db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
        if (v) return JSON.parse(v);
      } catch (e) {}
    }
    try { const v = localStorage.getItem(lsKey); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  },
  get() { return this.read('state', 'dogn-state'); },
  getKey(key) { return this.read(key, 'dogn-' + key); },
  async setKey(key, obj) {
    const json = JSON.stringify(obj);
    if (this.db) { try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(json, key); } catch (e) {} }
    try { localStorage.setItem('dogn-' + key, json); } catch (e) {}
  },
  async set(obj) {
    const json = JSON.stringify(obj);
    let okAny = false;
    if (this.db) {
      try {
        await new Promise((res, rej) => {
          const t = this.db.transaction('kv', 'readwrite');
          t.objectStore('kv').put(json, 'state');
          t.oncomplete = res; t.onerror = () => rej(t.error);
        });
        okAny = true;
      } catch (e) {}
    }
    try { localStorage.setItem('dogn-state', json); okAny = true; } catch (e) {}
    if (okAny !== this.ok) { this.ok = okAny; renderTimeline(); }
  }
};

let saveTimer = null;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { store.set(state); markDirty(); }, 250); }
function flush() { clearTimeout(saveTimer); if (state) store.set(state); }

/* ---------- angre ----------
   Hvert angresteg husker bare de delene av dataene som ble endret
   (for dager: bare de dagene som ble endret), ikke hele tilstanden. */
const UNDO_MAX = 15;
const undoStack = [];
function snapParts(s) {
  const m = new Map();
  for (const k of Object.keys(s)) {
    if (k === 'days') for (const d of Object.keys(s.days)) m.set('days/' + d, JSON.stringify(s.days[d]));
    else m.set(k, JSON.stringify(s[k]));
  }
  return m;
}
function diffParts(before, after) {
  const out = [];
  for (const [k, v] of before) if (after.get(k) !== v) out.push([k, v]);
  for (const k of after.keys()) if (!before.has(k)) out.push([k, undefined]);
  return out;
}
function restoreParts(parts) {
  for (const [k, v] of parts) {
    const [top, day] = k.split('/');
    if (day) { if (v === undefined) delete state.days[day]; else state.days[day] = JSON.parse(v); }
    else if (v === undefined) delete state[top]; else state[top] = JSON.parse(v);
  }
}

/* Den ene veien for endringer i data.
   label: tekst i meldingen. En streng (også tom) gjør endringen mulig å angre;
          fn kan returnere en bedre tekst. null betyr en stille endring uten angre.
   redraw: 'all' (standard), 'timeline' eller 'none'. */
function commit(label, fn, redraw = 'all') {
  const before = label !== null ? snapParts(state) : null;
  const r = fn();
  if (typeof r === 'string' && r) label = r;
  let undoable = false;
  if (before) {
    const parts = diffParts(before, snapParts(state));
    if (parts.length) {
      undoStack.push({ parts, label });
      if (undoStack.length > UNDO_MAX) undoStack.shift();
      undoable = true;
    }
  }
  persist();
  if (redraw === 'all') render(); else if (redraw === 'timeline') renderTimeline();
  if (label) toast(label, undoable);
}
function undoLast() {
  const u = undoStack.pop();
  if (!u) return;
  restoreParts(u.parts);
  persist();
  applyTheme();
  render();
  if (sheetOpen() && reopen) reopen();
  toast(T.common.undone(u.label));
}
