'use strict';
/* ---------- automatisk backup og deling via et privat GitHub-repo (valgfritt) ----------
   Filene i repoet (se docs/deling.md):
     dogn-backup.json – alle dataene (backup), høyst én gang i timen
     dogn-deling.json – dagen hjemme, til Takt (partnerens app), høyst hvert femte minutt
     takt-deling.json – turnus, fravær og delte punkter fra Takt, hentes hit
   Deling er på som standard og kan slås av under Meny › Backup.
   Tilgangsnøkkelen lagres bare på telefonen (egen nøkkel i lageret),
   aldri i dataene som eksporteres. */
const PUSH_INTERVAL = 60 * 60 * 1000;
const SHARE_INTERVAL = 5 * 60 * 1000;   // dagen hjemme sendes høyst så ofte …
const SHARE_SOON = 20 * 1000;           // … men raskt når barna sovner eller våkner
const TAKT_INTERVAL = 30 * 60 * 1000;   // Takt hentes så ofte mens appen er åpen
const SHARE_PATH = 'dogn-deling.json', TAKT_PATH = 'takt-deling.json';
const sync = { cfg: null, timer: null, shareTimer: null, busy: false };
const syncOn = () => !!(sync.cfg && sync.cfg.token && sync.cfg.owner && sync.cfg.repo);
const shareOn = () => syncOn() && sync.cfg.share !== false;
const taktOn = () => syncOn() && sync.cfg.takt !== false;
async function loadSync() {
  let c = null;
  try { c = await store.getKey('sync'); } catch (e) {}
  sync.cfg = c || null;
}
function saveSync() { store.setKey('sync', sync.cfg); }
function ghUrl(path) {
  const c = sync.cfg;
  return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo) + '/contents/' + (path || c.path || 'dogn-backup.json').split('/').map(encodeURIComponent).join('/');
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
/* Lagrer en fil i repoet (ny eller erstattet) */
async function putFile(path, text, message) {
  let sha = null;
  const g = await gh('GET', ghUrl(path));
  if (g.ok) sha = (await g.json()).sha;
  else if (g.status !== 404) throw ghError(g);
  const body = { message, content: b64enc(text) };
  if (sha) body.sha = sha;
  const p = await gh('PUT', ghUrl(path), body);
  if (!p.ok) throw ghError(p);
}
/* Én jobb mot GitHub om gangen. Feil lagres og vises under Meny › Backup. */
async function runSync(job) {
  if (!syncOn()) return false;
  if (sync.busy) { setTimeout(scheduleSync, 5000); return false; }   // prøver igjen når forrige jobb er ferdig
  sync.busy = true;
  let ok = false;
  try { await job(); sync.cfg.lastError = ''; ok = true; }
  catch (e) { sync.cfg.lastError = netMessage(e, T.sync.noContact); }
  finally {
    sync.busy = false;
    saveSync();
    scheduleSync();
    renderTimeline();
    if (sheetOpen() && reopen === openSyncSheet) openSyncSheet();
  }
  return ok;
}
const pushNow = () => runSync(async () => {
  await putFile(sync.cfg.path, JSON.stringify(state), T.sync.commitMsg(new Date().toISOString().slice(0, 16).replace('T', ' ')));
  Object.assign(sync.cfg, { lastPush: new Date().toISOString(), dirty: false });
});
const pushShare = () => runSync(async () => {
  await putFile(SHARE_PATH, JSON.stringify(shareFile(), null, 1), T.takt.commitMsg);
  Object.assign(sync.cfg, { lastShare: new Date().toISOString(), shareDirty: false, shareSoon: false });
});
const pullTakt = () => runSync(async () => {
  const r = await gh('GET', ghUrl(TAKT_PATH), null, 'application/vnd.github.raw+json');
  sync.cfg.lastTakt = new Date().toISOString();
  if (r.status === 404) return;             // Takt er ikke tatt i bruk ennå
  if (!r.ok) throw ghError(r);
  applyTakt(JSON.parse(await r.text()));
});
/* Planlegger neste backup og deling ut fra når de sist ble gjort */
function scheduleSync() {
  if (!syncOn()) return;
  const c = sync.cfg;
  clearTimeout(sync.timer); clearTimeout(sync.shareTimer);
  if (c.dirty) sync.timer = setTimeout(pushNow, Math.max(10000, Date.parse(c.lastPush || 0) + PUSH_INTERVAL - Date.now()));
  if (shareOn() && c.shareDirty) sync.shareTimer = setTimeout(pushShare, Math.max(c.shareSoon ? SHARE_SOON : 10000, Date.parse(c.lastShare || 0) + (c.shareSoon ? 0 : SHARE_INTERVAL) - Date.now()));
}
function markDirty() {
  if (!syncOn()) return;
  const c = sync.cfg;
  if (!c.dirty || (shareOn() && !c.shareDirty)) { c.dirty = true; if (shareOn()) c.shareDirty = true; saveSync(); }
  scheduleSync();
}
/* Barna sovnet eller våknet: dagen hjemme sendes om et øyeblikk */
function shareSoon() {
  if (!shareOn()) return;
  Object.assign(sync.cfg, { shareDirty: true, shareSoon: true });
  saveSync();
  scheduleSync();
}
function maybePullTakt() { if (taktOn() && !sync.busy && Date.now() - Date.parse(sync.cfg.lastTakt || 0) > TAKT_INTERVAL) pullTakt(); }
async function connectSync(owner, repo, token, path) {
  sync.cfg = { owner, repo, token, path: path || 'dogn-backup.json', lastPush: '', lastError: '', dirty: true, share: true, takt: true, shareDirty: true };
  const r = await gh('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo));
  if (!r.ok) { const e = ghError(r); sync.cfg = null; throw e; }
  const info = await r.json();
  saveSync();
  const ok = await pushNow();
  await pushShare();
  await pullTakt();
  return { ok, isPublic: info.private === false };
}
function disconnectSync() { clearTimeout(sync.timer); clearTimeout(sync.shareTimer); sync.cfg = null; saveSync(); }
async function pullSync() {
  const r = await gh('GET', ghUrl(), null, 'application/vnd.github.raw+json');
  if (!r.ok) throw ghError(r);
  return migrate(JSON.parse(await r.text()));
}
