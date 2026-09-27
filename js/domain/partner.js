'use strict';
/* ---------- partner og turnus ---------- */
const partnerOn = () => !!(state.partner && state.partner.enabled);
const partnerName = () => (state.partner && state.partner.name) || T.partner.defaultName;
/* Vakten en dag: { code, def, home, away }. home: rekker middagen.
   Med fravær fra Takt (taktAway) brukes tidene hun er borte; ellers vakten og reisetiden. */
function partnerStatus(date) {
  if (!partnerOn()) return null;
  const P = state.partner;
  const cu = P.custom && P.custom[date];
  const code = cu ? (cu.label || T.partner.customCode) : P.shifts[date];
  if (!code) return { code: '', def: null, home: null, away: null };
  const def = cu ? { label: cu.label, kind: 'work', start: cu.start, end: cu.end } : P.codes[code];
  if (!def) return { code, def: null, home: null, away: null };
  const b = blocksFor(date).find(x => x.link === 'dinner');
  const dm = b ? toMin(b.start) : 17 * 60 + 30;
  const aw = def.kind === 'off' ? null : taktAway(date);
  const c = Number(P.commute) || 0;
  let home = true;
  if (aw) home = toMin(aw.back) + 1440 * aw.backDay <= dm || toMin(aw.leave) >= dm + 30;
  else if (def.kind === 'work' && def.start && def.end) home = (toMin(def.end) + c <= dm) || (toMin(def.start) - c >= dm + 30);
  else if (def.kind === 'night' && def.start) home = toMin(def.start) - c >= dm + 30;
  return { code, def, home, away: aw, custom: !!cu };
}
/* Vakten i klartekst, uten koder: fri, dagvakt, kveldsvakt, nattevakt, eller egen beskrivelse */
function shiftKind(ps, short) {
  if (!ps || !ps.code) return '';
  const S = short ? T.shift.short : T.shift, d = ps.def;
  if (ps.custom) return short ? S.work : (d.label || T.shift.work).toLowerCase();
  if (!d) return S.work;
  if (d.kind === 'off') return S.off;
  if (d.kind === 'night') return S.night;
  if (!isTime(d.start)) return S.work;
  return toMin(d.start) < 12 * 60 ? S.day : S.eve;
}
/* Når partneren er borte: fra Takt, eller beregnet fra vakten og reisetiden (est) */
function partnerAway(ps) {
  if (!ps || !ps.def || ps.def.kind === 'off') return null;
  if (ps.away) return Object.assign({ est: false }, ps.away);
  const d = ps.def, c = Number(state.partner.commute) || 0;
  if (!isTime(d.start) || !isTime(d.end)) return null;
  const leave = toMin(d.start) - c, back = toMin(d.end) + c + (toMin(d.end) <= toMin(d.start) ? 1440 : 0);
  return { leave: toHM((leave + 1440) % 1440), back: toHM(back % 1440), backDay: Math.floor(back / 1440), est: true };
}
/* «borte 06:08–15:48», «fri» eller «dagvakt». full: med vakttype først. */
function partnerLine(ps, full) {
  if (!ps || !ps.code) return '';
  const kind = shiftKind(ps), a = partnerAway(ps);
  if (!a) return kind;
  const t = T.shift.away((a.est ? '~' : '') + a.leave + '–' + a.back + (a.backDay ? T.shift.nextDay : ''));
  return full ? kind + ', ' + t : t;
}
function partnerHome(date) {
  const d = state.days[date];
  const ps = partnerStatus(date);
  if (d && typeof d.wife === 'boolean') return { home: d.wife, manual: true, ps };
  return { home: ps && ps.home != null ? ps.home : false, manual: false, ps };
}
/* Knappen i middagsbolken: veksler, og går tilbake til turnusen når den sier det samme */
function togglePartnerHome(date) {
  const ph = partnerHome(date);
  const d = dayRec(date);
  const next = !ph.home;
  if (ph.ps && ph.ps.home === next) delete d.wife; else d.wife = next;
}

/* Import av turnus: JSON fra Døgn, eller tekstlinjer som «2026-10-01 D» / «01.10.2026 D». */
function parseRota(text) {
  const t = text.trim();
  const codeOk = c => typeof c === 'string' && /^[\wÆØÅæøå.+-]{1,12}$/.test(c);
  if (t.startsWith('{')) {
    const o = JSON.parse(t);
    if (!o.shifts || typeof o.shifts !== 'object') throw new UserError(T.partner.noShifts);
    const shifts = {}, codes = {};
    for (const [d, c] of Object.entries(o.shifts)) if (isDate(d) && codeOk(c)) shifts[d] = c;
    for (const [c, def] of Object.entries(o.codes || {})) {
      if (!codeOk(c) || !def || typeof def !== 'object') continue;
      codes[c] = { label: String(def.label || ''), kind: ['work', 'night', 'off'].includes(def.kind) ? def.kind : 'work', start: isTime(def.start) ? def.start : '', end: isTime(def.end) ? def.end : '' };
    }
    if (!Object.keys(shifts).length) throw new UserError(T.partner.noLines);
    return { codes, shifts };
  }
  const shifts = {};
  t.split(/\r?\n/).forEach(line => {
    const m = line.trim().match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})\s+(\S+)/);
    if (!m) return;
    let d = m[1];
    if (d.includes('.')) { const [dd, mm, yy] = d.split('.'); d = yy + '-' + pad(mm) + '-' + pad(dd); }
    const c = m[2].toUpperCase();
    if (isDate(d) && codeOk(c)) shifts[d] = c;
  });
  if (!Object.keys(shifts).length) throw new UserError(T.partner.noLines);
  return { codes: {}, shifts };
}
/* Legger turnusen inn og returnerer koder som mangler tider */
function applyRota({ codes, shifts }) {
  const P = state.partner;
  Object.assign(P.codes, codes);
  Object.assign(P.shifts, shifts);
  P.enabled = true;
  const unknown = [...new Set(Object.values(shifts))].filter(c => !P.codes[c]);
  unknown.forEach(c => { P.codes[c] = { label: T.partner.unknownCode, kind: 'work', start: '', end: '' }; });
  return unknown;
}
