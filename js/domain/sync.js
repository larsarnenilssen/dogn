'use strict';
/* ---------- automatisk backup til et privat GitHub-repo (valgfritt) ----------
   Tilgangsnøkkelen lagres bare på telefonen (egen nøkkel i lageret),
   aldri i dataene som eksporteres. */
const PUSH_INTERVAL = 60 * 60 * 1000;
const sync = { cfg: null, timer: null, busy: false };
const syncOn = () => !!(sync.cfg && sync.cfg.token && sync.cfg.owner && sync.cfg.repo);
async function loadSync() {
  let c = null;
  try { c = await store.getKey('sync'); } catch (e) {}
  sync.cfg = c || null;
}
function saveSync() { store.setKey('sync', sync.cfg); }
function ghUrl() {
  const c = sync.cfg;
  return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + (c.path || 'dogn-backup.json').split('/').map(encodeURIComponent).join('/');
}
async function gh(method, url, body, accept) {
  const headers = { 'Authorization': 'Bearer ' + sync.cfg.token, 'Accept': accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  if (body) headers['Content-Type'] = 'application/json';
  return fetch('https://api.github.com' + url, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
}
const ghError = r => new UserError(T.sync.errors[r.status] || T.sync.errCode(r.status));
const netMessage = (e, text) => e instanceof TypeError ? text : (e instanceof UserError ? e.message : T.sync.unknown);
function b64enc(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
async function pushNow() {
  if (!syncOn() || sync.busy) return false;
  sync.busy = true;
  clearTimeout(sync.timer);
  let ok = false;
  try {
    let sha = null;
    const g = await gh('GET', ghUrl());
    if (g.ok) sha = (await g.json()).sha;
    else if (g.status !== 404) throw ghError(g);
    const body = { message: T.sync.commitMsg(new Date().toISOString().slice(0, 16).replace('T', ' ')), content: b64enc(JSON.stringify(state)) };
    if (sha) body.sha = sha;
    const p = await gh('PUT', ghUrl(), body);
    if (!p.ok) throw ghError(p);
    Object.assign(sync.cfg, { lastPush: new Date().toISOString(), lastError: '', dirty: false });
    ok = true;
  } catch (e) {
    sync.cfg.lastError = netMessage(e, T.sync.noContact);
  } finally {
    sync.busy = false;
    saveSync();
    if (sync.cfg && sync.cfg.dirty) scheduleSync();
    renderTimeline();
    if (sheetOpen() && reopen === openSyncSheet) openSyncSheet();
  }
  return ok;
}
function scheduleSync() {
  if (!syncOn() || !sync.cfg.dirty) return;
  const last = sync.cfg.lastPush ? Date.parse(sync.cfg.lastPush) : 0;
  const wait = Math.max(10000, last + PUSH_INTERVAL - Date.now());
  clearTimeout(sync.timer);
  sync.timer = setTimeout(pushNow, wait);
}
function markDirty() {
  if (!syncOn()) return;
  if (!sync.cfg.dirty) { sync.cfg.dirty = true; saveSync(); }
  scheduleSync();
}
async function connectSync(owner, repo, token, path) {
  sync.cfg = { owner, repo, token, path: path || 'dogn-backup.json', lastPush: '', lastError: '', dirty: true };
  const r = await gh('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo));
  if (!r.ok) { const e = ghError(r); sync.cfg = null; throw e; }
  const info = await r.json();
  saveSync();
  const ok = await pushNow();
  return { ok, isPublic: info.private === false };
}
function disconnectSync() { clearTimeout(sync.timer); sync.cfg = null; saveSync(); }
async function pullSync() {
  const r = await gh('GET', ghUrl(), null, 'application/vnd.github.raw+json');
  if (!r.ok) throw ghError(r);
  return migrate(JSON.parse(await r.text()));
}
