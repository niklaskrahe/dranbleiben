// Dranbleiben – Oberfläche, Fokus-Timer und optionaler Cloud-Sync.
"use strict";

const CFG = window.DRANBLEIBEN_CONFIG || {};
const TKEY = "dranbleiben.timer";
const AUTHKEY = "dranbleiben-auth";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const UI = { tab: "today", sel: null, sheet: null, pop: null, detMonth: null, offOpen: false, lastDay: null, pending: false, tmMin: null };
const PRAISE = ["Stark!", "Erledigt!", "Weiter so!", "Sauber!", "Läuft!", "Gut gemacht!", "Ein Haken mehr!"];
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ck" d="m5.5 12.5 4.2 4.2L18.5 7.8"/></svg>';
const PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="play" d="M8 5.5v13l10.5-6.5z"/></svg>';
const colorVar = h => `--h:var(--c-${h.color})`;

/* =========================================================
   Speichern, Rendern, Rückmeldung
   ========================================================= */
function persist() {
  try { localStorage.setItem(LSKEY, JSON.stringify(S)); }
  catch (e) { toast("Speichern fehlgeschlagen – ist der Speicher voll?", { err: true }); }
}
function commit({ sync = true, quiet = false, render: doRender = true } = {}) {
  REV++;
  persist();
  const fresh = checkAchievements();
  if (fresh.length) persist();
  if (!quiet) for (const x of fresh) { toast(`${x.e} Erfolg freigeschaltet: ${x.n}${x.xp ? ` · +${x.xp} XP` : ""}`); celebrate(); }
  if (sync) scheduleSync();
  if (doRender) refresh();
}
function persistSoon() { clearTimeout(UI.ps); UI.ps = setTimeout(() => commit({ render: false }), 600); }

function refresh() {
  render();
  if (UI.sheet && SHEETS[UI.sheet.type]?.live) renderSheet();
}
function render(force) {
  const view = $("#view"), a = document.activeElement;
  if (!force && a && view.contains(a) && a.matches("textarea,input[type=text],input[type=email],input[type=password],input:not([type])")) { UI.pending = true; return; }
  UI.pending = false;
  const onboarding = !habitsAll().length && !S.settings.onboarded;
  $("#tabbar").hidden = onboarding;
  const fk = focusKey();
  view.innerHTML = onboarding ? vOnboard() : VIEWS[UI.tab]();
  UI.pop = null; UI.popT = null;
  for (const b of $$("#tabbar button")) b.dataset.tab === UI.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current");
  if (fk) { const el = view.querySelector(fk); if (el) el.focus({ preventScroll: true }); }
  tick();
  if (UI.tab === "more") updatePersistInfo();
}
function focusKey() {
  const a = document.activeElement;
  if (!a || !a.dataset || !a.dataset.act || !$("#view").contains(a)) return null;
  const d = a.dataset;
  return `[data-act="${d.act}"]` + (d.id ? `[data-id="${d.id}"]` : "") + (d.k ? `[data-k="${d.k}"]` : "") + (d.tab ? `[data-tab="${d.tab}"]` : "") + (d.m ? `[data-m="${d.m}"]` : "");
}

/* Rückmeldung nach Abhaken: Serien-Meilensteine, perfekter Tag, Level-Up */
function withFeedback(h, k, mutate) {
  const T = today();
  const snap = () => ({ done: doneOn(h, k), perf: dayInfo(k).perfect, L: level().L, wmet: isWeekly(h) ? weekInfo(h, wstart(k)).met : false });
  const b = snap();
  mutate();
  UI.pop = h.id;
  commit();
  const a = snap();
  let msg = null, party = false;
  if (!b.done && a.done) {
    buzz(12);
    const st = hstats(h);
    if (isWeekly(h)) {
      if (!b.wmet && a.wmet) { msg = `${h.emoji} Wochenziel geschafft! +30 XP`; party = true; }
      else msg = `${pickOne(PRAISE)} ${weekCount(h, k)}/${h.sched.n} diese Woche`;
    } else if (k === T && MILESTONES.includes(st.cur)) { msg = `🔥 ${st.cur} Tage ${h.name} am Stück – Meilenstein!`; party = true; }
    else if (k === T && st.cur >= 2) msg = `🔥 ${st.cur} Tage in Folge · ${h.name}`;
    else msg = `${pickOne(PRAISE)} +10 XP`;
  }
  if (!b.perf && a.perf) {
    const p = k === T ? "🌟 Perfekter Tag – alles geschafft! +20 XP" : `🌟 ${fmtShort(k)} ist jetzt ein perfekter Tag`;
    msg = party && msg ? `${msg} · ${p}` : p; party = true;
  }
  if (msg) toast(msg);
  if (party) { celebrate(); sound("perfect"); } else if (!b.done && a.done) sound("done");
  if (a.L > b.L) { toast(`⬆️ Level ${a.L} erreicht · ${titleFor(a.L)}`); celebrate(); }
}

/* =========================================================
   Ansicht: Heute
   ========================================================= */
function greeting() {
  const hr = new Date().getHours(), n = S.settings.name ? `, ${S.settings.name}` : "";
  if (hr < 5) return `Noch wach${n}?`;
  if (hr < 11) return `Guten Morgen${n}`;
  if (hr < 17) return `Hallo${n}`;
  if (hr < 22) return `Guten Abend${n}`;
  return `Gute Nacht${n}`;
}
function ring(done, due) {
  const r = 32, c = 2 * Math.PI * r, p = due ? done / due : 0;
  const pr = p > 0 ? `<circle class="pr" cx="38" cy="38" r="${r}" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}"/>` : "";
  return `<div class="ring" role="img" aria-label="${due ? `${done} von ${due} erledigt` : "Nichts fest geplant"}">
    <svg width="76" height="76" viewBox="0 0 76 76"><circle class="tr" cx="38" cy="38" r="${r}" fill="none" stroke-width="7"/>${pr}</svg>
    <div class="lab"><b>${due ? `${done}/${due}` : "–"}</b><span>${!due ? "frei" : p === 1 ? "perfekt" : "erledigt"}</span></div></div>`;
}
function miniRing(p) {
  const r = 10, c = 2 * Math.PI * r;
  const pr = p > 0 ? `<circle class="pr" cx="13" cy="13" r="${r}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - p)).toFixed(1)}" transform="rotate(-90 13 13)"/>` : "";
  return `<svg class="mini" viewBox="0 0 26 26" aria-hidden="true"><circle class="tr" cx="13" cy="13" r="${r}"/>${pr}</svg>`;
}
function levelBar() {
  const lv = level();
  return `<button class="lvl" data-act="tab" data-tab="awards" aria-label="Level ${lv.L}, ${lv.into} von ${lv.need} XP – Erfolge ansehen">
    <span class="badge">Lv ${lv.L} · ${lv.title}</span><div class="meter"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></div><span class="xp">${lv.into}/${lv.need} XP</span></button>`;
}
function missedLast(h, T) {
  for (let i = 1; i <= 7; i++) {
    const k = addD(T, -i);
    if (!activeOn(h, k)) return false;
    if (scheduledOn(h, k) && !skippedOn(h, k)) return !doneOn(h, k);
  }
  return false;
}
function hadHabitsIn(ws) { const fri = addD(ws, 4); return habitsAll().some(h => h.start && h.start <= fri); } // erst ab ein paar Tagen Verlauf
function reviewDue(T) {
  const cur = wstart(T), prev = addD(cur, -7), hr = new Date().getHours();
  if (dow(T) === 7 && hr >= 16 && !S.weeks[cur]?.done && hadHabitsIn(cur)) return cur;
  if (dow(T) <= 3 && !S.weeks[prev]?.done && hadHabitsIn(prev)) return prev;
  return null;
}
function focusHabitId(T = today()) { return S.weeks[addD(wstart(T), -7)]?.focus || null; }

function hints(T) {
  const out = [], hr = new Date().getHours(), act = habitsActive();
  const rw = reviewDue(T);
  if (rw) out.push(`<div class="banner"><span>📝 <b>Wochenrückblick</b> für KW ${isoWeek(rw)} ausfüllen · +50 XP</span><button class="ghost" data-act="review" data-ws="${rw}">Jetzt</button></div>`);
  const missed = act.filter(h => scheduledOn(h, T) && !doneOn(h, T) && !skippedOn(h, T) && missedLast(h, T));
  if (missed.length) out.push(`<div class="banner"><span>↩️ <b>Nie zweimal verpassen:</b> ${missed.map(h => esc(`${h.emoji} ${h.name}`)).join(", ")} ${missed.length > 1 ? "kamen" : "kam"} zuletzt zu kurz. Heute zählt doppelt.</span></div>`);
  if (hr >= 19 || hr < (S.settings.dayStart || 0)) {
    const risk = act.filter(h => scheduledOn(h, T) && !doneOn(h, T) && !skippedOn(h, T) && hstats(h).cur >= 3);
    if (risk.length) out.push(`<div class="banner"><span>🔥 <b>Serie in Gefahr:</b> ${risk.map(h => `${esc(h.name)} (${hstats(h).cur})`).join(", ")}</span></div>`);
  }
  return out.slice(0, 2).join("");
}

function card(h, k, focusId) {
  const v = valOf(h, k), t = tgt(h), done = v >= t, sk = skippedOn(h, k), st = hstats(h);
  const id = `data-id="${h.id}" data-k="${k}"`;
  const meta = [];
  if (st.cur > 0) meta.push(`<span class="fl">🔥 ${st.cur}${isWeekly(h) ? " Wo." : ""}</span>`);
  if (isWeekly(h)) meta.push(`<span>${weekCount(h, k)}/${h.sched.n} diese Woche${weekInfo(h, wstart(k)).met ? " ✓" : ""}</span>`);
  else if (!scheduledOn(h, k)) meta.push(`<span>${schedLabel(h)}</span>`);
  if (h.type !== "check") meta.push(`<span>${num(v)} / ${t} ${esc(unitOf(h))}</span>`);
  if (sk && !done) meta.push(`<span>${pausedOn(k) ? "Pausetag" : "übersprungen"}</span>`);
  if (h.id === focusId) meta.push(`<span class="chip star">⭐ Fokus der Woche</span>`);
  let ctl;
  if (h.type === "check") {
    ctl = `<button class="chk ${done ? "on" : ""}" data-act="toggle" ${id} aria-pressed="${done}" aria-label="${esc(h.name)} ${done ? "als offen markieren" : "abhaken"}">${CHECK_SVG}</button>`;
  } else if (h.type === "count") {
    ctl = `<div class="cnt"><button data-act="dec" ${id} aria-label="${esc(h.name)}: eins weniger" ${v <= 0 ? "disabled" : ""}>−</button>
      <button class="cv" data-act="value" ${id} aria-label="${esc(h.name)}: Wert eintragen">${num(v)}<small>/${t}</small></button>
      <button class="plus" data-act="inc" ${id} aria-label="${esc(h.name)}: eins mehr">+</button></div>`;
  } else {
    ctl = done ? `<button class="chk on" data-act="value" ${id} aria-label="${esc(h.name)}: Minuten bearbeiten">${CHECK_SVG}</button>`
      : `<div class="tctl"><button class="addmin" data-act="value" ${id} aria-label="${esc(h.name)}: Minuten nachtragen">+</button><button class="chk tm" data-act="timer" ${id} aria-label="${esc(h.name)}: Fokus-Timer starten">${PLAY_SVG}</button></div>`;
  }
  const bar = h.type !== "check" && v > 0 && !done ? `<div class="bar"><i style="width:${(v / t * 100).toFixed(1)}%"></i></div>` : "";
  return `<article class="habit${done ? " done" : ""}${sk && !done ? " skip" : ""}${UI.pop === h.id ? " pop" : ""}" style="${colorVar(h)}" data-act="detail" data-id="${h.id}" tabindex="0">
    <div class="ico" aria-hidden="true">${esc(h.emoji)}</div>
    <div class="grow"><div class="nm">${esc(h.name)}</div><div class="meta">${meta.join("")}</div></div>${ctl}${bar}</article>`;
}

function vToday() {
  const T = today();
  if (!UI.sel || UI.sel > T) UI.sel = T;
  const k = UI.sel, isT = k === T, act = habitsActive();
  const di = dayInfo(k), focusId = focusHabitId(k);
  const strip = Array.from({ length: 7 }, (_, i) => addD(T, i - 6)).map(d => {
    const x = dayInfo(d);
    return `<button class="day${x.perfect ? " perfect" : ""}" data-act="selDay" data-k="${d}" ${d === k ? 'aria-current="date"' : ""} aria-label="${fmtLong(d)}: ${x.due ? `${x.done} von ${x.due} erledigt` : "nichts geplant"}">
      <small>${WD[dow(d) - 1]}</small><b>${+d.slice(8)}</b>${miniRing(x.due ? x.done / x.due : 0)}</button>`;
  }).join("") + `<label class="datepick" title="Anderes Datum"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg><input type="date" data-input="pickDate" max="${T}" value="${k}" aria-label="Datum wählen"></label>`;

  let sub;
  if (!isT) sub = `Nachtragen für ${fmtShort(k)}`;
  else if (!di.due) sub = act.some(isWeekly) ? "Heute nichts Festes – Zeit für ein Wochenziel?" : "Heute steht nichts Festes an.";
  else if (di.perfect) sub = "Alles erledigt. Stark!";
  else sub = `Noch ${di.due - di.done} offen${di.done ? ` · ${di.done} geschafft` : ""}`;

  let html = `<header class="top"><div><div class="label">${isT ? fmtLong(k) : "Rückblick"}</div><h1>${isT ? esc(greeting()) : esc(fmtLong(k))}</h1><p class="sub">${sub}</p></div>${ring(di.done, di.due)}</header>
    ${levelBar()}
    <nav class="days" aria-label="Tag wählen">${strip}</nav>`;
  if (!isT) html += `<div class="banner"><span>Du bearbeitest <b>${fmtLong(k)}</b>.</span><button class="ghost" data-act="selDay" data-k="${T}">Zu heute</button></div>`;
  if (TM) { const th = habitById(TM.hid); html += `<button class="tpill" data-act="openTimer" data-id="${TM.hid}">⏱️ <span class="grow">${esc(th?.name || "Fokus")}${TM.start ? "" : " · pausiert"}</span><b data-tm="pill">--:--</b></button>`; }
  if (isT) html += hints(T);
  if (di.perfect && isT) html += `<div class="banner good"><span>🌟 <b>Perfekter Tag.</b> Alles Geplante ist erledigt.</span></div>`;

  if (!act.length) {
    return html + todoSection(k, isT) + `<div class="empty"><p>Noch keine Gewohnheiten.</p><button class="accentbtn" data-act="add">+ Erste Gewohnheit anlegen</button></div>`;
  }
  const byFocus = (a, b) => (b.id === focusId) - (a.id === focusId) || a.order - b.order;
  const fixed = act.filter(h => scheduledOn(h, k));
  for (const [slot, label] of SLOTS) {
    const list = fixed.filter(h => h.slot === slot).sort(byFocus);
    if (!list.length) continue;
    const dn = list.filter(h => doneOn(h, k)).length;
    html += `<section class="sec" aria-label="${label}"><div class="label"><span>${label}</span><span>${dn}/${list.length}</span></div>${list.map(h => card(h, k, focusId)).join("")}</section>`;
  }
  const weekly = act.filter(h => isWeekly(h) && activeOn(h, k)).sort(byFocus);
  if (weekly.length) {
    const met = weekly.filter(h => weekInfo(h, wstart(k)).met).length;
    html += `<section class="sec" aria-label="Wochenziele"><div class="label"><span>Wochenziele · KW ${isoWeek(k)}</span><span>${met}/${weekly.length}</span></div>${weekly.map(h => card(h, k, focusId)).join("")}</section>`;
  }
  const off = act.filter(h => !isWeekly(h) && activeOn(h, k) && !scheduledOn(h, k));
  if (off.length) html += `<details class="more" data-det="off" ${UI.offOpen ? "open" : ""}><summary>${isT ? "Heute" : "An dem Tag"} nicht geplant (${off.length})</summary><div class="sec">${off.map(h => card(h, k, focusId)).join("")}</div></details>`;
  if (!fixed.length && !weekly.length && act.length) html += `<p class="hint">Für diesen Tag ist nichts geplant${act.some(h => h.start > k) ? " (oder die Gewohnheiten starteten erst später)" : ""}.</p>`;
  html += `<button class="ghost" data-act="add" style="justify-self:start">+ Gewohnheit hinzufügen</button>`;
  html += todoSection(k, isT);

  const dd = S.days[k] || {};
  html += `<section class="panel" aria-label="Tagesnotiz">
    <div class="panel-head"><h3>${isT ? "Wie läuft dein Tag?" : "Wie war der Tag?"}</h3><span class="hint">optional</span></div>
    <div class="moods" role="group" aria-label="Stimmung">${MOODS.map(([e, l], i) => `<button data-act="mood" data-m="${i + 1}" data-k="${k}" aria-pressed="${dd.m === i + 1}"><span>${e}</span><small>${l}</small></button>`).join("")}</div>
    <textarea data-input="note" data-k="${k}" rows="2" maxlength="2000" placeholder="Notiz zum Tag – was lief gut, was hat gebremst?">${esc(dd.n || "")}</textarea>
    <label class="switch"><input type="checkbox" data-input="pause" data-k="${k}" ${dd.pause ? "checked" : ""}><span><b>Pausetag</b> <span class="hint">– krank oder Urlaub: Serien bleiben stehen, nichts zählt als verpasst.</span></span></label>
  </section>`;
  return html;
}

/* ---------- Aufgaben ---------- */
const CAL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
function todoCard(td, mode) {
  const meta = mode === "late" ? `<div class="meta"><span class="late">fällig ${fmtShort(td.date)}</span></div>`
    : mode === "up" ? `<div class="meta"><span>${fmtShort(td.date)}</span></div>` : "";
  return `<article class="todo${td.done ? " done" : ""}${UI.popT === td.id ? " pop" : ""}" data-act="todoEdit" data-id="${td.id}" tabindex="0">
    <button class="chk${td.done ? " on" : ""}" data-act="todoToggle" data-id="${td.id}" aria-pressed="${td.done}" aria-label="${esc(td.title)} ${td.done ? "als offen markieren" : "abhaken"}">${CHECK_SVG}</button>
    <div class="grow"><div class="nm">${td.imp ? '<span aria-label="wichtig">⭐</span> ' : ""}${esc(td.title)}</div>${meta}</div>
    ${mode === "late" ? `<button class="ghost sm" data-act="todoToday" data-id="${td.id}">→ Heute</button>` : ""}</article>`;
}
function todoSection(k, isT) {
  const T = today(), list = todosOn(k), late = isT ? todosOverdue(T) : [], up = isT ? todosUpcoming(T) : [];
  const dn = list.filter(t => t.done).length;
  let h = `<section class="sec" aria-label="Aufgaben"><div class="label"><span>Aufgaben${isT ? "" : ` · ${fmtShort(k)}`}</span><span>${list.length ? `${dn}/${list.length}` : ""}</span></div>`;
  if (late.length) h += `<div class="label late-l">Überfällig (${late.length})</div>${late.map(t => todoCard(t, "late")).join("")}`;
  h += list.map(t => todoCard(t, "")).join("");
  h += `<form id="fTodo" class="tadd" data-k="${k}">
      <input type="text" name="title" id="todoInput" maxlength="120" autocomplete="off" enterkeyhint="done" placeholder="Neue Aufgabe für ${isT ? "heute" : fmtShort(k)} …" aria-label="Neue Aufgabe">
      <label class="datepick" title="Anderer Tag">${CAL_SVG}<input type="date" name="date" data-input="todoDate" value="${k}" aria-label="Tag der Aufgabe"></label>
      <button class="accentbtn" aria-label="Aufgabe hinzufügen">+</button></form>`;
  if (up.length) h += `<details class="more" data-det="up" ${UI.upOpen ? "open" : ""}><summary>Demnächst (${up.length})</summary><div class="sec">${up.map(t => todoCard(t, "up")).join("")}</div></details>`;
  return h + `</section>`;
}
function todoDialog(td) {
  dialog(`<form id="fTodoEdit" data-id="${td.id}" style="display:grid;gap:12px">
      <h3>Aufgabe</h3>
      <label class="field"><span>Titel</span><input type="text" name="title" maxlength="120" value="${esc(td.title)}"></label>
      <label class="field"><span>Tag</span><input type="date" name="date" value="${td.date}"></label>
      <div class="quick"><button type="button" data-act="tdDate" data-d="0">Heute</button><button type="button" data-act="tdDate" data-d="1">Morgen</button><button type="button" data-act="tdDate" data-d="mon">Nächsten Montag</button></div>
      <label class="switch"><input type="checkbox" name="imp" ${td.imp ? "checked" : ""}><span>Wichtig ⭐ <span class="hint">(steht oben)</span></span></label>
      <div class="between"><button type="button" class="link danger" data-act="todoDel" data-id="${td.id}">Löschen</button>
        <span class="btnrow"><button type="button" class="ghost" data-act="dlgNo">Abbrechen</button><button class="primary">Speichern</button></span></div>
    </form>`);
}
function todoToggle(td) {
  const T = today(), L0 = level().L;
  if (td.done) { setTodo(td, { done: false, doneAt: null }); commit(); return; }
  const patch = { done: true, doneAt: T };
  if (td.date < T && UI.sel === T) patch.date = T; // überfällig heute erledigt → zählt für heute
  setTodo(td, patch);
  UI.popT = td.id;
  commit();
  buzz(12); sound("done");
  const day = todosOn(td.date);
  if (day.length >= 2 && day.every(t => t.done)) { toast(`✅ Alle Aufgaben für ${td.date === T ? "heute" : fmtShort(td.date)} erledigt!`); celebrate(); }
  else toast("Erledigt · +5 XP");
  if (level().L > L0) { toast(`⬆️ Level ${level().L} erreicht · ${level().title}`); celebrate(); }
}
function todoStats(ws) {
  let n = 0, d = 0;
  for (const t of todosAll()) if (t.date >= ws && t.date <= addD(ws, 6)) { n++; if (t.done) d++; }
  return { n, d };
}

/* =========================================================
   Ansicht: Statistik
   ========================================================= */
function weekHabitRows(ws) {
  const T = today(), rows = [];
  for (const h of habitsAll()) {
    if (isWeekly(h)) {
      const w = weekInfo(h, ws, T);
      if (!w.req && !w.cnt) continue;
      rows.push({ h, done: w.cnt, due: w.req || w.cnt, rate: w.req ? Math.min(1, w.cnt / w.req) : 1 });
      continue;
    }
    let due = 0, done = 0;
    for (let i = 0; i < 7; i++) {
      const k = addD(ws, i);
      if (k > T || !scheduledOn(h, k) || skippedOn(h, k)) continue;
      const d = doneOn(h, k);
      if (k === T && !d) continue;
      due++; if (d) done++;
    }
    if (due) rows.push({ h, done, due, rate: done / due });
  }
  return rows;
}
function heatmap() {
  const T = today(), a = aggregate(), W = 22, start = addD(wstart(T), -7 * (W - 1));
  let cells = "", prevM = "";
  const labs = [];
  for (let w = 0; w < W; w++) {
    const k0 = addD(start, w * 7);
    const m = addD(k0, 6).slice(5, 7);
    if (m !== prevM) { labs.push([w, MONS[+m - 1]]); prevM = m; }
    for (let d = 0; d < 7; d++) {
      const k = addD(k0, d);
      if (k > T) { cells += `<span class="c fu"></span>`; continue; }
      const x = a.days[k];
      let l = 0, tip, cls = "c";
      if (x?.pause) { cls += " pz"; tip = `${fmtShort(k)} · Pausetag`; }
      else if (!x || !x.due) tip = `${fmtShort(k)} · nichts fest geplant`;
      else { const p = x.done / x.due; l = p === 0 ? 0 : p < 0.34 ? 1 : p < 0.67 ? 2 : p < 1 ? 3 : 4; tip = `${fmtShort(k)} · <b>${x.done}/${x.due}</b> erledigt${p === 1 ? " 🌟" : ""}`; }
      cells += `<button class="${cls}" data-l="${l}" data-act="tip" data-tip="${esc(tip)}" data-tipfor="heatInfo" aria-label="${esc(tip.replace(/<[^>]+>/g, ""))}"></button>`;
    }
  }
  const months = labs.filter((l, i) => !labs[i + 1] || labs[i + 1][0] - l[0] >= 3).map(([w, t]) => `<span style="grid-column:${w + 1}/span 3">${t}</span>`).join("");
  return `<div class="heat">
      <div class="ms" style="grid-template-columns:repeat(${W},1fr)">${months}</div>
      <div class="wd"><span>Mo</span><span></span><span>Mi</span><span></span><span>Fr</span><span></span><span>So</span></div>
      <div class="grid" style="grid-template-columns:repeat(${W},1fr)">${cells}</div>
    </div>
    <div class="between"><p class="infoline" id="heatInfo">Tippe auf einen Tag für Details.</p>
    <span class="legend">weniger <i style="background:var(--track)"></i><i style="background:color-mix(in srgb,var(--accent) 28%,var(--track))"></i><i style="background:color-mix(in srgb,var(--accent) 52%,var(--track))"></i><i style="background:color-mix(in srgb,var(--accent) 76%,var(--track))"></i><i style="background:var(--accent)"></i> mehr</span></div>`;
}
function weekdayChart() {
  const T = today(), a = aggregate(), sums = Array.from({ length: 7 }, () => [0, 0]);
  for (let i = 1; i <= 84; i++) {
    const k = addD(T, -i), x = a.days[k];
    if (!x || !x.due) continue;
    sums[dow(k) - 1][0] += x.done; sums[dow(k) - 1][1] += x.due;
  }
  const rates = sums.map(([d, n]) => (n ? d / n : null));
  if (rates.every(r => r === null)) return `<p class="hint">Sobald ein paar Tage zusammenkommen, siehst du hier deine stärksten und schwächsten Wochentage.</p>`;
  const best = rates.indexOf(Math.max(...rates.filter(r => r !== null)));
  const cols = rates.map((r, i) => `<button class="col" data-act="tip" data-tip="${WDL[i]}: ${r === null ? "keine Daten" : `<b>${pct(r)}</b> erledigt`}" data-tipfor="wdInfo" aria-label="${WDL[i]}: ${r === null ? "keine Daten" : pct(r)}">
      ${r === null ? "" : `<span style="bottom:${(r * 100).toFixed(1)}%">${Math.round(r * 100)}</span><i style="height:${(r * 100).toFixed(1)}%"></i>`}</button>`).join("");
  return `<div class="cols">${cols}</div><div class="colx">${WD.map((w, i) => `<span class="${i === best ? "best" : ""}">${w}</span>`).join("")}</div>
    <p class="infoline" id="wdInfo">Stärkster Tag: <b>${WDL[best]}</b> · Werte in Prozent, letzte 12 Wochen</p>`;
}
function moodInsights() {
  const T = today();
  const md = Object.entries(S.days).filter(([k, d]) => d.m && k <= T);
  if (md.length < 5) return `<p class="hint">Gib auf „Heute“ ein paar Tage lang deine Stimmung an. Ab 5 Tagen zeigt dir die App hier, an welchen Tagen es dir besser geht.</p>`;
  const avg = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
  const recent = md.filter(([k]) => ddiff(k, T) < 30).map(([, d]) => d.m);
  const out = [];
  for (const h of habitsAll()) {
    const w = [], wo = [];
    for (const [k, d] of md) {
      if (!activeOn(h, k)) continue;
      if (doneOn(h, k)) w.push(d.m);
      else if ((scheduledOn(h, k) || isWeekly(h)) && !skippedOn(h, k)) wo.push(d.m);
    }
    if (w.length >= 3 && wo.length >= 3) out.push({ h, a: avg(w), b: avg(wo) });
  }
  out.sort((x, y) => (y.a - y.b) - (x.a - x.b));
  const good = out.filter(x => x.a - x.b >= 0.3).slice(0, 3);
  return `<p>Ø Stimmung der letzten 30 Tage: <b>${recent.length ? num(avg(recent)) : "–"}</b> von 5 ${recent.length ? MOODS[Math.round(avg(recent)) - 1][0] : ""}</p>
    ${good.length ? good.map(x => `<div class="insight"><span class="e">${esc(x.h.emoji)}</span><span>An Tagen mit <b>${esc(x.h.name)}</b>: Ø ${num(x.a)} statt ${num(x.b)}</span></div>`).join("")
      : `<p class="hint">Noch kein klarer Zusammenhang zwischen Gewohnheiten und Stimmung – dafür braucht es pro Gewohnheit je 3 Tage mit und ohne.</p>`}
    <p class="hint">Nur ein Zusammenhang, kein Beweis – aber oft ein guter Hinweis, was dir guttut.</p>`;
}
function vStats() {
  const T = today(), a = aggregate(), act = habitsActive();
  if (!habitsAll().length && !todosAll().length) return `<h1>Statistik</h1><div class="empty"><p>Lege zuerst eine Gewohnheit an.</p><button class="accentbtn" data-act="add">+ Gewohnheit anlegen</button></div>`;
  const cw = wstart(T), r = weekRate(cw), p = weekRate(addD(cw, -7));
  let dCls = "", dTxt = "noch keine Vorwoche";
  if (p.rate !== null) { dTxt = `Vorwoche ${pct(p.rate)}`; if (r.rate !== null) dCls = r.rate > p.rate ? "up" : r.rate < p.rate ? "down" : ""; }
  let bestH = null;
  for (const h of habitsAll()) if (!isWeekly(h) && (!bestH || hstats(h).best > hstats(bestH).best)) bestH = h;
  const reviewWs = dow(T) === 7 ? cw : addD(cw, -7);
  const rv = S.weeks[reviewWs];
  const past = Object.entries(S.weeks).filter(([, w]) => w.done).sort((x, y) => (x[0] < y[0] ? 1 : -1));
  return `<h1>Statistik</h1>
  <div class="tiles">
    <div class="tile"><span class="label">Diese Woche</span><span class="v">${r.rate === null ? "–" : pct(r.rate)}</span><span class="d ${dCls}">${dTxt}</span></div>
    <div class="tile"><span class="label">Perfekte Tage</span><span class="v">${a.perfectDays}</span><span class="d">${a.pCur > 1 ? `${a.pCur} in Folge` : `Rekord: ${a.pBest} in Folge`}</span></div>
    <div class="tile"><span class="label">Längste Serie</span><span class="v">${a.bestDays} Tage</span><span class="d">${bestH && a.bestDays ? esc(`${bestH.emoji} ${bestH.name}`) : "noch keine"}</span></div>
    <div class="tile"><span class="label">Erledigt</span><span class="v">${a.totalDone}</span><span class="d">${[a.todosDone ? `+ ${a.todosDone} Aufgaben` : "", a.minutes ? `${fmtMin(a.minutes)} Fokus` : ""].filter(Boolean).join(" · ") || (firstDay() ? `seit ${fmtDM(firstDay())}` : "")}</span></div>
  </div>
  <section class="panel">
    <div class="panel-head"><h2>Wochenrückblick</h2><span class="hint">KW ${isoWeek(reviewWs)}</span></div>
    <p>${rv?.done ? `✓ Ausgefüllt.${rv.focus && habitById(rv.focus) ? ` Fokus für die nächste Woche: <b>${esc(habitById(rv.focus).emoji + " " + habitById(rv.focus).name)}</b>` : ""}` : "Fünf Minuten Rückschau: Was lief gut, was bremst dich, worauf konzentrierst du dich nächste Woche? Bringt +50 XP."}</p>
    <div class="btnrow"><button class="${rv?.done ? "ghost" : "accentbtn"}" data-act="review" data-ws="${reviewWs}">${rv?.done ? "Ansehen / ändern" : "Rückblick ausfüllen"}</button></div>
    ${past.length ? `<details class="more"><summary>Frühere Rückblicke (${past.length})</summary><ul class="hl">${past.map(([ws, w]) => `<li><div class="hrow" style="grid-template-columns:minmax(0,1fr) auto"><span><b>KW ${isoWeek(ws)}</b> <span class="muted">${fmtDM(ws)}–${fmtDM(addD(ws, 6))}</span><br><span class="hint">${esc((w.good || w.change || "").slice(0, 90))}</span></span><button class="ghost" data-act="review" data-ws="${ws}">Öffnen</button></div></li>`).join("")}</ul></details>` : ""}
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Verlauf</h2><span class="hint">Anteil erledigter Gewohnheiten pro Tag</span></div>
    ${heatmap()}
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Stärke</h2></div>
    <p class="hint">Die Stärke steigt mit jedem Haken und sinkt bei Lücken nur langsam – ein verpasster Tag wirft dich nicht auf null. Ab etwa 80 % sitzt eine Gewohnheit.</p>
    <ul class="hl">${act.slice().sort((x, y) => hstats(y).strength - hstats(x).strength).map(h => {
      const st = hstats(h);
      return `<li><button data-act="detail" data-id="${h.id}" style="${colorVar(h)}"><span class="e">${esc(h.emoji)}</span>
        <span><span class="n">${esc(h.name)}</span><div class="sbar"><i style="width:${(st.strength * 100).toFixed(1)}%"></i></div></span>
        <span class="r"><b>${pct(st.strength)}</b>🔥 ${st.cur} · Rekord ${st.best}${st.unit === "Wochen" ? " Wo." : ""}</span></button></li>`;
    }).join("")}</ul>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Wochentage</h2><span class="hint">Quote fest geplanter Gewohnheiten</span></div>
    ${weekdayChart()}
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Stimmung</h2></div>
    ${moodInsights()}
  </section>`;
}

/* =========================================================
   Ansicht: Erfolge
   ========================================================= */
function vAwards() {
  const lv = level(), nt = nextTitle(lv.L);
  const items = ACH.map(x => ({ x, pr: achProgress(x), when: S.ach[x.id] }));
  items.sort((p, q) => (!!q.when - !!p.when) || (q.pr.c / q.pr.g - p.pr.c / p.pr.g));
  const got = items.filter(i => i.when).length;
  return `<h1>Erfolge</h1>
  <section class="panel">
    <div class="levelcard"><div class="big">${lv.L}</div><div style="display:grid;gap:6px">
      <span class="label">Level</span><h2>${lv.title}</h2>
      <div class="meter"><i style="width:${(lv.into / lv.need * 100).toFixed(1)}%"></i></div>
      <span class="hint">${lv.into} / ${lv.need} XP bis Level ${lv.L + 1} · ${lv.xp} XP gesamt${nt ? ` · ab Level ${nt[0]}: „${nt[1]}“` : ""}</span>
    </div></div>
  </section>
  <div class="between"><h2>Abzeichen</h2><span class="hint">${got} von ${ACH.length}</span></div>
  <div class="achs">${items.map(({ x, pr, when }) => `<div class="ach${when ? "" : " lock"}">
      <span class="e" aria-hidden="true">${x.e}</span><b>${x.n}</b><p>${x.d}</p>
      ${when ? `<span class="when">✓ ${fmtDM(when)}${x.xp ? ` · +${x.xp} XP` : ""}</span>` : `<div class="pm" aria-label="${pr.c} von ${pr.g}"><i style="width:${(pr.c / pr.g * 100).toFixed(1)}%"></i></div><span class="hint">${num(pr.c)} / ${num(pr.g)}${x.xp ? ` · +${x.xp} XP` : ""}</span>`}
    </div>`).join("")}</div>
  <section class="panel">
    <h3>So sammelst du XP</h3>
    <div class="xplist">
      <b>+10</b><span>je erledigter Gewohnheit</span>
      <b>+5/+10</b><span>Serienbonus ab 7 bzw. 30 Tagen</span>
      <b>+5</b><span>je erledigter Aufgabe</span>
      <b>+20</b><span>perfekter Tag</span>
      <b>+30</b><span>Wochenziel geschafft</span>
      <b>+1</b><span>je 10 Minuten Fokuszeit</span>
      <b>+50</b><span>Wochenrückblick</span>
      <b>+20…500</b><span>Abzeichen</span>
    </div>
  </section>`;
}

/* =========================================================
   Ansicht: Mehr (Gewohnheiten verwalten, Einstellungen, Sync, Daten)
   ========================================================= */
function syncPanel() {
  if (!CFG.url) return `<p class="hint">Nicht eingerichtet. Trage in <code>config.js</code> die Supabase-Daten ein, um zwischen Geräten zu synchronisieren.</p>`;
  if (SYNC.session) {
    return `<p>Angemeldet als <b>${esc(SYNC.session.user?.email || "")}</b></p>
      <p class="status ${SYNC.ok === true ? "ok" : SYNC.ok === false ? "err" : ""}" id="syncStatus">${esc(SYNC.msg || (SYNC.last ? `Zuletzt synchronisiert: ${new Date(SYNC.last).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""))}</p>
      <div class="btnrow"><button class="primary" data-act="syncNow">Jetzt synchronisieren</button><button class="ghost" data-act="logout">Abmelden</button></div>`;
  }
  return loginForm();
}
function loginForm() {
  return `<form id="fLogin" class="grid" style="display:grid;gap:10px">
      <p class="hint">Mit dem gleichen Konto wie im Sportduell. Deine Gewohnheiten werden dann zwischen Handy und Laptop abgeglichen und sind gesichert. Ohne Anmeldung bleibt alles nur auf diesem Gerät.</p>
      <label class="field"><span>E-Mail</span><input type="email" name="email" autocomplete="username" required></label>
      <label class="field"><span>Passwort</span><input type="password" name="pw" autocomplete="current-password" required></label>
      <button class="primary">Anmelden & synchronisieren</button>
      <p class="status ${SYNC.ok === false ? "err" : ""}" id="syncStatus">${esc(SYNC.msg || "")}</p>
    </form>`;
}
function vMore() {
  const act = habitsActive(), arch = habitsAll().filter(h => h.archived);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  return `<h1>Mehr</h1>
  <section class="panel">
    <div class="panel-head"><h2>Gewohnheiten</h2><button class="accentbtn" data-act="add">+ Neu</button></div>
    ${act.length ? `<ul class="mlist">${act.map((h, i) => `<li style="${colorVar(h)}">
      <span class="e">${esc(h.emoji)}</span>
      <button class="n" data-act="edit" data-id="${h.id}"><b>${esc(h.name)}</b><small>${schedLabel(h)} · ${SLOT_NAME[h.slot]}${h.type === "count" ? ` · ${h.target} ${esc(h.unit)}` : h.type === "timer" ? ` · ${h.target} min` : ""}</small></button>
      <span class="ord"><button data-act="move" data-id="${h.id}" data-d="-1" aria-label="${esc(h.name)} nach oben" ${i === 0 ? "disabled" : ""}>↑</button><button data-act="move" data-id="${h.id}" data-d="1" aria-label="${esc(h.name)} nach unten" ${i === act.length - 1 ? "disabled" : ""}>↓</button></span>
    </li>`).join("")}</ul>` : `<p class="hint">Noch keine aktiven Gewohnheiten.</p>`}
    ${arch.length ? `<details class="more"><summary>Archiv (${arch.length})</summary><ul class="mlist">${arch.map(h => `<li><span class="e">${esc(h.emoji)}</span><span class="n"><b>${esc(h.name)}</b><small>archiviert ${h.archivedAt ? fmtDM(h.archivedAt) : ""}</small></span><span class="ord"><button class="ghost" style="width:auto" data-act="restore" data-id="${h.id}">Zurückholen</button></span></li>`).join("")}</ul></details>` : ""}
  </section>
  <section class="panel">
    <h2>Einstellungen</h2>
    <label class="field"><span>Dein Name</span><input type="text" data-input="name" maxlength="30" value="${esc(S.settings.name)}" placeholder="für die Begrüßung"></label>
    <label class="field"><span>Neuer Tag beginnt um</span><select data-input="dayStart">${[0, 1, 2, 3, 4, 5].map(h => `<option value="${h}" ${S.settings.dayStart === h ? "selected" : ""}>${h}:00 Uhr${h === 0 ? " (Mitternacht)" : ""}</option>`).join("")}</select></label>
    <p class="hint">Was du nach Mitternacht, aber vor dieser Uhrzeit abhakst, zählt noch für den Vortag.</p>
    <label class="switch"><input type="checkbox" data-input="sound" ${S.settings.sound ? "checked" : ""}><span>Töne beim Abhaken <span class="hint">(der Timer piept immer)</span></span></label>
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Cloud-Sync</h2><span class="hint">optional</span></div>
    ${syncPanel()}
  </section>
  <section class="panel">
    <h2>Daten</h2>
    <p class="hint" id="persistInfo">Deine Daten liegen auf diesem Gerät.</p>
    <div class="btnrow">
      <button class="ghost" data-act="export">Backup exportieren</button>
      <label class="ghost" style="position:relative;cursor:pointer">Backup einlesen<input type="file" accept="application/json,.json" data-input="import" style="position:absolute;inset:0;opacity:0;width:100%;cursor:pointer"></label>
    </div>
    <button class="link danger" data-act="reset" style="justify-self:start">Alle Daten löschen</button>
  </section>
  ${standalone ? "" : `<section class="panel"><h2>Als App installieren</h2><p class="hint">iPhone: in Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>. Android/Chrome: Menü → <b>App installieren</b>. Danach startet Dranbleiben im Vollbild und funktioniert offline.</p></section>`}
  <p class="hint" style="text-align:center">Dranbleiben ${APP_VERSION}</p>`;
}
async function updatePersistInfo() {
  const el = $("#persistInfo");
  if (!el || !navigator.storage?.persisted) return;
  try {
    const p = await navigator.storage.persisted();
    el.textContent = p ? "Deine Daten liegen dauerhaft gespeichert auf diesem Gerät." : "Deine Daten liegen auf diesem Gerät. Ein gelegentliches Backup (oder der Cloud-Sync) schützt vor Verlust, z. B. bei einem Handywechsel.";
  } catch (e) { /* egal */ }
}

/* =========================================================
   Onboarding
   ========================================================= */
function tplMeta(t) {
  const h = normHabit(t);
  return schedLabel(h) + (t.type === "timer" ? ` · ${t.target} min` : t.type === "count" ? ` · ${t.target} ${t.unit}` : "");
}
function vOnboard() {
  return `<section class="hero"><img src="icons/icon-192.png" alt=""><h1>Dranbleiben</h1>
    <p class="muted">Dein persönlicher Habit Tracker: kleine Dinge, jeden Tag – und sehen, wie sie sich aufsummieren.</p></section>
  <ul class="feat">
    <li><span>✅</span><span>Abhaken, zählen oder mit dem Fokus-Timer Zeit sammeln</span></li>
    <li><span>🔥</span><span>Serien, Stärke und Level halten dich bei der Stange. Ein verpasster Tag wirft dich nicht auf null.</span></li>
    <li><span>📋</span><span>Aufgaben für einzelne Tage – Liegengebliebenes wandert als „überfällig“ mit</span></li>
    <li><span>📝</span><span>Wochenrückblick mit einer Fokus-Gewohnheit für die nächste Woche</span></li>
    <li><span>📴</span><span>Läuft offline, die Daten bleiben bei dir</span></li>
  </ul>
  <form id="fOnboard" class="panel">
    <label class="field"><span>Wie heißt du?</span><input type="text" name="name" maxlength="30" value="${esc(S.settings.name || "Niklas")}"></label>
    <div class="field"><span>Womit willst du starten? Tipp: lieber 2–4 Gewohnheiten als zehn.</span>
      <div class="pickgrid">${TEMPLATES.map((t, i) => `<label class="pick"><input type="checkbox" name="tpl" value="${i}"><span><em>${t.emoji}</em><span>${esc(t.name)}<small>${tplMeta(t)}</small></span></span></label>`).join("")}</div>
    </div>
    <button class="accentbtn">Los geht's</button>
    <p class="hint">Alles lässt sich später ändern. Eigene Gewohnheiten legst du unter „Mehr“ an.</p>
  </form>
  ${CFG.url ? `<details class="more panel"><summary>Ich nutze Dranbleiben schon auf einem anderen Gerät</summary>${loginForm()}</details>` : ""}`;
}

const VIEWS = { today: vToday, stats: vStats, awards: vAwards, more: vMore };

/* =========================================================
   Sheets (Detail, Bearbeiten, Wochenrückblick, Timer)
   ========================================================= */
function openSheet(type, arg) {
  UI.sheet = { type, arg };
  if (type === "detail") UI.detMonth = null;
  $("#sheet").hidden = false;
  document.body.style.overflow = "hidden";
  renderSheet(true);
}
function renderSheet(fresh) {
  const s = UI.sheet; if (!s) return;
  const out = SHEETS[s.type](s.arg);
  if (!out) { closeSheet(); return; }
  $("#sheetTitle").textContent = out.title;
  const body = $("#sheetBody"), st = fresh ? 0 : body.scrollTop;
  body.innerHTML = out.body;
  body.scrollTop = st;
  tick();
}
function closeSheet() {
  UI.sheet = null;
  $("#sheet").hidden = true;
  document.body.style.overflow = "";
  if (UI.pending) render();
}

function calGrid(h, m) {
  const T = today(), first = `${m}-01`, pad = dow(first) - 1;
  const n = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
  let html = WD.map(w => `<div class="h">${w}</div>`).join("") + "<div></div>".repeat(pad);
  for (let d = 1; d <= n; d++) {
    const k = `${m}-${pad2(d)}`, cls = [];
    let st = "";
    const done = doneOn(h, k), v = valOf(h, k), sch = scheduledOn(h, k), sk = skippedOn(h, k);
    if (k > T) cls.push("fut");
    if (done) { cls.push("done"); st = "erledigt"; }
    else if (sk && activeOn(h, k)) { cls.push("skp"); st = pausedOn(k) ? "Pausetag" : "übersprungen"; }
    else if (v > 0) { cls.push("part"); st = `${num(v)} ${unitOf(h)}`; }
    else if (sch && k < T) { cls.push("miss"); st = "verpasst"; }
    else if (sch) { cls.push("due"); st = "geplant"; }
    else if (!isWeekly(h) || !activeOn(h, k)) { cls.push("off"); st = "nicht geplant"; }
    else st = "offen";
    if (k === T) cls.push("tod");
    html += `<button class="${cls.join(" ")}" data-act="calTap" data-id="${h.id}" data-k="${k}" aria-label="${fmtLong(k)}: ${st}">${d}</button>`;
  }
  return html;
}
function valueChart(h) {
  const T = today(), ks = Array.from({ length: 30 }, (_, i) => addD(T, i - 29));
  const vals = ks.map(k => valOf(h, k)), t = tgt(h), u = unitOf(h);
  const max = Math.max(t * 1.2, ...vals, 1);
  const total = vals.reduce((s, x) => s + x, 0), active = vals.filter(x => x > 0).length;
  return `<div class="vbars" style="${colorVar(h)}">
      ${ks.map((k, i) => `<button class="b" data-act="tip" data-tip="${fmtShort(k)}: <b>${num(vals[i])} ${esc(u)}</b>${vals[i] >= t ? " ✓" : ""}" data-tipfor="vInfo" aria-label="${fmtShort(k)}: ${num(vals[i])} ${esc(u)}"><i style="height:${(vals[i] / max * 100).toFixed(1)}%"></i></button>`).join("")}
      <div class="goal" style="bottom:${(t / max * 100).toFixed(1)}%"><span>Ziel ${t}</span></div>
    </div>
    <div class="between hint"><span>${fmtDM(ks[0])}</span><span>heute</span></div>
    <p class="infoline" id="vInfo">30 Tage: <b>${num(total)} ${esc(u)}</b>${active ? ` · Ø ${num(total / active)} an aktiven Tagen` : ""}</p>`;
}
function sDetail(id) {
  const h = habitById(id);
  if (!h || h.deleted) return null;
  const st = hstats(h), T = today();
  const m = UI.detMonth || T.slice(0, 7);
  const minM = (h.start || T).slice(0, 7);
  const prevM = dk(new Date(+m.slice(0, 4), +m.slice(5, 7) - 2, 1)).slice(0, 7);
  const nextM = dk(new Date(+m.slice(0, 4), +m.slice(5, 7), 1)).slice(0, 7);
  const lowest = dk(new Date(+minM.slice(0, 4), +minM.slice(5, 7) - 13, 1)).slice(0, 7); // bis 12 Monate vor Start nachtragbar
  const skipT = (scheduledOn(h, T) || isWeekly(h)) && !doneOn(h, T);
  const u = st.unit === "Wochen" ? "Wochen" : "Tage";
  const body = `
    <p class="muted">${schedLabel(h)} · ${SLOT_NAME[h.slot]}${h.type !== "check" ? ` · Ziel ${h.target} ${esc(unitOf(h))} pro Tag` : ""}${h.start ? ` · seit ${fmtDM(h.start)}` : ""}</p>
    ${h.why ? `<p class="why" style="${colorVar(h)}">„${esc(h.why)}“</p>` : ""}
    <div class="tiles">
      <div class="tile"><span class="label">Serie</span><span class="v">🔥 ${st.cur}</span><span class="d">${u} in Folge</span></div>
      <div class="tile"><span class="label">Rekord</span><span class="v">${st.best}</span><span class="d">${u}</span></div>
      <div class="tile"><span class="label">Stärke</span><span class="v">${pct(st.strength)}</span><span class="d">${st.strength >= 0.8 ? "sitzt" : st.strength >= 0.5 ? "wird stabil" : "im Aufbau"}</span></div>
      <div class="tile"><span class="label">Erledigt</span><span class="v">${st.total}×</span><span class="d">${h.type === "timer" ? fmtMin(st.minutes) : "insgesamt"}</span></div>
    </div>
    <section class="panel" style="${colorVar(h)}">
      <div class="between"><button class="iconbtn" data-act="detMonth" data-m="${prevM}" aria-label="Vormonat" ${prevM < lowest ? "disabled" : ""}>‹</button>
        <h3>${MON[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</h3>
        <button class="iconbtn" data-act="detMonth" data-m="${nextM}" aria-label="Nächster Monat" ${nextM > T.slice(0, 7) ? "disabled" : ""}>›</button></div>
      <div class="cal">${calGrid(h, m)}</div>
      <div class="callegend"><span><i style="background:var(--h);border-color:var(--h)"></i>erledigt</span>${h.type !== "check" ? `<span><i style="background:color-mix(in srgb,var(--h) 30%,var(--surface))"></i>teilweise</span>` : ""}<span><i style="background:repeating-linear-gradient(45deg,var(--track) 0 3px,var(--line) 3px 4px)"></i>übersprungen</span>${isWeekly(h) ? "" : `<span><i style="background:radial-gradient(circle at 50% 76%,var(--warn) 0 1.8px,transparent 2.2px)"></i>verpasst</span>`}</div>
      <p class="hint">${h.type === "check" ? "Tippe auf einen Tag zum Nachtragen: erledigt → übersprungen → offen." : "Tippe auf einen Tag, um den Wert nachzutragen."}</p>
    </section>
    <section class="panel"><h3>Quote</h3><div class="rates">${st.rates.map(([l, d, n]) => `<div><b>${n ? pct(d / n) : "–"}</b><small>${l}</small></div>`).join("")}</div>
      <p class="hint">${isWeekly(h) ? "Anteil der Wochen, in denen du dein Wochenziel geschafft hast." : "Anteil der geplanten Tage, an denen du es geschafft hast (übersprungene Tage zählen nicht)."}</p></section>
    ${h.type !== "check" ? `<section class="panel"><h3>Letzte 30 Tage</h3>${valueChart(h)}</section>` : ""}
    <div class="btnrow">
      <button class="primary" data-act="edit" data-id="${h.id}">Bearbeiten</button>
      ${skipT ? `<button class="ghost" data-act="skipToday" data-id="${h.id}">${entryOf(h, T)?.s ? "Überspringen aufheben" : "Heute überspringen"}</button>` : ""}
      ${h.type === "timer" ? `<button class="ghost" data-act="timer" data-id="${h.id}" data-k="${T}">⏱️ Timer</button>` : ""}
    </div>
    <div class="btnrow"><button class="link" data-act="archive" data-id="${h.id}">Archivieren</button><button class="link danger" data-act="delete" data-id="${h.id}">Löschen</button></div>`;
  return { title: `${h.emoji} ${h.name}`, body };
}

function sEdit(id) {
  const h = id ? habitById(id) : null;
  const used = habitsActive().map(x => x.color);
  const d = h || { name: "", emoji: "✅", color: COLORS.find(c => !used.includes(c)) || COLORS[habitsActive().length % COLORS.length], type: "check", target: 1, unit: "", sched: { k: "daily", days: [1, 2, 3, 4, 5], n: 3 }, slot: "any", why: "" };
  const radio = (name, val, label, cur) => `<label><input type="radio" name="${name}" value="${val}" ${cur === val ? "checked" : ""}><span>${label}</span></label>`;
  const body = `<form id="fEdit" data-id="${h ? h.id : ""}" style="display:grid;gap:16px" novalidate>
    ${h ? "" : `<div class="field"><span>Vorlagen</span><div class="tpls">${TEMPLATES.map((t, i) => `<button type="button" data-act="tpl" data-i="${i}">${t.emoji} ${esc(t.name)}</button>`).join("")}</div></div>`}
    <label class="field"><span>Name</span><input type="text" name="name" maxlength="40" required value="${esc(d.name)}" placeholder="z. B. Laufen"></label>
    <div class="field"><span>Symbol</span>
      <div class="row"><input type="text" name="emoji" maxlength="8" value="${esc(d.emoji)}" style="width:64px;text-align:center;font-size:1.4rem;padding:4px" aria-label="Symbol (eigenes Emoji möglich)"><span class="hint">eigenes Emoji eintippen oder unten wählen</span></div>
      <div class="emojis">${EMOJIS.map(e => `<button type="button" data-act="emo" data-e="${e}" aria-pressed="${e === d.emoji}">${e}</button>`).join("")}</div></div>
    <div class="field"><span>Farbe</span><div class="swatches">${COLORS.map(c => `<label title="${COLOR_NAMES[c]}"><input type="radio" name="color" value="${c}" ${d.color === c ? "checked" : ""} aria-label="${COLOR_NAMES[c]}"><span style="--sw:var(--c-${c})"></span></label>`).join("")}</div></div>
    <div class="field"><span>Art</span><div class="seg">${radio("type", "check", "Abhaken", d.type)}${radio("type", "count", "Zählen", d.type)}${radio("type", "timer", "Fokuszeit", d.type)}</div>
      <span class="hint" data-show="check">Einmal am Tag erledigt oder nicht.</span>
      <span class="hint" data-show="count">Mit + hochzählen, z. B. Gläser Wasser oder Seiten.</span>
      <span class="hint" data-show="timer">Minuten sammeln – mit eingebautem Fokus-Timer.</span></div>
    <div class="two" data-show="count timer">
      <label class="field"><span>Tagesziel</span><input type="number" name="target" min="1" max="100000" inputmode="numeric" value="${d.type === "check" ? "" : d.target}"></label>
      <label class="field" data-show="count"><span>Einheit</span><input type="text" name="unit" maxlength="16" value="${esc(d.unit)}" placeholder="z. B. Seiten"></label>
      <label class="field" data-show="timer"><span>Einheit</span><input type="text" value="Minuten" disabled></label>
    </div>
    <div class="field"><span>Rhythmus</span><div class="seg">${radio("sk", "daily", "Täglich", d.sched.k)}${radio("sk", "days", "Wochentage", d.sched.k)}${radio("sk", "week", "x-mal/Woche", d.sched.k)}</div></div>
    <div class="wdpick" data-show-s="days" role="group" aria-label="Wochentage">${WD.map((w, i) => `<label><input type="checkbox" name="days" value="${i + 1}" ${d.sched.days.includes(i + 1) ? "checked" : ""}><span>${w}</span></label>`).join("")}</div>
    <label class="field" data-show-s="week"><span>Wie oft pro Woche?</span><select name="n">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${d.sched.n === n ? "selected" : ""}>${n}× pro Woche – Tage frei wählbar</option>`).join("")}</select></label>
    <label class="field"><span>Tageszeit</span><select name="slot">${SLOTS.map(([v, l]) => `<option value="${v}" ${d.slot === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="field"><span>Warum ist dir das wichtig? <span class="hint">(optional – wird dir in der Detailansicht gezeigt)</span></span><textarea name="why" rows="2" maxlength="200" placeholder="z. B. Ich will im Frühjahr einen Halbmarathon laufen">${esc(d.why)}</textarea></label>
    <p class="status err" id="editErr" role="alert"></p>
    <div class="btnrow"><button class="accentbtn" type="submit">${h ? "Speichern" : "Anlegen"}</button><button class="ghost" type="button" data-act="${h ? "detailBack" : "closeSheet"}" data-id="${h ? h.id : ""}">Abbrechen</button></div>
  </form>`;
  return { title: h ? "Bearbeiten" : "Neue Gewohnheit", body };
}
function syncEditor(form) {
  const type = form.type.value, sk = form.sk.value;
  for (const el of $$("[data-show]", form)) el.hidden = !el.dataset.show.split(" ").includes(type);
  for (const el of $$("[data-show-s]", form)) el.hidden = el.dataset.showS !== sk;
}
function fillTemplate(form, t) {
  form.name.value = t.name; form.emoji.value = t.emoji;
  form.querySelector(`[name=color][value=${t.color}]`).checked = true;
  form.querySelector(`[name=type][value=${t.type}]`).checked = true;
  form.target.value = t.type === "check" ? "" : t.target;
  form.unit.value = t.unit && t.type === "count" ? t.unit : "";
  form.querySelector(`[name=sk][value=${t.sched.k}]`).checked = true;
  const days = t.sched.days || [1, 2, 3, 4, 5];
  for (const c of $$("[name=days]", form)) c.checked = days.includes(+c.value);
  form.n.value = t.sched.n || 3;
  form.slot.value = t.slot || "any";
  form.why.value = t.why || "";
  for (const b of $$("[data-act=emo]", form)) b.setAttribute("aria-pressed", b.dataset.e === t.emoji);
  syncEditor(form);
}
function saveEditor(form) {
  const err = $("#editErr");
  const name = form.name.value.trim();
  if (!name) { err.textContent = "Bitte einen Namen eingeben."; form.name.focus(); return; }
  const type = form.type.value, sk = form.sk.value;
  const days = $$("[name=days]:checked", form).map(c => +c.value);
  if (sk === "days" && !days.length) { err.textContent = "Bitte mindestens einen Wochentag wählen."; return; }
  let target = 1;
  if (type !== "check") {
    target = Math.round(+form.target.value);
    if (!(target >= 1)) { err.textContent = "Bitte ein Tagesziel von mindestens 1 eintragen."; form.target.focus(); return; }
  }
  const data = {
    name, emoji: [...(form.emoji.value.trim() || "✅")].slice(0, 2).join("") || "✅", color: form.color.value, type, target,
    unit: type === "count" ? form.unit.value.trim() : type === "timer" ? "min" : "",
    sched: { k: sk, days: days.length ? days : [1, 2, 3, 4, 5], n: +form.n.value || 3 }, slot: form.slot.value, why: form.why.value.trim(),
  };
  const id = form.dataset.id;
  if (id) {
    const h = habitById(id);
    Object.assign(h, data, { t: Date.now() });
    commit();
    openSheet("detail", id);
    toast("Gespeichert");
  } else {
    const order = Math.max(-1, ...habitsAll().map(x => x.order)) + 1;
    S.habits.push(normHabit({ ...data, id: uid(), start: today(), order, t: Date.now() }));
    S.settings.onboarded = true; S.settings.t = Date.now();
    commit();
    closeSheet();
    toast(`${data.emoji} ${name} angelegt`);
    navigator.storage?.persist?.().catch(() => {});
  }
}

function sReview(ws) {
  const we = addD(ws, 6), rows = weekHabitRows(ws), r = weekRate(ws), p = weekRate(addD(ws, -7));
  const rec = S.weeks[ws] || {};
  let perf = 0; for (let i = 0; i < 7; i++) if (dayInfo(addD(ws, i)).perfect) perf++;
  const sorted = rows.slice().sort((a, b) => b.rate - a.rate || hstats(b.h).cur - hstats(a.h).cur);
  const best = sorted[0], worst = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  const act = habitsActive();
  const nextFocus = rec.focus || (worst && worst.rate < 1 && !worst.h.archived ? worst.h.id : "");
  const body = `
    <p class="muted">${fmtLong(ws)} – ${fmtLong(we)}</p>
    <div class="tiles">
      <div class="tile"><span class="label">Quote</span><span class="v">${r.rate === null ? "–" : pct(r.rate)}</span><span class="d">${p.rate === null ? "keine Vorwoche" : `Vorwoche ${pct(p.rate)}`}</span></div>
      <div class="tile"><span class="label">Perfekte Tage</span><span class="v">${perf}</span><span class="d">von 7</span></div>
    </div>
    ${(() => { const ts = todoStats(ws); return ts.n ? `<p>📋 Aufgaben: <b>${ts.d} von ${ts.n}</b> erledigt</p>` : ""; })()}
    ${rows.length ? `<section class="panel"><ul class="hl">${sorted.map(x => `<li><div class="hrow" style="${colorVar(x.h)}"><span class="e">${esc(x.h.emoji)}</span><span><span class="n">${esc(x.h.name)}</span><div class="sbar"><i style="width:${(x.rate * 100).toFixed(1)}%"></i></div></span><span class="r"><b>${x.done}/${x.due}</b>${isWeekly(x.h) ? "Wochenziel" : "Tage"}</span></div></li>`).join("")}</ul>
      ${best ? `<p>💪 Am stärksten: <b>${esc(best.h.name)}</b>${worst && worst.rate < best.rate ? ` · Ausbaufähig: <b>${esc(worst.h.name)}</b>` : ""}</p>` : ""}</section>` : `<p class="hint">In dieser Woche war nichts geplant.</p>`}
    <form id="fReview" data-ws="${ws}" style="display:grid;gap:14px">
      <label class="field"><span>Was lief gut?</span><textarea name="good" rows="2" maxlength="1000">${esc(rec.good || "")}</textarea></label>
      <label class="field"><span>Was hat dich ausgebremst?</span><textarea name="block" rows="2" maxlength="1000">${esc(rec.block || "")}</textarea></label>
      <label class="field"><span>Was machst du nächste Woche anders?</span><textarea name="change" rows="2" maxlength="1000" placeholder="z. B. Laufschuhe abends schon rauslegen">${esc(rec.change || "")}</textarea></label>
      <label class="field"><span>Fokus-Gewohnheit für nächste Woche</span><select name="focus"><option value="">– keine –</option>${act.map(h => `<option value="${h.id}" ${nextFocus === h.id ? "selected" : ""}>${esc(h.emoji + " " + h.name)}</option>`).join("")}</select></label>
      <p class="hint">Die Fokus-Gewohnheit wird nächste Woche auf „Heute“ markiert und nach oben sortiert.</p>
      <button class="accentbtn">${rec.done ? "Aktualisieren" : "Rückblick speichern · +50 XP"}</button>
    </form>`;
  return { title: `Rückblick KW ${isoWeek(ws)}`, body };
}

/* ---------- Fokus-Timer ---------- */
let TM = null;
function loadTimer() { try { return JSON.parse(localStorage.getItem(TKEY)) || null; } catch (e) { return null; } }
function saveTimer() { TM ? localStorage.setItem(TKEY, JSON.stringify(TM)) : localStorage.removeItem(TKEY); }
const tmElapsed = () => (TM ? TM.acc + (TM.start ? Date.now() - TM.start : 0) : 0);
const tmRemain = () => (TM ? TM.dur * 1000 - tmElapsed() : 0);
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`; };
function defaultMin(h) { const rest = tgt(h) - valOf(h, today()); return rest > 0 ? clamp(rest, 5, 180) : 25; }
function sTimer(id) {
  const h = habitById(TM ? TM.hid : id);
  if (!h) return null;
  const T = today(), C = 2 * Math.PI * 100;
  const sel = TM ? Math.round(TM.dur / 60) : (UI.tmMin || defaultMin(h));
  const presets = [...new Set([defaultMin(h), 15, 25, 45, 60, 90])].sort((a, b) => a - b);
  let ctl;
  if (!TM) ctl = `<div class="presets" role="group" aria-label="Dauer">${presets.map(m => `<button data-act="tmPreset" data-m="${m}" aria-pressed="${m === sel}">${m} min</button>`).join("")}</div>
      <button class="accentbtn" data-act="tmStart" data-id="${h.id}" style="min-width:200px">Fokus starten</button>
      <button class="link" data-act="tmManual" data-id="${h.id}">Vergessen zu starten? Zeit nachtragen</button>`;
  else ctl = `<div class="btnrow" style="justify-content:center">${TM.start ? `<button class="primary" data-act="tmPause">Pause</button>` : `<button class="accentbtn" data-act="tmResume">Weiter</button>`}
      <button class="ghost" data-act="tmStop">Beenden & speichern</button></div><button class="link danger" data-act="tmCancel">Abbrechen ohne Speichern</button>`;
  const body = `<div class="timer" style="${colorVar(h)}">
      <p class="muted">Heute: ${num(valOf(h, TM ? TM.k : T))} / ${tgt(h)} min</p>
      <div class="clock"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="tr" cx="110" cy="110" r="100" fill="none" stroke-width="10"/><circle class="pr" data-tm="ring" cx="110" cy="110" r="100" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>
        <div class="t"><b data-tm="time">${mmss(sel * 60000)}</b><span data-tm="state">${TM ? (TM.start ? "läuft" : "pausiert") : "bereit"}</span></div></div>
      ${ctl}
      <p class="hint" style="max-width:34ch">Handy weg, Benachrichtigungen aus. Die Zeit läuft weiter, auch wenn du die App verlässt – beim Zurückkommen wird sie gutgeschrieben.</p>
    </div>`;
  return { title: `⏱️ ${h.name}`, body };
}
function openTimer(h, k) {
  if (k && k !== today()) { valueDialog(h, k); return; }
  if (TM && TM.hid !== h.id) toast("Es läuft schon ein Timer");
  UI.tmMin = null;
  openSheet("timer", TM ? TM.hid : h.id);
}
function tmStart(h) {
  audioInit();
  TM = { hid: h.id, k: today(), dur: (UI.tmMin || defaultMin(h)) * 60, acc: 0, start: Date.now() };
  saveTimer(); wakeLock(); renderSheet(); render();
}
function tmFinish(save, auto) {
  if (!TM) return;
  const mins = auto ? Math.round(TM.dur / 60) : Math.floor(tmElapsed() / 60000);
  const h = habitById(TM.hid), k = TM.k;
  TM = null; saveTimer(); releaseWake();
  if (auto) { sound("timer", true); buzz([200, 100, 200]); }
  if (save && h && mins > 0) {
    withFeedback(h, k, () => setEntry(h, k, { v: valOf(h, k) + mins, s: 0 }));
    toast(`⏱️ ${mins} min ${h.name} gutgeschrieben`);
  } else { if (save && mins <= 0) toast("Unter einer Minute – nichts gespeichert"); refresh(); }
  if (UI.sheet?.type === "timer") closeSheet();
}
function tick() {
  if (!TM) return;
  if (TM.start && tmRemain() <= 0) { tmFinish(true, true); return; }
  const rem = tmRemain(), C = 2 * Math.PI * 100;
  for (const el of $$("[data-tm=time]")) el.textContent = mmss(rem);
  for (const el of $$("[data-tm=pill]")) el.textContent = mmss(rem);
  for (const el of $$("[data-tm=ring]")) el.setAttribute("stroke-dashoffset", (C * (1 - tmElapsed() / (TM.dur * 1000))).toFixed(1));
}
let WL = null;
async function wakeLock() { try { WL = await navigator.wakeLock?.request("screen"); } catch (e) { WL = null; } }
function releaseWake() { try { WL?.release(); } catch (e) { /* egal */ } WL = null; }

const SHEETS = {
  detail: Object.assign(sDetail, { live: true }),
  edit: sEdit,
  review: sReview,
  timer: Object.assign(sTimer, { live: true }),
};

/* =========================================================
   Kleiner Dialog (Werte eintragen, Rückfragen)
   ========================================================= */
let DLG = null;
function dialog(html, opts = {}) {
  $("#dlgBox").innerHTML = html;
  $("#dlg").hidden = false;
  DLG = opts;
  setTimeout(() => { const f = $("#dlgBox input:not([type=checkbox]), #dlgBox [data-act=dlgYes]"); f?.focus(); if (f?.select) f.select(); }, 30);
}
function closeDlg(result) { const d = DLG; DLG = null; $("#dlg").hidden = true; d?.res?.(result); }
function confirmDlg(text, ok = "OK", danger = false) {
  return new Promise(res => dialog(`<p>${text}</p><div class="btnrow" style="justify-content:flex-end"><button class="ghost" data-act="dlgNo">Abbrechen</button><button class="primary" data-act="dlgYes" ${danger ? 'style="background:var(--warn);color:#fff"' : ""}>${ok}</button></div>`, { res }));
}
function valueDialog(h, k) {
  const v = valOf(h, k), t = tgt(h), u = unitOf(h), e = entryOf(h, k);
  const steps = h.type === "timer" ? [15, 30, 60] : [1, 5, 10];
  dialog(`<form id="fValue" data-id="${h.id}" data-k="${k}" style="display:grid;gap:12px">
      <h3>${esc(h.emoji)} ${esc(h.name)}</h3><p class="hint">${fmtLong(k)} · Ziel ${t} ${esc(u)}</p>
      <label class="field"><span>${h.type === "timer" ? "Minuten an diesem Tag (gesamt)" : `Wert (${esc(u || "Anzahl")})`}</span><input type="number" name="v" min="0" step="any" inputmode="decimal" value="${v}"></label>
      <div class="quick">${steps.map(s => `<button type="button" data-act="qAdd" data-d="${s}">+${s}</button>`).join("")}<button type="button" data-act="qSet" data-v="${t}">Ziel (${t})</button><button type="button" data-act="qSet" data-v="0">0</button></div>
      <label class="switch"><input type="checkbox" name="s" ${e?.s ? "checked" : ""}><span>Übersprungen <span class="hint">(zählt nicht als verpasst)</span></span></label>
      <div class="btnrow" style="justify-content:flex-end"><button type="button" class="ghost" data-act="dlgNo">Abbrechen</button><button class="primary">Speichern</button></div>
    </form>`);
}

/* =========================================================
   Aktionen (Event-Delegation)
   ========================================================= */
const ACT = {
  tab: el => { UI.tab = el.dataset.tab; if (UI.tab === "today") UI.sel = today(); window.scrollTo(0, 0); render(); },
  selDay: el => { UI.sel = el.dataset.k; render(); },
  toggle: el => { const h = habitById(el.dataset.id), k = el.dataset.k; withFeedback(h, k, () => setEntry(h, k, doneOn(h, k) ? { v: 0 } : { v: 1, s: 0 })); },
  inc: el => { const h = habitById(el.dataset.id), k = el.dataset.k; withFeedback(h, k, () => setEntry(h, k, { v: valOf(h, k) + 1, s: 0 })); },
  dec: el => { const h = habitById(el.dataset.id), k = el.dataset.k; setEntry(h, k, { v: Math.max(0, valOf(h, k) - 1) }); commit(); },
  value: el => valueDialog(habitById(el.dataset.id), el.dataset.k),
  timer: el => openTimer(habitById(el.dataset.id), el.dataset.k),
  openTimer: () => TM && openSheet("timer", TM.hid),
  detail: el => openSheet("detail", el.dataset.id),
  detailBack: el => openSheet("detail", el.dataset.id),
  add: () => openSheet("edit", null),
  edit: el => openSheet("edit", el.dataset.id),
  review: el => openSheet("review", el.dataset.ws),
  closeSheet: () => closeSheet(),
  mood: el => {
    const k = el.dataset.k, m = +el.dataset.m, d = (S.days[k] ||= {});
    d.m = d.m === m ? 0 : m; d.t = Date.now();
    commit();
  },
  detMonth: el => { UI.detMonth = el.dataset.m; renderSheet(); },
  calTap: el => {
    const h = habitById(el.dataset.id), k = el.dataset.k;
    if (k > today()) return;
    if (h.type !== "check") { valueDialog(h, k); return; }
    const canSkip = scheduledOn(h, k) || (isWeekly(h) && activeOn(h, k));
    const e = entryOf(h, k);
    if (doneOn(h, k)) { setEntry(h, k, canSkip ? { v: 0, s: 1 } : { v: 0, s: 0 }); commit(); }
    else if (e?.s) { setEntry(h, k, { v: 0, s: 0 }); commit(); }
    else withFeedback(h, k, () => setEntry(h, k, { v: 1, s: 0 }));
  },
  skipToday: el => { const h = habitById(el.dataset.id), k = today(); setEntry(h, k, { s: entryOf(h, k)?.s ? 0 : 1 }); commit(); toast(entryOf(h, k).s ? "Für heute übersprungen – deine Serie bleibt" : "Überspringen aufgehoben"); },
  archive: async el => {
    const h = habitById(el.dataset.id);
    if (!(await confirmDlg(`<b>${esc(h.name)}</b> archivieren? Der Verlauf bleibt erhalten, unter „Mehr“ kannst du sie zurückholen.`, "Archivieren"))) return;
    h.archived = true; h.archivedAt = today(); h.t = Date.now();
    closeSheet(); commit(); toast("Archiviert");
  },
  restore: el => {
    const h = habitById(el.dataset.id), T = today();
    if (h.archivedAt && h.archivedAt < T) h.gaps.push([h.archivedAt, addD(T, -1)]);
    h.archived = false; h.archivedAt = null; h.t = Date.now();
    h.order = Math.max(-1, ...habitsActive().map(x => x.order)) + 1;
    commit(); toast(`${h.emoji} ${h.name} ist zurück`);
  },
  delete: async el => {
    const h = habitById(el.dataset.id);
    if (!(await confirmDlg(`<b>${esc(h.name)}</b> mitsamt Verlauf löschen?`, "Löschen", true))) return;
    h.deleted = true; h.t = Date.now();
    closeSheet(); commit();
    toast("Gelöscht", { undo: () => { h.deleted = false; h.t = Date.now(); commit(); } });
  },
  move: el => {
    const list = habitsActive(), i = list.findIndex(h => h.id === el.dataset.id), j = i + +el.dataset.d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    list.forEach((h, n) => { if (h.order !== n) { h.order = n; h.t = Date.now(); } });
    commit();
  },
  todoToggle: el => todoToggle(S.todos[el.dataset.id]),
  todoEdit: el => todoDialog(S.todos[el.dataset.id]),
  todoToday: el => { setTodo(S.todos[el.dataset.id], { date: today() }); commit(); toast("Auf heute verschoben"); },
  tdDate: el => {
    const T = today(), d = el.dataset.d;
    $("#fTodoEdit").date.value = d === "mon" ? addD(wstart(T), 7) : addD(T, +d);
  },
  todoDel: el => {
    const td = S.todos[el.dataset.id];
    closeDlg(); setTodo(td, { deleted: true }); commit();
    toast("Aufgabe gelöscht", { undo: () => { setTodo(td, { deleted: false }); commit(); } });
  },
  tpl: el => fillTemplate($("#fEdit"), TEMPLATES[+el.dataset.i]),
  emo: el => { const f = $("#fEdit"); f.emoji.value = el.dataset.e; for (const b of $$("[data-act=emo]", f)) b.setAttribute("aria-pressed", b === el); },
  tip: el => {
    const t = document.getElementById(el.dataset.tipfor); if (t) t.innerHTML = el.dataset.tip;
    for (const s of $$(".sel", el.parentElement)) s.classList.remove("sel");
    el.classList.add("sel");
  },
  tmManual: el => { closeSheet(); valueDialog(habitById(el.dataset.id), today()); },
  tmPreset: el => { UI.tmMin = +el.dataset.m; renderSheet(); },
  tmStart: el => tmStart(habitById(el.dataset.id)),
  tmPause: () => { TM.acc = tmElapsed(); TM.start = 0; saveTimer(); releaseWake(); renderSheet(); render(); },
  tmResume: () => { TM.start = Date.now(); saveTimer(); wakeLock(); renderSheet(); render(); },
  tmStop: () => tmFinish(true, false),
  tmCancel: async () => { if (await confirmDlg("Timer abbrechen? Die bisherige Zeit wird nicht gespeichert.", "Abbrechen", true)) tmFinish(false, false); },
  qAdd: el => { const i = $("#fValue").v; i.value = (+String(i.value).replace(",", ".") || 0) + +el.dataset.d; },
  qSet: el => { $("#fValue").v.value = el.dataset.v; },
  dlgYes: () => closeDlg(true),
  dlgNo: () => closeDlg(false),
  syncNow: () => syncNow(true),
  logout: async () => { try { const c = await sbClient(); await c.auth.signOut(); } catch (e) { /* egal */ } SYNC.session = null; setSync(null, ""); render(); },
  export: () => exportData(),
  reset: async () => {
    const cloud = !!SYNC.session;
    if (!(await confirmDlg(`Wirklich <b>alle</b> Gewohnheiten, Einträge und Erfolge löschen?${cloud ? " Auch die Daten in der Cloud werden geleert." : ""} Das lässt sich nicht rückgängig machen.`, "Alles löschen", true))) return;
    S = blankState(); TM = null; saveTimer(); UI.tab = "today";
    commit({ sync: false, quiet: true });
    if (cloud) pushRemote(true);
    toast("Alles gelöscht");
  },
};

const INPUT = {
  note: el => { const d = (S.days[el.dataset.k] ||= {}); d.n = el.value; d.t = Date.now(); persistSoon(); },
};
const CHANGE = {
  todoDate: el => { const k = el.value || today(), i = $("#todoInput"); if (i) i.placeholder = `Neue Aufgabe für ${k === today() ? "heute" : fmtShort(k)} …`; },
  pickDate: el => { if (el.value && el.value <= today()) { UI.sel = el.value; render(); } },
  pause: el => {
    const d = (S.days[el.dataset.k] ||= {});
    d.pause = el.checked; d.t = Date.now(); commit();
    toast(el.checked ? "Pausetag – heute zählt nichts als verpasst" : "Pausetag aufgehoben");
  },
  name: el => { S.settings.name = el.value.trim().slice(0, 30); S.settings.t = Date.now(); commit({ render: false }); toast("Gespeichert"); },
  dayStart: el => { S.settings.dayStart = +el.value; S.settings.t = Date.now(); UI.sel = today(); commit(); },
  sound: el => { S.settings.sound = el.checked; S.settings.t = Date.now(); if (el.checked) { audioInit(); sound("done"); } commit({ render: false }); },
  import: el => { const f = el.files?.[0]; el.value = ""; if (f) importData(f); },
};
const SUBMIT = {
  fTodo: f => {
    const title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    const date = f.date.value || f.dataset.k;
    addTodo(title, date, false);
    commit({ render: false });
    render(true);
    $("#todoInput")?.focus({ preventScroll: true });
    if (date !== f.dataset.k) toast(`Für ${date === today() ? "heute" : fmtShort(date)} geplant`);
  },
  fTodoEdit: f => {
    const td = S.todos[f.dataset.id], title = f.title.value.trim();
    if (!title) { f.title.focus(); return; }
    setTodo(td, { title: title.slice(0, 120), date: f.date.value || td.date, imp: f.imp.checked });
    closeDlg(); commit();
  },
  fEdit: f => saveEditor(f),
  fValue: f => {
    const h = habitById(f.dataset.id), k = f.dataset.k;
    const v = Math.max(0, +String(f.v.value).replace(",", ".") || 0), s = f.s.checked ? 1 : 0;
    closeDlg();
    withFeedback(h, k, () => setEntry(h, k, { v, s }));
  },
  fReview: f => {
    const ws = f.dataset.ws, was = !!S.weeks[ws]?.done;
    S.weeks[ws] = { good: f.good.value.trim(), block: f.block.value.trim(), change: f.change.value.trim(), focus: f.focus.value, done: true, t: Date.now() };
    const L0 = level().L;
    closeSheet(); commit();
    toast(was ? "Rückblick aktualisiert" : "📝 Rückblick gespeichert · +50 XP");
    if (!was) celebrate();
    if (level().L > L0) toast(`⬆️ Level ${level().L} erreicht · ${level().title}`);
  },
  fOnboard: f => {
    const picks = $$("[name=tpl]:checked", f).map(c => TEMPLATES[+c.value]);
    S.settings.name = f.name.value.trim().slice(0, 30); S.settings.onboarded = true; S.settings.t = Date.now();
    picks.forEach((t, i) => S.habits.push(normHabit({ ...t, id: uid(), start: today(), order: i, t: Date.now() })));
    UI.tab = "today"; UI.sel = today();
    commit({ quiet: true });
    navigator.storage?.persist?.().catch(() => {});
    if (!picks.length) openSheet("edit", null);
    else toast(`${picks.length} Gewohnheit${picks.length > 1 ? "en" : ""} angelegt – los geht's!`);
  },
  fLogin: f => doLogin(f),
};

document.addEventListener("click", e => {
  if (e.target.matches?.("input[type=date]")) { try { e.target.showPicker?.(); } catch (err) { /* iOS öffnet selbst */ } }
  const el = e.target.closest("[data-act]");
  if (el && !el.disabled) { ACT[el.dataset.act]?.(el, e); return; }
  if (e.target.id === "sheet") closeSheet();
  if (e.target.id === "dlg") closeDlg(false);
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if (DLG) closeDlg(false); else if (UI.sheet) closeSheet(); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("article.habit, article.todo")) { e.preventDefault(); ACT[e.target.dataset.act](e.target); }
});
document.addEventListener("input", e => { const k = e.target.dataset?.input; if (k && INPUT[k]) INPUT[k](e.target); });
document.addEventListener("change", e => {
  const k = e.target.dataset?.input;
  if (k && CHANGE[k]) { CHANGE[k](e.target); return; }
  const f = e.target.form;
  if (f?.id === "fEdit" && ["type", "sk"].includes(e.target.name)) {
    if (e.target.name === "type" && e.target.value !== "check" && !(+f.target.value >= 1)) f.target.value = e.target.value === "timer" ? 25 : 1;
    syncEditor(f);
  }
});
document.addEventListener("submit", e => { e.preventDefault(); SUBMIT[e.target.id]?.(e.target); });
document.addEventListener("toggle", e => { const d = e.target.dataset?.det; if (d === "off") UI.offOpen = e.target.open; if (d === "up") UI.upOpen = e.target.open; }, true);
document.addEventListener("focusout", () => { if (UI.pending) setTimeout(() => { if (UI.pending) render(); }, 0); });
document.addEventListener("pointerover", e => { const el = e.target.closest?.("[data-act=tip]"); if (el && e.pointerType === "mouse") ACT.tip(el); });

/* =========================================================
   Toasts, Konfetti, Ton, Vibration
   ========================================================= */
function toast(msg, opts = {}) {
  const box = $("#toasts");
  const t = document.createElement("div");
  t.className = "toast" + (opts.err ? " err" : "");
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (opts.undo) { const b = document.createElement("button"); b.textContent = "Rückgängig"; b.onclick = () => { t.remove(); opts.undo(); }; t.appendChild(b); }
  box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), opts.undo ? 6000 : 2800);
}
let FX = null;
function celebrate() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = $("#fx"), ctx = c.getContext("2d"), dpr = window.devicePixelRatio || 1;
  const cols = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#6250d6"];
  const W = innerWidth, H = innerHeight;
  const parts = Array.from({ length: 110 }, (_, i) => ({ x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.38, vx: (Math.random() - 0.5) * 13, vy: -Math.random() * 13 - 5,
    r: Math.random() * 6.3, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: cols[i % cols.length] }));
  if (FX) { FX.parts.push(...parts); FX.t0 = performance.now(); return; }
  c.width = W * dpr; c.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); c.hidden = false;
  FX = { parts, t0: performance.now() };
  let last = performance.now();
  const step = now => {
    const dt = Math.min(2, (now - last) / 16.7); last = now;
    ctx.clearRect(0, 0, W, H);
    for (const p of FX.parts) {
      p.vy += 0.32 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
    }
    if (now - FX.t0 < 2600) requestAnimationFrame(step);
    else { ctx.clearRect(0, 0, W, H); c.hidden = true; FX = null; }
  };
  requestAnimationFrame(step);
}
let AC = null;
function audioInit() { try { AC ||= new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) { AC = null; } }
function sound(kind, force) {
  if (!force && !S.settings.sound) return;
  audioInit(); if (!AC) return;
  const seq = { done: [[880, 0, 0.1]], perfect: [[660, 0, 0.1], [880, 0.1, 0.1], [1175, 0.2, 0.2]], timer: [[880, 0, 0.25], [880, 0.4, 0.25], [1175, 0.8, 0.5]] }[kind];
  for (const [f, at, d] of seq) {
    const o = AC.createOscillator(), g = AC.createGain(), t0 = AC.currentTime + at;
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    o.connect(g).connect(AC.destination); o.start(t0); o.stop(t0 + d + 0.03);
  }
}
function buzz(p) { try { navigator.vibrate?.(p); } catch (e) { /* egal */ } }

/* =========================================================
   Backup
   ========================================================= */
async function exportData() {
  const json = JSON.stringify({ app: "dranbleiben", exported: new Date().toISOString(), ...S });
  const name = `dranbleiben-backup-${today()}.json`;
  const file = new File([json], name, { type: "application/json" });
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Dranbleiben Backup" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast("Backup gespeichert");
}
async function importData(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); if (!Array.isArray(obj.habits)) throw new Error(); }
  catch (e) { toast("Die Datei ist kein gültiges Dranbleiben-Backup", { err: true }); return; }
  const n = obj.habits.filter(h => !h.deleted).length;
  if (!(await confirmDlg(`Backup mit ${n} Gewohnheit${n === 1 ? "" : "en"} einlesen? Es wird mit den vorhandenen Daten zusammengeführt, nichts geht verloren.`, "Einlesen"))) return;
  S = mergeStates(S, obj);
  commit({ quiet: true });
  toast("Backup eingelesen");
}

/* =========================================================
   Cloud-Sync (optional, Supabase)
   ========================================================= */
const SYNC = { client: null, session: null, busy: false, msg: "", ok: null, last: +localStorage.getItem("dranbleiben.lastSync") || 0, timer: null };
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("Sync-Bibliothek konnte nicht geladen werden")); document.head.appendChild(s); });
}
async function sbClient() {
  if (SYNC.client) return SYNC.client;
  if (!CFG.url) throw new Error("Sync ist nicht eingerichtet");
  if (!window.supabase) await loadScript("supabase.js");
  SYNC.client = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: AUTHKEY } });
  const { data } = await SYNC.client.auth.getSession();
  SYNC.session = data.session;
  SYNC.client.auth.onAuthStateChange((ev, s) => { SYNC.session = s; });
  return SYNC.client;
}
function setSync(ok, msg) {
  SYNC.ok = ok; SYNC.msg = msg;
  const el = $("#syncStatus");
  if (el) { el.textContent = msg; el.className = "status" + (ok === true ? " ok" : ok === false ? " err" : ""); }
}
function syncErr(e) {
  const m = String(e?.message || e || "");
  if (/Invalid login credentials/i.test(m)) return "E-Mail oder Passwort falsch.";
  if (/Email not confirmed/i.test(m)) return "Die E-Mail-Adresse ist noch nicht bestätigt.";
  if (/does not exist|Could not find the table|PGRST205|42P01/i.test(m)) return "Die Tabelle „dranbleiben“ fehlt – bitte supabase-setup.sql im SQL Editor ausführen.";
  if (/row-level security|permission denied/i.test(m)) return "Kein Zugriff – steht deine E-Mail in der players-Tabelle?";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Keine Verbindung – es wird später erneut versucht.";
  return m || "Unbekannter Fehler";
}
function scheduleSync() {
  if (!SYNC.session) return;
  clearTimeout(SYNC.timer);
  SYNC.timer = setTimeout(() => syncNow(), 2500);
}
async function syncInit() {
  if (!CFG.url || !localStorage.getItem(AUTHKEY)) return;
  try { await sbClient(); if (SYNC.session) syncNow(); else if (UI.tab === "more") render(); }
  catch (e) { setSync(false, syncErr(e)); }
}
async function syncNow(manual) {
  clearTimeout(SYNC.timer); SYNC.timer = null;
  if (!SYNC.session || SYNC.busy) return;
  if (!navigator.onLine) { setSync(false, "Offline – wird synchronisiert, sobald du wieder online bist."); return; }
  SYNC.busy = true; setSync(null, "Synchronisiere …");
  try {
    const c = await sbClient();
    const { data, error } = await c.from("dranbleiben").select("data").maybeSingle();
    if (error) throw error;
    const remote = data?.data && Array.isArray(data.data.habits) ? data.data : null;
    if (remote) {
      const merged = mergeStates(S, remote);
      if (JSON.stringify(merged) !== JSON.stringify(S)) {
        S = merged; REV++; persist(); checkAchievements(); persist();
        if (UI.sel > today()) UI.sel = today();
        refresh();
      }
    }
    if (!remote || JSON.stringify(normalize(remote)) !== JSON.stringify(S)) await pushRemote(false);
    SYNC.last = Date.now(); localStorage.setItem("dranbleiben.lastSync", SYNC.last);
    setSync(true, `Synchronisiert · ${new Date(SYNC.last).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`);
    if (manual) toast("Synchronisiert");
  } catch (e) {
    setSync(false, syncErr(e));
    if (manual) toast(syncErr(e), { err: true });
  } finally { SYNC.busy = false; }
}
async function pushRemote(overwrite) {
  const c = await sbClient();
  const { error } = await c.from("dranbleiben").upsert({ user_id: SYNC.session.user.id, data: S, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) { if (overwrite) toast(syncErr(error), { err: true }); else throw error; }
}
async function doLogin(f) {
  const btn = f.querySelector("button"); btn.disabled = true;
  setSync(null, "Melde an …");
  try {
    const c = await sbClient();
    const { data, error } = await c.auth.signInWithPassword({ email: f.email.value.trim(), password: f.pw.value });
    if (error) throw error;
    SYNC.session = data.session;
    document.activeElement?.blur();
    await syncNow();
    toast("Angemeldet – Sync ist aktiv");
    render();
  } catch (e) { setSync(false, syncErr(e)); btn.disabled = false; }
}

/* =========================================================
   Start
   ========================================================= */
function dayCheck() {
  const t = today();
  if (t !== UI.lastDay) { if (UI.sel === UI.lastDay) UI.sel = t; UI.lastDay = t; refresh(); }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    dayCheck(); tick();
    if (TM?.start) wakeLock();
    if (SYNC.session) syncNow();
  } else if (SYNC.session && SYNC.timer) syncNow();
});
window.addEventListener("online", () => { if (SYNC.session) syncNow(); });

function init() {
  TM = loadTimer();
  if (checkAchievements().length) persist(); // still nachtragen (z. B. nach Update)
  UI.sel = UI.lastDay = today();
  render();
  if (TM?.start && tmRemain() <= 0) tmFinish(true, true);
  setInterval(tick, 500);
  setInterval(dayCheck, 30000);
  syncInit();
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1"))
    navigator.serviceWorker.register("sw.js").catch(() => {});
}
init();
