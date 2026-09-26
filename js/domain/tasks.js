'use strict';
/* ---------- gjøremål som går igjen, og huskepunkter ---------- */
function ruleText(r) {
  if (r.kind === 'once') return T.tasks.once(fmtDateShort(r.start));
  if (r.kind === 'daily') return T.tasks.daily;
  if (r.kind === 'weekdays') return (r.days || []).slice().sort().map(wdShort).join(', ') || T.tasks.noDays;
  if (r.every === 7) return T.tasks.weekly;
  if (r.every === 14) return T.tasks.biweekly;
  if (r.every === 1) return T.tasks.daily;
  return T.tasks.every(r.every);
}
function completions(taskId) {
  return Object.keys(state.days).filter(d => state.days[d].done && state.days[d].done[taskId]).sort();
}
function taskStatus(task, date) {
  const done = isDone(date, task.id);
  const r = task.rule || { kind: 'daily' };
  const start = r.start || '0000-01-01';
  if (date < start) return { show: done, done, late: 0 };
  if (r.kind === 'daily') return { show: true, done, late: 0 };
  if (r.kind === 'once') {
    if (completions(task.id).some(d => d < date)) return { show: false, done, late: 0 };
    return { show: true, done, late: done ? 0 : diffDays(start, date) };
  }
  if (r.kind === 'weekdays') return { show: done || (r.days || []).includes(isoWd(date)), done, late: 0 };
  const every = Math.max(1, Number(r.every) || 1);
  const prev = completions(task.id).filter(d => d < date).pop();
  const dueFrom = prev ? addDays(prev, every) : start;
  return { show: done || date >= dueFrom, done, late: done ? 0 : Math.max(0, diffDays(dueFrom, date)), prev };
}
/* Hvilken bolk hvert gjøremål vises i: samme navn (slot), ellers samme type, ellers siste bolk */
function placeTasks(date, blocks) {
  const map = {};
  for (const t of state.tasks) {
    const st = taskStatus(t, date);
    if (!st.show) continue;
    const b = blocks.find(x => x.slot === t.slot) || blocks.find(x => x.type === t.type) || blocks[blocks.length - 1];
    if (!b) continue;
    (map[b.id] ??= []).push({ task: t, st });
  }
  return map;
}
function allSlots() {
  const first = templateFor(view);
  const ids = [first, ...Object.keys(state.templates).filter(k => k !== first)];
  const seen = new Map();
  for (const id of ids) for (const b of sortBlocks([...state.templates[id].blocks])) {
    if (!seen.has(b.slot)) seen.set(b.slot, { slot: b.slot, type: b.type, label: b.title + ' ' + b.start, min: toMin(b.start) });
  }
  return [...seen.values()].sort((a, b) => a.min - b.min);
}
/* Hvor et nytt huskepunkt havner: i neste lur, i kveld eller i morgen */
function reminderTarget(when) {
  const today = todayISO(), now = nowMin();
  const bl = blocksFor(today);
  if (when === 'kveld') { const k = resetBlock(bl); return { date: today, slot: k ? k.slot : 'kveld', type: k ? k.type : 'routine', label: T.add.tonight }; }
  if (when === 'lur') {
    const i = bl.findIndex((b, j) => b.type === 'sleep' && endOf(bl, j) > now);
    if (i >= 0) return { date: today, slot: bl[i].slot, type: 'sleep', label: T.add.inNap(bl[i].start) };
  }
  const t = addDays(today, 1);
  const tb = blocksFor(t).find(b => b.type === 'sleep') || blocksFor(t)[0];
  return { date: t, slot: tb ? tb.slot : 'lur1', type: tb ? tb.type : 'sleep', label: T.add.tomorrow(tb ? tb.start : '') };
}
