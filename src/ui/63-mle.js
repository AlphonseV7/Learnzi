/* LearnZì UI, part 10b: MLE mode, the prize for solving the secret lock. LearnZì "reboots" into an app for
 * Multicultural London English: slang of the day, a two-way slang dictionary, flashcards (same spaced
 * repetition as the Chinese ones, kept separately in state.mle), a "Say it in MLE" quiz and its own level.
 * Back to LearnZì any time from Home, Me, or Debug settings. Words use the browser's UK English voice. */

const mleId = t => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "x";
const MLE = MLE_WORDS.map(([t, m, x, p, o, d, n, f]) => ({ id: mleId(t), t, m, x, p, o, d, n: n || "", rude: d === "rude" || f === "rude", older: f === "older" }));
const mleOn = () => !!(state.mle && state.mle.on);
const mleWords = (deck) => MLE.filter(w => (state.mle.rude || !w.rude) && (!deck || w.d === deck));
const mleXp = () => Object.values(state.mle.cards).reduce((t, c) => t + c[6], 0) + state.mle.quizXp;
const mleLevel = () => SRS.levelInfo(mleXp());
const mleToday = () => { const k = SRS.dayKey(clock()); return state.mle.act[k] || [0, 0]; };

function setMle(patch) { commit({ mle: { ...state.mle, ...patch } }); }
function enterMle() {
  closePanel();
  setMle({ on: true, unlocked: true });
  applyLook(); updateTopbar();
  go("home");
}
function leaveMle() {
  setMle({ on: false });
  mleStudy.active = false;
  applyLook(); updateTopbar();
  go("home");
  toast("Back to LearnZì");
}
function mleLevelCheck(before) {
  const now = mleLevel().level;
  if (now > before) { toast("Level up! You're MLE level " + now + " now, fam 🔥"); if (state.sounds) chiptune(0.1); }
}

// ---------- the UK voice ----------
let enVoice = null;
function speakEN(text) {
  if (!("speechSynthesis" in window)) { toast("This app can't use the browser voice. Try LearnZì in Chrome."); return; }
  if (!enVoice) { const vs = speechSynthesis.getVoices(); enVoice = vs.find(v => /^en[-_]GB/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-GB"; if (enVoice) u.voice = enVoice; u.rate = 1;
  speechSynthesis.speak(u);
}
const sayBtn = (text, label) => ("speechSynthesis" in window
  ? h("button", { class: "btn icon", type: "button", "aria-label": label || "Listen", onclick: () => speakEN(text) }, icon("play")) : null);

/** One slang word in full: the word, meaning, example and plain English, where it comes from. */
function mleWordBox(w, cls) {
  return h("div", { class: "card mle-word" + (cls ? " " + cls : "") },
    h("div", { class: "row spread mle-word-top" },
      h("div", { class: "row" }, h("b", { class: "mle-term" }, w.t),
        w.rude ? h("span", { class: "badge mle-rude" }, "rude") : null, w.older ? h("span", { class: "badge" }, "older") : null),
      sayBtn(w.t + ". " + w.x, "Listen to " + w.t)),
    h("p", { class: "mle-meaning" }, w.m),
    h("p", { class: "mle-ex" }, "“" + w.x + "”"),
    h("p", { class: "muted small mle-plain" }, "= " + w.p),
    h("p", { class: "muted small" }, h("b", null, "From: "), w.o),
    w.n ? h("p", { class: "small mle-note" }, w.n) : null);
}

// ---------- pages ----------
function viewMleHome() {
  const v = h("section", { class: "view mle" });
  const hr = new Date(clock()).getHours();
  const name = state.nickname || "fam";
  v.append(h("div", { class: "card mle-greet" },
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, "Greeting"), sayBtn("Wagwan, " + name + "! " + (hr < 12 ? "You good this morning?" : "You good?"))),
    h("p", { class: "mle-big" }, "Wagwan, " + name + "!"),
    h("p", { class: "muted" }, (hr < 12 ? "Morning! " : "") + "Hello, " + (state.nickname || "friend") + ". You good?")));
  const pool = mleWords();
  const day = Math.floor((clock() - new Date(clock()).getTimezoneOffset() * 60e3 - 4 * 3600e3) / 86400e3);
  const w = pool[((day * 7) % pool.length + pool.length) % pool.length];
  if (w) {
    const box = mleWordBox(w, "mle-wotd");
    box.prepend(h("span", { class: "eyebrow" }, "Slang of the day"));
    v.append(box);
  }
  const plan = mlePlan();
  const ready = plan.due.length + plan.fresh.length;
  v.append(h("div", { class: "card stack" },
    h("span", { class: "eyebrow" }, "Today's flashcards"),
    h("div", { class: "row spread" }, h("b", null, ready ? ready + (ready === 1 ? " card ready" : " cards ready") : "All caught up, bruv"),
      ready ? h("button", { class: "btn primary", type: "button", onclick: () => startMleStudy() }, "Study now") : h("button", { class: "btn", type: "button", onclick: () => go("decks") }, "Decks"))));
  v.append(h("div", { class: "card stack" },
    h("span", { class: "eyebrow" }, "Say it in MLE"),
    h("p", { class: "muted" }, "Ten quick questions: what words mean, and how you'd say it in MLE. 2 XP each."),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => startMleQuiz() }, "Start the quiz"))));
  v.append(h("div", { class: "card stack shank-card" },
    h("span", { class: "eyebrow" }, "Shank"),
    h("p", { class: "muted" }, "Slice the screen in half. Nothing gets hurt, it's just the app."),
    h("div", { class: "row" }, h("button", { class: "btn primary shank-btn", type: "button", onclick: shankScreen }, "🔪 Shank"))));
  v.append(h("div", { class: "card stack" },
    h("span", { class: "eyebrow" }, "What's MLE?"),
    h("p", null, "Multicultural London English is how loads of young Londoners talk, whatever their background. It grew from the 1980s on, mixing Jamaican Patois, West African and South Asian languages, Arabic, Cockney and US hip-hop. Linguists treat it as a dialect of its own, with its own grammar: \"man\" can mean \"I\", \"innit\" works after any sentence, and \"this is me:\" introduces what someone said.")));
  v.append(h("div", { class: "card stack" },
    h("span", { class: "eyebrow" }, "Back to LearnZì"),
    h("p", { class: "muted" }, "Your Chinese progress is waiting, untouched. You can come back here from Debug settings."),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: leaveMle }, icon("back"), "Back to LearnZì"))));
  return v;
}

let mleQuery = "";
function viewMleDict() {
  const v = h("section", { class: "view mle" });
  const input = h("input", { id: "mq", type: "search", placeholder: "wagwan, friend or money…", autocomplete: "off", "aria-label": "Search the slang dictionary" });
  input.value = mleQuery;
  const out = h("div", { class: "results", id: "results" });
  const fill = () => {
    const q = mleQuery.trim().toLowerCase();
    out.replaceChildren();
    const hits = mleWords().filter(w => !q || w.t.toLowerCase().includes(q) || w.m.toLowerCase().includes(q) || w.p.toLowerCase().includes(q));
    if (!hits.length) { out.append(h("div", { class: "empty" }, "Nothing for “" + mleQuery + "”. Try another word.")); return; }
    for (const [deck, d] of Object.entries(MLE_DECKS)) {
      const list = hits.filter(w => w.d === deck);
      if (!list.length) continue;
      out.append(h("div", { class: "stack lookup-group", "data-keep": "" }, h("h2", { class: "h-card" }, d.icon + " " + d.label + " · " + list.length),
        h("div", { class: "results" }, list.map(w => mleWordBox(w)))));
    }
    foldify(out, "mledict", ":scope > .lookup-group");
  };
  input.addEventListener("input", () => { mleQuery = input.value; clearTimeout(searchTimer); searchTimer = setTimeout(fill, 120); });
  v.append(h("div", { class: "search-row" }, h("div", { class: "search", role: "search" }, h("span", { class: "mag" }, icon("search")), input)));
  v.append(h("p", { class: "muted small hint" }, mleWords().length + " words and phrases. Search the slang or the plain English (e.g. \"friend\" finds bruv, fam, blud and bredrin)."));
  v.append(out);
  fill();
  return v;
}

// ---------- flashcards ----------
const mleStudy = { active: false, queue: [], cur: null, revealed: false, done: 0, xp: 0, deck: null };
function mleKeysFor(w) {
  const keys = [w.id + "|m"];
  const m = state.mle.cards[w.id + "|m"];
  const known = m && m[7] === 2 && SRS.dayKey(m[3] * 60000) !== SRS.dayKey(clock()) ? SRS.stability(m) : 0;
  if (known >= 3 || state.mle.cards[w.id + "|r"]) keys.push(w.id + "|r");
  return keys;
}
function mlePlan(deck) {
  const due = [], fresh = [], now = clock();
  for (const w of mleWords(deck)) for (const k of mleKeysFor(w)) {
    const c = state.mle.cards[k];
    if (!c) fresh.push({ k, w }); else if (SRS.isDue(c, now)) due.push({ k, w, due: c[2] });
  }
  due.sort((a, b) => a.due - b.due);
  const left = Math.max(0, state.newPerDay - mleToday()[0]);
  return { due, fresh: fresh.slice(0, left) };
}
function startMleStudy(deck = null) {
  const plan = mlePlan(deck);
  const queue = [];
  let d = 0, f = 0;
  while ((d < plan.due.length || f < plan.fresh.length) && queue.length < 40) {
    for (let i = 0; i < 3 && d < plan.due.length; i++) queue.push(plan.due[d++]);
    if (f < plan.fresh.length) queue.push(plan.fresh[f++]);
  }
  if (!queue.length) { toast("Nothing due, bruv. Come back later or try the quiz."); return; }
  Object.assign(mleStudy, { active: true, queue, cur: queue.shift(), revealed: false, done: 0, xp: 0, deck });
  go("study");
}
function mleGrade(g) {
  const cur = mleStudy.cur;
  if (!cur || !mleStudy.revealed) return;
  const before = mleLevel().level;
  const old = state.mle.cards[cur.k];
  const next = SRS.review(old, g, clock());
  const key = SRS.dayKey(clock());
  const act = [...(state.mle.act[key] || [0, 0])];
  if (!old) act[0]++;
  act[1]++;
  setMle({ cards: { ...state.mle.cards, [cur.k]: next }, act: { ...state.mle.act, [key]: act } });
  mleStudy.xp += SRS.XP_FOR[g]; mleStudy.done++;
  if (SRS.isLearning(next)) mleStudy.queue.splice(Math.min(3, mleStudy.queue.length), 0, cur);
  mleStudy.cur = mleStudy.queue.shift() || null;
  mleStudy.revealed = false;
  mleLevelCheck(before);
  render(false);
}
function viewMleStudy() {
  const v = h("section", { class: "view mle study" });
  if (!mleStudy.active) { v.append(h("div", { class: "empty" }, "No flashcards open. ", h("button", { class: "btn primary", type: "button", onclick: () => startMleStudy() }, "Study now"))); return v; }
  const total = mleStudy.done + mleStudy.queue.length + (mleStudy.cur ? 1 : 0);
  const bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = (total ? (mleStudy.done / total) * 100 : 100) + "%";
  v.append(h("div", { class: "row spread" }, h("span", { class: "muted small num" }, mleStudy.cur ? Math.min(mleStudy.done + 1, total) + " of " + total : "Done"),
    h("span", { class: "badge hsk num" }, "+" + mleStudy.xp + " XP")), bar);
  const cur = mleStudy.cur;
  if (!cur) {
    mleStudy.active = false;
    v.append(h("div", { class: "card summary" }, h("h2", null, "Sorted! 💯"), h("p", null, "You did " + mleStudy.done + " cards and got " + mleStudy.xp + " XP."),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => go("home") }, "Done"), h("button", { class: "btn", type: "button", onclick: () => startMleQuiz() }, "Quiz me"))));
    return v;
  }
  const w = cur.w, recall = cur.k.endsWith("|r");
  const card = h("div", { class: "card flashcard mle-card" },
    h("span", { class: "eyebrow" }, recall ? "How do you say it in MLE?" : "What does it mean?" + (state.mle.cards[cur.k] ? "" : " · new")),
    h("div", { class: "fc-front" }, recall ? h("p", { class: "mle-meaning big" }, w.m) : h("b", { class: "mle-term huge" }, w.t)));
  if (!mleStudy.revealed) {
    card.append(h("button", { class: "btn primary big-btn", type: "button", id: "mle-reveal", onclick: () => { mleStudy.revealed = true; render(false); } }, "Show answer"));
  } else {
    card.append(mleWordBox(w, "mle-answer"));
    const labels = SRS.preview(state.mle.cards[cur.k], clock());
    card.append(h("div", { class: "grades" }, [["Again", 1], ["Hard", 2], ["Good", 3], ["Easy", 4]].map(([l, g]) =>
      h("button", { class: "grade g" + g, type: "button", onclick: () => mleGrade(g) }, h("b", null, l), h("span", { class: "small" }, labels[g - 1])))));
  }
  v.append(card);
  return v;
}
function mleKeys(ev) {
  if (!mleOn() || ui.view !== "study" || !mleStudy.active) return false;
  if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return false;
  if (ev.key === " " && !mleStudy.revealed) { ev.preventDefault(); mleStudy.revealed = true; render(false); return true; }
  if (mleStudy.revealed && /^[1-4]$/.test(ev.key)) { ev.preventDefault(); mleGrade(Number(ev.key)); return true; }
  return false;
}

function viewMleDecks() {
  const v = h("section", { class: "view mle" });
  const plan = mlePlan();
  v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "All decks"),
    h("div", { class: "stats" }, stat(plan.due.length, "due"), stat(plan.fresh.length, "new today"), stat(Object.keys(state.mle.cards).length, "cards started")),
    h("button", { class: "btn primary big-btn", type: "button", onclick: () => startMleStudy() }, "Study all decks")));
  for (const [deck, d] of Object.entries(MLE_DECKS)) {
    if (deck === "rude" && !state.mle.rude) continue;
    const words = mleWords(deck), p = mlePlan(deck);
    const learnt = words.filter(w => { const c = state.mle.cards[w.id + "|m"]; return c && c[7] === 2; }).length;
    v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, d.icon + " " + d.label),
      h("p", { class: "muted small" }, words.length + " words · " + learnt + " learnt · " + p.due.length + " due"),
      h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: () => startMleStudy(deck) }, "Study this deck"))));
  }
  return v;
}

// ---------- the quiz: say it in MLE ----------
const mleQuiz = { active: false, qs: [], i: 0, picked: null, right: 0, xp: 0 };
function startMleQuiz() {
  const pool = shuffle([...mleWords()]);
  const qs = pool.slice(0, 10).map((w, i) => {
    const type = ["tm", "mt", "sx"][i % 3];
    const others = shuffle(mleWords().filter(o => o.id !== w.id)).slice(0, 3);
    const opt = o => (type === "tm" ? o.m : type === "mt" ? o.t : o.x);
    return { w, type, prompt: type === "tm" ? w.t : type === "mt" ? w.m : w.p, options: shuffle([w, ...others]).map(o => ({ text: opt(o), right: o.id === w.id })) };
  });
  Object.assign(mleQuiz, { active: true, qs, i: 0, picked: null, right: 0, xp: 0 });
  go("tones");
}
function viewMleQuiz() {
  const v = h("section", { class: "view mle" });
  if (!mleQuiz.active) {
    v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "Say it in MLE"),
      h("p", null, "Three kinds of question: what a word means, which word fits a meaning, and how you'd say a normal sentence in MLE."),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: startMleQuiz }, "Start the quiz"))));
    return v;
  }
  const total = mleQuiz.qs.length, q = mleQuiz.qs[mleQuiz.i];
  const bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = (mleQuiz.i / total) * 100 + "%";
  v.append(h("div", { class: "row spread" }, h("span", { class: "muted small num" }, Math.min(mleQuiz.i + 1, total) + " of " + total), h("span", { class: "badge hsk num" }, "+" + mleQuiz.xp + " XP")), bar);
  if (!q) {
    const r = mleQuiz.right;
    v.append(h("div", { class: "card summary" }, h("h2", null, r >= 8 ? "You're a don! 👑" : r >= 5 ? "Not bad, still 👊" : "Allow it, go again 😅"),
      h("div", { class: "stats" }, stat(r + " / " + total, "correct"), stat("+" + mleQuiz.xp, "XP")),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: startMleQuiz }, "Go again"), h("button", { class: "btn", type: "button", onclick: () => { mleQuiz.active = false; go("home"); } }, "Done"))));
    return v;
  }
  const ask = { tm: "What does this mean?", mt: "Which word means this?", sx: "How would you say this in MLE?" }[q.type];
  const card = h("div", { class: "card flashcard mle-card" }, h("span", { class: "eyebrow" }, ask),
    h("div", { class: "fc-front" }, q.type === "tm" ? h("b", { class: "mle-term huge" }, q.prompt) : h("p", { class: "mle-meaning big" }, q.type === "sx" ? "“" + q.prompt + "”" : q.prompt)));
  const opts = h("div", { class: "mle-opts" });
  q.options.forEach((o, k) => {
    const cls = mleQuiz.picked === null ? "" : o.right ? " right" : k === mleQuiz.picked ? " wrong" : " dim";
    opts.append(h("button", { class: "tone-opt mle-opt" + cls, type: "button", disabled: mleQuiz.picked !== null, onclick: () => {
      if (mleQuiz.picked !== null) return;
      mleQuiz.picked = k;
      if (o.right) {
        const before = mleLevel().level;
        mleQuiz.right++; mleQuiz.xp += 2;
        setMle({ quizXp: state.mle.quizXp + 2 });
        mleLevelCheck(before);
      }
      render(false);
    } }, o.text));
  });
  card.append(opts);
  if (mleQuiz.picked !== null) {
    const ok = q.options[mleQuiz.picked].right;
    card.append(h("b", { class: ok ? "t3" : "t1" }, ok ? "Bang on! ✅" : "Nah, not that one."), mleWordBox(q.w, "mle-answer"),
      h("button", { class: "btn primary big-btn", type: "button", id: "mle-next", onclick: () => { mleQuiz.i++; mleQuiz.picked = null; render(false); } }, mleQuiz.i + 1 < total ? "Next" : "See results"));
  }
  v.append(card);
  return v;
}

function viewMleMe() {
  const v = h("section", { class: "view mle" });
  const lv = mleLevel();
  v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "Your MLE level"), levelBar(lv),
    h("div", { class: "stats" }, stat(MLE.filter(w => { const c = state.mle.cards[w.id + "|m"]; return c && c[7] === 2; }).length, "words learnt"),
      stat(Object.keys(state.mle.cards).length, "cards started"), stat(mleXp(), "XP"))));
  const rude = h("input", { type: "checkbox", id: "mle-rude", role: "switch" });
  rude.checked = state.mle.rude;
  rude.addEventListener("change", () => { setMle({ rude: rude.checked }); toast(rude.checked ? "Rude words on. Mind your elders 👀" : "Rude words off"); render(false); });
  v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "Options"),
    h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: "mle-rude" }, "Rude words"),
      h("span", { class: "muted small" }, "Adds " + MLE.filter(w => w.rude).length + " properly rude words (swearing and insults) to the dictionary, flashcards and quiz.")),
      h("span", { class: "toggle" }, rude, h("span")))));
  v.append(h("div", { class: "card stack" }, h("span", { class: "eyebrow" }, "Back to LearnZì"),
    h("p", { class: "muted" }, "Leave MLE mode. Your MLE progress stays saved, and Debug settings has a button to come back."),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: leaveMle }, icon("back"), "Back to LearnZì"))));
  return v;
}

const MLE_VIEWS = { home: viewMleHome, lookup: viewMleDict, decks: viewMleDecks, deck: viewMleDecks, study: viewMleStudy, tones: viewMleQuiz, reader: viewMleQuiz, myzi: viewMleMe, me: viewMleMe, stats: viewMleMe };
const PAGES_MLE = {
  home: () => ({ title: "MLE mode", desc: "Multicultural London English. Learn the slang, innit." }),
  lookup: () => ({ title: "Dictionary", desc: "Every word with what it means, an example and where it comes from." }),
  decks: () => ({ title: "Decks", desc: "Flashcards, same system as your Chinese ones, kept separate." }),
  deck: () => ({ title: "Decks", desc: "Flashcards, same system as your Chinese ones, kept separate." }),
  study: () => ({ title: "Flashcards", desc: "Space to show the answer, then 1–4." }),
  tones: () => ({ title: "Say it in MLE", desc: "Quick-fire quiz. 2 XP for every right answer." }),
  reader: () => ({ title: "Say it in MLE", desc: "Quick-fire quiz. 2 XP for every right answer." }),
  myzi: () => ({ title: "Me", desc: "Your MLE level, options, and the way back to LearnZì." }),
  me: () => ({ title: "Me", desc: "Your MLE level, options, and the way back to LearnZì." }),
  stats: () => ({ title: "Me", desc: "Your MLE level, options, and the way back to LearnZì." }),
};
const NAV_MENUS_MLE = {
  study: [
    { zh: "🃏", label: "Flashcards", sub: () => { const p = mlePlan(); const n = p.due.length + p.fresh.length; return n ? n + " cards ready" : "All caught up"; }, run: () => startMleStudy() },
    { zh: "📚", label: "Decks", sub: () => "Slang by topic", run: () => go("decks") },
    { zh: "🔎", label: "Dictionary", sub: () => "Slang or plain English", run: () => go("lookup") },
  ],
  tools: [{ zh: "🎤", label: "Say it in MLE", sub: () => "Ten-question quiz", run: () => startMleQuiz() }],
};
/** Tab labels and icons for MLE mode (and back). */
function mleChrome() {
  const on = mleOn();
  const set = (sel, ico, text) => { const b = $(sel); if (!b) return; b.querySelector(".ico").textContent = ico; b.lastChild.textContent = text; };
  set(".nav button[data-view=home]", on ? "🏠" : "家", "Home");
  set(".nav button[data-menu=study]", on ? "🃏" : "学", on ? "Learn" : "Study");
  set(".nav button[data-menu=tools]", on ? "🎤" : "具", on ? "Quiz" : "Tools");
  set(".nav button[data-view=myzi]", on ? "😎" : "字", on ? "Me" : "My Zì");
}

// ---------- the Shank button: a blade of light slices the screen, the halves slide apart, then snap back ----------
let shanking = false;
function shankScreen() {
  if (shanking) return;
  shanking = true;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const flash = h("div", { class: "shank-flash", "aria-hidden": "true" });
  document.body.append(flash);
  shankSound();
  if (navigator.vibrate) try { navigator.vibrate([15, 40, 30]); } catch { /* fine */ }
  if (calm) { setTimeout(() => { flash.remove(); shanking = false; }, 500); return; }
  setTimeout(() => {
    // Two copies of the screen, each cut along the slash, slide apart while the real one hides.
    const app = $("#app"), zen = $("#zen");
    const half = side => {
      const wrap = h("div", { class: "shank-half " + side });
      const z = zen.cloneNode(true); z.removeAttribute("id");
      const a = app.cloneNode(true); a.removeAttribute("id"); a.style.top = (-window.scrollY) + "px";
      wrap.append(z, a);
      return wrap;
    };
    const layer = h("div", { class: "shank-layer", "aria-hidden": "true" }, half("a"), half("b"));
    document.body.append(layer);
    document.body.classList.add("shanked");
    requestAnimationFrame(() => layer.classList.add("apart"));
    setTimeout(() => layer.classList.remove("apart"), 1100);
    setTimeout(() => {
      layer.remove(); flash.remove();
      document.body.classList.remove("shanked");
      document.body.classList.add("shank-shake");
      setTimeout(() => { document.body.classList.remove("shank-shake"); shanking = false; }, 350);
    }, 1450);
  }, 160);
}
function shankSound() {
  if (!state.sounds) return;
  try {
    const ctx = audioCtxNow(); if (!ctx) return;
    const len = 0.32, buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime;
    f.type = "bandpass"; f.Q.value = 2; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(7000, t + len);
    g.gain.value = 0.25;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start(t);
    const o = ctx.createOscillator(), og = ctx.createGain();                 // a little metallic ring
    o.type = "triangle"; o.frequency.value = 2400;
    og.gain.setValueAtTime(0.0001, t + 0.12); og.gain.exponentialRampToValueAtTime(0.03, t + 0.14); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(og); og.connect(ctx.destination); o.start(t + 0.12); o.stop(t + 0.95);
  } catch { /* no sound here */ }
}
