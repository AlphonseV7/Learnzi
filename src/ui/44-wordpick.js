/* LearnZì UI, part 6: "Make flashcards" — the tick list of words used by Photo to words and Watch.
 * Words already in a deck start unticked. Make a new deck, or add them to one of yours.
 * Watch also saves, for each word, the line and time it came from in the video (see clipBlock in 47-watch.js),
 * so its flashcard can play that moment as a bonus when the video is open on this device. */

/** A built-in sample (published with the app in samples/), as a File, for trying Photo to words and Watch. */
async function sampleFile(path, name, type) {
  try {
    const res = await fetch(new URL("samples/" + path, document.baseURI).href);
    if (!res.ok) throw new Error(res.status);
    return new File([await res.blob()], name, { type });
  } catch { toast("Couldn't load the sample. Check your connection."); return null; }
}
const inAnyDeck = e => isSaved(e) || state.decks.some(d => d.words.some(w => w.s === e.s && w.p === e.p));

/** The card. holder.picked keeps the ticks between redraws.
 *  opts: { id, words, holder, name (default deck name), what ("this photo"), clip(e) → {v: [start, end], x: line} | null, video: {name, size} | null } */
function wordDeckCard(opts) {
  const { id, words, holder } = opts;
  if (!holder.picked) holder.picked = new Set(words.filter(e => !inAnyDeck(e)).map(keyOf));
  const count = h("span", { class: "muted small" });
  const list = h("div", { class: "photo-words" });
  const make = h("button", { class: "btn primary", type: "button" }, "Make deck");
  const add = h("button", { class: "btn", type: "button" }, "Add");
  const sync = () => {
    const n = holder.picked.size;
    count.textContent = n + " of " + words.length + " ticked";
    make.disabled = add.disabled = !n;
  };
  words.forEach((e, i) => {
    const k = keyOf(e), cid = id + "-w" + i;
    const cb = h("input", { type: "checkbox", id: cid });
    cb.checked = holder.picked.has(k);
    const st = strength(e), clip = opts.clip ? opts.clip(e) : null;
    const row = h("div", { class: "photo-word" + (cb.checked ? "" : " off") },
      cb,
      h("label", { for: cid, class: "pw-main" }, rubyHz(disp(e), e.p), h("span", { class: "def small" }, shortDef(e, 2))),
      h("span", { class: "pw-tags" },
        clip ? h("span", { class: "badge pw-time num", title: "Where it's said in the video" }, fmtTime(clip.v[0])) : null,
        e.h ? h("span", { class: "badge hsk" }, "HSK " + e.h) : null,
        inAnyDeck(e) ? h("span", { class: "badge" }, "In a deck") : st === 3 ? h("span", { class: "badge" }, "Known") : null),
      h("button", { class: "btn icon small", type: "button", "aria-label": "Open " + disp(e), title: "Open this word", onclick: () => openWord(e.s, e) }, icon("next")));
    cb.addEventListener("change", () => { if (cb.checked) holder.picked.add(k); else holder.picked.delete(k); row.classList.toggle("off", !cb.checked); sync(); });
    list.append(row);
  });
  const setAll = on => { holder.picked = new Set(on ? words.map(keyOf) : []); list.querySelectorAll("input").forEach(c => { c.checked = on; c.closest(".photo-word").classList.toggle("off", !on); }); sync(); };
  const name = h("input", { type: "text", id: id + "-name", maxlength: "40", value: opts.name, "aria-label": "New deck name" });
  const picked = () => words.filter(e => holder.picked.has(keyOf(e)));
  make.addEventListener("click", () => {
    const d = createDeck(name.value);
    if (!d) return;
    const n = addWordsToDeck(d.id, picked(), opts.clip, opts.video);
    afterWordDeck(holder, d.id, n, true);
  });
  const target = h("select", { id: id + "-pick", "aria-label": "Your decks" }, state.decks.map(d => h("option", { value: d.id }, d.name)));
  add.addEventListener("click", () => { if (target.value) afterWordDeck(holder, target.value, addWordsToDeck(target.value, picked(), opts.clip, opts.video), false); });
  sync();
  return h("div", { class: "card photo-deck" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Make flashcards"), count),
    h("p", { class: "muted small" }, words.length + (words.length === 1 ? " word" : " words") + " in " + opts.what + ". Words already in your decks start unticked. Tick the ones you want to learn."
      + (opts.video ? " Each word keeps the moment it's said, so its flashcard can play that bit of the " + (opts.video.a ? "recording." : "video.") : "")),
    h("div", { class: "row" },
      h("button", { class: "btn small", type: "button", onclick: () => setAll(true) }, "Tick all"),
      h("button", { class: "btn small", type: "button", onclick: () => setAll(false) }, "Untick all")),
    list,
    h("div", { class: "stack-tight photo-deck-make" },
      h("label", { for: id + "-name", class: "small" }, "Make a new deck"),
      h("div", { class: "row" }, name, make)),
    state.decks.length ? h("div", { class: "stack-tight photo-deck-make" },
      h("label", { for: id + "-pick", class: "small" }, "Or add them to one of your decks"),
      h("div", { class: "row" }, target, add)) : null);
}
/** Put words in a deck (with their video moment when there is one). Returns how many were new to it. */
function addWordsToDeck(id, entries, clip, video) {
  let added = 0;
  updateDeck(id, d => {
    let vi = -1;
    if (video) {
      d.videos = [...(d.videos || [])];
      vi = d.videos.findIndex(x => x.name === video.name && x.size === video.size);
      if (vi < 0 && d.videos.length < 20) { d.videos.push({ name: video.name, size: video.size, ...(video.a ? { a: true } : {}) }); vi = d.videos.length - 1; }
    }
    for (const e of entries) {
      const c = clip && vi >= 0 ? clip(e) : null;
      const extra = c ? { v: [c.v[0], c.v[1], vi], x: c.x.slice(0, 80) } : {};
      const at = d.words.findIndex(w => w.s === e.s && w.p === e.p);
      if (at < 0) { d.words.push({ s: e.s, p: e.p, ...extra }); added++; }
      else if (c && !d.words[at].v) d.words[at] = { ...d.words[at], ...extra };
    }
    d.words = d.words.slice(0, 3000);
    return d;
  });
  return added;
}
function afterWordDeck(holder, id, n, made) {
  if (!isActive(id)) setActive(id, true);
  holder.picked = new Set();
  actionToast((made ? "Made " + deckName(id) + " with " : "Added ") + n + (n === 1 ? " word" : " words") + (made ? ". It's in your flashcards now." : " to " + deckName(id) + "."), "Open deck", () => openDeck(id));
  render(false);
}
