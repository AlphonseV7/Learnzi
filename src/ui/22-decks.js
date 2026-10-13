/* LearnZì UI, part 3b: decks. One memory per word: a word's flashcards are shared by every deck
 * it appears in, so nothing is ever reviewed twice. Built-in decks: Starred (your starred words),
 * Welcome (first words), HSK 3.0 bands 1–7 (the 2025 syllabus; band 7 covers levels 7–9) and the older
 * HSK 2.0 levels 1–6. Your own decks are each synced as their own document (see 10-sync). */

const WELCOME = [
  ["你好", "ni3 hao3"], ["谢谢", "xie4 xie5"], ["不客气", "bu4 ke4 qi5"], ["对不起", "dui4 bu5 qi3"], ["没关系", "mei2 guan1 xi5"], ["再见", "zai4 jian4"], ["请", "qing3"],
  ["我", "wo3"], ["你", "ni3"], ["他", "ta1"], ["她", "ta1"], ["我们", "wo3 men5"], ["人", "ren2"], ["朋友", "peng2 you5"], ["老师", "lao3 shi1"], ["学生", "xue2 sheng5"],
  ["爸爸", "ba4 ba5"], ["妈妈", "ma1 ma5"], ["家", "jia1"],
  ["一", "yi1"], ["二", "er4"], ["三", "san1"], ["四", "si4"], ["五", "wu3"], ["六", "liu4"], ["七", "qi1"], ["八", "ba1"], ["九", "jiu3"], ["十", "shi2"],
  ["是", "shi4"], ["不", "bu4"], ["好", "hao3"], ["很", "hen3"], ["有", "you3"], ["没有", "mei2 you3"], ["大", "da4"], ["小", "xiao3"],
  ["吃", "chi1"], ["喝", "he1"], ["水", "shui3"], ["茶", "cha2"], ["米饭", "mi3 fan4"], ["好吃", "hao3 chi1"],
  ["今天", "jin1 tian1"], ["明天", "ming2 tian1"], ["昨天", "zuo2 tian1"], ["现在", "xian4 zai4"],
  ["喜欢", "xi3 huan5"], ["想", "xiang3"], ["去", "qu4"], ["中国", "Zhong1 guo2"], ["中文", "Zhong1 wen2"],
  ["什么", "shen2 me5"], ["谁", "shei2"], ["哪儿", "na3 r5"], ["吗", "ma5"], ["几", "ji3"], ["多少", "duo1 shao5"],
];
const BUILTIN = {
  starred: { name: "Starred", zh: "收藏", note: "Every word you star" },
  welcome: { name: "Welcome", zh: "入门", note: "58 first words: greetings, people, numbers, food, time and questions" },
  hsk1: { name: "HSK 2.0 · 1", zh: "一级", note: "The older HSK list (2010 syllabus), level 1", hsk: 1 },
  hsk2: { name: "HSK 2.0 · 2", zh: "二级", note: "The older HSK list (2010 syllabus), level 2", hsk: 2 },
  hsk3: { name: "HSK 2.0 · 3", zh: "三级", note: "The older HSK list (2010 syllabus), level 3", hsk: 3 },
  hsk4: { name: "HSK 2.0 · 4", zh: "四级", note: "The older HSK list (2010 syllabus), level 4", hsk: 4 },
  hsk5: { name: "HSK 2.0 · 5", zh: "五级", note: "The older HSK list (2010 syllabus), level 5", hsk: 5 },
  hsk6: { name: "HSK 2.0 · 6", zh: "六级", note: "The older HSK list (2010 syllabus), level 6", hsk: 6 },
};
// HSK 3.0, the 2025 syllabus: bands 1–7 (band 7 covers levels 7–9). Word list by HearMandarin
// (hearmandarin.com, CC BY 4.0), matched to the dictionary by tools/build_hsk3.py and loaded, packed,
// with the dictionary (hsk3.txt: band, simplified, pinyin).
const HSK3_IDS = [1, 2, 3, 4, 5, 6, 7].map(n => "nhsk" + n);
const HSK3_ZH = ["", "新一级", "新二级", "新三级", "新四级", "新五级", "新六级", "新七至九级"];
const bandLabel = n => (n === 7 ? "7–9" : String(n));
const HSK3 = { bands: null, byKey: new Map() };
HSK3_IDS.forEach((id, i) => {
  BUILTIN[id] = { name: "HSK 3.0 · " + bandLabel(i + 1), zh: HSK3_ZH[i + 1], note: "The new HSK (2025 syllabus), " + (i === 6 ? "levels 7–9" : "band " + (i + 1)), hsk3: i + 1 };
});
/** After the dictionary loads: the HSK 3.0 words, each matched to its dictionary entry. */
function hsk3Ready(text) {
  const bands = [[], [], [], [], [], [], [], []];
  for (const line of String(text || "").split("\n")) {
    const [b, s, p] = line.split("\t"), n = Number(b);
    if (!(n >= 1 && n <= 7) || !s || !p) continue;
    const e = Engine.lookup(s).find(x => x.p === p);
    if (e && !HSK3.byKey.has(keyOf(e))) { HSK3.byKey.set(keyOf(e), n); bands[n].push(e); }
  }
  HSK3.bands = bands;
  for (const id of HSK3_IDS) deckCache.delete(id);
}
/** A word's HSK 3.0 band (0 if it isn't on the list). */
const hsk3Band = e => HSK3.byKey.get(keyOf(e)) || 0;
/** Every deck, in the order the deck lists show them. */
const allDeckIds = () => ["starred", "welcome", ...state.decks.map(d => d.id), ...HSK3_IDS, "hsk1", "hsk2", "hsk3", "hsk4", "hsk5", "hsk6"];
/** HSK badges for a word: its HSK 3.0 band and its older HSK 2.0 level; `one` shows just the newer. */
function hskBadges(e, one) {
  const n = hsk3Band(e), out = [];
  if (n) out.push(h("span", { class: "badge hsk", title: "HSK 3.0 (2025 syllabus)" + (n === 7 ? ", levels 7–9" : ", band " + n) }, "HSK 3.0 · " + bandLabel(n)));
  if (e.h && (!one || !n)) out.push(h("span", { class: "badge hsk old", title: "The older HSK 2.0 list, level " + e.h }, "HSK 2.0 · " + e.h));
  return out;
}

const deckCache = new Map();
const resolve = (s, p) => { const list = Engine.lookup(s); return list.find(e => e.p === p) || list[0] || null; };
/** The words in a deck, in learning order. */
function deckWords(id) {
  if (id === "starred") return savedEntries().sort((a, b) => a.at - b.at).map(x => x.e);
  if (BUILTIN[id]?.hsk3) return HSK3.bands ? HSK3.bands[BUILTIN[id].hsk3] : [];
  if (id === "welcome" || BUILTIN[id]?.hsk) {
    if (!deckCache.has(id)) {
      let words;
      if (id === "welcome") words = WELCOME.map(([s, p]) => resolve(s, p)).filter(Boolean);
      else {
        const seen = new Set();
        words = Engine.hskWords(BUILTIN[id].hsk).filter(e => !seen.has(e.s) && seen.add(e.s));
      }
      deckCache.set(id, words);
    }
    return deckCache.get(id);
  }
  const d = state.decks.find(x => x.id === id);
  return d ? d.words.map(w => resolve(w.s, w.p)).filter(Boolean) : [];
}
const deckName = id => (BUILTIN[id] ? BUILTIN[id].name : (state.decks.find(x => x.id === id) || {}).name || "Deck");
const deckExists = id => !!BUILTIN[id] || state.decks.some(x => x.id === id);
const isActive = id => state.activeDecks.includes(id);
function setActive(id, on) {
  const list = state.activeDecks.filter(x => x !== id);
  if (on) list.push(id);
  commit({ activeDecks: list });
}
/** Every word in the decks you're studying, each once (starred first). */
function activeWords() {
  const out = [], seen = new Set();
  const order = ["starred", ...state.activeDecks.filter(x => x !== "starred")];
  for (const id of order) {
    if (!isActive(id) || !deckExists(id)) continue;
    for (const e of deckWords(id)) { const k = keyOf(e); if (!seen.has(k)) { seen.add(k); out.push(e); } }
  }
  return out;
}
/** How well a word is known, from its Meaning card: 0 new, 1 learning, 2 familiar, 3 known. */
function strength(e) {
  const c = progress.cards[keyOf(e) + "|m"];
  if (!c) return 0;
  if (SRS.isLearning(c)) return 1;
  return c[0] >= 21 ? 3 : 2;
}
const STRENGTH = ["New", "Learning", "Familiar", "Known"];
function deckSummary(id, nowMs = clock()) {
  const words = deckWords(id);
  const counts = [0, 0, 0, 0];
  let due = 0;
  for (const e of words) {
    counts[strength(e)]++;
    for (const k of cardKeys(e)) if (SRS.isDue(progress.cards[k], nowMs)) due++;
  }
  return { total: words.length, counts, due };
}
/** A thin bar showing New / Learning / Familiar / Known as shades of the accent colour. */
function strengthBar(counts, total) {
  const bar = h("div", { class: "sbar", role: "img", "aria-label": STRENGTH.map((n, i) => counts[i] + " " + n.toLowerCase()).join(", ") });
  if (!total) { bar.classList.add("empty"); return bar; }
  [3, 2, 1, 0].forEach(i => {
    if (!counts[i]) return;
    const seg = h("i", { class: "s" + i, title: counts[i] + " " + STRENGTH[i].toLowerCase() });
    seg.style.flexGrow = String(counts[i]);
    bar.append(seg);
  });
  return bar;
}
function strengthLegend(counts) {
  return h("div", { class: "row slegend" }, [3, 2, 1, 0].map(i => h("span", { class: "small" }, h("i", { class: "s" + i }), STRENGTH[i] + " " + counts[i])));
}

// ---------- your own decks ----------
function newDeckId() { return "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function createDeck(name) {
  const n = cleanLine(name, 40);
  if (!n) { toast("Give the deck a name first."); return null; }
  if (state.decks.length >= 50) { toast("You can have up to 50 decks."); return null; }
  const d = { id: newDeckId(), name: n, words: [], at: Date.now() };
  commit({ decks: [...state.decks, d], activeDecks: [...state.activeDecks, d.id] });
  checkBadges();
  return d;
}
function updateDeck(id, fn) {
  commit({ decks: state.decks.map(d => (d.id === id ? fn({ ...d, words: [...d.words] }) : d)) });
}
const inDeck = (id, e) => (id === "starred" ? isSaved(e) : (state.decks.find(d => d.id === id) || { words: [] }).words.some(w => w.s === e.s && w.p === e.p));
function toggleInDeck(id, e) {
  if (id === "starred") { toggleSave(e); return; }
  const had = inDeck(id, e);
  updateDeck(id, d => { d.words = had ? d.words.filter(w => !(w.s === e.s && w.p === e.p)) : [...d.words, { s: e.s, p: e.p }].slice(0, 3000); return d; });
  toast((had ? "Removed " + disp(e) + " from " : "Added " + disp(e) + " to ") + deckName(id));
}

/** In the word panel: tick which of your decks a word belongs to, or make a new deck. */
function deckPicker(e) {
  const box = h("div", { class: "deck-picker" });
  box.append(h("span", { class: "eyebrow" }, "Add to a deck"));
  for (const id of ["starred", ...state.decks.map(d => d.id)]) {
    const cb = h("input", { type: "checkbox", id: "dk-" + id });
    cb.checked = inDeck(id, e);
    cb.addEventListener("change", () => { toggleInDeck(id, e); renderPanel(true); });
    box.append(h("label", { class: "deck-pick", for: "dk-" + id }, cb, h("span", null, deckName(id))));
  }
  const name = h("input", { type: "text", id: "new-deck-name", maxlength: "40", placeholder: "New deck name" });
  const make = () => { const d = createDeck(name.value); if (d) { toggleInDeck(d.id, e); renderPanel(true); } };
  name.addEventListener("keydown", ev => { if (ev.key === "Enter") make(); });
  box.append(h("div", { class: "row" }, name, h("button", { class: "btn", type: "button", onclick: make }, "Create")));
  return box;
}
