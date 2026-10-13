// Checks sync end to end against a pretend sync store that, like the real one, refuses any document
// over 256 KB (counted in UTF-8 bytes) with "invalid_argument". Several "devices" (each its own copy of
// src/ui/00-core.js + 10-sync.js) share the store. Covers: moving an old single-document copy into card
// documents, the old 16-document split moving to 32 (with an old-version tab still open), a second
// device catching up, reviews on two devices at once, a device saving before it has read the store,
// decks and notes moving out of the settings document, decks made, changed and deleted on two devices,
// a reset, and a year (and five years) of cards. Takes about a minute (the app waits a little before
// saving). Pass/fail only.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "src/ui/00-core.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "src/ui/10-sync.js"), "utf8") +
  "\nthis.api = { get progress() { return progress; }, set progress(v) { progress = v; }, get state() { return state; }, commit, commitProgress, Sync, sanitizeProgress, sanitize, shardOf, CARD_SHARDS };";
const LIMIT = 256 * 1024;
const bytes = o => Buffer.byteLength(JSON.stringify(o));

// ---------- the pretend store ----------
const store = new Map(), docListeners = new Map(), colListeners = new Map();
let biggest = 0, refused = 0, writes = 0;
const parentOf = p => p.slice(0, p.lastIndexOf("/"));
const snapOf = p => ({ id: p.slice(p.lastIndexOf("/") + 1), exists: store.has(p), data: () => (store.has(p) ? JSON.parse(store.get(p)) : undefined), metadata: { hasPendingWrites: false } });
const colSnap = c => { const docs = [...store.keys()].filter(k => parentOf(k) === c).sort().map(snapOf); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { hasPendingWrites: false } }; };
function notify(p) {
  for (const cb of docListeners.get(p) || []) setTimeout(() => cb(snapOf(p)), 5);
  for (const cb of colListeners.get(parentOf(p)) || []) setTimeout(() => cb(colSnap(parentOf(p))), 5);
}
function rawWrite(p, body) { const s = JSON.stringify(body); biggest = Math.max(biggest, Buffer.byteLength(s)); store.set(p, s); notify(p); }
const docRef = p => ({
  id: p.slice(p.lastIndexOf("/") + 1), path: p,
  async set(body) {
    await new Promise(r => setTimeout(r, 3));
    if (bytes(body) > LIMIT) { refused++; const e = new Error("too big"); e.code = "invalid_argument"; throw e; }
    writes++; rawWrite(p, body);
  },
  async delete() { await new Promise(r => setTimeout(r, 3)); store.delete(p); notify(p); },
  onSnapshot(cb) { if (!docListeners.has(p)) docListeners.set(p, []); docListeners.get(p).push(cb); setTimeout(() => cb(snapOf(p)), 5); return () => {}; },
  collection: name => colRef(p + "/" + name),
});
const colRef = c => ({
  path: c, doc: id => docRef(c + "/" + id),
  onSnapshot(cb) { if (!colListeners.has(c)) colListeners.set(c, []); colListeners.get(c).push(cb); setTimeout(() => cb(colSnap(c)), 5); return () => {}; },
});
const db = { collection: colRef, doc: docRef };

// ---------- devices ----------
function device(name, opts = {}) {
  const ls = new Map(opts.local || []);
  let src = code;
  if (opts.oldShards) src = src.replace("const CARD_SHARDS = 32;", "const CARD_SHARDS = 16;");   // an old-version tab
  const ctx = {
    console, setTimeout, clearTimeout, queueMicrotask, Date, Math, JSON, Promise,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    window: { claude: { use: async n => (n === "db" ? db : n === "user" ? { id: async () => "u1" } : null) } },
    document: { querySelector: () => null, querySelectorAll: () => [], activeElement: null }, applyAll() {}, onReaderChangedElsewhere() {}, onProgressChangedElsewhere() {}, updateTopbar() {}, renderPanel() {},
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: name });
  return ctx.api;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", n); } };
const P = "data/users/u1/";
const card = (last, reps) => [3, 5, last + 1440, last, reps, 0, reps * 10, 2, 0];
const words = n => Array.from({ length: n }, (_, i) => "字" + String.fromCodePoint(0x4e00 + i) + "|zi" + (i % 4 + 1) + " x" + i);
const cardDocs = () => [...store.keys()].filter(k => /\/cards-\d+$/.test(k));
const cardsInStore = () => { const all = new Set(); for (const k of cardDocs()) for (const c of Object.keys(JSON.parse(store.get(k)).cards)) all.add(c); return all.size; };
const headCards = () => (store.has(P + "progress") ? Object.keys(JSON.parse(store.get(P + "progress")).cards || {}).length : -1);
const deckDocs = () => [...store.keys()].filter(k => k.startsWith(P + "library/decks/")).map(k => JSON.parse(store.get(k)));
const liveDecks = () => deckDocs().filter(d => d.deck).map(d => d.deck.id).sort().join();

(async () => {
  // 1. An account synced by the oldest version: one document holding 2,000 cards, and a settings
  //    document that still holds decks and notes.
  const legacy = {};
  words(500).forEach((w, i) => ["m", "l", "r", "w"].forEach(t => { legacy[w + "|" + t] = card(28000000 + i, 3); }));
  rawWrite(P + "progress", { cards: legacy, act: { "2026-10-01": [5, 40, 10, 2, 0, 0] }, adj: [0, 0], garden: [3, 2], epoch: 0, updatedAt: 100 });
  rawWrite(P + "state", { nickname: "Kuzi", updatedAt: 200, onboarded: true,
    decks: [{ id: "uaaaa1", name: "Food", words: [{ s: "吃", p: "chi1" }], at: 150 }, { id: "uaaaa2", name: "Travel", words: [{ s: "车", p: "che1" }], at: 160 }],
    notes: { "吃|chi1": "eat" } });
  const A = device("phone");
  await A.Sync.start();
  await sleep(6000);
  check("old copy: every card reaches the phone", Object.keys(A.progress.cards).length === 2000);
  check("old copy: cards moved into the card documents", cardsInStore() === 2000);
  check("old copy: the activity document no longer holds cards", headCards() === 0);
  check("old copy: daily activity kept", JSON.stringify(A.progress.act["2026-10-01"]) === "[5,40,10,2,0,0]");
  check("cards are spread over all 32 documents", cardDocs().length === 32);
  check("decks moved to their own documents", liveDecks() === "uaaaa1,uaaaa2" && A.state.decks.length === 2);
  check("notes moved to their own document", store.has(P + "notes") && JSON.parse(store.get(P + "notes")).notes["吃|chi1"] === "eat");
  check("settings document no longer holds decks or notes", !("decks" in JSON.parse(store.get(P + "state"))) && !("notes" in JSON.parse(store.get(P + "state"))));
  check("nickname kept", A.state.nickname === "Kuzi");

  // 2. A second device with nothing on it catches up.
  const B = device("computer");
  await B.Sync.start();
  await sleep(3000);
  check("new device gets every card", Object.keys(B.progress.cards).length === 2000);
  check("new device gets the garden", B.progress.garden.join() === "3,2");
  check("new device gets the decks and notes", B.state.decks.map(d => d.name).join() === "Food,Travel" && B.state.notes["吃|chi1"] === "eat");

  // 3. Reviews on both at once, different cards.
  const a = A.sanitizeProgress(A.progress), b = B.sanitizeProgress(B.progress);
  a.cards["新|xin1|m"] = card(29000000, 1); a.act["2026-10-12"] = [2, 5, 1, 0, 0, 0];
  b.cards["旧|jiu4|m"] = card(29000001, 1); b.act["2026-10-12"] = [0, 3, 1, 0, 4, 0];
  A.progress = a; A.commitProgress(); B.progress = b; B.commitProgress();
  await sleep(4000);
  check("reviews from both devices reach both", !!A.progress.cards["旧|jiu4|m"] && !!B.progress.cards["新|xin1|m"]);
  check("daily counts merge", JSON.stringify(A.progress.act["2026-10-12"]) === "[2,5,1,0,4,0]" && JSON.stringify(B.progress.act["2026-10-12"]) === "[2,5,1,0,4,0]");

  // One more review saves only the documents that changed (the activity document and one card document).
  const before = writes, one = A.sanitizeProgress(A.progress);
  one.cards["一|yi1|m"] = card(29000003, 1); one.act["2026-10-12"][1]++;
  A.progress = one; A.commitProgress();
  await sleep(3000);
  check("one review saves two documents (" + (writes - before) + ")", writes - before === 2);

  // 4. Decks on two devices at once: each makes one, the phone renames Food, the computer deletes Travel.
  A.commit({ decks: [...A.state.decks.map(d => (d.id === "uaaaa1" ? { ...d, name: "Food and drink" } : d)), { id: "ubbbb1", name: "Phone deck", words: [], at: 1 }] });
  B.commit({ decks: [...B.state.decks.filter(d => d.id !== "uaaaa2"), { id: "ucccc1", name: "Computer deck", words: [], at: 1 }] });
  await sleep(4000);
  const names = d => d.state.decks.map(x => x.name).sort().join();
  check("both new decks reach both devices", names(A) === "Computer deck,Food and drink,Phone deck" && names(B) === names(A));
  check("a deleted deck stays deleted", !A.state.decks.some(d => d.id === "uaaaa2") && deckDocs().some(d => d.gone));
  // An old settings copy that still lists the deleted deck doesn't bring it back.
  rawWrite(P + "state", { ...JSON.parse(store.get(P + "state")), decks: [{ id: "uaaaa2", name: "Travel", words: [], at: 160 }], updatedAt: 50 });
  await sleep(2500);
  check("an old copy can't bring a deleted deck back", !A.state.decks.some(d => d.id === "uaaaa2") && !B.state.decks.some(d => d.id === "uaaaa2"));

  // 5. A device that saves before it has read anything doesn't overwrite the store.
  const C = device("tablet");
  C.commit({ nickname: "Tablet" });   // older than nothing: it's a brand-new device…
  C.progress = C.sanitizeProgress({ cards: { "早|zao3|m": card(29000005, 1) }, act: {}, adj: [0, 0], updatedAt: Date.now() });
  C.commitProgress();                  // …that studied one card before connecting
  await C.Sync.start();
  await sleep(4000);
  check("early save keeps everything already stored", Object.keys(C.progress.cards).length === 2004 && cardsInStore() === 2004);
  check("and adds its own card everywhere", !!A.progress.cards["早|zao3|m"]);

  // 6. The old 16-document split, with an old-version tab still open: nothing is lost, and the
  //    devices don't keep rewriting each other's documents.
  const old16 = device("old tab", { oldShards: true });
  await old16.Sync.start();
  await sleep(3000);
  const o = old16.sanitizeProgress(old16.progress);
  o.cards["旧版|jiu4 ban3|m"] = card(29000010, 1);
  old16.progress = o; old16.commitProgress();
  await sleep(4000);
  check("a review on the old-version tab reaches new devices", !!A.progress.cards["旧版|jiu4 ban3|m"] && !!B.progress.cards["旧版|jiu4 ban3|m"]);
  const w0 = writes;
  await sleep(5000);
  check("no endless rewriting with an old tab open (" + (writes - w0) + " writes)", writes - w0 < 5);

  // 7. Reset on the phone wins everywhere.
  const now = Date.now();
  A.progress = A.sanitizeProgress({ cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: now });
  A.commitProgress();
  await sleep(4500);
  check("reset reaches the other device", Object.keys(B.progress.cards).length === 0 && Object.keys(B.progress.act).length === 0);
  check("reset clears the card documents", cardsInStore() === 0);

  // 8. A year of study (10,400 cards), then five years (50,000).
  const m = Math.floor(now / 60000);
  for (const [n, label] of [[2600, "a year"], [12500, "five years"]]) {
    const year = A.sanitizeProgress({ cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: Date.now() });
    words(n).forEach((w, i) => ["m", "l", "r", "w"].forEach(t => { year.cards[w + "|" + t] = [123.4567, 5.4321, m + 10000 + i, m + i, 12, 1, 120, 2, 0]; }));
    for (let d = 0; d < 365; d++) year.act["2026-" + String(1 + Math.floor(d / 31)).padStart(2, "0") + "-" + String(1 + d % 28).padStart(2, "0")] = [20, 150, 10, 12, 4, 6];
    A.progress = year; A.commitProgress();
    await sleep(n > 5000 ? 9000 : 5000);
    check(label + " of cards syncs", cardsInStore() === n * 4 && Object.keys(B.progress.cards).length === n * 4);
  }
  check("no document was refused for size", refused === 0);
  check("largest document under 256 KB (" + Math.round(biggest / 1024) + " KB)", biggest < LIMIT);
  console.log("largest document " + Math.round(biggest / 1024) + " KB (bytes, as the store counts)");
  console.log("pass=" + pass + " fail=" + fail);
  process.exit(fail ? 1 : 0);
})();
