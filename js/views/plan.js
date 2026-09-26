'use strict';
/* ---------- ark for dagsplanen: meny, bolker, maler, gjøremål, legg til og avtaler ---------- */

function openMenu() {
  const d = state.days[view], M = T.menu;
  const follow = scheduledTemplate(view);
  const tpls = Object.values(state.templates);
  const din = dishFor(view, 'dinner');
  const le = state.meta.lastExport;
  const recurring = state.tasks.filter(t => !t.rule || t.rule.kind !== 'once').length;
  reopen = openMenu;
  openSheet(h`${headHTML(M.title)}
    <div class="sh-body">
      <section class="grp"><h3>${fmtDateLong(view)}</h3>
        <div class="row2"><button type="button" class="btn" data-m="new">${M.newBlock}</button><button type="button" class="btn" data-m="add">${M.add}</button></div>
        <div class="field"><label for="m-daytpl">${M.dayTpl}</label><select id="m-daytpl">
          ${options([['', M.follow(state.templates[follow].name)], ...tpls.map(t => [t.id, M.only(t.name)])], d && d.templateId ? d.templateId : '')}
        </select></div>
        <button type="button" class="btn wide" data-m="saveday">${M.saveDay}</button>
        ${undoStack.length ? h`<button type="button" class="btn wide" data-m="undo">${M.undo(undoStack[undoStack.length - 1].label)}</button>` : ''}
        ${d && d.blocks ? h`${view === todayISO() ? h`<button type="button" class="btn wide" data-m="reset-rest">${M.resetRest}</button>` : ''}<button type="button" class="btn wide" data-m="reset">${M.reset}</button>${hint(M.resetHint)}` : ''}
      </section>
      <section class="grp"><h3>${M.food}</h3><div class="list">
        ${navRow('week', M.week, din ? M.todayDish(din.name) : '')}
        ${navRow('shop', M.shop, M.shopMeta)}
        ${navRow('bank', M.bank, M.bankMeta(state.dishes.length, state.settings.fishPerWeek))}
      </div></section>
      <section class="grp"><h3>${M.acts}</h3><div class="list">
        ${navRow('acts', M.library, M.libraryMeta(state.activities.length, state.place && state.place.name))}
      </div></section>
      <section class="grp"><h3>${M.log}</h3><div class="list">
        ${navRow('log', M.dayLog, fmtDateShort(view))}
        ${navRow('history', M.history, M.historyMeta)}
      </div></section>
      <section class="grp"><h3>${M.setup}</h3><div class="list">
        ${navRow('profile', M.profile, state.kids.map(k => k.name).join(', ') + (state.place ? ', ' + state.place.name : ''))}
        ${navRow('partner', M.partner, partnerOn() ? M.partnerMeta(partnerName(), Object.keys(state.partner.shifts).length) : M.off)}
        ${navRow('tasks', M.tasks, M.tasksMeta(recurring))}
        ${navRow('templates', M.templates, tpls.map(t => t.name).join(', '))}
        ${navRow('backup', M.backup, syncOn() ? M.backupAuto(sync.cfg.lastPush ? fmtStamp(sync.cfg.lastPush) : '') : (le ? M.backupFile(fmtDateShort(le)) : M.backupNone))}
      </div></section>
      <p class="hint version">${T.app.version(APP_VERSION)}</p>
    </div>`,
    (sheet, q) => {
      sheet.addEventListener('click', e => {
        const nav = e.target.closest('[data-nav]');
        const m = e.target.closest('[data-m]');
        if (nav) {
          ({ week: () => openWeekSheet(), bank: openBankSheet, log: () => openLogSheet(view), history: openHistorySheet, tasks: openTasksSheet, templates: openTemplatesSheet,
             backup: openSyncSheet, profile: () => openProfileSheet(false), partner: openPartnerSheet, acts: openActivitiesSheet, shop: () => openShopSheet() })[nav.dataset.nav]();
          return;
        }
        if (!m) return;
        const k = m.dataset.m;
        if (k === 'new') openBlockSheet(null);
        else if (k === 'add') openAddSheet();
        else if (k === 'saveday') openSaveDaySheet();
        else if (k === 'undo') undoLast();
        else if (k === 'reset') { closeSheet(); commit(M.toastReset, () => { delete state.days[view].blocks; }); }
        else if (k === 'reset-rest') { closeSheet(); commit(M.toastResetRest, () => resetRestOfDay(view)); }
      });
      q('#m-daytpl').addEventListener('change', e => {
        const v = e.target.value;
        commit(v ? M.toastUses(state.templates[v].name) : M.toastFollows, () => {
          const dr = dayRec(view);
          if (v) dr.templateId = v; else delete dr.templateId;
          delete dr.blocks;
        });
        openMenu();
      });
    });
}

/* ---------- rediger bolk (for en dag, eller i en mal) ---------- */
const itemRow = it => h`<div class="item" data-iid="${it.id}" data-sort="${it.id}">${dragHandle(it.text || T.block.itemAria)}<input type="text" value="${it.text}" aria-label="${T.block.itemAria}"><button type="button" class="icon-btn sm" data-rm aria-label="${T.block.removeItem}">${ICON_X}</button></div>`;
const shiftButtons = attr => [-30, -15, 15, 30].map(d => h`<button type="button" class="btn small" ${raw(attr)}="${d}">${(d > 0 ? '+' : '−') + Math.abs(d)}</button>`);

function openBlockSheet(id, tplId) {
  const isNew = !id, inTpl = !!tplId, B = T.block;
  const blocks = inTpl ? sortBlocks(state.templates[tplId].blocks) : blocksFor(view);
  const lastStart = blocks.length ? toMin(blocks[blocks.length - 1].start) : 11 * 60;
  const src = isNew
    ? { id: 'b-' + uid(), slot: '', type: 'awake', title: '', start: inTpl ? toHM(Math.min(23 * 60, lastStart + 30)) : toHM(Math.min(23 * 60, Math.ceil(nowMin() / 15) * 15)), items: [], boys: '', adults: '', note: '', link: '', role: '' }
    : blocks.find(x => x.id === id);
  if (!src) return;
  const b = clone(src);
  b.link = b.link || '';
  b.role = b.role || '';
  const isToday = view === todayISO();
  const dayLbl = isToday ? B.today : B.thisDay;
  const tasksHere = isNew || inTpl ? [] : (placeTasks(view, blocks)[b.id] || []);
  const tplName = state.templates[inTpl ? tplId : templateFor(view)].name;
  reopen = null;
  const back = () => openTemplateEditor(tplId);
  const isBed = !isNew && !inTpl && nightBlock(blocks) === src;

  const delSection = isNew ? '' : h`<section class="grp quiet"><button type="button" class="btn link" data-del>${inTpl ? B.delBlock : B.del}</button>
      <div class="confirm" data-confirm hidden>${hint(inTpl ? B.delConfirmTpl(b.title, tplName) : B.delConfirm(b.title, dayLbl, tplName))}
      <div class="btnrow">${inTpl ? h`<button type="button" class="btn small danger" data-del-scope="tpl">${B.delFromTpl}</button>`
        : h`<button type="button" class="btn small danger" data-del-scope="day">${B.delDay(dayLbl)}</button><button type="button" class="btn small danger" data-del-scope="perm">${B.delFromTpl}</button>`}</div></div>
    </section>`;
  // Tid og flytting øverst, så sjekkliste og notat. Navn, type, rett og rolle ligger under «Mer».
  const timeSection = h`<section class="grp"><h3>${isBed ? B.shiftHeadBed : B.time}</h3>
      <div class="field"><label for="f-start">${B.starts}</label><input id="f-start" type="time" value="${b.start}"></div>
      ${inTpl ? '' : h`<div class="shift">${shiftButtons('data-shift')}</div>
        ${isToday ? h`<button type="button" class="btn small wide" data-shift="now">${T.tl.startsNow}</button>` : ''}
        ${hint(isBed ? B.shiftHintBed(dayLbl) : B.shiftHint(dayLbl))}`}
    </section>`;

  openSheet(h`${inTpl ? headBack(isNew ? B.newInTpl : B.inTpl) : headHTML(isNew ? B.new : B.edit)}
    <form class="sh-body" id="bf" novalidate>
      ${timeSection}
      <section class="grp"><h3>${B.checklist}</h3>
        <div class="items" id="f-items">${b.items.map(itemRow)}</div>
        <button type="button" class="btn small wide" data-add>${B.addItem}</button>
        ${tasksHere.length ? hint(B.tasksHere(tasksHere.map(x => x.task.text).join(', '))) : ''}
      </section>
      <section class="grp"><h3>${T.common.note}</h3>
        <label for="f-note" class="vh">${T.common.note}</label><textarea id="f-note" rows="3">${b.note}</textarea>
      </section>
      <details class="grp more-sec"${isNew ? raw(' open') : ''}><summary>${B.more}</summary>
        <div class="field"><label for="f-title">${T.common.name}</label><input id="f-title" type="text" value="${b.title}" placeholder="${T.types[b.type]}" autocomplete="off"></div>
        <div class="field"><label for="f-type">${T.common.type}</label><select id="f-type">${options(Object.entries(T.types), b.type)}</select></div>
        <div class="stack" id="f-meal"${b.type === 'meal' ? '' : raw(' hidden')}>
          <div class="field"><label for="f-link">${B.fromBank}</label><select id="f-link">${options(Object.entries(B.linkOpts), b.link)}</select></div>
          <div class="field"><label for="f-boys">${T.kids.eat(kidsWord())}</label><input id="f-boys" type="text" value="${b.boys}" autocomplete="off"></div>
          <div class="field"><label for="f-adults">${T.kids.adultsEat}</label><input id="f-adults" type="text" value="${b.adults}" autocomplete="off"></div>
          ${hint(B.bankHint)}
        </div>
        <div class="field"><label for="f-role">${B.role}</label><select id="f-role">${options(Object.entries(B.roleOpts), b.role)}</select></div>
        ${hint(B.roleHint)}
      </details>
      ${delSection}
    </form>
    ${inTpl ? footSave(B.saveTpl, 'data-save="tpl"')
      : h`<div class="sh-foot"><button type="button" class="btn primary grow" data-save="day">${B.saveDay(dayLbl)}</button><button type="button" class="btn grow" data-save="perm">${B.saveTpl}</button></div>`}`,
    (sheet, q) => {
      q('#f-type').addEventListener('change', e => { q('#f-meal').hidden = e.target.value !== 'meal'; q('#f-title').placeholder = T.types[e.target.value]; });
      q('[data-add]').addEventListener('click', () => {
        q('#f-items').insertAdjacentHTML('beforeend', toHtml(itemRow({ id: 'i-' + uid(), text: '' })));
        q('#f-items').lastElementChild.querySelector('input').focus();
      });
      q('#f-items').addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) rm.closest('.item').remove(); });
      sortable(q('#f-items'));   // rekkefølgen lagres når bolken lagres
      q('#f-items').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q('[data-add]').click(); } });
      sheet.querySelectorAll('[data-shift]').forEach(btn => btn.addEventListener('click', () => {
        const v = btn.dataset.shift;
        closeSheet();
        if (v === 'now') startNow(b.id); else moveBlockBy(b.id, Number(v));
      }));
      bindDelete(sheet, () => {});
      sheet.querySelectorAll('[data-del-scope]').forEach(btn => btn.addEventListener('click', () => {
        const scope = btn.dataset.delScope;
        if (scope === 'tpl') { commit(B.deletedTpl, () => deleteBlock(b.id, scope, tplId)); back(); return; }
        closeSheet();
        commit(scope === 'day' ? B.deletedDay(dayLbl) : B.deletedTpl, () => deleteBlock(b.id, scope));
      }));
      sheet.querySelectorAll('[data-save]').forEach(btn => btn.addEventListener('click', () => {
        readBlock(sheet, b);
        const scope = btn.dataset.save;
        if (scope === 'tpl') { commit(B.savedTpl(tplName), () => saveBlock(b, scope, tplId)); back(); return; }
        closeSheet();
        commit(scope === 'day' ? B.savedDay(dayLbl) : B.savedTpl(tplName), () => saveBlock(b, scope));
      }));
      if (isNew) setTimeout(() => q('#f-title').focus(), 300);
    }, back);
}

function readBlock(sheet, b) {
  const q = s => sheet.querySelector(s);
  b.type = q('#f-type').value;
  b.title = q('#f-title').value.trim() || T.types[b.type];
  b.start = isTime(q('#f-start').value) ? q('#f-start').value : b.start;
  b.boys = q('#f-boys').value.trim();
  b.adults = q('#f-adults').value.trim();
  b.link = b.type === 'meal' ? q('#f-link').value : '';
  b.role = q('#f-role').value;
  b.note = q('#f-note').value.trim();
  b.items = [...sheet.querySelectorAll('#f-items .item')]
    .map(r => ({ id: r.dataset.iid || 'i-' + uid(), text: r.querySelector('input').value.trim() }))
    .filter(x => x.text);
  if (!b.slot) b.slot = b.id;
}

/* ---------- start nå for en bolk som ikke er neste ----------
   Viser hva som vil skje, og lar brukeren velge et trygt alternativ. */
function openStartNowSheet(b, p) {
  const S = T.startNow, now = nowMin();
  const names = list => list.map(x => x.title).join(', ');
  const btn = (act, label, primary) => h`<button type="button" class="btn wide${primary ? ' primary' : ''}" data-sn="${act}">${label}</button>`;
  let body = [];
  if (p.kind === 'afterBed') body = [hint(S.afterBed(b.title, p.bed.start))];
  else if (p.kind === 'bedtime') body = [hint(S.bedtime(b.start, toHM(now))), btn('bed', S.changeBed, true)];
  else if (p.kind === 'past') body = [hint(S.past(b.title, b.start)), p.alt ? btn('alt', S.useAlt(p.alt.title, p.alt.start), true) : '', btn('copy', S.copy), hint(S.copyHint)];
  else if (p.kind === 'ahead') body = [
    p.meals.length ? hint(S.meals(names(p.meals))) : hint(S.ahead(names(p.between))),
    p.alt ? btn('alt', S.useAlt(p.alt.title, p.alt.start), true) : '',
    p.meals.length ? '' : btn('skip', S.skip(names(p.between)), !p.alt),
    p.meals.length ? '' : hint(S.skipHint)];
  reopen = null;
  openSheet(h`${headHTML(S.title(b.title))}
    <div class="sh-body"><section class="grp">${body}</section>
      <button type="button" class="btn wide" data-close>${S.cancel}</button></div>`,
    sheet => sheet.addEventListener('click', e => {
      const a = e.target.closest('[data-sn]');
      if (!a) return;
      closeSheet();
      shiftOpen = null;
      const k = a.dataset.sn, t = nowMin();
      if (k === 'alt') commit('', () => fitMessage(moveBlock(p.alt.id, t)));
      else if (k === 'bed') commit('', () => fitMessage(moveBlock(b.id, t, true)));
      else if (k === 'copy') commit(S.copied(b.title), () => { copyBlockNow(b.id); });
      else if (k === 'skip') commit('', () => { skipBlocks(p.between.map(x => x.id)); return S.skipped(names(p.between)) + ' ' + fitMessage(moveBlock(b.id, t)); });
    }));
}

/* ---------- maler ---------- */
const tplMeta = t => { const u = tplUse(t.id); return T.tpl.meta(t.blocks.length, u.sch.map(fmtDateShort), u.days); };

function openTemplatesSheet() {
  reopen = openTemplatesSheet;
  const P = T.tpl;
  const follow = scheduledTemplate(view);
  const tpls = Object.values(state.templates).sort((a, b) => a.name.localeCompare(b.name));
  const sch = [...state.schedule].sort((a, b) => a.from.localeCompare(b.from));
  openSheet(h`${headHTML(P.title, true)}
    <div class="sh-body">
      <section class="grp"><h3>${P.plan}</h3>
        <div class="list">${sch.map((s, i) => {
          const next = sch[i + 1];
          return h`<div><span class="grow">${state.templates[s.templateId] ? state.templates[s.templateId].name : P.unknown}
            <span class="m">${next ? P.range(fmtDateShort(s.from), fmtDateShort(addDays(next.from, -1))) : P.onwards(fmtDateShort(s.from))}</span></span>
            ${i > 0 ? h`<button type="button" class="btn small ghost" data-rm-sched="${s.from}">${T.common.remove}</button>` : ''}</div>`;
        })}</div>
        <div class="row2">
          <div class="field"><label for="m-stpl">${P.switchTo}</label><select id="m-stpl">${tpls.map(t => h`<option value="${t.id}"${t.id !== follow ? raw(' selected') : ''}>${t.name}</option>`)}</select></div>
          <div class="field"><label for="m-sfrom">${T.common.fromDate}</label><input type="date" id="m-sfrom" value="${addDays(todayISO(), 1)}"></div>
        </div>
        <button type="button" class="btn wide" data-add-sched>${P.addSwitch}</button>
      </section>
      <section class="grp"><h3>${P.list}</h3><div class="list">
        ${tpls.map(t => h`<button type="button" class="row" data-tpl="${t.id}"><span class="grow">${t.name}<span class="m">${tplMeta(t)}</span></span><span class="r">›</span></button>`)}
      </div>
      <button type="button" class="btn primary wide" data-new-tpl>${P.new}</button>
      ${hint(P.fromDayHint)}
      </section>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-rm-sched]').forEach(b => b.addEventListener('click', () => {
        commit(P.switchRemoved, () => { state.schedule = state.schedule.filter(s => s.from !== b.dataset.rmSched || s === sch[0]); });
        openTemplatesSheet();
      }));
      q('[data-add-sched]').addEventListener('click', () => {
        const from = q('#m-sfrom').value, tid = q('#m-stpl').value;
        if (!isDate(from)) return;
        commit(P.fromToast(state.templates[tid].name, fmtDateShort(from)), () => scheduleFrom(from, tid));
        openTemplatesSheet();
      });
      sheet.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => openTemplateEditor(b.dataset.tpl)));
      q('[data-new-tpl]').addEventListener('click', openNewTemplateSheet);
    });
}

function openNewTemplateSheet() {
  reopen = null;
  const P = T.tpl;
  const tpls = Object.values(state.templates);
  const cur = templateFor(view);
  openSheet(h`${headBack(P.new)}
    <form class="sh-body" id="nt" novalidate>
      <section class="grp"><h3>${P.group}</h3>
        <div class="field"><label for="nt-name">${T.common.name}</label><input id="nt-name" type="text" autocomplete="off" placeholder="${P.namePh}"></div>
        <div class="field"><label for="nt-base">${P.startWith}</label><select id="nt-base">${options([...tpls.map(t => [t.id, P.copyOf(t.name)]), ['', P.empty]], cur)}</select></div>
        ${hint(P.newHint)}
      </section>
    </form>
    ${footSave(P.create, 'data-create')}`,
    (sheet, q) => {
      q('[data-create]').addEventListener('click', () => {
        const name = q('#nt-name').value.trim();
        if (!name) { q('#nt-name').focus(); return; }
        const base = q('#nt-base').value;
        let t;
        commit(P.created(name), () => { t = makeTemplate(name, base ? state.templates[base].blocks : []); });
        openTemplateEditor(t.id);
      });
      setTimeout(() => q('#nt-name').focus(), 300);
    }, openTemplatesSheet);
}

function openTemplateEditor(id) {
  const t = state.templates[id], P = T.tpl;
  if (!t) { openTemplatesSheet(); return; }
  reopen = () => openTemplateEditor(id);
  const u = tplUse(id);
  const only = Object.keys(state.templates).length === 1;
  const canDelete = !only && !u.sch.length && !u.days;
  const blocks = sortBlocks(t.blocks);
  const blockMeta = b => [T.types[b.type].toLowerCase(), b.items.length ? plural(b.items.length, T.n.punkt) : '', b.link ? P.fromBank : '', b.role ? P.roleMeta(b.role) : ''].filter(Boolean).join(', ');
  openSheet(h`${headBack(t.name)}
    <div class="sh-body">
      <section class="grp"><h3>${T.common.name}</h3><label for="te-name" class="vh">${T.common.name}</label><input id="te-name" type="text" value="${t.name}" autocomplete="off"></section>
      <section class="grp"><h3>${P.blocks}</h3>
        ${stripHTML(blocks, '', false)}
        ${blocks.length ? h`<div class="list">${blocks.map(b => h`<button type="button" class="row tb-${b.type}" data-blk="${b.id}"><span class="grow"><span class="wd">${b.start}</span> ${b.title}
          <span class="m">${blockMeta(b)}</span></span><span class="r">›</span></button>`)}</div>` : hint(P.isEmpty)}
        <button type="button" class="btn wide" data-new-blk>${P.newBlock}</button>
        ${hint(P.editHint)}
      </section>
      <section class="grp"><h3>${P.use}</h3>
        ${hint(u.sch.length ? P.inPlan(u.sch.map(fmtDateShort).join(' og ')) : P.notInPlan)}
        <div class="field"><label for="te-from">${T.common.fromDate}</label><input id="te-from" type="date" value="${addDays(todayISO(), 1)}"></div>
        <button type="button" class="btn primary wide" data-use>${P.useFrom}</button>
        <button type="button" class="btn wide" data-try>${P.try}</button>
        ${hint(P.tryHint)}
      </section>
      <section class="grp quiet">
        <button type="button" class="btn small" data-copy>${P.copy}</button>
        ${canDelete ? h`<button type="button" class="btn link" data-del>${P.del}</button>` : hint(only ? P.onlyOne : P.inUse)}
      </section>
    </div>`,
    (sheet, q) => {
      q('#te-name').addEventListener('change', e => { const v = e.target.value.trim(); if (v) { commit(T.common.nameSaved, () => { state.templates[id].name = v; }); openTemplateEditor(id); } });
      sheet.querySelectorAll('[data-blk]').forEach(b => b.addEventListener('click', () => openBlockSheet(b.dataset.blk, id)));
      q('[data-new-blk]').addEventListener('click', () => openBlockSheet(null, id));
      q('[data-use]').addEventListener('click', () => {
        const from = q('#te-from').value;
        if (!isDate(from)) return;
        commit(P.fromToast(t.name, fmtDateShort(from)), () => scheduleFrom(from, id));
        openTemplateEditor(id);
      });
      q('[data-try]').addEventListener('click', () => {
        const d = isDate(q('#te-from').value) ? q('#te-from').value : todayISO();
        closeSheet();
        commit(P.tryToast(t.name, fmtDateTiny(d)), () => { const r = dayRec(d); r.templateId = id; delete r.blocks; });
        go(0, d);
      });
      q('[data-copy]').addEventListener('click', () => {
        let c;
        commit(P.copied, () => { c = makeTemplate(P.copyOf(t.name), t.blocks); });
        openTemplateEditor(c.id);
      });
      bindDelete(sheet, () => { commit(P.deleted, () => { delete state.templates[id]; }); openTemplatesSheet(); });
    }, openTemplatesSheet);
}

/* Lagre en justert dag som mal: endre malen dagen bruker, eller lag en ny mal fra en dato. */
function openSaveDaySheet() {
  const date = view, P = T.tpl;
  const curId = templateFor(date);
  const cur = state.templates[curId];
  const blocks = blocksFor(date);
  const defFrom = date >= todayISO() ? (date === todayISO() ? addDays(date, 1) : date) : addDays(todayISO(), 1);
  let autoName = P.defaultName(cur.name, fmtDateShort(defFrom));
  reopen = null;
  openSheet(h`${headHTML(P.saveDayTitle, true)}
    <form class="sh-body" id="sd" novalidate>
      <section class="grp"><h3>${fmtDateLong(date)}</h3>${hint(P.saveDayHint(blocks.length))}
        <div class="chips" role="radiogroup">
          <button type="button" class="chip" data-mode="new" aria-pressed="true">${P.modeNew}</button>
          <button type="button" class="chip" data-mode="replace" aria-pressed="false">${P.modeReplace(cur.name)}</button>
        </div>
      </section>
      <section class="grp" id="sd-new"><h3>${P.new}</h3>
        <div class="field"><label for="sd-name">${T.common.name}</label><input id="sd-name" type="text" value="${autoName}" autocomplete="off"></div>
        <div class="field"><label for="sd-from">${P.validFrom}</label><input id="sd-from" type="date" value="${defFrom}"></div>
        ${hint(P.newFromHint)}
      </section>
      <section class="grp" id="sd-rep" hidden><h3>${P.replaceHead}</h3>${hint(P.replaceHint(cur.name))}</section>
    </form>
    ${footSave(P.save)}`,
    (sheet, q) => {
      let mode = 'new';
      sheet.querySelectorAll('[data-mode]').forEach(c => c.addEventListener('click', () => {
        mode = c.dataset.mode;
        sheet.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === c));
        q('#sd-new').hidden = mode !== 'new';
        q('#sd-rep').hidden = mode !== 'replace';
      }));
      q('#sd-from').addEventListener('change', e => {
        const n = q('#sd-name');
        if (n.value === autoName && isDate(e.target.value)) { autoName = P.defaultName(cur.name, fmtDateShort(e.target.value)); n.value = autoName; }
      });
      q('[data-save]').addEventListener('click', () => {
        if (mode === 'replace') {
          closeSheet();
          commit(P.updated(cur.name), () => {
            state.templates[curId].blocks = stripPlan(blocks);
            const d = state.days[date];
            if (d) delete d.blocks;
          });
          return;
        }
        const name = q('#sd-name').value.trim(), from = q('#sd-from').value;
        if (!name) { q('#sd-name').focus(); return; }
        if (!isDate(from)) { q('#sd-from').focus(); return; }
        closeSheet();
        commit(P.validFromToast(name, fmtDateShort(from)), () => { const t = makeTemplate(name, blocks); scheduleFrom(from, t.id); });
      });
    });
}

/* ---------- gjøremål ---------- */
function openTasksSheet() {
  reopen = openTasksSheet;
  const G = T.tasks;
  const slots = allSlots();
  const slotLabel = t => { const s = slots.find(x => x.slot === t.slot); return s ? s.label : T.types[t.type] || ''; };
  const pending = state.tasks.filter(t => t.rule && t.rule.kind === 'once' && !completions(t.id).length);
  const recurring = state.tasks.filter(t => !t.rule || t.rule.kind !== 'once');
  const row = t => h`<div class="row sortrow" data-sort="${t.id}">${dragHandle(t.text)}<button type="button" class="row-main" data-task="${t.id}"><span class="grow">${t.text}<span class="m">${ruleText(t.rule) + ', ' + slotLabel(t)}</span></span><span class="r">›</span></button></div>`;
  openSheet(h`${headHTML(G.title, true)}
    <div class="sh-body">
      ${pending.length ? h`<section class="grp"><h3>${G.pending}</h3><div class="list" data-sortlist>${pending.map(row)}</div></section>` : ''}
      <section class="grp"><h3>${G.recurring}</h3>
      <div class="list" data-sortlist>${recurring.length ? recurring.map(row) : emptyRow(T.common.noneYet)}</div>
      ${pending.length + recurring.length > 1 ? hint(G.orderHint) : ''}
      <button type="button" class="btn wide" data-new-task>${G.new}</button>
      </section><button type="button" class="btn wide" data-add-husk>${G.remember}</button>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-task]').forEach(b => b.addEventListener('click', () => openTaskSheet(b.dataset.task)));
      sheet.querySelectorAll('[data-sortlist]').forEach(list => sortable(list, ids =>
        commit(T.common.orderSaved, () => { state.tasks = reorderSubset(state.tasks, ids); }, 'timeline')));
      q('[data-new-task]').addEventListener('click', () => openTaskSheet(null));
      q('[data-add-husk]').addEventListener('click', () => openAddSheet('husk'));
    });
}

function openTaskSheet(id) {
  const isNew = !id, G = T.tasks;
  const src = isNew
    ? { id: 't-' + uid(), text: '', slot: 'lur1', type: 'sleep', rule: { kind: 'interval', every: 7, start: todayISO() > state.leave.start ? todayISO() : state.leave.start, days: [] } }
    : state.tasks.find(t => t.id === id);
  if (!src) return;
  const t = clone(src);
  t.rule.days = t.rule.days || [];
  t.rule.every = t.rule.every || 7;
  t.rule.start = t.rule.start || todayISO();
  const slots = allSlots();
  const prev = completions(t.id).pop();
  reopen = null;
  openSheet(h`${headBack(isNew ? G.new : G.edit)}
    <form class="sh-body" id="tf" novalidate>
      <section class="grp"><h3>${G.group}</h3>
        <label for="t-text" class="vh">${G.group}</label><input id="t-text" type="text" value="${t.text}" autocomplete="off" placeholder="${G.ph}">
      </section>
      <section class="grp"><h3>${G.often}</h3>
        <label for="t-kind" class="vh">${G.often}</label><select id="t-kind">${options(Object.entries(G.kinds), t.rule.kind)}</select>
        <div class="field" id="t-every-f"><label for="t-every">${G.everyLabel}</label><input id="t-every" type="number" inputmode="numeric" min="1" max="60" value="${t.rule.every}">
          ${hint(G.everyHint(prev ? fmtDateShort(prev) : ''))}</div>
        <div class="field" id="t-days-f"><span class="lbl">${G.weekdays}</span><div class="chips">
          ${T.date.wdShort.map((w, i) => h`<button type="button" class="chip" data-wd="${i + 1}" aria-pressed="${t.rule.days.includes(i + 1)}">${w}</button>`)}
        </div></div>
        <div class="field"><label for="t-start" id="t-start-l">${G.firstTime}</label><input id="t-start" type="date" value="${t.rule.start}"></div>
      </section>
      <section class="grp"><h3>${G.shownIn}</h3>
        <label for="t-slot" class="vh">${G.shownIn}</label><select id="t-slot">${options(slots.map(s => [s.slot, s.label]), t.slot)}</select>
        ${hint(G.shownHint)}
      </section>
      ${isNew ? '' : delConfirm(G.del, G.delConfirm(t.text), T.common.del)}
    </form>
    ${footSave(G.save)}`,
    (sheet, q) => {
      const syncKind = () => {
        const k = q('#t-kind').value;
        q('#t-every-f').hidden = k !== 'interval';
        q('#t-days-f').hidden = k !== 'weekdays';
        q('#t-start-l').textContent = k === 'interval' ? G.firstTime : k === 'once' ? T.common.date : G.validFrom;
      };
      syncKind();
      q('#t-kind').addEventListener('change', syncKind);
      sheet.querySelectorAll('[data-wd]').forEach(c => c.addEventListener('click', () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true')));
      bindDelete(sheet, () => { commit(G.deleted, () => { state.tasks = state.tasks.filter(x => x.id !== t.id); }); openTasksSheet(); });
      q('[data-save]').addEventListener('click', () => {
        const text = q('#t-text').value.trim();
        if (!text) { q('#t-text').focus(); return; }
        t.text = text;
        t.rule = {
          kind: q('#t-kind').value,
          every: Math.max(1, Math.min(365, parseInt(q('#t-every').value, 10) || 7)),
          start: isDate(q('#t-start').value) ? q('#t-start').value : todayISO(),
          days: [...sheet.querySelectorAll('[data-wd][aria-pressed="true"]')].map(c => Number(c.dataset.wd))
        };
        t.slot = q('#t-slot').value;
        const sl = slots.find(s => s.slot === t.slot);
        t.type = sl ? sl.type : t.type;
        commit(G.savedToast, () => {
          const i = state.tasks.findIndex(x => x.id === t.id);
          if (i >= 0) state.tasks[i] = t; else state.tasks.push(t);
        });
        openTasksSheet();
      });
      if (isNew) setTimeout(() => q('#t-text').focus(), 300);
    }, openTasksSheet);
}

/* ---------- legg til: husk, avtale, helse eller bolk ---------- */
function openAddSheet(mode) {
  mode = mode || 'husk';
  reopen = null;
  const A = T.add;
  const tab = m => h`<button type="button" class="chip" data-mode="${m}" aria-pressed="${m === mode}">${A.tabs[m]}</button>`;
  let body = '';
  if (mode === 'helse') body = h`<section class="grp"><h3>${T.log.health}</h3>${healthFormHTML(view)}${hint(A.healthHint)}</section>`;
  if (mode === 'husk') body = h`<section class="grp"><h3>${A.remember}</h3>
      <label for="q-text" class="vh">${A.rememberAria}</label><input id="q-text" type="text" placeholder="${A.rememberPh}" autocomplete="off">
      <div class="field"><label for="q-when">${A.when}</label><select id="q-when">${options(Object.entries(A.whenOpts), 'lur')}</select></div>
      ${hint(A.rememberHint)}
    </section>`;
  if (mode === 'avtale') body = apptFormHTML({ date: view, start: '10:00', minutes: 60, title: '', where: '', note: '' });
  if (mode === 'bolk') body = h`<section class="grp">${hint(A.blockHint(view === todayISO() ? T.date.today : fmtDateTiny(view)))}<button type="button" class="btn primary wide" data-bolk>${A.newBlock}</button></section>`;
  openSheet(h`${headHTML(A.title)}
    <form class="sh-body" id="qa" novalidate>
      <div class="chips">${['husk', 'avtale', 'helse', 'bolk'].map(tab)}</div>
      ${body}
    </form>
    ${mode === 'bolk' ? '' : footSave(mode === 'avtale' ? T.appt.save : T.common.add)}`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-mode]').forEach(c => c.addEventListener('click', () => openAddSheet(c.dataset.mode)));
      if (mode === 'bolk') { q('[data-bolk]').addEventListener('click', () => openBlockSheet(null)); return; }
      if (mode === 'husk') {
        setTimeout(() => q('#q-text').focus(), 300);
        q('#q-text').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); q('[data-save]').click(); } });
        q('[data-save]').addEventListener('click', () => {
          const text = q('#q-text').value.trim();
          if (!text) { q('#q-text').focus(); return; }
          const tg = reminderTarget(q('#q-when').value);
          closeSheet();
          commit(A.remembered(text, tg.label), () => { state.tasks.push({ id: 't-' + uid(), text, slot: tg.slot, type: tg.type, rule: { kind: 'once', start: tg.date } }); });
        });
      }
      if (mode === 'avtale') bindApptForm(sheet, null);
      if (mode === 'helse') q('[data-save]').addEventListener('click', () => {
        const x = readHealth(sheet); if (!x) return;
        closeSheet();
        commit(T.log.healthToast(kidName(x.kid), T.health[x.kind], x.value, x.time), () => addHealth(view, x));
      });
    });
}

/* ---------- avtaler ---------- */
function apptFormHTML(a) {
  const P = T.appt;
  return h`<section class="grp"><h3>${P.group}</h3>
    <div class="field"><label for="ap-title">${P.what}</label><input id="ap-title" type="text" value="${a.title}" placeholder="${P.whatPh}" autocomplete="off"></div>
    <div class="row2"><div class="field"><label for="ap-date">${T.common.date}</label><input id="ap-date" type="date" value="${a.date}"></div>
    <div class="field"><label for="ap-start">${T.common.time}</label><input id="ap-start" type="time" value="${a.start}"></div></div>
    <div class="field"><label for="ap-min">${T.common.minutes}</label><input id="ap-min" type="number" inputmode="numeric" min="0" max="600" value="${a.minutes || 0}"></div>
    <div class="field"><label for="ap-where">${P.where}</label><input id="ap-where" type="text" value="${a.where}" autocomplete="off"></div>
    <div class="field"><label for="ap-note">${T.common.note}</label><textarea id="ap-note" rows="2">${a.note}</textarea></div>
    ${hint(P.hint)}</section>`;
}
function bindApptForm(sheet, id) {
  const q = s => sheet.querySelector(s);
  q('[data-save]').addEventListener('click', () => {
    const title = q('#ap-title').value.trim(), date = q('#ap-date').value, start = q('#ap-start').value;
    if (!title) { q('#ap-title').focus(); return; }
    if (!isDate(date) || !isTime(start)) { toast(T.appt.pickTime); return; }
    const a = { id: id || 'ap-' + uid(), title, date, start, minutes: Math.max(0, parseInt(q('#ap-min').value, 10) || 0), where: q('#ap-where').value.trim(), note: q('#ap-note').value.trim() };
    closeSheet();
    commit(T.appt.saved(fmtDateTiny(date), start), () => {
      state.appts = state.appts || [];
      const i = state.appts.findIndex(x => x.id === a.id);
      if (i >= 0) state.appts[i] = a; else state.appts.push(a);
    });
  });
}
function openApptSheet(id) {
  const a = (state.appts || []).find(x => x.id === id);
  if (!a) return;
  reopen = null;
  openSheet(h`${headHTML(T.appt.group)}
    <form class="sh-body" id="apf" novalidate>${apptFormHTML(a)}${delConfirm(T.appt.del)}</form>
    ${footSave(T.appt.save)}`,
    sheet => {
      bindApptForm(sheet, id);
      bindDelete(sheet, () => { closeSheet(); commit(T.appt.deleted, () => { state.appts = state.appts.filter(x => x.id !== id); }); });
    });
}
