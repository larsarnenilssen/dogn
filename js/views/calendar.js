'use strict';
/* ---------- kalender: hopp til en vilkårlig dag ----------
   Åpnes ved å trykke på datoen i toppen. Viser en måned med ukenummer,
   partnerens vakter, avtaler og huskepunkter, og dager med egne endringer. */
function openCalendarSheet(month) {
  month = month || view.slice(0, 7);
  const C = T.cal, today = todayISO();
  const [y, m] = month.split('-').map(Number);
  const first = month + '-01';
  const last = iso(new Date(y, m, 0));
  const weeks = [];
  for (let ws = weekStart(first); ws <= last; ws = addDays(ws, 7)) weeks.push(ws);
  const L = state.leave;
  const marks = new Set([...(state.appts || []).map(a => a.date),
    ...state.tasks.filter(t => t.rule && t.rule.kind === 'once' && t.rule.start && !completions(t.id).length).map(t => t.rule.start)]);
  const shift = d => partnerOn() ? shiftKind(partnerStatus(d), true) : '';
  const cell = d => {
    const cls = ['day'];
    if (d.slice(0, 7) !== month) cls.push('other');
    if (d < L.start || d > L.end) cls.push('off');
    if (d === today) cls.push('today');
    if (d === view) cls.push('sel');
    if (isoWd(d) >= 6) cls.push('weekend');
    const rec = state.days[d];
    const own = !!(rec && (rec.blocks || rec.templateId));
    return h`<button type="button" class="${cls.join(' ')}" data-go="${d}" aria-label="${fmtDateLong(d)}"${d === view ? raw(' aria-current="date"') : ''}>
      <span class="n">${parseISO(d).getDate()}${own ? '*' : ''}</span>
      <span class="c">${shift(d)}</span>${marks.has(d) ? h`<span class="dot" aria-hidden="true"></span>` : ''}</button>`;
  };
  const prevM = iso(new Date(y, m - 2, 1)).slice(0, 7), nextM = iso(new Date(y, m, 1)).slice(0, 7);
  openSheet(h`${headHTML(C.title)}
    <div class="sh-body">
      <section class="grp">
        <div class="cal-nav"><button type="button" class="icon-btn" data-month="${prevM}" aria-label="${C.prev}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
          <strong class="cal-m" aria-live="polite">${cap(T.date.mo[m - 1]) + ' ' + y}</strong>
          <button type="button" class="icon-btn" data-month="${nextM}" aria-label="${C.next}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button></div>
        <div class="cal" role="grid">
          <span class="wk hd">${C.week}</span>${T.date.wdShort.map(w => h`<span class="hd">${w}</span>`)}
          ${weeks.map(ws => h`<span class="wk">${isoWeek(ws)}</span>${[0, 1, 2, 3, 4, 5, 6].map(i => cell(addDays(ws, i)))}`)}
        </div>
        <div class="row2"><button type="button" class="btn small" data-go="${today}">${C.today}</button><button type="button" class="btn small" data-go="${addDays(today, 1)}">${C.tomorrow}</button></div>
        ${hint(C.hint(partnerOn() ? partnerName() : ''))}
      </section>
    </div>`,
    sheet => {
      sheet.addEventListener('click', e => {
        const mo = e.target.closest('[data-month]');
        if (mo) { openCalendarSheet(mo.dataset.month); return; }
        const g = e.target.closest('[data-go]');
        if (g) { closeSheet(); go(0, g.dataset.go); }
      });
    });
}
