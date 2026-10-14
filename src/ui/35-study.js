/* LearnZì UI, part 6: flashcard study sessions. */

const study = { queue: [], cur: null, revealed: false, done: 0, again: 0, xp: 0, active: false, deck: null };

function startStudy(deckId = null) {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (deckId && !deckExists(deckId)) deckId = null;
  const plan = studyPlan(clock(), deckId);
  const queue = [];
  let d = 0, f = 0;
  // Mix new cards in among reviews: three reviews, then one new card.
  clozeWarm();
  while ((d < plan.due.length || f < plan.fresh.length) && queue.length < state.sessionSize) {
    for (let i = 0; i < 3 && d < plan.due.length; i++) queue.push(plan.due[d++]);
    if (f < plan.fresh.length) queue.push(plan.fresh[f++]);
  }
  Object.assign(study, { queue, cur: null, revealed: false, done: 0, again: 0, xp: 0, shownXp: 0, active: true, deck: deckId });
  nextCard();
  go("study");
}
function nextCard() {
  study.cur = study.queue.shift() || null;
  study.revealed = false;
  study.typed = null; study.draft = ""; study.suggest = 0; study.shownAt = Date.now();
  study.w = { idx: 0, mistakes: 0, done: false, strokes: 0 };
  // Sentence cards coming up: fetch the sentences now (the card shows "Loading" until they arrive).
  if (!Cloze.rows && [study.cur, ...study.queue.slice(0, 3)].some(it => it && it.k.endsWith("|c"))) {
    clozeLoad().then(() => { if (ui.view === "study" && study.cur && study.cur.k.endsWith("|c")) render(false); });
  }
  // fetch the stroke shapes of the next few cards now, so their characters can draw themselves at once
  if (state.drawChars) for (const it of [study.cur, ...study.queue.slice(0, 3)]) if (it) for (const c of it.e.s) if (Engine.isCJK(c)) CharData.strokes(c);
  if (study.cur && study.cur.k.endsWith("|l") && state.autoplay) setTimeout(() => speak(study.cur.e.s, study.cur.e.p), 250);
}
function reveal() {
  if (!study.cur || study.revealed) return;
  study.revealed = true;
  if (state.autoplay && !study.cur.k.endsWith("|l")) {
    const cz = study.cur.k.endsWith("|c") ? clozePick(study.cur.k, study.cur.e) : null;
    if (cz) speak(cz.zh); else speak(study.cur.e.s, study.cur.e.p);   // a Sentence card says the whole sentence
  }
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
  practiced(Math.min(cur.k.endsWith("|w") ? 120 : 60, (Date.now() - (study.shownAt || Date.now())) / 1000), true);
  commitProgress();
  if (!state.pinyin) jCount("nopinyin");
  const gained = SRS.XP_FOR[g];
  study.xp += gained;
  study.done++;
  if (g === 1) study.again++;
  // Still learning: show it again a few cards later in this session.
  if (SRS.isLearning(next)) study.queue.splice(Math.min(3, study.queue.length), 0, cur);
  afterXp(before, gained, false, cur.e.s);
  if (g === 1) setMood("oops", 2200);
  timeBadges();
  if (cur.k.endsWith("|w") && g >= 3) earnBadge("write");
  nextCard();
  render(false);
}

function viewStudy() {
  const v = h("section", { class: "view study" });
  if (!study.active) {
    // Opened before the dictionary finished loading: show its progress; the session starts once it's
    // ready (applyAll in 90-start draws this page again).
    if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
    setTimeout(() => startStudy(), 0);
    return v;
  }
  const total = study.done + study.queue.length + (study.cur ? 1 : 0);
  v.append(h("div", { class: "row spread study-top" },
    h("button", { class: "btn", type: "button", onclick: leaveStudy }, icon("back"), study.deck ? deckName(study.deck) : "My Zì"),
    h("span", { class: "muted small num" }, study.cur ? Math.min(study.done + 1, total) + " of " + total : "Done"),
    xpBadge()));
  const bar = h("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(total), "aria-valuenow": String(study.done) }, h("i"));
  bar.firstChild.style.width = (total ? (study.done / total) * 100 : 100) + "%";
  v.append(bar);
  v.append(study.cur ? cardView(study.cur) : summaryView());
  return v;
}

/** Tap (or Enter on) the big characters to hear the word again, with a little press. */
function sayOnTap(el, e) {
  const play = () => { speak(e.s, e.p); el.classList.remove("said"); void el.offsetWidth; el.classList.add("said"); };
  el.classList.add("fc-say");
  el.setAttribute("role", "button"); el.tabIndex = 0; el.setAttribute("aria-label", "Play the word " + disp(e));
  el.addEventListener("click", play);
  el.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.stopPropagation(); play(); } });
  el.addEventListener("animationend", () => el.classList.remove("said"));
  return el;
}
function cardView({ k, e }) {
  const type = k.slice(-1);
  const card = h("div", { class: "card flashcard", "data-type": type });
  // Sentence card: its sentence (null while the sentences load, or if none suits the word any more)
  const cz = type === "c" ? clozePick(k, e) : null;
  if (type === "c" && !cz && !Cloze.rows && !Cloze.failed) {
    card.append(h("span", { class: "eyebrow" }, TYPES.c), h("p", { class: "muted fc-center" }, "Loading the sentence…"));
    clozeLoad().then(() => { if (ui.view === "study" && study.cur && study.cur.k === k) render(false); });
    return card;
  }
  const typing = state.typeAnswers && type !== "w";
  const listen = (label) => withVoice(h("button", { class: "btn" + (label ? "" : " icon"), type: "button", "aria-label": "Listen", onclick: () => speak(e.s, e.p) }, icon("play"), label || null), { text: e.s, p: e.p, compact: !label });
  card.append(h("span", { class: "eyebrow" }, TYPES[type], progress.cards[k] ? null : h("span", { class: "fc-new" }, " · new")));
  // Front of the card
  if (type === "m") {
    const hz = sayOnTap(rubyHz(disp(e), e.p, "fc-hz"), e);
    card.append(h("div", { class: "fc-front" }, hz),
      h("p", { class: "muted small" }, "What does it mean?"));
    drawSoon(hz, !study.revealed);   // after answering, the drawn characters just stay
  } else if (type === "l") {
    card.append(h("div", { class: "fc-front tone-play-row" },
      h("button", { class: "fc-play", type: "button", "aria-label": "Play the word", onclick: () => speak(e.s, e.p) }, icon("play")),
      voiceBtn({ text: e.s, p: e.p })),
      h("p", { class: "muted small" }, typing ? "Listen, then type what you hear" : "Listen. What's the word, and what does it mean?"));
  } else if (type === "w") {
    card.append(h("div", { class: "fc-front fc-meaning" }, shortDef(e, 3)),
      h("div", { class: "row fc-center" }, pyEl(e.p, "py fc-py"), listen()));
    if (!study.revealed) card.append(writingQuiz(e));
  } else if (cz) {
    card.append(h("div", { class: "fc-front cz-front" },
      clozeLine(cz, e, false),
      h("p", { class: "cz-en muted" }, cz.en),
      h("p", { class: "cz-hint small" }, h("span", { class: "muted" }, "Missing word: "), shortDef(e, 1))),
      h("p", { class: "muted small" }, typing ? "Type the missing word" : "What's the missing word?"));
  } else {
    card.append(h("div", { class: "fc-front fc-meaning" }, shortDef(e, 3)),
      h("p", { class: "muted small" }, typing ? "Type it in pinyin or characters" : "How do you say and write it in Chinese?"));
  }
  if (!study.revealed) {
    if (typing) card.append(typeBox(e, type));
    card.append(h("button", { class: "btn big-btn" + (typing ? " ta-skip" : " primary"), type: "button", onclick: reveal }, typing ? "Don't know? Show answer" : "Show answer"),
      h("p", { class: "muted small kbd-hint" }, typing ? "Enter to check" : "Space to show the answer"));
    return card;
  }
  if (study.typed) card.append(typedFeedback(e, study.typed));
  if (cz) card.append(h("div", { class: "cz-back" }, clozeLine(cz, e, true),
    h("div", { class: "row spread" }, h("span", { class: "muted small" }, cz.en),
      h("span", { class: "row ex-tools" },
        withVoice(h("button", { class: "btn icon", type: "button", "aria-label": "Listen to the sentence", onclick: () => speak(cz.zh) }, icon("play")), { text: cz.zh, compact: true }),
        h("a", { class: "small muted", href: "https://tatoeba.org/en/sentences/show/" + cz.id, target: "_blank", rel: "noopener noreferrer", title: "Sentence from Tatoeba (CC BY 2.0 FR)" }, "Tatoeba")))));
  // Back of the card
  const senses = Engine.senses(e).slice(0, 4).map(plainSense);
  const answerHz = type !== "m" ? sayOnTap(rubyHz(disp(e), e.p, "fc-hz"), e) : null;
  if (answerHz && type !== "w") drawSoon(answerHz);
  card.append(h("div", { class: "fc-answer" },
    answerHz,
    h("div", { class: "row" }, pyEl(e.p, "py fc-py"), listen(), starBtn(e)),
    h("ol", { class: "defs" }, senses.map(s => h("li", null, s))),
    h("button", { class: "plain-btn build-link small", type: "button", onclick: () => openWord(e.s, e) }, "More about this word")),
    clipBlock(e) || "");
  const labels = SRS.preview(progress.cards[k], clock());
  let suggest = study.typed ? verdictOf(study.typed.res).grade : 0;
  if (type === "w") {
    const w = study.w;
    suggest = !w.done ? 1 : w.mistakes === 0 ? 3 : w.mistakes <= Math.max(1, Math.floor(w.strokes / 4)) ? 2 : 1;
    card.append(h("p", { class: "muted small fc-center" }, !w.done ? "You showed the answer before finishing." : w.mistakes ? "Written with " + w.mistakes + (w.mistakes === 1 ? " slip." : " slips.") : "Written without a slip!"));
  }
  card.append(h("div", { class: "grades", role: "group", "aria-label": "How well did you know it?" },
    ["Again", "Hard", "Good", "Easy"].map((name, i) => h("button", { class: "grade g" + (i + 1) + (suggest === i + 1 ? " suggested" : ""), type: "button", onclick: () => grade(i + 1) },
      h("b", null, name), h("span", { class: "small" }, labels[i])))),
    h("p", { class: "muted small kbd-hint" }, "Keys 1–4 also work" + (suggest ? ", Enter for the suggested one" : "")));
  study.suggest = suggest;
  return card;
}

/** The answer box on a card (typed answers): Enter or Check marks it and shows the answer. */
function typeBox(e, type) {
  const label = type === "m" ? "Type the meaning in English" : type === "l" ? "Type what you hear, in pinyin or characters" : "Type the word, in pinyin or characters";
  const inp = h("input", { id: "ta-input", class: "ta-input", type: "text", maxlength: "60", autocomplete: "off", autocapitalize: "none", autocorrect: "off",
    spellcheck: "false", enterkeyhint: "done", "aria-label": label, placeholder: type === "m" ? "Meaning in English" : "Pinyin (ni3hao3) or 汉字" });
  inp.value = study.draft || "";
  inp.addEventListener("input", () => { study.draft = inp.value; });
  const check = ev => {
    ev.preventDefault();
    const text = inp.value.trim().slice(0, 60);
    if (!text) { inp.focus(); return; }
    study.typed = { text, res: type === "m" ? checkMeaning(text, Engine.senses(e).map(plainSense)) : checkReading(text, e) };
    reveal();
  };
  // Ready to type straight away (the keyboard stays up from card to card).
  queueMicrotask(() => { if (inp.isConnected && document.activeElement !== inp && !$("#levelup")) inp.focus({ preventScroll: true }); });
  return h("form", { class: "ta-form", onsubmit: check }, inp, h("button", { class: "btn primary", type: "submit" }, "Check"));
}
/** What the typed answer got right or wrong, shown above the answer. */
function typedFeedback(e, typed) {
  const res = typed.res, v = verdictOf(res);
  const box = h("div", { class: "ta-fb ta-" + v.tone, role: "status" });
  if (v.title) box.append(h("b", null, v.title));
  box.append(h("div", { class: "small" }, h("span", { class: "muted" }, "You typed: "), h("span", { class: "ta-typed" }, typed.text)));
  if (res.kind === "tones") {
    const syl = Engine.syllables(e.p);
    box.append(h("div", { class: "small" }, h("span", { class: "muted" }, "Tones: "),
      h("span", { class: "py ta-py" }, syl.map((x, i) => [i ? " " : "", h("span", { class: res.wrong.includes(i) ? "ta-bad" : null }, x.text)]))));
  } else if (res.kind === "close") {
    box.append(h("div", { class: "small" }, h("span", { class: "muted" }, "Answer: "),
      h("span", { class: "hz" }, [...disp(e)].map((c, i) => h("span", { class: res.wrong.includes(i) ? "ta-bad" : null }, c)))));
  } else if (res.match && res.kind !== "nomatch") box.append(h("div", { class: "small" }, h("span", { class: "muted" }, "Matched: "), res.match));
  if (v.line) box.append(h("div", { class: "small muted" }, v.line));
  return box;
}
/** A Sentence card's sentence: the word as a gap (front) or highlighted (back). Other words open on tap. */
function clozeLine(cz, e, shown) {
  const form = clozeForm(e), n = [...form].length;
  const part = t => { const sp = h("span", { class: "cz-part" }); if (t) drawReader(sp, t); return sp; };
  const gap = shown ? h("mark", { class: "cz-word" }, rubyHz(disp(e), e.p))
    : h("span", { class: "cz-gap", role: "img", "aria-label": "missing word, " + n + (n === 1 ? " character" : " characters") }, Array.from({ length: n }, () => h("span", { class: "cz-box" })));
  const line = h("div", { class: "cz-line", lang: "zh" }, part(cz.zh.slice(0, cz.at)), gap, part(cz.zh.slice(cz.at + form.length)));
  line.addEventListener("click", ev => { const b = ev.target.closest(".w"); if (b) openWord(b.dataset.form); });
  return line;
}

/** The "+N XP" for this session: counts up with a little pop when you earn XP. */
/** The "+N XP" badge of a round: counts up with a bump and a floating "+n" when XP was just earned.
 *  holder: the round (flashcards' study, or the tone trainer's drill) with xp and shownXp. */
function xpBadge(holder = study) {
  const el = h("span", { class: "badge hsk num study-xp" }, "+" + (holder.shownXp || 0) + " XP");
  const from = holder.shownXp || 0, to = holder.xp;
  holder.shownXp = to;
  if (to > from) requestAnimationFrame(() => {
    el.classList.add("bump");
    el.append(h("span", { class: "xp-gain", "aria-hidden": "true" }, "+" + (to - from)));
    const t0 = performance.now(), dur = 450;
    const step = now => {
      const f = Math.min(1, (now - t0) / dur);
      el.firstChild.nodeValue = "+" + Math.round(from + (to - from) * (1 - Math.pow(1 - f, 3))) + " XP";
      if (f < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  return el;
}

/* Characters drawing themselves (Settings → Flashcards → Draw characters on cards): when a card shows
 * its characters, each one is drawn quickly, stroke by stroke, and stays as the drawn character (no
 * switch back to the font). The real text stays underneath for screen readers and copying. On the
 * front of a Meaning card that's already been answered, the drawn characters just appear. Display
 * only: it never touches your flashcards. Skipped with reduced motion, without Hanzi Writer, or when a
 * character's stroke shapes aren't loaded within 0.9 s (the text then shows as usual). */
const DRAW = { speed: 5, gap: 15, wait: 900 };
function drawSoon(ruby, animate = true) {
  if (!state.drawChars || !writerReady()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) animate = false;
  // Hidden from the very start, and drawn as soon as the card is on the page (before the screen
  // repaints), so the font's version of the characters never flashes up first.
  ruby.classList.add("drawing");
  const go = () => { if (ruby.isConnected) drawChars(ruby, animate); else ruby.classList.remove("drawing"); };
  queueMicrotask(() => (ruby.isConnected ? go() : setTimeout(go, 0)));
}
function drawChars(ruby, animate) {
  const hz = ruby.querySelector(".hz");
  if (!hz) return;
  // one span per character (they already exist when the pinyin matches; otherwise make them)
  if (!hz.children.length) { const t = hz.textContent; hz.replaceChildren(...[...t].map(c => h("span", null, c))); }
  const spans = [...hz.children].filter(sp => Engine.isCJK(sp.textContent));
  if (!spans.length) return;
  // tone colours, read with the text briefly unhidden (no repaint happens in between)
  ruby.classList.remove("drawing");
  const colors = spans.map(sp => getComputedStyle(sp).color);
  ruby.classList.add("drawing");   // the text waits hidden while the stroke shapes load
  const late = new Promise(r => setTimeout(() => r(null), DRAW.wait));
  Promise.race([Promise.all(spans.map(sp => CharData.strokes(sp.textContent))), late]).then(datas => {
    if (!datas || datas.some(d => !d) || !ruby.isConnected) { ruby.classList.remove("drawing"); return; }
    spans.forEach((sp, i) => {
      const ch = sp.textContent, r = sp.getBoundingClientRect(), size = Math.round(Math.max(r.width, 16));
      const color = colors[i];
      const box = h("span", { class: "fc-draw", "aria-hidden": "true" });
      sp.replaceChildren(h("span", { class: "visually-hidden" }, ch), box);
      sp.classList.add("drawn");
      sp.style.width = size + "px"; sp.style.height = size + "px";
      const w = window.HanziWriter.create(box, ch, {
        width: size, height: size, padding: Math.round(size * 0.04), showOutline: false, showCharacter: !animate,
        strokeColor: color, radicalColor: null, strokeAnimationSpeed: DRAW.speed, delayBetweenStrokes: DRAW.gap,
        charDataLoader: (c, onLoad) => onLoad(datas[i]),
      });
      sp.style.color = color;
      if (animate) w.animateCharacter();
    });
    ruby.classList.remove("drawing");
  });
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
        stat(streak(), "day streak")));
  }
  const ring = goalRing();
  if (ring) box.append(ring);
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
    bar, rankLine(lv.level));
}
/** Your rank under the level bar, and how far the next one is. */
function rankLine(level) {
  const { next } = rankFor(level);
  const left = next ? next.lv - level : 0;
  return h("div", { class: "rank-line" }, rankChip(level),
    next ? h("span", { class: "muted small" }, left + (left === 1 ? " level" : " levels") + " to ", state.showLocked ? h("span", { class: "hz" }, next.s) : "the next rank")
      : h("span", { class: "muted small" }, "The highest rank"));
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
  else if (study.revealed && ev.key === "Enter" && study.suggest && !(t && t.closest && t.closest("button, a"))) { ev.preventDefault(); grade(study.suggest); }
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
