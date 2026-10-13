/* LearnZì UI, part 2: sync between devices.
 * Private documents per person under data/users/<id>/:
 *   "state"   settings, saved words, badges, MLE — the newest change wins
 *   "reader"  Reader text and page — the newest change wins
 *   "notes"   your notes on words — the newest change wins
 *   "library/decks/<deck id>"  one document per deck of your own — merged deck by deck (the most
 *             recently changed copy of each deck wins; a deleted deck leaves a small "gone" marker for
 *             120 days so a device that still has it doesn't bring it back)
 *   "progress"  daily activity, XP adjustment, water garden and reset epoch — merged
 *   "cards-0" … "cards-31"  flashcards, split by word — merged card by card
 * The sync store holds at most 256 KB per document (counted in UTF-8 bytes: a Chinese character is 3),
 * so flashcards are spread over 32 documents (about 120 KB each at the 50,000-card cap) and each deck
 * and the notes have their own budget (DECK_BYTES, NOTES_BYTES in 00-core). Merging keeps the most
 * recent review of every card, so studying on two devices never loses a review, and a reset on one
 * device (its epoch) wins.
 * No document is written before its stored copy has been read and merged, so a slow connection can
 * never overwrite something another device saved.
 * Older versions kept every card inside "progress" (moved to the card documents on first sync), split
 * cards over 16 documents (cards a document holds for another one are copied there; a document is
 * only rewritten when its own cards change), and kept decks and notes inside "state" (merged in from
 * any copy that still has them). */

const PILL = {
  local: ["On this device", "Progress is saved in this browser only. Open LearnZì while signed in to Claude to sync."],
  connecting: ["Connecting…", "Connecting to your private sync store."],
  saving: ["Saving…", "Saving your changes."],
  synced: ["Synced", "My Zì, flashcard progress, settings and reader text are synced to your account."],
  error: ["Sync paused", "Couldn't reach the sync store. Changes are kept in this browser and will sync when it's back."],
  toobig: ["Sync paused", "Something is too big to sync (a very large deck or a lot of notes). Changes are kept in this browser; make it smaller to sync again."],
};
const DOC_MAX = 255000;   // bytes; the store's limit is 256 KB
const CARD_SHARDS = 32;
/** Which card document a card lives in: by its word, so a word's Meaning, Listening, Recall and
 *  Writing cards stay together. (With 16 documents a card was in shardOf % 16, so each old document
 *  splits cleanly in two.) */
function shardOf(key) {
  const word = key.slice(0, key.lastIndexOf("|"));
  let t = 0;
  for (const ch of word) t = (t * 31 + ch.codePointAt(0)) >>> 0;
  return t % CARD_SHARDS;
}
const shardCards = (cards, i) => { const out = {}; for (const k of Object.keys(cards)) if (shardOf(k) === i) out[k] = cards[k]; return out; };
const cardsSig = cards => JSON.stringify(Object.entries(cards).sort((a, b) => (a[0] < b[0] ? -1 : 1)));
const headSig = p => JSON.stringify([Object.entries(p.act).sort(), p.adj, p.garden, p.epoch]);
/** A card document read back as a progress copy with nothing but cards and the reset epoch. */
const shardAsProgress = raw => { const p = sanitizeProgress({ cards: obj(raw).cards, epoch: obj(raw).epoch, updatedAt: obj(raw).updatedAt }); return { ...p, act: {}, adj: [0, 0], garden: [0, 0] }; };
/** The settings document: everything in state except decks and notes, which have their own. */
const stateDoc = () => { const o = { ...state }; for (const k of LIBRARY_KEYS) delete o[k]; return o; };

/** One synced document.
 *  Newest-wins documents: { ref, get, apply(remote, raw), clean, harvest?(raw) }.
 *  Merged documents: { ref, get, apply(merged, remote), clean, merge(remote) → merged, changed(merged), stale(merged, remote) }. */
class DocSync {
  constructor(opts) {
    Object.assign(this, opts);
    this.status = "connecting"; this.timer = 0; this.writing = false; this.again = false; this.lastSig = null; this.pause = 0;
    this.seen = false; this.wanted = false;   // first stored copy read yet; a save waiting for it
    this.settled = new Promise(r => { this.settle = r; });   // first answer from the store (or an error)
  }
  mark(s) { this.status = s; Sync.refresh(); }
  listen() {
    this.ref.onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      queueMicrotask(this.settle);
      const first = !this.seen;
      this.seen = true;
      this.handle(snap);
      if (first && this.wanted) { this.wanted = false; this.queue(0); }
    }, () => { this.mark("error"); this.settle(); });
  }
  handle(snap) {
    const local = this.get();
    if (!snap.exists) { if (this.hasData(local)) this.queue(0); else this.mark("synced"); return; }
    const raw = snap.data();
    // A settings copy from an older version still holding decks and notes: take them in, then save it
    // again without them (a little later, so their own documents are saved first).
    const resave = this.harvest ? this.harvest(raw) : false;
    const remote = this.clean(raw);
    if (this.merge) {
      const merged = this.merge(remote);
      if (this.changed(merged)) this.apply(merged, remote);
      // The stored copy differs from ours (another device, or an older version, wrote it): save ours.
      if (this.stale(merged, remote)) { this.lastSig = null; this.queue(this.pause); }
      else { this.lastSig = JSON.stringify(this.get()); this.mark("synced"); }
      this.pause = 0;
      return;
    }
    if (remote.updatedAt > local.updatedAt) { this.apply(remote, raw); this.lastSig = JSON.stringify(this.get()); this.mark("synced"); }
    else if (remote.updatedAt < local.updatedAt) { this.lastSig = null; this.queue(0); }
    else this.mark("synced");
    if (resave) { this.lastSig = null; this.queue(2500); }
  }
  hasData(local) { return !!local.updatedAt; }
  queue(delay = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }
  async flush(retried) {
    if (!this.seen) { this.wanted = true; return; }   // never write before reading what's stored
    if (this.writing) { this.again = true; return; }
    const body = JSON.parse(JSON.stringify(this.get()));
    const sig = JSON.stringify(body);
    if (sig === this.lastSig) { this.mark("synced"); return; }   // nothing new for this document
    if (utf8Len(sig) > DOC_MAX) { this.mark("toobig"); return; }
    this.writing = true;
    this.mark("saving");
    try {
      await this.ref.set(body);
      this.lastSig = sig;
      this.mark("synced");
    } catch (err) {
      this.writing = false;
      if (err && err.code === "unavailable" && !retried) { setTimeout(() => this.flush(true), 1500 + Math.random() * 1500); return; }
      this.mark(err && err.code === "invalid_argument" ? "toobig" : "error");
      return;
    }
    this.writing = false;
    if (this.again) { this.again = false; this.flush(); }
  }
}

/** Your own decks: one document each in library/decks, merged deck by deck. */
const deckBody = d => JSON.stringify({ deck: sanitizeDeck(d) });
const goneBody = t => JSON.stringify({ gone: t });
/** Take in decks from elsewhere: [{ id, deck }] or [{ id, gone: when }]. The most recently changed
 *  copy of a deck wins; a deletion wins over any copy older than it. True if yours changed. */
function mergeDecks(incoming) {
  const mine = new Map(state.decks.map(d => [d.id, d]));
  const gone = { ...state.deckGone };
  let changed = false;
  for (const it of incoming) {
    const have = mine.get(it.id);
    if (it.gone) {
      if (!(gone[it.id] >= it.gone)) { gone[it.id] = it.gone; changed = true; }
      if (have && have.m <= it.gone) { mine.delete(it.id); changed = true; }
    } else if (it.deck && !(gone[it.id] >= it.deck.m) && (!have || it.deck.m > have.m)) {
      mine.set(it.id, it.deck); changed = true;
    }
  }
  if (!changed) return false;
  // Deck ids start with the time they were made, so this keeps them in the order you made them.
  state.decks = [...mine.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).slice(0, 50);
  for (const d of state.decks) delete gone[d.id];
  state.deckGone = gone;
  writeJSON(LS_KEY, state);
  return true;
}
class DeckSync {
  constructor(col) {
    this.col = col; this.status = "connecting"; this.timer = 0; this.busy = false; this.again = false;
    this.seen = false; this.stored = new Map();   // deck id → body as stored now
  }
  mark(s) { this.status = s; Sync.refresh(); }
  listen() {
    this.col.onSnapshot(qs => {
      if (qs.metadata && qs.metadata.hasPendingWrites) return;
      const incoming = [];
      this.stored.clear();
      for (const snap of qs.docs) {
        const raw = obj(snap.data());
        if (raw.gone) {
          const t = num(raw.gone, 0, 1e13, 0);
          incoming.push({ id: snap.id, gone: t });
          this.stored.set(snap.id, goneBody(t));
        } else if (obj(raw.deck).id === snap.id) {
          const deck = sanitizeDeck(raw.deck);
          incoming.push({ id: snap.id, deck });
          this.stored.set(snap.id, deckBody(deck));
        }
      }
      this.seen = true;
      if (mergeDecks(incoming)) applyAll();
      this.queue(0);   // save anything of ours the store doesn't have yet
    }, () => this.mark("error"));
  }
  queue(delay = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }
  async flush() {
    if (!this.seen) return;   // the first snapshot saves whatever is waiting
    if (this.busy) { this.again = true; return; }
    const want = new Map();
    for (const d of state.decks) want.set(d.id, deckBody(d));
    for (const [id, t] of Object.entries(state.deckGone)) if (!want.has(id)) want.set(id, goneBody(t));
    const todo = [...want].filter(([id, body]) => this.stored.get(id) !== body);
    // "Gone" markers older than 120 days have dropped out of deckGone: remove their documents too.
    const old = [...this.stored].filter(([id, body]) => !want.has(id) && body.startsWith('{"gone"')).map(([id]) => id);
    if (!todo.length && !old.length) { if (this.status !== "toobig") this.mark("synced"); return; }
    this.busy = true;
    this.mark("saving");
    let big = false;
    try {
      for (const [id, body] of todo) {
        if (utf8Len(body) > DOC_MAX) { big = true; continue; }
        await this.col.doc(id).set(JSON.parse(body));   // one write at a time
        this.stored.set(id, body);
      }
      for (const id of old) { await this.col.doc(id).delete(); this.stored.delete(id); }
      this.mark(big ? "toobig" : "synced");
    } catch (err) {
      this.mark(err && err.code === "invalid_argument" ? "toobig" : "error");
    } finally {
      this.busy = false;
      if (this.again) { this.again = false; this.queue(0); }
    }
  }
}
/** A settings copy from an older version may still hold decks and notes: take them in. */
function adoptOldLibrary(raw) {
  const o = obj(raw), at = num(o.updatedAt, 0, 1e13, 0);
  const old = "decks" in o || "notes" in o;
  if (Array.isArray(o.decks) && o.decks.length) {
    const decks = sanitize({ decks: o.decks, updatedAt: at }).decks;
    if (mergeDecks(decks.map(d => ({ id: d.id, deck: d })))) Sync.queue("decks", 0);
  }
  const notes = sanitizeNotes(o.notes);
  if (Object.keys(notes).length && at > state.notesAt) {
    state.notes = sanitizeNotes({ ...state.notes, ...notes }); state.notesAt = at;
    writeJSON(LS_KEY, state);
    Sync.queue("notes", 0);
  }
  return old;
}

let syncSettle;
const Sync = {
  status: "local", docs: {},
  /** Resolves once your synced settings have loaded (or there's no sync here), so the first-time
   *  welcome never appears on a new device for an account that already has its settings. */
  settled: new Promise(r => { syncSettle = r; }),
  set(s) {
    this.status = s;
    const el = $("#sync");
    if (el) {
      el.dataset.s = s;
      el.title = PILL[s][1];
      el.setAttribute("aria-label", "Sync: " + PILL[s][0]);
      const t = el.querySelector(".sync-text");
      if (t) t.textContent = PILL[s][0];
    }
    const note = $("#sync-note");
    if (note) note.textContent = PILL[s][1];
    // A small dot on the cog when sync has stopped, so you notice it outside Settings too.
    const gear = $("#gear");
    if (gear) {
      const warn = s === "error" || s === "toobig";
      gear.classList.toggle("sync-warn", warn);
      gear.setAttribute("aria-label", warn ? "Settings (sync paused)" : "Settings");
    }
  },
  refresh() {
    const all = Object.values(this.docs).map(d => d.status);
    if (!all.length) return;
    this.set(all.includes("toobig") ? "toobig" : all.includes("error") ? "error" : all.includes("saving") ? "saving" : all.includes("connecting") ? "connecting" : "synced");
  },
  /** "progress" saves the activity document and whichever card documents changed. */
  queue(name, delay) {
    const names = name === "progress" ? ["progress", ...Array.from({ length: CARD_SHARDS }, (_, i) => "cards-" + i)] : [name];
    for (const n of names) { const d = this.docs[n]; if (d) d.queue(delay); }
  },
  /** Save every document now (factory reset waits for this so the reset reaches the synced copy). */
  flushAll() { return Promise.all(Object.values(this.docs).map(d => { clearTimeout(d.timer); return d.flush(); })); },
  async start() {
    const use = window.claude && typeof window.claude.use === "function" ? window.claude.use : null;
    if (!use) { this.set("local"); syncSettle(); return; }
    this.set("connecting");
    let db = null, user = null;
    try { [db, user] = await Promise.all([use("db"), use("user")]); } catch { /* treated as absent */ }
    const id = user ? await user.id() : null;
    if (!db || !id) { this.set("local"); syncSettle(); return; }
    try {
      const base = db.collection("data/users/" + id);
      this.docs.state = new DocSync({ ref: base.doc("state"), get: stateDoc, clean: sanitize, harvest: adoptOldLibrary, apply: (remote, raw) => {
        state = { ...remote, decks: state.decks, deckGone: state.deckGone, notes: state.notes, notesAt: state.notesAt };
        writeJSON(LS_KEY, state);
        if (migrateReaderText(raw)) this.queue("reader");
        applyAll();
      } });
      this.docs.reader = new DocSync({ ref: base.doc("reader"), get: () => reader, clean: sanitizeReader, apply: remote => {
        reader = remote; writeJSON(READER_KEY, reader); onReaderChangedElsewhere();
      } });
      this.docs.notes = new DocSync({ ref: base.doc("notes"), get: () => ({ notes: state.notes, updatedAt: state.notesAt }),
        clean: raw => ({ notes: sanitizeNotes(obj(raw).notes), updatedAt: num(obj(raw).updatedAt, 0, 1e13, 0) }),
        apply: remote => {
          state.notes = remote.notes; state.notesAt = remote.updatedAt; writeJSON(LS_KEY, state);
          if (!(document.activeElement && document.activeElement.id === "note-input")) renderPanel();
        } });
      this.docs.decks = new DeckSync(base.doc("library").collection("decks"));
      const adopt = merged => {
        progress = merged; writeJSON(PROGRESS_KEY, progress); onProgressChangedElsewhere();
        this.queue("progress", 400);   // cards that arrived may belong in other card documents
      };
      // The activity document. A copy written by an older version may still hold cards: merge them in,
      // save them to the card documents first, then save this document without them.
      this.docs.progress = new DocSync({
        ref: base.doc("progress"), clean: sanitizeProgress,
        get: () => ({ v: 2, cards: {}, act: progress.act, adj: progress.adj, garden: progress.garden, epoch: progress.epoch, updatedAt: progress.updatedAt }),
        merge: remote => {
          if (Object.keys(remote.cards).length) {
            // Old format: save the card documents now and this one a little later, so the cards are
            // always stored somewhere before they leave this document.
            for (let i = 0; i < CARD_SHARDS; i++) this.docs["cards-" + i].queue(0);
            this.docs.progress.pause = 2500;
          }
          return mergeProgress(progress, remote);
        },
        changed: merged => progressSig(merged) !== progressSig(progress),
        stale: (merged, remote) => headSig(merged) !== headSig(remote) || Object.keys(remote.cards).length > 0,
        apply: adopt,
      });
      for (let i = 0; i < CARD_SHARDS; i++) {
        const doc = this.docs["cards-" + i] = new DocSync({
          ref: base.doc("cards-" + i), clean: shardAsProgress,
          // No time stamp in here: a card document only changes (and is only saved) when its own cards do.
          get: () => ({ cards: shardCards(progress.cards, i), epoch: progress.epoch }),
          hasData: local => Object.keys(local.cards).length > 0,
          merge: remote => {
            // Cards kept here for another document (the old 16-way split): those get saved there first,
            // and this one is rewritten a little later.
            if (Object.keys(remote.cards).some(k => shardOf(k) !== i)) doc.pause = 2500;
            return mergeProgress(progress, remote);
          },
          changed: merged => progressSig(merged) !== progressSig(progress),
          // Only this document's own cards decide whether it needs saving.
          stale: (merged, remote) => cardsSig(shardCards(merged.cards, i)) !== cardsSig(shardCards(remote.cards, i)) || merged.epoch !== remote.epoch,
          apply: adopt,
        });
      }
    } catch { this.docs = {}; this.set("local"); syncSettle(); return; }
    Object.values(this.docs).forEach(d => d.listen());
    this.docs.state.settled.then(syncSettle);
  },
};
