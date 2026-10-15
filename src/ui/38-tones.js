/* LearnZì UI, part 6c: the tone trainer. Hear a syllable and pick its tone, or hear a two-syllable
 * word and pick its tone pair. Uses the real recordings (16-audio). Two kinds of round: 10 questions,
 * or 3 lives (go until three wrong answers; your best score is kept). Questions are balanced: each tone
 * (or tone pair) comes up about equally, whatever the word list's own mix. Up to 40 XP a day; every
 * correct tone also grows the water garden (39-garden). After answering, tap any option to hear it. */

const TONE_CAP = 40;
const TONE_NAMES = ["", "1st (high, level)", "2nd (rising)", "3rd (dipping)", "4th (falling)"];
const TONE_LIVES = 3;
const drill = { mode: "single", round: "ten", qs: [], i: 0, picked: null, right: 0, xp: 0, shownXp: 0, run: 0, best: 0, lives: TONE_LIVES, lost: false, over: false, active: false, used: new Set() };
let tonePools = null;

/** Simple, unambiguous practice items from HSK 1–4 (one reading only, no neutral tones). */
function buildTonePools() {
  const single = [], pairs = [];
  for (const lv of [1, 2, 3, 4]) {
    for (const e of Engine.hskWords(lv)) {
      const syl = e.p.split(/\s+/);
      const tones = syl.map(s => Number((/([1-5])$/.exec(s) || [0, 0])[1]));
      if (/^[A-Z]/.test(e.p) || tones.some(t => t < 1 || t > 4)) continue;
      const readings = new Set(Engine.lookup(e.s).map(x => x.p.toLowerCase()));
      if (readings.size > 1) continue; // the voice might pick a different reading
      if (syl.length === 1 && [...e.s].length === 1) single.push(e);
      if (syl.length === 2 && [...e.s].length === 2 && !(tones[0] === 3 && tones[1] === 3) && !/[一不]/.test(e.s)) pairs.push(e);
    }
  }
  const dedupe = list => { const seen = new Set(); return list.filter(e => !seen.has(e.s) && seen.add(e.s)); };
  // grouped by answer, so each tone (or tone pair) can be asked about equally often
  const byTones = list => { const m = new Map(); for (const e of list) { const k = e.p.split(/\s+/).map(s => s.slice(-1)).join("-"); if (!m.has(k)) m.set(k, []); m.get(k).push(e); } return m; };
  const s = dedupe(single), p = dedupe(pairs);
  return { single: s, pairs: p, singleBy: byTones(s), pairsBy: byTones(p) };
}
const pick = list => list[Math.floor(Math.random() * list.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const withTones = (p, tones) => p.split(/\s+/).map((s, i) => s.replace(/[1-5]$/, String(tones[i]))).join(" ");

/** One question: pick the answer first (evenly, never the same one three times running), then a word
 *  with that answer that hasn't come up yet this round. */
function makeQuestion(mode) {
  const groups = mode === "pairs" ? tonePools.pairsBy : tonePools.singleBy;
  const last = drill.qs.slice(-2).map(q => q.tones.join("-"));
  const keys = [...groups.keys()];
  const fresh = keys.filter(k => !(last.length === 2 && last[0] === k && last[1] === k) && (mode !== "pairs" || last[1] !== k));
  const key = pick(fresh.length ? fresh : keys);
  let left = groups.get(key).filter(x => !drill.used.has(x.s));
  if (!left.length) { groups.get(key).forEach(x => drill.used.delete(x.s)); left = groups.get(key); }   // every word with this answer asked: reuse them
  const e = pick(left);
  drill.used.add(e.s);
  const tones = key.split("-").map(Number);
  let options;
  if (mode === "pairs") {
    const all = [];
    for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) if (!(a === 3 && b === 3) && !(a === tones[0] && b === tones[1])) all.push([a, b]);
    options = shuffle([tones, ...shuffle(all).slice(0, 3)]);
  } else options = [[1], [2], [3], [4]];
  return { e, tones, options };
}
function startDrill(mode) {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (!tonePools) tonePools = buildTonePools();
  Object.assign(drill, { mode, round: state.toneRound, qs: [], i: 0, picked: null, right: 0, xp: 0, shownXp: 0, run: 0, best: 0,
    lives: TONE_LIVES, lost: false, over: false, newBest: false, active: true, used: new Set(), askedAt: Date.now() });
  const n = drill.round === "lives" ? 1 : 10;                         // 3 lives: one at a time, as long as you last
  while (drill.qs.length < n) drill.qs.push(makeQuestion(mode));
  go("tones");
  setTimeout(playDrill, 350);
}
function playDrill() {
  const q = drill.qs[drill.i];
  if (!q) return;
  // Your chosen voice (the button beside Play) goes first; if it can't say this one, the next one does.
  speak(q.e.s, q.e.p).then(src => { if (src) drill.lastSrc = src; });
}
/** After answering: hear any option, so you can compare the tones. */
function playOption(q, tones) {
  const p = withTones(q.e.p, tones);
  speakPinyin(p).then(ok => { if (!ok) toast(pyText(p) + " isn't a syllable in Mandarin, so there's nothing to hear."); });
}
const pyText = p => p.split(/\s+/).map(x => Engine.toMarks(x)).join(" ");
function answerDrill(k) {
  const q = drill.qs[drill.i];
  if (!q || drill.picked !== null) return;
  drill.picked = k;
  practiced(Math.min(30, (Date.now() - (drill.askedAt || Date.now())) / 1000), false);   // counts towards the daily goal
  const right = q.options[k].join() === q.tones.join();
  if (right) {
    drill.right++; drill.run++; drill.best = Math.max(drill.best, drill.run);
    // The garden: 1 point per right answer, plus a bonus at every 5 in a row (2 the first time, then 3).
    const bonus = drill.run % 5 === 0 ? (drill.run === 5 ? 2 : 3) : 0;
    if (bonus) { ui.gardenBonus = bonus; toast(drill.run + " in a row! +" + bonus + " bonus growth for your garden"); }
    gardenGrow(1 + bonus, 1);
    commitProgress();
    const a = dayAct();
    const add = Math.min(2, TONE_CAP - a[4]);
    if (add > 0) {
      const before = levelNow().level;
      a[4] += add; drill.xp += add;
      commitProgress();
      afterXp(before, add, false, q.e && q.e.s);
    }
  } else {
    drill.run = 0;
    commitProgress();   // keeps the practice time
    if (drill.round === "lives") {
      drill.lives = Math.max(0, drill.lives - 1); drill.lost = true;
      if (!drill.lives) setMood("ko", 0);                       // game over: knocked out until the results
      else setMood("oops", 1800);
    }
  }
  render(false);
}
function nextDrill() {
  drill.i++; drill.picked = null; drill.lost = false; drill.askedAt = Date.now();
  const finished = drill.round === "lives" ? !drill.lives : drill.i >= drill.qs.length;
  if (finished && drill.mode === "pairs") jCount("pairs");
  if (drill.round === "lives") {
    if (!drill.lives) {
      drill.over = true;
      const best = (state.toneBest || {})[drill.mode] || 0;
      if (drill.right > best) { drill.newBest = best > 0 || drill.right > 0; commit({ toneBest: { ...state.toneBest, [drill.mode]: drill.right } }); }
      setTimeout(() => setMood("calm", 0), 6000);              // back up after a moment
    } else if (drill.i >= drill.qs.length) drill.qs.push(makeQuestion(drill.mode));
  } else if (drill.i >= drill.qs.length && drill.qs.length >= 10 && drill.right === drill.qs.length) earnBadge("perfect");
  render(false);
  if (!drill.over && drill.i < drill.qs.length) setTimeout(playDrill, 250);
}
/** One life in the theme's own look: a brushed heart (Ink), jade disc, blue-and-white flower, lantern,
 *  neon heart, longevity peach, gold coin, pixel heart, neon cell or star. Lost ones fade to an outline. */
function lifeIcon(alive, justLost) {
  const shape = document.documentElement.dataset.shape || "plain";
  const A = { fill: "var(--accent)", stroke: "var(--accent)" };
  const heart = "M12 20.5 C5 15.5 2.5 12 2.5 8.6 C2.5 5.6 4.8 3.5 7.4 3.5 C9.4 3.5 11 4.6 12 6.3 C13 4.6 14.6 3.5 16.6 3.5 C19.2 3.5 21.5 5.6 21.5 8.6 C21.5 12 19 15.5 12 20.5 Z";
  const parts = {
    ink: () => [sv("path", { d: heart, fill: A.fill, transform: "rotate(-6 12 12)" }), sv("path", { d: "M6 8 q2 -3 4 -1", stroke: "rgb(255 255 255 / .5)", "stroke-width": 1.2, fill: "none", "stroke-linecap": "round" })],
    jade: () => [sv("path", { d: "M12 2.5 a9.5 9.5 0 1 0 0.01 0 Z M12 8.6 a3.4 3.4 0 1 1 -0.01 0 Z", "fill-rule": "evenodd", fill: A.fill }),
      sv("path", { d: "M6.5 7 a7 7 0 0 1 4 -2.6", stroke: "rgb(255 255 255 / .55)", "stroke-width": 1.2, fill: "none", "stroke-linecap": "round" })],
    porcelain: () => [0, 72, 144, 216, 288].map(r => sv("circle", { cx: 12, cy: 6.4, r: 4, fill: A.fill, transform: "rotate(" + r + " 12 12)" })).concat(sv("circle", { cx: 12, cy: 12, r: 2.6, fill: "var(--surface)" })),
    lantern: () => [sv("rect", { x: 9, y: 2.5, width: 6, height: 2, rx: 0.8, fill: "var(--ink)" }), sv("ellipse", { cx: 12, cy: 12, rx: 8, ry: 7.4, fill: A.fill }),
      sv("path", { d: "M12 4.6 V19.4 M7.5 6.5 Q5.6 12 7.5 17.5 M16.5 6.5 Q18.4 12 16.5 17.5", stroke: "rgb(0 0 0 / .25)", "stroke-width": 1, fill: "none" }),
      sv("rect", { x: 9, y: 19, width: 6, height: 2, rx: 0.8, fill: "var(--ink)" }), sv("path", { d: "M12 21 V23.5", stroke: A.stroke, "stroke-width": 1.4 })],
    nightmarket: () => [sv("path", { d: heart, fill: "none", stroke: A.stroke, "stroke-width": 2.2, class: "life-neon" })],
    peach: () => [sv("path", { d: "M12 21 C5.5 21 3.5 15.5 4.5 11.5 C5.5 7.5 9 6 12 8.5 C15 6 18.5 7.5 19.5 11.5 C20.5 15.5 18.5 21 12 21 Z", fill: A.fill }),
      sv("path", { d: "M12 8.5 Q13.5 5 17 3.6 Q16 7 12 8.5 Z", fill: "var(--t3)" }), sv("path", { d: "M12 9.5 Q10.5 14 12 20", stroke: "rgb(0 0 0 / .15)", "stroke-width": 1, fill: "none" })],
    imperial: () => [sv("path", { d: "M12 2.5 a9.5 9.5 0 1 0 0.01 0 Z M9.3 9.3 h5.4 v5.4 h-5.4 Z", "fill-rule": "evenodd", fill: A.fill }),
      sv("circle", { cx: 12, cy: 12, r: 7.6, fill: "none", stroke: "rgb(0 0 0 / .22)", "stroke-width": 0.8 })],
    arcade: () => [sv("path", { d: "M4 6h3v-2h4v2h2v-2h4v2h3v5h-2v2h-2v2h-2v2h-2v2h-2v-2h-2v-2h-2v-2h-2v-2h-2z", fill: A.fill, "shape-rendering": "crispEdges" })],
    cyber: () => [sv("path", { d: "M12 2.5 L20.5 7.2 V16.8 L12 21.5 L3.5 16.8 V7.2 Z", fill: "none", stroke: A.stroke, "stroke-width": 1.8, class: "life-neon" }),
      sv("path", { d: "M12 7 L16.3 9.5 V14.5 L12 17 L7.7 14.5 V9.5 Z", fill: A.fill })],
    silver: () => [sv("path", { d: "M12 1.8 L14.2 9.8 L22.2 12 L14.2 14.2 L12 22.2 L9.8 14.2 L1.8 12 L9.8 9.8 Z", fill: A.fill }),
      sv("circle", { cx: 12, cy: 12, r: 1.6, fill: "#fff", opacity: 0.8 })],
  };
  const draw = parts[shape] || (() => [sv("path", { d: heart, fill: A.fill })]);
  return sv("svg", { viewBox: "0 0 24 24", width: 24, height: 24, "aria-hidden": "true",
    class: "life life-" + shape + (alive ? "" : " lost") + (justLost ? " just-lost" : "") }, draw());
}

/** Little drawings of each tone's pitch: level, rising, dipping, falling. */
function toneIcon(t) {
  const d = { 1: "M4 6 H20", 2: "M4 18 L20 5", 3: "M4 9 Q11 22 20 6", 4: "M4 5 L20 19" }[t];
  return sv("svg", { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": "true", class: "tone-icon t" + t },
    sv("path", { d, style: "fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round" }));
}

function viewTones() {
  const v = h("section", { class: "view tones" });
  // Both look the same; the one you tap lights up as you press it, then the round starts.
  const pick = mode => ev => { ev.currentTarget.classList.add("picked"); setTimeout(() => startDrill(mode), 140); };
  const modes = h("div", { class: "row" },
    h("button", { class: "btn tone-mode", type: "button", onclick: pick("single") }, "Single tones"),
    h("button", { class: "btn tone-mode", type: "button", onclick: pick("pairs") }, "Tone pairs"));
  if (!drill.active) v.append(h("div", { class: "row tone-round" }, h("span", { class: "eyebrow" }, "Round"),
    setSeg("tone-round", [["ten", "10 questions"], ["lives", "3 lives"]], state.toneRound, k => commit({ toneRound: k }))));
  v.append(modes);
  const main = h("div", { class: "tones-main" });
  // The water garden shows during a round (it grows as you answer), not on the start page.
  const layout = h("div", { class: "tones-layout" + (drill.active ? " active" : "") }, main, drill.active ? gardenBox() : null);
  if (drill.active) foldify(layout, "tones", ":scope > .garden-card");
  v.append(layout);
  if (!drill.active) {
    main.append(h("div", { class: "card stack" },
      h("p", null, "Start with ", h("b", null, "Single tones"), ": hear one syllable and choose its tone. Then try ", h("b", null, "Tone pairs"), ": hear a two-syllable word and choose both tones."),
      h("div", { class: "row tone-legend" }, [1, 2, 3, 4].map(t => h("span", { class: "row small" }, toneIcon(t), TONE_NAMES[t]))),
      h("p", { class: "muted small" }, h("b", null, "3 lives"), ": keep going until three wrong answers. Best so far: single tones " + (state.toneBest.single || 0) + ", tone pairs " + (state.toneBest.pairs || 0) + "."),
      h("p", { class: "muted small" }, "Today: " + getAct()[4] + " / " + TONE_CAP + " XP from tones.")));
    return v;
  }
  const total = drill.qs.length, lives = drill.round === "lives";
  if (lives) {
    main.append(h("div", { class: "row spread tone-lives-row" },
      h("span", { class: "row tone-lives", role: "img", "aria-label": drill.lives + (drill.lives === 1 ? " life" : " lives") + " left" },
        Array.from({ length: TONE_LIVES }, (_, k) => lifeIcon(k < drill.lives, drill.lost && k === drill.lives))),
      h("span", { class: "muted small num" }, drill.right + " right"), xpBadge(drill)));
  } else {
    const bar = h("div", { class: "bar" }, h("i"));
    bar.firstChild.style.width = (drill.i / total) * 100 + "%";
    main.append(h("div", { class: "row spread" }, h("span", { class: "muted small num" }, Math.min(drill.i + 1, total) + " of " + total), xpBadge(drill)), bar);
  }
  const q = drill.over ? null : drill.qs[drill.i];
  if (!q && lives) {
    const best = state.toneBest[drill.mode] || 0;
    main.append(h("div", { class: "card summary tone-over" },
      h("div", { class: "tone-ko" }, liveAvatar(96, "My avatar, knocked out")),
      h("h2", null, "Game over"),
      h("p", { class: "muted" }, drill.newBest ? "A new best for " + (drill.mode === "pairs" ? "tone pairs" : "single tones") + "!" : "Best for " + (drill.mode === "pairs" ? "tone pairs" : "single tones") + ": " + best + "."),
      h("div", { class: "stats" }, stat(drill.right, "right"), stat(drill.best, "best run"), stat("+" + drill.xp, "XP")),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => { setMood("calm", 0); startDrill(drill.mode); } }, "Try again"),
        h("button", { class: "btn", type: "button", onclick: () => { setMood("calm", 0); drill.active = false; go("home"); } }, "Done"))));
    return v;
  }
  if (!q) {
    main.append(h("div", { class: "card summary" }, h("h2", null, drill.right >= 8 ? "Great ears!" : drill.right >= 5 ? "Nice work" : "Keep listening"),
      h("div", { class: "stats" }, stat(drill.right + " / " + total, "correct"), stat("+" + drill.xp, "XP"), stat(drill.best, "best run")),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => startDrill(drill.mode) }, "Go again"),
        h("button", { class: "btn", type: "button", onclick: () => { drill.active = false; go("home"); } }, "Done"))));
    return v;
  }
  const card = h("div", { class: "card flashcard tone-card" },
    h("span", { class: "eyebrow" }, drill.mode === "pairs" ? "Which tones?" : "Which tone?"),
    h("div", { class: "fc-front tone-play-row" }, h("button", { class: "fc-play", type: "button", "aria-label": "Play again", onclick: playDrill }, icon("play"))),
    h("p", { class: "muted small fc-center" }, "Tap to hear it again (Space). After answering, tap any option to hear it."));
  const opts = h("div", { class: "tone-opts" + (drill.mode === "pairs" ? " pairs" : "") });
  q.options.forEach((tones, k) => {
    const correct = tones.join() === q.tones.join();
    const cls = drill.picked === null ? "" : correct ? " right" : k === drill.picked ? " wrong" : " dim";
    const answered = drill.picked !== null;
    opts.append(h("button", { class: "tone-opt" + cls + (answered ? " hear" : ""), type: "button",
      "aria-label": answered ? "Hear " + pyText(withTones(q.e.p, tones)) : null, onclick: () => (answered ? playOption(q, tones) : answerDrill(k)) },
      answered ? h("span", { class: "tone-hear", "aria-hidden": "true" }, icon("play")) : null,
      h("span", { class: "row tone-icons" }, tones.map(t => toneIcon(t))),
      pyEl(withTones(q.e.p, tones), "py"),
      drill.mode === "single" ? h("span", { class: "small muted" }, TONE_NAMES[tones[0]].split(" ")[0]) : null));
  });
  card.append(opts);
  if (drill.picked !== null) {
    const ok = q.options[drill.picked].join() === q.tones.join();
    card.append(h("div", { class: "tone-answer" },
      h("b", { class: ok ? "t3" : "t1" }, ok ? "Correct!" : "Not quite."),
      h("button", { class: "plain-btn tone-word", type: "button", onclick: () => openWord(q.e.s, q.e) }, rubyHz(disp(q.e), q.e.p)),
      h("span", { class: "muted" }, shortDef(q.e, 2)),
      h("button", { class: "btn primary big-btn", type: "button", onclick: nextDrill, id: "tone-next" },
        lives ? (drill.lives ? "Next" : "See results") : drill.i + 1 < total ? "Next" : "See results")));
  }
  main.append(card);
  if (drill.picked !== null) setTimeout(() => { const n = $("#tone-next"); if (n) n.focus({ preventScroll: true }); }, 0);
  return v;
}
function toneKeys(ev) {
  if (ui.view !== "tones" || !drill.active || $("#levelup")) return false;
  const t = ev.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return false;
  if (ev.key === " ") { ev.preventDefault(); playDrill(); return true; }
  if (drill.picked === null && /^[1-4]$/.test(ev.key)) { ev.preventDefault(); answerDrill(Number(ev.key) - 1); return true; }
  return false;
}
