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
  setHtml(root, h`<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-modal="true">${html}</div>`);
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
const hint = text => h`<p class="hint">${text}</p>`;
const emptyRow = text => h`<div><span class="hint">${text}</span></div>`;
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
