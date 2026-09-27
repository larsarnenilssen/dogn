'use strict';
/* ---------- middagsbank, ukemeny og handleliste ---------- */
const weekStart = d => addDays(d, 1 - isoWd(d));
function dishById(id) { return state.dishes.find(x => x.id === id); }
/* Om barna spiser av middagen en dag: valgt for dagen, ellers faste ukedager */
function kidsEat(date) {
  const d = state.days[date];
  if (d && typeof d.kidsDin === 'boolean') return d.kidsDin;
  return (state.settings.kidsDinnerDays || []).includes(isoWd(date));
}
function toggleKidsEat(date) {
  const next = !kidsEat(date), d = dayRec(date);
  delete d.kidsDin;
  if (kidsEat(date) !== next) d.kidsDin = next;
}
const forAll = x => x.for !== 'voksne';
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
    // Dager barna spiser av middagen, får bare retter som passer for alle.
    for (let i = 0; i < slots.length; i++) {
      if (slots[i]) continue;
      if (!queue.length) queue = others.length ? others.slice() : stale(pool);
      const prevCat = catOf(i - 1), nextCat = i + 1 < slots.length && slots[i + 1] ? slots[i + 1].cat : '';
      const ok = meal === 'dinner' && kidsEat(free[i]) ? forAll : () => true;
      let j = queue.findIndex(x => ok(x) && x.cat !== prevCat && x.cat !== nextCat);
      if (j < 0) j = queue.findIndex(x => ok(x) && x.cat !== prevCat);
      if (j < 0) j = queue.findIndex(ok);
      if (j < 0) { const alt = stale(pool).find(ok); if (alt) { slots[i] = alt; continue; } j = 0; }
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
  return T.dish.meta(d.minutes, T.cats[d.cat], Number(d.weekday) ? wdShort(d.weekday).toLowerCase() : '', d.for === 'voksne');
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
  // Handledag: «Handle» i den lengste våkenbolken, til det er handlet
  const today = todayISO();
  if (Number(state.settings.shopDay) === isoWd(date) && date >= today && !(state.shop.boughtThrough >= date)) {
    const n = openCount(shopList(shopPeriod(date > today ? date : null)));
    const awake = blocks.map((b, i) => ({ b, len: endOf(blocks, i) - toMin(b.start) })).filter(x => x.b.type === 'awake').sort((a, b) => b.len - a.len)[0];
    if (n && awake) add(awake.b, { id: 'gen-shop', text: T.shop.task(n), sub: T.shop.taskSub, gen: true });
  }
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

/* ---------- handleliste ----------
   Perioden går fra dagen etter forrige handletur (eller i dag) fram til neste handledag.
   Varene er ingrediensene i rettene, faste varer som er på tur, og andre varer. */
const normItem = t => t.trim().toLowerCase();
const AMOUNT_RE = /^\s*((?:\d+(?:[.,]\d+)?|½|¼|¾)(?:\s*(?:g|gram|kg|dl|l|ml|cl|stk|ss|ts|pk|pakke|pakker|boks|bokser|fedd|neve|klype|skive|skiver|beger|glass|pose|poser))?\.?)\s+(.+)$/i;
function splitAmount(text) {
  const m = String(text).match(AMOUNT_RE);
  return m ? { amount: m[1].trim(), name: m[2].trim() } : { amount: '', name: String(text).trim() };
}
/* Hvor varen står i butikken. Rekkefølgen betyr noe: hermetikk og frys før råvarene. */
const SHOP_RULES = [
  ['baby', /bleie|våtserviett|morsmelkerstatning|(^|\s)mme(\s|$)|smekke|tannkrem|såpe|sjampo|bomull|barnemat|klemmepose/],
  ['torr', /nudler|pasta|spaghetti|makaroni|i hvit saus|i tomatsaus|hermetisk|boks|hakkede tomater|tomatsaus|tomatsuppe|tomatpuré|kokosmelk|bønner|linser|kikerter|mais/],
  ['frys', /frossen|frosne|fryst|wokgrønnsaker|erter|fiskepinner|\bis\b|iskrem/],
  ['brod', /brød|lefse|tortilla|pizzabunn|knekkebrød|rundstykke|pita|baguett|lompe/],
  ['meieri', /melk|fløte|rømme|yoghurt|\bost\b|ost$|revet ost|smør|egg|kesam|cottage|crème|kremost|skyr/],
  ['kjott', /filet|kjøtt|kylling|laks|torsk|\bsei\b|sei$|fisk|skinke|bacon|pølse|karbonade|kalkun|reke|svin|storfe|lam|biff|farse/],
  ['frukt', /eple|banan|pære|appelsin|klementin|drue|bær|frukt|grønnsak|gulrot|gulrøtter|potet|brokkoli|blomkål|paprika|agurk|tomat|løk|spinat|salat|avokado|squash|sitron|lime|ingefær|persille|koriander|basilikum|purre|kål|sopp|selleri|rødbet/],
  ['torr', /ris|pasta|spaghetti|makaroni|nudler|havregryn|gryn|mel\b|mel$|sukker|krydder|buljong|olje|soyasaus|gjær|rosin|müsli|nøtt|frø|honning|sirup|eddik|sennep|ketchup|majones/],
];
function shopCat(name) {
  const k = normItem(name), known = state.shop.cats && state.shop.cats[k];
  if (known) return known;
  for (const [cat, re] of SHOP_RULES) if (re.test(k)) return cat;
  return 'annet';
}
function shopPeriod(from) {
  const today = todayISO(), bt = state.shop.boughtThrough;
  const start = from || (bt && bt >= today ? addDays(bt, 1) : today);
  const day = Number(state.settings.shopDay) || 0;
  let days = 7;
  if (day) { days = 1; while (isoWd(addDays(start, days)) !== day) days++; }
  return { start, days, end: addDays(start, days - 1) };
}
function shopItems(from, days) {
  const pantry = new Set((state.shop.pantry || []).map(normItem));
  const map = new Map();
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    for (const meal of ['dinner', 'lunch']) {
      const dish = dishFor(d, meal);
      if (!dish) continue;
      (dish.ingredients || []).forEach(ing => {
        const { amount, name } = splitAmount(ing);
        const k = normItem(name);
        if (!k || pantry.has(k)) return;
        if (!map.has(k)) map.set(k, { key: k, name, dishes: [], amounts: [], cat: shopCat(name) });
        const it = map.get(k);
        if (!it.dishes.includes(dish.name)) it.dishes.push(dish.name);
        if (amount) it.amounts.push(amount);
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}
/* Faste varer som er på tur: det er gått (nesten) så lang tid siden de sist ble handlet */
const stapleDue = (x, start) => !x.last || diffDays(x.last, start) >= x.every - 1;
function shopList(p) {
  p = p || shopPeriod();
  const items = shopItems(p.start, p.days);
  const have = new Set(items.map(x => x.key));
  const staples = (state.shop.staples || []).filter(x => stapleDue(x, p.start) && !have.has(normItem(x.text)));
  return { p, items, staples, extra: state.shop.extra || [] };
}
const openCount = L => L.items.filter(x => !state.shop.checked[x.key]).length + L.staples.filter(x => !state.shop.checked['st:' + x.id]).length + L.extra.filter(x => !state.shop.checked['x:' + x.id]).length;
/* Ferdig handlet: faste varer får ny dato, handlede andre varer fjernes, og middagsvarer som
   ikke ble krysset av, flyttes til andre varer, så de ikke forsvinner når perioden går videre. */
function finishShopping(L) {
  const C = state.shop.checked, today = todayISO();
  let n = 0, moved = 0;
  L.staples.forEach(x => { if (C['st:' + x.id]) { const s = state.shop.staples.find(y => y.id === x.id); if (s) s.last = today; n++; } });
  const keepExtra = state.shop.extra.filter(x => !C['x:' + x.id]);
  n += state.shop.extra.length - keepExtra.length;
  const extraKeys = new Set(keepExtra.map(x => normItem(x.text)));
  L.items.forEach(it => {
    if (C[it.key]) { n++; return; }
    if (!extraKeys.has(it.key)) { keepExtra.push({ id: uid(), text: it.name }); moved++; }
  });
  state.shop.extra = keepExtra;
  state.shop.checked = {};
  state.shop.boughtThrough = L.p.end;
  return T.shop.doneToast(n, moved);
}
function setShopCat(name, cat) { state.shop.cats[normItem(name)] = cat; }
function missingIngredients(from, days) {
  return [...new Set(Array.from({ length: days }, (_, i) => addDays(from, i)).flatMap(d => ['dinner', 'lunch'].map(m => dishFor(d, m))).filter(x => x && !(x.ingredients || []).length).map(x => x.name))];
}
