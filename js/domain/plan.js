'use strict';
/* ---------- dagsplan: maler, bolker, dager og roller ---------- */
const DAY_END = 22 * 60;                      // siste bolk varer til kl. 22
let view = todayISO();                        // dagen som vises
let lastToday = todayISO();
const expanded = new Set();                   // bolker som er foldet ut med et trykk
const folded = new Set();                     // bolker som er gjort kompakte med et trykk
let shiftOpen = null;                         // bolken som har flyttelinjen åpen
let reopen = null;                            // arket som skal vises igjen etter «Angre»
let showAll = false;                          // vis alle bolker fullt (ellers er fjerne bolker én linje)

function dayRec(date) { const d = (state.days[date] ??= { done: {} }); d.done ??= {}; return d; }
function logRec(date) { const d = dayRec(date); return (d.log ??= { sleep: [], night: {}, meals: {}, note: '' }); }
function getLog(date) { const d = state.days[date]; return (d && d.log) || { sleep: [], night: {}, meals: {}, note: '' }; }
function isDone(date, id) { return !!(state.days[date] && state.days[date].done && state.days[date].done[id]); }
function kidName(id) { const k = state.kids.find(x => x.id === id); return k ? k.name : id; }
/* Samlebetegnelsen for barna, for eksempel «barna» eller «guttene» */
const kidsWord = () => lcFirst(state.settings.kidsWord || T.kids.word);
const groupWord = () => state.kids.length === 2 ? T.kids.both : T.kids.all;
const showOn = k => !(state.settings && state.settings.show && state.settings.show[k] === false);

function scheduledTemplate(date) {
  const sch = [...state.schedule].sort((a, b) => a.from.localeCompare(b.from));
  let t = sch[0].templateId;
  for (const s of sch) if (s.from <= date) t = s.templateId;
  return state.templates[t] ? t : Object.keys(state.templates)[0];
}
function templateFor(date) {
  const d = state.days[date];
  if (d && d.templateId && state.templates[d.templateId]) return d.templateId;
  return scheduledTemplate(date);
}
function sortBlocks(arr) { arr.sort((a, b) => toMin(a.start) - toMin(b.start)); return arr; }
function blocksFor(date) {
  const d = state.days[date];
  return sortBlocks(d && d.blocks ? d.blocks : state.templates[templateFor(date)].blocks);
}
function ensureDayBlocks(date) {
  const d = dayRec(date);
  if (!d.blocks) d.blocks = clone(blocksFor(date)).map(b => { b.plan = b.plan || b.start; return b; });
  return d.blocks;
}
function endOf(blocks, i) {
  return i + 1 < blocks.length ? toMin(blocks[i + 1].start) : Math.max(toMin(blocks[i].start) + 30, DAY_END);
}

/* Roller: «wake» er morgenen (dagen starter når barnene har våknet), «bedtime» er
   leggingen (nattesøvnen logges der, og tiden er fast), «reset» er nullstillingen om
   kvelden (i morgen, dagsrapport, backup og det som skal gjøres dagen før). */
const roleBlock = (blocks, role) => blocks.find(b => b.role === role) || null;
const resetBlock = blocks => roleBlock(blocks, 'reset') || blocks[blocks.length - 1] || null;
const wakeBlock = blocks => roleBlock(blocks, 'wake') || blocks.find(b => b.type !== 'prep') || blocks[0] || null;
function nightBlock(blocks) {
  const k = blocks.findIndex(b => b.role === 'reset');
  return roleBlock(blocks, 'bedtime') || (k > 0 ? blocks[k - 1] : null);
}
const bedtimeIndex = blocks => { const nb = nightBlock(blocks); return nb ? blocks.indexOf(nb) : -1; };
/* Barnas måltider: måltidsbolker med noe i «Barnene spiser» eller en rett fra banken */
const isKidMeal = b => b.type === 'meal' && !!(b.boys || b.link);

/* ---------- planen for dagen og hvordan den tas igjen ----------
   Hver bolk har en planlagt tid (plan) og en faktisk tid (start). Planen er malen,
   eller det du selv har satt for dagen (i bolkeditoren eller med ±15/30). Faktisk tid
   endres når noe skjer: våknet, sovnet, våknet fra lur, «start nå».

   Når en bolk starter tidligere eller senere enn planlagt, går de neste bolkene tilbake
   til planlagt tid så fort det lar seg gjøre. Bolkene imellom kan krympe til tre
   fjerdedeler av planlagt lengde (stell og forberedelser til halvparten). Lurer kan
   strekkes litt, mens måltider og våkentid kan vare lenger, fordi trøttheten følger
   tiden siden forrige søvn og ikke måltidet. Da tas en forsinkelse igjen i løpet av få bolker, slik at
   tvillingene blir sultne og trøtte til vanlig tid, og planen holder dag for dag.
   Leggetid er fast og endres bare når leggebolken selv flyttes. */
const MIN_BLOCK = 10;          // korteste bolk
const SNAP = 5;                // nye tider rundes til nærmeste fem minutter
const SQUEEZE = { meal: [0.75, 15], sleep: [0.75, 20], awake: [0.75, 10], routine: [0.5, 10], prep: [0.5, 10] };   // [andel, minst min]
const STRETCH = { sleep: [1.25, 15], other: [3, 60] };                                                                  // [andel, minst min ekstra]

function planMinutes(arr, date) {
  const tpl = new Map(state.templates[templateFor(date)].blocks.map(b => [b.id, toMin(b.start)]));
  return arr.map(b => isTime(b.plan) ? toMin(b.plan) : tpl.has(b.id) ? tpl.get(b.id) : toMin(b.start));
}
/* Legger bolkene etter i inn så nær planen som mulig. arr[i] har allerede sin nye tid. */
function catchUp(arr, i, date) {
  const bi = bedtimeIndex(arr), endIdx = bi >= 0 ? bi : arr.length;
  if (i >= endIdx - 1) return;
  const end = bi >= 0 ? toMin(arr[bi].start) : Math.max(DAY_END, toMin(arr[arr.length - 1].start) + MIN_BLOCK);
  const P = planMinutes(arr, date);
  const pEnd = bi >= 0 ? P[bi] : end;
  const pd = k => Math.max(0, (k + 1 < endIdx ? P[k + 1] : pEnd) - P[k]);
  const minD = k => { const [f, fl] = SQUEEZE[arr[k].type] || SQUEEZE.awake; return Math.max(MIN_BLOCK, Math.min(pd(k), Math.max(fl, Math.round(pd(k) * f)))); };
  const maxD = k => { const [f, add] = arr[k].type === 'sleep' ? STRETCH.sleep : STRETCH.other; return Math.max(pd(k) + add, pd(k) * f, MIN_BLOCK); };
  const need = [];
  for (let k = endIdx - 1, acc = 0; k > i; k--) { acc += minD(k); need[k] = acc; }
  const N = [toMin(arr[i].start)];
  for (let k = i + 1; k < endIdx; k++) {
    const prev = N[k - i - 1];
    const lo = prev + minD(k - 1), hi = Math.min(prev + maxD(k - 1), end - need[k]);
    if (lo > hi) return spreadEvenly(arr, i, endIdx, end, P, pEnd);
    let n = Math.round(Math.min(Math.max(P[k], lo), hi) / SNAP) * SNAP;
    if (n < lo) n = Math.ceil(lo / SNAP) * SNAP;
    if (n > hi) n = Math.max(lo, Math.floor(hi / SNAP) * SNAP);
    N.push(n);
  }
  N.forEach((m, j) => { if (j) arr[i + j].start = toHM(m); });
}
/* Når det ikke er plass innenfor grensene: fordel etter planlagt lengde fram til leggetid */
function spreadEvenly(arr, i, endIdx, end, P, pEnd) {
  const s0 = toMin(arr[i].start), f = pEnd - P[i] > 0 ? (end - s0) / (pEnd - P[i]) : 1;
  let prev = s0;
  for (let k = i + 1; k < endIdx; k++) {
    let m = Math.round((s0 + (P[k] - P[i]) * f) / SNAP) * SNAP;
    m = Math.min(Math.max(m, prev + MIN_BLOCK), end - (endIdx - k) * MIN_BLOCK);
    arr[k].start = toHM(m);
    prev = m;
  }
}
/* Flytter en bolk. explicit = brukeren har selv satt ny tid (±15/30, leggetid), og da
   endres også planen for dagen. Ellers er det bare den faktiske tiden som endres. */
function moveBlock(id, newMin, explicit) {
  const arr = ensureDayBlocks(view);
  sortBlocks(arr);
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return null;
  const bi = bedtimeIndex(arr);
  const set = (b, m) => { b.start = toHM(m); if (explicit) b.plan = b.start; };
  if (bi >= 0 && i > bi) {
    // Etter leggetid (nullstillingen): flyttes like mye, men aldri før leggetid
    newMin = Math.max(toMin(arr[bi].start) + MIN_BLOCK, Math.min(24 * 60 - 1, newMin));
    const delta = newMin - toMin(arr[i].start);
    for (let k = i; k < arr.length; k++) set(arr[k], toMin(arr[k].start) + delta);
    return { block: arr[i], kind: 'after' };
  }
  if (i === bi) {
    // Leggetid endres bare her. Det som kommer etter, følger med, og bolkene fra nå
    // (eller fra morgenen) fram til leggetid legges inn så nær planen som mulig.
    let a = Math.max(0, arr.indexOf(wakeBlock(arr)));
    if (view === todayISO()) arr.forEach((b, k) => { if (k < bi && toMin(b.start) <= nowMin()) a = Math.max(a, k); });
    newMin = Math.max(a < bi ? toMin(arr[a].start) + (bi - a) * MIN_BLOCK : 0, Math.min(24 * 60 - 1, newMin));
    const delta = newMin - toMin(arr[bi].start);
    for (let k = bi; k < arr.length; k++) { arr[k].start = toHM(toMin(arr[k].start) + delta); arr[k].plan = arr[k].start; }
    if (a < bi) catchUp(arr, a, view);
    return { block: arr[i], kind: 'bedtime' };
  }
  const endIdx = bi >= 0 ? bi : arr.length;
  const end = bi >= 0 ? toMin(arr[bi].start) : Math.max(DAY_END, toMin(arr[arr.length - 1].start) + MIN_BLOCK);
  const lo = i > 0 ? toMin(arr[i - 1].start) + SNAP : 0;
  set(arr[i], Math.max(lo, Math.min(end - (endIdx - i) * MIN_BLOCK, newMin)));
  catchUp(arr, i, view);
  return { block: arr[i], kind: 'fit', end: bi >= 0 ? arr[bi].start : null };
}

/* Hva «start nå» betyr for en bolk. Nåværende og neste bolk startes direkte.
   Ellers må brukeren velge, og måltider og leggetid hoppes aldri over. */
function startNowPlan(date, id) {
  const blocks = blocksFor(date), now = nowMin();
  const i = blocks.findIndex(b => b.id === id);
  let cur = -1;
  blocks.forEach((b, k) => { if (toMin(b.start) <= now) cur = k; });
  const bi = bedtimeIndex(blocks);
  const b = blocks[i];
  const beforeBed = k => bi < 0 || k < bi;
  if (bi >= 0 && i > bi && now < toMin(blocks[bi].start)) return { kind: 'afterBed', bed: blocks[bi] };
  if (i === bi) return { kind: 'bedtime', bed: b };
  if (i === cur || i === cur + 1) return { kind: 'direct' };
  const sameAfter = blocks.find((x, k) => k > cur && beforeBed(k) && x.type === b.type && x.id !== b.id);
  if (i < cur) return { kind: 'past', alt: sameAfter || null };
  const between = blocks.slice(cur + 1, i);
  return { kind: 'ahead', between, meals: between.filter(isKidMeal), alt: sameAfter && blocks.indexOf(sameAfter) < i ? sameAfter : null };
}
function skipBlocks(ids) {
  const arr = ensureDayBlocks(view);
  for (const id of ids) { const k = arr.findIndex(x => x.id === id); if (k >= 0) arr.splice(k, 1); }
}
/* Kopi av en bolk inn nå, bare i dag. Resten av dagen står. */
function copyBlockNow(id) {
  const arr = ensureDayBlocks(view);
  const src = arr.find(x => x.id === id);
  if (!src) return null;
  const c = clone(src);
  c.id = src.id + '-' + uid(); c.slot = c.id; c.role = '';
  c.items = c.items.map(it => ({ id: c.id + '.' + uid(), text: it.text }));
  c.start = c.plan = toHM(nowMin());
  arr.push(c);
  sortBlocks(arr);
  return c;
}
/* Alt fra nå går tilbake til malen. Det som er passert, og bolker som bare finnes i dag, står. */
function resetRestOfDay(date) {
  const d = state.days[date];
  if (!d || !d.blocks) return;
  const now = nowMin();
  const tpl = state.templates[templateFor(date)].blocks;
  const tplIds = new Set(tpl.map(b => b.id));
  const keep = d.blocks.filter(b => toMin(b.start) < now);
  const keepIds = new Set(keep.map(b => b.id));
  const later = tpl.filter(t => !keepIds.has(t.id) && (toMin(t.start) >= now || d.blocks.some(b => b.id === t.id))).map(t => Object.assign(clone(t), { plan: t.start }));
  const own = d.blocks.filter(b => toMin(b.start) >= now && !tplIds.has(b.id));
  d.blocks = sortBlocks([...keep, ...later, ...own]);
}

/* Malene har bare planlagte tider. En dag har både plan og faktisk tid. */
const stripPlan = list => list.map(b => { const c = clone(b); delete c.plan; return c; });
function upsert(arr, b, isDay) {
  if (b.role) arr.forEach(x => { if (x.id !== b.id && x.role === b.role) x.role = ''; });
  const c = clone(b);
  if (isDay) c.plan = c.start; else delete c.plan;
  const i = arr.findIndex(x => x.id === b.id);
  if (i >= 0) arr[i] = c; else arr.push(c);
  sortBlocks(arr);
}
/* scope: 'tpl' (malen tplId), 'day' (bare dagen som vises) eller 'perm' (malen dagen bruker).
   Tiden du setter i bolkeditoren, blir også planen for dagen. */
function saveBlock(b, scope, tplId) {
  if (scope === 'tpl') { upsert(state.templates[tplId].blocks, b, false); return; }
  if (scope === 'day') { upsert(ensureDayBlocks(view), b, true); return; }
  upsert(state.templates[templateFor(view)].blocks, b, false);
  const d = state.days[view];
  if (d && d.blocks) upsert(d.blocks, b, true);
}
function deleteBlock(id, scope, tplId) {
  const rm = arr => { const i = arr.findIndex(x => x.id === id); if (i >= 0) arr.splice(i, 1); };
  if (scope === 'tpl') { rm(state.templates[tplId].blocks); return; }
  if (scope === 'day') { rm(ensureDayBlocks(view)); return; }
  rm(state.templates[templateFor(view)].blocks);
  const d = state.days[view];
  if (d && d.blocks) rm(d.blocks);
}

/* ---------- maler og plan ---------- */
function tplUse(id) {
  const sch = state.schedule.filter(s => s.templateId === id).map(s => s.from).sort();
  const days = Object.values(state.days).filter(d => d.templateId === id).length;
  return { sch, days };
}
function makeTemplate(name, blocks) {
  const id = 'tpl-' + uid();
  const used = new Set();
  const t = { id, name, blocks: stripPlan(blocks).map(b => {
    const nb = clone(b);
    nb.slot = b.slot || b.id;
    nb.id = id + '.' + nb.slot;
    if (used.has(nb.id)) nb.id += '-' + uid();
    used.add(nb.id);
    nb.items = (nb.items || []).map(it => ({ id: nb.id + '.' + uid(), text: it.text }));
    return nb;
  }) };
  sortBlocks(t.blocks);
  state.templates[id] = t;
  return t;
}
function scheduleFrom(from, templateId) {
  state.schedule = state.schedule.filter(s => s.from !== from);
  state.schedule.push({ from, templateId });
  state.schedule.sort((a, b) => a.from.localeCompare(b.from));
}

/* Førstegangsoppsett og profil */
function applySetup(o) {
  state.kids = o.kids;
  state.place = o.place;
  state.leave = o.leave;
  if (o.kidsWord) state.settings.kidsWord = o.kidsWord;
  if (!state.meta.setupDone) {
    state.schedule = [{ from: o.leave.start, templateId: o.templateId || state.schedule[0].templateId }];
    state.tasks.forEach(t => { if (t.id in SEED_TASK_OFFSETS && t.rule) t.rule.start = addDays(o.leave.start, SEED_TASK_OFFSETS[t.id]); });
  }
  if (o.partnerEnabled != null) state.partner.enabled = o.partnerEnabled;
  if (o.partnerName) state.partner.name = o.partnerName;
  state.meta.setupDone = true;
  setTimeout(() => refreshWeather(true), 50);
}
