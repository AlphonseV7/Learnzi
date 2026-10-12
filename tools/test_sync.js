// Checks progress sync end to end against a pretend sync store that, like the real one, refuses any
// document over 256 KB. Several "devices" (each its own copy of src/ui/00-core.js + 10-sync.js) share
// the store: moving an old single-document copy into card documents, a second device catching up,
// reviews on two devices at once, an old-version device writing the old format, a reset, and a year of
// cards. Takes about half a minute (the app waits a little before saving). Pass/fail only.
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "src/ui/00-core.js"), "utf8") + "\n" + fs.readFileSync(path.join(root, "src/ui/10-sync.js"), "utf8") +
  "\nthis.api = { get progress() { return progress; }, set progress(v) { progress = v; }, commitProgress, Sync, sanitizeProgress, shardOf, CARD_SHARDS };";
const LIMIT = 256 * 1024;

// ---------- the pretend store ----------
const store = new Map(), listeners = new Map();
let biggest = 0, refused = 0;
const snapOf = p => ({ exists: store.has(p), data: () => JSON.parse(store.get(p)), metadata: { hasPendingWrites: false } });
function notify(p) { for (const cb of listeners.get(p) || []) setTimeout(() => cb(snapOf(p)), 5); }
function rawWrite(p, body) { const s = JSON.stringify(body); biggest = Math.max(biggest, s.length); store.set(p, s); notify(p); }
const db = {
  collection: base => ({ doc: name => {
    const p = base + "/" + name;
    return {
      async set(body) {
        await new Promise(r => setTimeout(r, 3));
        const s = JSON.stringify(body);
        if (s.length > LIMIT) { refused++; const e = new Error("too big"); e.code = "invalid-argument"; throw e; }
        rawWrite(p, body);
      },
      onSnapshot(cb, err) { if (!listeners.has(p)) listeners.set(p, []); listeners.get(p).push(cb); setTimeout(() => cb(snapOf(p)), 5); },
    };
  } }),
};
// ---------- devices ----------
function device(name) {
  const ls = new Map();
  const ctx = {
    console, setTimeout, clearTimeout, queueMicrotask, Date, Math, JSON, Promise,
    localStorage: { getItem: k => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: k => ls.delete(k) },
    window: { claude: { use: async n => (n === "db" ? db : n === "user" ? { id: async () => "u1" } : null) } },
    document: { querySelector: () => null, querySelectorAll: () => [] }, applyAll() {}, onReaderChangedElsewhere() {}, onProgressChangedElsewhere() {}, updateTopbar() {},
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: name });
  return ctx.api;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const check = (n, ok) => { if (ok) pass++; else { fail++; console.log("FAIL", n); } };
const P = "data/users/u1/";
const card = (last, reps) => [3, 5, last + 1440, last, reps, 0, reps * 10, 2, 0];
const words = n => Array.from({ length: n }, (_, i) => "字" + String.fromCodePoint(0x4e00 + i) + "|zi" + (i % 4 + 1) + " x" + i);
const cardsInStore = () => { let n = 0; for (let i = 0; i < 16; i++) if (store.has(P + "cards-" + i)) n += Object.keys(JSON.parse(store.get(P + "cards-" + i)).cards).length; return n; };
const headCards = () => (store.has(P + "progress") ? Object.keys(JSON.parse(store.get(P + "progress")).cards || {}).length : -1);

(async () => {
  // 1. An account synced by the old version: one document holding 2,000 cards.
  const legacy = {};
  words(500).forEach((w, i) => ["m", "l", "r", "w"].forEach(t => { legacy[w + "|" + t] = card(28000000 + i, 3); }));
  rawWrite(P + "progress", { cards: legacy, act: { "2026-10-01": [5, 40, 10, 2, 0, 0] }, adj: [0, 0], garden: [3, 2], epoch: 0, updatedAt: 100 });
  const A = device("phone");
  await A.Sync.start();
  await sleep(5000);
  check("old copy: every card reaches the phone", Object.keys(A.progress.cards).length === 2000);
  check("old copy: cards moved into the card documents", cardsInStore() === 2000);
  check("old copy: the activity document no longer holds cards", headCards() === 0);
  check("old copy: daily activity kept", JSON.stringify(A.progress.act["2026-10-01"]) === "[5,40,10,2,0,0]");
  check("cards are spread over all 16 documents", [...Array(16).keys()].every(i => store.has(P + "cards-" + i)));

  // 2. A second device with nothing on it catches up.
  const B = device("computer");
  await B.Sync.start();
  await sleep(2500);
  check("new device gets every card", Object.keys(B.progress.cards).length === 2000);
  check("new device gets the garden", B.progress.garden.join() === "3,2");

  // 3. Reviews on both at once, different cards.
  const a = A.sanitizeProgress(A.progress), b = B.sanitizeProgress(B.progress);
  a.cards["新|xin1|m"] = card(29000000, 1); a.act["2026-10-12"] = [2, 5, 1, 0, 0, 0];
  b.cards["旧|jiu4|m"] = card(29000001, 1); b.act["2026-10-12"] = [0, 3, 1, 0, 4, 0];
  A.progress = a; A.commitProgress(); B.progress = b; B.commitProgress();
  await sleep(4000);
  check("reviews from both devices reach both", !!A.progress.cards["旧|jiu4|m"] && !!B.progress.cards["新|xin1|m"]);
  check("daily counts merge", JSON.stringify(A.progress.act["2026-10-12"]) === "[2,5,1,0,4,0]" && JSON.stringify(B.progress.act["2026-10-12"]) === "[2,5,1,0,4,0]");

  // 4. A device still on the old version writes its full copy (with one card nobody else has).
  const old = JSON.parse(store.get(P + "progress"));
  old.cards = { "老|lao3|m": card(29000002, 2) };
  rawWrite(P + "progress", old);
  await sleep(5000);
  check("old-version card reaches the new devices", !!A.progress.cards["老|lao3|m"] && !!B.progress.cards["老|lao3|m"]);
  check("and is moved into a card document", cardsInStore() === 2003 && headCards() === 0);

  // 5. Reset on the phone wins everywhere.
  const now = Date.now();
  A.progress = A.sanitizeProgress({ cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: now });
  A.commitProgress();
  await sleep(4000);
  check("reset reaches the other device", Object.keys(B.progress.cards).length === 0 && Object.keys(B.progress.act).length === 0);
  check("reset clears the card documents", cardsInStore() === 0);

  // 6. A year of study: 10,400 cards.
  const year = A.sanitizeProgress({ cards: {}, act: {}, adj: [now, 0], epoch: now, updatedAt: now + 1 });
  const m = Math.floor(now / 60000);
  words(2600).forEach((w, i) => ["m", "l", "r", "w"].forEach(t => { year.cards[w + "|" + t] = [123.4567, 5.4321, m + 10000 + i, m + i, 12, 1, 120, 2, 0]; }));
  for (let d = 0; d < 365; d++) year.act["2026-" + String(1 + Math.floor(d / 31)).padStart(2, "0") + "-" + String(1 + d % 28).padStart(2, "0")] = [20, 150, 10, 12, 4, 6];
  A.progress = year; A.commitProgress();
  await sleep(5000);
  check("a year of cards syncs", cardsInStore() === 10400 && Object.keys(B.progress.cards).length === 10400);
  check("no document was refused for size", refused === 0);
  check("largest document under 256 KB (" + Math.round(biggest / 1024) + " KB)", biggest < LIMIT);
  console.log("largest document " + Math.round(biggest / 1024) + " KB; the old single document would have been " +
    Math.round(JSON.stringify({ cards: year.cards, act: year.act }).length / 1024) + " KB");
  console.log("pass=" + pass + " fail=" + fail);
  process.exit(fail ? 1 : 0);
})();
