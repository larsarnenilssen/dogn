'use strict';
/* ---------- aktivitetsforslag og pakkeliste ---------- */
function lastPicked(aid, before) {
  let last = null;
  for (const [d, rec] of Object.entries(state.days)) {
    if (d >= before || !rec.picks) continue;
    if (Object.values(rec.picks).includes(aid) && (!last || d > last)) last = d;
  }
  return last;
}
function actFits(a, date, s, e) {
  if (a.days && a.days.length && !a.days.includes(isoWd(date))) return false;
  const need = Math.min(Number(a.minutes) || 30, 120);
  let from = s, to = e;
  if (a.from) from = Math.max(from, toMin(a.from));
  if (a.to) to = Math.min(to, toMin(a.to));
  return to - from >= Math.min(need, e - s) - 5 && (e - s) + 15 >= Math.min(need, 60);
}
/* Rangerer aktiviteter for en våkenbolk ut fra vær, dagslys, faste tider og hva som er gjort nylig. */
function suggest(date, s, e) {
  const w = wxFor(date, s, e);
  const sun = sunTimes(date);
  const light = sun.rise == null ? e - s : Math.max(0, Math.min(e, sun.set) - Math.max(s, sun.rise));
  const wet = isWet(w), windy = isWindy(w);
  const out = [];
  const sick = sickKids(date).length > 0;
  for (const a of state.activities) {
    if (sick && (a.travel !== 'hjemme' || a.sickOk === false)) continue;
    if (!actFits(a, date, s, e)) continue;
    let score = 0;
    if (a.kind === 'ute') {
      if (light < 30) continue;
      if (wet && a.weather === 'dry') continue;
      if (a.weather === 'cold' && !(w && w.tmax <= 1)) continue;
      if (w) score += wet ? -2 : 3;
      if (windy) score -= 1.5;
      if (light >= Math.min(90, e - s)) score += 0.5;
    } else if (wet) score += 1.5;
    if (a.days && a.days.length) score += 2.5;
    if (a.travel === 'hjemme' && e - s >= 90) score -= 0.5;
    if (a.travel !== 'hjemme' && e - s < 45) score -= 4;
    if (a.travel === 'bil') score -= 0.6; else if (a.travel === 'kollektiv') score -= 0.3;
    const last = lastPicked(a.id, date);
    score += last ? Math.min(diffDays(last, date), 14) / 7 : 1.5;
    out.push({ a, score });
  }
  out.sort((x, y) => y.score - x.score || x.a.name.localeCompare(y.a.name));
  return { w, light, list: out.map(o => o.a) };
}
/* Tre forslag med bredde: et fast tilbud i dag, noe ute og noe inne når det er mulig. */
function pickTop(list, n) {
  const out = [];
  const add = a => { if (a && !out.includes(a) && out.length < n) out.push(a); };
  add(list.find(a => a.days && a.days.length));
  add(list.find(a => a.kind === 'ute'));
  add(list.find(a => a.kind === 'inne'));
  list.forEach(add);
  return out.sort((x, y) => list.indexOf(x) - list.indexOf(y));
}
function actMeta(a) {
  const parts = [T.kinds[a.kind], (a.minutes || 30) + ' ' + T.unit.min, T.travel[a.travel] || ''];
  if (a.days && a.days.length) parts.push(a.days.slice().sort().map(d => wdShort(d).toLowerCase()).join('/') + (a.from ? ' ' + a.from + (a.to ? '–' + a.to : '') : ''));
  const tags = (a.tags || []).map(t => T.tags[t]).filter(Boolean);
  return parts.filter(Boolean).join(', ') + (tags.length ? ' · ' + tags.join(', ') : '');
}
/* Filter i forslagsarket: inne/ute og én kategori. Huskes til appen lukkes. */
const actFilter = { kind: '', tag: '' };
const actMatches = a => (!actFilter.kind || a.kind === actFilter.kind) && (!actFilter.tag || (a.tags || []).includes(actFilter.tag));
function pickedActivity(date, blockId) {
  const d = state.days[date];
  const id = d && d.picks && d.picks[blockId];
  return id ? state.activities.find(a => a.id === id) || null : null;
}
function setPick(date, blockId, aid) {
  const d = dayRec(date);
  if (aid) (d.picks ??= {})[blockId] = aid;
  else if (d.picks) delete d.picks[blockId];
}
const packList = () => (state.settings.packList && state.settings.packList.length) ? state.settings.packList : DEFAULT_PACK;
function packRows(date, blocks) {
  const map = {};
  if (!showOn('gear')) return map;
  blocks.forEach(b => {
    const a = pickedActivity(date, b.id);
    if (!a || a.travel === 'hjemme') return;
    map[b.id] = packList().map((txt, i) => ({ id: 'gen-pack-' + b.id + '-' + i, text: txt, sub: i === 0 ? T.acts.packFor(a.name) : '', gen: true }));
  });
  return map;
}
