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
/* Ranks: the steps of the old imperial exams (科举 kējǔ), spread over about a year of daily study.
 * At the default 10 new words a day a steady learner earns about 270,000 XP a year, and level 100
 * needs 252,450, so 状元 arrives in roughly a year. */
const RANKS = [
  { lv: 1, s: "学童", p: "xue2 tong2", en: "Pupil", note: "A child just starting school, learning first characters" },
  { lv: 5, s: "童生", p: "tong2 sheng1", en: "Candidate", note: "Passed the first local tests and may sit the real exams" },
  { lv: 10, s: "秀才", p: "xiu4 cai5", en: "County graduate", note: "Passed the county exam: a recognised scholar" },
  { lv: 20, s: "举人", p: "ju3 ren2", en: "Provincial graduate", note: "Passed the provincial exam, held once every three years" },
  { lv: 30, s: "贡士", p: "gong4 shi4", en: "Capital graduate", note: "Passed the great exam in the capital" },
  { lv: 45, s: "进士", p: "jin4 shi4", en: "Palace graduate", note: "Passed the final exam, set in the palace by the emperor" },
  { lv: 60, s: "探花", p: "tan4 hua1", en: "Third in the empire", note: "Third place in the palace exam" },
  { lv: 80, s: "榜眼", p: "bang3 yan3", en: "Second in the empire", note: "Second place in the palace exam" },
  { lv: 100, s: "状元", p: "zhuang4 yuan2", en: "First in the empire", note: "The top scholar of the whole empire" },
];
/** The rank for a level, and the next one (null at the top). */
function rankFor(level) {
  let i = 0;
  while (i + 1 < RANKS.length && RANKS[i + 1].lv <= level) i++;
  return { rank: RANKS[i], next: RANKS[i + 1] || null };
}
/** The rank title you show: the one you chose in Customise → Ranks (if you've reached it), else your newest. */
function shownRank(level) {
  const chosen = state.title && RANKS.find(r => r.s === state.title && r.lv <= level);
  return chosen || rankFor(level).rank;
}
/** A tappable line: 秀才 xiùcai · County graduate. Tapping opens the word. */
function rankChip(level, cls) {
  const rank = shownRank(level);
  return h("button", { class: "rank-chip plain-btn" + (cls ? " " + cls : ""), type: "button", title: rank.note + ". Tap to open the word.",
    "aria-label": "Rank: " + rank.en + ", " + rank.s + ". Open the word", onclick: ev => { ev.stopPropagation(); openWord(rank.s); } },
    h("span", { class: "hz rank-zh" }, rank.s), h("span", { class: "rank-py" }, Engine.toMarks(rank.p)), h("span", { class: "rank-en" }, rank.en));
}
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
/** After earning XP: the +XP pop and a happy face, or the level-up screen. `quiet` (Watch and Listen,
 *  1 XP a line) skips the pop and the face so the avatar doesn't bounce all through a film. */
function afterXp(before, gained, quiet, chars) {
  if (!quiet) { xpPop(gained); xpFlow(chars, gained); revealBar(); }
  const now = levelNow().level;
  if (now > before) {
    showLevelUp(now, before);
    applyLook();   // a theme you chose earlier may have just unlocked
    const pill = $("#lvl");
    if (pill) { pill.classList.remove("lvl-pulse"); void pill.offsetWidth; pill.classList.add("lvl-pulse"); }
  } else if (gained > 0 && !quiet) setMood("happy", 2200);
  if (gained > 0) checkBadges();
}
const lookedToday = new Set();
function gainBonus(n, chars) {
  const a = dayAct();
  const add = Math.min(n, BONUS_CAP - a[0]);
  if (add <= 0) return;
  const before = levelNow().level;
  a[0] += add;
  commitProgress();
  afterXp(before, add, false, chars);
}
function rewardLookup(s) {
  if (lookedToday.has(s)) return;
  lookedToday.add(s);
  gainBonus(2, s);
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
