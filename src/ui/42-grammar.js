/* LearnZì UI, part 5c: Grammar. About 500 grammar points from the AllSet Learning Chinese Grammar
 * Wiki, ©2021 AllSet Learning, CC BY-NC-SA 3.0: non-commercial only (no adverts or paid use), credited
 * with a link on every view where it appears, and shared alike. tools/build_grammar.py turns the wiki
 * archive into grammar/index.json (every point) and grammar/a1.json … c1.json (the articles of a level).
 * Study → Grammar lists them by level with a search; a point shows its structure, examples whose words
 * you can tap and hear, and related points. Words that have a grammar point show a Grammar box in the
 * word pop-up. Everything is shown as text. */

const GRAMMAR_SRC = "https://resources.allsetlearning.com/chinese/grammar/";
const GRAMMAR_LICENCE = "https://creativecommons.org/licenses/by-nc-sa/3.0/";
const GLEVELS = ["A1", "A2", "B1", "B2", "C1"];
const GLEVEL_NOTE = { A1: "Beginner", A2: "Elementary", B1: "Intermediate", B2: "Upper intermediate", C1: "Advanced" };
const grammar = { list: null, byId: new Map(), byWord: new Map(), loading: null, arts: {} };
const strs = a => (Array.isArray(a) ? a.filter(x => typeof x === "string").map(x => x.slice(0, 120)) : []);

/** The list of grammar points (small: loaded once, the first time it's needed). */
function loadGrammar() {
  if (grammar.list) return Promise.resolve(grammar.list);
  if (!grammar.loading) {
    grammar.loading = fetchPackedJSON("grammar/index.json").then(j => {
      const pts = j && Array.isArray(j.points) ? j.points : [];
      grammar.list = pts.filter(p => Array.isArray(p) && typeof p[0] === "string" && /^ASG[0-9A-Z]{5}$/.test(p[0]) && typeof p[1] === "string")
        .map(p => ({ id: p[0], title: p[1].slice(0, 160), level: GLEVELS.includes(p[2]) ? p[2] : "B1", cmp: p[3] === "c", pattern: typeof p[4] === "string" ? p[4].slice(0, 200) : "",
          words: strs(p[5]), hsk: Number(p[6]) || 0, used: strs(p[7]), aka: strs(p[8]) }));
      for (const p of grammar.list) {
        grammar.byId.set(p.id, p);
        for (const w of p.words) { if (!grammar.byWord.has(w)) grammar.byWord.set(w, []); grammar.byWord.get(w).push(p); }
      }
      return grammar.list;
    }).catch(() => { grammar.loading = null; return null; });
  }
  return grammar.loading;
}
/** The articles of one level (loaded when you open a point of that level). */
function loadGrammarLevel(level) {
  const k = level.toLowerCase();
  if (!grammar.arts[k]) grammar.arts[k] = fetchPackedJSON("grammar/" + k + ".json").catch(() => { delete grammar.arts[k]; return {}; });
  return grammar.arts[k];
}
function openGrammar(id) {
  ui.gram = id;
  closePanel();
  go("gpoint");
}
function grammarCredit(id) {
  return h("p", { class: "muted small g-credit" }, "From the ",
    h("a", { href: GRAMMAR_SRC + (id || ""), target: "_blank", rel: "noopener noreferrer" }, "AllSet Learning Chinese Grammar Wiki"),
    " (", h("a", { href: GRAMMAR_LICENCE, target: "_blank", rel: "noopener noreferrer" }, "CC BY-NC-SA 3.0"), "), shown here in a simpler layout.");
}
const levelChip = (lv, cls) => h("span", { class: "badge g-level g-" + lv.toLowerCase() + (cls ? " " + cls : ""), title: GLEVEL_NOTE[lv] }, lv);

// ---------- text ----------
/** Runs of text: plain strings, [text, "e"] highlighted, "b" bold, "i" italic, "l" a link to a point. */
function gRuns(runs) {
  return (Array.isArray(runs) ? runs : []).map(r => {
    if (typeof r === "string") return r;
    if (!Array.isArray(r) || typeof r[0] !== "string") return null;
    const [t, st, id] = r;
    if (st === "e") return h("em", { class: "g-em" }, t);
    if (st === "b") return h("strong", null, t);
    if (st === "i") return h("i", null, t);
    if (st === "l" && typeof id === "string") return h("button", { class: "plain-btn g-link", type: "button", onclick: () => openGrammar(id) }, t);
    return t;
  });
}
const runsText = runs => (Array.isArray(runs) ? runs : []).map(r => (typeof r === "string" ? r : Array.isArray(r) ? r[0] : "")).join("");
const CJK = /[㐀-鿿豈-﫿]/;
/** A Chinese example: the wiki separates words with spaces, so each word becomes tappable. */
function gChinese(runs) {
  const out = h("span", { class: "g-zh hz" });
  for (const r of Array.isArray(runs) ? runs : []) {
    const text = typeof r === "string" ? r : Array.isArray(r) ? r[0] : "";
    const style = Array.isArray(r) ? r[1] : "";
    const host = style === "e" ? h("em", { class: "g-em" }) : style === "b" ? h("strong") : out;
    if (host !== out) out.append(host);
    const toks = String(text).split(/(\s+)/);
    toks.forEach((tok, i) => {
      if (!tok) return;
      // Spaces only separate words; keep them between words of English or numbers.
      if (/^\s+$/.test(tok)) { if (i > 0 && i < toks.length - 1 && !CJK.test(toks[i - 1].slice(-1)) && !CJK.test(toks[i + 1][0] || "")) host.append(" "); return; }
      if (!CJK.test(tok) || ui.dict !== "ready") { host.append(h("span", { class: "plain" }, tok)); return; }
      for (const seg of Engine.lookup(tok).length ? [{ text: tok, word: true, entries: Engine.lookup(tok) }] : Engine.segment(tok)) {
        if (!seg.word || !seg.entries.length) { host.append(h("span", { class: "plain" }, seg.text)); continue; }
        const e = seg.entries[0];
        const shown = seg.text === e.s || seg.text === e.t ? disp(e) : seg.text;
        host.append(h("button", { class: "w", type: "button", "data-form": seg.text }, h("ruby", null, hzEl(shown, e.p, ""), h("rt", null, pyEl(e.p)))));
      }
    });
  }
  return out;
}
function gExample(ex) {
  const zh = runsText(ex.z).replace(/\s+/g, "");
  const mark = ex.m === "o" ? h("span", { class: "g-mark ok", "aria-label": "Correct", title: "Correct" }, "✓")
    : ex.m === "x" ? h("span", { class: "g-mark no", "aria-label": "Incorrect", title: "Incorrect" }, "✗") : null;
  return h("li", { class: "g-ex" + (ex.m === "x" ? " wrong" : "") },
    h("div", { class: "g-ex-line" },
      mark, ex.s ? h("span", { class: "g-speaker" }, ex.s) : null,
      gChinese(ex.z),
      ex.m === "x" ? null : h("button", { class: "btn icon small g-say", type: "button", "aria-label": "Listen", onclick: () => speak(zh) }, icon("play"))),
    ex.p ? h("div", { class: "g-py" }, gRuns(ex.p)) : null,
    ex.t ? h("div", { class: "g-tr" }, gRuns(ex.t)) : null,
    ex.e ? h("div", { class: "g-note muted small" }, gRuns(ex.e)) : null);
}
function gBlocks(blocks) {
  const out = [];
  for (const b of Array.isArray(blocks) ? blocks : []) {
    if (!Array.isArray(b)) continue;
    const [k, a, c] = b;
    if (k === "h") out.push(h(a === 2 ? "h2" : "h3", { class: a === 2 ? "h-card g-h2" : "g-h3" }, String(c || "")));
    else if (k === "p") out.push(h("p", { class: "g-p" }, gRuns(a)));
    else if (k === "pat") out.push(h("div", { class: "g-pat" }, (a || []).map(r => h("div", { class: "g-pat-line" }, gRuns(r)))));
    else if (k === "ex") out.push(h("ul", { class: "g-exs" }, (a || []).filter(x => x && Array.isArray(x.z)).map(gExample)));
    else if (k === "ul") out.push(h("ul", { class: "g-ul" }, (a || []).map(r => h("li", null, gRuns(r)))));
    else if (k === "tb") out.push(h("div", { class: "g-table-wrap" }, h("table", { class: "g-table" },
      (a || []).map((row, i) => h("tr", null, (row || []).map(cell => h(i === 0 ? "th" : "td", null, gRuns(cell))))))));
    else if (k === "see") out.push(seeAlso(a));
  }
  return out;
}
function seeAlso(ids) {
  const pts = (ids || []).map(id => grammar.byId.get(id)).filter(Boolean);
  if (!pts.length) return null;
  return h("div", { class: "stack-tight" }, h("h2", { class: "h-card g-h2" }, "See also"),
    h("div", { class: "g-list" }, pts.map(gItem)));
}
/** One grammar point in a list: its title, level and pattern. */
function gItem(p) {
  return h("button", { class: "g-item", type: "button", onclick: () => openGrammar(p.id) },
    h("span", { class: "g-item-top" }, levelChip(p.level), h("span", { class: "g-item-title" }, p.title)),
    p.pattern ? h("span", { class: "g-item-pat muted small" }, p.pattern) : null);
}

// ---------- Study → Grammar ----------
function grammarMatches(q, level) {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return (grammar.list || []).filter(p => {
    if (level === "cmp" ? !p.cmp : level && p.level !== level) return false;
    if (!words.length) return true;
    const hay = (p.title + " " + p.pattern + " " + p.words.join(" ") + " " + p.used.join(" ") + " " + p.aka.join(" ")).toLowerCase();
    return words.every(w => hay.includes(w));
  });
}
function viewGrammar() {
  const v = h("section", { class: "view grammar" });
  const results = h("div", { class: "stack" });
  const input = h("input", { type: "search", id: "gq", placeholder: "Search: 了, comparisons, \"because\"…", value: ui.gramQ || "", autocomplete: "off", spellcheck: "false", "aria-label": "Search grammar points" });
  const chips = h("div", { class: "row g-levels", role: "group", "aria-label": "Level" });
  const draw = () => {
    chips.replaceChildren(...[["", "All"], ...GLEVELS.map(l => [l, l]), ["cmp", "Comparisons"]].map(([k, label]) =>
      h("button", { class: "chip filter-chip", type: "button", "aria-pressed": String((ui.gramLevel || "") === k), title: GLEVEL_NOTE[k] || null,
        onclick: () => { ui.gramLevel = k; draw(); } }, label)));
    results.replaceChildren();
    if (!grammar.list) { results.append(h("div", { class: "card" }, h("div", { class: "loading" }, h("span", { class: "spin" }), h("span", null, "Loading grammar…")))); return; }
    const found = grammarMatches(ui.gramQ || "", ui.gramLevel || "");
    if (!found.length) { results.append(h("div", { class: "card empty" }, "No grammar points match that.")); return; }
    for (const lv of GLEVELS) {
      const pts = found.filter(p => p.level === lv);
      if (!pts.length) continue;
      results.append(h("div", { class: "card stack-tight" },
        h("h2", { class: "h-card row g-level-head" }, levelChip(lv), GLEVEL_NOTE[lv], h("span", { class: "muted small num" }, String(pts.length))),
        h("div", { class: "g-list" }, pts.slice(0, ui.gramQ ? 200 : 400).map(gItem))));
    }
  };
  input.addEventListener("input", () => { ui.gramQ = input.value.slice(0, 60); clearTimeout(input.t); input.t = setTimeout(draw, 150); });
  v.append(h("div", { class: "card stack-tight" }, input, chips), results, grammarCredit(""));
  draw();
  if (!grammar.list) loadGrammar().then(() => { if (ui.view === "grammar") draw(); else if (!grammar.list) toast("Couldn't load the grammar points. Check your connection."); });
  return v;
}

// ---------- one grammar point ----------
function viewGrammarPoint() {
  const v = h("section", { class: "view grammar gpoint" });
  const p = grammar.byId.get(ui.gram);
  if (!grammar.list) {
    v.append(h("div", { class: "card" }, h("div", { class: "loading" }, h("span", { class: "spin" }), h("span", null, "Loading grammar…"))));
    loadGrammar().then(() => { if (ui.view === "gpoint") render(false); });
    return v;
  }
  if (!p) { setTimeout(() => go("grammar"), 0); return v; }
  setTimeout(() => jCount("grammar", p.id), 0);
  const body = h("div", { class: "card stack g-article" });
  v.append(h("div", { class: "card stack-tight g-meta" },
      h("div", { class: "row" }, levelChip(p.level), h("span", { class: "muted small" }, GLEVEL_NOTE[p.level]), p.hsk ? h("span", { class: "badge hsk" }, "HSK " + p.hsk) : null, p.cmp ? h("span", { class: "badge" }, "Comparison") : null),
      p.pattern ? h("div", { class: "g-pat" }, h("div", { class: "g-pat-line" }, p.pattern)) : null,
      p.words.length ? h("div", { class: "row g-words" }, h("span", { class: "muted small" }, "Words"), p.words.map(w => h("button", { class: "chip", type: "button", onclick: () => openWord(w) }, h("span", { class: "hz" }, w)))) : null,
      p.used.length ? h("div", { class: "row g-used" }, h("span", { class: "muted small" }, "Used for"), p.used.map(u => h("span", { class: "chip static" }, u))) : null,
      p.aka.length ? h("p", { class: "muted small" }, "Also called: " + p.aka.join(" · ")) : null),
    body, grammarCredit(p.id));
  body.append(h("div", { class: "loading" }, h("span", { class: "spin" }), h("span", null, "Loading…")));
  body.addEventListener("click", ev => {
    const b = ev.target.closest(".w");
    if (!b) return;
    if (b.classList.contains("sel")) { speak(b.dataset.form); return; }
    document.querySelectorAll(".w.sel").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
    openWord(b.dataset.form);
  });
  loadGrammarLevel(p.level).then(arts => {
    const blocks = arts && arts[p.id];
    body.replaceChildren(...(blocks ? gBlocks(blocks) : [h("p", { class: "empty" }, "Couldn't load this grammar point. Check your connection.")]).filter(Boolean));
  });
  return v;
}

// ---------- in the word pop-up ----------
function grammarSection(e) {
  if (!grammar.list) { loadGrammar(); return null; }
  const pts = [...new Set([...(grammar.byWord.get(e.s) || []), ...(e.t && e.t !== e.s ? grammar.byWord.get(e.t) || [] : [])])];
  if (!pts.length) return null;
  const order = p => GLEVELS.indexOf(p.level);
  pts.sort((a, b) => order(a) - order(b) || a.title.localeCompare(b.title));
  return h("div", { class: "stack-tight" }, h("span", { class: "eyebrow" }, "Grammar"),
    h("div", { class: "g-list" }, pts.slice(0, 6).map(gItem)),
    pts.length > 6 ? h("button", { class: "btn small", type: "button", onclick: () => { ui.gramQ = e.s; ui.gramLevel = ""; closePanel(); go("grammar"); } }, "All " + pts.length + " grammar points") : null,
    h("p", { class: "muted small g-credit" }, "From the ", h("a", { href: GRAMMAR_SRC, target: "_blank", rel: "noopener noreferrer" }, "AllSet Learning Chinese Grammar Wiki"), " (CC BY-NC-SA 3.0)"));
}

// ---------- Home: grammar point of the day ----------
// Points at your level (Settings → Profile → My Chinese), one a day, the same all day on every device.
const GDAY_LEVELS = { new: ["A1"], little: ["A1", "A2"], middle: ["A2", "B1"], high: ["B2", "C1"] };
function grammarDayBox() {
  const body = h("div", { class: "stack-tight" }, h("div", { class: "loading" }, h("span", { class: "spin" }), h("span", null, "Loading…")));
  const box = h("div", { class: "card stack g-day" }, h("span", { class: "eyebrow" }, "Grammar point of the day"), body);
  loadGrammar().then(list => {
    const pool = (list || []).filter(p => !p.cmp && (GDAY_LEVELS[state.level] || ["A1"]).includes(p.level));
    if (!pool.length) { body.replaceChildren(h("p", { class: "muted small" }, "Couldn't load today's grammar point.")); return; }
    const day = Math.floor((clock() - 4 * 3600e3 - new Date(clock()).getTimezoneOffset() * 60e3) / 86400e3);
    // a fixed shuffle of the pool, so neighbouring days aren't neighbouring titles
    const p = pool[(day * 7919) % pool.length];
    const more = h("button", { class: "btn small", type: "button", onclick: () => openGrammar(p.id) }, "Read more", icon("next"));
    body.replaceChildren(
      h("button", { class: "plain-btn g-day-title", type: "button", onclick: () => openGrammar(p.id) }, levelChip(p.level), h("b", null, p.title)),
      p.pattern ? h("div", { class: "g-pat" }, h("div", { class: "g-pat-line" }, p.pattern)) : null);
    loadGrammarLevel(p.level).then(arts => {
      const blocks = (arts && arts[p.id]) || [];
      const exBlock = blocks.find(b => Array.isArray(b) && b[0] === "ex" && Array.isArray(b[1]) && b[1].some(x => x && x.m !== "x"));
      const ex = exBlock ? exBlock[1].find(x => x && x.m !== "x" && Array.isArray(x.z)) : null;
      const exEl = ex ? h("ul", { class: "g-exs" }, gExample(ex)) : null;
      if (exEl) exEl.addEventListener("click", ev => { const b = ev.target.closest(".w"); if (b) openWord(b.dataset.form); });
      body.append(exEl || "", h("div", { class: "row spread" }, more,
        h("a", { class: "small muted", href: GRAMMAR_SRC + p.id, target: "_blank", rel: "noopener noreferrer", title: "AllSet Learning Chinese Grammar Wiki (CC BY-NC-SA 3.0)" }, "AllSet Grammar Wiki")));
    });
  });
  return box;
}
