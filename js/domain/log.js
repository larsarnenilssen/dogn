'use strict';
/* ---------- logg: søvn, måltider, helse og dagsrapport ---------- */
const RATES = ['', 'godt', 'middels', 'lite'];
const MAX_AUTO_SHIFT = 180;   // større avvik enn 3 timer antas å være feiltrykk

function napEntry(date, kid, blockId) { return getLog(date).sleep.find(e => e.kid === kid && e.blockId === blockId); }
function napTotal(date, kid) {
  return getLog(date).sleep.filter(e => e.kid === kid && e.start && e.end)
    .reduce((s, e) => s + Math.max(0, toMin(e.end) - toMin(e.start)), 0);
}
function shiftNote(oldMin, b) {
  const delta = toMin(b.start) - oldMin;
  return delta ? T.sleep.shiftNote(b.title || T.sleep.nextBlock, b.start, delta) : '';
}
const whoText = kids => kids.length > 1 ? groupWord() : kidName(kids[0]);
/* Flytter en bolk til nå (hvis avviket er rimelig) og legger til en kort melding */
function startBlockAt(blockId, now) {
  const b = blocksFor(view).find(x => x.id === blockId);
  if (!b) return '';
  const old = toMin(b.start), delta = now - old;
  if (!delta || Math.abs(delta) > MAX_AUTO_SHIFT) return '';
  const r = moveBlock(blockId, now);
  return r ? shiftNote(old, r.block) + (r.kind === 'fit' && r.end ? T.fit.rest(r.end) : '') : '';
}

/* Søvnklokken for lurer. Første «sovnet» starter luren nå. Når siste barn våkner,
   starter neste bolk nå. Resten av dagen tilpasses fram til leggetid, som står. */
function logSleepNow(date, blockId, kids) {
  const L = logRec(date), now = nowMin(), t = toHM(now);
  const had = L.sleep.some(x => x.blockId === blockId);
  let ended = false, woke = null;
  kids.forEach(kid => {
    const e = L.sleep.find(x => x.kid === kid && x.blockId === blockId);
    if (!e) { L.sleep.push({ id: 's-' + uid(), kid, blockId, start: t, end: '' }); if (woke === null) woke = false; }
    else if (!e.end) { e.end = t; ended = true; if (woke === null) woke = true; }
  });
  let msg = woke ? T.sleep.wokeUp(whoText(kids), t) : T.sleep.fellAsleep(whoText(kids), t);
  const blocks = blocksFor(date);
  const i = blocks.findIndex(b => b.id === blockId);
  if (i < 0) return msg;
  if (!had) msg += startBlockAt(blockId, now);
  else if (ended) {
    const entries = L.sleep.filter(x => x.blockId === blockId);
    const allAwake = state.kids.every(k => entries.some(x => x.kid === k.id && x.end));
    const next = blocks[i + 1];
    if (allAwake && next) msg += startBlockAt(next.id, now);
  }
  return msg;
}
/* Morgen: når siste barn har våknet, starter dagen (morgenbolken) nå,
   og resten av dagen tilpasses fram til leggetid. Våknetiden føres på natten før. */
const wakeLogDate = date => addDays(date, -1);
/* Natten lagres på datoen for kvelden den starter. Den vises på dagen den slutter. */
function nightRec(nightDate, kid) { return getLog(nightDate).night[kid] || {}; }
/* Oppvåkninger: antall (wakes) og minutter våken i alt (up). upAt er en oppvåkning som pågår. */
const MAX_WAKES = 30, MAX_UP = 720;
const toCount = (v, max) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(max, Math.max(0, x)) : 0; };
function setNight(nightDate, kid, f) {
  const n = (logRec(nightDate).night[kid] ??= {});
  if ('asleep' in f) n.asleep = isTime(f.asleep) ? f.asleep : '';
  if ('wake' in f) { n.wake = isTime(f.wake) ? f.wake : ''; if (n.wake) delete n.upAt; }
  for (const [k, max] of [['wakes', MAX_WAKES], ['up', MAX_UP]]) {
    if (!(k in f)) continue;
    const v = toCount(f[k], max);
    if (v) n[k] = v; else delete n[k];
  }
}
/* Nattesøvn: fra sovnet til våknet, minus tiden våken i natt */
function nightLen(n) {
  if (!n || !isTime(n.asleep) || !isTime(n.wake)) return null;
  const span = (toMin(n.wake) - toMin(n.asleep) + 1440) % 1440;
  if (!span) return null;
  return { span, net: Math.max(0, span - (n.up || 0)), wakes: n.wakes || 0, up: n.up || 0 };
}
const nightEnding = (date, kid) => nightRec(addDays(date, -1), kid);
const kidIds = () => state.kids.map(k => k.id);
/* Oppvåkninger som pågår: i kveld, eller natten til i dag fram til midt på dagen */
function openWakes(date, now) {
  const tries = [date];
  if (now < 12 * 60) tries.push(addDays(date, -1));
  for (const nd of tries) {
    const N = getLog(nd).night;
    const kids = kidIds().filter(k => N[k] && N[k].upAt && !N[k].wake);
    if (kids.length) return { nightDate: nd, kids };
  }
  return null;
}
/* Natten som pågår: etter leggetid i kveld, eller før morgenbolken når natten til i dag ikke er avsluttet */
function nightNow(date, blocks, now) {
  if (date !== todayISO()) return null;
  const sleeping = nd => { const N = getLog(nd).night; return kidIds().filter(k => N[k] && N[k].asleep && !N[k].wake && !N[k].upAt); };
  const nb = nightBlock(blocks);
  if (nb && now >= toMin(nb.start)) { const kids = sleeping(date); if (kids.length) return { nightDate: date, kids }; }
  const wb = wakeBlock(blocks) || blocks[0];
  if (!wb || now < toMin(wb.start)) { const nd = addDays(date, -1), kids = sleeping(nd); if (kids.length && now < 12 * 60) return { nightDate: nd, kids }; }
  return null;
}
function logNightWakeNow(nightDate, kids) {
  const t = toHM(nowMin()), N = logRec(nightDate).night;
  kids.forEach(k => { const n = (N[k] ??= {}); if (!n.upAt) n.upAt = t; });
  return T.night.upToast(whoText(kids), t);
}
function logBackAsleepNow(nightDate, kids) {
  const now = nowMin(), N = logRec(nightDate).night;
  let longest = 0;
  kids.forEach(k => {
    const n = N[k];
    if (!n || !n.upAt) return;
    const d = (now - toMin(n.upAt) + 1440) % 1440;
    n.wakes = toCount((n.wakes || 0) + 1, MAX_WAKES);
    n.up = toCount((n.up || 0) + d, MAX_UP);
    delete n.upAt;
    longest = Math.max(longest, d);
  });
  return T.night.backToast(whoText(kids), toHM(now), fmtDurShort(longest));
}
const dayMonth = d => { const x = parseISO(d); return x.getDate() + '.' + (x.getMonth() + 1); };
const whenAsleep = nightDate => { const t = todayISO(); return nightDate === t ? T.night.tonight : nightDate === addDays(t, -1) ? T.night.yesterday : T.night.evening(dayMonth(nightDate)); };
const whenWoke = nightDate => { const d = addDays(nightDate, 1), t = todayISO(); return d === t ? T.night.today : d === addDays(t, 1) ? T.night.tomorrow : dayMonth(d); };
function wokeAt(date, kid) { const n = getLog(wakeLogDate(date)).night[kid]; return (n && n.wake) || ''; }
/* En lur som pågår (sovnet er logget, våknet ikke), for i dag */
function openNap(date) {
  const open = getLog(date).sleep.filter(e => e.start && !e.end);
  if (!open.length) return null;
  const blockId = open[open.length - 1].blockId;
  return { blockId, kids: open.filter(e => e.blockId === blockId).map(e => e.kid) };
}
/* Morgenen er åpen for «våknet» fra litt før planlagt start til første lur, så lenge ikke alle er logget */
function morningOpen(date, blocks, now) {
  if (date !== todayISO()) return false;
  const wb = wakeBlock(blocks);
  if (!wb || now < toMin(wb.start) - 90) return false;
  const nap = blocks.find(b => b.type === 'sleep' && toMin(b.start) > toMin(wb.start));
  if (nap && (now >= toMin(nap.start) || getLog(date).sleep.length)) return false;
  return state.kids.some(k => !wokeAt(date, k.id));
}
function logWakeNow(date, kids) {
  const L = logRec(wakeLogDate(date)), now = nowMin(), t = toHM(now);
  const allBefore = state.kids.every(k => wokeAt(date, k.id));
  kids.forEach(kid => { const n = (L.night[kid] ??= {}); n.wake = n.upAt || t; delete n.upAt; });
  let msg = T.sleep.wokeUp(whoText(kids), t);
  const allNow = state.kids.every(k => wokeAt(date, k.id));
  const wb = wakeBlock(blocksFor(date));
  if (!allBefore && allNow && wb) msg += startBlockAt(wb.id, now);
  return msg;
}
/* Nattesøvn: når siste barn har sovnet, starter nullstillingen nå, men aldri før
   leggetid. Leggetiden endres ikke. */
function logNightNow(date, blockId, kids) {
  const L = logRec(date), now = nowMin(), t = toHM(now);
  const allBefore = state.kids.every(k => L.night[k.id] && L.night[k.id].asleep);
  kids.forEach(kid => { (L.night[kid] ??= {}).asleep = t; });
  let msg = T.sleep.fellAsleep(whoText(kids), t);
  const allNow = state.kids.every(k => L.night[k.id] && L.night[k.id].asleep);
  const blocks = blocksFor(date);
  const i = blocks.findIndex(b => b.id === blockId);
  const next = blocks[i + 1];
  if (!allBefore && allNow && next) msg += startBlockAt(next.id, Math.max(now, toMin(blocks[i].start) + MIN_BLOCK));
  return msg;
}
function lastWake(date) {
  let w = null;
  getLog(date).sleep.forEach(e => { if (e.end && (!w || e.end > w)) w = e.end; });
  if (!w) {
    const N = getLog(addDays(date, -1)).night;
    Object.values(N).forEach(n => { if (n && n.wake && (!w || n.wake > w)) w = n.wake; });
  }
  return w;
}
/* Hvor godt et barn spiste: godt, middels eller lite. Samme valg igjen fjerner det. */
function setRate(date, blockId, kid, val) {
  const L = logRec(date);
  const r = (L.meals[blockId] ??= {});
  if (r[kid] === val || !RATES.includes(val) || !val) delete r[kid]; else r[kid] = val;
}

/* ---------- helse og sykdom ---------- */
const sickKids = date => { const L = getLog(date); return state.kids.filter(k => L.sick && L.sick[k.id]); };
function lastHealth(kind, date) {
  const L = getLog(date);
  return (L.health || []).filter(h => h.kind === kind).sort((a, b) => b.time.localeCompare(a.time))[0] || null;
}
function addHealth(date, h) {
  const L = logRec(date);
  (L.health ??= []).push(h);
  if (h.kind === 'temp' || h.kind === 'med' || h.kind === 'sym') (L.sick ??= {})[h.kid] = true;
}
function toggleSick(date, kid) {
  const L = logRec(date);
  L.sick ??= {};
  if (L.sick[kid]) delete L.sick[kid]; else L.sick[kid] = true;
}

/* ---------- søvnanalyse ---------- */
function sleepStats(kid, days) {
  const naps = [], counts = [], firstWin = [], beds = [], nights = [], wakes = [], ups = [], woke = [];
  days.forEach(d => {
    const L = getLog(d);
    const list = L.sleep.filter(e => e.kid === kid && e.start && e.end).sort((a, b) => a.start.localeCompare(b.start));
    if (list.length) { naps.push(list.reduce((s, e) => s + toMin(e.end) - toMin(e.start), 0)); counts.push(list.length); }
    const prevN = getLog(addDays(d, -1)).night[kid];
    if (list.length && prevN && prevN.wake) firstWin.push(toMin(list[0].start) - toMin(prevN.wake));
    const len = nightLen(prevN);
    if (len) { nights.push(len.net); wakes.push(len.wakes); ups.push(len.up); woke.push(toMin(prevN.wake)); }
    const n = L.night[kid];
    if (n && n.asleep) beds.push(toMin(n.asleep));
  });
  const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
  const avg1 = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length * 10) / 10 : null;
  return { nap: avg(naps), count: avg1(counts), first: avg(firstWin), bed: avg(beds), n: naps.length,
    night: avg(nights), wakes: avg1(wakes), up: avg(ups), woke: avg(woke) };
}

/* ---------- dagsrapport (ren tekst, for deling) ---------- */
function dayReport(date) {
  const L = getLog(date), blocks = blocksFor(date), R = T.report;
  const out = [R.head(fmtDateLong(date).toLowerCase())];
  state.kids.forEach(k => {
    const naps = L.sleep.filter(e => e.kid === k.id && e.start).sort((a, b) => a.start.localeCompare(b.start));
    const n = L.night[k.id] || {};
    const parts = naps.map(e => e.end ? e.start + '–' + e.end + ' (' + fmtDurShort(toMin(e.end) - toMin(e.start)) + ')' : R.sleeping(e.start));
    const w = wokeAt(date, k.id);
    const len = nightLen(nightEnding(date, k.id));
    out.push(k.name + ': ' + (w ? R.woke(w) : '') + (len ? R.night(fmtDurShort(len.net), len.wakes) : '') + (parts.length ? R.nap(parts.join(', ')) : R.noNap) + (n.asleep ? R.slept(n.asleep) : '') + '.');
  });
  const meals = blocks.filter(b => L.meals[b.id]).map(b => b.title + ' ' + state.kids.map(k => k.name.charAt(0) + ' ' + (L.meals[b.id][k.id] ? T.rates[L.meals[b.id][k.id]] : '–')).join(', '));
  if (meals.length) out.push(R.food + meals.join('; ') + '.');
  const d = state.days[date];
  const did = d && d.picks ? Object.values(d.picks).map(id => (state.activities.find(a => a.id === id) || {}).name).filter(Boolean) : [];
  if (did.length) out.push(R.did + did.join(', ') + '.');
  const din = dishFor(date, 'dinner');
  if (din) out.push(R.dinner + din.name + '.');
  const ap = (state.appts || []).filter(a => a.date === date);
  if (ap.length) out.push(R.appts + ap.map(a => a.start + ' ' + a.title).join(', ') + '.');
  (L.health || []).slice().sort((a, b) => a.time.localeCompare(b.time)).forEach(x => out.push(kidName(x.kid) + ' ' + x.time + ': ' + T.health[x.kind].toLowerCase() + (x.value ? ' ' + x.value : '') + '.'));
  if (L.note) out.push(R.note + L.note);
  return out.join('\n');
}

/* ---------- avtaler ---------- */
function apptsFor(date) { return (state.appts || []).filter(a => a.date === date).sort((a, b) => a.start.localeCompare(b.start)); }

/* ---------- alder ----------
   Alder regnes fra fødselsdato. Med termindato (for barn født før termin) brukes
   korrigert alder til to år, slik helsestasjonen gjør, til søvn og utvikling. */
function kidAge(k, date) {
  if (!k || !isDate(k.born)) return null;
  const m = monthsBetween(k.born, date), due = state.settings.due;
  const corr = due && due > k.born && diffDays(k.born, due) <= 120 && m < 24 ? Math.max(0, monthsBetween(due, date)) : null;
  return { m, corr, dev: corr != null ? corr : m };
}
/* Yngste alder (korrigert) blant barna, eller null når ingen fødselsdato er kjent */
function devAge(date) {
  const ages = state.kids.map(k => kidAge(k, date)).filter(Boolean);
  return ages.length ? Math.min(...ages.map(a => a.dev)) : null;
}
/* Helsestasjonen: et gjøremål tre uker før hver kontroll, lagt inn én gang per kontroll */
const HS_VISITS = [[12, 'k12'], [15, 'k15'], [17, 'k17'], [24, 'k24']];
function planHealthVisits() {
  const today = todayISO(), S = state.settings;
  const made = (S.hsMade && typeof S.hsMade === 'object') ? S.hsMade : (S.hsMade = {});
  const rb = resetBlock(blocksFor(today));
  let n = 0;
  [...new Set(state.kids.map(k => k.born).filter(isDate))].forEach(born => {
    const same = state.kids.filter(k => k.born === born);
    const who = same.length > 1 && same.length === state.kids.length ? kidsWord() : same.map(k => k.name).join(T.kids.and);
    HS_VISITS.forEach(([mo, key]) => {
      const id = born + ':' + mo, at = addMonths(born, mo);
      if (made[id] || at < today) return;
      const start = addDays(at, -21) < today ? today : addDays(at, -21);
      state.tasks.push({ id: 't-' + uid(), text: T.hs.task(T.hs[key], who), slot: rb ? rb.slot : 'kveld', type: rb ? rb.type : 'routine', rule: { kind: 'once', start } });
      made[id] = true; n++;
    });
  });
  return n;
}
/* Tegn på færre lurer: siste lur i planen var kort (under 40 min) eller uteble
   minst 3 av de siste dagene med søvnlogg. Alderen avgjør om det er aktuelt. */
function napAdvice(date) {
  const S = state.settings;
  if (S.napHintUntil && date < S.napHintUntil) return null;
  const sleeps = blocksFor(date).filter(b => b.type === 'sleep');
  if (sleeps.length < 2) return null;
  const age = devAge(date), need = sleeps.length === 2 ? 11 : 5;
  if (age != null && age < need) return null;
  const fewer = Object.values(state.templates).find(t => t.blocks.filter(b => b.type === 'sleep').length === sleeps.length - 1);
  if (!fewer) return null;
  let logged = 0, signs = 0;
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, -i), L = getLog(d);
    const sl = blocksFor(d).filter(b => b.type === 'sleep');
    if (sl.length !== sleeps.length || !L.sleep.some(e => e.start)) continue;
    logged++;
    const last = sl[sl.length - 1];
    const short = state.kids.filter(k => { const e = napEntry(d, k.id, last.id); return !e || (e.end && toMin(e.end) - toMin(e.start) < 40); }).length;
    if (short * 2 >= state.kids.length) signs++;
  }
  if (logged < 4 || signs < 3) return null;
  return { nth: sleeps.length, signs, days: logged, age, tpl: fewer, fewer: sleeps.length - 1 };
}
