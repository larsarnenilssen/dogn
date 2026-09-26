'use strict';
/* ---------- middagsbank, ukemeny og handleliste ---------- */
const weekStart = d => addDays(d, 1 - isoWd(d));
function dishById(id) { return state.dishes.find(x => x.id === id); }
function setMenu(d, meal, dish, manual) { (state.menu[d] ??= {})[meal] = { dish, manual }; }
function lastServed(dishId, before) {
  let last = null;
  for (const [d, m] of Object.entries(state.menu)) {
    if (d >= before) continue;
    for (const k of ['dinner', 'lunch']) if (m[k] && m[k].dish === dishId && (!last || d > last)) last = d;
  }
  return last;
}
/* Lager meny for én uke. Faste ukedager først, så fisk spredt utover uken,
   deretter rettene som er spist for lengst siden. Manuelle valg røres ikke. */
function generateWeek(ws, from) {
  for (const meal of ['dinner', 'lunch']) {
    const week = [...Array(7)].map((_, i) => addDays(ws, i));
    const days = week.filter(d => !from || d >= from);
    const used = new Set();
    week.forEach(d => { const m = state.menu[d] && state.menu[d][meal]; if (m && m.dish && (m.manual || (from && d < from))) used.add(m.dish); });
    const free = [];
    for (const d of days) {
      const cur = state.menu[d] && state.menu[d][meal];
      if (cur && cur.manual) continue;
      const fixed = state.dishes.find(x => x.meal === meal && Number(x.weekday) === isoWd(d));
      if (fixed) { setMenu(d, meal, fixed.id, false); used.add(fixed.id); }
      else { if (state.menu[d]) delete state.menu[d][meal]; if (meal === 'dinner') free.push(d); }
    }
    if (!free.length) continue;
    const pool = state.dishes.filter(x => x.meal === meal && !Number(x.weekday));
    if (!pool.length) continue;
    const stale = arr => arr.map(x => ({ x, l: lastServed(x.id, ws) || '' }))
      .sort((a, b) => a.l.localeCompare(b.l) || a.x.name.localeCompare(b.x.name)).map(o => o.x);
    let fishHave = 0;
    week.forEach(d => { if (free.includes(d)) return; const m = state.menu[d] && state.menu[d][meal]; const di = m && dishById(m.dish); if (di && di.cat === 'fisk') fishHave++; });
    const fishN = Math.max(0, Math.min(free.length, (Number(state.settings.fishPerWeek) || 0) - fishHave));
    const fish = stale(pool.filter(x => x.cat === 'fisk' && !used.has(x.id))).slice(0, fishN);
    const others = stale(pool.filter(x => x.cat !== 'fisk' && !used.has(x.id)));
    const slots = new Array(free.length).fill(null);
    fish.forEach((f, i) => { let p = Math.floor((i + 0.5) * free.length / fish.length); while (slots[p]) p = (p + 1) % free.length; slots[p] = f; });
    // Fyll resten med retten som er spist for lengst siden, men unngå samme type to dager på rad.
    let queue = others.length ? others.slice() : stale(pool);
    const catOf = i => { if (i < 0) { const m = state.menu[addDays(free[0], -1)]; const di = m && m[meal] && dishById(m[meal].dish); return di ? di.cat : ''; } return slots[i] ? slots[i].cat : ''; };
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) continue;
      if (!queue.length) queue = others.length ? others.slice() : stale(pool);
      const prevCat = catOf(i - 1), nextCat = i + 1 < slots.length && slots[i + 1] ? slots[i + 1].cat : '';
      let j = queue.findIndex(x => x.cat !== prevCat && x.cat !== nextCat);
      if (j < 0) j = queue.findIndex(x => x.cat !== prevCat);
      if (j < 0) j = 0;
      slots[i] = queue.splice(j, 1)[0];
    }
    free.forEach((d, i) => setMenu(d, meal, slots[i].id, false));
  }
}
/* Menyen for en uke lages første gang uken vises. Det er en utregning, ikke en
   endring brukeren har gjort, og lagres derfor uten angremulighet. */
function ensureWeek(date) {
  const ws = weekStart(date);
  if (state.menuWeeks[ws]) return;
  generateWeek(ws, null);
  state.menuWeeks[ws] = true;
  persist();
}
function regenerateFrom(from) {
  const weeks = new Set(Object.keys(state.menuWeeks).filter(ws => addDays(ws, 6) >= from));
  weeks.add(weekStart(from));
  [...weeks].sort().forEach(ws => { generateWeek(ws, from); state.menuWeeks[ws] = true; });
}
function dishFor(date, meal) {
  ensureWeek(date);
  const m = state.menu[date] && state.menu[date][meal];
  return m && m.dish ? dishById(m.dish) || null : null;
}
function dishMeta(d) {
  return T.dish.meta(d.minutes, T.cats[d.cat], Number(d.weekday) ? wdShort(d.weekday).toLowerCase() : '');
}
/* Forberedelser som følger av menyen: i luren før måltidet, og kvelden før. */
function genRows(date, blocks) {
  const map = {};
  const add = (b, row) => { if (b) (map[b.id] ??= []).push(row); };
  blocks.forEach(b => {
    if (!b.link) return;
    const dish = dishFor(date, b.link);
    if (!dish) return;
    const start = toMin(b.start);
    const before = blocks.filter(x => toMin(x.start) < start);
    const target = before.filter(x => x.type === 'sleep').pop() || before.pop();
    add(target, { id: 'gen-prep-' + b.link, text: T.dish.genPrep(T.meals[b.link], dish.name), sub: dish.prep || '', gen: true });
  });
  const tomorrow = addDays(date, 1);
  const eve = resetBlock(blocks);
  if (!syncOn() && isoWd(date) === 7) add(eve, { id: 'gen-backup', text: T.backupTask.text, sub: T.backupTask.sub, gen: true });
  blocksFor(tomorrow).forEach(b => {
    if (!b.link) return;
    const dish = dishFor(tomorrow, b.link);
    if (dish && dish.dayBefore) add(eve, { id: 'gen-ahead-' + b.link, text: T.dish.ahead(dish.dayBefore), sub: T.dish.aheadSub(T.meals[b.link], dish.name), gen: true });
  });
  return map;
}

/* Handleliste: ingrediensene fra rettene i en periode, uten varer man alltid har hjemme */
const normItem = t => t.trim().toLowerCase();
function shopItems(from, days) {
  const pantry = new Set((state.shop.pantry || []).map(normItem));
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    for (const meal of ['dinner', 'lunch']) {
      const dish = dishFor(d, meal);
      if (!dish) continue;
      (dish.ingredients || []).forEach(ing => {
        const k = normItem(ing);
        if (!k || pantry.has(k)) return;
        if (!map.has(k)) map.set(k, { key: k, name: ing.trim(), dishes: [] });
        const it = map.get(k);
        if (!it.dishes.includes(dish.name)) it.dishes.push(dish.name);
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}
function missingIngredients(from, days) {
  return [...new Set(Array.from({ length: days }, (_, i) => addDays(from, i)).flatMap(d => ['dinner', 'lunch'].map(m => dishFor(d, m))).filter(x => x && !(x.ingredients || []).length).map(x => x.name))];
}
