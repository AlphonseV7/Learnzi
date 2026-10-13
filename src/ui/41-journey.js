/* LearnZì UI, part 8c: the Journey (旅程). Twenty quests in five chapters that teach the app and the
 * language, shown as an ink-wash map you climb, from a riverside village to a pagoda on the summit.
 * Each quest finds a scroll (40b-scrolls); each chapter ends with a reward (an avatar item, a clock
 * face, a lantern for the garden, a title). Chapters open one after another; anything you'd already
 * done counts as soon as its chapter opens. Kept in state.journey (synced):
 *   done: quest id → when, seen: the stop your avatar was last shown at (for its walk), counts: small
 *   tallies for quests the rest of the app doesn't count, read: scroll id → when first opened. */

// ---------- the quests ----------
const J_CHAPTERS = [
  { zh: "入门", py: "ru4 men2", en: "First steps", reward: "a scholar's brush for your avatar" },
  { zh: "耳朵", py: "er3 duo5", en: "Ears", reward: "a bamboo flute for your avatar" },
  { zh: "汉字", py: "han4 zi4", en: "Characters", reward: "an ink-seal clock face" },
  { zh: "阅读", py: "yue4 du2", en: "Reading", reward: "a lantern on your garden's bridge" },
  { zh: "习惯", py: "xi2 guan4", en: "Habits", reward: "a scholar's hat for your avatar and the title 旅人, Traveller" },
];
const jc = k => ((state.journey || {}).counts || {})[k] || 0;
const learnedWords = () => Object.entries(progress.cards).filter(([k, c]) => k.endsWith("|m") && !SRS.isLearning(c)).length;
// have(): how far along (capped at need). go: what the quest's button does.
const QUESTS = [
  { id: "tour", title: "Finish the welcome tour", need: 1, have: () => (hasBadge("begin") ? 1 : 0), go: ["Take the tour", () => startTour()] },
  { id: "lookups", title: "Look up 5 words", need: 5, have: () => jc("lookups"), go: ["Look up a word", () => go("lookup")] },
  { id: "review", title: "Review your first flashcard", need: 1, have: () => Math.min(1, totals().reviews), go: ["Review", () => startStudy()] },
  { id: "save", title: "Save 10 words", need: 10, have: () => state.saved.length, go: ["Look up a word", () => go("lookup")], hint: "Tap the star on any word." },
  { id: "tones", title: "Get 10 tones right", need: 10, have: () => (progress.garden || [0, 0])[1], go: ["Tone trainer", () => { drill.active = false; go("tones"); }] },
  { id: "pairs", title: "Finish a round of Tone pairs", need: 1, have: () => jc("pairs"), go: ["Tone trainer", () => { drill.active = false; go("tones"); }] },
  { id: "lives", title: "Score 10 in a 3 lives round", need: 10, have: () => Math.max(state.toneBest.single || 0, state.toneBest.pairs || 0),
    go: ["Tone trainer", () => { commit({ toneRound: "lives" }); drill.active = false; go("tones"); }], best: true },
  { id: "koi", title: "Grow your water garden to the koi", need: 5, have: () => gardenStage(), go: ["Tone trainer", () => { drill.active = false; go("tones"); }], unit: "stage" },
  { id: "strokes", title: "Watch the stroke order of 5 characters", need: 5, have: () => jc("strokes"), go: ["Look up a word", () => go("lookup")], hint: "Open a word, then Play in its Stroke order box." },
  { id: "write", title: "Write a character from memory", need: 1, have: () => (hasBadge("write") ? 1 : 0), go: ["Look up a word", () => go("lookup")], hint: "Open a word, then From memory in its Stroke order box." },
  { id: "stories", title: "Read 3 character stories", need: 3, have: () => jc("stories"), go: ["Look up a word", () => go("lookup")], hint: "Open a one-character word and see its Character story box." },
  { id: "learn", title: "Learn 20 words", need: 20, have: () => learnedWords(), go: ["Review", () => startStudy()], hint: "A word counts once its Meaning card is past learning." },
  { id: "reader", title: "Read something in the Reader", need: 1, have: () => (hasBadge("read") ? 1 : 0), go: ["Reader", () => go("reader")] },
  { id: "nopinyin", title: "Review 10 cards with pinyin switched off", need: 10, have: () => jc("nopinyin"), go: ["Review", () => startStudy()], hint: "Switch off Show pinyin in Settings → Reading first." },
  { id: "grammar", title: "Read 3 grammar points", need: 3, have: () => jc("grammar"), go: ["Grammar", () => go("grammar")] },
  { id: "photo", title: "Read Chinese from a photo", need: 1, have: () => (hasBadge("snap") ? 1 : 0), go: ["Photo to words", () => go("photo")] },
  { id: "streak", title: "Study 7 days in a row", need: 7, have: () => Math.max(streak(), totals().best), go: ["Review", () => startStudy()], unit: "day" },
  { id: "deck", title: "Make a deck of your own", need: 1, have: () => state.decks.length, go: ["My decks", () => go("decks")] },
  { id: "watch", title: "Watch a video with Chinese subtitles", need: 1, have: () => (hasBadge("watch") ? 1 : 0), go: ["Watch", () => { setWatchTab("video"); go("watch"); }] },
  { id: "level10", title: "Reach level 10", need: 10, have: () => levelNow().level, go: ["Review", () => startStudy()], unit: "level" },
];
const J_TOTAL = QUESTS.length;

function jState() {
  const j = state.journey || {};
  return { done: j.done || {}, seen: j.seen || 0, counts: j.counts || {}, read: j.read || {} };
}
const questDone = i => !!jState().done[QUESTS[i].id];
const doneCount = () => QUESTS.filter((q, i) => questDone(i)).length;
/** The stop your avatar stands at: the first quest not done yet (20 when the journey is complete). */
function currentStop() { for (let i = 0; i < J_TOTAL; i++) if (!questDone(i)) return i; return J_TOTAL; }
/** Chapters are 1 to 5. A chapter is open once every quest before it is done. */
const chapterDone = c => QUESTS.slice((c - 1) * 4, c * 4).every((q, k) => questDone((c - 1) * 4 + k));
const chapterOpen = c => c === 1 || chapterDone(c - 1);
const questProgress = q => { try { return Math.max(0, Math.min(q.need, Math.floor(q.have()))); } catch { return 0; } };

/** Add to one of the journey's own tallies (lookups, strokes, stories, grammar, pairs, nopinyin). */
const jCounted = new Set();   // things counted once per session (the same character's story twice is one)
function jCount(key, once) {
  if (mleOn()) return;
  if (once) { if (jCounted.has(key + ":" + once)) return; jCounted.add(key + ":" + once); }
  const j = jState();
  const before = j.counts[key] || 0;
  if (before >= 1000) return;
  commit({ journey: { ...state.journey, counts: { ...j.counts, [key]: before + 1 } } });
  checkJourney();
}
/** Mark quests done that your progress now earns, chapter by chapter, and say so. */
function checkJourney(quiet) {
  if (mleOn() || ui.dict !== "ready") return 0;
  const j = jState(), done = { ...j.done }, fresh = [];
  for (let c = 1; c <= J_CHAPTERS.length; c++) {
    const first = (c - 1) * 4;
    if (c > 1 && !QUESTS.slice(first - 4, first).every(q => done[q.id])) break;   // this chapter isn't open yet
    for (let i = first; i < first + 4; i++) {
      const q = QUESTS[i];
      if (done[q.id]) continue;
      if (questProgress(q) >= q.need) { done[q.id] = Date.now(); fresh.push(i); }
    }
  }
  if (!fresh.length) return 0;
  commit({ journey: { ...state.journey, done } });
  const chapters = [...new Set(fresh.map(i => Math.floor(i / 4) + 1))].filter(c => QUESTS.slice((c - 1) * 4, c * 4).every(q => done[q.id]));
  if (!quiet) {
    const reward = chapters.length ? " Chapter reward: " + J_CHAPTERS[chapters[chapters.length - 1] - 1].reward + "." : "";
    if (fresh.length === 1) actionToast("Quest complete! You found a scroll: " + scrollById(fresh[0] + 1).title + "." + reward, "Read", () => openScroll(fresh[0] + 1));
    else actionToast(fresh.length + " quests complete! " + fresh.length + " scrolls found." + reward, "Journey", () => go("journey"));
    if (state.sounds) try { chime(0.05); } catch { /* sound is optional */ }
    setMood("happy", 2200);
  }
  if (["journey", "home", "myzi", "scrolls"].includes(ui.view)) setTimeout(() => render(false), 50);
  return fresh.length;
}
function openScroll(id) {
  ui.scrollId = id;
  const j = jState();
  if (!j.read[id]) commit({ journey: { ...state.journey, read: { ...j.read, [id]: Date.now() } } });
  go("scroll");
}
const scrollFound = id => questDone(id - 1);

// ---------- the map: an ink-wash landscape, 360 × 1000, climbed from the bottom ----------
const JW = 360, JH = 1000;
const J_STOPS = [[180, 955], [108, 915], [168, 872], [250, 842], [288, 786], [222, 748], [128, 716], [186, 662],
  [272, 616], [300, 556], [222, 516], [140, 478], [86, 418], [166, 384], [250, 346], [300, 292],
  [232, 238], [150, 196], [212, 140], [180, 78]];
const J_REGION = [[850, 1000], [640, 850], [450, 640], [260, 450], [0, 260]];   // each chapter's band, top and bottom
/** A smooth path through points (Catmull-Rom as cubic Béziers), and the same curve sampled as points. */
function jCurve(pts) {
  let d = "M" + pts[0][0] + " " + pts[0][1];
  const samples = [[pts[0][0], pts[0][1], 0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += " C" + c1.join(" ") + " " + c2.join(" ") + " " + p2.join(" ");
    for (let t = 0.1; t <= 1.001; t += 0.1) {
      const u = 1 - t;
      samples.push([u * u * u * p1[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p2[0],
        u * u * u * p1[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p2[1], i + t]);
    }
  }
  return { d, samples };
}
let jSeq = 0;
function journeyMap(onStop) {
  const k = "jm" + (++jSeq) + "-", cur = currentStop();
  const P = (d, a) => sv("path", Object.assign({ d }, a));
  const u = id => "url(#" + k + id + ")";
  const o = [];
  o.push(sv("defs", {},
    sv("filter", { id: k + "paper", x: 0, y: 0, width: "100%", height: "100%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.8, numOctaves: 3, seed: 7 }),
      sv("feColorMatrix", { values: "0 0 0 0 .35 0 0 0 0 .3 0 0 0 0 .22 0 0 0 .1 0" })),
    sv("filter", { id: k + "brush", x: "-5%", y: "-5%", width: "110%", height: "110%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.05, numOctaves: 3, seed: 3, result: "n" }),
      sv("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 5 }), sv("feGaussianBlur", { stdDeviation: 0.35 })),
    sv("filter", { id: k + "wash", x: "-10%", y: "-20%", width: "120%", height: "140%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.03, numOctaves: 2, seed: 9, result: "n" }),
      sv("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 8 }), sv("feGaussianBlur", { stdDeviation: 1.6 })),
    sv("filter", { id: k + "mist", x: "-20%", y: "-20%", width: "140%", height: "140%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: "0.012 0.03", numOctaves: 3, seed: 12, result: "n" }),
      sv("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 40 }), sv("feGaussianBlur", { stdDeviation: 6 })),
    sv("filter", { id: k + "soft" }, sv("feGaussianBlur", { stdDeviation: 2.2 })),
    sv("filter", { id: k + "glow", x: "-100%", y: "-100%", width: "300%", height: "300%" }, sv("feGaussianBlur", { stdDeviation: 4 })),
    sv("linearGradient", { id: k + "sky", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: 0, "stop-color": "#ded2b6" }), sv("stop", { offset: 0.3, "stop-color": "#ebe2cd" }), sv("stop", { offset: 1, "stop-color": "#efe7d4" })),
    sv("linearGradient", { id: k + "riv", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: 0, "stop-color": "#9fb3ad" }), sv("stop", { offset: 1, "stop-color": "#b9c7c0" }))));
  o.push(sv("rect", { width: JW, height: JH, fill: u("sky") }));
  // the moon and the far ranges behind the summit
  o.push(sv("circle", { cx: 292, cy: 58, r: 16, fill: "#f6efdc", opacity: 0.9 }));
  o.push(sv("g", { filter: u("wash"), opacity: 0.55 }, P(jRidge(1, 150, 3, [[70, 70, 40], [180, 120, 46], [300, 80, 40]], 320), { fill: "#8f978f" })));
  o.push(sv("g", { filter: u("wash"), opacity: 0.7 }, P(jRidge(2, 250, 3, [[40, 60, 40], [190, 150, 60], [330, 50, 36]], 360), { fill: "#6c766f" })));
  // soft colour washes on the land
  for (const [x, y, rx, ry, col, op] of [[230, 900, 110, 50, "#a9b796", 0.45], [120, 860, 90, 40, "#c9b88e", 0.4], [230, 760, 100, 40, "#a9b796", 0.4],
    [180, 640, 120, 46, "#b7c29f", 0.4], [260, 520, 90, 50, "#a9b796", 0.35], [200, 330, 120, 40, "#c9b88e", 0.35], [180, 200, 110, 50, "#a9b796", 0.3]])
    o.push(sv("ellipse", { cx: x, cy: y, rx, ry, fill: col, opacity: op, filter: u("wash") }));
  // the river, from the waterfall down past the village, and the one the bridge crosses
  o.push(sv("g", { filter: u("brush") }, P("M0 590 Q60 610 70 680 Q76 740 40 790 Q10 840 30 900 Q50 960 0 1000 L-10 1000 L-10 600 Z", { fill: u("riv") }),
    P("M-10 400 Q80 420 150 440 Q230 456 300 440 Q340 432 370 440 L370 470 Q330 462 300 470 Q220 488 150 470 Q70 450 -10 432 Z", { fill: u("riv") })));
  const r = gRand(5), ripples = [];
  for (let i = 0; i < 18; i++) { const y = 600 + i * 22, x = 20 + r() * 30; ripples.push("M" + x.toFixed(0) + " " + y + " q12 " + (r() * 2 - 1).toFixed(1) + " 24 0"); }
  o.push(P(ripples.join(" "), { stroke: "#7d8a84", "stroke-width": 0.7, fill: "none", opacity: 0.6 }));
  // Ears: the waterfall and pond, with a koi
  o.push(sv("g", { filter: u("brush") }, P("M10 700 L14 650 Q10 620 30 600 Q44 570 66 572 Q80 556 100 560 Q118 580 112 610 L120 700 Z", { fill: "#2b2a28", opacity: 0.88 }),
    P("M60 572 Q66 568 74 570 L76 690 L58 690 Z", { fill: "#fff", opacity: 0.9 })));
  o.push(sv("ellipse", { cx: 80, cy: 704, rx: 44, ry: 12, fill: "#b9c7c0", filter: u("brush") }), sv("ellipse", { cx: 68, cy: 694, rx: 14, ry: 4, fill: "#fff", opacity: 0.6, filter: u("soft") }));
  o.push(sv("g", { transform: "translate(96 708) rotate(-8)" }, P("M-6 0 Q-1 -3 6 0 Q-1 3 -6 0 Z M-6 0 l-5 -3 l1 3 l-1 3 Z", { fill: "#d9502a" })));
  // First steps: the village and its gateway
  o.push(sv("g", { filter: u("brush"), fill: "#2b2a28" }, sv("rect", { x: 160, y: 968, width: 4, height: 26 }), sv("rect", { x: 196, y: 968, width: 4, height: 26 }),
    P("M150 970 Q180 962 210 970 L206 974 Q180 968 154 974 Z"), P("M156 960 Q180 952 204 960 L202 964 Q180 958 158 964 Z")));
  for (const [x, y, s] of [[250, 920, 1], [290, 960, 0.9], [60, 960, 0.8], [300, 890, 0.7]])
    o.push(sv("g", { transform: "translate(" + x + " " + y + ") scale(" + s + ")", filter: u("brush") }, sv("rect", { x: -14, y: -6, width: 28, height: 16, fill: "#efe7d4", stroke: "#2b2a28", "stroke-width": 1.2 }),
      P("M-20 -5 Q-10 -9 0 -16 Q10 -9 20 -5 Q10 -8 0 -11 Q-10 -8 -20 -5 Z", { fill: "#2b2a28" }), sv("rect", { x: -3, y: 2, width: 6, height: 8, fill: "#2b2a28" })));
  o.push(sv("g", { transform: "translate(36 860) rotate(-8)", filter: u("brush") }, P("M-12 0 Q0 6 12 0 Z", { fill: "#2b2a28" }), P("M0 0 V-12", { stroke: "#2b2a28", "stroke-width": 1 }), P("M-3 -3 l3 -6 l3 6 Z", { fill: "#6b6a62" })));
  // Characters: a bamboo grove and carved stone tablets
  [[318, 500], [330, 520], [342, 490], [306, 530]].forEach(([x, top], i) => {
    const culms = [];
    for (let y = top; y < 620; y += 18) culms.push(sv("rect", { x, y, width: 3, height: 16, rx: 1, fill: "#3c4436" }));
    o.push(sv("g", { filter: u("brush"), opacity: (0.85 - i * 0.1).toFixed(2) }, culms));
  });
  for (const [x, y, a, l] of [[320, 504, -30, 16], [332, 524, 200, 15], [344, 494, -40, 14], [308, 534, 210, 13], [320, 560, 20, 14], [342, 540, 190, 13]])
    o.push(P("M0 0 Q" + (l * 0.45).toFixed(1) + " -2.4 " + l + " 0 Q" + (l * 0.45).toFixed(1) + " 1.6 0 0 Z", { fill: "#3c4436", transform: "translate(" + x + " " + y + ") rotate(" + a + ")" }));
  for (const [x, y] of [[176, 520], [196, 512], [190, 540]])
    o.push(sv("g", { filter: u("brush") }, sv("rect", { x: x - 6, y: y - 16, width: 12, height: 18, rx: 2, fill: "#6b6a62" }), P("M" + (x - 3) + " " + (y - 12) + " h6 M" + (x - 3) + " " + (y - 8) + " h6 M" + (x - 3) + " " + (y - 4) + " h4", { stroke: "#2b2a28", "stroke-width": 0.8 })));
  // Reading: the bridge and the lantern pavilion
  o.push(sv("g", { filter: u("brush") }, P("M110 452 Q150 420 190 452 L186 455 Q150 428 114 455 Z", { fill: "#6b6a62" })));
  o.push(sv("g", { transform: "translate(268 362)", filter: u("brush") }, sv("rect", { x: -16, y: -4, width: 2.6, height: 20, fill: "#2b2a28" }), sv("rect", { x: 13.4, y: -4, width: 2.6, height: 20, fill: "#2b2a28" }),
    P("M-26 -3 Q-14 -6 0 -18 Q14 -6 26 -3 Q14 -6 0 -10 Q-14 -6 -26 -3 Z", { fill: "#2b2a28" }), sv("rect", { x: -18, y: 15, width: 36, height: 3, fill: "#2b2a28" })));
  for (const x of [256, 280]) o.push(sv("circle", { cx: x, cy: 368, r: 6, fill: "#ff6a3c", opacity: 0.35, filter: u("glow"), class: "g-glow" }), sv("ellipse", { cx: x, cy: 368, rx: 2.6, ry: 3.2, fill: "#e0452b" }));
  // Habits: steps up to the pagoda on the summit
  const tiers = [];
  for (let i = 0; i < 5; i++) { const w = (5 - i) * 4 + 6; tiers.push(P("M" + (180 - (5 - i) * 4) + " " + (70 - i * 9) + " h" + 2 * w + " l-4 4 h" + (-2 * w + 8) + " Z")); }
  o.push(sv("g", { filter: u("brush"), fill: "#2b2a28" }, tiers, sv("rect", { x: 177, y: 16, width: 6, height: 8 }), sv("rect", { x: 179, y: 8, width: 2, height: 9 })));
  o.push(sv("g", { filter: u("brush") }, P("M214 140 l8 -8 M222 132 l8 -6 M206 196 l10 -6", { stroke: "#6b6a62", "stroke-width": 3, "stroke-linecap": "round" })));
  // pines, rocks and a plum tree here and there
  for (const [x, y, s] of [[320, 720, 1], [300, 680, 0.8], [140, 800, 0.8], [40, 560, 0.9], [80, 340, 1], [300, 220, 0.9], [120, 150, 0.8]]) {
    const needles = [[-30, 10], [-23, 15], [-15, 19]].map(([dy, w]) => P("M" + -w + " " + (dy + 3) + " Q0 " + (dy - 6) + " " + w + " " + (dy + 3) + " Q0 " + dy + " " + -w + " " + (dy + 3) + " Z", { fill: "#3c4a3a", opacity: 0.9 }));
    o.push(sv("g", { transform: "translate(" + x + " " + y + ") scale(" + s + ")", filter: u("brush") }, P("M0 0 Q-2 -14 1 -30", { stroke: "#3a3328", "stroke-width": 2.6, fill: "none" }), needles));
  }
  for (const [x, y, s] of [[240, 700, 1], [100, 770, 0.8], [150, 600, 1], [330, 470, 0.9], [40, 300, 1], [260, 180, 0.8]])
    o.push(sv("g", { transform: "translate(" + x + " " + y + ") scale(" + s + ")", filter: u("brush") }, P("M-14 0 Q-12 -10 -4 -12 Q2 -18 8 -12 Q14 -8 14 0 Z", { fill: "#5b5a55" }),
      P("M-4 -12 Q0 -6 -2 0 M6 -12 Q8 -6 6 0", { stroke: "#2b2a28", "stroke-width": 0.8, fill: "none" })));
  o.push(sv("g", { filter: u("brush") }, P("M330 840 Q326 812 312 800 M318 806 Q332 792 346 790", { stroke: "#2b2a28", "stroke-width": 2.6, fill: "none", "stroke-linecap": "round" })));
  for (const [x, y] of [[312, 800], [346, 790], [330, 796], [304, 806], [338, 784]]) o.push(sv("circle", { cx: x, cy: y, r: 2.4, fill: "#c8384a", opacity: 0.85 }));
  // each chapter's name, brushed in the margin
  J_CHAPTERS.forEach((c, i) => {
    const y = [990, 800, 600, 430, 250][i] - 6, x = i % 2 ? 14 : JW - 14, anchor = i % 2 ? "start" : "end";
    o.push(sv("text", { x, y, "text-anchor": anchor, class: "jm-name", "font-size": 17 }, document.createTextNode(c.zh)),
      sv("text", { x, y: y + 12, "text-anchor": anchor, class: "jm-en", "font-size": 8.5 }, document.createTextNode(c.en.toUpperCase())));
  });
  // the trail: dotted ahead, red where you've walked
  const all = jCurve(J_STOPS);
  o.push(P(all.d, { stroke: "#6b6a62", "stroke-width": 2, "stroke-dasharray": "1 6", "stroke-linecap": "round", fill: "none" }));
  if (cur > 0) o.push(P(jCurve(J_STOPS.slice(0, Math.min(cur, J_TOTAL - 1) + 1)).d, { stroke: "#b8322a", "stroke-width": 2.4, "stroke-linecap": "round", fill: "none", opacity: 0.75 }));
  // chapter rewards: red lacquer boxes at the end of each chapter (grey once opened)
  J_CHAPTERS.forEach((c, i) => {
    const [x, y] = J_STOPS[i * 4 + 3], dx = x < 200 ? 20 : -20, got = chapterDone(i + 1);
    const box = sv("g", { transform: "translate(" + (x + dx) + " " + (y - 14) + ")", class: "jm-reward" + (got ? " got" : ""), role: "button", tabindex: 0,
      "aria-label": "Chapter " + (i + 1) + " reward: " + c.reward + (got ? ", earned" : "") },
      sv("rect", { x: -7, y: -5, width: 14, height: 10, rx: 1.5, fill: got ? "#8a7f72" : "#b8322a", stroke: "#5a1a14", "stroke-width": 0.8 }),
      sv("rect", { x: -7, y: -2, width: 14, height: 2, fill: "#e2b04a" }), sv("rect", { x: -1, y: -5, width: 2, height: 10, fill: "#e2b04a" }));
    box.addEventListener("click", () => onStop({ reward: i }));
    box.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onStop({ reward: i }); } });
    o.push(box);
  });
  // the stops: a red seal for each one done, a glow where you are, stones ahead
  J_STOPS.forEach(([x, y], i) => {
    const q = QUESTS[i], done = questDone(i), open = chapterOpen(Math.floor(i / 4) + 1);
    const label = "Stop " + (i + 1) + ": " + q.title + (done ? ", done" : i === cur ? ", you are here" : open ? "" : ", in the mist");
    const kids = done ? [sv("rect", { x: -8, y: -8, width: 16, height: 16, rx: 2.5, fill: "#b8322a", transform: "rotate(-6)" }),
      P("M-4 0 l3 3 l6 -6", { stroke: "#f6eedd", "stroke-width": 2, fill: "none", "stroke-linecap": "round" })]
      : i === cur ? [sv("circle", { r: 22, fill: "var(--accent)", opacity: 0.35, filter: u("glow") }), sv("circle", { r: 18, fill: "none", stroke: "var(--accent)", "stroke-width": 2, class: "jm-here" })]
      : [sv("ellipse", { rx: 9, ry: 6, fill: "#d8cfbb", stroke: "#6b6a62", "stroke-width": 1.2 }), sv("text", { y: 3, "text-anchor": "middle", class: "jm-num", "font-size": 8 }, document.createTextNode(String(i + 1)))];
    const stop = sv("g", { transform: "translate(" + x + " " + y + ")", class: "jm-stop" + (done ? " done" : i === cur ? " here" : "") + (open ? "" : " misty"), role: "button", tabindex: 0, "aria-label": label },
      sv("circle", { r: 20, fill: "transparent" }), kids);
    stop.addEventListener("click", () => onStop({ stop: i }));
    stop.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onStop({ stop: i }); } });
    o.push(stop);
  });
  // mist over the chapters still to come
  const lockedFrom = [1, 2, 3, 4, 5].find(c => !chapterOpen(c));
  if (lockedFrom) {
    const bottom = J_REGION[lockedFrom - 1][1];
    o.push(sv("g", { filter: u("mist"), "pointer-events": "none" }, sv("rect", { x: -40, y: -40, width: JW + 80, height: bottom + 40, fill: "#f3eee2", opacity: 0.82 })));
    o.push(sv("text", { x: JW / 2, y: bottom - 40, "text-anchor": "middle", class: "jm-mist" }, document.createTextNode("MIST LIFTS WHEN YOU FINISH CHAPTER " + (lockedFrom - 1))));
  }
  o.push(sv("rect", { width: JW, height: JH, filter: u("paper"), "pointer-events": "none" }));
  return sv("svg", { viewBox: "0 0 " + JW + " " + JH, class: "jm-svg", role: "group", "aria-label": "Journey map: " + doneCount() + " of " + J_TOTAL + " quests done" }, o);
}
function jRidge(seed, y0, amp, peaks, base) {
  const r = gRand(seed), pts = [];
  for (let x = -10; x <= JW + 10; x += 6) {
    let y = y0 + (r() * 2 - 1) * amp;
    for (const [px, ph, pw] of peaks) y -= ph * Math.exp(-(((x - px) / pw) ** 2));
    pts.push(x + " " + y.toFixed(1));
  }
  return "M" + pts.join(" L") + " L" + (JW + 10) + " " + base + " L-10 " + base + " Z";
}
/** Your avatar standing on the map, as a little round token placed by percentages so it scales. */
function jAvatarToken() {
  return h("div", { class: "jm-avatar", "aria-hidden": "true" }, h("span", { class: "jm-shadow" }), h("span", { class: "jm-token" }, liveAvatar(40, "My avatar")));
}
function placeToken(el, x, y) { el.style.left = (x / JW * 100) + "%"; el.style.top = (y / JH * 100) + "%"; }
/** Walks the avatar along the trail from one stop to another. */
function walkToken(el, from, to, done) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pts = jCurve(J_STOPS).samples.filter(p => p[2] >= from - 1e-6 && p[2] <= to + 1e-6);
  if (reduce || pts.length < 2) { placeToken(el, ...J_STOPS[to]); done(); return; }
  const dur = Math.min(3200, 850 * (to - from)), t0 = performance.now();
  el.classList.add("walking");
  const step = now => {
    if (!el.isConnected) return;
    const f = Math.min(1, (now - t0) / dur), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    const at = e * (pts.length - 1), i = Math.floor(at), r = at - i, a = pts[i], b = pts[Math.min(i + 1, pts.length - 1)];
    placeToken(el, a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r);
    if (f < 1) requestAnimationFrame(step); else { el.classList.remove("walking"); done(); }
  };
  requestAnimationFrame(step);
}

// ---------- the sheet that slides up for a stop, a reward, the list or the rewards ----------
function closeJSheet() {
  const s = $("#jsheet");
  if (!s) return false;
  s.classList.add("out");
  setTimeout(() => s.remove(), 220);
  return true;
}
function openJSheet(...content) {
  closeJSheet(); const old = $("#jsheet"); if (old) old.remove();
  const sheet = h("div", { class: "jsheet-panel card", role: "dialog", "aria-modal": "true" }, h("span", { class: "jsheet-grab", "aria-hidden": "true" }), ...content);
  const wrap = h("div", { class: "jsheet", id: "jsheet" }, h("div", { class: "jsheet-scrim", onclick: closeJSheet }), sheet);
  document.body.append(wrap);
  setTimeout(() => { const b = sheet.querySelector("button"); if (b) b.focus({ preventScroll: true }); }, 30);
}
function questBar(q) {
  const n = questProgress(q), bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = Math.round(n / q.need * 100) + "%";
  return bar;
}
function questLine(q) {
  const n = questProgress(q);
  if (q.best) return "Best so far: " + n + " of " + q.need;
  if (q.unit === "stage") return "Your garden: stage " + (n + 1) + " of " + (q.need + 1);
  if (q.unit === "level") return "You're level " + levelNow().level + " of " + q.need;
  if (q.unit === "day") return n + " of " + q.need + " days";
  return q.need > 1 ? n + " of " + q.need : "Not yet";
}
function stopSheet(i) {
  const q = QUESTS[i], s = scrollById(i + 1), done = questDone(i), c = Math.floor(i / 4) + 1, open = chapterOpen(c);
  const cur = currentStop();
  openJSheet(
    h("span", { class: "eyebrow" }, "Stop " + (i + 1) + " · " + J_CHAPTERS[c - 1].en + (i === cur ? " · You are here" : done ? " · Done" : "")),
    h("h2", null, open ? q.title : "In the mist"),
    !open ? h("p", { class: "muted" }, "Finish chapter " + (c - 1) + " and the mist lifts.")
      : done ? h("p", { class: "muted" }, "You found the scroll ", h("i", null, s.title), ".")
      : h("div", { class: "stack-tight" }, h("p", { class: "muted" }, questLine(q) + (q.hint ? ". " + q.hint : ".") + " Reward: a scroll."), questBar(q)),
    h("div", { class: "row" },
      done ? h("button", { class: "btn primary", type: "button", onclick: () => { closeJSheet(); openScroll(i + 1); } }, "Read the scroll")
        : open ? h("button", { class: "btn primary", type: "button", onclick: () => { closeJSheet(); q.go[1](); } }, q.go[0]) : null,
      h("button", { class: "btn", type: "button", onclick: closeJSheet }, "Close")));
}
function rewardSheet(i) {
  const c = J_CHAPTERS[i], got = chapterDone(i + 1);
  const how = [null, "Wear it in Customise → Avatar.", "Wear it in Customise → Avatar.", "Choose it in Customise → Clock.", "It hangs on the bridge once your garden has one.", "Wear it in Customise → Avatar, and pick the title under Ranks."][i + 1];
  openJSheet(h("span", { class: "eyebrow" }, "Chapter " + (i + 1) + " · " + c.en + " " + c.zh),
    h("h2", null, got ? "Reward earned" : "Chapter reward"),
    h("p", { class: "muted" }, (got ? "You earned " : "Finish the chapter to earn ") + c.reward + "." + (got ? " " + how : "")),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: closeJSheet }, "Close")));
}
function rewardsSheet() {
  openJSheet(h("h2", null, "Chapter rewards"),
    h("ul", { class: "j-list" }, J_CHAPTERS.map((c, i) => h("li", { class: "j-li" + (chapterDone(i + 1) ? " done" : "") },
      h("span", { class: "j-ic", "aria-hidden": "true" }, chapterDone(i + 1) ? "✓" : String(i + 1)),
      h("span", { class: "stack-tight" }, h("b", null, c.en + " ", h("span", { class: "hz" }, c.zh)), h("span", { class: "muted small" }, c.reward + (chapterDone(i + 1) ? " · earned" : "")))))),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: closeJSheet }, "Close")));
}
function listSheet() {
  const cur = currentStop();
  openJSheet(h("h2", null, "All quests"),
    h("div", { class: "j-chapters" }, J_CHAPTERS.map((c, ci) => h("div", { class: "stack-tight" },
      h("span", { class: "eyebrow" }, (ci + 1) + " · " + c.en + " " + c.zh + (chapterDone(ci + 1) ? " · done" : chapterOpen(ci + 1) ? "" : " · in the mist")),
      h("ul", { class: "j-list" }, QUESTS.slice(ci * 4, ci * 4 + 4).map((q, k) => {
        const i = ci * 4 + k, done = questDone(i), open = chapterOpen(ci + 1);
        return h("li", { class: "j-li" + (done ? " done" : i === cur ? " here" : "") },
          h("span", { class: "j-ic", "aria-hidden": "true" }, done ? "✓" : String(i + 1)),
          h("span", { class: "stack-tight" }, h("b", null, open ? q.title : "???"), h("span", { class: "muted small" }, done ? "Scroll: " + scrollById(i + 1).title : open ? questLine(q) : "Finish chapter " + ci + " first")),
          done ? h("button", { class: "btn small", type: "button", onclick: () => { closeJSheet(); openScroll(i + 1); } }, "Read")
            : open ? h("button", { class: "btn small", type: "button", onclick: () => { closeJSheet(); q.go[1](); } }, "Go") : null);
      }))))),
    h("div", { class: "row" }, h("button", { class: "btn", type: "button", onclick: closeJSheet }, "Close")));
}

// ---------- the Journey page ----------
function viewJourney() {
  const v = h("section", { class: "view journey" });
  if (ui.dict !== "ready") { v.append(h("div", { class: "card" }, loadingBlock())); return v; }
  checkJourney(true);
  const cur = currentStop(), found = doneCount(), j = jState();
  const chap = Math.min(J_CHAPTERS.length, Math.floor(cur / 4) + 1);
  const unread = SCROLLS.filter(s => scrollFound(s.id) && !j.read[s.id]).length;
  const tool = (zh, label, run, extra) => h("button", Object.assign({ class: "jbar-btn", type: "button", onclick: run }, extra || {}), h("span", { class: "hz jbar-zh", "aria-hidden": "true" }, zh), h("span", null, label));
  const mapWrap = h("div", { class: "jm-wrap" + (ui.jFull ? " full" : "") });
  const token = jAvatarToken();
  const bar = h("div", { class: "jbar card", role: "toolbar", "aria-label": "Journey" },
    tool("卷", "Scrolls", () => go("scrolls"), { "aria-label": "Scrolls: " + found + " found" + (unread ? ", " + unread + " unread" : "") }),
    found ? h("span", { class: "jbar-count num", "aria-hidden": "true" }, String(found)) : null,
    tool("宝", "Rewards", rewardsSheet),
    tool("列", "List", listSheet),
    tool(ui.jFull ? "近" : "全", ui.jFull ? "Close up" : "Full map", () => { ui.jFull = !ui.jFull; render(false); }),
    tool("我", "Find me", () => {
      if (ui.jFull) { ui.jFull = false; render(false); }
      setTimeout(() => { const t = $(".journey .jm-avatar"); if (t) centreOn(t); }, 60);
    }),
    tool("日", "Daily", () => toast("Daily quests are coming in a later update."), { class: "jbar-btn soon", "aria-label": "Daily quests: coming later" }));
  v.append(h("div", { class: "card j-status" },
    h("div", { class: "row spread" }, h("b", null, cur >= J_TOTAL ? "Journey complete!" : "Chapter " + chap + " · " + J_CHAPTERS[chap - 1].en + " ", cur >= J_TOTAL ? null : h("span", { class: "hz" }, J_CHAPTERS[chap - 1].zh)),
      h("span", { class: "muted small num" }, found + " / " + J_TOTAL + " scrolls")),
    (() => { const b = h("div", { class: "bar" }, h("i")); b.firstChild.style.width = Math.round(found / J_TOTAL * 100) + "%"; return b; })(),
    cur < J_TOTAL ? h("button", { class: "plain-btn j-next", type: "button", onclick: () => stopSheet(cur) }, h("span", { class: "muted small" }, "Next: "), QUESTS[cur].title, h("span", { class: "muted small" }, " · " + questLine(QUESTS[cur]))) : null));
  v.append(bar);
  const map = journeyMap(sel => (sel.reward !== undefined ? rewardSheet(sel.reward) : stopSheet(sel.stop)));
  mapWrap.append(map, token);
  v.append(mapWrap);
  // stand where you last were, then walk on to where you are now
  const from = Math.min(j.seen, cur, J_TOTAL - 1), to = Math.min(cur, J_TOTAL - 1);
  placeToken(token, ...J_STOPS[from]);
  setTimeout(() => {
    if (!token.isConnected) return;
    if (!ui.jFull) centreOn(token, true);
    if (to > from) setTimeout(() => walkToken(token, from, to, () => { commit({ journey: { ...state.journey, seen: to } }); }), 500);
    else if (j.seen !== to) commit({ journey: { ...state.journey, seen: to } });
  }, 60);
  return v;
}
function centreOn(el, instant) {
  const r = el.getBoundingClientRect();
  window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight / 2), behavior: instant ? "auto" : "smooth" });
}

// ---------- scrolls: the library and a scroll ----------
function scrollText(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const word = m[1], e = Engine.lookup(word)[0];
    out.push(e ? h("button", { class: "plain-btn j-word hz", type: "button", lang: "zh", title: Engine.toMarks(e.p) + ": " + shortDef(e, 1), onclick: () => openWord(e.s, e) }, disp(e)) : h("span", { class: "hz", lang: "zh" }, word));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function viewScrolls() {
  const v = h("section", { class: "view" });
  const j = jState();
  const list = h("ol", { class: "scroll-list" });
  for (const s of SCROLLS) {
    const got = scrollFound(s.id), q = QUESTS[s.id - 1];
    list.append(h("li", null, h("button", { class: "scroll-row" + (got ? "" : " rolled"), type: "button", disabled: !got, onclick: () => openScroll(s.id),
      "aria-label": got ? "Scroll " + s.id + ": " + s.title + (j.read[s.id] ? "" : ", new") : "Scroll " + s.id + ", not found yet: " + q.title },
      h("span", { class: "scroll-ic", "aria-hidden": "true" }), h("span", { class: "stack-tight" }, h("b", null, got ? s.title : "Rolled up"),
        h("span", { class: "muted small" }, got ? s.cat : "Found by: " + (chapterOpen(Math.floor((s.id - 1) / 4) + 1) ? q.title : "a quest in the mist"))),
      got && !j.read[s.id] ? h("span", { class: "badge new-badge" }, "New") : h("span", { class: "hz muted scroll-seal" }, got ? s.zh : ""))));
  }
  v.append(h("div", { class: "card stack" }, h("div", { class: "row spread" }, h("b", null, doneCount() + " of " + J_TOTAL + " found"),
    h("button", { class: "btn small", type: "button", onclick: () => go("journey") }, "The map")), list));
  return v;
}
function viewScroll() {
  const v = h("section", { class: "view" });
  const s = scrollById(ui.scrollId);
  if (!s || !scrollFound(s.id)) { setTimeout(() => go("scrolls"), 0); return v; }
  const found = SCROLLS.filter(x => scrollFound(x.id)), at = found.indexOf(s), prev = found[at - 1], next = found[at + 1];
  v.append(h("article", { class: "scroll-paper", lang: "en" },
    h("span", { class: "scroll-seal-big hz", "aria-hidden": "true" }, [...s.zh].map(c => h("span", null, c))),
    h("span", { class: "scroll-kicker" }, "Scroll " + s.id + " · " + s.cat),
    h("h2", null, s.title),
    s.id === 13 ? h("span", { class: "scroll-vert hz", "aria-hidden": "true" }, "春风得意") : null,
    s.body.map(p => h("p", null, scrollText(p))),
    h("p", { class: "scroll-foot" }, "Tap a red word to open it.")));
  v.append(h("div", { class: "row scroll-nav" },
    prev ? h("button", { class: "btn", type: "button", onclick: () => openScroll(prev.id) }, icon("back"), "Previous") : null,
    h("button", { class: "btn", type: "button", onclick: () => go("scrolls") }, "All scrolls"),
    next ? h("button", { class: "btn", type: "button", onclick: () => openScroll(next.id) }, "Next", icon("next")) : null));
  return v;
}

// ---------- Home and My Zì: where you are on the journey ----------
function journeyHomeBox() {
  if (ui.dict !== "ready" || mleOn()) return null;
  const cur = currentStop();
  if (cur >= J_TOTAL) return null;                 // the journey's done: the box steps aside
  const q = QUESTS[cur], chap = Math.floor(cur / 4) + 1, [, y] = J_STOPS[cur];
  const top = Math.max(0, Math.min(JH - 170, y - 95));
  const map = journeyMap(sel => { go("journey"); setTimeout(() => (sel.reward !== undefined ? rewardSheet(sel.reward) : stopSheet(sel.stop)), 80); });
  map.setAttribute("viewBox", "0 " + top + " " + JW + " 170");
  map.classList.add("jm-slice");
  const token = jAvatarToken();
  const slice = h("div", { class: "jm-wrap jm-home" }, map, token);
  token.style.left = (J_STOPS[cur][0] / JW * 100) + "%"; token.style.top = ((y - top) / 170 * 100) + "%";
  return h("div", { class: "card stack j-home" },
    h("span", { class: "eyebrow" }, "Your journey"),
    h("div", { class: "row spread" }, h("b", null, "Chapter " + chap + " · " + J_CHAPTERS[chap - 1].en + " ", h("span", { class: "hz" }, J_CHAPTERS[chap - 1].zh)), h("span", { class: "muted small num" }, (cur % 4) + " / 4")),
    slice,
    h("div", { class: "stack-tight" }, h("b", null, q.title), h("span", { class: "muted small" }, questLine(q) + " · Reward: a scroll"), questBar(q)),
    h("div", { class: "row" }, h("button", { class: "btn primary", type: "button", onclick: () => { closePanel(); q.go[1](); } }, q.go[0]),
      h("button", { class: "btn", type: "button", onclick: () => go("journey") }, "See the journey")));
}
function journeyMyZiBox() {
  const cur = currentStop(), n = doneCount();
  return h("div", { class: "card stack" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Journey ", h("span", { class: "hz" }, "旅程")),
      h("button", { class: "btn", type: "button", onclick: () => go("journey") }, "Open the map")),
    h("p", { class: "muted small" }, cur >= J_TOTAL ? "You've finished the journey and found every scroll." : "Next: " + QUESTS[cur].title + ". " + n + " of " + J_TOTAL + " scrolls found."),
    h("div", { class: "row" }, h("button", { class: "btn small", type: "button", onclick: () => go("scrolls") }, "My scrolls (" + n + ")")));
}
