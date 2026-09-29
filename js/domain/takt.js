'use strict';
/* ---------- deling med Takt (partnerens app) ----------
   Takt og Døgn deler data gjennom det samme private repoet, se docs/deling.md.
   Døgn leser takt-deling.json: turnusen, når partneren er borte dag for dag, og
   punkter hun har delt. Døgn skriver dogn-deling.json: dagen hjemme i går, i dag
   og i morgen, handlelisten og hva som er krysset av. Hver app skriver bare sine
   egne filer. Det som hentes fra Takt, lagres på telefonen (ikke i dataene), så
   det vises også uten nett. Turnusen legges inn i state.partner, fordi resten av
   appen bruker den der. */
const takt = { data: null, at: 0 };

async function loadTaktCache() { let c = null; try { c = await store.getKey('takt'); } catch (e) {} if (c && c.data) Object.assign(takt, c); }

/* Godtar bare feltene Døgn bruker, med gyldige verdier */
function cleanTakt(o) {
  const obj = v => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  const s = v => typeof v === 'string' ? v.slice(0, 200) : '';
  const codeOk = c => typeof c === 'string' && /^[\wÆØÅæøå.+-]{1,12}$/.test(c);
  o = obj(o);
  if (o.format !== 'takt-deling') throw new UserError(T.takt.notTakt);
  const R = obj(o.rota), codes = {}, shifts = {}, custom = {}, away = {};
  for (const [c, d] of Object.entries(obj(R.codes))) {
    if (!codeOk(c)) continue;
    const x = obj(d);
    codes[c] = { label: s(x.label), kind: ['work', 'night', 'off'].includes(x.kind) ? x.kind : 'work', start: isTime(x.start) ? x.start : '', end: isTime(x.end) ? x.end : '' };
  }
  for (const [d, c] of Object.entries(obj(R.shifts))) if (isDate(d) && codeOk(c)) shifts[d] = c;
  for (const [d, v] of Object.entries(obj(R.custom))) { const x = obj(v); if (isDate(d) && isTime(x.start) && isTime(x.end)) custom[d] = { start: x.start, end: x.end, label: s(x.label) }; }
  for (const [d, v] of Object.entries(obj(o.away))) {
    const x = obj(v);
    if (isDate(d) && isTime(x.leave) && isTime(x.back)) away[d] = { leave: x.leave, back: x.back, backDay: Math.max(0, Math.min(2, Math.round(Number(x.backDay)) || 0)), chosenTo: x.chosenTo === true, chosenHome: x.chosenHome === true };
  }
  const items = (Array.isArray(o.items) ? o.items : []).map(obj).filter(x => s(x.id) && s(x.title).trim()).slice(0, 500).map(x => ({
    id: s(x.id).slice(0, 20), kind: ['todo', 'appt', 'note', 'shop'].includes(x.kind) ? x.kind : 'todo',
    date: isDate(x.date) ? x.date : '', time: isTime(x.time) ? x.time : '', title: s(x.title).trim(), note: s(x.note), done: x.done === true,
  }));
  return { updated: typeof o.updated === 'string' && !isNaN(Date.parse(o.updated)) ? o.updated : '', codes, shifts, custom, away, items };
}

/* Legger inn det som er hentet: turnusen i partneren, og nye varer på handlelisten */
function applyTakt(raw) {
  const data = cleanTakt(raw);
  takt.data = data; takt.at = Date.now();
  store.setKey('takt', { data, at: takt.at });
  commit(null, () => {
    const P = state.partner;
    Object.assign(P, { enabled: true, source: 'takt', codes: data.codes, shifts: data.shifts, custom: data.custom });
    const seen = new Set(state.shop.fromTakt);
    for (const x of data.items) {
      if (x.kind !== 'shop' || x.done || seen.has(x.id)) continue;
      state.shop.extra.push({ id: 'tk-' + x.id, text: x.title });
      state.shop.fromTakt.push(x.id);
    }
  });
}

/* Fravær en dag fra Takt: { leave, back, backDay, chosenTo, chosenHome } eller null */
const taktAway = date => (taktOn() && takt.data && takt.data.away[date]) || null;
/* Turnusen kommer fra Takt: da overskrives den ved hver henting og kan ikke endres i Døgn */
const rotaFromTakt = () => taktOn() && state.partner.source === 'takt';
/* «06:00* – ~15:48»: * er valgt reise, ~ er beregnet. (+1) når hun kommer hjem neste dag. */
function awayText(a) {
  const t = (hm, chosen) => chosen ? hm + '*' : '~' + hm;
  return t(a.leave, a.chosenTo) + ' – ' + t(a.back, a.chosenHome) + (a.backDay ? ' (+' + a.backDay + ')' : '');
}
/* Punkter fra Takt en dag: med dato den dagen, eller uten dato (i dag, til de er gjort) */
function taktItemsFor(date) {
  if (!takt.data) return [];
  const today = todayISO();
  return takt.data.items.filter(x => x.kind !== 'shop' && (x.date === date || (!x.date && date === today && !x.done && !state.partner.acks[x.id])))
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}
const taktDone = x => x.done || !!state.partner.acks[x.id];
function toggleTaktAck(id) { const A = state.partner.acks; if (A[id]) delete A[id]; else A[id] = true; }

/* ---------- det Takt får: dagen hjemme i går, i dag og i morgen ----------
   I tillegg til planen sendes det som er logget (natt, lurer, mat, helse, aktiviteter
   og notatet når det er merket for Takt), og merknader om det som skiller seg ut.
   Reglene for merknadene står her, så Takt bare viser dem. Se docs/deling.md. */
const APPTS_BACK = 7, APPTS_AHEAD = 92;   // avtalene som deles med Takt
const USUAL_DAYS = 14, USUAL_MIN = 7;   // det vanlige: snittet de siste 14 dagene, når minst 7 er logget
const FLAG = {
  FEVER: 38,              // temperatur fra og med dette er feber
  NIGHT_NOTE: 0.8,        // natt under 80 % av det vanlige …
  NIGHT_HIGH: 0.6,        // … under 60 % er viktig
  WAKES_OVER: 3,          // minst så mange flere oppvåkninger enn vanlig
  UP_MIN: 60,             // eller våken minst så lenge i natt
  NAP: 0.6,               // lurene under 60 % av det vanlige når lurtiden er over
  FOOD_LITE: 2,           // så mange måltider med «lite»
};
/* Det vanlige per barn: { night, wakes, nap } i minutter og antall, eller null når for lite er logget */
function usualSleep(kid) {
  const t = todayISO(), days = [];
  for (let i = 1; i <= USUAL_DAYS; i++) days.push(addDays(t, -i));
  const st = sleepStats(kid, days);
  return { night: st.nights >= USUAL_MIN ? st.night : null, wakes: st.nights >= USUAL_MIN ? st.wakes : null, nap: st.n >= USUAL_MIN ? st.nap : null };
}
const tempOf = v => { const m = /(\d{2}(?:[.,]\d)?)/.exec(v || ''); const x = m ? Number(m[1].replace(',', '.')) : NaN; return x >= 34 && x <= 43 ? x : null; };
/* Siste klokkeslett noe ble logget den dagen (søvn, natt, helse), eller '' */
function lastLogged(date) {
  const L = getLog(date), times = [];
  L.sleep.forEach(e => times.push(e.start, e.end));
  Object.values(getLog(addDays(date, -1)).night).forEach(n => times.push(n.wake, n.upAt));
  Object.values(L.night).forEach(n => times.push(n.asleep, n.upAt));
  (L.health || []).forEach(x => times.push(x.time));
  return times.filter(isTime).sort().pop() || '';
}
/* Merknader for en dag: [{ kind, level: 'high' | 'note', kid, ... }] */
function dayFlags(date, usual) {
  const L = getLog(date), out = [], blocks = blocksFor(date);
  const isToday = date === todayISO(), now = nowMin();
  const nb = nightBlock(blocks), naps = blocks.filter(b => b.type === 'sleep' && b !== nb);
  const lastNap = naps[naps.length - 1];
  const napsOver = date < todayISO() || (isToday && lastNap && now >= endOf(blocks, blocks.indexOf(lastNap)));
  const logged = L.sleep.some(e => e.start);
  for (const k of state.kids) {
    const U = usual[k.id], health = (L.health || []).filter(x => x.kid === k.id);
    const temps = health.filter(x => x.kind === 'temp' && tempOf(x.value) >= FLAG.FEVER);
    const top = temps.sort((a, b) => tempOf(b.value) - tempOf(a.value) || b.time.localeCompare(a.time))[0];
    if (top) out.push({ kind: 'fever', level: 'high', kid: k.id, temp: tempOf(top.value), time: top.time });
    else if (L.sick && L.sick[k.id]) out.push({ kind: 'sick', level: 'high', kid: k.id });
    const med = health.filter(x => x.kind === 'med').sort((a, b) => b.time.localeCompare(a.time))[0];
    if (med) out.push({ kind: 'med', level: 'note', kid: k.id, time: med.time, what: med.value });
    const len = nightLen(nightEnding(date, k.id));
    if (len && U.night) {
      const short = len.net < U.night * FLAG.NIGHT_NOTE, restless = len.wakes >= (U.wakes || 0) + FLAG.WAKES_OVER || len.up >= FLAG.UP_MIN;
      if (short || restless) out.push({ kind: 'night', level: len.net < U.night * FLAG.NIGHT_HIGH ? 'high' : 'note', kid: k.id, net: len.net, wakes: len.wakes, usual: U.night });
    }
    if (napsOver && logged && U.nap) {
      const tot = napTotal(date, k.id);
      if (tot < U.nap * FLAG.NAP) out.push({ kind: 'nap', level: 'note', kid: k.id, total: tot, usual: U.nap });
    }
    const lite = Object.values(L.meals).filter(r => r[k.id] === 'lite').length;
    if (lite >= FLAG.FOOD_LITE) out.push({ kind: 'food', level: 'note', kid: k.id, count: lite });
  }
  const order = { high: 0, note: 1 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}
/* Notatet, når det er merket for Takt: { text, important } eller null */
function noteForTakt(L) { return L.noteTakt && L.note.trim() ? { text: L.note.trim(), important: L.noteTakt === 'important' } : null; }

function shareDay(date, usual) {
  const blocks = blocksFor(date), L = getLog(date);
  const din = dishFor(date, 'dinner'), ph = partnerOn() ? partnerHome(date) : null;
  const sleep = L.sleep.filter(e => e.start).map(e => ({ kid: e.kid, start: e.start, end: e.end || '', night: false }));
  const nights = {};
  for (const k of state.kids) {
    const n = L.night[k.id];
    if (n && n.asleep) sleep.push({ kid: k.id, start: n.asleep, end: n.wake || n.upAt || '', night: true });
    const e = nightEnding(date, k.id), len = nightLen(e);
    if (e.asleep || e.wake) nights[k.id] = { asleep: e.asleep || '', wake: e.wake || '', net: len ? len.net : 0, wakes: e.wakes || 0, up: e.up || 0 };
  }
  const d = state.days[date], picks = d && d.picks ? d.picks : {};
  const did = blocks.filter(b => picks[b.id]).map(b => ({ start: b.start, name: (state.activities.find(a => a.id === picks[b.id]) || {}).name || '' })).filter(x => x.name);
  return {
    blocks: blocks.map((b, i) => {
      const dish = b.link ? dishFor(date, b.link) : null;
      return { start: b.start, end: toHM(endOf(blocks, i)), title: b.title, type: b.type, meal: dish ? dish.name : b.boys || '' };
    }),
    sleep,
    nights,
    meals: blocks.filter(b => L.meals[b.id] && Object.keys(L.meals[b.id]).length).map(b => ({ title: b.title, start: b.start, rates: { ...L.meals[b.id] } })),
    did,
    health: [...(L.health || [])].sort((a, b) => a.time.localeCompare(b.time)).map(x => ({ kid: x.kid, time: x.time, kind: x.kind, value: x.value })),
    note: noteForTakt(L),
    flags: dayFlags(date, usual),
    lastLog: lastLogged(date),
    dinner: din ? { dish: din.name, partnerEats: !!(ph && ph.home) } : null,
    appts: apptsFor(date).filter(a => !a.private).map(a => ({ title: a.title, start: a.start, where: a.where })),
    sick: sickKids(date).map(k => k.name),
  };
}
function shareFile() {
  const t = todayISO(), days = {}, usual = {};
  for (const k of state.kids) usual[k.id] = usualSleep(k.id);
  for (const d of [addDays(t, -1), t, addDays(t, 1)]) days[d] = shareDay(d, usual);
  const L = shopList(shopPeriod(t)), C = state.shop.checked;
  const shop = [...L.items.filter(x => !C[x.key]).map(x => x.name), ...L.staples.filter(x => !C['st:' + x.id]).map(x => x.text), ...L.extra.filter(x => !C['x:' + x.id]).map(x => x.text)];
  // Avtalene som deles (ikke merket «ikke i Takt»), fra en uke tilbake til tre måneder fram
  const appts = (state.appts || []).filter(a => !a.private && a.date >= addDays(t, -APPTS_BACK) && a.date <= addDays(t, APPTS_AHEAD))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .map(a => ({ id: a.id, date: a.date, start: a.start, end: a.minutes ? toHM(toMin(a.start) + a.minutes) : '', title: a.title, where: a.where }));
  const acks = {};
  for (const id of Object.keys(state.partner.acks)) acks[id] = { done: true };
  for (const x of state.shop.extra) if (x.id.startsWith('tk-') && C['x:' + x.id]) acks[x.id.slice(3)] = { done: true };
  return { format: 'dogn-deling', v: 1, updated: new Date().toISOString(), kidsWord: kidsWord(), kids: state.kids.map(k => ({ id: k.id, name: k.name })), usual, days, appts, shop, acks };
}
