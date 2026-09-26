'use strict';
/* ---------- sol, vær (Open-Meteo, med MET Nordic-modellen i Norden) og klær ---------- */
function sunTimes(date) {
  const LOC = state && state.place;
  if (!LOC || typeof LOC.lat !== 'number') return { rise: null, set: null };
  const [y, m, d] = date.split('-').map(Number);
  const rad = Math.PI / 180;
  const jd = Date.UTC(y, m - 1, d, 12) / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0);
  const Js = n - LOC.lon / 360;
  const M = (357.5291 + 0.98560028 * Js) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const L = (M + C + 180 + 102.9372) % 360;
  const Jt = 2451545 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
  const dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
  const cw = (Math.sin(-0.833 * rad) - Math.sin(LOC.lat * rad) * Math.sin(dec)) / (Math.cos(LOC.lat * rad) * Math.cos(dec));
  if (cw < -1 || cw > 1) return { rise: null, set: null };
  const w = Math.acos(cw) / rad;
  const loc = J => { const t = new Date((J - 2440587.5) * 86400000); return t.getHours() * 60 + t.getMinutes() + (t.getSeconds() >= 30 ? 1 : 0); };
  return { rise: loc(Jt - w / 360), set: loc(Jt + w / 360) };
}

const wx = { data: null, index: null, loading: false };
function wxSetData(d) {
  wx.data = d;
  wx.index = new Map();
  if (d && d.time) d.time.forEach((t, i) => wx.index.set(t, i));
}
async function loadWeatherCache() { try { wxSetData(await store.getKey('weather')); } catch (e) {} }
function wxFresh() {
  const p = state.place, d = wx.data;
  return !!(p && d && d.lat === p.lat && d.lon === p.lon && Date.now() - Date.parse(d.fetched) < 60 * 60 * 1000);
}
async function refreshWeather(force) {
  const p = state && state.place;
  if (!p || wx.loading || (!force && wxFresh())) return;
  wx.loading = true;
  try {
    const nordic = p.lat > 54 && p.lat < 72 && p.lon > 3 && p.lon < 33;
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
      '&hourly=temperature_2m,precipitation,weather_code,wind_speed_10m&wind_speed_unit=ms&timezone=auto&past_days=1&forecast_days=10' +
      (nordic ? '&models=metno_seamless' : '');
    const r = await fetch(url);
    if (!r.ok) throw new Error('vær ' + r.status);
    const hh = (await r.json()).hourly;
    wxSetData({ lat: p.lat, lon: p.lon, fetched: new Date().toISOString(), time: hh.time, t: hh.temperature_2m, p: hh.precipitation, c: hh.weather_code, w: hh.wind_speed_10m });
    store.setKey('weather', wx.data);
    renderTimeline();
  } catch (e) { /* uten nett: bruk det som ligger lagret */ }
  finally { wx.loading = false; }
}
/* Oppsummerer været for et tidsrom samme dag (minutter fra midnatt). */
function wxFor(date, s, e) {
  const d = wx.data;
  if (!d || !wx.index || !state.place || d.lat !== state.place.lat || d.lon !== state.place.lon) return null;
  const rows = [];
  for (let hr = Math.floor(s / 60); hr < Math.max(Math.floor(s / 60) + 1, Math.ceil(e / 60)); hr++) {
    const i = wx.index.get(date + 'T' + pad(Math.min(23, hr)) + ':00');
    if (i != null && d.t[i] != null) rows.push(i);
  }
  if (!rows.length) return null;
  const t = rows.map(i => d.t[i]), p = rows.map(i => d.p[i] || 0), w = rows.map(i => d.w[i] || 0), c = rows.map(i => d.c[i] || 0);
  const sum = p.reduce((a, b) => a + b, 0);
  return { tmin: Math.round(Math.min(...t)), tmax: Math.round(Math.max(...t)), precip: Math.round(sum * 10) / 10, pmax: Math.max(...p), wind: Math.round(Math.max(...w)), code: Math.max(...c) };
}
const isWet = w => !!w && (w.precip >= 1 || w.pmax >= 0.5);
const isWindy = w => !!w && w.wind >= 10;
function wxText(w) {
  const temp = w.tmin === w.tmax ? w.tmin + T.wx.deg : w.tmin + '–' + w.tmax + T.wx.deg;
  const parts = [temp, T.wmo[w.code] || ''];
  if (w.precip > 0) parts.push(String(w.precip).replace('.', ',') + T.wx.mm);
  parts.push(T.wx.wind(w.wind));
  return parts.filter(Boolean).join(', ');
}
function clothesFor(w, pram) {
  if (!w) return '';
  const t = w.tmin, C = T.clothes;
  const base = t >= 16 ? C.warm : t >= 10 ? C.mild : t >= 5 ? C.cool : t >= 0 ? C.cold : C.frost;
  const extra = [];
  if (isWet(w)) extra.push(t < 1 ? C.wetFrost : C.wet);
  if (isWet(w) && pram) extra.push(C.pram);
  if (w.wind >= 8 && t < 10) extra.push(C.wind);
  return base + (extra.length ? ', ' + extra.join(', ') : '');
}
