/* LearnZì UI, part 4: top bar, navigation, Home, Look up and My Zì. */

function updateTopbar() {
  const lv = levelNow();
  const pill = $("#lvl");
  if (pill) {
    pill.querySelector(".lvl-num").textContent = "Lv " + (mleOn() ? mleLevel().level : lv.level);
    pill.querySelector(".hz").textContent = mleOn() ? "🔥" : "字";
    pill.setAttribute("aria-label", "Zì level " + lv.level + ": " + lv.into + " of " + lv.need + " XP to the next level. Open My Zì");
    pill.title = lv.into + " / " + lv.need + " XP to level " + (lv.level + 1);
    // the XP numbers keep one width for the whole level (room for "need/need"), so gaining XP never resizes the capsule
    pill.style.setProperty("--xpd", String(String((mleOn() ? mleLevel() : lv).need).length));
  }
  xpBarShow(mleOn() ? mleLevel() : lv);
  const badge = $("#clock-badge");
  if (badge) {
    badge.hidden = !clockShift;
    badge.textContent = clockShift ? "+" + shiftText(clockShift) : "";
  }
  const seal = $("#me .seal");
  if (seal) {
    const a = wornAvatar();
    const key = JSON.stringify(a) + avStyle();
    if (seal.dataset.key !== key) { seal.dataset.key = key; seal.classList.add("avatar-mini"); seal.replaceChildren(avatarSvg(a, 50, "Your avatar")); }
  }
  const name = $("#me-name");
  if (name) name.textContent = state.nickname || "LearnZì";
  const me = $("#me");
  if (me) me.setAttribute("aria-label", (state.nickname ? state.nickname + ": " : "") + "your avatar and look: open Customise");
}
function render(animate) {
  const fn = { home: viewHome, lookup: viewLookup, reader: viewReader, photo: viewPhoto, watch: viewWatch, myzi: viewMyZi, mycards: viewMyCards, decks: viewDecks, study: viewStudy, tones: viewTones, me: viewMe, settings: viewSettings, debug: viewDebug, deck: viewDeck, stats: viewStats, grammar: viewGrammar, gpoint: viewGrammarPoint, journey: viewJourney, scrolls: viewScrolls, scroll: viewScroll }[ui.view];
  const v = mleOn() ? (MLE_VIEWS[ui.view] || fn)() : fn();
  if (FOLD_VIEWS.includes(ui.view)) foldify(v, ui.view, ":scope > .card", !OPEN_VIEWS.includes(ui.view));
  const head = pageHead(ui.view, v);
  if (head) v.prepend(head);
  if (animate) v.classList.add("enter");
  $("#view").replaceChildren(v);
  markNav();
  $("#gear").setAttribute("aria-pressed", String(ui.view === "settings" || ui.view === "debug"));
  if (ui.view === "deck") afterDeck();
  updateTopbar();
}
function go(view) {
  if (!VIEWS.includes(view)) view = "home";
  ui.view = view;
  try { history.replaceState(null, "", "#" + view); } catch { /* not allowed here: fine */ }
  render(true);
  if (!ui.highlight) window.scrollTo({ top: 0 });
  if (view === "lookup") { const q = $("#q"); if (q && window.matchMedia("(pointer: fine)").matches) q.focus(); }
}

// ---------- Home ----------
function viewHome() {
  const v = h("section", { class: "view" });
  v.append(greetingBox(), clockBox());
  if (ui.dict === "ready") {
    const plan = studyPlan();
    const ready = plan.due.length + plan.fresh.length;
    v.append(h("div", { class: "card study-prompt" }, h("span", { class: "eyebrow" }, "Today's flashcards"),
      h("div", { class: "row sp-main" }, goalRing(),
        h("div", { class: "stack-tight" },
          h("b", null, ready ? ready + (ready === 1 ? " card ready" : " cards ready") : "All caught up"),
          h("span", { class: "muted small" }, [goalText(), streak() ? streak() + "-day streak" : state.dailyGoal ? "reach it to start a streak" : "Study today to start a streak"].filter(Boolean).join(" · ")))),
      ready ? h("button", { class: "btn primary", type: "button", onclick: () => startStudy() }, "Review") : null));
  }
  if (ui.dict === "ready") {
    const w = Engine.wordOfDay(undefined, (LEVELS[state.level] || LEVELS.new).hsk);
    if (w) {
      v.append(h("div", { class: "card wotd" }, h("span", { class: "eyebrow" }, "Word of the day · HSK " + (LEVELS[state.level] || LEVELS.new).hsk),
        h("button", { class: "glyph" + ([...w.s].length > 1 ? " long" : ""), type: "button", "aria-label": "Open the word of the day", onclick: () => openWord(w.s, w) }, rubyHz(disp(w), w.p)),
        h("div", { class: "wotd-body" },
          h("span", { class: "wotd-def" }, shortDef(w, 3)),
          h("div", { class: "row" },
            withVoice(h("button", { class: "btn", type: "button", onclick: () => speak(w.s, w.p) }, icon("play"), "Listen"), { text: w.s, p: w.p }),
            starBtn(w)))));
    }
  } else v.append(h("div", { class: "card" }, loadingBlock()));

  if (ui.dict === "ready") { v.append(dailyBox(), grammarDayBox(), decksBox()); const jbox = journeyHomeBox(); if (jbox) v.append(jbox); }
  // Recent lookups, above the shortcuts (shown from the start, with a hint until you've looked something up)
  if (ui.dict === "ready") {
    const recent = state.recent.slice(0, 10).map(s => [s, Engine.lookup(s)[0]]).filter(([, e]) => e);
    v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "Recent lookups"),
      recent.length ? h("div", { class: "row chips" }, recent.map(([s, e]) => h("button", { class: "chip", type: "button", onclick: () => openWord(s) }, rubyHz(disp(e), e.p))))
        : h("p", { class: "muted small" }, "Words you look up appear here.")));
  }
  const action = (title, sub, onclick) => h("button", { class: "action", type: "button", onclick }, h("b", null, title), h("span", { class: "muted small" }, sub));
  v.append(h("div", { class: "actions" },
    action("Look up a word", "Type characters, pinyin or English", () => go("lookup")),
    action("Read a text", "Paste or import Chinese, then tap any word", () => go("reader")),
    action("Tone trainer", "Hear a word, pick its tones", () => { drill.active = false; go("tones"); }),
    action("My Zì", "Decks, flashcards and progress · Zì level " + levelNow().level, () => go("myzi"))));

  return v;
}

// ---------- Look up ----------
let searchTimer = 0;
function viewLookup() {
  const v = h("section", { class: "view" });
  const input = h("input", {
    id: "q", type: "search", placeholder: "你好, nihao or hello", autocomplete: "off", autocapitalize: "off",
    spellcheck: "false", enterkeyhint: "search", "aria-label": "Search the dictionary",
  });
  input.value = ui.query;
  const results = h("div", { class: "results", id: "results" });
  input.addEventListener("input", () => {
    ui.query = input.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => fillResults(results), 140);
  });
  input.addEventListener("keydown", ev => {
    if (ev.key === "Enter") { clearTimeout(searchTimer); fillResults(results); const first = results.querySelector(".res"); if (first) first.click(); }
  });
  v.append(h("div", { class: "card search-row" },
    h("div", { class: "search", role: "search" }, h("span", { class: "mag" }, icon("search")), input),
    h("button", { class: "btn icon photo-go", type: "button", title: "Photo to words: read Chinese in a photo", "aria-label": "Photo to words", onclick: () => go("photo") }, icon("camera")),
    h("button", { class: "btn random", type: "button", title: "Look up a random common word", onclick: randomWord }, icon("dice"), h("span", { class: "random-label" }, "Random"))));
  v.append(h("p", { class: "muted small hint" }, "Search by characters (simplified or traditional), pinyin with or without tones (ni3hao3, nǐ hǎo, nihao) or English."));
  v.append(results);
  fillResults(results);
  return v;
}
function resRow(e, tag, boxed) {
  // boxed: true = its own box (search results), "mini" = a small box inside a bigger one (Recent lookups)
  return h(tag || "button", { class: "res" + (boxed === "mini" ? " deck-mini" : boxed ? " card" : ""), type: tag ? null : "button", onclick: () => openWord(e.s, e) },
    rubyHz(disp(e), e.p),
    h("span", { class: "meta" }, h("span", { class: "def" }, shortDef(e, 3))),
    hskBadges(e, true)[0] || h("span"));
}
function fillResults(box) {
  box.replaceChildren();
  if (ui.dict !== "ready") { box.append(loadingBlock()); return; }
  const q = ui.query.trim();
  if (!q) {
    const recent = state.recent.map(s => Engine.lookup(s)[0]).filter(Boolean);
    const card = h("div", { class: "card stack lookup-group lookup-recent" }, h("h2", { class: "h-card" }, "Recent lookups"),
      recent.length ? h("div", { class: "results" }, recent.map(e => resRow(e, null, "mini"))) : h("div", { class: "empty" }, "Words you look up appear here."));
    box.append(card);
    foldify(box, "lookup", ":scope > .card, :scope > .lookup-group");
    return;
  }
  const groups = Engine.search(q);
  const parts = phraseParts(q);
  if (!groups.length && !parts) { box.append(h("div", { class: "empty" }, "No matches for “" + q + "”. Try fewer letters, or check the spelling.")); return; }
  if (parts) box.append(phraseRow(parts, groups.length > 0));
  // Every result is its own box; each group has a title bar that folds and moves like other boxes.
  for (const g of groups) {
    box.append(h("div", { class: "stack lookup-group", "data-keep": "" }, h("h2", { class: "h-card" }, g.title),
      h("div", { class: "results" }, g.items.slice(0, 40).map(e => resRow(e, null, true)))));
  }
  foldify(box, "lookup", ":scope > .card, :scope > .lookup-group");
}

// ---------- Look up extras: a random word, and English phrases word by word ----------
let commonPool = null;
function randomWord() {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (!commonPool) commonPool = [1, 2, 3, 4, 5, 6].flatMap(l => Engine.hskWords(l)).filter(e => !/^(variant of|old variant|see |surname )/i.test(e.d));
  // Easier levels come up more often: HSK 1–2 words are entered several times.
  const pick = () => commonPool[Math.floor(Math.random() * commonPool.length)];
  let e = pick();
  for (let i = 0; i < 2 && e.h > 2; i++) e = pick();
  openWord(e.s, e);
}
const PHRASE_SKIP = new Set(["a", "an", "the", "to", "of", "please"]);
/** For an English phrase of 2–6 words, the best single Chinese word for each English word. */
function phraseParts(q) {
  if (Engine.isCJK(q) || /\d/.test(q)) return null;
  const words = q.toLowerCase().replace(/[^a-z' ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return null;
  const parts = [];
  for (const w of words) {
    if (PHRASE_SKIP.has(w)) continue;
    const groups = Engine.search(w);
    const g = groups.find(x => x.title === "English") || null;
    parts.push({ w, e: g ? g.items[0] : null });
  }
  return parts.filter(p => p.e).length >= 2 ? parts : null;
}
function phraseRow(parts, hasExact) {
  const found = parts.filter(p => p.e);
  const joined = found.map(p => disp(p.e)).join("");
  return h("div", { class: "card phrase", "data-keep": "" },
    h("div", { class: "row spread" },
      h("span", { class: "eyebrow" }, "Word by word"),
      withVoice(h("button", { class: "btn icon", type: "button", "aria-label": "Listen to " + joined, onclick: () => speak(found.map(p => p.e.s).join("")) }, icon("play")), { text: found.map(p => p.e.s).join(""), compact: true })),
    h("div", { class: "row chips" }, parts.map(p => p.e
      ? h("button", { class: "chip phrase-chip", type: "button", onclick: () => openWord(p.e.s, p.e) },
        h("span", { class: "muted small" }, p.w), rubyHz(disp(p.e), p.e.p))
      : h("span", { class: "chip phrase-chip missing" }, h("span", { class: "muted small" }, p.w), "?"))),
    h("p", { class: "muted small" }, hasExact
      ? "Each word on its own. The matches below are whole words or set phrases from the dictionary."
      : "Each word on its own, not a full translation. Chinese word order is often the same as English for short phrases like this."));
}
