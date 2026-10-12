/* LearnZì UI, part 4: XP, Zì level, streak and which flashcards are ready. */

const BONUS_CAP = 50;               // most XP a day from lookups and new words (cards have no cap)
const TYPES = { m: "Meaning", l: "Listening", r: "Recall", w: "Writing" };
const UNLOCK = { l: 3, r: 8, w: 12 };      // days of memory stability on the Meaning card before these unlock

const todayKey = () => SRS.dayKey(clock());
const getAct = (k = todayKey()) => progress.act[k] || [0, 0, 0, 0, 0, 0];
function dayAct() {
  const k = todayKey();
  if (!progress.act[k]) progress.act[k] = [0, 0, 0, 0, 0, 0];
  while (progress.act[k].length < 6) progress.act[k].push(0);
  return progress.act[k];
}
function rawXp() {
  let x = 0;
  for (const c of Object.values(progress.cards)) x += c[6];
  for (const a of Object.values(progress.act)) x += a[0] + (a[4] || 0) + (a[5] || 0);
  return x;
}
const totalXp = () => Math.max(0, rawXp() + progress.adj[1]);
const levelNow = () => SRS.levelInfo(totalXp());
function streak() {
  const d = new Date(clock() - 4 * 3600e3);
  const key = () => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  if (!((progress.act[key()] || [])[1] > 0)) d.setDate(d.getDate() - 1); // not studied yet today: count up to yesterday
  let n = 0;
  while ((progress.act[key()] || [])[1] > 0 && n < 3650) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- earning XP ----------
function xpPop(n) {
  const host = $("#lvl");
  if (!host || n <= 0) return;
  const pop = h("span", { class: "xp-pop", "aria-hidden": "true" }, "+" + n + " XP");
  host.append(pop);
  setTimeout(() => pop.remove(), 1300);
}
function afterXp(before, gained) {
  xpPop(gained);
  const now = levelNow().level;
  if (now > before) {
    showLevelUp(now, before);
    const pill = $("#lvl");
    if (pill) { pill.classList.remove("lvl-pulse"); void pill.offsetWidth; pill.classList.add("lvl-pulse"); }
  }
}
const lookedToday = new Set();
function gainBonus(n) {
  const a = dayAct();
  const add = Math.min(n, BONUS_CAP - a[0]);
  if (add <= 0) return;
  const before = levelNow().level;
  a[0] += add;
  commitProgress();
  afterXp(before, add);
}
function rewardLookup(s) {
  if (lookedToday.has(s)) return;
  lookedToday.add(s);
  gainBonus(2);
}

// ---------- cards ----------
const cardBase = e => e.s + "|" + e.p;
/** The cards a saved word has right now: Meaning always; Listening and Recall once it's known.
 *  Unlocks only count reviews from earlier days, so a word learnt today waits until tomorrow. */
function cardKeys(e) {
  const base = cardBase(e);
  const m = progress.cards[base + "|m"];
  const keys = [base + "|m"];
  const known = m && m[7] === 2 && SRS.dayKey(m[3] * 60000) !== todayKey() ? SRS.stability(m) : 0;
  if (state.listen && (known >= UNLOCK.l || progress.cards[base + "|l"])) keys.push(base + "|l");
  if (known >= UNLOCK.r || progress.cards[base + "|r"]) keys.push(base + "|r");
  if (state.writing && (known >= UNLOCK.w || progress.cards[base + "|w"])) keys.push(base + "|w");
  return keys;
}
/** Cards due now and new cards allowed today, for one deck or for every deck you're studying. */
function studyPlan(nowMs = clock(), deckId = null) {
  const due = [], fresh = [];
  let nextDue = Infinity;
  const words = deckId ? deckWords(deckId) : activeWords();
  for (const e of words) {
    for (const k of cardKeys(e)) {
      const c = progress.cards[k];
      if (!c) fresh.push({ k, e });
      else if (SRS.isDue(c, nowMs)) due.push({ k, e, due: c[2] });
      else nextDue = Math.min(nextDue, c[2]);
    }
  }
  due.sort((a, b) => a.due - b.due);
  const rank = k => "mlrw".indexOf(k.slice(-1));
  fresh.sort((a, b) => rank(a.k) - rank(b.k));
  const newLeft = Math.max(0, state.newPerDay - getAct()[2]);
  return { due, fresh: fresh.slice(0, newLeft), freshWaiting: fresh.length, nextDue };
}
/** A short status for a saved word's main card: New, Learning, Due, or when it's next due. */
function wordStatus(e, nowMs = clock()) {
  const c = progress.cards[cardBase(e) + "|m"];
  if (!c) return ["New", "new"];
  if (SRS.isLearning(c)) return ["Learning", "learning"];
  if (SRS.isDue(c, nowMs)) return ["Due", "due"];
  const d = Math.max(1, Math.round((c[2] - SRS.dayStartMin(nowMs, 0)) / 1440));
  return [d === 1 ? "Tomorrow" : "In " + SRS.label(d * 1440), "later"];
}
function onProgressChangedElsewhere() {
  updateTopbar();
  if (["myzi", "home", "deck", "stats"].includes(ui.view)) render(false);
}
