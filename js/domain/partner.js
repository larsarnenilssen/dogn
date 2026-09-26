'use strict';
/* ---------- partner og turnus ---------- */
const partnerOn = () => !!(state.partner && state.partner.enabled);
const partnerName = () => (state.partner && state.partner.name) || T.partner.defaultName;
function partnerStatus(date) {
  if (!partnerOn()) return null;
  const P = state.partner;
  const code = P.shifts[date];
  if (!code) return { code: '', def: null, home: null };
  const def = P.codes[code];
  if (!def) return { code, def: null, home: null };
  const b = blocksFor(date).find(x => x.link === 'dinner');
  const dm = b ? toMin(b.start) : 17 * 60 + 30;
  const c = Number(P.commute) || 0;
  let home = true;
  if (def.kind === 'work' && def.start && def.end) home = (toMin(def.end) + c <= dm) || (toMin(def.start) - c >= dm + 30);
  else if (def.kind === 'night' && def.start) home = toMin(def.start) - c >= dm + 30;
  return { code, def, home };
}
function shiftText(ps) {
  if (!ps || !ps.code) return '';
  if (!ps.def) return ps.code;
  if (ps.def.kind === 'off') return ps.code + T.partner.off;
  return ps.code + (ps.def.start && ps.def.end ? ' ' + ps.def.start + '–' + ps.def.end : '');
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
