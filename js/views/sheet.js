'use strict';
/* ---------- ark (bottom sheet), melding med angre og ikoner ---------- */
const ICON_EDIT = raw('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>');
const ICON_X = raw('<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>');

/* Åpner et ark. html lages med h``. mount(sheet) kobler til knappene.
   goback: funksjonen for «Tilbake»-knappen (data-goback), hvis arket har en. */
let sheetSeq = 0;   // hindrer at et ark som allerede er lukket, åpnes av animasjonen
function openSheet(html, mount, goback) {
  const root = $('#sheet-root');
  const seq = ++sheetSeq;
  const wasOpen = root.classList.contains('open');
  setHtml(root, h`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div>${html}</div>`);
  root.hidden = false;
  document.body.classList.add('locked');
  if (wasOpen) root.classList.add('open');
  else requestAnimationFrame(() => requestAnimationFrame(() => { if (seq === sheetSeq) root.classList.add('open'); }));
  const sheet = root.querySelector('.sheet');
  root.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeSheet));
  const back = sheet.querySelector('[data-back]');
  if (back) back.addEventListener('click', openMenu);
  const gb = sheet.querySelector('[data-goback]');
  if (gb && goback) gb.addEventListener('click', goback);
  sheet.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
  sheet.addEventListener('click', e => {
    const q = e.target.closest('[data-qm]');
    if (!q) return;
    const more = q.closest('.hint').nextElementSibling;
    more.hidden = !more.hidden;
    q.setAttribute('aria-expanded', String(!more.hidden));
    q.setAttribute('aria-label', more.hidden ? T.common.moreInfo : T.common.lessInfo);
  });
  if (mount) mount(sheet, s => sheet.querySelector(s));
}
function closeSheet() {
  const root = $('#sheet-root');
  sheetSeq++;
  root.classList.remove('open');
  document.body.classList.remove('locked');
  reopen = null;
  setTimeout(() => { if (!root.classList.contains('open')) { root.hidden = true; root.innerHTML = ''; } }, 260);
}
const sheetOpen = () => $('#sheet-root').classList.contains('open');

/* Toppen av et ark: med «Lukk», med «Tilbake» til menyen (back = true) eller med egen tilbake (goback) */
const headHTML = (title, back) => h`<div class="sh-head"><h2>${title}</h2>${back
  ? h`<button type="button" class="btn ghost" data-back>${T.common.back}</button>`
  : h`<button type="button" class="btn ghost" data-close>${T.common.close}</button>`}</div>`;
const headBack = title => h`<div class="sh-head"><h2>${title}</h2><button type="button" class="btn ghost" data-goback>${T.common.back}</button></div>`;
const headMaybeBack = (title, goback) => goback ? headBack(title) : headHTML(title);
const footSave = (label, attr = 'data-save') => h`<div class="sh-foot"><button type="button" class="btn primary grow" ${raw(attr)}>${label}</button></div>`;
const navRow = (act, label, meta) => h`<button type="button" class="row" data-nav="${act}"><span class="grow">${label}${meta ? h`<span class="m">${meta}</span>` : ''}</span><span class="r">›</span></button>`;
/* Hjelpetekst: første setning vises, resten bak en liten «?» */
function splitHint(text) {
  text = String(text);
  const m = text.length > 90 && text.match(/^(.+?[.!?»])\s+(?=[A-ZÆØÅ«])([\s\S]+)$/);
  return m ? [m[1], m[2]] : [text, ''];
}
const hint = text => {
  const [a, b] = splitHint(text);
  return b ? h`<p class="hint">${a} <button type="button" class="qm" data-qm aria-expanded="false" aria-label="${T.common.moreInfo}">?</button></p><p class="hint more" hidden>${b}</p>`
    : h`<p class="hint">${a}</p>`;
};
/* Av/på vises som [x] / [ ], valg mellom flere som en delt knapperad */
const switchBtn = (attr, val, on, label) => h`<button type="button" class="switch" role="switch" ${raw(attr)}="${val}" aria-checked="${on}">${label}</button>`;
const segRow = (attr, pairs, cur) => h`<div class="seg" role="group">${pairs.map(([k, l]) => h`<button type="button" ${raw(attr)}="${k}" aria-pressed="${cur(k)}">${l}</button>`)}</div>`;
const emptyRow = text => h`<div><span class="hint">${text}</span></div>`;
/* Teller med − og +. bindSteppers kaller onChange(element, ny verdi). */
const stepperHTML = (key, val, labelId, max) => h`<div class="stepper" role="group" aria-labelledby="${labelId}" data-stepper="${key}" data-max="${max}">
  <button type="button" data-step="-1" aria-label="${T.night.fewer}"${val > 0 ? '' : raw(' disabled')}>−</button><output aria-live="polite">${val}</output><button type="button" data-step="1" aria-label="${T.night.more}"${val < max ? '' : raw(' disabled')}>+</button></div>`;
function bindSteppers(root, onChange) {
  root.querySelectorAll('[data-stepper]').forEach(st => st.addEventListener('click', e => {
    const b = e.target.closest('[data-step]');
    if (!b) return;
    const out = st.querySelector('output'), max = Number(st.dataset.max);
    const v = Math.min(max, Math.max(0, Number(out.textContent) + Number(b.dataset.step)));
    out.textContent = v;
    st.querySelector('[data-step="-1"]').disabled = v <= 0;
    st.querySelector('[data-step="1"]').disabled = v >= max;
    onChange(st, v);
  }));
}
/* Slett-knapp som først viser en bekreftelse */
const delConfirm = (label, question, yes) => h`<section class="grp quiet"><button type="button" class="btn link" data-del>${label}</button>${question
  ? h`<div class="confirm" data-confirm hidden><p class="hint">${question}</p><div class="btnrow"><button type="button" class="btn small danger" data-del-yes>${yes}</button></div></div>` : ''}</section>`;
function bindDelete(sheet, fn) {
  const del = sheet.querySelector('[data-del]');
  if (!del) return;
  const box = sheet.querySelector('[data-confirm]');
  if (!box) { del.addEventListener('click', fn); return; }
  del.addEventListener('click', () => { box.hidden = false; del.hidden = true; });
  const yes = sheet.querySelector('[data-del-yes]');
  if (yes) yes.addEventListener('click', fn);
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet-root').hidden) closeSheet(); });

/* ---------- endre rekkefølge ----------
   Hvert element i listen har data-sort="id" og et grep (dragHandle).
   Dra i grepet, eller bruk pil opp/ned når grepet har fokus.
   onDone(ids) får den nye rekkefølgen når noe er flyttet. */
const ICON_GRIP = raw('<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>');
const dragHandle = name => h`<button type="button" class="handle" data-handle aria-label="${T.common.moveAria(name)}">${ICON_GRIP}</button>`;
function sortable(list, onDone) {
  const items = () => [...list.children].filter(x => x.dataset.sort != null);
  const done = () => { if (onDone) onDone(items().map(x => x.dataset.sort)); };
  list.addEventListener('pointerdown', e => {
    const hd = e.target.closest('[data-handle]');
    if (!hd || e.button > 0) return;
    const item = hd.closest('[data-sort]');
    if (!item || item.parentElement !== list) return;
    e.preventDefault();
    try { hd.setPointerCapture(e.pointerId); } catch (err) {}
    item.classList.add('dragging');
    let moved = false;
    const mid = el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const move = ev => {
      const all = items(), i = all.indexOf(item);
      const next = all[i + 1], prev = all[i - 1];
      if (next && ev.clientY > mid(next)) { next.after(item); moved = true; }
      else if (prev && ev.clientY < mid(prev)) { prev.before(item); moved = true; }
    };
    const up = () => {
      hd.removeEventListener('pointermove', move); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up);
      item.classList.remove('dragging');
      if (moved) done();
    };
    hd.addEventListener('pointermove', move); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  });
  list.addEventListener('keydown', e => {
    const hd = e.target.closest('[data-handle]');
    if (!hd || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const item = hd.closest('[data-sort]');
    const all = items(), i = all.indexOf(item);
    const other = all[e.key === 'ArrowUp' ? i - 1 : i + 1];
    e.preventDefault();
    if (!other) return;
    if (e.key === 'ArrowUp') other.before(item); else other.after(item);
    hd.focus();
    done();
  });
}
/* Setter en delmengde av en liste i ny rekkefølge og lar resten stå der de står */
function reorderSubset(arr, ids) {
  const byId = new Map(arr.map(x => [x.id, x]));
  const order = ids.filter(id => byId.has(id));
  const set = new Set(order);
  let k = 0;
  return arr.map(x => set.has(x.id) ? byId.get(order[k++]) : x);
}

/* ---------- melding nederst, med «Angre» ---------- */
let toastTimer = null;
function toast(msg, undo) {
  const t = $('#toast');
  setHtml(t, h`<span>${msg}</span>${undo ? h`<button type="button" id="undo">${T.common.undo}</button>` : ''}`);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), undo ? 7000 : 2600);
}
$('#toast').addEventListener('click', e => { if (e.target.id === 'undo') undoLast(); });
