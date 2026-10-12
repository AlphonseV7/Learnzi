/* LearnZì spaced repetition. MIT licence.
 * Memory model: FSRS-4.5 (Free Spaced Repetition Scheduler) by the Open Spaced Repetition project,
 * MIT-licensed; implemented here from its published formulas with the default parameters.
 * Pure functions only (no page access), so it can be tested on its own.
 *
 * A card is a compact array, so thousands fit in one synced document:
 *   [stability, difficulty, due (minutes since 1970), last review (minutes), reviews, lapses, xp earned, state, learning step]
 *   state: 1 learning, 2 review, 3 relearning. No array at all means a new card.
 */
const SRS = (() => {
  "use strict";
  const W = [0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755];
  const DECAY = -0.5, FACTOR = 19 / 81; // with these, the interval for 90% recall equals the stability in days
  const LEARN_STEPS = [1, 10];        // minutes, for brand-new cards
  const RELEARN_STEPS = [10];         // minutes, after forgetting a card
  const MAX_DAYS = 3650;
  const XP_FOR = [0, 2, 6, 10, 12];   // per grade: Again, Hard, Good, Easy
  const DAY_STARTS_AT = 4;            // a study day runs 04:00 to 04:00 local time

  const clampD = d => Math.min(10, Math.max(1, d));
  const initS = g => W[g - 1];
  const initD = g => clampD(W[4] - (g - 3) * W[5]);
  const retrievability = (t, s) => Math.pow(1 + FACTOR * t / s, DECAY);
  const nextD = (d, g) => clampD(W[7] * initD(4) + (1 - W[7]) * (d - W[6] * (g - 3)));
  function recallS(d, s, r, g) {
    const hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
    return s * (1 + Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
  }
  const forgetS = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
  const days = s => Math.min(MAX_DAYS, Math.max(1, Math.round(s)));
  const r4 = x => Math.round(x * 1e4) / 1e4;

  /** Start of the study day `add` days after the one containing `nowMs`, in minutes. */
  function dayStartMin(nowMs, add) {
    const d = new Date(nowMs - DAY_STARTS_AT * 3600e3);
    d.setHours(DAY_STARTS_AT, 0, 0, 0);
    d.setDate(d.getDate() + add);
    return Math.floor(d.getTime() / 60000);
  }
  /** "YYYY-MM-DD" of the study day containing `nowMs` (local time). */
  function dayKey(nowMs) {
    const d = new Date(nowMs - DAY_STARTS_AT * 3600e3);
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /** The four possible results of grading `card` now (index 0 = Again ... 3 = Easy). */
  function outcomes(card, nowMs) {
    const now = Math.floor(nowMs / 60000);
    const isNew = !Array.isArray(card) || !card[7];
    const res = [];
    for (let g = 1; g <= 4; g++) {
      let [s, d, , last, reps, lapses, xp, state, step] = isNew ? [0, 0, 0, 0, 0, 0, 0, 1, 0] : card;
      if (isNew) { s = initS(g); d = initD(g); }
      else {
        const r = retrievability(Math.max(0, (now - last) / 1440), s);
        s = g === 1 ? forgetS(d, s, r) : recallS(d, s, r, g);
        d = nextD(d, g);
      }
      let due, ivlDays = 0;
      if (state === 1 || state === 3) {
        const steps = state === 1 ? LEARN_STEPS : RELEARN_STEPS;
        if (g === 1) { step = 0; due = now + steps[0]; }
        else if (g === 2) due = now + (step === 0 && steps.length > 1 ? Math.round((steps[0] + steps[1]) / 2) : steps[Math.min(step, steps.length - 1)]);
        else if (g === 3 && step + 1 < steps.length) { step++; due = now + steps[step]; }
        else { state = 2; step = 0; ivlDays = days(s); }
      } else if (g === 1) { lapses++; state = 3; step = 0; due = now + RELEARN_STEPS[0]; }
      else ivlDays = days(s);
      res.push({ card: [r4(s), r4(d), due, now, reps + 1, lapses, xp + XP_FOR[g], state, step], ivlDays });
    }
    // Keep the buttons in order: Hard never beats Good, Good never beats Easy.
    const [, hard, good, easy] = res;
    if (good.ivlDays && hard.ivlDays && good.ivlDays <= hard.ivlDays) good.ivlDays = hard.ivlDays + 1;
    if (easy.ivlDays && good.ivlDays && easy.ivlDays <= good.ivlDays) easy.ivlDays = good.ivlDays + 1;
    for (const o of res) if (o.ivlDays) o.card[2] = dayStartMin(nowMs, o.ivlDays);
    return res.map(o => o.card);
  }
  const review = (card, grade, nowMs) => outcomes(card, nowMs)[grade - 1];

  /** Short labels for the four buttons, e.g. ["1 min", "6 min", "10 min", "14 days"]. */
  function preview(card, nowMs) {
    const now = Math.floor(nowMs / 60000), today = dayStartMin(nowMs, 0);
    // Minutes for learning steps; whole study days for everything scheduled on a later day.
    return outcomes(card, nowMs).map(c => (c[2] - now < 1440 && c[2] < today + 1440 ? label(c[2] - now) : label(Math.round((c[2] - today) / 1440) * 1440)));
  }
  function label(min) {
    if (min < 60) return Math.max(1, min) + " min";
    if (min < 1440) return Math.round(min / 60) + " h";
    const d = Math.round(min / 1440);
    if (d < 31) return d === 1 ? "1 day" : d + " days";
    if (d < 365) return Math.round(d / 30.4) + " mo";
    return (Math.round(d / 36.5) / 10) + " yr";
  }
  const isDue = (card, nowMs) => Array.isArray(card) && card[2] <= Math.floor(nowMs / 60000);
  const stability = card => (Array.isArray(card) ? card[0] : 0);
  const isLearning = card => Array.isArray(card) && (card[7] === 1 || card[7] === 3);

  /** Zì levels: level 1→2 needs 100 XP, and each level after needs 50 more than the last. */
  function levelInfo(xp) {
    let level = 1, base = 0, need = 100;
    while (xp >= base + need && level < 999) { base += need; level++; need = 100 + 50 * (level - 1); }
    return { level, into: xp - base, need };
  }

  return { outcomes, review, preview, label, isDue, isLearning, stability, levelInfo, dayKey, dayStartMin, retrievability, XP_FOR };
})();
if (typeof module !== "undefined") module.exports = SRS;
