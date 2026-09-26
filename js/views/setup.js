'use strict';
/* ---------- ark for oppsett: profil, partner og turnus, backup, aktiviteter, import og eksport ---------- */

const placeLabel = p => p ? p.name + ', ' + p.lat.toFixed(3) + ' / ' + p.lon.toFixed(3) : T.profile.notChosen;
const chipSet = (attr, pairs, cur) => pairs.map(([k, l]) => h`<button type="button" class="chip" ${raw(attr)}="${k}" aria-pressed="${cur(k)}">${l}</button>`);

function openProfileSheet(firstRun) {
  reopen = firstRun ? null : () => openProfileSheet(false);
  const P = T.profile;
  let place = state.place ? clone(state.place) : null;
  const kidRow = k => h`<div class="item" data-kid="${k.id}" data-sort="${k.id}">${dragHandle(k.name || T.common.name)}<input type="text" value="${k.name}" aria-label="${T.common.name}" autocomplete="off"><button type="button" class="icon-btn sm" data-rm aria-label="${T.common.remove}">${ICON_X}</button></div>`;
  const display = firstRun ? '' : h`<section class="grp"><h3>${P.display}</h3><div class="chips">${chipSet('data-show', Object.entries(P.show), showOn)}</div>
      ${hint(P.showHint)}
      <span class="lbl">${P.theme}</span><div class="chips">${chipSet('data-theme-set', Object.entries(P.themes), k => (state.settings.theme || 'dark') === k)}</div>
      <span class="lbl">${P.textSize}</span><div class="chips">${chipSet('data-size-set', Object.entries(P.sizes), k => (Number(state.settings.textSize) || 1) === Number(k))}</div>
      ${hint(P.themeHint)}</section>`;
  const firstRunParts = !firstRun ? '' : h`<section class="grp"><h3>${P.rhythm}</h3><label for="p-tpl" class="vh">${P.napsAria}</label><select id="p-tpl">${options(Object.values(state.templates).map(t => [t.id, t.name]))}</select>
      ${hint(P.rhythmHint)}</section>
    <section class="grp"><h3>${P.partner}</h3>
      <button type="button" class="chip" data-p-on aria-pressed="false">${T.common.no}</button>
      <div class="field" id="p-pn-f" hidden><label for="p-pn">${T.partner.nameInApp}</label><input id="p-pn" type="text" value="${partnerName()}" autocomplete="off"></div>
      ${hint(P.partnerHint)}</section>`;
  openSheet(h`<div class="sh-head"><h2>${firstRun ? P.welcome : P.title}</h2>
      ${firstRun ? h`<button type="button" class="btn ghost" data-close>${T.common.later}</button>` : h`<button type="button" class="btn ghost" data-back>${T.common.back}</button>`}</div>
    <form class="sh-body" id="pf" novalidate>
      ${firstRun ? h`<section class="grp"><h3>${P.haveFile}</h3>
        <label class="btn wide" for="f-start-import">${P.importFile}</label><input type="file" id="f-start-import" class="vh" accept="application/json,.json">
        ${hint(P.importHint)}</section>` : ''}
      <section class="grp"><h3>${P.kids}</h3><div class="items" id="p-kids">${state.kids.map(kidRow)}</div>
        <button type="button" class="btn small wide" data-add-kid>${P.addKid}</button>
        <div class="field"><label for="p-kw">${P.kidsWord}</label><input id="p-kw" type="text" value="${kidsWord()}" autocomplete="off" autocapitalize="off"></div>
        ${hint(P.kidsWordHint)}</section>
      <section class="grp"><h3>${P.place}</h3>
        <p class="hint" id="p-place">${placeLabel(place)}</p>
        <div class="item"><input type="text" id="p-q" placeholder="${P.searchPh}" autocomplete="off" aria-label="${P.searchAria}"><button type="button" class="btn small" data-search>${P.search}</button></div>
        <div class="list" id="p-results" hidden></div>
        <button type="button" class="btn small wide" data-geo>${P.geo}</button>
        ${hint(P.placeHint)}
      </section>
      <section class="grp"><h3>${P.leave}</h3><div class="row2">
        <div class="field"><label for="p-ls">${P.first}</label><input type="date" id="p-ls" value="${state.leave.start}"></div>
        <div class="field"><label for="p-le">${P.last}</label><input type="date" id="p-le" value="${state.leave.end}"></div>
      </div></section>
      ${display}${firstRunParts}
    </form>
    ${footSave(firstRun ? P.start : P.save)}`,
    (sheet, q) => {
      const setPlace = p => { place = p; q('#p-place').textContent = placeLabel(p); q('#p-results').hidden = true; };
      q('[data-add-kid]').addEventListener('click', () => {
        q('#p-kids').insertAdjacentHTML('beforeend', toHtml(kidRow({ id: 'b-' + uid(), name: '' })));
        q('#p-kids').lastElementChild.querySelector('input').focus();
      });
      sortable(q('#p-kids'));   // rekkefølgen lagres med profilen
      q('#p-kids').addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm && q('#p-kids').children.length > 1) rm.closest('.item').remove(); });
      const search = async () => {
        const term = q('#p-q').value.trim();
        if (!term) return;
        const out = q('#p-results');
        out.hidden = false; setHtml(out, emptyRow(P.searching));
        try {
          const r = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=6&language=nb&format=json&name=' + encodeURIComponent(term));
          const j = await r.json();
          const res = (j.results || []).filter(x => Number.isFinite(x.latitude) && Number.isFinite(x.longitude));
          setHtml(out, res.length ? res.map((x, i) => h`<button type="button" class="row" data-pick="${i}"><span class="grow">${x.name}<span class="m">${[x.admin2, x.admin1, x.country].filter(Boolean).join(', ')}</span></span></button>`)
            : emptyRow(P.notFound));
          out.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => { const x = res[Number(b.dataset.pick)]; setPlace({ name: String(x.name), lat: x.latitude, lon: x.longitude }); }));
        } catch (e) { setHtml(out, emptyRow(P.offline)); }
      };
      q('[data-search]').addEventListener('click', search);
      q('#p-q').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      q('[data-geo]').addEventListener('click', () => {
        if (!navigator.geolocation) { toast(P.noGeo); return; }
        navigator.geolocation.getCurrentPosition(
          p => setPlace({ name: (place && place.name) || P.home, lat: Math.round(p.coords.latitude * 1e4) / 1e4, lon: Math.round(p.coords.longitude * 1e4) / 1e4 }),
          () => toast(P.geoDenied),
          { timeout: 10000 });
      });
      const setting = (attr, apply) => sheet.querySelectorAll('[' + attr + ']').forEach(c => c.addEventListener('click', () => {
        commit(null, () => apply(c), 'none');
        applyTheme(); render();
      }));
      setting('data-theme-set', c => { state.settings.theme = c.dataset.themeSet; sheet.querySelectorAll('[data-theme-set]').forEach(x => x.setAttribute('aria-pressed', x === c)); });
      setting('data-size-set', c => { state.settings.textSize = Number(c.dataset.sizeSet); sheet.querySelectorAll('[data-size-set]').forEach(x => x.setAttribute('aria-pressed', x === c)); });
      setting('data-show', c => { const k = c.dataset.show, on = !showOn(k); state.settings.show = Object.assign({}, state.settings.show, { [k]: on }); c.setAttribute('aria-pressed', on); });
      let pOn = false;
      const pBtn = q('[data-p-on]');
      if (pBtn) pBtn.addEventListener('click', () => { pOn = !pOn; pBtn.setAttribute('aria-pressed', pOn); pBtn.textContent = pOn ? T.common.yes : T.common.no; q('#p-pn-f').hidden = !pOn; });
      const imp = q('#f-start-import');
      if (imp) imp.addEventListener('change', e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
      q('[data-save]').addEventListener('click', () => {
        const kids = [...sheet.querySelectorAll('#p-kids .item')].map(r => ({ id: r.dataset.kid, name: r.querySelector('input').value.trim() })).filter(k => k.name);
        if (!kids.length) { toast(P.needName); return; }
        const ls = q('#p-ls').value, le = q('#p-le').value;
        if (!isDate(ls) || !isDate(le) || le < ls) { toast(P.checkDates); return; }
        const o = { kids, place, leave: { start: ls, end: le }, kidsWord: q('#p-kw').value.trim() || T.kids.word };
        if (firstRun) { o.templateId = q('#p-tpl').value; o.partnerEnabled = pOn; o.partnerName = pOn ? (q('#p-pn').value.trim() || T.partner.defaultName) : null; }
        closeSheet();
        commit(firstRun ? P.ready : P.saved, () => applySetup(o));
        if (firstRun) { view = todayISO(); render(); scrollToNow(); }
      });
    });
}

/* ---------- partner og turnus ---------- */
function openPartnerSheet() {
  reopen = openPartnerSheet;
  const Pn = state.partner, P = T.partner;
  const codes = Object.entries(Pn.codes).sort((a, b) => a[0].localeCompare(b[0], 'nb', { numeric: true }));
  const today = todayISO();
  const days = [...Array(21)].map((_, i) => addDays(view < today ? today : view, i));
  const codeMeta = d => d.kind === 'off' ? P.codeOff : (d.kind === 'night' ? P.codeNight : '') + (d.start && d.end ? d.start + '–' + d.end : P.noTimes);
  openSheet(h`${headHTML(P.title, true)}
    <div class="sh-body">
      <section class="grp"><h3>${P.group}</h3>
        <button type="button" class="chip" data-p-on aria-pressed="${!!Pn.enabled}">${Pn.enabled ? P.on : P.isOff}</button>
        <div class="row2">
          <div class="field"><label for="p-name">${P.nameInApp}</label><input id="p-name" type="text" value="${Pn.name}" autocomplete="off"></div>
          <div class="field"><label for="p-com">${P.commute}</label><input id="p-com" type="number" inputmode="numeric" min="0" max="180" value="${Number(Pn.commute) || 0}"></div>
        </div>
        ${hint(P.commuteHint(Pn.name))}
      </section>
      <section class="grp"><h3>${P.importHead}</h3>
        <label class="btn wide" for="p-import">${P.importBtn}</label><input type="file" id="p-import" class="vh" accept=".json,.txt,text/plain,application/json">
        ${hint(P.importHint)}
      </section>
      <section class="grp"><h3>${P.codes}</h3><div class="list">
        ${codes.map(([c, d]) => h`<button type="button" class="row" data-code="${c}"><span class="grow">${c}<span class="m">${[d.label, codeMeta(d)].filter(Boolean).join(', ')}</span></span><span class="r">›</span></button>`)}
      </div><button type="button" class="btn wide" data-new-code>${P.newCode}</button></section>
      <section class="grp"><h3>${P.next3}</h3><div class="list">
        ${days.map(d => h`<div><span class="grow"><span class="wd">${fmtDateTiny(d)}</span></span>
          <label class="vh" for="sd-${d}">${P.shiftAria(d)}</label><select id="sd-${d}" class="sel-sm" data-sd="${d}">${options([['', '–'], ...codes.map(([c]) => [c, c])], Pn.shifts[d] || '')}</select></div>`)}
      </div>${hint(P.emptyHint)}</section>
    </div>`,
    (sheet, q) => {
      q('[data-p-on]').addEventListener('click', () => { commit(Pn.enabled ? P.toastOff : P.toastOn, () => { state.partner.enabled = !state.partner.enabled; }); openPartnerSheet(); });
      q('#p-name').addEventListener('change', e => { const v = e.target.value.trim() || P.defaultName; commit(T.common.nameSaved, () => { state.partner.name = v; }); });
      q('#p-com').addEventListener('change', e => { const v = Math.max(0, Math.min(180, parseInt(e.target.value, 10) || 0)); commit(P.commuteSaved, () => { state.partner.commute = v; }); });
      q('#p-import').addEventListener('change', e => { const f = e.target.files[0]; if (f) importRota(f); e.target.value = ''; });
      sheet.querySelectorAll('[data-code]').forEach(b => b.addEventListener('click', () => openCodeSheet(b.dataset.code)));
      q('[data-new-code]').addEventListener('click', () => openCodeSheet(null));
      sheet.querySelectorAll('[data-sd]').forEach(s => s.addEventListener('change', () => {
        const d = s.dataset.sd, v = s.value;
        commit(P.shiftToast(fmtDateTiny(d), v), () => { if (v) state.partner.shifts[d] = v; else delete state.partner.shifts[d]; });
      }));
    });
}

function openCodeSheet(code) {
  const isNew = !code, P = T.partner;
  const src = isNew ? { label: '', kind: 'work', start: '07:00', end: '15:00' } : state.partner.codes[code];
  if (!src) return;
  const d = clone(src);
  reopen = null;
  openSheet(h`${headBack(isNew ? P.newCode : P.codeTitle(code))}
    <form class="sh-body" id="cf" novalidate>
      <section class="grp"><h3>${P.code}</h3>
        <div class="row2">
          <div class="field"><label for="c-code">${P.code}</label><input id="c-code" type="text" value="${code || ''}" autocomplete="off" autocapitalize="characters"${isNew ? '' : raw(' readonly')}></div>
          <div class="field"><label for="c-kind">${T.common.type}</label><select id="c-kind">${options(Object.entries(P.kinds), d.kind)}</select></div>
        </div>
        <div class="field"><label for="c-label">${P.label}</label><input id="c-label" type="text" value="${d.label}" autocomplete="off"></div>
        <div class="row2" id="c-times">
          <div class="field"><label for="c-start">${T.common.from}</label><input id="c-start" type="time" value="${d.start || ''}"></div>
          <div class="field"><label for="c-end">${T.common.to}</label><input id="c-end" type="time" value="${d.end || ''}"></div>
        </div>
      </section>
      ${isNew ? '' : delConfirm(P.delCode)}
    </form>
    ${footSave(P.saveCode)}`,
    (sheet, q) => {
      const syncKind = () => { q('#c-times').hidden = q('#c-kind').value === 'off'; };
      syncKind(); q('#c-kind').addEventListener('change', syncKind);
      bindDelete(sheet, () => { commit(P.codeDeleted(code), () => { delete state.partner.codes[code]; }); openPartnerSheet(); });
      q('[data-save]').addEventListener('click', () => {
        const c = (q('#c-code').value || '').trim().toUpperCase();
        if (!c) { q('#c-code').focus(); return; }
        const kind = q('#c-kind').value;
        const t = v => isTime(v) ? v : '';
        const def = { label: q('#c-label').value.trim(), kind, start: kind === 'off' ? '' : t(q('#c-start').value), end: kind === 'off' ? '' : t(q('#c-end').value) };
        commit(P.codeSaved(c), () => { state.partner.codes[c] = def; });
        openPartnerSheet();
      });
    }, openPartnerSheet);
}

/* ---------- backup ---------- */
function openSyncSheet() {
  reopen = openSyncSheet;
  const c = sync.cfg, S = T.sync;
  const le = state.meta.lastExport;
  const auto = syncOn()
    ? h`<p class="hint">${S.connectedTo}<strong>${c.owner + '/' + c.repo}</strong>${S.file(c.path)}</p>
      ${hint((c.lastPush ? S.lastSaved(fmtStamp(c.lastPush)) : S.notSaved) + (c.dirty ? S.pending : ''))}
      ${c.lastError ? h`<p class="hint warn-text">${c.lastError}</p>` : ''}
      <button type="button" class="btn primary wide" data-push>${S.saveNow}</button>
      <button type="button" class="btn wide" data-pull>${S.pull}</button>
      <div class="confirm" id="s-confirm" hidden>${hint(S.pullConfirm)}<button type="button" class="btn small danger" data-pull-yes>${S.replace}</button></div>
      <button type="button" class="btn link" data-disconnect>${S.disconnect}</button>`
    : h`${hint(S.intro)}
      <div class="row2">
        <div class="field"><label for="s-owner">${S.owner}</label><input id="s-owner" type="text" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
        <div class="field"><label for="s-repo">${S.repo}</label><input id="s-repo" type="text" value="dogn-data" autocomplete="off" autocapitalize="off" spellcheck="false"></div>
      </div>
      <div class="field"><label for="s-token">${S.token}</label><input id="s-token" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="github_pat_…"></div>
      ${hint(S.tokenHint)}
      <button type="button" class="btn primary wide" data-connect>${S.connect}</button>
      ${hint(S.noSyncHint)}`;
  openSheet(h`${headHTML(S.title, true)}
    <div class="sh-body">
      <section class="grp"><h3>${S.auto}</h3>${auto}</section>
      <section class="grp"><h3>${S.fileHead}</h3>
        ${hint((le ? S.lastFile(fmtDateShort(le)) : S.noFile) + S.fileWhere)}
        <button type="button" class="btn wide" data-export>${S.export}</button>
        <label class="btn wide" for="m-import">${S.import}</label><input type="file" id="m-import" class="vh" accept="application/json,.json">
      </section>
    </div>`,
    (sheet, q) => {
      q('[data-export]').addEventListener('click', exportData);
      q('#m-import').addEventListener('change', e => { const f = e.target.files[0]; if (f) importData(f); e.target.value = ''; });
      const on = (sel, fn) => { const el = q(sel); if (el) el.addEventListener('click', fn); };
      on('[data-push]', async () => { q('[data-push]').textContent = S.saving; const ok = await pushNow(); toast(ok ? S.saved : S.failed); });
      on('[data-pull]', () => { q('#s-confirm').hidden = false; });
      on('[data-pull-yes]', async () => {
        try { const obj = await pullSync(); closeSheet(); commit(S.pulled, () => { state = obj; }); applyTheme(); }
        catch (e) { toast(netMessage(e, S.noContactShort)); }
      });
      on('[data-disconnect]', () => { disconnectSync(); openSyncSheet(); toast(S.disconnected); });
      on('[data-connect]', async () => {
        const owner = q('#s-owner').value.trim(), repo = q('#s-repo').value.trim(), token = q('#s-token').value.trim();
        if (!owner || !repo || !token) { toast(S.fillIn); return; }
        q('[data-connect]').textContent = S.connecting;
        try {
          const res = await connectSync(owner, repo, token);
          openSyncSheet();
          toast(res.isPublic ? S.publicRepo : (res.ok ? S.connectedSaved : S.connectedFailed));
        } catch (e) { q('[data-connect]').textContent = S.connect; toast(netMessage(e, S.noContactShort)); }
      });
    });
}

async function exportData() {
  const name = 'dogn-backup-' + todayISO() + '.json', F = T.file;
  const copy = clone(state);
  copy.meta.lastExport = todayISO();
  const json = JSON.stringify(copy, null, 1);
  const done = msg => {
    commit(null, () => { state.meta.lastExport = todayISO(); dayRec(todayISO()).done['gen-backup'] = true; });
    if (sheetOpen() && reopen) reopen();
    toast(msg);
  };
  let file = null;
  try { file = new File([json], name, { type: 'application/json' }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); done(F.exported); return; }
    catch (e) { if (e && e.name === 'AbortError') return; }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    done(F.downloaded);
  } catch (e) { toast(F.exportFailed); }
}
/* Innlesing går alltid gjennom migrate(), som oppgraderer og kontrollerer dataene */
function importData(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = migrate(JSON.parse(r.result));
      closeSheet();
      commit(T.file.imported, () => { state = obj; });
      applyTheme();
    } catch (e) { toast(e instanceof UserError ? e.message : T.file.notReadable); }
  };
  r.onerror = () => toast(T.file.readFailed);
  r.readAsText(file);
}
function importRota(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const rota = parseRota(String(r.result));
      let unknown = [];
      commit(T.partner.imported(Object.keys(rota.shifts).length), () => { unknown = applyRota(rota); });
      openPartnerSheet();
      if (unknown.length) toast(T.partner.needTimes(unknown.join(', ')));
    } catch (e) { toast(e instanceof UserError ? e.message : T.partner.notRota); }
  };
  r.readAsText(file);
}

/* ---------- aktiviteter ---------- */
function openSuggestSheet(date, blockId) {
  const blocks = blocksFor(date), A = T.acts;
  const i = blocks.findIndex(x => x.id === blockId);
  if (i < 0) return;
  const s = toMin(blocks[i].start), e = endOf(blocks, i);
  const res = suggest(date, s, e);
  const rest = state.activities.filter(a => !res.list.includes(a));
  reopen = null;
  const row = a => h`<button type="button" class="row" data-pick="${a.id}"><span class="grow">${a.name}<span class="m">${actMeta(a)}</span></span><span class="r">›</span></button>`;
  openSheet(h`${headHTML(A.suggestTitle(blocks[i].start, toHM(e)))}
    <div class="sh-body">
      ${hint(res.w ? wxText(res.w) : A.noWeather)}
      <section class="grp"><h3>${A.fits}</h3><div class="list">${res.list.length ? res.list.map(row) : emptyRow(A.noHits)}</div></section>
      ${rest.length ? h`<section class="grp"><h3>${A.fitsLess}</h3><div class="list">${rest.map(row)}</div>${hint(A.fitsLessHint)}</section>` : ''}
      <button type="button" class="btn wide" data-lib>${A.openLib}</button>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
        closeSheet();
        commit(null, () => setPick(date, blockId, b.dataset.pick), 'timeline');
      }));
      q('[data-lib]').addEventListener('click', openActivitiesSheet);
    });
}

function openActivitiesSheet() {
  reopen = openActivitiesSheet;
  const A = T.acts;
  const acts = [...state.activities].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'ute' ? 1 : -1) || a.name.localeCompare(b.name));
  const list = kind => {
    const rows = acts.filter(a => a.kind === kind).map(a => h`<button type="button" class="row" data-aid="${a.id}"><span class="grow">${a.name}<span class="m">${actMeta(a)}</span></span><span class="r">›</span></button>`);
    return rows.length ? rows : emptyRow(T.common.noneYet);
  };
  openSheet(h`${headHTML(A.title, true)}
    <div class="sh-body">
      <section class="grp"><h3>${A.inside}</h3><div class="list">${list('inne')}</div></section>
      <section class="grp"><h3>${A.outside}</h3><div class="list">${list('ute')}</div></section>
      <button type="button" class="btn primary wide" data-new>${A.new}</button>
      <section class="grp"><h3>${A.pack}</h3><label for="pk-list" class="vh">${A.packAria}</label>
        <textarea id="pk-list" rows="6">${packList().join('\n')}</textarea>
        ${hint(A.packHint)}</section>
      <p class="hint">${A.credit1}<a class="lnk" href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo</a>${A.credit2}</p>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-aid]').forEach(b => b.addEventListener('click', () => openActivitySheet(b.dataset.aid)));
      q('[data-new]').addEventListener('click', () => openActivitySheet(null));
      q('#pk-list').addEventListener('change', e => {
        const list = e.target.value.split('\n').map(x => x.trim()).filter(Boolean);
        commit(A.packSaved, () => { state.settings.packList = list; });
      });
    });
}

function openActivitySheet(id) {
  const isNew = !id, A = T.acts;
  const src = isNew ? { id: 'a-' + uid(), name: '', kind: 'inne', minutes: 30, weather: 'any', travel: 'hjemme', where: '', note: '', url: '', days: [], from: '', to: '' } : state.activities.find(a => a.id === id);
  if (!src) return;
  const a = clone(src);
  a.days = a.days || [];
  reopen = null;
  openSheet(h`${headBack(isNew ? A.new : A.edit)}
    <form class="sh-body" id="af" novalidate>
      <section class="grp"><h3>${A.group}</h3>
        <div class="field"><label for="a-name">${T.common.name}</label><input id="a-name" type="text" value="${a.name}" autocomplete="off"></div>
        <div class="row2">
          <div class="field"><label for="a-kind">${A.inOut}</label><select id="a-kind">${options([['inne', A.inside], ['ute', A.outside]], a.kind)}</select></div>
          <div class="field"><label for="a-min">${T.common.minutes}</label><input id="a-min" type="number" inputmode="numeric" min="5" max="300" value="${a.minutes}"></div>
        </div>
        <div class="row2">
          <div class="field" id="a-w-f"><label for="a-w">${A.weatherLbl}</label><select id="a-w">${options([['any', A.anyWeather], ['dry', A.dry]], a.weather === 'dry' ? 'dry' : 'any')}</select></div>
          <div class="field"><label for="a-tr">${A.travel}</label><select id="a-tr">${options(Object.entries(T.travel), a.travel)}</select></div>
        </div>
      </section>
      <section class="grp"><h3>${A.fixed}</h3>
        <div class="chips">${T.date.wdShort.map((w, i) => h`<button type="button" class="chip" data-wd="${i + 1}" aria-pressed="${a.days.includes(i + 1)}">${w}</button>`)}</div>
        <div class="row2">
          <div class="field"><label for="a-from">${T.common.from}</label><input id="a-from" type="time" value="${a.from || ''}"></div>
          <div class="field"><label for="a-to">${T.common.to}</label><input id="a-to" type="time" value="${a.to || ''}"></div>
        </div>
        ${hint(A.fixedHint)}
      </section>
      <section class="grp"><h3>${A.details}</h3>
        <div class="field"><label for="a-where">${A.where}</label><input id="a-where" type="text" value="${a.where}" autocomplete="off"></div>
        <div class="field"><label for="a-note">${T.common.note}</label><textarea id="a-note" rows="2">${a.note}</textarea></div>
        <div class="field"><label for="a-url">${A.url}</label><input id="a-url" type="text" inputmode="url" value="${a.url}" autocomplete="off" autocapitalize="off" placeholder="https://"></div>
      </section>
      ${isNew ? '' : delConfirm(A.del)}
    </form>
    ${footSave(A.save)}`,
    (sheet, q) => {
      const syncKind = () => { q('#a-w-f').hidden = q('#a-kind').value !== 'ute'; };
      syncKind(); q('#a-kind').addEventListener('change', syncKind);
      sheet.querySelectorAll('[data-wd]').forEach(c => c.addEventListener('click', () => c.setAttribute('aria-pressed', c.getAttribute('aria-pressed') !== 'true')));
      bindDelete(sheet, () => { commit(A.deleted, () => { state.activities = state.activities.filter(x => x.id !== a.id); }); openActivitiesSheet(); });
      q('[data-save]').addEventListener('click', () => {
        const name = q('#a-name').value.trim();
        if (!name) { q('#a-name').focus(); return; }
        const url = q('#a-url').value.trim();
        const t = v => isTime(v) ? v : '';
        Object.assign(a, {
          name, kind: q('#a-kind').value, minutes: Math.max(5, parseInt(q('#a-min').value, 10) || 30),
          weather: q('#a-kind').value === 'ute' ? q('#a-w').value : 'any', travel: q('#a-tr').value,
          days: [...sheet.querySelectorAll('[data-wd][aria-pressed="true"]')].map(c => Number(c.dataset.wd)),
          from: t(q('#a-from').value), to: t(q('#a-to').value),
          where: q('#a-where').value.trim(), note: q('#a-note').value.trim(),
          url: safeUrl(/^https?:\/\//i.test(url) ? url : (url ? 'https://' + url : ''))
        });
        commit(A.savedToast, () => {
          const i = state.activities.findIndex(x => x.id === a.id);
          if (i >= 0) state.activities[i] = a; else state.activities.push(a);
        });
        openActivitiesSheet();
      });
    }, openActivitiesSheet);
}
