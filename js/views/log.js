'use strict';
/* ---------- ark for logg: dagslogg, lur, oversikt med graf, helse og dagsrapport ---------- */

function healthFormHTML(date) {
  const S = T.sick;
  return h`<div class="row2">
      <div class="field"><label for="h-kid">${S.kid}</label><select id="h-kid">${options(state.kids.map(k => [k.id, k.name]))}</select></div>
      <div class="field"><label for="h-kind">${S.what}</label><select id="h-kind">${options(Object.entries(T.health))}</select></div>
    </div>
    <div class="row2">
      <div class="field"><label for="h-val">${S.value}</label><input id="h-val" type="text" autocomplete="off" placeholder="${S.valuePh}"></div>
      <div class="field"><label for="h-time">${T.common.time}</label><input id="h-time" type="time" value="${date === todayISO() ? toHM(nowMin()) : '12:00'}"></div>
    </div>`;
}
function readHealth(sheet) {
  const q = s => sheet.querySelector(s);
  const value = q('#h-val').value.trim(), time = q('#h-time').value;
  if (!isTime(time)) return null;
  return { id: 'h-' + uid(), kid: q('#h-kid').value, kind: q('#h-kind').value, value, time };
}

function openLogSheet(date) {
  reopen = () => openLogSheet(date);
  const L = getLog(date), G = T.log;
  const blocks = blocksFor(date);
  const mealBlocks = blocks.filter(b => b.type === 'meal' && (b.boys || b.link));
  const sleepFor = kid => L.sleep.filter(e => e.kid === kid).sort((a, b) => a.start.localeCompare(b.start));
  const bName = id => { const b = blocks.find(x => x.id === id); return b ? b.title + ' ' + b.start : G.napFallback; };
  const napsFor = k => {
    const list = sleepFor(k.id), tot = napTotal(date, k.id);
    return h`<div class="lg-sum"><strong>${k.name}</strong><span class="m">${list.length ? (tot ? G.total(fmtDurShort(tot)) : G.ongoing) : G.noNaps}</span></div>
      ${list.length ? h`<div class="list">${list.map(e => h`<button type="button" class="row" data-nap="${e.id}"><span class="grow">${e.start + '–' + (e.end || '…')}
        <span class="m">${bName(e.blockId)}</span></span><span class="r">${e.end ? fmtDurShort(toMin(e.end) - toMin(e.start)) : ''}</span></button>`)}</div>` : ''}`;
  };
  const prevNight = addDays(date, -1);
  const nightFor = k => {
    const n = nightRec(prevNight, k.id);
    return h`<div class="field"><span class="lbl">${k.name}</span><div class="row2">
      <div class="field"><label for="n-a-${k.id}">${T.night.asleep(whenAsleep(prevNight))}</label><input type="time" id="n-a-${k.id}" data-night="${k.id}" data-f="asleep" value="${n.asleep || ''}"></div>
      <div class="field"><label for="n-w-${k.id}">${T.night.woke(whenWoke(prevNight))}</label><input type="time" id="n-w-${k.id}" data-night="${k.id}" data-f="wake" value="${n.wake || ''}"></div>
      </div></div>`;
  };
  const health = [...(L.health || [])].sort((a, b) => a.time.localeCompare(b.time));
  const mealRow = b => {
    const r = L.meals[b.id] || {};
    return h`<div class="meal-row"><span class="grow">${b.title}<span class="m">${b.start}</span></span>
      ${state.kids.map(k => h`<div class="rate-row"><span class="kn">${k.name}</span>${rateSeg(r[k.id], k.id, 'data-lrate="' + esc(b.id) + '"')}</div>`)}</div>`;
  };
  openSheet(h`<div class="sh-head"><h2>${G.title(fmtDateTiny(date))}</h2><button type="button" class="btn ghost" data-close>${T.common.close}</button></div>
    <div class="sh-body">
      <section class="grp"><h3>${G.naps}</h3>${state.kids.map(napsFor)}${hint(G.napsHint)}</section>
      <section class="grp"><h3>${G.nightTo(fmtDateTiny(date))}</h3>${state.kids.map(nightFor)}${hint(G.nightHint)}</section>
      <section class="grp" id="lg-health"><h3>${G.health}</h3>
        <div class="switches">${state.kids.map(k => switchBtn('data-sick', k.id, !!(L.sick && L.sick[k.id]), G.isSick(k.name)))}</div>
        ${health.length ? h`<div class="list">${health.map(x => h`<div><span class="grow">${x.time + ' ' + kidName(x.kid)}<span class="m">${T.health[x.kind] + (x.value ? ': ' + x.value : '')}</span></span><button type="button" class="icon-btn sm" data-rm-h="${x.id}" aria-label="${T.common.remove}">${ICON_X}</button></div>`)}</div>` : ''}
        ${healthFormHTML(date)}
        <button type="button" class="btn wide" data-add-h>${T.common.add}</button>
        ${hint(G.healthHint)}
      </section>
      <section class="grp"><h3>${G.meals}</h3>
        ${mealBlocks.length ? h`<div class="list">${mealBlocks.map(mealRow)}</div>` : hint(G.noMeals)}
        ${hint(G.ratesHint)}
      </section>
      <section class="grp"><h3>${T.common.note}</h3><label for="l-note" class="vh">${G.noteAria}</label>
        <textarea id="l-note" rows="4" placeholder="${G.notePh}">${L.note}</textarea></section>
      <button type="button" class="btn wide" data-report>${G.share}</button>
    </div>`,
    (sheet, q) => {
      sheet.querySelectorAll('[data-night]').forEach(inp => inp.addEventListener('change', () => {
        const v = isTime(inp.value) ? inp.value : '';
        commit(null, () => { (logRec(prevNight).night[inp.dataset.night] ??= {})[inp.dataset.f] = v; }, 'timeline');
      }));
      sheet.querySelectorAll('[data-lrate]').forEach(btn => btn.addEventListener('click', () => {
        commit(null, () => setRate(date, btn.dataset.lrate, btn.dataset.kid, btn.dataset.val), 'timeline');
        openLogSheet(date);
      }));
      sheet.querySelectorAll('[data-nap]').forEach(btn => btn.addEventListener('click', () => {
        const e = getLog(date).sleep.find(x => x.id === btn.dataset.nap);
        if (e) openNapSheet(date, e.blockId, e.kid, () => openLogSheet(date));
      }));
      q('[data-report]').addEventListener('click', () => shareReport(date));
      sheet.querySelectorAll('[data-sick]').forEach(c => c.addEventListener('click', () => { commit(null, () => toggleSick(date, c.dataset.sick)); openLogSheet(date); }));
      sheet.querySelectorAll('[data-rm-h]').forEach(b => b.addEventListener('click', () => {
        commit(null, () => { const Lr = logRec(date); Lr.health = (Lr.health || []).filter(x => x.id !== b.dataset.rmH); });
        openLogSheet(date);
      }));
      q('[data-add-h]').addEventListener('click', () => {
        const x = readHealth(sheet); if (!x) return;
        commit(G.healthToast(kidName(x.kid), T.health[x.kind], x.value, x.time), () => addHealth(date, x));
        openLogSheet(date);
      });
      const note = q('#l-note');
      note.addEventListener('input', () => commit(null, () => { logRec(date).note = note.value; }, 'none'));
    });
}

function openNightSheet(nightDate, kid, back) {
  const n = nightRec(nightDate, kid), Nt = T.night;
  reopen = null;
  openSheet(h`${headMaybeBack(Nt.title(kidName(kid), fmtDateTiny(addDays(nightDate, 1))), back)}
    <form class="sh-body" id="ntf" novalidate>
      <section class="grp"><h3>${T.nap.times}</h3><div class="row2">
        <div class="field"><label for="nt-a">${Nt.asleep(whenAsleep(nightDate))}</label><input type="time" id="nt-a" value="${n.asleep || ''}"></div>
        <div class="field"><label for="nt-w">${Nt.woke(whenWoke(nightDate))}</label><input type="time" id="nt-w" value="${n.wake || ''}"></div>
      </div>${hint(Nt.hint)}</section>
    </form>
    ${footSave(T.common.save)}`,
    (sheet, q) => {
      q('[data-save]').addEventListener('click', () => {
        commit(Nt.saved, () => setNight(nightDate, kid, q('#nt-a').value, q('#nt-w').value));
        if (back) back(); else closeSheet();
      });
    }, back);
}

function openNapSheet(date, blockId, kid, back) {
  const e = napEntry(date, kid, blockId) || { start: '', end: '' };
  const b = blocksFor(date).find(x => x.id === blockId);
  reopen = null;
  openSheet(h`${headMaybeBack(T.nap.title(kidName(kid), b ? b.title + ' ' + b.start : T.log.napFallback), back)}
    <form class="sh-body" id="nf" novalidate>
      <section class="grp"><h3>${T.nap.times}</h3><div class="row2">
        <div class="field"><label for="nap-s">${T.sleep.asleep}</label><input type="time" id="nap-s" value="${e.start}"></div>
        <div class="field"><label for="nap-e">${T.sleep.awake}</label><input type="time" id="nap-e" value="${e.end}"></div>
      </div></section>
      ${e.id ? delConfirm(T.nap.del) : ''}
    </form>
    ${footSave(T.common.save)}`,
    (sheet, q) => {
      const done = () => { if (back) back(); else closeSheet(); };
      q('[data-save]').addEventListener('click', () => {
        const s = q('#nap-s').value, en = q('#nap-e').value;
        if (!isTime(s)) { q('#nap-s').focus(); return; }
        commit(T.nap.saved, () => {
          const L = logRec(date);
          let x = L.sleep.find(y => y.kid === kid && y.blockId === blockId);
          if (!x) { x = { id: 's-' + uid(), kid, blockId }; L.sleep.push(x); }
          x.start = s; x.end = isTime(en) ? en : '';
        });
        done();
      });
      bindDelete(sheet, () => {
        commit(T.nap.deleted, () => { const L = logRec(date); L.sleep = L.sleep.filter(y => !(y.kid === kid && y.blockId === blockId)); });
        done();
      });
    }, back);
}

/* ---------- oversikt ---------- */
function openHistorySheet() {
  reopen = openHistorySheet;
  const Hs = T.history;
  const today = todayISO();
  const days = [...Array(14)].map((_, i) => addDays(today, -i));
  const cell = v => h`<td>${v || h`<span class="faint">–</span>`}</td>`;
  const row = d => {
    const L = getLog(d);
    return h`<tr data-day="${d}"><td>${fmtDateTiny(d)}${L.note ? h` <span class="acc">#</span>` : ''}${L.sick && Object.values(L.sick).some(Boolean) ? h` <span class="late">${Hs.sick}</span>` : ''}</td>
      ${state.kids.map(k => cell(napTotal(d, k.id) ? fmtDurShort(napTotal(d, k.id)) : ''))}
      ${state.kids.map(k => cell((L.night[k.id] || {}).asleep))}</tr>`;
  };
  openSheet(h`${headHTML(Hs.title, true)}
    <div class="sh-body">
      <section class="grp"><h3>${Hs.chart}</h3>${napChartHTML([...days].reverse())}</section>
      <section class="grp"><h3>${Hs.avg}</h3>${statsHTML()}</section>
      <section class="grp"><h3>${Hs.last14}</h3><div class="tblwrap"><table class="tbl"><thead><tr><th>${Hs.thDay}</th>
        ${state.kids.map(k => h`<th>${Hs.thNap(k.name.charAt(0))}</th>`)}
        ${state.kids.map(k => h`<th>${Hs.thEve(k.name.charAt(0))}</th>`)}</tr></thead><tbody>
        ${days.map(row)}
      </tbody></table></div>
      ${hint(Hs.hint)}</section>
    </div>`,
    sheet => {
      bindChart(sheet);
      sheet.querySelectorAll('tr[data-day]').forEach(tr => tr.addEventListener('click', () => openLogSheet(tr.dataset.day)));
    });
}

/* Graf over lur per dag. Fargene kommer fra --chart-1 … --chart-3 i tokens.css. */
const seriesVar = i => 'var(--chart-' + (i % 3 + 1) + ')';
function napChartHTML(days) {
  const W = 340, H = 170, L = 34, R = 10, Tp = 14, B = 26;
  const vals = state.kids.map(k => days.map(d => napTotal(d, k.id) || null));
  const max = Math.max(60, ...vals.flat().filter(v => v != null));
  const top = Math.ceil(max / 60) * 60;
  const x = i => L + (W - L - R) * (days.length === 1 ? 0.5 : i / (days.length - 1));
  const y = v => Tp + (H - Tp - B) * (1 - v / top);
  const grid = [];
  for (let hr = 0; hr <= top; hr += 60) grid.push(h`<line x1="${L}" x2="${W - R}" y1="${y(hr)}" y2="${y(hr)}" class="ch-grid"/><text x="${L - 6}" y="${y(hr) + 4}" class="ch-ax" text-anchor="end">${T.history.axis(hr / 60)}</text>`);
  days.forEach((d, i) => { if ((days.length - 1 - i) % 2 === 0) grid.push(h`<text x="${x(i)}" y="${H - 8}" class="ch-ax" text-anchor="middle">${parseISO(d).getDate() + '.'}</text>`); });
  const lines = [];
  vals.forEach((arr, si) => {
    let path = '', pen = false;
    arr.forEach((v, i) => { if (v == null) { pen = false; return; } path += (pen ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); pen = true; });
    lines.push(h`<path d="${path}" style="fill:none;stroke:${seriesVar(si)};stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>`);
    arr.forEach((v, i) => { if (v != null) lines.push(h`<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="4" style="fill:${seriesVar(si)};stroke:var(--panel);stroke-width:2"/>`); });
  });
  const hits = days.map((d, i) => h`<rect x="${(x(i) - (W - L - R) / days.length / 2).toFixed(1)}" y="${Tp}" width="${((W - L - R) / days.length).toFixed(1)}" height="${H - Tp - B}" fill="transparent" data-ci="${i}"/>`);
  const legend = h`<div class="ch-legend">${state.kids.map((k, i) => h`<span><i style="background:${seriesVar(i)}"></i>${k.name}</span>`)}</div>`;
  const data = JSON.stringify(days.map((d, i) => ({ d: fmtDateTiny(d), v: vals.map(a => a[i]) })));
  return h`${legend}<div class="ch-wrap"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${T.history.chartAria(days.length)}">${grid}${lines}<line class="ch-cross" x1="0" x2="0" y1="${Tp}" y2="${H - B}" visibility="hidden"/>${hits}</svg><div class="ch-tip" hidden></div></div>
    <script type="application/json" class="ch-data">${raw(data.replace(/</g, '\\u003c'))}</script>`;
}
function bindChart(sheet) {
  const svg = sheet.querySelector('.chart');
  if (!svg) return;
  const data = JSON.parse(sheet.querySelector('.ch-data').textContent);
  const tip = sheet.querySelector('.ch-tip'), cross = svg.querySelector('.ch-cross');
  const show = r => {
    const i = Number(r.dataset.ci), cx = Number(r.getAttribute('x')) + Number(r.getAttribute('width')) / 2;
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    setHtml(tip, h`<strong>${data[i].d}</strong>${state.kids.map((k, j) => h`<span><i style="background:${seriesVar(j)}"></i>${k.name + ' ' + (data[i].v[j] != null ? fmtDurShort(data[i].v[j]) : '–')}</span>`)}`);
    tip.style.left = Math.min(Math.max(cx / 340 * 100, 18), 82) + '%';
  };
  svg.querySelectorAll('[data-ci]').forEach(r => { r.addEventListener('pointerenter', () => show(r)); r.addEventListener('click', () => show(r)); });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}
function statsHTML() {
  const today = todayISO(), Hs = T.history;
  const last = [...Array(7)].map((_, i) => addDays(today, -i));
  const prev = [...Array(7)].map((_, i) => addDays(today, -7 - i));
  const f = v => v == null ? '–' : fmtDurShort(v);
  const cmp = (a, b, fmt) => a == null ? '–' : h`${fmt(a)}${b != null ? h`<br><span class="faint">(${fmt(b)})</span>` : ''}`;
  const rows = [
    [Hs.statNap, s => s.nap, f],
    [Hs.statCount, s => s.count, v => String(v).replace('.', ',')],
    [Hs.statFirst, s => s.first, f],
    [Hs.statBed, s => s.bed, v => toHM(v)],
  ];
  const st = state.kids.map(k => ({ a: sleepStats(k.id, last), b: sleepStats(k.id, prev) }));
  return h`<div class="tblwrap"><table class="tbl"><thead><tr><th>${Hs.statsHead}</th>${state.kids.map(k => h`<th>${k.name}</th>`)}</tr></thead><tbody>
    ${rows.map(([lbl, get, fmt]) => h`<tr><td>${lbl}</td>${st.map(s => h`<td>${cmp(get(s.a), get(s.b), fmt)}</td>`)}</tr>`)}
    </tbody></table></div>${hint(Hs.statsHint)}`;
}

/* ---------- dagsrapport ---------- */
async function shareReport(date) {
  const text = dayReport(date), R = T.report;
  try { if (navigator.share) { await navigator.share({ title: R.shareTitle(fmtDateTiny(date)), text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(text); toast(R.copied); }
  catch (e) { openSheet(h`${headHTML(R.sheet)}<div class="sh-body"><section class="grp">${hint(R.copyHint)}<textarea rows="10" readonly>${text}</textarea></section></div>`); }
}
