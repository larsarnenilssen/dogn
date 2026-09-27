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

/* ---------- det Takt får: dagen hjemme i går, i dag og i morgen ---------- */
function shareDay(date) {
  const blocks = blocksFor(date), L = getLog(date);
  const din = dishFor(date, 'dinner'), ph = partnerOn() ? partnerHome(date) : null;
  const sleep = L.sleep.filter(e => e.start).map(e => ({ kid: e.kid, start: e.start, end: e.end || '', night: false }));
  for (const k of state.kids) {
    const n = L.night[k.id];
    if (n && n.asleep) sleep.push({ kid: k.id, start: n.asleep, end: n.wake || n.upAt || '', night: true });
  }
  return {
    blocks: blocks.map((b, i) => {
      const dish = b.link ? dishFor(date, b.link) : null;
      return { start: b.start, end: toHM(endOf(blocks, i)), title: b.title, type: b.type, meal: dish ? dish.name : b.boys || '' };
    }),
    sleep,
    dinner: din ? { dish: din.name, partnerEats: !!(ph && ph.home) } : null,
    appts: apptsFor(date).map(a => ({ title: a.title, start: a.start, where: a.where })),
    sick: sickKids(date).map(k => k.name),
  };
}
function shareFile() {
  const t = todayISO(), days = {};
  for (const d of [addDays(t, -1), t, addDays(t, 1)]) days[d] = shareDay(d);
  const L = shopList(shopPeriod(t)), C = state.shop.checked;
  const shop = [...L.items.filter(x => !C[x.key]).map(x => x.name), ...L.staples.filter(x => !C['st:' + x.id]).map(x => x.text), ...L.extra.filter(x => !C['x:' + x.id]).map(x => x.text)];
  const acks = {};
  for (const id of Object.keys(state.partner.acks)) acks[id] = { done: true };
  for (const x of state.shop.extra) if (x.id.startsWith('tk-') && C['x:' + x.id]) acks[x.id.slice(3)] = { done: true };
  return { format: 'dogn-deling', v: 1, updated: new Date().toISOString(), kidsWord: kidsWord(), kids: state.kids.map(k => ({ id: k.id, name: k.name })), days, shop, acks };
}
