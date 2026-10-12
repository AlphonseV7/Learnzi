/* LearnZì UI, part 2: sync between devices.
 * Three private documents per person under data/users/<id>/: "state" (settings, My Zì, recent
 * lookups) and "reader" (reader text and page), where the newest change wins, and "progress"
 * (flashcards and XP), which is merged card by card so no review is ever lost. */

const PILL = {
  local: ["On this device", "Progress is saved in this browser only. Open LearnZì while signed in to Claude to sync."],
  connecting: ["Connecting…", "Connecting to your private sync store."],
  saving: ["Saving…", "Saving your changes."],
  synced: ["Synced", "My Zì, flashcard progress, settings and reader text are synced to your account."],
  error: ["Sync paused", "Couldn't reach the sync store. Changes are kept in this browser and will sync when it's back."],
};

class DocSync {
  constructor(ref, getLocal, applyRemote, clean, merge) {
    this.ref = ref; this.get = getLocal; this.apply = applyRemote; this.clean = clean; this.merge = merge;
    this.status = "connecting"; this.timer = 0; this.writing = false; this.again = false;
    this.settled = new Promise(r => { this.settle = r; });   // first answer from the store (or an error)
  }
  mark(s) { this.status = s; Sync.refresh(); }
  listen() {
    this.ref.onSnapshot(snap => {
      if (snap.metadata.hasPendingWrites) return;
      queueMicrotask(this.settle);
      const local = this.get();
      if (!snap.exists) { if (local.updatedAt) this.queue(0); else this.mark("synced"); return; }
      const raw = snap.data();
      const remote = this.clean(raw);
      if (this.merge) {
        const merged = this.merge(local, remote);
        const sig = progressSig(merged);
        if (sig !== progressSig(local)) this.apply(merged, raw);
        if (sig !== progressSig(remote)) this.queue(0); else this.mark("synced");
        return;
      }
      if (remote.updatedAt > local.updatedAt) { this.apply(remote, raw); this.mark("synced"); }
      else if (remote.updatedAt < local.updatedAt) this.queue(0);
      else this.mark("synced");
    }, () => { this.mark("error"); this.settle(); });
  }
  queue(delay = 1200) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), delay);
  }
  async flush(retried) {
    if (this.writing) { this.again = true; return; }
    this.writing = true;
    this.mark("saving");
    try {
      await this.ref.set(JSON.parse(JSON.stringify(this.get())));
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
  queue(name) { const d = this.docs[name]; if (d) d.queue(); },
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
      this.docs.state = new DocSync(base.doc("state"), () => state, (remote, raw) => {
        state = remote; writeJSON(LS_KEY, state);
        if (migrateReaderText(raw)) this.queue("reader");
        applyAll();
      }, sanitize);
      this.docs.reader = new DocSync(base.doc("reader"), () => reader, remote => {
        reader = remote; writeJSON(READER_KEY, reader); onReaderChangedElsewhere();
      }, sanitizeReader);
      this.docs.progress = new DocSync(base.doc("progress"), () => progress, merged => {
        progress = merged; writeJSON(PROGRESS_KEY, progress); onProgressChangedElsewhere();
      }, sanitizeProgress, mergeProgress);
    } catch { this.docs = {}; this.set("local"); syncSettle(); return; }
    Object.values(this.docs).forEach(d => d.listen());
    this.docs.state.settled.then(syncSettle);
  },
};
