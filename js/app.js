'use strict';
/* ---------- hendelser og oppstart ---------- */
$('#prev').setAttribute('aria-label', T.top.prev);
$('#next').setAttribute('aria-label', T.top.next);
$('#date').setAttribute('aria-label', T.top.pickDay);
$('#bottombar').setAttribute('aria-label', T.nav.label);
$('#tab-today').textContent = T.nav.today;
$('#tab-week').textContent = T.nav.week;
$('#fab').textContent = T.nav.add;
$('#fab').setAttribute('aria-label', T.nav.addAria);
$('#tab-log').textContent = T.nav.log;
$('#menu').textContent = T.nav.more;

$('#prev').addEventListener('click', () => go(-1));
$('#next').addEventListener('click', () => go(1));
$('#date').addEventListener('click', () => openCalendarSheet());
$('#tab-today').addEventListener('click', () => { if (view === todayISO()) scrollToNow(); else go(0); });
$('#tab-week').addEventListener('click', () => openWeekSheet());
$('#fab').addEventListener('click', () => openAddSheet());
$('#tab-log').addEventListener('click', () => openLogSheet(view));
$('#menu').addEventListener('click', openMenu);
/* Dagstripen: trykk går til bolken på det tidspunktet */
$('#strip').addEventListener('click', e => {
  const st = e.target.closest('.strip');
  if (!st) return;
  const r = st.getBoundingClientRect();
  const m = Number(st.dataset.a) + (e.clientX - r.left) / r.width * (Number(st.dataset.z) - Number(st.dataset.a));
  const blocks = blocksFor(view);
  let b = blocks[0];
  blocks.forEach(x => { if (toMin(x.start) <= m) b = x; });
  if (!b) return;
  expanded.add(b.id);
  renderTimeline();
  const el = document.querySelector('.blk[data-id="' + CSS.escape(b.id) + '"]');
  if (el) el.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
});
/* Toppen krymper når du blar ned, og kommer tilbake øverst */
(() => {
  let compact = false;
  const top = $('#top');
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!compact && y > 80) { compact = true; top.classList.add('compact'); }
    else if (compact && y < 12) { compact = false; top.classList.remove('compact'); }
  }, { passive: true });
})();
$('#nowbar').addEventListener('click', e => {
  const t = e.target.closest('[data-nb]');
  if (!t) return;
  if (t.dataset.nb === 'scroll') { scrollToNow(); return; }
  if (t.dataset.nb === 'act') { nowbarAction($('#nowbar')._act); return; }
  if (t.dataset.nb === 'start') {
    // To trykk: første gjør knappen klar, andre flytter dagen. Kan angres fra meldingen eller menyen.
    if (t.dataset.armed) { nowbarAction($('#nowbar')._start); return; }
    t.dataset.armed = '1'; t.textContent = T.nowbar.again; t.classList.add('armed');
    setTimeout(() => { if (t.isConnected) { delete t.dataset.armed; t.textContent = T.nowbar.start; t.classList.remove('armed'); } }, 3500);
  }
});

$('#timeline').addEventListener('click', e => {
  const qs = e.target.closest('[data-qshift]');
  if (qs) {
    const id = qs.closest('.blk').dataset.id;
    const b = blocksFor(view).find(x => x.id === id);
    if (!b) return;
    if (qs.dataset.qshift === 'now') startNow(id); else moveBlockBy(id, Number(qs.dataset.qshift));
    return;
  }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const a = el.dataset.act;
  const blk = el.closest('.blk');
  const kidsOf = () => el.dataset.kid === 'all' ? state.kids.map(k => k.id) : [el.dataset.kid];
  switch (a) {
    case 'expand': expanded.add(blk.dataset.id); renderTimeline(); break;
    case 'time': shiftOpen = shiftOpen === blk.dataset.id ? null : blk.dataset.id; renderTimeline(); break;
    case 'edit': openBlockSheet(blk.dataset.id); break;
    case 'new': openBlockSheet(null); break;
    case 'export': exportData(); break;
    case 'log': openLogSheet(view); break;
    case 'appt': openApptSheet(el.dataset.appt); break;
    case 'week': openWeekSheet(); break;
    case 'acts': openActivitiesSheet(); break;
    case 'report': shareReport(view); break;
    case 'health': openLogSheet(view); setTimeout(() => { const g = document.querySelector('#lg-health'); if (g) g.scrollIntoView({ block: 'start' }); }, 300); break;
    case 'dish': openSwapSheet(view, el.dataset.meal, null); break;
    case 'wife': commit(null, () => togglePartnerHome(view), 'timeline'); break;
    case 'pick': commit(null, () => setPick(view, blk.dataset.id, el.dataset.aid), 'timeline'); break;
    case 'unpick': commit(null, () => setPick(view, blk.dataset.id, null), 'timeline'); break;
    case 'more': openSuggestSheet(view, blk.dataset.id); break;
    case 'sync': pushNow().then(ok => toast(ok ? T.sync.saved : T.sync.failed)); break;
    case 'rate': commit(null, () => setRate(view, blk.dataset.id, el.dataset.kid, el.dataset.val), 'timeline'); break;
    case 'toggle-all': showAll = !showAll; renderTimeline(); break;
    case 'sleep-now': commit('', () => logSleepNow(view, blk.dataset.id, kidsOf())); break;
    case 'night-now': commit('', () => logNightNow(view, blk.dataset.id, kidsOf())); break;
    case 'wake-now': commit('', () => logWakeNow(view, kidsOf())); break;
    case 'sleep-edit': openNapSheet(view, blk.dataset.id, el.dataset.kid, null); break;
  }
});
$('#timeline').addEventListener('change', e => {
  const cb = e.target.closest('input[data-done]');
  if (!cb) return;
  const id = cb.dataset.done, on = cb.checked, date = view;
  commit(null, () => { const d = dayRec(date); if (on) d.done[id] = true; else delete d.done[id]; }, 'timeline');
});

function tick() {
  if (!state) return;
  refreshWeather();
  const t = todayISO();
  if (t !== lastToday) {
    if (view === lastToday) { view = t; expanded.clear(); }
    lastToday = t;
    render(); scrollToNow();
  } else if (view === t) render();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) flush();
  else { tick(); if (syncOn() && sync.cfg.dirty && Date.now() - Date.parse(sync.cfg.lastPush || 0) > PUSH_INTERVAL) pushNow(); }
});
window.addEventListener('pagehide', flush);
window.addEventListener('resize', renderHeader);
try { window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state && state.settings.theme === 'auto') { applyTheme(); render(); } }); } catch (e) {}

(async () => {
  await store.init();
  await loadSync();
  await loadWeatherCache();
  let saved = null;
  try { saved = await store.get(); } catch (e) {}
  let rescued = false;
  try { state = saved ? migrate(saved) : seed(); }
  catch (e) {
    // Lagrede data kunne ikke leses: ta vare på en kopi før appen starter på nytt
    if (saved) { await store.setKey('rescue', saved); rescued = true; }
    state = seed();
  }
  persist();
  if (rescued) setTimeout(() => toast(T.file.rescued), 800);
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist().catch(() => {}); } catch (e) {}
  applyTheme();
  render();
  scrollToNow();
  if (!state.meta.setupDone) setTimeout(() => openProfileSheet(true), 300);
  if (syncOn() && sync.cfg.dirty) setTimeout(pushNow, 3000);
  refreshWeather();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(renderHeader);
  setInterval(tick, 30000);
  try {
    if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window.self) {
      navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
    }
  } catch (e) {}
})();
