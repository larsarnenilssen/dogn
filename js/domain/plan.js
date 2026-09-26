'use strict';
/* ---------- dagsplan: maler, bolker, dager og roller ---------- */
const DAY_END = 22 * 60;                      // siste bolk varer til kl. 22
let view = todayISO();                        // dagen som vises
let lastToday = todayISO();
const expanded = new Set();                   // passerte bolker som er foldet ut
let shiftOpen = null;                         // bolken som har flyttelinjen åpen
let reopen = null;                            // arket som skal vises igjen etter «Angre»

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
  if (!d.blocks) d.blocks = clone(blocksFor(date));
  return d.blocks;
}
function endOf(blocks, i) {
  return i + 1 < blocks.length ? toMin(blocks[i + 1].start) : Math.max(toMin(blocks[i].start) + 30, DAY_END);
}

/* Roller: «bedtime» er leggingen (nattesøvnen logges der), «reset» er nullstillingen
   om kvelden (i morgen, dagsrapport, backup og det som skal gjøres dagen før). */
const roleBlock = (blocks, role) => blocks.find(b => b.role === role) || null;
const resetBlock = blocks => roleBlock(blocks, 'reset') || blocks[blocks.length - 1] || null;
function nightBlock(blocks) {
  const k = blocks.findIndex(b => b.role === 'reset');
  return roleBlock(blocks, 'bedtime') || (k > 0 ? blocks[k - 1] : null);
}

/* Flytter bare starten på én bolk. Bolken før blir kortere eller lengre, resten av dagen står.
   Kolliderer den med bolkene etter, skyves de akkurat nok til å få 15 minutter hver. */
function moveStart(id, newMin) {
  const arr = ensureDayBlocks(view);
  sortBlocks(arr);
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return null;
  if (i > 0) newMin = Math.max(newMin, toMin(arr[i - 1].start) + 5);
  arr[i].start = toHM(newMin);
  for (let k = i + 1; k < arr.length; k++) {
    if (toMin(arr[k].start) >= toMin(arr[k - 1].start) + 15) break;
    arr[k].start = toHM(toMin(arr[k - 1].start) + 15);
  }
  return arr[i];
}
/* Flytter en bolk og alle etter den like mye */
function shiftFrom(id, delta) {
  const arr = ensureDayBlocks(view);
  sortBlocks(arr);
  const i = arr.findIndex(x => x.id === id);
  if (i < 0) return;
  for (let k = i; k < arr.length; k++) arr[k].start = toHM(toMin(arr[k].start) + delta);
  sortBlocks(arr);
}

function upsert(arr, b) {
  if (b.role) arr.forEach(x => { if (x.id !== b.id && x.role === b.role) x.role = ''; });
  const i = arr.findIndex(x => x.id === b.id);
  if (i >= 0) arr[i] = clone(b); else arr.push(clone(b));
  sortBlocks(arr);
}
/* scope: 'tpl' (malen tplId), 'day' (bare dagen som vises) eller 'perm' (malen dagen bruker) */
function saveBlock(b, scope, tplId) {
  if (scope === 'tpl') { upsert(state.templates[tplId].blocks, b); return; }
  if (scope === 'day') { upsert(ensureDayBlocks(view), b); return; }
  upsert(state.templates[templateFor(view)].blocks, b);
  const d = state.days[view];
  if (d && d.blocks) upsert(d.blocks, b);
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
  const t = { id, name, blocks: blocks.map(b => {
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
