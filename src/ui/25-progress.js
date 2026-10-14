/* LearnZì UI, part 4: XP, Zì level, streak and which flashcards are ready. */

const BONUS_CAP = 50;               // most XP a day from lookups and new words (cards have no cap)
const TYPES = { m: "Meaning", l: "Listening", c: "Sentence", r: "Recall", w: "Writing" };
const UNLOCK = { l: 3, c: 5, r: 8, w: 12 };      // days of memory stability on the Meaning card before these unlock

const todayKey = () => SRS.dayKey(clock());
const getAct = (k = todayKey()) => progress.act[k] || new Array(ACT_LEN).fill(0);
function dayAct() {
  const k = todayKey();
  if (!progress.act[k]) progress.act[k] = new Array(ACT_LEN).fill(0);
  while (progress.act[k].length < ACT_LEN) progress.act[k].push(0);
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
const TRAVELLER = { lv: 1, s: "旅人", p: "lv3 ren2", en: "Traveller", note: "Finished the whole Journey and found every scroll" };
function shownRank(level) {
  if (state.title === TRAVELLER.s && chapterDone(5)) return TRAVELLER;
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
/* Streak and daily goal. A day counts for the streak once you reach your daily goal (minutes of
 * flashcards and tone trainer), or with any flashcard review when there's no goal. The day is marked
 * when it happens (act[7]), so changing the goal later never rewrites old days. Days before the goal
 * arrived count the old way: any review. */
const GOAL_SINCE = "2026-10-15";
const streakDay = k => { const a = progress.act[k] || []; return a[7] > 0 || (k < GOAL_SINCE && a[1] > 0); };
function streak() {
  const d = new Date(clock() - 4 * 3600e3);
  const key = () => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  if (!streakDay(key())) d.setDate(d.getDate() - 1); // today doesn't count yet: count up to yesterday
  let n = 0;
  while (streakDay(key()) && n < 3650) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const todaySecs = () => getAct()[6] || 0;
const goalMet = () => getAct()[7] > 0;
/** Count practice time (seconds) for today; `review` is true for a flashcard. Marks the day for the
 *  streak when the goal is reached (or on any review without a goal), with a little moment the first time. */
function practiced(sec, review) {
  const a = dayAct();
  a[6] = Math.min(86400, (a[6] || 0) + Math.max(0, Math.round(sec)));
  const goal = (state.dailyGoal || 0) * 60;
  if (a[7] > 0 || !(goal ? a[6] >= goal : review)) return;
  a[7] = 1;
  commitProgress();
  if (goal) {
    const n = streak();
    toast("Daily goal reached: " + state.dailyGoal + " minutes today" + (n > 1 ? ". " + n + "-day streak!" : "!"));
    setMood("happy", 2600);
  }
}
/** "4 of 10 min today", or "Goal reached" ("" without a goal). */
function goalText() {
  if (!state.dailyGoal) return "";
  return goalMet() || todaySecs() >= state.dailyGoal * 60 ? "Goal reached" : Math.floor(todaySecs() / 60) + " of " + state.dailyGoal + " min today";
}
/** A ring that fills with today's practice minutes towards the daily goal (null without a goal). */
function goalRing(size = 46) {
  const goal = state.dailyGoal;
  if (!goal) return null;
  const secs = todaySecs(), met = goalMet() || secs >= goal * 60;
  const mins = Math.floor(secs / 60), f = met ? 1 : Math.min(1, secs / (goal * 60));
  const r = 19, len = 2 * Math.PI * r;
  const ring = sv("svg", { viewBox: "0 0 46 46", width: size, height: size, class: "goal-ring" + (met ? " met" : ""), "aria-hidden": "true" },
    sv("circle", { cx: 23, cy: 23, r, class: "gr-track" }),
    sv("circle", { cx: 23, cy: 23, r, class: "gr-fill", "stroke-dasharray": (f * len).toFixed(1) + " " + len.toFixed(1), transform: "rotate(-90 23 23)" }),
    met ? sv("path", { d: "M15 23.5l5.5 5.5L31.5 18", class: "gr-tick" }) : sv("text", { x: 23, y: 27.5, "text-anchor": "middle", class: "gr-num" }, String(Math.min(mins, 99))));
  const label = met ? "Daily goal reached" : mins + " of " + goal + " min today";   // shown at the end of a review
  return h("div", { class: "goal", role: "img", "aria-label": label + (met ? "" : ", daily goal " + goal + " minutes") }, ring, h("span", { class: "goal-label small" }, label));
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
  jCount("lookups");
  gainBonus(2, s);
}

// ---------- cards ----------
const cardBase = e => e.s + "|" + e.p;
/** The cards a saved word has right now: Meaning always; Listening, Sentence, Recall and Writing once it's known.
 *  Unlocks only count reviews from earlier days, so a word learnt today waits until tomorrow. */
function cardKeys(e) {
  const base = cardBase(e);
  const m = progress.cards[base + "|m"];
  const keys = [base + "|m"];
  const known = m && m[7] === 2 && SRS.dayKey(m[3] * 60000) !== todayKey() ? SRS.stability(m) : 0;
  if (state.listen && (known >= UNLOCK.l || progress.cards[base + "|l"])) keys.push(base + "|l");
  if (state.sentenceCards && (progress.cards[base + "|c"] || (known >= UNLOCK.c && clozeReady(e)))) keys.push(base + "|c");
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
  const rank = k => "mlcrw".indexOf(k.slice(-1));
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
