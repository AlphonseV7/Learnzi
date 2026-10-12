/* LearnZì UI, part 2: sync between devices.
 * Private documents per person under data/users/<id>/:
 *   "state"  settings, My Zì, decks, badges — the newest change wins
 *   "reader" Reader text and page — the newest change wins
 *   "progress" daily activity, XP adjustment, water garden and reset epoch — merged
 *   "cards-0" … "cards-15" flashcards, split by word — merged card by card
 * The sync store holds at most 256 KB per document, and flashcards grow by about 1.9 KB a day, so they
 * are spread over 16 documents (room for many years). Merging keeps the most recent review of every
 * card, so studying on two devices never loses a review, and a reset on one device (its epoch) wins.
 * Older versions kept every card inside "progress": the first sync moves them into the card documents
 * (cards first, then the slimmed "progress"), and any cards found there later are merged in again. */

const PILL = {
  local: ["On this device", "Progress is saved in this browser only. Open LearnZì while signed in to Claude to sync."],
  connecting: ["Connecting…", "Connecting to your private sync store."],
  saving: ["Saving…", "Saving your changes."],
  synced: ["Synced", "My Zì, flashcard progress, settings and reader text are synced to your account."],
  error: ["Sync paused", "Couldn't reach the sync store. Changes are kept in this browser and will sync when it's back."],
};
const CARD_SHARDS = 16;
/** Which card document a card lives in: by its word, so a word's Meaning, Listening, Recall and
 *  Writing cards stay together. */
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

/** One synced document.
 *  Newest-wins documents: { ref, get, apply(remote, raw), clean }.
 *  Merged documents: { ref, get, apply(merged, remote), clean, merge(remote) → merged, changed(merged), stale(merged, remote) }. */
class DocSync {
  constructor(opts) {
    Object.assign(this, opts);
    this.status = "connecting"; this.timer = 0; this.writing = false; this.again = false; this.lastSig = null;
    this.settled = new Promise(r => { this.settle = r; });   // first answer from the store (or an error)
  }
  mark(s) { this.status = s; Sync.refresh(); }
  listen() {
    this.ref.onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      queueMicrotask(this.settle);
      const local = this.get();
      if (!snap.exists) { if (this.hasData(local)) this.queue(0); else this.mark("synced"); return; }
      const raw = snap.data();
      const remote = this.clean(raw);
      if (this.merge) {
        const merged = this.merge(remote);
        if (this.changed(merged)) this.apply(merged, remote);
        // The stored copy differs from ours (another device, or an older version, wrote it): save ours.
        if (this.stale(merged, remote)) { this.lastSig = null; this.queue(this.pause || 0); this.pause = 0; }
        else { this.lastSig = JSON.stringify(this.get()); this.mark("synced"); }
        return;
      }
      if (remote.updatedAt > local.updatedAt) { this.apply(remote, raw); this.mark("synced"); }
      else if (remote.updatedAt < local.updatedAt) { this.lastSig = null; this.queue(0); }
      else this.mark("synced");
    }, () => { this.mark("error"); this.settle(); });
  }
  hasData(local) { return !!local.updatedAt; }
  queue(delay = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }
  async flush(retried) {
    if (this.writing) { this.again = true; return; }
    const body = JSON.parse(JSON.stringify(this.get()));
    const sig = JSON.stringify(body);
    if (sig === this.lastSig) { this.mark("synced"); return; }   // nothing new for this document
    this.writing = true;
    this.mark("saving");
    try {
      await this.ref.set(body);
      this.lastSig = sig;
      this.mark("synced");
    } catch (err) {
      this.writing = false;
      if (err && err.code === "unavailable" && !retried) { setTimeout(() => this.flush(true), 1500 + Math.random() * 1500); return; }
      this.mark("error");
      return;
    }
    this.writing = false;
    if (this.again) { this.again = false; this.flush(); }
  }
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
  },
  refresh() {
    const all = Object.values(this.docs).map(d => d.status);
    if (!all.length) return;
    this.set(all.includes("error") ? "error" : all.includes("saving") ? "saving" : all.includes("connecting") ? "connecting" : "synced");
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
      this.docs.state = new DocSync({ ref: base.doc("state"), get: () => state, clean: sanitize, apply: (remote, raw) => {
        state = remote; writeJSON(LS_KEY, state);
        if (migrateReaderText(raw)) this.queue("reader");
        applyAll();
      } });
      this.docs.reader = new DocSync({ ref: base.doc("reader"), get: () => reader, clean: sanitizeReader, apply: remote => {
        reader = remote; writeJSON(READER_KEY, reader); onReaderChangedElsewhere();
      } });
      const adopt = merged => { progress = merged; writeJSON(PROGRESS_KEY, progress); onProgressChangedElsewhere(); };
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
        this.docs["cards-" + i] = new DocSync({
          ref: base.doc("cards-" + i), clean: shardAsProgress,
          get: () => ({ cards: shardCards(progress.cards, i), epoch: progress.epoch, updatedAt: progress.updatedAt }),
          hasData: local => Object.keys(local.cards).length > 0,
          merge: remote => mergeProgress(progress, remote),
          changed: merged => progressSig(merged) !== progressSig(progress),
          stale: (merged, remote) => cardsSig(shardCards(merged.cards, i)) !== cardsSig(remote.cards) || merged.epoch !== remote.epoch,
          apply: adopt,
        });
      }
    } catch { this.docs = {}; this.set("local"); syncSettle(); return; }
    Object.values(this.docs).forEach(d => d.listen());
    this.docs.state.settled.then(syncSettle);
  },
};
