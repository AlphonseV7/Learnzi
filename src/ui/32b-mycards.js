/* LearnZì UI, part 5b2: My cards. Every word I've saved (starred), with its flashcards: which card
 * types it has (Meaning, Listening, Recall, Writing), how each is going, and when it's next due.
 * Filter by deck (only the saved words in that deck show) and by how well each word is known. */

const CARD_LETTER = { m: "M", l: "L", r: "R", w: "W" };
const CARD_FILTERS = [["all", "All"], ["due", "Due"], ["new", "New"], ["learning", "Learning"], ["familiar", "Familiar"], ["known", "Known"]];

/** The decks that hold at least one saved word: [id, name, keys of saved words in it]. */
function savedByDeck(saved) {
  const keys = new Set(saved.map(keyOf)), out = [];
  const add = (id, inDeck) => { const ks = saved.filter(inDeck).map(keyOf); if (ks.length) out.push([id, deckName(id), new Set(ks)]); };
  const welcome = new Set(deckWords("welcome").map(keyOf));
  add("welcome", e => welcome.has(keyOf(e)));
  for (const d of state.decks) { const ks = new Set(d.words.map(w => w.s + "|" + w.p)); add(d.id, e => ks.has(keyOf(e))); }
  for (let n = 1; n <= 7; n++) add("nhsk" + n, e => hsk3Band(e) === n);
  for (let n = 1; n <= 6; n++) add("hsk" + n, e => e.h === n);
  return keys.size ? out : [];
}
/** One small badge per card the word has: letter, coloured by how it's going, with when it's due. */
function cardBadges(e, nowMs) {
  const base = cardBase(e), out = [];
  for (const t of ["m", "l", "r", "w"]) {
    const c = progress.cards[base + "|" + t];
    if (!c) { if (t === "m") out.push(h("span", { class: "cb cb-new", title: TYPES[t] + ": not started yet" }, CARD_LETTER[t])); continue; }
    const due = SRS.isDue(c, nowMs), learning = SRS.isLearning(c);
    const when = due ? "due now" : "next " + whenText(c[2]);
    out.push(h("span", { class: "cb " + (due ? "cb-due" : learning ? "cb-learning" : c[0] >= 21 ? "cb-known" : "cb-ok"), title: TYPES[t] + ": " + (learning ? "learning, " : "") + when }, CARD_LETTER[t]));
  }
  return h("span", { class: "cbs", "aria-label": out.map(b => b.title).join(". ") }, out);
}
function cardsMatch(e, q) {
  if (!q) return true;
  const plain = Engine.toMarks(e.p).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "").toLowerCase();
  const ql = q.toLowerCase().replace(/\s+/g, "");
  return e.s.includes(q) || (e.t || "").includes(q) || plain.includes(ql) || e.p.toLowerCase().replace(/\s+/g, "").includes(ql) || (e.d || "").toLowerCase().includes(q.toLowerCase());
}
/** Sort the words in My cards (state.sorts.cardsBy); the list arrives newest saved first. */
function sortCards(list, by, nowMs) {
  if (by === "saved") return list;
  const next = e => { let m = Infinity; for (const k of cardKeys(e)) { const c = progress.cards[k]; if (c) m = Math.min(m, SRS.isDue(c, nowMs) ? -1 : c[2]); } return m; };
  const plain = e => Engine.toMarks(e.p).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const hskOf = e => (hsk3Band(e) || 99) * 10 + (e.h || 9);
  const key = new Map(list.map(e => [e, by === "due" ? next(e) : by === "weak" ? strength(e) * 1e9 + Math.min(next(e), 9e8)
    : by === "strong" ? -strength(e) : by === "hsk" ? hskOf(e) : 0]));
  const stable = new Map(list.map((e, i) => [e, i]));
  if (by === "pinyin") { const p = new Map(list.map(e => [e, plain(e)])); return list.sort((a, b) => p.get(a).localeCompare(p.get(b), "en") || stable.get(a) - stable.get(b)); }
  return list.sort((a, b) => key.get(a) - key.get(b) || stable.get(a) - stable.get(b));
}
function viewMyCards() {
  const v = h("section", { class: "view" });
  if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
  const nowMs = clock();
  const saved = savedEntries().sort((a, b) => b.at - a.at).map(x => x.e);
  if (!saved.length) {
    v.append(h("div", { class: "empty" }, "No saved words yet. Tap the star on any word to save it, and its flashcards show up here."));
    return v;
  }
  const decks = savedByDeck(saved);
  if (ui.cardsDeck !== "all" && !decks.some(d => d[0] === ui.cardsDeck)) ui.cardsDeck = "all";
  const inDeck = ui.cardsDeck === "all" ? null : decks.find(d => d[0] === ui.cardsDeck)[2];
  const statusOf = e => {
    if (cardKeys(e).some(k => SRS.isDue(progress.cards[k], nowMs))) return "due";
    return ["new", "learning", "familiar", "known"][strength(e)];
  };
  const pool = saved.filter(e => !inDeck || inDeck.has(keyOf(e)));
  const counts = { all: pool.length, due: 0, new: 0, learning: 0, familiar: 0, known: 0 };
  for (const e of pool) { const st = statusOf(e); counts[st]++; if (st === "due") counts[["new", "learning", "familiar", "known"][strength(e)]]++; }
  const shown = pool.filter(e => (ui.cardsStatus === "all" || (ui.cardsStatus === "due" ? statusOf(e) === "due" : ["new", "learning", "familiar", "known"][strength(e)] === ui.cardsStatus)) && cardsMatch(e, ui.cardsQ.trim()));
  sortCards(shown, sortOf("cardsBy"), nowMs);

  // the overview
  const sc = [0, 0, 0, 0]; saved.forEach(e => sc[strength(e)]++);
  v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("h2", { class: "h-card" }, saved.length + (saved.length === 1 ? " saved word" : " saved words")),
    h("span", { class: "muted small" }, Object.values(progress.cards).length ? countCards(saved) + " cards" : "")),
    strengthBar(sc, saved.length), strengthLegend(sc),
    h("p", { class: "muted small" }, "Each word has a Meaning card (M). Listening (L), Recall (R) and Writing (W) cards join as you get to know it. Colours: blue new, orange learning, filled due, green known.")));

  // find, filter and sort
  const q = h("input", { type: "text", id: "cards-q", placeholder: "Search my cards: 字, pinyin or English", value: ui.cardsQ, "aria-label": "Search my cards", spellcheck: "false", autocomplete: "off" });
  let qt = 0;
  q.addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => { ui.cardsQ = q.value; ui.cardsShow = 100; render(false); const n = $("#cards-q"); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
  const chip = (on, label, n, pick) => h("button", { class: "chip filter-chip", type: "button", "aria-pressed": String(on), onclick: pick }, label, n !== null ? h("span", { class: "muted small num" }, " " + n) : null);
  v.append(h("div", { class: "card stack cards-filters" }, h("h2", { class: "h-card" }, "Find and sort"), q,
    decks.length ? h("div", { class: "stack-tight" }, h("span", { class: "eyebrow" }, "Deck"),
      h("div", { class: "row chips" }, chip(ui.cardsDeck === "all", "All", saved.length, () => { ui.cardsDeck = "all"; ui.cardsShow = 100; render(false); }),
        decks.map(([id, name, ks]) => chip(ui.cardsDeck === id, name, ks.size, () => { ui.cardsDeck = id; ui.cardsShow = 100; render(false); })))) : null,
    h("div", { class: "stack-tight" }, h("span", { class: "eyebrow" }, "Status"),
      h("div", { class: "row chips" }, CARD_FILTERS.map(([k, label]) => chip(ui.cardsStatus === k, label, counts[k], () => { ui.cardsStatus = k; ui.cardsShow = 100; render(false); })))),
    sortSelect("cardsBy", "cards-sort")));

  // the list: one box holding a small box per word
  const list = h("div", { class: "results cards-list" });
  for (const e of shown.slice(0, ui.cardsShow)) {
    const [label, kind] = wordStatus(e, nowMs);
    list.append(h("div", { class: "zrow card-row deck-mini", "data-key": keyOf(e) }, resRow(e),
      h("span", { class: "card-row-side" }, cardBadges(e, nowMs), h("span", { class: "status s-" + kind }, label)), starBtn(e)));
  }
  v.append(h("div", { class: "card stack cards-words" }, h("h2", { class: "h-card" }, shown.length === 1 ? "1 word" : shown.length + " words"),
    shown.length ? list : h("div", { class: "empty" }, "No saved words match."),
    shown.length > ui.cardsShow ? h("button", { class: "btn", type: "button", onclick: () => { ui.cardsShow += 200; render(false); } }, "Show more (" + (shown.length - ui.cardsShow) + " left)") : null));
  return v;
}
const countCards = words => words.reduce((n, e) => n + ["m", "l", "r", "w"].filter(t => progress.cards[cardBase(e) + "|" + t]).length, 0);

/** My Zì: the My cards box. */
function myCardsBox() {
  const saved = ui.dict === "ready" ? savedEntries().map(x => x.e) : [];
  const sc = [0, 0, 0, 0]; saved.forEach(e => sc[strength(e)]++);
  return h("div", { class: "card stack" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "My cards"),
      h("button", { class: "btn", type: "button", onclick: () => go("mycards") }, "See my cards")),
    saved.length ? strengthBar(sc, saved.length) : null,
    h("span", { class: "muted small" }, saved.length ? saved.length + (saved.length === 1 ? " saved word" : " saved words") + " · " + (sc[2] + sc[3]) + " learned" : "Star words to save them; their flashcards collect here."));
}
