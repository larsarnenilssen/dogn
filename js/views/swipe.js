'use strict';
/* ---------- sveiping ----------
   Dag: tidslinjen følger fingeren, nabodagen vises i kanten, og slipper du langt nok,
   glir den over til neste eller forrige dag.
   Kalender: sveip bytter måned. Dagstripen: sveip bytter dag.
   Ark: dra toppen av arket ned for å lukke, sveip fra venstre kant for «Tilbake».
   Loddrett blaing, dra-grep, skjemafelt og tabeller som ruller vannrett utløser ikke sveip. */
const reduceMotion = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const noSwipe = t => !!(t && t.closest && t.closest('[data-handle], input, textarea, select, .tblwrap, .seg, .strip'));

/* Felles gjenkjenning: bestemmer retning etter 10 px, og rapporterer bare vannrette sveip */
function horizontalSwipe(el, { start, move, end, cancel, filter }) {
  let sx = 0, sy = 0, t0 = 0, mode = null;
  el.addEventListener('touchstart', e => {
    mode = e.touches.length !== 1 || (filter && !filter(e)) ? 'off' : null;
    if (mode) return;
    const p = e.touches[0]; sx = p.clientX; sy = p.clientY; t0 = Date.now();
  }, { passive: true });
  el.addEventListener('touchmove', e => {
    if (mode === 'off') return;
    const p = e.touches[0], dx = p.clientX - sx, dy = p.clientY - sy;
    if (!mode) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
      mode = Math.abs(dx) > Math.abs(dy) * 1.2 ? 'x' : 'off';
      if (mode === 'x' && start) start(dx, sx);
    }
    if (mode === 'x' && move) move(dx, dy);
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (mode === 'x') { const p = e.changedTouches[0]; end(p.clientX - sx, p.clientY - sy, Date.now() - t0, sx); }
    mode = null;
  }, { passive: true });
  el.addEventListener('touchcancel', () => { if (mode === 'x' && cancel) cancel(); mode = null; }, { passive: true });
}
const isFling = (dx, ms, width) => Math.abs(dx) > Math.min(90, width * 0.22) || (Math.abs(dx) > 40 && Math.abs(dx) / Math.max(1, ms) > 0.5);

/* ---------- dag ---------- */
(() => {
  const tl = $('#timeline');
  let peek = null;
  const clear = () => { tl.style.transform = ''; tl.style.opacity = ''; tl.classList.remove('swiping', 'settle'); if (peek) { peek.remove(); peek = null; } };
  const settle = (x, done) => {
    tl.classList.remove('swiping'); tl.classList.add('settle');
    tl.style.transform = x ? 'translateX(' + x + 'px)' : ''; tl.style.opacity = x ? '0' : '';
    setTimeout(() => { if (done) done(); }, 180);
  };
  horizontalSwipe(tl, {
    filter: e => !noSwipe(e.target) && !sheetOpen(),
    start: () => {
      tl.classList.add('swiping');
      peek = document.createElement('div');
      peek.className = 'peek';
      peek.setAttribute('aria-hidden', 'true');
      document.body.appendChild(peek);
    },
    move: dx => {
      tl.style.transform = 'translateX(' + dx + 'px)';
      tl.style.opacity = String(1 - Math.min(0.4, Math.abs(dx) / 700));
      const dir = dx < 0 ? 1 : -1;
      peek.className = 'peek ' + (dir > 0 ? 'r' : 'l');
      peek.textContent = dir > 0 ? fmtDateTiny(addDays(view, 1)) + ' ›' : '‹ ' + fmtDateTiny(addDays(view, -1));
      peek.style.opacity = String(Math.min(1, Math.abs(dx) / 80));
    },
    end: (dx, dy, ms) => {
      const w = tl.clientWidth || window.innerWidth;
      if (!isFling(dx, ms, w)) { settle(0, clear); return; }
      const dir = dx < 0 ? 1 : -1;
      if (reduceMotion()) { clear(); go(dir); return; }
      settle(dx < 0 ? -w : w, () => {
        if (peek) { peek.remove(); peek = null; }
        go(dir);
        tl.classList.remove('settle');
        tl.style.transform = 'translateX(' + (dir > 0 ? w * 0.3 : -w * 0.3) + 'px)';
        void tl.offsetWidth;
        settle(0, clear);
      });
    },
    cancel: () => settle(0, clear),
  });
})();

/* ---------- dagstripen ---------- */
(() => {
  const strip = $('#strip');
  let swiped = 0;
  horizontalSwipe(strip, {
    end: (dx, dy, ms) => { if (isFling(dx, ms, strip.clientWidth || 300) || Math.abs(dx) > 50) { swiped = Date.now(); go(dx < 0 ? 1 : -1); } },
  });
  // Et sveip skal ikke også regnes som trykk på stripen
  strip.addEventListener('click', e => { if (Date.now() - swiped < 400) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
})();

/* ---------- kalender og ark ---------- */
(() => {
  const root = $('#sheet-root');
  // Kalender: sveip bytter måned
  horizontalSwipe(root, {
    filter: e => !!e.target.closest('.cal'),
    end: (dx, dy, ms) => {
      if (Math.abs(dx) < 50) return;
      const btns = root.querySelectorAll('.cal-nav [data-month]');
      const b = dx < 0 ? btns[btns.length - 1] : btns[0];
      if (b) b.click();
    },
  });
  // Ark: sveip fra venstre kant = «Tilbake»
  horizontalSwipe(root, {
    filter: e => e.touches[0].clientX < 28 && !!e.target.closest('.sheet'),
    end: dx => {
      if (dx < 70) return;
      const b = root.querySelector('.sheet [data-goback], .sheet [data-back]');
      if (b) b.click();
    },
  });
  // Ark: dra toppen ned for å lukke
  let sy = 0, dy = 0, sheet = null;
  root.addEventListener('touchstart', e => {
    sheet = null;
    const s = e.target.closest('.sheet');
    if (!s || e.touches.length !== 1) return;
    const head = e.target.closest('.sh-head, .grab') || e.touches[0].clientY - s.getBoundingClientRect().top < 24;
    if (!head || e.target.closest('button, input, select, textarea')) return;
    sheet = s; sy = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  root.addEventListener('touchmove', e => {
    if (!sheet) return;
    dy = Math.max(0, e.touches[0].clientY - sy);
    sheet.style.transition = 'none';
    sheet.style.transform = 'translateY(' + dy + 'px)';
  }, { passive: true });
  root.addEventListener('touchend', () => {
    if (!sheet) return;
    const s = sheet; sheet = null;
    s.style.transition = reduceMotion() ? 'none' : '';
    if (dy > 90) { s.style.transform = 'translateY(100%)'; setTimeout(closeSheet, reduceMotion() ? 0 : 200); }
    else s.style.transform = '';
  }, { passive: true });
})();
