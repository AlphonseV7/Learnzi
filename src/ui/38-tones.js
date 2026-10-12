/* LearnZì UI, part 6c: the tone trainer. Hear a syllable and pick its tone, or hear a two-syllable
 * word and pick its tone pair. Uses the real recordings (16-audio). Up to 40 XP a day; every correct
 * tone also grows the water garden (39-garden). After answering, tap any option to hear it. */

const TONE_CAP = 40;
const TONE_NAMES = ["", "1st (high, level)", "2nd (rising)", "3rd (dipping)", "4th (falling)"];
const drill = { mode: "single", qs: [], i: 0, picked: null, right: 0, xp: 0, run: 0, best: 0, active: false };
let tonePools = null;

/** Simple, unambiguous practice items from HSK 1–3 (one reading only, no neutral tones). */
function buildTonePools() {
  const single = [], pairs = [];
  for (const lv of [1, 2, 3]) {
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
  return { single: dedupe(single), pairs: dedupe(pairs) };
}
const pick = list => list[Math.floor(Math.random() * list.length)];
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const withTones = (p, tones) => p.split(/\s+/).map((s, i) => s.replace(/[1-5]$/, String(tones[i]))).join(" ");

function startDrill(mode) {
  if (ui.dict !== "ready") { toast("The dictionary is still loading."); return; }
  if (!tonePools) tonePools = buildTonePools();
  const pool = mode === "pairs" ? tonePools.pairs : tonePools.single;
  const qs = [];
  const used = new Set();
  while (qs.length < 10 && used.size < pool.length) {
    const e = pick(pool);
    if (used.has(e.s)) continue;
    used.add(e.s);
    const tones = e.p.split(/\s+/).map(s => Number(s.slice(-1)));
    let options;
    if (mode === "pairs") {
      const all = [];
      for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) if (!(a === 3 && b === 3) && !(a === tones[0] && b === tones[1])) all.push([a, b]);
      options = shuffle([tones, ...shuffle(all).slice(0, 3)]);
    } else options = [[1], [2], [3], [4]];
    qs.push({ e, tones, options });
  }
  Object.assign(drill, { mode, qs, i: 0, picked: null, right: 0, xp: 0, run: 0, best: 0, active: true });
  go("tones");
  setTimeout(playDrill, 350);
}
function playDrill() {
  const q = drill.qs[drill.i];
  if (!q) return;
  // quiet: the now-playing bar would show the characters and give the answer away.
  // Your chosen voice (the button beside Play) goes first; if it can't say this one, the next one does.
  speak(q.e.s, q.e.p, { quiet: true, source: state.toneSource || undefined }).then(src => { if (src) showToneSource(src); });
}
/** The voice button beside Play: shows which voice you heard; tap it to hear the next voice. */
function showToneSource(src) {
  drill.lastSrc = src;
  const b = $("#tone-src");
  if (!b) return;
  b.dataset.src = src;
  b.querySelector(".tone-src-name").textContent = srcName(src);
  b.title = VOICE_SOURCES[src].who + ". Tap to switch voice.";
}
const srcName = src => (src ? VOICE_SOURCES[src].label.replace("Built from syllables", "Syllables") : "…");
async function nextToneSource() {
  const q = drill.qs[drill.i];
  if (!q) return;
  const all = await sourcesFor(q.e.s, q.e.p);
  if (!all.length) return;
  const cur = ($("#tone-src") || {}).dataset ? $("#tone-src").dataset.src : "";
  const next = all[(all.indexOf(cur) + 1) % all.length];
  commit({ toneSource: next });
  playDrill();
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
  } else drill.run = 0;
  render(false);
}
function nextDrill() { drill.i++; drill.picked = null; render(false); if (drill.i < drill.qs.length) setTimeout(playDrill, 250); }

/** Little drawings of each tone's pitch: level, rising, dipping, falling. */
function toneIcon(t) {
  const d = { 1: "M4 6 H20", 2: "M4 18 L20 5", 3: "M4 9 Q11 22 20 6", 4: "M4 5 L20 19" }[t];
  return sv("svg", { viewBox: "0 0 24 24", width: 22, height: 22, "aria-hidden": "true", class: "tone-icon t" + t },
    sv("path", { d, style: "fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round" }));
}

function viewTones() {
  const v = h("section", { class: "view tones" });
  const modes = h("div", { class: "row" },
    h("button", { class: "btn" + (drill.mode === "single" ? " primary" : ""), type: "button", onclick: () => startDrill("single") }, "Single tones"),
    h("button", { class: "btn" + (drill.mode === "pairs" ? " primary" : ""), type: "button", onclick: () => startDrill("pairs") }, "Tone pairs"));
  v.append(modes);
  const main = h("div", { class: "tones-main" });
  const layout = h("div", { class: "tones-layout" + (drill.active ? " active" : "") }, main, gardenBox());
  foldify(layout, "tones", ":scope > .garden-card");
  v.append(layout);
  if (!drill.active) {
    main.append(h("div", { class: "card stack" },
      h("p", null, "Start with ", h("b", null, "Single tones"), ": hear one syllable and choose its tone. Then try ", h("b", null, "Tone pairs"), ": hear a two-syllable word and choose both tones."),
      h("div", { class: "row tone-legend" }, [1, 2, 3, 4].map(t => h("span", { class: "row small" }, toneIcon(t), TONE_NAMES[t]))),
      h("p", { class: "muted small" }, "Today: " + getAct()[4] + " / " + TONE_CAP + " XP from tones.")));
    return v;
  }
  const total = drill.qs.length;
  const bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = (drill.i / total) * 100 + "%";
  main.append(h("div", { class: "row spread" }, h("span", { class: "muted small num" }, Math.min(drill.i + 1, total) + " of " + total),
    h("span", { class: "badge hsk num" }, "+" + drill.xp + " XP")), bar);
  const q = drill.qs[drill.i];
  if (!q) {
    main.append(h("div", { class: "card summary" }, h("h2", null, drill.right >= 8 ? "Great ears!" : drill.right >= 5 ? "Nice work" : "Keep listening"),
      h("div", { class: "stats" }, stat(drill.right + " / " + total, "correct"), stat("+" + drill.xp, "XP"), stat(drill.best, "best run")),
      h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => startDrill(drill.mode) }, "Go again"),
        h("button", { class: "btn", type: "button", onclick: () => { drill.active = false; go("home"); } }, "Done"))));
    return v;
  }
  const card = h("div", { class: "card flashcard tone-card" },
    h("span", { class: "eyebrow" }, drill.mode === "pairs" ? "Which tones?" : "Which tone?"),
    h("div", { class: "fc-front tone-play-row" }, h("button", { class: "fc-play", type: "button", "aria-label": "Play again", onclick: playDrill }, icon("play")),
      h("button", { class: "btn small tone-src", id: "tone-src", type: "button", "aria-label": "Switch voice", "data-src": drill.lastSrc || "", onclick: nextToneSource },
        icon("next"), h("span", null, h("span", { class: "muted small" }, "Voice "), h("b", { class: "tone-src-name" }, srcName(drill.lastSrc))))),
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
      h("button", { class: "btn primary big-btn", type: "button", onclick: nextDrill, id: "tone-next" }, drill.i + 1 < total ? "Next" : "See results")));
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
