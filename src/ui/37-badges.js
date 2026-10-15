/* LearnZì UI, part 5e: badges. Each is a red seal (印章) carved with one character, so every badge
 * teaches a character too. Earned ones are stamped into My Zì → My badges; the rest are shadows with
 * ??? and a hint of what earns them (Debug → Show locked items shows their names). No XP: they're
 * trophies. Kept in state.badges (id → when), so they sync. */

const BADGES = [
  { id: "begin", c: "始", p: "shǐ", en: "Begin", how: "Finish the welcome tour" },
  { id: "study", c: "学", p: "xué", en: "Study", how: "Review your first flashcard", test: () => totals().reviews >= 1 },
  { id: "hundred", c: "百", p: "bǎi", en: "Hundred", how: "Review 100 flashcards", test: () => totals().reviews >= 100 },
  { id: "thousand", c: "千", p: "qiān", en: "Thousand", how: "Review 1,000 flashcards", test: () => totals().reviews >= 1000 },
  { id: "star", c: "星", p: "xīng", en: "Star", how: "Save 10 words", test: () => state.saved.length >= 10 },
  { id: "card", c: "卡", p: "kǎ", en: "Card", how: "Make a deck of your own", test: () => state.decks.length >= 1 },
  { id: "read", c: "读", p: "dú", en: "Read", how: "Read something in the Reader" },
  { id: "watch", c: "看", p: "kàn", en: "Watch", how: "Watch a video with Chinese subtitles" },
  { id: "listen", c: "听", p: "tīng", en: "Listen", how: "Listen along to a recording" },
  { id: "snap", c: "拍", p: "pāi", en: "Snap", how: "Read Chinese from a photo" },
  { id: "tone", c: "声", p: "shēng", en: "Tone", how: "Get 10 tones right in the Tone trainer", test: () => (progress.garden || [0, 0])[1] >= 10 },
  { id: "perfect", c: "全", p: "quán", en: "Complete", how: "Get a perfect 10 out of 10 in a tone round" },
  { id: "week", c: "七", p: "qī", en: "Seven", how: "Study 7 days in a row", test: () => totals().best >= 7 },
  { id: "month", c: "月", p: "yuè", en: "Month", how: "Study 30 days in a row", test: () => totals().best >= 30 },
  { id: "early", c: "早", p: "zǎo", en: "Early", how: "Study before 7 in the morning" },
  { id: "night", c: "夜", p: "yè", en: "Night", how: "Study after midnight" },
  { id: "scholar", c: "秀", p: "xiù", en: "Scholar", how: "Reach level 10 and your first scholar's rank", test: () => levelNow().level >= 10 },
  { id: "write", c: "写", p: "xiě", en: "Write", how: "Write a character from memory" },
];
const badgeById = id => BADGES.find(b => b.id === id);
const hasBadge = id => !!(state.badges && state.badges[id]);

let stampQueue = [], stamping = false;
/** Award a badge (once). quiet: no stamp animation (several at once are summed up in one toast). */
function earnBadge(id, quiet) {
  const b = badgeById(id);
  if (!b || hasBadge(id) || mleOn()) return false;
  commit({ badges: { ...state.badges, [id]: Date.now() } });
  if (!quiet) { stampQueue.push(b); if (!stamping) nextStamp(); }
  if (!quiet) setTimeout(() => checkJourney(), 2600);   // a seal can finish a quest: say so after the stamp
  if (ui.view === "myzi") setTimeout(() => render(false), quiet ? 0 : 1900);
  return true;
}
/** Badges that can be worked out from your progress: checked after XP, saving words, decks... */
function checkBadges(quiet) {
  let n = 0;
  for (const b of BADGES) if (b.test && !hasBadge(b.id)) { try { if (b.test() && earnBadge(b.id, quiet)) n++; } catch { /* not ready yet */ } }
  checkJourney(quiet);
  return n;
}
/** Studying now: the early bird (before 7) and night owl (midnight to 4, when the study day ends). */
function timeBadges() {
  const hr = new Date(clock()).getHours();
  if (hr >= 4 && hr < 7) earnBadge("early");
  if (hr >= 0 && hr < 4) earnBadge("night");
}
/** The stamp: the seal thumps down in the middle of the screen, then a line saying what it's for. */
function nextStamp() {
  const b = stampQueue.shift();
  if (!b) { stamping = false; return; }
  stamping = true;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = h("div", { class: "stamp" + (calm ? " calm" : ""), role: "status", "aria-live": "polite" },
    h("div", { class: "seal-badge big", "aria-hidden": "true" }, h("span", { class: "hz" }, b.c)),
    h("div", { class: "stamp-text" }, h("span", { class: "eyebrow" }, "Badge earned"), h("b", null, b.c + " " + b.p + " · " + b.en), h("span", { class: "muted small" }, b.how)));
  document.body.append(el);
  if (state.sounds && !calm) try { gong(0); } catch { /* sound is optional */ }
  setTimeout(() => { el.classList.add("out"); setTimeout(() => { el.remove(); nextStamp(); }, 400); }, 2300);
}
/** On first run of this version: anything your progress already earns, quietly, with one toast. */
function badgesOnStart() {
  const n = checkBadges(true);
  if (n) toast(n === 1 ? "You've earned a badge. See My Zì → My badges." : "You've earned " + n + " badges. See My Zì → My badges.");
  if (jUnseen() && !mleOn()) setTimeout(() => jtopShow(true), n ? 3200 : 600);   // new quests: the journey seal glows
}

/** My Zì: the seals, earned ones stamped in red, the rest as shadows. Tap one for its story. */
function badgesBox() {
  const got = BADGES.filter(b => hasBadge(b.id)).length;
  const info = h("div", { class: "badge-info", hidden: true, "aria-live": "polite" });
  const grid = h("div", { class: "badge-grid" });
  const show = (b, btn) => {
    grid.querySelectorAll(".badge-tile").forEach(t => t.setAttribute("aria-pressed", String(t === btn)));
    const earned = hasBadge(b.id), secret = !earned && !state.showLocked;
    const when = earned ? new Date(state.badges[b.id]).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";
    info.replaceChildren(
      h("div", { class: "seal-badge" + (earned ? "" : " locked"), "aria-hidden": "true" }, h("span", { class: "hz" }, secret ? "?" : b.c)),
      h("div", { class: "stack-tight" },
        h("b", null, secret ? "???" : b.c + " " + b.p + " · " + b.en),
        h("span", { class: "small" }, b.how + "."),
        h("span", { class: "muted small" }, earned ? "Earned " + when : "Not earned yet")),
      earned ? h("button", { class: "btn small", type: "button", onclick: () => openWord(b.c) }, "Open " + b.c) : null);
    info.hidden = false;
  };
  for (const b of BADGES) {
    const earned = hasBadge(b.id), secret = !earned && !state.showLocked;
    const btn = h("button", { class: "badge-tile" + (earned ? "" : " locked"), type: "button", "aria-pressed": "false",
      "aria-label": earned ? b.en + " badge, " + b.c : secret ? "Locked badge: " + b.how : b.en + " badge, not earned yet: " + b.how },
      h("span", { class: "seal-badge" + (earned ? "" : " locked"), "aria-hidden": "true" }, h("span", { class: "hz" }, secret ? "?" : b.c)),
      h("span", { class: "small badge-name" }, secret ? "???" : b.en));
    btn.addEventListener("click", () => show(b, btn));
    grid.append(btn);
  }
  return h("div", { class: "card stack" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "My badges ", h("span", { class: "hz" }, "我的印章")),
      h("span", { class: "muted small num" }, got + " of " + BADGES.length)),
    grid, info);
}
