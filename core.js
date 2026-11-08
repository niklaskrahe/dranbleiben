// Dranbleiben – Datenmodell und Berechnungen (Serien, Stärke, XP, Erfolge).
// Alles läuft lokal; der optionale Sync führt Stände über Zeitstempel zusammen.
"use strict";

const LSKEY = "dranbleiben.v1";
const APP_VERSION = "1.0";

/* ---------- Datum ---------- */
const pad2 = n => String(n).padStart(2, "0");
const dk = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const pk = k => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
const addD = (k, n) => { const d = pk(k); d.setDate(d.getDate() + n); return dk(d); };
const dow = k => ((pk(k).getDay() + 6) % 7) + 1;            // 1 = Mo … 7 = So
const wstart = k => addD(k, 1 - dow(k));                      // Montag der Woche
const ddiff = (a, b) => Math.round((pk(b) - pk(a)) / 864e5);  // Tage von a nach b
function isoWeek(k) {
  const d = pk(k); d.setDate(d.getDate() + 4 - dow(k));
  const y0 = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - y0) / 864e5 + 1) / 7);
}
const WD = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const WDL = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
const MON = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const MONS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const fmtShort = k => `${WD[dow(k) - 1]}, ${+k.slice(8)}. ${MONS[+k.slice(5, 7) - 1]}`;
const fmtLong = k => `${WDL[dow(k) - 1]}, ${+k.slice(8)}. ${MON[+k.slice(5, 7) - 1]}`;
const fmtDM = k => `${+k.slice(8)}.${+k.slice(5, 7)}.`;

/* ---------- Zahlen & Text ---------- */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = x => (+x || 0).toLocaleString("de-DE", { maximumFractionDigits: 1 });
const pct = x => `${Math.round((x || 0) * 100)} %`;
const uid = () => "h" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function fmtMin(m) {
  m = Math.round(m || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/* ---------- Konstanten ---------- */
const COLORS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"];
const COLOR_NAMES = { blue: "Blau", orange: "Orange", aqua: "Türkis", yellow: "Gelb", magenta: "Pink", green: "Grün", violet: "Violett", red: "Rot" };
const SLOTS = [["morning", "Morgens"], ["day", "Tagsüber"], ["evening", "Abends"], ["any", "Jederzeit"]];
const SLOT_NAME = Object.fromEntries(SLOTS);
const MOODS = [["😣", "Mies"], ["😕", "Naja"], ["😐", "Okay"], ["🙂", "Gut"], ["😄", "Super"]];
const EMOJIS = ["🏃", "🧗", "🏋️", "🚴", "🏊", "🤸", "🧘", "📖", "📚", "✍️", "🎯", "💻", "🧠", "🇪🇸", "💧", "🥗", "🍎", "😴", "🌅", "📵", "🗒️", "🧹", "💰", "🎸", "🦷", "🚶", "☀️", "🌿", "❤️", "🙏"];
const MILESTONES = [7, 14, 21, 30, 50, 66, 100, 150, 200, 365, 500, 1000];

const TEMPLATES = [
  { name: "Laufen", emoji: "🏃", color: "orange", type: "check", sched: { k: "week", n: 3 }, slot: "any", why: "Fit bleiben und den Kopf frei bekommen" },
  { name: "Klettern", emoji: "🧗", color: "violet", type: "check", sched: { k: "week", n: 1 }, slot: "any" },
  { name: "Krafttraining", emoji: "🏋️", color: "red", type: "check", sched: { k: "week", n: 2 }, slot: "any" },
  { name: "Deep Work", emoji: "🎯", color: "blue", type: "timer", target: 90, unit: "min", sched: { k: "days", days: [1, 2, 3, 4, 5] }, slot: "day", why: "Jeden Tag ein echtes Stück vorankommen" },
  { name: "Spanisch (Anki)", emoji: "🇪🇸", color: "yellow", type: "check", sched: { k: "daily" }, slot: "any", why: "Kleine Wiederholungen jeden Tag schlagen Pauken" },
  { name: "Lesen", emoji: "📖", color: "aqua", type: "count", target: 10, unit: "Seiten", sched: { k: "daily" }, slot: "evening" },
  { name: "Wasser trinken", emoji: "💧", color: "blue", type: "count", target: 8, unit: "Gläser", sched: { k: "daily" }, slot: "any" },
  { name: "Tag planen", emoji: "🗒️", color: "green", type: "check", sched: { k: "days", days: [1, 2, 3, 4, 5] }, slot: "morning", why: "Die drei wichtigsten Aufgaben festlegen" },
  { name: "Früh aufstehen", emoji: "🌅", color: "yellow", type: "check", sched: { k: "days", days: [1, 2, 3, 4, 5] }, slot: "morning" },
  { name: "Meditation", emoji: "🧘", color: "violet", type: "timer", target: 10, unit: "min", sched: { k: "daily" }, slot: "morning" },
  { name: "Dehnen / Mobility", emoji: "🤸", color: "aqua", type: "timer", target: 10, unit: "min", sched: { k: "daily" }, slot: "evening" },
  { name: "Kein Handy im Bett", emoji: "📵", color: "magenta", type: "check", sched: { k: "daily" }, slot: "evening" },
  { name: "Journaling", emoji: "✍️", color: "magenta", type: "check", sched: { k: "daily" }, slot: "evening" },
  { name: "Spaziergang", emoji: "🚶", color: "green", type: "check", sched: { k: "daily" }, slot: "day" },
];

/* ---------- Zustand ---------- */
function blankState() {
  return { v: 1, habits: [], entries: {}, days: {}, weeks: {}, settings: { name: "", dayStart: 3, sound: false, onboarded: false, t: 0 }, ach: {} };
}
function normalize(s) {
  const b = blankState();
  const out = { ...b, ...s, settings: { ...b.settings, ...(s.settings || {}) } };
  out.habits = (out.habits || []).map(normHabit);
  for (const k of ["entries", "days", "weeks", "ach"]) if (!out[k] || typeof out[k] !== "object") out[k] = {};
  return out;
}
function normHabit(h) {
  const s = h.sched || { k: "daily" };
  return {
    id: h.id || uid(), name: String(h.name || "Gewohnheit").slice(0, 60), emoji: h.emoji || "✅",
    color: COLORS.includes(h.color) ? h.color : "blue", type: ["check", "count", "timer"].includes(h.type) ? h.type : "check",
    target: Math.max(1, +h.target || 1), unit: h.unit || "",
    sched: { k: ["daily", "days", "week"].includes(s.k) ? s.k : "daily", days: Array.isArray(s.days) && s.days.length ? s.days.map(Number) : [1, 2, 3, 4, 5], n: clamp(+s.n || 3, 1, 7) },
    slot: SLOT_NAME[h.slot] ? h.slot : "any", why: h.why || "", start: h.start || null,
    archived: !!h.archived, archivedAt: h.archivedAt || null, gaps: Array.isArray(h.gaps) ? h.gaps : [],
    deleted: !!h.deleted, order: +h.order || 0, t: +h.t || 0,
  };
}
function loadState() {
  try { const s = JSON.parse(localStorage.getItem(LSKEY)); if (s && s.v === 1) return normalize(s); } catch (e) { /* defekt → neu */ }
  return blankState();
}

let S = loadState();
let REV = 0;

/* Tag beginnt um settings.dayStart Uhr (Abhaken nach Mitternacht zählt noch zum Vortag) */
function today() { return dk(new Date(Date.now() - (S.settings.dayStart || 0) * 3600e3)); }

/* ---------- Gewohnheiten & Einträge ---------- */
const habitsAll = () => S.habits.filter(h => !h.deleted);
const habitsActive = () => habitsAll().filter(h => !h.archived).sort((a, b) => a.order - b.order);
const habitById = id => S.habits.find(h => h.id === id);
const isWeekly = h => h.sched.k === "week";
const tgt = h => (h.type === "check" ? 1 : Math.max(1, +h.target || 1));
const unitOf = h => (h.type === "timer" ? "min" : h.unit || "");
const entryOf = (h, k) => S.entries[k]?.[h.id];
const valOf = (h, k) => entryOf(h, k)?.v || 0;
const doneOn = (h, k) => valOf(h, k) >= tgt(h);
const fracOn = (h, k) => Math.min(1, valOf(h, k) / tgt(h));
const pausedOn = k => !!S.days[k]?.pause;
const skippedOn = (h, k) => !!entryOf(h, k)?.s || pausedOn(k);
const lastDay = h => (h.archived && h.archivedAt ? addD(h.archivedAt, -1) : null);
/* aktiv = gestartet, nicht archiviert, nicht in einer früheren Archiv-Lücke */
const activeOn = (h, k) => !!h.start && k >= h.start && (!lastDay(h) || k <= lastDay(h)) && !h.gaps.some(g => k >= g[0] && k <= g[1]);
/* fest geplant an diesem Tag (täglich / bestimmte Wochentage) */
function scheduledOn(h, k) {
  if (!activeOn(h, k) || isWeekly(h)) return false;
  return h.sched.k === "daily" || h.sched.days.includes(dow(k));
}
function setEntry(h, k, patch) {
  const m = (S.entries[k] ||= {});
  const cur = m[h.id] || { v: 0, s: 0 };
  m[h.id] = { ...cur, ...patch, t: Date.now() };
  if (!h.start || k < h.start) { h.start = k; h.t = Date.now(); }
}
function schedLabel(h) {
  const s = h.sched;
  if (s.k === "daily") return "Täglich";
  if (s.k === "week") return `${s.n}× pro Woche`;
  const d = [...s.days].sort();
  if (d.join() === "1,2,3,4,5") return "Mo–Fr";
  if (d.join() === "6,7") return "Wochenende";
  return d.map(x => WD[x - 1]).join(", ");
}
function weekCount(h, k) { // erledigte Tage in der Woche von k
  const ws = wstart(k); let c = 0;
  for (let i = 0; i < 7; i++) if (doneOn(h, addD(ws, i))) c++;
  return c;
}

/* ---------- Kennzahlen pro Gewohnheit ---------- */
let CACHE = { rev: -1, day: "", hs: {}, agg: null };
function ensureCache() {
  const t = today();
  if (CACHE.rev !== REV || CACHE.day !== t) CACHE = { rev: REV, day: t, hs: {}, agg: null };
}
function hstats(h) { ensureCache(); return (CACHE.hs[h.id] ||= (isWeekly(h) ? computeWeekly(h) : computeFixed(h))); }

function baseStats(unit) {
  return { unit, cur: 0, best: 0, total: 0, strength: 0, xp: 0, minutes: 0, early: 0, comeback: false, rates: [], rate30: null };
}
function countEarly(h, k, e) {
  if (!e?.t) return 0;
  const d = new Date(e.t), ds = S.settings.dayStart || 0;
  return dk(new Date(e.t - ds * 3600e3)) === k && d.getHours() >= ds && d.getHours() < 8 ? 1 : 0;
}

function computeFixed(h) {
  const T = today(), r = baseStats("Tage");
  if (!h.start) return r;
  const end = lastDay(h) && lastDay(h) < T ? lastDay(h) : T;
  const perWeek = h.sched.k === "daily" ? 7 : h.sched.days.length || 1;
  const kf = Math.pow(0.5, 1 / Math.max(3, Math.round(10 * perWeek / 7))); // Halbwertszeit ≈ 10 Tage
  const win = { 7: [0, 0], 30: [0, 0], 90: [0, 0], all: [0, 0] };
  let run = 0, s = 0, miss = 0;
  for (let k = h.start; k <= end; k = addD(k, 1)) {
    const e = entryOf(h, k), v = e?.v || 0, done = v >= tgt(h);
    if (h.type === "timer") r.minutes += v;
    if (done) {
      r.total++; r.xp += 10;
      if (h.type === "timer") r.xp += Math.floor(v / 10);
      r.early += countEarly(h, k, e);
    }
    if (!scheduledOn(h, k) || skippedOn(h, k)) continue;
    const open = k === T && !done;
    if (done) {
      run++;
      if (miss >= 3 && r.total > 1) r.comeback = true;
      miss = 0;
      if (run >= 30) r.xp += 10; else if (run >= 7) r.xp += 5;
    } else if (!open) { run = 0; miss++; }
    if (run > r.best) r.best = run;
    if (!open) {
      s = s * kf + fracOn(h, k) * (1 - kf);
      const age = ddiff(k, T);
      for (const w of [7, 30, 90]) if (age < w) { win[w][1]++; if (done) win[w][0]++; }
      win.all[1]++; if (done) win.all[0]++;
    }
  }
  r.cur = run; r.strength = s;
  r.rates = [["7 Tage", ...win[7]], ["30 Tage", ...win[30]], ["90 Tage", ...win[90]], ["Gesamt", ...win.all]];
  r.rate30 = win[30][1] ? win[30][0] / win[30][1] : null;
  return r;
}

/* Wochenziele: n-mal pro Woche, Serie zählt in Wochen */
function weekInfo(h, ws, T = today()) {
  const n = h.sched.n; let cnt = 0, avail = 0;
  for (let i = 0; i < 7; i++) {
    const k = addD(ws, i);
    if (!activeOn(h, k)) continue;
    const done = doneOn(h, k);
    if (done) cnt++;
    if (done || !skippedOn(h, k)) avail++;
  }
  const req = Math.min(n, avail);
  return { cnt, req, met: req > 0 && cnt >= req, current: ws === wstart(T) };
}
function computeWeekly(h) {
  const T = today(), r = baseStats("Wochen");
  if (!h.start) return r;
  const end = lastDay(h) && lastDay(h) < T ? lastDay(h) : T;
  const kf = Math.pow(0.5, 1 / 4);
  const win = { 4: [0, 0], 12: [0, 0], all: [0, 0] };
  let run = 0, s = 0, miss = 0, before = 0;
  for (let k = h.start; k <= end; k = addD(k, 1)) {
    const e = entryOf(h, k), v = e?.v || 0;
    if (h.type === "timer") r.minutes += v;
    if (v >= tgt(h)) { r.total++; r.xp += 10; if (h.type === "timer") r.xp += Math.floor(v / 10); r.early += countEarly(h, k, e); }
  }
  for (let ws = wstart(h.start); ws <= end; ws = addD(ws, 7)) {
    const w = weekInfo(h, ws, T);
    if (w.req === 0) continue;
    const open = w.current && !w.met;
    if (w.met) { run++; r.xp += 30; if (miss >= 2 && before > 0) r.comeback = true; miss = 0; }
    else if (!open) { run = 0; miss++; }
    if (run > r.best) r.best = run;
    if (!open) {
      s = s * kf + Math.min(1, w.cnt / w.req) * (1 - kf);
      const age = ddiff(ws, wstart(T)) / 7;
      for (const n of [4, 12]) if (age < n) { win[n][1]++; if (w.met) win[n][0]++; }
      win.all[1]++; if (w.met) win.all[0]++;
    }
    before += w.cnt;
  }
  r.cur = run; r.strength = s;
  r.rates = [["4 Wochen", ...win[4]], ["12 Wochen", ...win[12]], ["Gesamt", ...win.all]];
  r.rate30 = win[4][1] ? win[4][0] / win[4][1] : null;
  return r;
}

/* ---------- Tageswerte (nur fest geplante Gewohnheiten) ---------- */
function dayInfo(k) {
  let due = 0, done = 0;
  for (const h of habitsAll()) {
    if (!scheduledOn(h, k) || skippedOn(h, k)) continue;
    due++; if (doneOn(h, k)) done++;
  }
  return { due, done, perfect: due > 0 && done === due, pause: pausedOn(k) };
}

/* Wochenquote: feste Tage + Wochenziele (laufende Woche ohne Abzug für offene Tage) */
function weekRate(ws) {
  const T = today(); let due = 0, done = 0;
  for (const h of habitsAll()) {
    if (isWeekly(h)) {
      const w = weekInfo(h, ws, T);
      if (!w.req) continue;
      if (w.current && !w.met) { done += w.cnt; due += w.cnt; }
      else { done += Math.min(w.cnt, w.req); due += w.req; }
      continue;
    }
    for (let i = 0; i < 7; i++) {
      const k = addD(ws, i);
      if (k > T || !scheduledOn(h, k) || skippedOn(h, k)) continue;
      const d = doneOn(h, k);
      if (k === T && !d) continue;
      due++; if (d) done++;
    }
  }
  return { due, done, rate: due ? done / due : null };
}

/* ---------- Gesamtauswertung ---------- */
function firstDay() {
  let f = null;
  for (const h of habitsAll()) if (h.start && (!f || h.start < f)) f = h.start;
  return f;
}
function aggregate() {
  ensureCache();
  if (CACHE.agg) return CACHE.agg;
  const T = today(), f = firstDay();
  const a = { days: {}, perfectDays: 0, pCur: 0, pBest: 0, perfectWeeks: 0, totalDone: 0, bestDays: 0, bestWeeks: 0,
    minutes: 0, early: 0, comeback: false, reviews: 0, moodDays: 0, activeCount: habitsActive().length, baseXP: 0 };
  if (f) {
    let run = 0;
    for (let k = f; k <= T; k = addD(k, 1)) {
      const d = dayInfo(k); a.days[k] = d;
      if (d.perfect) { a.perfectDays++; run++; }
      else if (d.due > 0 && k !== T) run = 0;
      if (run > a.pBest) a.pBest = run;
    }
    a.pCur = run;
    for (let ws = wstart(f); addD(ws, 6) <= T; ws = addD(ws, 7)) {
      let ok = true, perf = 0;
      for (let i = 0; i < 7; i++) {
        const d = a.days[addD(ws, i)];
        if (!d) continue;
        if (d.perfect) perf++; else if (d.due > 0) { ok = false; break; }
      }
      if (ok && perf >= 5) a.perfectWeeks++;
    }
  }
  for (const h of habitsAll()) {
    const st = hstats(h);
    a.totalDone += st.total; a.minutes += st.minutes; a.early += st.early; a.baseXP += st.xp;
    if (st.comeback) a.comeback = true;
    if (st.unit === "Tage") a.bestDays = Math.max(a.bestDays, st.best); else a.bestWeeks = Math.max(a.bestWeeks, st.best);
  }
  a.reviews = Object.values(S.weeks).filter(w => w.done).length;
  a.moodDays = Object.values(S.days).filter(d => d.m || (d.n && d.n.trim())).length;
  a.baseXP += a.perfectDays * 20 + a.reviews * 50;
  CACHE.agg = a;
  return a;
}

/* ---------- XP & Level ---------- */
const TITLES = [[1, "Neuling"], [3, "Starter"], [5, "Dranbleiber"], [8, "Gewohnheitstier"], [12, "Routinier"], [16, "Disziplin-Profi"], [20, "Meister"], [25, "Großmeister"], [30, "Legende"]];
const titleFor = L => TITLES.filter(t => L >= t[0]).pop()[1];
const nextTitle = L => TITLES.find(t => t[0] > L);
function levelFor(xp) {
  let L = 1, need = 100, acc = 0;
  while (xp >= acc + need) { acc += need; L++; need = 100 + 50 * (L - 1); }
  return { L, into: xp - acc, need, xp, title: titleFor(L) };
}
function totalXP() {
  const a = aggregate();
  let x = a.baseXP;
  for (const id of Object.keys(S.ach)) x += ACH_BY_ID[id]?.xp || 0;
  return x;
}
const level = () => levelFor(totalXP());

/* ---------- Erfolge ---------- */
const ACH = [
  { id: "first", e: "✅", n: "Erster Haken", d: "Die erste Gewohnheit erledigt", xp: 20, p: a => [a.totalDone, 1] },
  { id: "perfect1", e: "🌟", n: "Perfekter Tag", d: "An einem Tag alles Geplante geschafft", xp: 30, p: a => [a.perfectDays, 1] },
  { id: "perfect10", e: "💫", n: "Zehn perfekte Tage", d: "10 perfekte Tage insgesamt", xp: 75, p: a => [a.perfectDays, 10] },
  { id: "pweek", e: "🏆", n: "Perfekte Woche", d: "Eine ganze Woche ohne Lücke", xp: 100, p: a => [a.perfectWeeks, 1] },
  { id: "s7", e: "🔥", n: "Eine Woche dran", d: "7 geplante Tage in Folge bei einer Gewohnheit", xp: 40, p: a => [a.bestDays, 7] },
  { id: "s21", e: "🔥", n: "21 Tage", d: "21er-Serie: die Routine sitzt langsam", xp: 80, p: a => [a.bestDays, 21] },
  { id: "s66", e: "🧠", n: "Automatisch", d: "66er-Serie: so lange dauert es im Schnitt, bis eine Gewohnheit von allein läuft", xp: 150, p: a => [a.bestDays, 66] },
  { id: "s100", e: "💯", n: "Hundert", d: "100er-Serie bei einer Gewohnheit", xp: 250, p: a => [a.bestDays, 100] },
  { id: "s365", e: "👑", n: "Ein ganzes Jahr", d: "365er-Serie", xp: 500, p: a => [a.bestDays, 365] },
  { id: "w4", e: "📅", n: "Vier Wochen", d: "4 Wochen in Folge ein Wochenziel geschafft", xp: 40, p: a => [a.bestWeeks, 4] },
  { id: "w12", e: "🗓️", n: "Ein Quartal", d: "12 Wochen in Folge ein Wochenziel geschafft", xp: 120, p: a => [a.bestWeeks, 12] },
  { id: "t50", e: "🎯", n: "Fünfzig", d: "50-mal etwas erledigt", xp: 30, p: a => [a.totalDone, 50] },
  { id: "t250", e: "🎯", n: "Zweihundertfünfzig", d: "250-mal etwas erledigt", xp: 80, p: a => [a.totalDone, 250] },
  { id: "t1000", e: "🚀", n: "Tausend", d: "1000-mal etwas erledigt", xp: 250, p: a => [a.totalDone, 1000] },
  { id: "focus10", e: "⏱️", n: "Zehn Fokusstunden", d: "10 Stunden mit dem Fokus-Timer", xp: 60, p: a => [Math.floor(a.minutes / 60), 10] },
  { id: "focus100", e: "🧘", n: "Hundert Fokusstunden", d: "100 Stunden mit dem Fokus-Timer", xp: 300, p: a => [Math.floor(a.minutes / 60), 100] },
  { id: "early", e: "🌅", n: "Frühaufsteher", d: "20-mal vor 8 Uhr etwas erledigt", xp: 50, p: a => [a.early, 20] },
  { id: "comeback", e: "💪", n: "Comeback", d: "Nach einer längeren Lücke wieder eingestiegen", xp: 40, p: a => [a.comeback ? 1 : 0, 1] },
  { id: "review1", e: "📝", n: "Reflektiert", d: "Den ersten Wochenrückblick ausgefüllt", xp: 30, p: a => [a.reviews, 1] },
  { id: "review8", e: "🗂️", n: "Selbstkenner", d: "8 Wochenrückblicke ausgefüllt", xp: 100, p: a => [a.reviews, 8] },
  { id: "journal", e: "📔", n: "Tagebuch", d: "An 14 Tagen Stimmung oder Notiz festgehalten", xp: 40, p: a => [a.moodDays, 14] },
  { id: "five", e: "🧩", n: "Vielseitig", d: "5 aktive Gewohnheiten gleichzeitig", xp: 20, p: a => [a.activeCount, 5] },
  { id: "lvl5", e: "⭐", n: "Level 5", d: "Level 5 erreicht", xp: 0, p: (a, L) => [L, 5] },
  { id: "lvl10", e: "🌠", n: "Level 10", d: "Level 10 erreicht", xp: 0, p: (a, L) => [L, 10] },
  { id: "lvl20", e: "🪐", n: "Level 20", d: "Level 20 erreicht", xp: 0, p: (a, L) => [L, 20] },
];
const ACH_BY_ID = Object.fromEntries(ACH.map(x => [x.id, x]));
function achProgress(x) { const a = aggregate(); const [c, g] = x.p(a, level().L); return { c: Math.min(c, g), g, ok: c >= g }; }
/* Neue Erfolge eintragen; gibt die neu freigeschalteten zurück */
function checkAchievements() {
  const fresh = [];
  for (let round = 0; round < 3; round++) {
    let changed = false;
    for (const x of ACH) {
      if (S.ach[x.id]) continue;
      if (achProgress(x).ok) { S.ach[x.id] = today(); fresh.push(x); changed = true; }
    }
    if (!changed) break;
  }
  return fresh;
}

/* ---------- Zusammenführen (Sync & Import) ---------- */
function mergeStates(a, b) {
  a = normalize(a); b = normalize(b);
  const out = blankState();
  const hm = {};
  for (const h of [...a.habits, ...b.habits]) if (!hm[h.id] || h.t > hm[h.id].t) hm[h.id] = h;
  out.habits = Object.values(hm);
  for (const src of [a.entries, b.entries])
    for (const [d, m] of Object.entries(src))
      for (const [id, e] of Object.entries(m || {})) {
        const cur = out.entries[d]?.[id];
        if (!cur || (e.t || 0) > (cur.t || 0)) (out.entries[d] ||= {})[id] = e;
      }
  for (const key of ["days", "weeks"])
    for (const src of [a[key], b[key]])
      for (const [k, v] of Object.entries(src)) if (!out[key][k] || (v.t || 0) > (out[key][k].t || 0)) out[key][k] = v;
  out.settings = (b.settings.t || 0) > (a.settings.t || 0) ? b.settings : a.settings;
  for (const src of [a.ach, b.ach]) for (const [k, v] of Object.entries(src)) if (!out.ach[k] || v < out.ach[k]) out.ach[k] = v;
  return out;
}
