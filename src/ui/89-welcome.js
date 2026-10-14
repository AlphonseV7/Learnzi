/* LearnZì UI, part 7a: the first-time welcome and the tour.
 * Welcome: 你好 brushed in, then four quick questions — your starter animal, your name, your favourite
 * colour (the accent colour) and how much Chinese you know (first decks, new words a day, pinyin, word
 * of the day, Reader sample). Nothing is saved until the end, and it waits for sync, so a new device
 * for an account that already has its settings never sees it.
 * Tour: your avatar lights up each part of the screen in turn: top bar, the four tab characters (said
 * aloud), a word to tap, flashcards and Home's boxes, then the 始 badge. Skippable; Settings → Replay. */

// ---------- welcome ----------
const WZ_COLOURS = [["", "Theme's own"], ["#d23a2f", "Red"], ["#e07b1f", "Orange"], ["#c08d00", "Gold"], ["#2f9e5b", "Green"],
  ["#13958f", "Teal"], ["#2f6fd6", "Blue"], ["#7b4fd1", "Purple"], ["#d6457f", "Pink"]];
let wz = null;
function startWelcome() {
  if ($("#welcome")) return;
  wz = { step: 0, animal: (state.avatar && state.avatar.starter) || "panda", name: state.nickname || "", accent: state.accent || "", level: state.level || "new", keepAccent: state.accent || "" };
  const ov = h("div", { class: "welcome", id: "welcome", role: "dialog", "aria-modal": "true", "aria-label": "Welcome to LearnZì" });
  document.body.append(ov);
  drawWelcome();
}
const WZ_STEPS = 5;
function drawWelcome() {
  const ov = $("#welcome");
  if (!ov) return;
  const s = wz.step;
  const dots = h("div", { class: "wz-dots", "aria-hidden": "true" }, Array.from({ length: WZ_STEPS - 1 }, (_, i) => h("i", { class: i < s ? "on" : "" })));
  const body = h("div", { class: "wz-body" });
  const next = h("button", { class: "btn primary big-btn", type: "button" }, s === 0 ? "Let's go" : s === WZ_STEPS - 1 ? "Finish" : "Next");
  const back = s > 0 ? h("button", { class: "btn", type: "button", onclick: () => { wz.step--; drawWelcome(); } }, "Back") : null;
  next.addEventListener("click", () => { if (s === WZ_STEPS - 1) finishWelcome(); else { wz.step++; drawWelcome(); } });
  if (s === 0) {
    body.append(
      h("div", { class: "wz-hello", "aria-hidden": "true" }, h("span", { class: "hz" }, "你"), h("span", { class: "hz" }, "好")),
      h("p", { class: "wz-py" }, "nǐ hǎo · hello"),
      h("h2", null, "Welcome to LearnZì"),
      h("p", { class: "muted" }, "Four quick questions and you're ready."));
  } else if (s === 1) {
    const grid = h("div", { class: "wz-animals" });
    for (const id of STARTERS) {
      const it = AV.animal[id], on = wz.animal === id;
      grid.append(h("button", { class: "wz-animal", type: "button", "aria-pressed": String(on), onclick: () => { wz.animal = id; drawWelcome(); } },
        avatarSvg({ ...AV_DEFAULT, animal: id, expr: on ? "happy" : "calm" }, 72, it.label), h("b", { class: "small" }, it.label), h("span", { class: "hz small muted" }, it.zh)));
    }
    body.append(h("h2", null, "Pick your companion"),
      h("p", { class: "muted small" }, "Yours from day one. The other four join you at levels 2 to 5."), grid);
  } else if (s === 2) {
    const inp = h("input", { type: "text", id: "wz-name", maxlength: "24", value: wz.name, placeholder: "Your name", autocomplete: "nickname", spellcheck: "false", "aria-label": "Your name" });
    inp.addEventListener("input", () => { wz.name = inp.value; });
    inp.addEventListener("keydown", ev => { if (ev.key === "Enter") next.click(); });
    body.append(h("div", { class: "wz-me" }, avatarSvg({ ...AV_DEFAULT, animal: wz.animal, expr: "wink" }, 72, AV.animal[wz.animal].label)),
      h("h2", null, "What should I call you?"), inp,
      h("button", { class: "plain-btn build-link small", type: "button", onclick: () => { wz.name = ""; wz.step++; drawWelcome(); } }, "Skip"));
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  } else if (s === 3) {
    const sw = h("div", { class: "wz-colours", role: "group", "aria-label": "Favourite colour" });
    const pick = c => { wz.accent = c; state.accent = c; applyLook(); drawWelcome(); };
    for (const [c, name] of WZ_COLOURS) {
      sw.append(h("button", { class: "wz-colour" + (c ? "" : " theme"), type: "button", "aria-pressed": String(wz.accent === c), "aria-label": name, title: name, style: c ? "--c: " + c : null, onclick: () => pick(c) },
        c ? null : h("span", { class: "small" }, "Theme")));
    }
    const custom = h("input", { type: "color", "aria-label": "Any colour", value: wz.accent || "#c2362b" });
    custom.addEventListener("input", () => { wz.accent = custom.value.toLowerCase(); state.accent = wz.accent; applyLook(); });
    body.append(h("h2", null, "Pick your favourite colour"),
      h("p", { class: "muted small" }, "It becomes the colour of buttons and highlights. Change it any time in Customise → Theme."),
      sw, h("label", { class: "row small wz-custom" }, custom, "Or any colour you like"));
  } else {
    const list = h("div", { class: "wz-levels", role: "radiogroup", "aria-label": "How much Chinese do you know?" });
    for (const [k, L] of Object.entries(LEVELS)) {
      list.append(h("button", { class: "wz-level", type: "button", role: "radio", "aria-checked": String(wz.level === k), onclick: () => { wz.level = k; drawWelcome(); } },
        h("span", { class: "wz-level-top" }, h("b", null, L.label), h("span", { class: "hz muted" }, L.zh)),
        h("span", { class: "muted small" }, L.note)));
    }
    const L = LEVELS[wz.level];
    body.append(h("h2", null, "How much Chinese do you know?"), list,
      h("p", { class: "muted small" }, "You'll start with " + L.decks.filter(d => d !== "starred").map(deckName).join(" and ") + ", " + L.perDay + " new words a day. Change any of it in Settings."));
  }
  const card = h("div", { class: "card welcome-card" + (s === 0 ? " intro" : "") }, s > 0 ? dots : null, body,
    h("div", { class: "row wz-buttons" }, back, next));
  if (s === 0) card.append(h("button", { class: "plain-btn build-link small wz-skip", type: "button", onclick: skipWelcome }, "Skip set-up"));
  ov.replaceChildren(card);
}
function skipWelcome() {
  commit({ onboarded: true, toured: true });
  closeWelcome();
}
function closeWelcome() {
  const ov = $("#welcome");
  if (!ov) return false;
  ov.classList.add("out");
  setTimeout(() => ov.remove(), 350);
  wz = null;
  return true;
}
function finishWelcome() {
  const L = LEVELS[wz.level];
  const av = { ...sanitizeAvatar(state.avatar), animal: wz.animal, starter: wz.animal };
  commit({ avatar: av, nickname: cleanLine(wz.name, 24), accent: wz.accent, level: wz.level, activeDecks: [...L.decks], newPerDay: L.perDay, onboarded: true });
  applyLook();
  updateTopbar();
  closeWelcome();
  go("home");
  setTimeout(startTour, 450);
}

// ---------- tour ----------
const TAB_WORDS = [
  ["home", "家", "jiā", "home", "Home: your day at a glance."],
  ["study", "学", "xué", "study", "Study: Review today's flashcards, My decks, My cards, Look up and Grammar."],
  ["tools", "具", "jù", "tool", "Tools: the Reader, Watch & listen, Photo to words, the Tone trainer and My journey."],
  ["myzi", "字", "zì", "character", "My Zì: my cards, decks, badges and progress."],
];
const navBtn = key => document.querySelector('.nav [data-view="' + key + '"], .nav [data-menu="' + key + '"]');
const TOUR = [
  { say: () => [h("b", null, "Hi" + (state.nickname ? " " + state.nickname : "") + ", I'm your " + AV.animal[wornAvatar().animal].label.toLowerCase() + "."), " I'll show you around. It takes about a minute."] },
  { at: () => $("#me"), say: () => ["That's me, up here with your name. Tap me any time to dress me up, change the clock or pick a theme."] },
  { at: () => [$("#lvl"), $("#xpbar")], say: () => ["Your Zì level and XP. The capsule fills up as you study, every level unlocks something, and you'll climb the old imperial exam ranks on the way."] },
  ...TAB_WORDS.map(([key, c, p, en, text]) => ({ at: () => navBtn(key), nav: true, word: { c, p, en }, say: () => [text] })),
  { at: () => document.querySelector(".wotd .glyph"), wait: "panel", say: () => [h("b", null, "Try it: "), "tap the word of the day."] },
  { at: () => $("#panel"), say: () => ["Every word opens like this: the meaning, a voice to hear it, stroke order and examples. Tap ☆ to save it to My cards."], leave: () => closePanel() },
  { at: () => document.querySelector(".wotd"), say: tourPinyin },
  { at: () => document.querySelector(".study-prompt"), say: () => ["Flashcards come back just before you'd forget them. After each one, tell me how it went: Again, Hard, Good or Easy."] },
  { at: () => document.querySelector(".view > .fold .fold-head"), say: () => ["Tap a box's title to fold it. Hold ⠿ to move it, and × removes it. Make Home yours."] },
  { finish: true, word: { c: "加油", p: "jiāyóu", en: "you've got this" }, say: () => ["Here's your first badge. See you at your first flashcard!"] },
];
/** The pinyin and tone colours step: two switches that change the real settings, so you see them
 *  on the word of the day straight away. */
function tourPinyin() {
  const sw = (key, label) => {
    const b = h("button", { class: "chip filter-chip", type: "button", "aria-pressed": String(!!state[key]) }, label);
    b.addEventListener("click", () => { commit({ [key]: !state[key] }); applyLook(); b.setAttribute("aria-pressed", String(!!state[key])); });
    return b;
  };
  return [h("b", null, "Pinyin and tone colours. "), "Pinyin shows how to say each character; tone colours paint each of the four tones its own colour. Both start off. Try them:",
    h("span", { class: "row tour-toggles" }, sw("pinyin", "Pinyin"), sw("tones", "Tone colours")),
    h("span", { class: "muted small" }, "Change them any time in Settings → Reading.")];
}
let tour = null;
function startTour() {
  if ($("#tour") || mleOn()) return;
  closePanel();
  if (ui.view !== "home") go("home");
  window.scrollTo({ top: 0 });
  tour = { i: 0, raf: 0 };
  const layer = h("div", { class: "tour", id: "tour" }, h("div", { class: "tour-block" }), h("div", { class: "tour-hole" }), h("div", { class: "tour-card card", role: "dialog", "aria-live": "polite", "aria-label": "Tour" }));
  document.body.append(layer);
  window.addEventListener("resize", placeTour);
  window.addEventListener("scroll", placeTour, { passive: true });
  showTourStep(0, 1);
}
const tourTargets = st => (st && st.at ? [].concat(st.at()).filter(el => el && el.isConnected && el.getClientRects().length) : []);
function showTourStep(i, dir) {
  const layer = $("#tour");
  if (!layer) return;
  const prev = TOUR[tour.i];
  if (prev && prev.leave && i !== tour.i) prev.leave();
  // On a computer the menu bar hides at the left edge: slide it out for the four tab steps.
  const nav = document.querySelector(".nav");
  if (nav) nav.classList.remove("tour-shown");
  // Steps whose target isn't on screen (a box you removed, say) are skipped.
  while (i >= 0 && i < TOUR.length && TOUR[i].at && !tourTargets(TOUR[i]).length) i += dir || 1;
  if (i < 0) i = 0;
  if (i >= TOUR.length) { finishTour(true); return; }
  tour.i = i;
  const st = TOUR[i];
  if (st.nav && nav) nav.classList.add("tour-shown");
  showBar();
  const targets = tourTargets(st);
  if (targets.length && !st.nav && targets[0].id !== "panel") targets[0].scrollIntoView({ block: "center" });
  layer.classList.toggle("waiting", !!st.wait);
  const card = layer.querySelector(".tour-card");
  const word = st.word ? h("div", { class: "tour-word" },
    h("button", { class: "tour-zh hz plain-btn", type: "button", "aria-label": "Hear " + st.word.c, onclick: () => speak(st.word.c) }, st.word.c),
    h("div", { class: "stack-tight" }, h("span", { class: "tour-py" }, st.word.p), h("span", { class: "muted small" }, st.word.en))) : null;
  const n = TOUR.length;
  card.replaceChildren(
    h("div", { class: "tour-guide" }, liveAvatar(56, "Your guide"), h("div", { class: "tour-say" }, word, h("p", null, ...st.say()))),
    h("div", { class: "row tour-buttons" },
      h("span", { class: "muted small num" }, (i + 1) + " / " + n),
      st.finish ? null : h("button", { class: "plain-btn build-link small", type: "button", onclick: () => finishTour(false) }, "Skip tour"),
      i > 0 && !st.finish ? h("button", { class: "btn small", type: "button", onclick: () => showTourStep(i - 1, -1) }, "Back") : null,
      st.wait ? null : h("button", { class: "btn primary small", type: "button", onclick: () => (st.finish ? finishTour(true) : showTourStep(i + 1, 1)) }, st.finish ? "Start learning" : "Next")));
  if (st.word) setTimeout(() => speak(st.word.c), 250);
  setMood(st.finish ? "happy" : i === 0 ? "wink" : "calm", st.finish ? 0 : 1600);
  if (st.wait === "panel") {
    const watchPanel = () => { if (!$("#tour") || tour.i !== i) return; if ($("#panel") && $("#panel").classList.contains("open")) setTimeout(() => showTourStep(i + 1, 1), 450); else setTimeout(watchPanel, 200); };
    watchPanel();
  }
  requestAnimationFrame(placeTour);
}
function placeTour() {
  const layer = $("#tour");
  if (!layer || !tour) return;
  const st = TOUR[tour.i], hole = layer.querySelector(".tour-hole"), card = layer.querySelector(".tour-card");
  const targets = tourTargets(st);
  if (!targets.length) {
    layer.classList.add("no-target");
    card.classList.remove("at-bottom", "at-top"); card.classList.add("middle");
    return;
  }
  layer.classList.remove("no-target"); card.classList.remove("middle");
  const rs = targets.map(t => t.getBoundingClientRect());
  const r = { left: Math.min(...rs.map(x => x.left)), top: Math.min(...rs.map(x => x.top)), right: Math.max(...rs.map(x => x.right)), bottom: Math.max(...rs.map(x => x.bottom)) };
  const pad = 6;
  Object.assign(hole.style, { left: (r.left - pad) + "px", top: (r.top - pad) + "px", width: (r.right - r.left + pad * 2) + "px", height: (r.bottom - r.top + pad * 2) + "px" });
  // The card sits on the other half of the screen from what's lit up.
  const below = (r.top + r.bottom) / 2 < window.innerHeight * 0.5;
  card.classList.toggle("at-bottom", below);
  card.classList.toggle("at-top", !below);
}
function finishTour(done) {
  const layer = $("#tour");
  const st = tour && TOUR[tour.i];
  if (st && st.leave) st.leave();
  window.removeEventListener("resize", placeTour);
  window.removeEventListener("scroll", placeTour);
  if (document.querySelector(".nav")) document.querySelector(".nav").classList.remove("tour-shown");
  if (layer) { layer.classList.add("out"); setTimeout(() => layer.remove(), 300); }
  tour = null;
  commit({ toured: true });
  if (done) { earnBadge("begin"); setMood("happy", 2500); }
  else toast("Tour skipped. Replay it any time in Settings → Reset.");
  return !!layer;
}
const closeTour = () => ($("#tour") ? finishTour(false) : false);

/** On start: the welcome for someone new (after sync has had its say), the tour if it wasn't finished,
 *  and any badges your progress has already earned. */
function firstRun() {
  Promise.race([Sync.settled, new Promise(r => setTimeout(r, 12000))]).then(() => {
    if (mleOn()) return;
    if (!state.onboarded) startWelcome();
    else if (!state.toured) { const go2 = () => (ui.dict === "ready" ? startTour() : setTimeout(go2, 300)); go2(); }
    const badges = () => (ui.dict === "ready" ? badgesOnStart() : setTimeout(badges, 500));
    badges();
  });
}
