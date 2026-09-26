'use strict';
/* ---------- datastruktur, oppgradering og kontroll av innlest data ----------
   DATA_VERSION økes når strukturen endres. migrate() løfter gamle data trinn
   for trinn, og sanitize() retter eller fjerner verdier som ikke har riktig
   form (for eksempel fra en fil som er redigert for hånd). Gyldige data
   endres ikke. */
const DATA_VERSION = 7;
const TYPE_KEYS = Object.keys(T.types);
const ROLE_KEYS = Object.keys(T.roles);

/* Feil med en melding som kan vises til brukeren */
class UserError extends Error {}

function migrate(s) {
  if (!s || typeof s !== 'object' || !s.templates || typeof s.templates !== 'object') throw new UserError(T.file.notBackup);
  const base = seed();
  s.version = Number(s.version) || 1;
  if (s.version > DATA_VERSION) throw new UserError(T.file.tooNew);
  s.leave = s.leave || base.leave;
  s.schedule = Array.isArray(s.schedule) && s.schedule.length ? s.schedule : [{ from: s.leave.start, templateId: Object.keys(s.templates)[0] }];
  s.tasks = Array.isArray(s.tasks) ? s.tasks : [];
  s.days = s.days && typeof s.days === 'object' ? s.days : {};
  s.meta = Object.assign({ created: todayISO(), lastExport: null }, s.meta || {});
  if (s.version < 2) {
    // v2: middagsbank, ukemeny og logg. Måltidsrubrikkene kobles til banken,
    // og det faste punktet «Forberede voksenmiddag» erstattes av rettens egen forberedelse.
    const fix = blocks => blocks.forEach(b => {
      if (b.link === undefined) b.link = b.slot === 'kvelds' ? 'dinner' : b.slot === 'lunsj' ? 'lunch' : '';
      b.items = (b.items || []).filter(it => it.text !== 'Forberede voksenmiddag');
    });
    Object.values(s.templates).forEach(t => fix(t.blocks || []));
    Object.values(s.days).forEach(d => { if (d && d.blocks) fix(d.blocks); });
    s.version = 2;
  }
  s.kids = Array.isArray(s.kids) && s.kids.length ? s.kids : base.kids;
  s.dishes = Array.isArray(s.dishes) ? s.dishes : base.dishes;
  s.menu = s.menu || {};
  s.menuWeeks = s.menuWeeks || {};
  s.settings = Object.assign({ fishPerWeek: 2 }, s.settings || {});
  if (s.version < 3) {
    // v3: generisk app. Data fra før v3 er satt opp for Nesttun og er ferdig oppsatt.
    if (s.place === undefined) s.place = { name: 'Nesttun', lat: 60.3197, lon: 5.3536 };
    s.meta.setupDone = true;
    s.version = 3;
  }
  if (s.place === undefined) s.place = null;
  s.partner = Object.assign(defaultPartner(), s.partner || {});
  s.partner.codes = s.partner.codes || {};
  s.partner.shifts = s.partner.shifts || {};
  if (s.meta.setupDone === undefined) s.meta.setupDone = true;
  if (s.version < 4) { if (!Array.isArray(s.activities)) s.activities = seedActivities(); s.version = 4; }
  if (!Array.isArray(s.activities)) s.activities = seedActivities();
  if (!Array.isArray(s.appts)) s.appts = [];
  if (s.version < 5) {
    // v5: felleskjønn (-en) i stedet for a-endelser i tekster som kom med startdataene.
    const fixes = [['La suppa ', 'La suppen '], ['i stua', 'i stuen'], ['skoleruta', 'skoleruten'], ['på vogna', 'på vognen'], ['i uka', 'i uken'], ['utover uka', 'utover uken']];
    const fx = t => typeof t === 'string' ? fixes.reduce((a, [f, r]) => a.split(f).join(r), t) : t;
    (s.dishes || []).forEach(d => ['name', 'kids', 'prep', 'dayBefore'].forEach(k => { d[k] = fx(d[k]); }));
    (s.activities || []).forEach(a => ['name', 'note', 'where'].forEach(k => { a[k] = fx(a[k]); }));
    (s.tasks || []).forEach(t => { t.text = fx(t.text); });
    Object.values(s.templates).forEach(t => (t.blocks || []).forEach(b => { b.title = fx(b.title); b.note = fx(b.note); (b.items || []).forEach(it => { it.text = fx(it.text); }); }));
    if (s.settings && Array.isArray(s.settings.packList)) s.settings.packList = s.settings.packList.map(fx);
    if (s.partner && s.partner.name === 'Kona') s.partner.name = 'Konen';
    s.version = 5;
  }
  if (s.version < 6) {
    // v6: ingredienser på rettene fra startdataene, handleliste, tema og tekststørrelse.
    (s.dishes || []).forEach(d => { if (!Array.isArray(d.ingredients)) d.ingredients = (SEED_INGREDIENTS[d.id] || []).slice(); });
    (s.activities || []).forEach(a => { if (a.id === 'a-besok') a.sickOk = false; });
    s.version = 6;
  }
  if (s.version < 7) {
    // v7: roller i stedet for faste navn på bolkene (legging og nullstilling),
    // og samlebetegnelse for barna. Tidligere sto det alltid «guttene».
    const setRoles = blocks => blocks.forEach(b => { if (b && !b.role) b.role = b.slot === 'kveld' ? 'reset' : b.slot === 'legging' ? 'bedtime' : ''; });
    Object.values(s.templates).forEach(t => setRoles((t && t.blocks) || []));
    Object.values(s.days).forEach(d => { if (d && Array.isArray(d.blocks)) setRoles(d.blocks); });
    if (!s.settings.kidsWord) s.settings.kidsWord = 'guttene';
    s.version = 7;
  }
  (s.dishes || []).forEach(d => { if (d && !Array.isArray(d.ingredients)) d.ingredients = []; });
  s.shop = Object.assign({ checked: {}, extra: [], pantry: DEFAULT_PANTRY.slice() }, s.shop || {});
  if (!s.settings.theme) s.settings.theme = 'dark';
  if (!s.settings.textSize) s.settings.textSize = 1;
  if (!s.settings.kidsWord) s.settings.kidsWord = T.kids.word;
  s.settings.show = Object.assign({ nowbar: true, tomorrow: true, gear: true }, s.settings.show || {});
  if (!Array.isArray(s.settings.packList)) s.settings.packList = DEFAULT_PACK.slice();
  sanitize(s, base);
  // Rydd bort huskepunkter som ble krysset av for mer enn 30 dager siden
  s.tasks = s.tasks.filter(t => t.rule.kind !== 'once' || !Object.keys(s.days).some(d => s.days[d].done[t.id] && d < addDays(todayISO(), -30)));
  // (Fremtidige oppgraderinger: if (s.version < 8) { … ; s.version = 8; })
  return s;
}

/* Retter verdier med feil form, slik at resten av appen kan stole på dataene.
   Ukjente felt beholdes. Tekst blir alltid tekst, tider HH:MM, datoer ÅÅÅÅ-MM-DD
   og lenker http(s). */
function sanitize(s, base) {
  const obj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const str = v => typeof v === 'string' ? v : v == null ? '' : String(v);
  const arr = v => Array.isArray(v) ? v : [];
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const oneOf = (v, list, d) => list.includes(v) ? v : d;
  const optTime = v => isTime(v) ? v : '';
  const ids = (list, prefix) => list.forEach(x => { x.id = str(x.id) || prefix + uid(); });
  const wdays = v => arr(v).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7);
  const cleanObj = (o, keep) => { for (const k of Object.keys(o)) if (!keep(k, o[k])) delete o[k]; return o; };

  if (!obj(s.leave) || !isDate(s.leave.start) || !isDate(s.leave.end)) s.leave = base.leave;
  s.kids = arr(s.kids).filter(obj);
  ids(s.kids, 'b-');
  s.kids.forEach(k => { k.name = str(k.name); });
  if (!s.kids.length) s.kids = base.kids;
  if (!obj(s.place) || !Number.isFinite(s.place.lat) || !Number.isFinite(s.place.lon)) s.place = null;
  else s.place.name = str(s.place.name);

  const cleanBlocks = list => {
    list = arr(list).filter(obj);
    ids(list, 'b-');
    list.forEach(b => {
      b.slot = str(b.slot) || b.id;
      b.type = oneOf(b.type, TYPE_KEYS, 'awake');
      b.start = isTime(b.start) ? b.start : '12:00';
      b.title = str(b.title);
      b.items = arr(b.items).filter(obj);
      ids(b.items, 'i-');
      b.items.forEach(it => { it.text = str(it.text); });
      b.boys = str(b.boys); b.adults = str(b.adults); b.note = str(b.note);
      b.link = oneOf(b.link, ['', 'dinner', 'lunch'], '');
      b.role = oneOf(b.role, ROLE_KEYS, '');
    });
    return list;
  };
  cleanObj(s.templates, (k, t) => obj(t));
  for (const [k, t] of Object.entries(s.templates)) { t.id = k; t.name = str(t.name) || k; t.blocks = cleanBlocks(t.blocks); }
  if (!Object.keys(s.templates).length) s.templates = base.templates;
  const firstTpl = Object.keys(s.templates)[0];
  s.schedule = arr(s.schedule).filter(x => obj(x) && isDate(x.from) && typeof x.templateId === 'string' && s.templates[x.templateId]);
  if (!s.schedule.length) s.schedule = [{ from: s.leave.start, templateId: firstTpl }];

  s.tasks = arr(s.tasks).filter(obj);
  ids(s.tasks, 't-');
  s.tasks.forEach(t => {
    t.text = str(t.text); t.slot = str(t.slot); t.type = oneOf(t.type, TYPE_KEYS, 'sleep');
    if (!obj(t.rule)) t.rule = { kind: 'daily' };
    const r = t.rule;
    r.kind = oneOf(r.kind, ['once', 'daily', 'interval', 'weekdays'], 'daily');
    if (r.every != null) r.every = Math.round(num(r.every, 7, 1, 365));
    if (r.start != null && !isDate(r.start)) delete r.start;
    if (r.days != null) r.days = wdays(r.days);
  });

  s.dishes = arr(s.dishes).filter(obj);
  ids(s.dishes, 'd-');
  s.dishes.forEach(d => {
    d.name = str(d.name); d.meal = oneOf(d.meal, ['dinner', 'lunch'], 'dinner');
    d.minutes = num(d.minutes, 30, 1, 600); d.cat = oneOf(d.cat, Object.keys(T.cats), 'annet');
    d.weekday = Math.round(num(d.weekday, 0, 0, 7));
    d.kids = str(d.kids); d.prep = str(d.prep); d.dayBefore = str(d.dayBefore);
    d.ingredients = arr(d.ingredients).map(str).filter(Boolean);
  });

  s.activities = arr(s.activities).filter(obj);
  ids(s.activities, 'a-');
  s.activities.forEach(a => {
    a.name = str(a.name); a.kind = oneOf(a.kind, ['inne', 'ute'], 'inne'); a.minutes = num(a.minutes, 30, 1, 600);
    a.weather = oneOf(a.weather, ['any', 'dry'], 'any'); a.travel = oneOf(a.travel, Object.keys(T.travel), 'hjemme');
    a.where = str(a.where); a.note = str(a.note); a.url = safeUrl(a.url);
    a.days = wdays(a.days); a.from = optTime(a.from); a.to = optTime(a.to);
    if (a.sickOk != null && a.sickOk !== false) delete a.sickOk;
  });

  if (!obj(s.menu)) s.menu = {};
  cleanObj(s.menu, (d, m) => isDate(d) && obj(m));
  for (const m of Object.values(s.menu)) {
    cleanObj(m, (k, v) => ['dinner', 'lunch'].includes(k) && obj(v));
    for (const v of Object.values(m)) { v.dish = typeof v.dish === 'string' ? v.dish : null; v.manual = !!v.manual; }
  }
  if (!obj(s.menuWeeks)) s.menuWeeks = {};

  const P = s.partner;
  P.enabled = !!P.enabled; P.name = str(P.name) || T.partner.defaultName; P.commute = num(P.commute, 0, 0, 600);
  if (!obj(P.codes)) P.codes = {};
  cleanObj(P.codes, (c, d) => obj(d));
  for (const d of Object.values(P.codes)) { d.label = str(d.label); d.kind = oneOf(d.kind, ['work', 'night', 'off'], 'work'); d.start = optTime(d.start); d.end = optTime(d.end); }
  if (!obj(P.shifts)) P.shifts = {};
  cleanObj(P.shifts, (d, c) => isDate(d) && typeof c === 'string' && c);

  s.appts = arr(s.appts).filter(a => obj(a) && isDate(a.date) && isTime(a.start));
  ids(s.appts, 'ap-');
  s.appts.forEach(a => { a.title = str(a.title); a.minutes = num(a.minutes, 0, 0, 1440); a.where = str(a.where); a.note = str(a.note); });

  const S = s.settings;
  S.fishPerWeek = Math.round(num(S.fishPerWeek, 2, 0, 7));
  S.theme = oneOf(S.theme, ['dark', 'light', 'auto'], 'dark');
  S.textSize = oneOf(Number(S.textSize), [1, 1.1, 1.2], 1);
  S.packList = arr(S.packList).map(str).filter(Boolean);
  if (!obj(S.show)) S.show = {};
  for (const k of Object.keys(S.show)) S.show[k] = S.show[k] !== false;
  S.kidsWord = str(S.kidsWord).trim() || T.kids.word;

  if (!obj(s.shop.checked)) s.shop.checked = {};
  s.shop.extra = arr(s.shop.extra).filter(obj);
  ids(s.shop.extra, '');
  s.shop.extra.forEach(x => { x.text = str(x.text); });
  s.shop.pantry = arr(s.shop.pantry).map(str).filter(Boolean);

  cleanObj(s.days, (d, rec) => isDate(d) && obj(rec));
  for (const d of Object.values(s.days)) {
    if (!obj(d.done)) d.done = {};
    if ('blocks' in d) { if (Array.isArray(d.blocks)) d.blocks = cleanBlocks(d.blocks); else delete d.blocks; }
    if ('templateId' in d && typeof d.templateId !== 'string') delete d.templateId;
    if ('picks' in d) { if (obj(d.picks)) cleanObj(d.picks, (k, v) => typeof v === 'string'); else delete d.picks; }
    if ('wife' in d && typeof d.wife !== 'boolean') delete d.wife;
    if ('log' in d) {
      if (!obj(d.log)) { delete d.log; continue; }
      const L = d.log;
      L.sleep = arr(L.sleep).filter(obj);
      ids(L.sleep, 's-');
      L.sleep.forEach(e => { e.kid = str(e.kid); e.blockId = str(e.blockId); e.start = optTime(e.start); e.end = optTime(e.end); });
      if (!obj(L.night)) L.night = {};
      cleanObj(L.night, (k, n) => obj(n));
      for (const n of Object.values(L.night)) { if ('asleep' in n) n.asleep = optTime(n.asleep); if ('wake' in n) n.wake = optTime(n.wake); }
      if (!obj(L.meals)) L.meals = {};
      cleanObj(L.meals, (k, r) => obj(r));
      for (const r of Object.values(L.meals)) cleanObj(r, (k, v) => Object.keys(T.rates).includes(v));
      L.note = str(L.note);
      if ('health' in L) {
        L.health = arr(L.health).filter(x => obj(x) && isTime(x.time));
        ids(L.health, 'h-');
        L.health.forEach(x => { x.kid = str(x.kid); x.kind = oneOf(x.kind, Object.keys(T.health), 'other'); x.value = str(x.value); });
      }
      if ('sick' in L && !obj(L.sick)) L.sick = {};
    }
  }

  if (!isDate(s.meta.created)) s.meta.created = todayISO();
  if (s.meta.lastExport != null && !isDate(s.meta.lastExport)) s.meta.lastExport = null;
  s.meta.setupDone = !!s.meta.setupDone;
  return s;
}
