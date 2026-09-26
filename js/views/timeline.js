'use strict';
/* ---------- tidslinjen, toppen og nå-kortet ---------- */
function render() { renderHeader(); renderTimeline(); refreshWeather(); }

/* Tema og tekststørrelse. Tekststørrelsen skalerer rem-enhetene (bare tekst), ikke hele siden. */
function applyTheme() {
  const st = (state && state.settings) || {};
  const pref = st.theme || 'dark';
  const light = pref === 'light' || (pref === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
  document.documentElement.dataset.theme = light ? 'light' : 'dark';
  const z = Number(st.textSize) || 1;
  document.documentElement.style.fontSize = z === 1 ? '' : (z * 100) + '%';
  const meta = document.querySelector('meta[name="theme-color"]');
  const bar = getComputedStyle(document.documentElement).getPropertyValue('--bar').trim();
  if (meta && bar) meta.setAttribute('content', bar);
}

function renderHeader() {
  const H = T.top;
  { const dd = parseISO(view); const big = (Number(state.settings.textSize) || 1) > 1;
    $('#date').textContent = (big ? wdShort(isoWd(view)).toLowerCase() : T.date.wd[dd.getDay()]) + ' ' + dd.getDate() + '. ' + T.date.moShort[dd.getMonth()]; }
  const L = state.leave, parts = [];
  const kv = (k, v, cls) => h`<span class="${cls || ''}"><span class="k">${k}</span> ${v}</span>`;
  if (view < L.start) parts.push(kv(H.startsIn, plural(diffDays(view, L.start), T.n.dag), 'acc'));
  else if (view > L.end) parts.push(kv(H.leave, H.leaveDone, 'acc'));
  else parts.push(kv(H.day, (diffDays(L.start, view) + 1) + '/' + (diffDays(L.start, L.end) + 1), 'acc'));
  const ps = partnerStatus(view);
  if (ps && ps.code) parts.push(kv(partnerName().toLowerCase(), shiftText(ps).replace(/(\d\d):00/g, '$1')));
  const d = state.days[view];
  if (d && (d.blocks || d.templateId)) parts.push(kv(H.template, state.templates[templateFor(view)].name.toLowerCase() + '*'));
  setHtml($('#sub'), parts.map((p, i) => i ? h`<span class="sep">·</span>${p}` : p));
  renderStrip();
  renderNowbar();
  document.documentElement.style.setProperty('--head-h', $('#top').offsetHeight + 'px');
  $('#tab-today').setAttribute('aria-current', view === todayISO() ? 'date' : 'false');
}

/* Dagstripen: dagens bolker som en tynn stripe i typefarger, med markør for nå */
function stripHTML(blocks, date, interactive) {
  if (!blocks.length) return '';
  const a = toMin(blocks[0].start), z = endOf(blocks, blocks.length - 1), span = Math.max(1, z - a);
  const now = nowMin(), isToday = date === todayISO();
  const segs = blocks.map((b, i) => {
    const s = toMin(b.start), e = endOf(blocks, i);
    const past = isToday && e <= now;
    return h`<span class="seg-${b.type}${past ? ' past' : ''}" style="left:${((s - a) / span * 100).toFixed(2)}%;width:${((e - s) / span * 100).toFixed(2)}%"></span>`;
  });
  const mark = isToday && now >= a && now <= z ? h`<i class="mark" style="left:${((now - a) / span * 100).toFixed(2)}%"></i>` : '';
  return h`<div class="strip${interactive ? ' live' : ''}" data-a="${a}" data-z="${z}"${interactive ? raw(' role="img"') : ''} aria-label="${T.tl.stripAria}"><div class="bar">${segs}${mark}</div></div>`;
}
function renderStrip() {
  const el = $('#strip');
  if (el) setHtml(el, stripHTML(blocksFor(view), view, true));
}

function bannerHTML() {
  const out = [sickBannerHTML(view)], B = T.banner;
  if (!store.ok) out.push(h`<div class="banner warn">${B.noStorage}</div>`);
  const today = todayISO();
  if (view === today && syncOn()) {
    const c = sync.cfg;
    if (c.lastError) out.push(h`<div class="banner warn"><span>${B.syncError(c.lastError)}</span><button type="button" class="btn small" data-act="sync">${B.retry}</button></div>`);
    else if (c.dirty && c.lastPush && Date.now() - Date.parse(c.lastPush) > 2 * 864e5) out.push(h`<div class="banner"><span>${B.lastSync(fmtStamp(c.lastPush))}</span><button type="button" class="btn small" data-act="sync">${B.saveNow}</button></div>`);
  } else if (view === today) {
    const le = state.meta.lastExport;
    const since = le ? diffDays(le, today) : null;
    const need = le ? since >= 8 : diffDays(state.meta.created, today) >= 8;
    if (need) out.push(h`<div class="banner"><span>${le ? B.lastExport(since) : B.noBackup}</span><button type="button" class="btn small" data-act="export">${B.export}</button></div>`);
  }
  return out;
}

function renderTimeline() {
  if (!state) return;
  const date = view, today = todayISO(), isToday = date === today, now = nowMin();
  const blocks = blocksFor(date);
  const placed = placeTasks(date, blocks);
  const gen = genRows(date, blocks);
  const pack = packRows(date, blocks);
  Object.entries(pack).forEach(([k, v]) => { gen[k] = (gen[k] || []).concat(v); });
  const appts = apptsFor(date);
  let cur = -1;
  if (isToday) {
    blocks.forEach((b, i) => { if (toMin(b.start) <= now) cur = i; });
    if (cur >= 0 && now >= endOf(blocks, cur)) cur = -1;
  }
  // Fullt vises bolken dere er i og den neste. Resten er én linje som kan foldes ut.
  const full = new Set();
  if (isToday) {
    const nextIdx = cur >= 0 ? cur + 1 : blocks.findIndex(b => toMin(b.start) > now);
    [cur, nextIdx].forEach(k => { if (k >= 0 && blocks[k]) full.add(blocks[k].id); });
  }
  const sun = sunTimes(date);
  const marks = [{ m: sun.rise, up: true }, { m: sun.set, up: false }].filter(k => k.m != null);
  const sunRow = k => h`<div class="sun" aria-label="${(k.up ? T.tl.sunrise : T.tl.sunset) + ' ' + toHM(k.m)}"><span class="rail"></span><span class="lbl">${(k.up ? T.tl.sunriseRow : T.tl.sunsetRow) + toHM(k.m)}</span></div>`;

  const out = [bannerHTML()];
  const first = blocks.length ? toMin(blocks[0].start) : 24 * 60;
  marks.filter(k => k.m < first).forEach(k => out.push(sunRow(k)));
  appts.filter(a => toMin(a.start) < first).forEach(a => out.push(apptHTML(a)));
  blocks.forEach((b, i) => {
    const s = toMin(b.start), e = endOf(blocks, i);
    const phase = !isToday ? 'future' : (i === cur ? 'now' : (e <= now ? 'past' : 'future'));
    out.push(blockHTML(b, i, blocks, placed[b.id] || [], gen[b.id] || [], phase, now, date, showAll || full.has(b.id)));
    marks.filter(k => k.m >= s && k.m < e).forEach(k => out.push(sunRow(k)));
    appts.filter(a => toMin(a.start) >= s && (toMin(a.start) < e || i === blocks.length - 1)).forEach(a => out.push(apptHTML(a)));
  });
  if (blocks.length) marks.filter(k => k.m >= endOf(blocks, blocks.length - 1)).forEach(k => out.push(sunRow(k)));
  if (!blocks.length) out.push(h`<p class="hint empty">${T.tl.empty}</p>`);
  else out.push(h`<div class="endrow"><button type="button" class="btn small ghost" data-act="toggle-all">${showAll ? T.tl.showCompact : T.tl.showAll}</button></div>`);
  setHtml($('#timeline'), out);
  renderStrip();
  renderNowbar();
}

function blockHTML(b, i, blocks, tasks, gen, phase, now, date, isFull) {
  const s = toMin(b.start), e = endOf(blocks, i);
  const today = todayISO(), L = T.tl;
  const rows = [
    ...b.items.map(it => ({ id: it.id, text: it.text, sub: '', rec: false })),
    ...gen,
    ...tasks.map(({ task, st }) => {
      let sub = task.rule && task.rule.kind === 'interval' ? ruleText(task.rule) : (task.rule && task.rule.kind === 'once' && st.late > 0 ? L.rememberFrom(fmtDateShort(task.rule.start)) : '');
      if (st.late > 0) sub = (sub ? sub + ', ' : '') + L.late(st.late);
      return { id: task.id, text: task.text, sub, late: st.late > 0, rec: true };
    })
  ];
  const doneN = rows.filter(r => isDone(date, r.id)).length;
  const lateN = rows.filter(r => r.late && !isDone(date, r.id)).length;
  const napOpen = date === today && getLog(date).sleep.some(x => x.blockId === b.id && x.start && !x.end);
  const forced = expanded.has(b.id) || shiftOpen === b.id || napOpen || (b === wakeBlock(blocks) && morningOpen(date, blocks, now));
  const collapsed = phase === 'past' && !forced;
  const compact = !collapsed && !forced && !isFull;
  const last = i === blocks.length - 1;
  const title = b.title || T.types[b.type];
  let meta = '';
  if (collapsed) meta = rows.length ? (doneN === rows.length ? L.allDone : doneN + '/' + rows.length) : '';
  else if (phase === 'now') meta = L.left(fmtDur(Math.max(1, e - now)));
  else if (compact) meta = rows.length ? doneN + '/' + rows.length : (!last ? fmtDur(e - s) : '');
  else if (!last) meta = fmtDur(e - s);

  const started = date < today || (date === today && (phase === 'now' || phase === 'past'));
  const inner = [];
  if (!collapsed && !compact) {
    const dish = b.link ? dishFor(date, b.link) : null;
    if (dish) {
      inner.push(h`<button type="button" class="dish" data-act="dish" data-meal="${b.link}" aria-label="${L.dishAria(T.meals[b.link], dish.name)}">
        <span class="dh"><span class="dn">${dish.name}</span><span class="swap">${L.swap}</span></span>
        <span class="dm">${dishMeta(dish)}</span>
        ${dish.kids ? h`<span class="dk">${T.kids.forKids(kidsWord()) + dish.kids}</span>` : ''}</button>`);
    } else if (b.type === 'meal' && (b.boys || b.adults)) {
      inner.push(h`<dl class="meal">${b.boys ? h`<dt>${cap(kidsWord())}</dt><dd>${b.boys}</dd>` : ''}${b.adults ? h`<dt>${T.kids.adults}</dt><dd>${b.adults}</dd>` : ''}</dl>`);
      if (b.link) inner.push(h`<button type="button" class="btn small ghost pick-dish" data-act="dish" data-meal="${b.link}">${L.pickDish}</button>`);
    }
    if (b.link === 'dinner') {
      const ph = partnerHome(date);
      inner.push(h`<div class="rowline"><button type="button" class="chip sm plain" data-act="wife" aria-pressed="${ph.home}">${L.partnerEats(partnerName(), ph.home) + (ph.manual ? ' *' : '')}</button>
        ${ph.ps && ph.ps.code ? h`<span class="rl">${shiftText(ph.ps)}</span>` : ''}</div>`);
    }
    if (b.note) inner.push(h`<p class="note">${b.note}</p>`);
    if (b.type === 'awake') {
      inner.push(activityHTML(date, b, s, e, phase));
      const pa = pickedActivity(date, b.id);
      if (pa && showOn('gear') && (pa.kind === 'ute' || pa.travel !== 'hjemme')) { const w = wxFor(date, s, e); if (w) inner.push(h`<p class="wx"><span class="wx-k">${L.clothes}</span>${clothesFor(w, true)}</p>`); }
    }
    if (b.type === 'prep' && i === 0 && showOn('gear')) { const w = wxFor(date, 9 * 60, 15 * 60); if (w) inner.push(h`<p class="wx"><span class="wx-k">${L.clothesToday}</span>${clothesFor(w, true)}</p>`); }
    if (b.type === 'meal' && (b.boys || dish) && started) {
      const r = getLog(date).meals[b.id] || {};
      inner.push(h`<div class="rates-blk"><span class="rl">${L.ate}</span>${state.kids.map(k => h`<div class="rate-row"><span class="kn">${k.name}</span>${rateSeg(r[k.id], k.id, 'data-act="rate"')}</div>`)}</div>`);
    }
    if (b.type === 'sleep' && (date < today || (date === today && (started || s - now <= 60 || getLog(date).sleep.some(x => x.blockId === b.id))))) {
      inner.push(sleepLogHTML(date, b));
    }
    const nb = nightBlock(blocks);
    if (nb && nb.id === b.id && (date < today || (date === today && (started || s - now <= 60)))) inner.push(nightLogHTML(date, b));
    const wb = wakeBlock(blocks);
    if (wb && wb.id === b.id && (date === today ? now >= s - 120 : state.kids.some(k => wokeAt(date, k.id)))) inner.push(morningLogHTML(date));
    if (rows.length) {
      inner.push(h`<ul class="checks">${rows.map(r =>
        h`<li${r.rec ? raw(' class="rec"') : r.gen ? raw(' class="gen"') : ''}><label><input type="checkbox" data-done="${r.id}"${isDone(date, r.id) ? raw(' checked') : ''}>
        <span class="txt"><span class="main">${r.text}</span>${r.sub ? h`<small class="${r.late ? 'late' : ''}">${r.sub}</small>` : ''}</span></label></li>`)}</ul>`);
    }
    if (b.role === 'reset') {
      if (showOn('tomorrow')) inner.push(tomorrowHTML(date));
      inner.push(h`<div class="rowline"><button type="button" class="btn small" data-act="log">${L.openLog}</button><button type="button" class="btn small" data-act="report">${L.shareReport}</button>
        ${!syncOn() && isoWd(date) === 7 ? h`<button type="button" class="btn small" data-act="export">${L.exportBackup}</button>` : ''}</div>`);
    }
  }
  let prog = '';
  if (phase === 'now') {
    const frac = Math.min(1, Math.max(0, (now - s) / Math.max(1, e - s)));
    prog = h`<div class="prog" aria-hidden="true"><span style="width:${(frac * 100).toFixed(1)}%"></span></div>`;
  }
  const sum = compact ? compactSummary(b, date, s, e) : '';
  const late = (compact || collapsed) && lateN ? h`<span class="late-n">${L.lateCount(lateN)}</span>` : '';
  return h`<section class="blk ty-${b.type} ${phase}${compact ? ' compact' : ''}" data-id="${b.id}">
    <div class="rail"><span class="node"></span></div>
    <div class="panel">
      <div class="hrow">
        <button type="button" class="tbtn" data-act="time" aria-expanded="${shiftOpen === b.id}" aria-label="${L.moveAria(title, b.start)}">${b.start}</button>
        <button type="button" class="head" data-act="${collapsed || compact ? 'expand' : 'edit'}" aria-label="${collapsed || compact ? L.showAria(title) : L.editAria(title)}">
          <span class="hl"><span class="title">${title}</span>${sum ? h`<span class="sum">${sum}</span>` : ''}${!collapsed && !compact && meta ? h`<span class="sl"><span class="meta">${meta}</span></span>` : ''}</span>
          ${collapsed || compact ? h`<span class="side">${late}<span class="meta">${meta}</span></span>` : h`<span class="edit" aria-hidden="true">${ICON_EDIT}</span>`}
        </button>
      </div>${shiftOpen === b.id ? shiftBarHTML(date, nightBlock(blocks) === b) : ''}${inner}${prog}
    </div></section>`;
}
/* Kort innhold for en bolk på én linje */
function compactSummary(b, date, s, e) {
  if (b.link) { const d = dishFor(date, b.link); if (d) return d.name; }
  if (b.type === 'meal') return b.boys || b.adults || '';
  if (b.type === 'awake') {
    const pa = pickedActivity(date, b.id);
    if (pa) return pa.name;
    if (date >= todayISO()) { const top = pickTop(suggest(date, s, e).list, 3); if (top.length) return T.tl.sugg(top.map(a => a.name)); }
  }
  return b.note || '';
}
/* Tre korte valg for hvor godt et barn spiste. Trykk på valgt verdi fjerner den. */
const rateSeg = (cur, kid, attr) => h`<span class="seg sm">${RATES.slice(1).map(v => h`<button type="button" class="r-${v}" ${raw(attr)} data-kid="${kid}" data-val="${v}" aria-pressed="${cur === v}">${T.ratesShort[v]}</button>`)}</span>`;

function nightLogHTML(date, b) {
  const isToday = date === todayISO(), S = T.sleep;
  const N = getLog(date).night;
  const rowsH = state.kids.map(k => {
    const a = N[k.id] && N[k.id].asleep;
    return h`<div class="lg-row"><span class="kn">${k.name}</span>
      <button type="button" class="lg-t" data-act="log">${a ? S.asleepAt(a) : S.notLogged}</button>
      ${isToday && !a ? h`<button type="button" class="btn small" data-act="night-now" data-kid="${k.id}">${S.asleep}</button>` : ''}</div>`;
  });
  const none = state.kids.every(k => !(N[k.id] && N[k.id].asleep));
  return h`<div class="log night"><span class="lg-h">${S.nightLog}</span>${rowsH}
    ${isToday && none && state.kids.length > 1 ? h`<button type="button" class="btn small wide" data-act="night-now" data-kid="all">${S.nowAsleep(groupWord())}</button>` : ''}</div>`;
}

function morningLogHTML(date) {
  const isToday = date === todayISO(), S = T.sleep;
  const rowsH = state.kids.map(k => {
    const w = wokeAt(date, k.id);
    return h`<div class="lg-row"><span class="kn">${k.name}</span>
      <button type="button" class="lg-t" data-act="log">${w ? S.wokeAt(w) : S.notLogged}</button>
      ${isToday && !w ? h`<button type="button" class="btn small" data-act="wake-now" data-kid="${k.id}">${S.awake}</button>` : ''}</div>`;
  });
  const none = state.kids.every(k => !wokeAt(date, k.id));
  return h`<div class="log night"><span class="lg-h">${S.morning}</span>${rowsH}
    ${isToday && none && state.kids.length > 1 ? h`<button type="button" class="btn small wide" data-act="wake-now" data-kid="all">${S.nowAwake(groupWord())}</button>` : ''}</div>`;
}

function sleepLogHTML(date, b) {
  const isToday = date === todayISO(), S = T.sleep;
  const st = k => { const e = napEntry(date, k, b.id); return !e ? 'none' : (!e.end ? 'open' : 'done'); };
  const rowsH = state.kids.map(k => {
    const e = napEntry(date, k.id, b.id), s = st(k.id);
    const times = e ? e.start + '–' + (e.end || '…') + (e.end ? ' (' + fmtDurShort(toMin(e.end) - toMin(e.start)) + ')' : '') : S.notLogged;
    let act = '';
    if (isToday && s === 'none') act = h`<button type="button" class="btn small" data-act="sleep-now" data-kid="${k.id}">${S.asleep}</button>`;
    else if (isToday && s === 'open') act = h`<button type="button" class="btn small" data-act="sleep-now" data-kid="${k.id}">${S.awake}</button>`;
    return h`<div class="lg-row"><span class="kn">${k.name}</span><button type="button" class="lg-t" data-act="sleep-edit" data-kid="${k.id}">${times}</button>${act}</div>`;
  });
  const states = state.kids.map(k => st(k.id));
  let both = '';
  if (isToday && states.every(x => x === states[0]) && states[0] !== 'done' && state.kids.length > 1) {
    const open = states[0] === 'open';
    both = h`<button type="button" class="btn small wide" data-act="sleep-now" data-kid="all">${open ? S.nowAwake(groupWord()) : S.nowAsleep(groupWord())}</button>`;
  }
  return h`<div class="log"><span class="lg-h">${S.napLog}</span>${rowsH}${both}</div>`;
}

function shiftBarHTML(date, isBed) {
  const isToday = date === todayISO();
  return h`<div class="shiftbar"><span class="sb-l">${isBed ? T.tl.shiftHeadBed : T.tl.shiftHead}</span>
    <div class="sb-btns">${[-30, -15, 15, 30].map(d => h`<button type="button" class="btn small" data-qshift="${d}">${(d > 0 ? '+' : '−') + Math.abs(d)}</button>`)}</div>
    ${isToday ? h`<button type="button" class="btn small primary" data-qshift="now">${T.tl.startsNow}</button>` : ''}</div>`;
}

function activityHTML(date, b, s, e, phase) {
  const picked = pickedActivity(date, b.id), A = T.acts;
  const res = suggest(date, s, e);
  const out = [];
  if (res.w) out.push(h`<p class="wx"><span class="wx-k">${A.weather}</span>${wxText(res.w) + (res.light < 30 && (e - s) >= 30 ? A.dark : '')}</p>`);
  if (picked) {
    const url = safeUrl(picked.url);
    out.push(h`<div class="pick"><div class="pk-h"><span class="sn">${picked.name}</span><button type="button" class="btn small ghost" data-act="unpick">${A.change}</button></div>
      <span class="sm">${actMeta(picked)}</span>${picked.where ? h`<span class="sm">${picked.where}</span>` : ''}${picked.note ? h`<span class="sm">${picked.note}</span>` : ''}
      ${url ? h`<a class="sm lnk" href="${url}" target="_blank" rel="noopener">${A.more}</a>` : ''}</div>`);
    return out;
  }
  if (phase === 'past' || date < todayISO()) return out;
  const top = pickTop(res.list, 3);
  if (!top.length) return out;
  out.push(h`<div class="sugg"><span class="rl">${A.suggestions}</span><div class="sgl">${top.map(a =>
    h`<button type="button" class="sg" data-act="pick" data-aid="${a.id}" aria-label="${a.name + ', ' + actMeta(a)}">${a.name}</button>`)}${res.list.length > 3 ? h`<button type="button" class="sg more" data-act="more">${A.moreSugg}</button>` : ''}</div></div>`);
  return out;
}

function apptHTML(a) {
  const end = a.minutes ? toHM(toMin(a.start) + Number(a.minutes)) : '';
  return h`<div class="appt-row"><span class="rail"></span><button type="button" class="appt" data-act="appt" data-appt="${a.id}">
    <span class="ap-h"><span class="ap-t">${a.start + (end ? '–' + end : '')}</span><span class="ap-n">${a.title}</span><span class="tag">${T.appt.tag}</span></span>
    ${a.where ? h`<span class="sm">${a.where}</span>` : ''}${a.note ? h`<span class="sm">${a.note}</span>` : ''}</button></div>`;
}

function sickBannerHTML(date) {
  const sick = sickKids(date), S = T.sick;
  if (!sick.length) return '';
  const med = lastHealth('med', date), tmp = lastHealth('temp', date);
  const parts = [S.who(sick.map(k => k.name).join(T.kids.and))];
  if (med) parts.push(S.lastMed(med.time) + (date === todayISO() && toMin(med.time) <= nowMin() ? S.ago(fmtDur(nowMin() - toMin(med.time))) : '') + (med.value ? ', ' + med.value : '') + S.to(kidName(med.kid)));
  if (tmp) parts.push(S.lastTemp(tmp.value, tmp.time, kidName(tmp.kid)));
  return h`<div class="banner sick"><span>${parts.join('. ') + '.'}</span><button type="button" class="btn small" data-act="health">${S.log}</button></div>`;
}

/* «I morgen» i nullstillingen om kvelden */
function tomorrowHTML(date) {
  const t = addDays(date, 1), M = T.tomorrow;
  const tb = blocksFor(t);
  const rows = [], short = [];
  const kv = (k, v) => rows.push(h`<dt>${k}</dt><dd>${v}</dd>`);
  const w = wxFor(t, 9 * 60, 15 * 60);
  const sun = sunTimes(t);
  const light = sun.rise != null ? toHM(sun.rise) + '–' + toHM(sun.set) : '';
  if (w) { kv(M.weather, wxText(w) + (light ? M.lightRange(light) : '')); short.push(wxText(w).split(', ').slice(0, 2).join(' ')); }
  else if (light) kv(M.light, light);
  if (w && showOn('gear')) kv(M.clothes, clothesFor(w, true));
  const ps = partnerStatus(t);
  if (ps && ps.code) { const ph = partnerHome(t); kv(partnerName().toLowerCase(), shiftText(ps) + (ph.home ? M.home : M.away)); short.push(partnerName().toLowerCase() + ' ' + ps.code); }
  const din = dishFor(t, 'dinner'), lun = dishFor(t, 'lunch');
  if (lun) kv(M.lunch, lun.name);
  if (din) { kv(M.dinner, din.name + (din.dayBefore ? M.tonight(din.dayBefore) : '')); short.push(din.name); }
  const firstNap = tb.find(b => b.type === 'sleep');
  if (firstNap) { kv(M.firstNap, firstNap.start); short.push(M.napShort(firstNap.start)); }
  const fixed = state.activities.filter(a => a.days && a.days.includes(isoWd(t)));
  if (fixed.length) kv(M.fixed, fixed.map(a => a.name + (a.from ? ' ' + a.from : '')).join('; '));
  (state.appts || []).filter(a => a.date === t).forEach(a => kv(M.appt, a.start + ' ' + a.title + (a.where ? ', ' + a.where : '')));
  const tasks = Object.values(placeTasks(t, tb)).flat().filter(x => !x.st.done).map(x => x.task.text);
  if (tasks.length) kv(M.tasks, tasks.slice(0, 6).join(', ') + (tasks.length > 6 ? M.more : ''));
  return h`<details class="tomorrow"><summary><span class="tm-h">${M.head(fmtDateTiny(t))}</span><span class="tm-s">${short.join(' · ')}</span></summary><dl>${rows}</dl></details>`;
}

/* ---------- nå-kortet i toppen ---------- */
function nowModel() {
  const date = todayISO(), N = T.nowbar;
  if (view !== date || !showOn('nowbar')) return null;
  const blocks = blocksFor(date), now = nowMin();
  if (!blocks.length) return null;
  let cur = -1;
  blocks.forEach((b, i) => { if (toMin(b.start) <= now) cur = i; });
  if (cur >= 0 && now >= endOf(blocks, cur)) return null;
  const b = cur >= 0 ? blocks[cur] : null;
  const next = cur >= 0 ? blocks[cur + 1] : blocks[0];
  const ids = state.kids.map(k => k.id);
  const nb = nightBlock(blocks);
  let act = null;
  const napState = blk => ids.map(k => { const e = napEntry(date, k, blk.id); return !e ? 'none' : (!e.end ? 'open' : 'done'); });
  const who = list => list.length > 1 && list.length === ids.length ? groupWord() : list.map(kidName).join(T.kids.and);
  const on = openNap(date);
  if (on) act = { kind: 'sleep', block: on.blockId, kids: on.kids, label: N.woke(who(on.kids)) };
  if (!act && b && b.type === 'sleep') {
    const st = napState(b);
    const open = ids.filter((k, i) => st[i] === 'open'), none = ids.filter((k, i) => st[i] === 'none');
    if (open.length) act = { kind: 'sleep', block: b.id, kids: open, label: N.woke(who(open)) };
    else if (none.length && !st.includes('done')) act = { kind: 'sleep', block: b.id, kids: none, label: N.slept(who(none)) };
  }
  if (!act && b && nb && b.id === nb.id) {
    const NL = getLog(date).night;
    const none = ids.filter(k => !(NL[k] && NL[k].asleep));
    if (none.length) act = { kind: 'night', block: b.id, kids: none, label: N.slept(who(none)) };
  }
  if (!act && morningOpen(date, blocks, now)) {
    const wb = wakeBlock(blocks);
    const none = ids.filter(k => !wokeAt(date, k));
    if (none.length) act = { kind: 'wake', block: wb.id, kids: none, label: N.woke(who(none)) };
  }
  if (!act && next && next.type === 'sleep' && toMin(next.start) - now <= 45 && napState(next).every(x => x === 'none')) {
    act = { kind: 'sleep', block: next.id, kids: ids, label: N.slept(groupWord()) };
  }
  let line1 = b ? N.left(b.title || T.types[b.type], fmtDur(Math.max(1, endOf(blocks, cur) - now))) : N.dayStarts(blocks[0].start);
  if (b && b.type !== 'sleep') {
    const w = lastWake(date);
    if (w && toMin(w) <= now) line1 += N.awakeFor(fmtDurShort(now - toMin(w)));
  }
  const start = next && !(act && act.block === next.id) ? { kind: 'start', block: next.id } : null;
  return { line1, line2: next ? N.next(next.start, next.title || T.types[next.type]) : N.last, act, start };
}
function renderNowbar() {
  const el = $('#nowbar');
  if (!el || !state) return;
  const m = nowModel(), N = T.nowbar;
  if (!m) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  setHtml(el, h`<div class="nb-row"><button type="button" class="nb-txt" data-nb="scroll"><span class="nb-1">${m.line1}</span></button>
      ${m.act ? h`<button type="button" class="btn small primary nb-act" data-nb="act">${m.act.label}</button>` : ''}</div>
    <div class="nb-row2"><span class="nb-2">${m.line2}</span>
      ${m.start ? h`<button type="button" class="nb-start" data-nb="start" aria-label="${N.startAria}">${N.start}</button>` : ''}</div>`);
  el._act = m.act;
  el._start = m.start;
}
function nowbarAction(act) {
  if (!act) return;
  if (act.kind === 'sleep') commit('', () => logSleepNow(view, act.block, act.kids));
  else if (act.kind === 'night') commit('', () => logNightNow(view, act.block, act.kids));
  else if (act.kind === 'wake') commit('', () => logWakeNow(view, act.kids));
  else if (act.kind === 'start') startNow(act.block);
  scrollToNow();
}

/* ---------- flytt og start nå ----------
   Nåværende og neste bolk startes direkte. For andre bolker vises et valg,
   slik at måltider og leggetid ikke kan hoppes over ved et uhell. */
function fitMessage(r) {
  if (!r) return '';
  const title = r.block.title || T.fit.block;
  if (r.kind === 'bedtime') return T.fit.bedtime(r.block.start);
  return T.fit.moved(title, r.block.start) + (r.kind === 'fit' && r.end ? T.fit.rest(r.end) : '');
}
function moveBlockBy(id, delta) {
  const b = blocksFor(view).find(x => x.id === id);
  if (!b || !delta) return;
  let r = null;
  commit('', () => { r = moveBlock(id, toMin(b.start) + delta, true); return fitMessage(r); });
}
function startNow(id) {
  const b = blocksFor(view).find(x => x.id === id);
  if (!b) return;
  const now = nowMin();
  if (toMin(b.start) === now) { toast(T.tl.alreadyNow(b.title)); return; }
  const p = startNowPlan(view, id);
  if (p.kind === 'direct') { shiftOpen = null; commit('', () => fitMessage(moveBlock(id, now))); return; }
  openStartNowSheet(b, p);
}

function scrollToNow() {
  const el = document.querySelector('.blk.now') || [...document.querySelectorAll('.blk.future')][0];
  if (el && view === todayISO()) el.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, 0);
}
function go(n, date) {
  view = date || (n === 0 ? todayISO() : addDays(view, n));
  expanded.clear();
  shiftOpen = null;
  render();
  scrollToNow();
}
