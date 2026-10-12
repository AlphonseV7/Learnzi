/* LearnZì UI, part 3: how words are drawn, My Zì saving, and the word panel. */

const ui = { view: "home", query: "", stack: [], focus: null, dict: "loading", progress: 0, highlight: null, myziSort: "new", deckId: null, deckShow: 100, picker: false, meTab: "avatar" };
const disp = e => (state.script === "t" ? e.t : e.s);
const other = e => (state.script === "t" ? e.s : e.t);
const keyOf = e => e.s + "|" + e.p;

function pyEl(numbered, cls) {
  const span = h("span", { class: cls || null });
  Engine.syllables(numbered).forEach((x, k) => {
    if (k) span.append(" ");
    span.append(h("span", { class: x.tone ? "t" + x.tone : null }, x.text));
  });
  return span;
}
// Characters coloured by tone (when the syllable count matches the character count).
function hzEl(form, numbered, cls) {
  const chars = [...form];
  const syl = numbered ? Engine.syllables(numbered) : [];
  const span = h("span", { class: cls === undefined ? "hz" : cls, lang: "zh" });
  if (syl.length === chars.length) chars.forEach((c, k) => span.append(h("span", { class: syl[k].tone ? "t" + syl[k].tone : null }, c)));
  else span.textContent = form;
  return span;
}
// Characters with small pinyin above them, exactly like the Reader. Hidden when pinyin is off.
function rubyHz(form, numbered, cls) {
  return h("ruby", { class: "rz" + (cls ? " " + cls : ""), lang: "zh" }, hzEl(form, numbered, "hz"), h("rt", null, pyEl(numbered)));
}

// CEDICT cross-references look like 神農|神农[Shen2 nong2]; show them as readable, tappable words.
const XREF = /([㐀-鿿豈-﫿\u{20000}-\u{2ebef}·]+)(?:\|([㐀-鿿豈-﫿\u{20000}-\u{2ebef}·]+))?\[([A-Za-z0-9:,· ]+)\]/gu;
function senseEl(text, tag) {
  const el = h(tag || "span");
  let last = 0;
  for (const m of text.matchAll(XREF)) {
    if (m.index > last) el.append(text.slice(last, m.index));
    const s = m[2] || m[1];
    el.append(h("button", { class: "xref", type: "button", onclick: () => pushWord(s) },
      h("span", { class: "hz" }, state.script === "t" ? m[1] : s), " ", h("span", { class: "xref-py" }, Engine.toMarks(m[3]))));
    last = m.index + m[0].length;
  }
  if (last < text.length) el.append(text.slice(last));
  return el;
}
const plainSense = text => text.replace(XREF, (all, t, s, p) => (state.script === "t" ? t : (s || t)) + " " + Engine.toMarks(p));
const shortDef = (e, n) => Engine.senses(e).slice(0, n).map(plainSense).join("; ");

// ---------- My Zì (saved words) ----------
const isSaved = e => state.saved.some(x => x.s === e.s && x.p === e.p);
function toggleSave(e) {
  const was = isSaved(e);
  commit({ saved: was ? state.saved.filter(x => !(x.s === e.s && x.p === e.p)) : [{ s: e.s, p: e.p, at: Date.now() }, ...state.saved] });
  toast(was ? "Removed " + disp(e) + " from My Zì" : "Added " + disp(e) + " to My Zì");
  if (!was && !progress.cards[cardBase(e) + "|m"]) gainBonus(5, e.s);
  renderPanel();
  refreshView();
}
function starBtn(e, extra) {
  const on = isSaved(e);
  const label = on ? "Remove from My Zì" : "Add to My Zì";
  return h("button", { class: "btn icon star" + (extra ? " " + extra : ""), type: "button", "aria-pressed": String(on), "aria-label": label, title: label,
    onclick: ev => {
      ev.stopPropagation();
      if (!isSaved(e)) sparkle(ev.currentTarget.getBoundingClientRect());
      toggleSave(e);
    } }, icon("star", on));
}
/** A little burst of sparks where a star was just filled (drawn above everything, then removed). */
function sparkle(rect) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = h("span", { class: "sparkle", "aria-hidden": "true" });
  box.style.left = (rect.left + rect.width / 2) + "px";
  box.style.top = (rect.top + rect.height / 2) + "px";
  for (let i = 0; i < 8; i++) {
    const s = h("i");
    s.style.setProperty("--a", (i * 45 + 22) + "deg");
    s.style.setProperty("--d", (i % 2 ? 22 : 30) + "px");
    box.append(s);
  }
  document.body.append(box);
  setTimeout(() => box.remove(), 700);
}
function savedEntries() {
  const out = [];
  for (const x of state.saved) {
    const list = Engine.lookup(x.s);
    const e = list.find(y => y.p === x.p) || list[0];
    if (e) out.push({ e, at: x.at });
  }
  return out;
}
function addRecent(s) {
  if (state.recent[0] === s) return;
  commit({ recent: [s, ...state.recent.filter(x => x !== s)].slice(0, 16) });
}
function refreshView() {
  if (ui.view === "lookup" && $("#results")) fillResults($("#results"));
  else if (["home", "myzi", "deck", "stats"].includes(ui.view) || (ui.view === "study" && study.revealed)) render(false);
}
const progressText = () => ui.progress >= 1 ? "Preparing the dictionary…" : "Loading dictionary… " + Math.round(ui.progress * 100) + "%";
function loadingBlock() {
  if (ui.dict === "error") return h("div", { class: "empty" }, "Couldn't load the dictionary. Check your connection, then reload the page.");
  return h("div", { class: "loading" }, h("span", { class: "spin" }), h("span", { class: "dict-progress" }, progressText()));
}

// ---------- word panel (bottom sheet on phones, right column on wide screens) ----------
const wide = window.matchMedia("(min-width: 1100px)");
function openWord(form, entry) {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (!Engine.lookup(form).length) { toast("That isn't in the dictionary."); return; }
  ui.stack = [form];
  ui.focus = entry || null;
  ui.picker = false;
  ui.writeIdx = 0;
  addRecent(Engine.lookup(form)[0].s);
  rewardLookup(Engine.lookup(form)[0].s);
  renderPanel();
  showPanel();
}
function pushWord(form) {
  if (!Engine.lookup(form).length) { toast("That isn't in the dictionary."); return; }
  ui.stack.push(form);
  ui.focus = null;
  ui.picker = false;
  ui.writeIdx = 0;
  renderPanel();
  $("#panel").scrollTop = 0;
}
function showPanel() {
  const p = $("#panel");
  p.classList.add("open");
  if (desk.matches) deskShowPanel(); else $("#scrim").classList.add("open");
  p.scrollTop = 0;
  if (!wide.matches) { const c = p.querySelector(".panel-close"); if (c) c.focus({ preventScroll: true }); }
}
function closePanel() {
  $("#panel").classList.remove("open");
  deskHidePanel();
  $("#scrim").classList.remove("open");
  document.querySelectorAll(".w.sel").forEach(b => b.classList.remove("sel"));
}
function renderPanel() {
  const box = $("#pv");
  box.replaceChildren();
  const closeBtn = h("button", { class: "btn icon panel-close", type: "button", "aria-label": "Close", onclick: closePanel }, icon("close"));
  const form = ui.stack[ui.stack.length - 1];
  if (!form || ui.dict !== "ready") {
    box.append(h("div", { class: "pv" },
      h("div", { class: "pv-top" }, h("span", { class: "eyebrow" }, "Word details"), closeBtn),
      h("div", { class: "empty" }, "Tap a word in the Reader, or a search result, to see its meaning here.")));
    return;
  }
  let entries = Engine.lookup(form);
  if (ui.focus && ui.stack.length === 1) entries = [ui.focus, ...entries.filter(e => e !== ui.focus)];
  const e0 = entries[0];
  const pv = h("div", { class: "pv enter" });
  pv.append(h("div", { class: "pv-top" },
    ui.stack.length > 1
      ? h("button", { class: "btn", type: "button", onclick: () => { ui.stack.pop(); renderPanel(); } }, icon("back"), "Back")
      : h("span", { class: "eyebrow" }, [...form].length > 1 ? "Word" : "Character"),
    h("div", { class: "row pv-tools" }, foldAllBtn(), closeBtn)));
  const alt = other(e0) !== disp(e0) ? other(e0) : null;
  pv.append(h("div", { class: "head" },
    rubyHz(disp(e0), e0.p, "head-hz"),
    alt ? h("div", { class: "alt" }, state.script === "t" ? "Simplified " : "Traditional ", h("span", { class: "hz" }, alt)) : null,
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", onclick: () => speak(e0.s, e0.p) }, icon("play"), "Listen"),
      starBtn(e0),
      h("button", { class: "btn", type: "button", "aria-expanded": String(ui.picker), onclick: () => { ui.picker = !ui.picker; renderPanel(); } }, "+ Deck"),
      h("button", { class: "btn", type: "button", onclick: () => {
        closePanel();
        if (isSaved(e0)) { ui.highlight = keyOf(e0); openDeck("starred"); } else go("myzi");
      } }, "My Zì", icon("next")),
      e0.h ? h("span", { class: "badge hsk" }, "HSK " + e0.h) : null,
      showDetail("freq") ? freqBadge(e0) : null),
    ui.picker ? deckPicker(e0) : null));
  const addBox = el => { if (el) { el.classList.add("pv-box", "card"); pv.append(el); } };
  if (showDetail("tips")) addBox(pronunciationTip(e0));
  const shown = entries.slice(0, 8);
  const meanings = h("div", { class: "meanings" }, h("span", { class: "eyebrow" }, shown.length > 1 ? "Meanings" : "Meaning"));
  addBox(meanings);
  shown.forEach((e, k) => {
    const mws = Engine.measureWords(e);
    meanings.append(h("section", { class: "reading" },
      h("div", { class: "row reading-top" },
        pyEl(e.p, "py"),
        disp(e) !== disp(e0) ? h("span", { class: "hz muted" }, disp(e)) : null,
        h("span", { class: "grow" }),
        k > 0 ? starBtn(e) : null),
      h("ol", { class: "defs" }, Engine.senses(e).map(s => senseEl(s, "li"))),
      mws.length ? h("div", { class: "mw row" }, h("span", null, mws.length > 1 ? "Measure words" : "Measure word"),
        mws.map(m => h("button", { class: "chip", type: "button", onclick: () => pushWord(m.s) }, rubyHz(state.script === "t" ? m.t : m.s, m.p)))) : null));
  });
  if (showDetail("write")) addBox(writeSection(e0));
  addBox(charactersSection(e0));
  if (showDetail("words")) addBox(wordsWithSection(e0));
  addBox(clipBlock(e0, true));
  if (showDetail("examples")) addBox(examplesSection(e0));
  if (showDetail("notes")) addBox(notesSection(e0));
  // Every part is its own box that folds away; the longer ones start folded.
  foldify(pv, "pv", ":scope > .pv-box", ["pv-character", "pv-words-with", "pv-example"]);
  box.append(pv);
  updatePvTools();
}
