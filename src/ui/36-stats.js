/* LearnZì UI, part 6b: progress stats. Charts are plain HTML and CSS (no chart library):
 * an activity calendar, reviews per day, cards coming due, and how well your words are known.
 * Every chart has a text line that shows the exact numbers for the bar or day you tap. */

function dayKeyOf(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
/** The last `n` study days, oldest first, as {key, date, act}. */
function lastDays(n) {
  const out = [];
  const d = new Date(clock() - 4 * 3600e3);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const key = dayKeyOf(d);
    out.push({ key, date: new Date(d), act: progress.act[key] || [0, 0, 0, 0, 0] });
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const fmtDay = d => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
function totals() {
  let reviews = 0, again = 0, days = 0, best = 0, run = 0, prev = null;
  for (const k of Object.keys(progress.act).sort()) {
    const a = progress.act[k];
    reviews += a[1]; again += a[3] || 0;
    if (a[1] > 0) {
      days++;
      const d = new Date(k + "T12:00:00");
      run = prev && Math.round((d - prev) / 864e5) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = d;
    }
  }
  let familiar = 0, known = 0;
  for (const [k, c] of Object.entries(progress.cards)) {
    if (!k.endsWith("|m") || SRS.isLearning(c)) continue;
    if (c[0] >= 21) known++; else familiar++;
  }
  return { reviews, again, days, best, familiar, known };
}
function chartNote(text) { return h("p", { class: "muted small chart-note", "aria-live": "polite" }, text); }
function wireNote(el, note, text) {
  const show = () => { note.textContent = text; };
  el.addEventListener("mouseenter", show);
  el.addEventListener("focus", show);
  el.addEventListener("click", show);
}

/** Activity calendar: one square per day, darker for more reviews. */
function heatmap(weeks) {
  const days = lastDays(weeks * 7);
  // Start on a Monday so the rows are weekdays.
  while (days.length && days[0].date.getDay() !== 1) days.shift();
  const levels = n => (n === 0 ? 0 : n < 10 ? 1 : n < 25 ? 2 : n < 50 ? 3 : 4);
  const note = chartNote("Tap a day to see how many cards you reviewed.");
  const grid = h("div", { class: "heat", role: "img", "aria-label": "Reviews per day for the last " + weeks + " weeks" });
  for (const d of days) {
    const n = d.act[1];
    const cell = h("button", { class: "hm hm" + levels(n), type: "button", "aria-label": fmtDay(d.date) + ": " + n + " reviews" });
    wireNote(cell, note, fmtDay(d.date) + ": " + (n ? n + (n === 1 ? " card reviewed" : " cards reviewed") : "no study"));
    grid.append(cell);
  }
  const scroller = h("div", { class: "heat-scroll" }, grid);
  setTimeout(() => { scroller.scrollLeft = scroller.scrollWidth; }, 0);
  const legend = h("div", { class: "row heat-legend small muted" }, "Less", [0, 1, 2, 3, 4].map(i => h("i", { class: "hm hm" + i })), "More");
  return h("div", { class: "stack-tight" }, scroller, h("div", { class: "row spread" }, note, legend));
}

/** Columns: one per day, optionally stacked (remembered + forgot). */
function columns(items, { stacked, empty }) {
  const max = Math.max(1, ...items.map(it => it.parts.reduce((a, b) => a + b, 0)));
  const note = chartNote(empty);
  const cols = h("div", { class: "cols" });
  items.forEach(it => {
    const total = it.parts.reduce((a, b) => a + b, 0);
    const stack = h("span", { class: "stack-col" });
    it.parts.forEach((v, i) => {
      if (!v) return;
      const seg = h("i", { class: "seg seg" + i });
      seg.style.height = (v / max) * 100 + "%";
      stack.append(seg);
    });
    const col = h("button", { class: "col", type: "button", "aria-label": it.text }, stack);
    wireNote(col, note, it.text);
    cols.append(col);
    void total;
  });
  const first = items[0], mid = items[Math.floor(items.length / 2)], last = items[items.length - 1];
  return h("div", { class: "chart" },
    h("div", { class: "plot" }, h("span", { class: "ymax small muted num" }, String(max)), cols),
    h("div", { class: "row spread xlab small muted" }, h("span", null, first.label), h("span", null, mid.label), h("span", null, last.label)),
    stacked ? h("div", { class: "row slegend" }, h("span", { class: "small" }, h("i", { class: "seg0" }), "Remembered"), h("span", { class: "small" }, h("i", { class: "seg1" }), "Forgot")) : null,
    note);
}

function reviewsChart() {
  const items = lastDays(30).map(d => {
    const again = Math.min(d.act[3] || 0, d.act[1]);
    const ok = d.act[1] - again;
    return {
      parts: [ok, again],
      label: d.date.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      text: fmtDay(d.date) + ": " + d.act[1] + (d.act[1] === 1 ? " review" : " reviews") + (d.act[1] ? " (" + ok + " remembered, " + again + " forgot)" : ""),
    };
  });
  return columns(items, { stacked: true, empty: "Tap a day for its numbers." });
}
function forecastChart() {
  const nowMs = clock();
  const today = SRS.dayStartMin(nowMs, 0);
  const counts = new Array(14).fill(0);
  const words = new Set(activeWords().map(keyOf));
  for (const [k, c] of Object.entries(progress.cards)) {
    if (!words.has(k.slice(0, k.lastIndexOf("|")))) continue;
    const day = Math.max(0, Math.floor((c[2] - today) / 1440));
    if (day < 14) counts[day]++;
  }
  const items = counts.map((n, i) => {
    const d = new Date(nowMs - 4 * 3600e3); d.setDate(d.getDate() + i);
    const name = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });
    return { parts: [n], label: name, text: name + ": " + n + (n === 1 ? " card due" : " cards due") + (i === 0 ? " (including any overdue)" : "") };
  });
  return columns(items, { stacked: false, empty: "Tap a day to see how many cards come due." });
}

function progressPreview() {
  const t = totals();
  return h("div", { class: "card stack" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "My progress"),
      h("button", { class: "btn", type: "button", onclick: () => go("stats") }, "See all stats")),
    h("div", { class: "stats" }, stat(t.familiar + t.known, "words learned"), stat(t.reviews, "reviews"), stat(t.days, "days studied")),
    heatmap(12));
}

function viewStats() {
  const v = h("section", { class: "view" });
  const t = totals();
  const lv = levelNow();
  const retention = t.reviews && t.again !== undefined ? Math.round((1 - t.again / Math.max(1, t.reviews)) * 100) : null;
  v.append(h("div", { class: "card stack" }, levelBar(lv),
    h("div", { class: "stats" },
      stat(t.familiar + t.known, "words learned"),
      stat(t.known, "known well"),
      stat(t.reviews, "total reviews"),
      stat(retention === null ? "–" : retention + "%", "remembered"),
      stat(streak(), "day streak"),
      stat(t.best, "best streak"))));
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Study calendar"), h("p", { class: "muted small" }, "The last 26 weeks. Each square is a day."), heatmap(26)));
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Reviews, last 30 days"), reviewsChart()));
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "Coming up, next 14 days"),
    h("p", { class: "muted small" }, "Cards from the decks you study, by the day they come due."), forecastChart()));
  // Word strength per deck
  const ids = ["starred", "welcome", ...state.decks.map(d => d.id), "hsk1", "hsk2", "hsk3", "hsk4", "hsk5", "hsk6"].filter(isActive);
  const all = activeWords();
  const counts = [0, 0, 0, 0];
  all.forEach(e => counts[strength(e)]++);
  v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "How well I know my words"),
    h("p", { class: "muted small" }, "Learning: still in short steps. Familiar: remembered for under 3 weeks. Known: 3 weeks or more."),
    strengthBar(counts, all.length), strengthLegend(counts),
    ids.map(id => { const s = deckSummary(id); return h("div", { class: "deck-strength" }, h("div", { class: "row spread small" }, h("b", null, deckName(id)), h("span", { class: "muted" }, (s.counts[2] + s.counts[3]) + " / " + s.total + " learned")), strengthBar(s.counts, s.total)); })));
  return v;
}
