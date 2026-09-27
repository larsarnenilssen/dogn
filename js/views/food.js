'use strict';
/* ---------- ark for mat: ukemeny, bytt rett, middagsbank, rett og handleliste ---------- */

/* Meny og handleliste er to faner i samme «mat»-ark */
const foodTabs = cur => h`<div class="seg food-tabs" role="group" aria-label="${T.food.aria}">${[['menu', T.food.menu], ['shop', T.food.shop]].map(([k, l]) => h`<button type="button" data-food="${k}" aria-pressed="${k === cur}">${l}</button>`)}</div>`;
function bindFoodTabs(sheet, ws) {
  sheet.querySelectorAll('[data-food]').forEach(b => b.addEventListener('click', () => {
    if (b.getAttribute('aria-pressed') === 'true') return;
    if (b.dataset.food === 'shop') openShopSheet(); else openWeekSheet(ws);
  }));
}
function openWeekSheet(ws) {
  ws = ws || weekStart(view);
  const W = T.week;
  const days = [...Array(7)].map((_, i) => addDays(ws, i));
  days.forEach(d => ensureWeek(d));
  reopen = () => openWeekSheet(ws);
  const today = todayISO();
  const tomorrow = addDays(today, 1);
  const dayRow = d => {
    const din = dishFor(d, 'dinner'), lun = dishFor(d, 'lunch');
    const m = state.menu[d] || {};
    const ph = partnerHome(d);
    const pinfo = partnerOn() || ph.manual ? W.partnerShort(partnerName(), ph.home, ph.ps && ph.ps.code ? shiftText(ph.ps) : '') : '';
    const withKids = kidsEat(d) && (!din || din.for !== 'voksne') ? W.withKids(kidsWord()) : '';
    return h`<button type="button" class="row${d === today ? ' cur' : ''}" data-day="${d}"><span class="grow">
      <span class="wd">${fmtDateTiny(d)}</span> ${din ? din.name : h`<span class="m inline">${W.noDinner}</span>`}
      <span class="m">${(din ? dishMeta(din) : '') + (m.dinner && m.dinner.manual ? W.manual : '') + withKids}</span>${pinfo ? h`<span class="m">${pinfo.trim()}</span>` : ''}
      ${lun ? h`<span class="m">${W.lunch(lun.name)}</span>` : ''}
      </span><span class="r">›</span></button>`;
  };
  const kw = kidsWord(), kd = state.settings.kidsDinnerDays || [];
  const dinBlock = blocksFor(ws).find(b => b.link === 'dinner');
  const ownDays = days.filter(d => !kidsEat(d) || (dishFor(d, 'dinner') || {}).for === 'voksne').length;
  openSheet(h`${headHTML(W.title, true)}
    <div class="sh-body">
      ${foodTabs('menu')}
      <section class="grp"><h3>${W.from(fmtDateShort(ws))}</h3>
        <div class="row2"><button type="button" class="btn small" data-wk="-7">${W.prev}</button><button type="button" class="btn small" data-wk="7">${W.next}</button></div>
        <div class="list">${days.map(dayRow)}</div>
        ${hint(W.hint)}
      </section>
      <section class="grp"><h3>${W.kidsHead(kw)}</h3>
        <div class="chips">${T.date.wdShort.map((w, i) => h`<button type="button" class="chip" data-kd="${i + 1}" aria-pressed="${kd.includes(i + 1)}">${w}</button>`)}</div>
        <p class="hint">${W.kidsOwnCount(kw, ownDays, dinBlock && dinBlock.boys)}</p>
        ${hint(W.kidsHint(kw))}
      </section>
      <section class="grp"><h3>${W.regenHead}</h3>
        ${hint(W.regenHint(fmtDateShort(tomorrow)))}
        <button type="button" class="btn wide" data-regen>${W.regen}</button>
      </section>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-wk]').forEach(b => b.addEventListener('click', () => openWeekSheet(addDays(ws, Number(b.dataset.wk)))));
      sheet.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => openSwapSheet(b.dataset.day, 'dinner', () => openWeekSheet(ws))));
      bindFoodTabs(sheet, ws);
      sheet.querySelectorAll('[data-kd]').forEach(c => c.addEventListener('click', () => {
        const wd = Number(c.dataset.kd), cur = state.settings.kidsDinnerDays || [];
        const next = cur.includes(wd) ? cur.filter(x => x !== wd) : [...cur, wd].sort();
        commit(W.kidsToast(kw, next.length), () => { state.settings.kidsDinnerDays = next; regenerateFrom(addDays(todayISO(), 1)); });
        openWeekSheet(ws);
      }));
      q('[data-regen]').addEventListener('click', () => {
        commit(W.regenToast(fmtDateShort(tomorrow)), () => regenerateFrom(tomorrow));
        openWeekSheet(ws);
      });
    });
}

function openSwapSheet(date, meal, back) {
  const S = T.swap;
  const cur = dishFor(date, meal);
  const m = state.menu[date] && state.menu[date][meal];
  const list = state.dishes.filter(x => x.meal === meal)
    .map(x => ({ x, l: lastServed(x.id, date) }))
    .sort((a, b) => (a.l || '').localeCompare(b.l || '') || a.x.name.localeCompare(b.x.name));
  const afterSave = () => { if (back) back(); else closeSheet(); };
  reopen = null;
  const current = cur ? h`<section class="grp"><h3>${S.current}</h3>
      <div class="dcard"><strong>${cur.name}</strong><span class="m">${dishMeta(cur)}</span>
        ${cur.kids ? h`<span>${T.kids.forKids(kidsWord()) + cur.kids}</span>` : ''}
        ${cur.prep ? h`<span class="m">${S.prep + cur.prep}</span>` : ''}
        ${cur.dayBefore ? h`<span class="m">${S.dayBefore + cur.dayBefore}</span>` : ''}
      </div>
      <div class="row2"><button type="button" class="btn small" data-edit-dish="${cur.id}">${S.editDish}</button>
      ${m && m.manual ? h`<button type="button" class="btn small" data-auto>${S.toAuto}</button>` : h`<button type="button" class="btn small" data-none>${S.noDish}</button>`}</div>
    </section>`
    : (m && m.manual ? h`<section class="grp">${hint(S.noneChosen)}<button type="button" class="btn small wide" data-auto>${S.toAutoLong}</button></section>` : '');
  openSheet(h`${headMaybeBack(S.title(T.meals[meal], fmtDateTiny(date)), back)}
    <div class="sh-body">
      ${current}
      <section class="grp"><h3>${S.other}</h3><div class="list">
        ${list.map(({ x, l }) => h`<button type="button" class="row${cur && cur.id === x.id ? ' cur' : ''}" data-pick="${x.id}"><span class="grow">${x.name}
          <span class="m">${dishMeta(x)}</span></span><span class="r">${l ? T.unit.daysAgo(diffDays(l, date)) : S.isNew}</span></button>`)}
      </div>${hint(S.hint)}</section>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
        const d = dishById(b.dataset.pick);
        commit(S.picked(T.meals[meal], fmtDateTiny(date), d.name), () => setMenu(date, meal, d.id, true));
        afterSave();
      }));
      const none = q('[data-none]');
      if (none) none.addEventListener('click', () => { commit(S.none(T.meals[meal]), () => setMenu(date, meal, null, true)); afterSave(); });
      const auto = q('[data-auto]');
      if (auto) auto.addEventListener('click', () => {
        commit(S.auto, () => { delete state.menu[date][meal]; generateWeek(weekStart(date), date); });
        afterSave();
      });
      const ed = q('[data-edit-dish]');
      if (ed) ed.addEventListener('click', () => openDishSheet(ed.dataset.editDish, () => openSwapSheet(date, meal, back)));
    }, back);
}

function openBankSheet() {
  reopen = openBankSheet;
  const D = T.dish;
  const group = meal => state.dishes.filter(x => x.meal === meal).sort((a, b) => (Number(b.weekday) ? 1 : 0) - (Number(a.weekday) ? 1 : 0) || a.name.localeCompare(b.name));
  const rowsFor = meal => {
    const rows = group(meal).map(x => h`<button type="button" class="row" data-dish="${x.id}"><span class="grow">${x.name}<span class="m">${dishMeta(x)}</span></span><span class="r">›</span></button>`);
    return rows.length ? rows : emptyRow(D.none);
  };
  openSheet(h`${headHTML(D.bankTitle, true)}
    <div class="sh-body">
      <section class="grp"><h3>${D.dinners}</h3><div class="list">${rowsFor('dinner')}</div>
        <button type="button" class="btn wide" data-new="dinner">${D.newDinner}</button></section>
      <section class="grp"><h3>${D.lunches}</h3><div class="list">${rowsFor('lunch')}</div>
        <button type="button" class="btn wide" data-new="lunch">${D.newLunch}</button>
        ${hint(D.lunchHint)}</section>
      <section class="grp"><h3>${D.fish}</h3><div class="field"><label for="b-fish">${D.fishPerWeek}</label>
        <input id="b-fish" type="number" inputmode="numeric" min="0" max="7" value="${state.settings.fishPerWeek}"></div>
        ${hint(D.fishHint)}</section>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-dish]').forEach(b => b.addEventListener('click', () => openDishSheet(b.dataset.dish, openBankSheet)));
      sheet.querySelectorAll('[data-new]').forEach(b => b.addEventListener('click', () => openDishSheet(null, openBankSheet, b.dataset.new)));
      q('#b-fish').addEventListener('change', e => {
        const v = Math.max(0, Math.min(7, parseInt(e.target.value, 10) || 0));
        commit(D.fishToast(v), () => { state.settings.fishPerWeek = v; });
        openBankSheet();
      });
    });
}

function openDishSheet(id, back, meal) {
  const isNew = !id, D = T.dish;
  const src = isNew ? { id: 'd-' + uid(), name: '', meal: meal || 'dinner', minutes: 30, cat: 'kjott', weekday: 0, for: 'alle', kids: '', prep: '', dayBefore: '', ingredients: [] } : dishById(id);
  if (!src) return;
  const d = clone(src);
  const kw = kidsWord();
  reopen = null;
  openSheet(h`${headBack(isNew ? D.new : D.edit)}
    <form class="sh-body" id="df" novalidate>
      <section class="grp"><h3>${D.group}</h3>
        <div class="field"><label for="d-name">${T.common.name}</label><input id="d-name" type="text" value="${d.name}" autocomplete="off" placeholder="${D.namePh}"></div>
        <div class="row2">
          <div class="field"><label for="d-meal">${D.meal}</label><select id="d-meal">${options(Object.entries(T.meals), d.meal)}</select></div>
          <div class="field"><label for="d-min">${D.minutes}</label><input id="d-min" type="number" inputmode="numeric" min="5" max="240" value="${d.minutes}"></div>
        </div>
        <div class="row2">
          <div class="field"><label for="d-cat">${T.common.type}</label><select id="d-cat">${options(Object.entries(T.cats), d.cat)}</select></div>
          <div class="field"><label for="d-wd">${D.weekday}</label><select id="d-wd">${options([[0, T.common.none], ...T.date.wdShort.map((w, i) => [i + 1, w])], Number(d.weekday))}</select></div>
        </div>
        <div class="field"><label for="d-for">${D.forWho}</label><select id="d-for">${options(Object.entries(D.forOpts), d.for || 'alle')}</select></div>
        ${hint(D.forHint(kw))}
      </section>
      <section class="grp"><h3>${D.ingredients}</h3><label for="d-ing" class="vh">${D.ingAria}</label>
        <textarea id="d-ing" rows="5" placeholder="${D.ingPh}">${(d.ingredients || []).join('\n')}</textarea>
        ${hint(D.ingHint)}</section>
      <section class="grp"><h3>${cap(D.forKids(kw))}</h3>
        <label for="d-kids" class="vh">${D.kidsAria(kw)}</label><textarea id="d-kids" rows="2" placeholder="${D.kidsPh}">${d.kids}</textarea>
      </section>
      <section class="grp"><h3>${D.prep}</h3>
        <div class="field"><label for="d-prep">${D.prepNap}</label><input id="d-prep" type="text" value="${d.prep}" autocomplete="off" placeholder="${D.prepPh}"></div>
        <div class="field"><label for="d-before">${D.dayBefore}</label><input id="d-before" type="text" value="${d.dayBefore}" autocomplete="off" placeholder="${D.dayBeforePh}"></div>
      </section>
      ${isNew ? '' : delConfirm(D.del, D.delConfirm(d.name), T.common.del)}
    </form>
    ${footSave(D.save)}`,
    (sheet, q) => {
      bindDelete(sheet, () => {
        commit(D.deleted, () => {
          state.dishes = state.dishes.filter(x => x.id !== d.id);
          for (const m of Object.values(state.menu)) for (const k of Object.keys(m)) if (m[k] && m[k].dish === d.id) delete m[k];
        });
        openBankSheet();
      });
      q('[data-save]').addEventListener('click', () => {
        const name = q('#d-name').value.trim();
        if (!name) { q('#d-name').focus(); return; }
        Object.assign(d, {
          name, meal: q('#d-meal').value, cat: q('#d-cat').value,
          minutes: Math.max(1, parseInt(q('#d-min').value, 10) || 30),
          weekday: Number(q('#d-wd').value), for: q('#d-for').value,
          kids: q('#d-kids').value.trim(), prep: q('#d-prep').value.trim(), dayBefore: q('#d-before').value.trim(),
          ingredients: q('#d-ing').value.split('\n').map(x => x.trim()).filter(Boolean)
        });
        commit(D.savedToast, () => {
          const i = state.dishes.findIndex(x => x.id === d.id);
          if (i >= 0) state.dishes[i] = d; else state.dishes.push(d);
        });
        back();
      });
      if (isNew) setTimeout(() => q('#d-name').focus(), 300);
    }, back);
}

function openShopSheet(from) {
  const L = shopList(from ? shopPeriod(from) : null), p = L.p;
  reopen = () => openShopSheet(from);
  const S = state.shop, P = T.shop, C = S.checked;
  const missing = missingIngredients(p.start, p.days);
  const catBtn = (name, key) => h`<button type="button" class="icon-btn sm cat-btn" data-cat-of="${name}" aria-label="${P.moveAria(name)}">›</button>`;
  const row = (key, name, sub, opts = {}) => h`<li${opts.sort ? h` data-sort="${opts.sort}"` : ''}>${opts.sort ? dragHandle(name) : ''}<label><input type="checkbox" data-shop="${key}"${C[key] ? raw(' checked') : ''}><span class="txt"><span class="main">${name}</span>${sub ? h`<small>${sub}</small>` : ''}</span></label>
    ${opts.rm ? h`<button type="button" class="icon-btn sm" data-rm-extra="${opts.rm}" aria-label="${P.removeAria(name)}">${ICON_X}</button>` : catBtn(name, key)}</li>`;
  // Middagsvarer og faste varer samlet etter hvor de står i butikken
  const rows = [
    ...L.items.map(it => ({ cat: it.cat, name: it.name, html: row(it.key, it.name, [it.amounts.join(' + '), it.dishes.join(', ')].filter(Boolean).join(' · ')) })),
    ...L.staples.map(x => ({ cat: shopCat(x.text), name: x.text, html: row('st:' + x.id, x.text, P.every[x.every]) })),
  ];
  const groups = Object.keys(T.shopCats).map(c => [c, rows.filter(r => r.cat === c).sort((a, b) => a.name.localeCompare(b.name, 'nb'))]).filter(([, r]) => r.length);
  const notDue = (S.staples || []).length - L.staples.length;
  openSheet(h`${headHTML(P.title, true)}
    <div class="sh-body">
      ${foodTabs('shop')}
      <section class="grp"><h3>${P.range(fmtDateTiny(p.start), fmtDateTiny(p.end))}</h3>
        <div class="row2"><button type="button" class="btn small" data-wk="-1">${P.prev}</button><button type="button" class="btn small" data-wk="1">${P.next}</button></div>
        ${groups.length ? groups.map(([c, r]) => h`<div class="shop-grp"><span class="lbl">${T.shopCats[c]}</span><ul class="checks shop">${r.map(x => x.html)}</ul></div>`) : hint(P.empty)}
        ${missing.length ? hint(P.missing(missing.join(', '))) : ''}
      </section>
      <section class="grp"><h3>${P.other}</h3>
        ${S.extra.length ? h`<ul class="checks shop" id="sh-extra">${S.extra.map(x => row('x:' + x.id, x.text, '', { sort: x.id, rm: x.id }))}</ul>` : ''}
        <div class="item"><input type="text" id="sh-add" placeholder="${P.addPh}" autocomplete="off" aria-label="${P.addAria}"><button type="button" class="btn small" data-add-extra>${T.common.add}</button></div>
      </section>
      <div class="row2"><button type="button" class="btn primary" data-shop-done>${P.done}</button><button type="button" class="btn" data-share>${P.share}</button></div>
      ${hint(P.doneHint)}
      <section class="grp"><h3>${P.day}</h3>
        <div class="chips">${[[0, P.dayNone], ...T.date.wdShort.map((w, i) => [i + 1, w])].map(([k, l]) => h`<button type="button" class="chip" data-shopday="${k}" aria-pressed="${Number(k) === (Number(state.settings.shopDay) || 0)}">${l}</button>`)}</div>
        ${hint(P.dayHint)}</section>
      <section class="grp"><h3>${P.staples}</h3>
        <div class="items" id="sh-staples">${(S.staples || []).map(x => h`<div class="item" data-st="${x.id}"><input type="text" value="${x.text}" aria-label="${T.common.name}" autocomplete="off" data-st-text>
          <label class="vh" for="st-e-${x.id}">${P.stapleAria(x.text)}</label><select id="st-e-${x.id}" class="sel-sm" data-st-every>${options(Object.entries(P.every), String(x.every))}</select>
          <button type="button" class="icon-btn sm" data-st-rm aria-label="${T.common.remove}">${ICON_X}</button></div>`)}</div>
        <div class="item"><input type="text" id="st-add" placeholder="${P.staplePh}" autocomplete="off" aria-label="${P.staples}"><button type="button" class="btn small" data-st-add>${T.common.add}</button></div>
        ${notDue > 0 ? h`<p class="hint">${P.notDue(notDue)}</p>` : ''}
        ${hint(P.staplesHint)}</section>
      <section class="grp"><h3>${P.pantry}</h3><label for="sh-pantry" class="vh">${P.pantryAria}</label>
        <textarea id="sh-pantry" rows="4">${(S.pantry || []).join('\n')}</textarea>${hint(P.pantryHint)}</section>
    </div>`,
    (sheet, q) => {
      bindFoodTabs(sheet);
      sheet.querySelectorAll('[data-wk]').forEach(b => b.addEventListener('click', () => {
        const next = b.dataset.wk === '1' ? addDays(p.end, 1) : addDays(p.start, -Math.max(1, p.days));
        openShopSheet(next);
      }));
      sheet.addEventListener('change', e => {
        const cb = e.target.closest('[data-shop]');
        if (cb) commit(null, () => { if (cb.checked) state.shop.checked[cb.dataset.shop] = true; else delete state.shop.checked[cb.dataset.shop]; }, 'none');
      });
      sheet.querySelectorAll('[data-cat-of]').forEach(b => b.addEventListener('click', () => openShopCatSheet(b.dataset.catOf, () => openShopSheet(from))));
      if (q('#sh-extra')) sortable(q('#sh-extra'), ids => commit(T.common.orderSaved, () => { state.shop.extra = reorderSubset(state.shop.extra, ids); }, 'none'));
      sheet.querySelectorAll('[data-rm-extra]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.rmExtra;
        commit(null, () => { state.shop.extra = state.shop.extra.filter(x => x.id !== id); delete state.shop.checked['x:' + id]; }, 'none');
        openShopSheet(from);
      }));
      const add = () => {
        const v = q('#sh-add').value.trim(); if (!v) return;
        commit(null, () => { state.shop.extra.push({ id: uid(), text: v }); }, 'none');
        openShopSheet(from);
        setTimeout(() => { const i = document.querySelector('#sh-add'); if (i) i.focus(); }, 50);
      };
      q('[data-add-extra]').addEventListener('click', add);
      q('#sh-add').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      q("[data-shop-done]").addEventListener('click', () => { commit('', () => finishShopping(L)); openShopSheet(); });
      sheet.querySelectorAll('[data-shopday]').forEach(b => b.addEventListener('click', () => {
        commit(null, () => { state.settings.shopDay = Number(b.dataset.shopday); });
        openShopSheet();
      }));
      const st = id => state.shop.staples.find(x => x.id === id);
      sheet.querySelectorAll('[data-st]').forEach(r => {
        const id = r.dataset.st;
        r.querySelector('[data-st-text]').addEventListener('change', e => { const v = e.target.value.trim(); if (v) commit(null, () => { st(id).text = v; }, 'none'); });
        r.querySelector('[data-st-every]').addEventListener('change', e => { commit(null, () => { st(id).every = Number(e.target.value); }, 'none'); openShopSheet(from); });
        r.querySelector('[data-st-rm]').addEventListener('click', () => { commit('', () => { state.shop.staples = state.shop.staples.filter(x => x.id !== id); }); openShopSheet(from); });
      });
      const addStaple = () => {
        const v = q('#st-add').value.trim(); if (!v) return;
        commit(null, () => { state.shop.staples.push({ id: 'st-' + uid(), text: v, every: 7, last: '' }); });
        openShopSheet(from);
      };
      q('[data-st-add]').addEventListener('click', addStaple);
      q('#st-add').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addStaple(); } });
      q('#sh-pantry').addEventListener('change', e => { const list = e.target.value.split('\n').map(x => x.trim()).filter(Boolean); commit(T.common.saved, () => { state.shop.pantry = list; }); openShopSheet(from); });
      q('[data-share]').addEventListener('click', async () => {
        const open = r => !state.shop.checked[r];
        const lines = [];
        groups.forEach(([c]) => {
          const inCat = [...L.items.filter(it => it.cat === c && open(it.key)).map(it => it.name + (it.amounts.length ? ' (' + it.amounts.join(' + ') + ')' : '')),
            ...L.staples.filter(x => shopCat(x.text) === c && open('st:' + x.id)).map(x => x.text)];
          if (inCat.length) lines.push('', T.shopCats[c] + ':', ...inCat.sort((a, b) => a.localeCompare(b, 'nb')).map(x => '- ' + x));
        });
        const ex = L.extra.filter(x => open('x:' + x.id)).map(x => '- ' + x.text);
        if (ex.length) lines.push('', P.other + ':', ...ex);
        const text = P.text(fmtDateTiny(p.start), fmtDateTiny(p.end)) + '\n' + lines.join('\n');
        try { if (navigator.share) { await navigator.share({ title: P.title, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
        try { await navigator.clipboard.writeText(text); toast(P.copied); } catch (e) { toast(P.cantShare); }
      });
    });
}
/* Velg hvor en vare står i butikken. Valget huskes for varen. */
function openShopCatSheet(name, back) {
  const P = T.shop, cur = shopCat(name);
  reopen = null;
  openSheet(h`${headMaybeBack(P.moveTitle(name), back)}
    <div class="sh-body"><div class="list">${Object.entries(T.shopCats).map(([k, l]) => h`<button type="button" class="row${k === cur ? ' cur' : ''}" data-cat="${k}"><span class="grow">${l}</span><span class="r">${k === cur ? '*' : ''}</span></button>`)}</div></div>`,
    sheet => sheet.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => {
      commit(P.moved(name, T.shopCats[b.dataset.cat]), () => setShopCat(name, b.dataset.cat));
      back();
    })), back);
}
