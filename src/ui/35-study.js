/* LearnZì UI, part 6: flashcard study sessions. */

const SESSION_MAX = 60;
const study = { queue: [], cur: null, revealed: false, done: 0, again: 0, xp: 0, active: false, deck: null };

function startStudy(deckId = null) {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (deckId && !deckExists(deckId)) deckId = null;
  const plan = studyPlan(clock(), deckId);
  const queue = [];
  let d = 0, f = 0;
  // Mix new cards in among reviews: three reviews, then one new card.
  while ((d < plan.due.length || f < plan.fresh.length) && queue.length < SESSION_MAX) {
    for (let i = 0; i < 3 && d < plan.due.length; i++) queue.push(plan.due[d++]);
    if (f < plan.fresh.length) queue.push(plan.fresh[f++]);
  }
  Object.assign(study, { queue, cur: null, revealed: false, done: 0, again: 0, xp: 0, active: true, deck: deckId });
  nextCard();
  go("study");
}
function nextCard() {
  study.cur = study.queue.shift() || null;
  study.revealed = false;
  study.w = { idx: 0, mistakes: 0, done: false, strokes: 0 };
  if (study.cur && study.cur.k.endsWith("|l") && state.autoplay) setTimeout(() => speak(study.cur.e.s, study.cur.e.p), 250);
}
function reveal() {
  if (!study.cur || study.revealed) return;
  study.revealed = true;
  if (state.autoplay && !study.cur.k.endsWith("|l")) speak(study.cur.e.s, study.cur.e.p);
  render(false);
}
function grade(g) {
  const cur = study.cur;
  if (!cur || !study.revealed) return;
  const nowMs = clock();
  const old = progress.cards[cur.k];
  const next = SRS.review(old, g, nowMs);
  const before = levelNow().level;
  progress.cards[cur.k] = next;
  const a = dayAct();
  a[1]++;
  if (!old) a[2]++;
  if (g === 1) a[3]++;
  commitProgress();
  const gained = SRS.XP_FOR[g];
  study.xp += gained;
  study.done++;
  if (g === 1) study.again++;
  // Still learning: show it again a few cards later in this session.
  if (SRS.isLearning(next)) study.queue.splice(Math.min(3, study.queue.length), 0, cur);
  afterXp(before, gained);
  nextCard();
  render(false);
}

function viewStudy() {
  const v = h("section", { class: "view study" });
  if (!study.active) { setTimeout(() => startStudy(), 0); return v; }
  const total = study.done + study.queue.length + (study.cur ? 1 : 0);
  v.append(h("div", { class: "row spread study-top" },
    h("button", { class: "btn", type: "button", onclick: leaveStudy }, icon("back"), study.deck ? deckName(study.deck) : "My Zì"),
    h("span", { class: "muted small num" }, study.cur ? Math.min(study.done + 1, total) + " of " + total : "Done"),
    h("span", { class: "badge hsk num" }, "+" + study.xp + " XP")));
  const bar = h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(study.done) }, h("i"));
  bar.firstChild.style.width = (total ? (study.done / total) * 100 : 100) + "%";
  v.append(bar);
  v.append(study.cur ? cardView(study.cur) : summaryView());
  return v;
}

function cardView({ k, e }) {
  const type = k.slice(-1);
  const card = h("div", { class: "card flashcard", "data-type": type });
  const listen = (label) => h("button", { class: "btn" + (label ? "" : " icon"), type: "button", "aria-label": "Listen", onclick: () => speak(e.s, e.p) }, icon("play"), label || null);
  card.append(h("span", { class: "eyebrow" }, TYPES[type] + (progress.cards[k] ? "" : " · new")));
  // Front of the card
  if (type === "m") {
    card.append(h("div", { class: "fc-front" }, rubyHz(disp(e), e.p, "fc-hz")),
      h("p", { class: "muted small" }, "What does it mean?"));
  } else if (type === "l") {
    card.append(h("div", { class: "fc-front" },
      h("button", { class: "fc-play", type: "button", "aria-label": "Play the word", onclick: () => speak(e.s, e.p) }, icon("play"))),
      h("p", { class: "muted small" }, "Listen. What's the word, and what does it mean?"));
  } else if (type === "w") {
    card.append(h("div", { class: "fc-front fc-meaning" }, shortDef(e, 3)),
      h("div", { class: "row fc-center" }, pyEl(e.p, "py fc-py"), listen()));
    if (!study.revealed) card.append(writingQuiz(e));
  } else {
    card.append(h("div", { class: "fc-front fc-meaning" }, shortDef(e, 3)),
      h("p", { class: "muted small" }, "How do you say and write it in Chinese?"));
  }
  if (!study.revealed) {
    card.append(h("button", { class: "btn primary big-btn", type: "button", onclick: reveal }, "Show answer"),
      h("p", { class: "muted small kbd-hint" }, "Space to show the answer"));
    return card;
  }
  // Back of the card
  const senses = Engine.senses(e).slice(0, 4).map(plainSense);
  card.append(h("div", { class: "fc-answer" },
    type !== "m" ? rubyHz(disp(e), e.p, "fc-hz") : null,
    h("div", { class: "row" }, pyEl(e.p, "py fc-py"), listen(), starBtn(e)),
    h("ol", { class: "defs" }, senses.map(s => h("li", null, s))),
    h("button", { class: "plain-btn build-link small", type: "button", onclick: () => openWord(e.s, e) }, "More about this word")),
    clipBlock(e));
  const labels = SRS.preview(progress.cards[k], clock());
  let suggest = 0;
  if (type === "w") {
    const w = study.w;
    suggest = !w.done ? 1 : w.mistakes === 0 ? 3 : w.mistakes <= Math.max(1, Math.floor(w.strokes / 4)) ? 2 : 1;
    card.append(h("p", { class: "muted small fc-center" }, !w.done ? "You showed the answer before finishing." : w.mistakes ? "Written with " + w.mistakes + (w.mistakes === 1 ? " slip." : " slips.") : "Written without a slip!"));
  }
  card.append(h("div", { class: "grades", role: "group", "aria-label": "How well did you know it?" },
    ["Again", "Hard", "Good", "Easy"].map((name, i) => h("button", { class: "grade g" + (i + 1) + (suggest === i + 1 ? " suggested" : ""), type: "button", onclick: () => grade(i + 1) },
      h("b", null, name), h("span", { class: "small" }, labels[i])))),
    h("p", { class: "muted small kbd-hint" }, "Keys 1–4 also work"));
  return card;
}

function summaryView() {
  const box = h("div", { class: "card summary" });
  const lv = levelNow();
  const plan = studyPlan(clock(), study.deck);
  if (!study.done) {
    box.append(h("h2", null, "Nothing to study right now"));
    if (!state.saved.length) box.append(h("p", { class: "muted" }, "Star words in Look up or the Reader to add them to My Zì. Each one becomes a flashcard."));
    else if (plan.freshWaiting && !plan.fresh.length) box.append(h("p", { class: "muted" }, "You've started today's " + state.newPerDay + " new words. More tomorrow, or raise the limit in Settings."));
    if (plan.nextDue < Infinity) box.append(h("p", { class: "muted" }, "Next review: " + whenText(plan.nextDue) + "."));
  } else {
    const right = study.done - study.again;
    box.append(h("h2", null, "Session complete"),
      h("div", { class: "stats" },
        stat(study.done, study.done === 1 ? "card" : "cards"),
        stat(Math.round((right / study.done) * 100) + "%", "remembered"),
        stat("+" + study.xp, "XP"),
        stat(streak(), streak() === 1 ? "day streak" : "day streak")));
  }
  box.append(levelBar(lv));
  const more = plan.due.length + plan.fresh.length;
  box.append(h("div", { class: "row" },
    more ? h("button", { class: "btn primary", type: "button", onclick: () => startStudy(study.deck) }, "Study " + more + " more") : null,
    h("button", { class: "btn", type: "button", onclick: leaveStudy }, study.deck ? "Back to " + deckName(study.deck) : "Back to My Zì")));
  return box;
}
function leaveStudy() {
  study.active = false;
  if (study.deck) openDeck(study.deck); else go("myzi");
}
function stat(value, label) { return h("div", { class: "stat" }, h("b", { class: "num" }, String(value)), h("span", { class: "muted small" }, label)); }
function levelBar(lv) {
  const bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = Math.round((lv.into / lv.need) * 100) + "%";
  return h("div", { class: "level-box" },
    h("div", { class: "row spread" }, h("b", null, "Zì level " + lv.level), h("span", { class: "muted small num" }, lv.into + " / " + lv.need + " XP")),
    bar);
}
function whenText(dueMin) {
  const mins = dueMin - Math.floor(clock() / 60000);
  if (mins <= 0) return "now";
  if (mins < 60) return "in " + mins + " min";
  if (mins < 1440) return "in " + Math.round(mins / 60) + " h";
  return "in " + SRS.label(Math.round((dueMin - SRS.dayStartMin(clock(), 0)) / 1440) * 1440);
}
function studyKeys(ev) {
  if (ui.view !== "study" || !study.cur || $("#levelup")) return;
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
  if (!study.revealed && (ev.key === " " || ev.key === "Enter")) { ev.preventDefault(); reveal(); }
  else if (study.revealed && /^[1-4]$/.test(ev.key)) { ev.preventDefault(); grade(Number(ev.key)); }
}

/** Writing card: write each character of the word from memory, one after another. */
function writingQuiz(e) {
  const chars = [...disp(e)].filter(c => Engine.isCJK(c));
  const box = h("div", { class: "writer-box fc-writer" });
  const status = h("p", { class: "muted small fc-center", "aria-live": "polite" });
  const wrap = h("div", { class: "fc-write" }, box, status);
  if (!writerReady()) {
    status.textContent = "Stroke practice can't load on this network. Write it on paper, then show the answer.";
    return wrap;
  }
  const size = Math.min(260, window.innerWidth - 90);
  const start = () => {
    const w = study.w;
    const ch = chars[w.idx];
    box.replaceChildren();
    status.textContent = (chars.length > 1 ? "Character " + (w.idx + 1) + " of " + chars.length + ". " : "") + "Write it from memory. A hint appears after 3 misses.";
    CharData.strokes(ch).then(d => { if (d) w.strokes += d.strokes.length; else status.textContent = "No stroke data for " + ch + ". Show the answer when ready."; });
    const writer = makeWriter(box, ch, size, { showCharacter: false, showOutline: false });
    writer.quiz({
      showHintAfterMisses: 3,
      onComplete: s => {
        w.mistakes += s.totalMistakes;
        w.idx++;
        if (w.idx < chars.length) setTimeout(start, 500);
        else { w.done = true; setTimeout(reveal, 700); }
      },
    });
  };
  setTimeout(start, 0);
  return wrap;
}
