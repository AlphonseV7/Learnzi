/* LearnZì UI, part 5b: My Zì (decks hub), a single deck, and the Decks box on Home. */

function studyCard(deckId, withLevel = !deckId) {
  const lv = levelNow();
  const plan = studyPlan(clock(), deckId);
  const ready = plan.due.length + plan.fresh.length;
  const box = h("div", { class: "card study-card" });
  if (withLevel) box.append(levelBar(lv));
  box.append(h("div", { class: "stats" },
    stat(plan.due.length, "due"),
    stat(plan.fresh.length, plan.fresh.length === 1 ? "new card" : "new cards"),
    deckId ? stat(deckWords(deckId).length, "words") : stat(streak(), "day streak"),
    deckId ? null : stat(getAct()[1], "reviewed today")));
  if (ready) {
    box.append(h("button", { class: "btn primary big-btn", type: "button", onclick: () => startStudy(deckId) },
      (deckId ? "Study this deck · " : "Study all decks · ") + ready + (ready === 1 ? " card" : " cards")));
  } else {
    box.append(h("p", { class: "muted" }, "All caught up." + (plan.nextDue < Infinity ? " Next review " + whenText(plan.nextDue) + "." : "")
      + (plan.freshWaiting && !plan.fresh.length ? " New cards resume tomorrow (" + state.newPerDay + " a day, change it in Settings)." : "")));
  }
  return box;
}
function openDeck(id) { ui.deckId = id; ui.deckShow = 100; go("deck"); }
function deckItem(id) {
  const sum = deckSummary(id);
  const b = BUILTIN[id];
  const row = h("button", { class: "deck-row", type: "button", onclick: () => openDeck(id) },
    h("div", { class: "row spread" },
      h("div", { class: "deck-title" }, h("b", null, deckName(id)), b ? h("span", { class: "hz muted" }, b.zh) : null),
      sum.due ? h("span", { class: "status s-due" }, sum.due + " due") : null),
    strengthBar(sum.counts, sum.total),
    h("span", { class: "muted small" }, sum.total + (sum.total === 1 ? " word" : " words") + " · " + (sum.counts[2] + sum.counts[3]) + " learned"));
  if (isActive(id)) return h("div", { class: "deck-item" }, row);
  return h("div", { class: "deck-item" }, row,
    h("button", { class: "btn", type: "button", onclick: () => { setActive(id, true); toast(deckName(id) + " added to your daily study"); render(false); } }, "Start"));
}

/** My Zì: me. My avatar and level, today's numbers, my cards, my decks and my progress. */
function viewMyZi() {
  const v = h("section", { class: "view" });
  if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
  const a = wornAvatar(), lv = levelNow();
  v.append(h("div", { class: "card me-card" },
    h("button", { class: "me-card-avatar plain-btn", type: "button", "aria-label": "Edit my avatar", onclick: () => { ui.meTab = "avatar"; go("me"); } }, liveAvatar(96, "My avatar")),
    h("div", { class: "stack-tight me-card-info" },
      h("div", { class: "row spread" },
        h("b", { class: "me-card-name" }, state.nickname || "Me"),
        h("button", { class: "btn small", type: "button", onclick: () => { ui.meTab = "avatar"; go("me"); } }, "Edit")),
      h("span", { class: "muted small" }, AV.animal[a.animal].label + " · tap to dress up"),
      levelBar(lv))));
  v.append(studyCard(null, false));
  v.append(myCardsBox());
  v.append(decksBox("My decks"));
  v.append(badgesBox());
  v.append(progressPreview());
  return v;
}

/** A "Sort" menu remembered in state.sorts[key]. */
function sortSelect(key, id) {
  const sel = h("select", { id, "aria-label": "Sort" });
  for (const [k, label] of SORTS[key]) { const o = h("option", { value: k }, label); if (k === sortOf(key)) o.selected = true; sel.append(o); }
  sel.addEventListener("change", () => { commit({ sorts: { ...state.sorts, [key]: sel.value } }); render(false); const n = $("#" + id); if (n) n.focus(); });
  return h("label", { class: "row sort-pick" }, h("span", { class: "eyebrow" }, "Sort"), sel);
}
const deckKind = id => (/^u/.test(id) ? "mine" : /^nhsk/.test(id) ? "hsk3" : /^hsk/.test(id) ? "hsk2" : "other");
/** My decks: progress across the decks you're studying (each word counted once) and the week ahead. */
function decksProgressBox() {
  const words = activeWords(), counts = [0, 0, 0, 0];
  for (const e of words) counts[strength(e)]++;
  const learned = counts[2] + counts[3];
  return h("div", { class: "card stack decks-progress" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Progress"),
      h("button", { class: "btn", type: "button", onclick: () => go("stats") }, "See all stats")),
    h("div", { class: "stats" },
      stat(words.length, words.length === 1 ? "word studying" : "words studying"),
      stat(learned, "learned"),
      stat((words.length ? Math.round(learned / words.length * 100) : 0) + "%", "of them learned")),
    strengthBar(counts, words.length), strengthLegend(counts),
    h("span", { class: "eyebrow" }, "Coming up this week"),
    forecastChart(7, "No reviews coming up yet. Once you've studied some cards, this shows how many come back each day."));
}
/** Study → My decks: every deck, the ones you're studying first; show some kinds and sort them. */
function viewDecks() {
  const v = h("section", { class: "view" });
  if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
  v.append(studyCard(null, false));
  v.append(decksProgressBox());

  // show and sort
  const show = sortOf("decksShow"), by = sortOf("decksBy");
  const all = allDeckIds();
  const n = k => all.filter(id => k === "all" || deckKind(id) === k).length;
  v.append(h("div", { class: "card stack decks-tools" }, h("h2", { class: "h-card" }, "Show and sort"),
    h("div", { class: "row chips" }, SORTS.decksShow.map(([k, label]) =>
      h("button", { class: "chip filter-chip", type: "button", "aria-pressed": String(show === k), onclick: () => { commit({ sorts: { ...state.sorts, decksShow: k } }); render(false); } },
        label, h("span", { class: "muted small num" }, " " + n(k))))),
    sortSelect("decksBy", "decks-sort")));

  const sums = new Map();
  const sum = id => { if (!sums.has(id)) sums.set(id, deckSummary(id)); return sums.get(id); };
  const pct = id => { const s = sum(id); return s.total ? (s.counts[2] + s.counts[3]) / s.total : 0; };
  const sorters = {
    name: (a, b) => deckName(a).localeCompare(deckName(b), "en", { numeric: true }),
    due: (a, b) => sum(b).due - sum(a).due,
    least: (a, b) => pct(a) - pct(b),
    most: (a, b) => pct(b) - pct(a),
    size: (a, b) => sum(b).total - sum(a).total,
  };
  const pick = ids => { const out = ids.filter(id => show === "all" || deckKind(id) === show); return sorters[by] ? out.sort(sorters[by]) : out; };
  const studying = pick(all.filter(isActive)), others = pick(all.filter(id => !isActive(id)));
  const what = show === "all" ? "" : " " + SORTS.decksShow.find(x => x[0] === show)[1];
  const form = h("div", { class: "row new-deck", hidden: true });
  const name = h("input", { type: "text", id: "deck-name", maxlength: "40", placeholder: "Deck name, e.g. Food" });
  const make = () => { const d = createDeck(name.value); if (d) { toast("Created " + d.name + ". Add words from any word's Deck button."); render(false); } };
  name.addEventListener("keydown", ev => { if (ev.key === "Enter") make(); });
  form.append(name, h("button", { class: "btn primary", type: "button", onclick: make }, "Create"));
  v.append(h("div", { class: "card stack" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Studying"),
      h("button", { class: "btn", type: "button", onclick: () => { form.hidden = !form.hidden; if (!form.hidden) name.focus(); } }, "+ New deck")),
    form,
    studying.length ? h("div", { class: "decks" }, studying.map(deckItem))
      : h("div", { class: "empty" }, show === "all" ? "You're not studying any decks. Start one below." : "You're not studying any" + what + " decks.")));
  if (others.length || show !== "all") {
    v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, "More decks"),
      others.length ? h("div", { class: "decks" }, others.map(deckItem))
        : h("div", { class: "empty" }, show === "mine" ? "No other decks of your own. Make one with + New deck." : "No more" + what + " decks.")));
  }
  return v;
}

function viewDeck() {
  const id = ui.deckId;
  const v = h("section", { class: "view" });
  if (!id || !deckExists(id)) { setTimeout(() => go("decks"), 0); return v; }
  if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
  const b = BUILTIN[id];
  const user = state.decks.find(d => d.id === id);
  const sum = deckSummary(id);
  v.append(h("div", { class: "card stack" }, strengthBar(sum.counts, sum.total), strengthLegend(sum.counts)));
  v.append(studyCard(id));

  const daily = h("input", { type: "checkbox", id: "deck-daily", role: "switch" });
  daily.checked = isActive(id);
  daily.addEventListener("change", () => { setActive(id, daily.checked); toast(daily.checked ? "Included in daily study" : "Left out of daily study"); });
  const tools = h("div", { class: "card set" },
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "deck-daily" }, "Include in daily study"),
      h("span", { class: "muted small" }, "Its cards appear when you study all decks")), h("span", { class: "toggle" }, daily, h("span"))));
  if (user) {
    const rename = h("input", { type: "text", id: "deck-rename", maxlength: "40" });
    rename.value = user.name;
    rename.addEventListener("change", () => { const n = cleanLine(rename.value, 40); if (n) { updateDeck(id, d => { d.name = n; return d; }); toast("Renamed to " + n); } });
    tools.append(h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "deck-rename" }, "Name")), rename),
      h("div", { class: "row" }, confirmBtn("Delete deck", "Tap again to delete " + user.name, () => {
        commit({ decks: state.decks.filter(d => d.id !== id), activeDecks: state.activeDecks.filter(x => x !== id) });
        toast("Deleted " + user.name + ". Its words keep their progress.");
        go("decks");
      })));
  }
  v.append(tools);

  // The words
  let words = deckWords(id).slice();
  if (id === "starred") {
    const at = new Map(state.saved.map(x => [x.s + "|" + x.p, x.at]));
    const sorters = {
      new: (a, b) => (at.get(keyOf(b)) || 0) - (at.get(keyOf(a)) || 0),
      hsk: (a, b) => (a.h || 9) - (b.h || 9),
      abc: (a, b) => Engine.toMarks(a.p).localeCompare(Engine.toMarks(b.p), "en", { sensitivity: "base" }),
    };
    words.sort(sorters[ui.myziSort] || sorters.new);
  }
  const head = h("div", { class: "row spread" }, h("h2", { class: "h-card" }, words.length === 1 ? "1 word" : words.length + " words"));
  if (id === "starred" && words.length > 1) {
    const seg = h("div", { class: "seg", role: "group", "aria-label": "Sort" });
    for (const [k, label] of [["new", "Newest"], ["hsk", "HSK"], ["abc", "A–Z"]]) {
      seg.append(h("button", { type: "button", "aria-pressed": String((ui.myziSort || "new") === k), onclick: () => { ui.myziSort = k; render(false); } }, label));
    }
    head.append(seg);
  }
  v.append(head);
  if (!words.length) {
    v.append(h("div", { class: "empty" }, id === "starred" ? "Tap the star on any word to add it here." : "No words yet. Open any word and use its Deck button to add it here."));
    return v;
  }
  const list = h("div", { class: "results" });
  for (const e of words.slice(0, ui.deckShow || 100)) {
    const [label, kind] = wordStatus(e);
    list.append(h("div", { class: "zrow", "data-key": keyOf(e) }, resRow(e), h("span", { class: "status s-" + kind }, label),
      user ? h("button", { class: "btn icon", type: "button", "aria-label": "Remove " + disp(e) + " from this deck", title: "Remove from this deck",
        onclick: () => { toggleInDeck(id, e); render(false); } }, icon("close")) : starBtn(e)));
  }
  v.append(list);
  if (words.length > (ui.deckShow || 100)) {
    v.append(h("button", { class: "btn", type: "button", onclick: () => { ui.deckShow = (ui.deckShow || 100) + 200; render(false); } },
      "Show more (" + (words.length - (ui.deckShow || 100)) + " left)"));
  }
  return v;
}
function afterDeck() {
  if (!ui.highlight) return;
  const key = ui.highlight;
  ui.highlight = null;
  const row = [...document.querySelectorAll(".zrow")].find(r => r.dataset.key === key);
  if (row) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); }
}

/** Home: the decks you're studying, each with its progress bar. */
/** label: "Your decks" on Home, "My decks" on My Zì. */
function decksBox(label = "Your decks") {
  const ids = allDeckIds().filter(isActive);
  const box = h("div", { class: "card stack" },
    label === "My decks" ? h("h2", { class: "h-card" }, label) : h("span", { class: "eyebrow" }, label),
    h("div", { class: "row" }, h("button", { class: "btn small", type: "button", onclick: () => go("decks") }, "All decks", icon("next"))));
  if (!ids.length) { box.append(h("p", { class: "muted" }, "No decks yet. Open Study → My decks to start one.")); return box; }
  for (const id of ids.slice(0, 4)) {
    const sum = deckSummary(id);
    box.append(h("button", { class: "deck-mini", type: "button", onclick: () => openDeck(id) },
      h("b", { class: "dm-name" }, deckName(id)),
      h("span", { class: "muted small dm-sum" }, (sum.counts[2] + sum.counts[3]) + " / " + sum.total + " learned" + (sum.due ? " · " + sum.due + " due" : "")),
      strengthBar(sum.counts, sum.total)));
  }
  return box;
}
