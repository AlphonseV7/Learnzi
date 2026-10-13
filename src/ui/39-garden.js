/* LearnZì UI, part 6d: the tone trainer's water garden, a little pet that grows as your ears do.
 * Every correct tone is a growth point (runs of 5 in a row give bonus points); every 5 points the
 * garden reaches its next stage. Counted over your whole lifetime and synced (progress.garden).
 * Painted in code as an ink-wash picture in its own colours; the box around it follows the theme. */

const GARDEN_STEP = 5;
// [English, Chinese, numbered pinyin, a line about it]
const GARDEN = [
  ["Bare rocks", "石头", "shi2 tou5", "A trickle of water finds its way down the rocks."],
  ["Waterfall", "瀑布", "pu4 bu4", "The trickle becomes a waterfall."],
  ["Pond", "池塘", "chi2 tang2", "A pond fills at the foot of the falls."],
  ["Grass", "草", "cao3", "Grass grows along the bank."],
  ["Lily pads", "荷叶", "he2 ye4", "Lily pads float on the pond."],
  ["Koi", "锦鲤", "jin3 li3", "A golden koi arrives."],
  ["Lotus", "莲花", "lian2 hua1", "A lotus opens on a lily pad."],
  ["Bamboo", "竹子", "zhu2 zi5", "Bamboo sways by the water."],
  ["Another koi", "锦鲤", "jin3 li3", "A second koi joins the first."],
  ["Plum tree", "梅树", "mei2 shu4", "A plum tree takes root."],
  ["Blossom", "梅花", "mei2 hua1", "The plum tree blossoms."],
  ["Petals in the wind", "花瓣", "hua1 ban4", "Petals drift on the wind."],
  ["Mist", "雾", "wu4", "Mist rises from the falls."],
  ["Egret", "白鹭", "bai2 lu4", "An egret comes to fish."],
  ["Butterflies", "蝴蝶", "hu2 die2", "Butterflies dance over the bank."],
  ["Stone bridge", "石桥", "shi2 qiao2", "A stone bridge crosses the pond."],
  ["Pavilion", "亭子", "ting2 zi5", "A pavilion stands by the water."],
  ["Lanterns", "灯笼", "deng1 long5", "Lanterns glow in the pavilion."],
  ["Evening", "傍晚", "bang4 wan3", "Evening settles over the garden."],
  ["Full moon", "月亮", "yue4 liang5", "The full moon rises and shines on the pond."],
  ["Fireflies", "萤火虫", "ying2 huo3 chong2", "Fireflies light up the night. Your garden is complete!"],
];
const gardenPoints = () => (progress.garden || [0, 0])[0];
const gardenStage = (pts = gardenPoints()) => Math.min(GARDEN.length - 1, Math.floor(pts / GARDEN_STEP));

/** Adds growth points. Returns the new stage if the garden grew. */
function gardenGrow(points, correct) {
  const g = progress.garden || [0, 0];
  const before = gardenStage(g[0]);
  progress.garden = [g[0] + points, g[1] + correct];
  const after = gardenStage(progress.garden[0]);
  if (after > before) {
    ui.gardenNew = after;
    const st = GARDEN[after];
    setTimeout(() => toast("Your garden grew: " + st[1] + " " + st[0].toLowerCase() + "!"), 350);
    if (state.sounds) chime(0.1);
  }
  return after > before ? after : 0;
}

// ---------- drawing: an ink-wash painting (水墨) on rice paper ----------
// Misty ranges in soft washes, a painted rock with a paper-white fall, ink bamboo and plum, small touches
// of colour (vermilion koi, pink lotus, red plum, lanterns) and a red seal with the stage's name. It
// grows a piece at each stage; day turns to dusk at stage 19 and a moonlit night at 20. Drawn in its own
// colours in every theme (the frame around it follows the theme). The moving parts (water, ripples,
// koi, petals, mist, fireflies) sit outside the filtered layers so the brush textures are drawn once.
const GW = 360, GH = 160;
const GARDEN_LOOK = {
  day: { sky: ["#e6dcc4", "#f3ecdc"], far: "#9aa39c", mid: "#6f7a74", mist: "#efe6d2", ink: "#2b2a28", rock2: "#55534c", tex: "#7a776d", fall: "#b7b2a5",
    pond: "#b9c3bd", ripple: "#7d8a84", grass: "#4d5a3f", pad: "#7f9a6e", bamboo: "#3c4436", bridge: "#6b6a62" },
  dusk: { sky: ["#6f5a66", "#e2b48c"], far: "#8a7f86", mid: "#5f5662", mist: "#e7c9a8", ink: "#24201f", rock2: "#4a4142", tex: "#6d625f", fall: "#c9b8a8",
    pond: "#a99a98", ripple: "#7a6c70", grass: "#3e4434", pad: "#6c7f5c", bamboo: "#34392f", bridge: "#5e5753" },
  night: { sky: ["#111827", "#3a3f55"], far: "#3c4760", mid: "#2b3448", mist: "#4a5370", ink: "#0d1018", rock2: "#262c3d", tex: "#3a4258", fall: "#8d97b0",
    pond: "#2f3b55", ripple: "#5c6a8c", grass: "#25304a", pad: "#3e5a52", bamboo: "#4a5674", bridge: "#535c75" },
};
/** A seeded random number source, so the painting looks the same every time. */
function gRand(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/** A mountain range's outline: gentle peaks with a little hand-painted wobble, closed along the bottom. */
function gRidge(seed, y0, amp, peaks) {
  const r = gRand(seed), pts = [];
  for (let x = -10; x <= GW + 10; x += 6) {
    let y = y0 + (r() * 2 - 1) * amp;
    for (const [px, ph, pw] of peaks) y -= ph * Math.exp(-(((x - px) / pw) ** 2));
    pts.push(x + " " + y.toFixed(1));
  }
  return "M" + pts.join(" L") + " L" + (GW + 10) + " " + GH + " L-10 " + GH + " Z";
}
let gardenSeq = 0;
function gardenScene(stage, newStage) {
  const k = "gk" + (++gardenSeq) + "-";   // its own ids, so two gardens on a page never share colours
  const look = stage >= 19 ? "night" : stage >= 18 ? "dusk" : "day", C = GARDEN_LOOK[look], night = look === "night";
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const g = (st, kids, cls) => sv("g", { class: "gs" + (st === newStage ? " g-new" : "") + (cls ? " " + cls : "") }, kids);
  const P = (d, attrs) => sv("path", Object.assign({ d }, attrs));
  const o = [];
  o.push(sv("defs", {},
    sv("filter", { id: k + "paper", x: 0, y: 0, width: "100%", height: "100%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.8, numOctaves: 3, seed: 7 }),
      sv("feColorMatrix", { values: "0 0 0 0 0.35  0 0 0 0 0.30  0 0 0 0 0.22  0 0 0 0.10 0" })),
    sv("filter", { id: k + "brush", x: "-5%", y: "-5%", width: "110%", height: "110%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.05, numOctaves: 3, seed: 3, result: "n" }),
      sv("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 5 }), sv("feGaussianBlur", { stdDeviation: 0.35 })),
    sv("filter", { id: k + "wash", x: "-10%", y: "-20%", width: "120%", height: "140%" }, sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.03, numOctaves: 2, seed: 9, result: "n" }),
      sv("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: 8 }), sv("feGaussianBlur", { stdDeviation: 1.6 })),
    sv("filter", { id: k + "soft" }, sv("feGaussianBlur", { stdDeviation: 2.2 })),
    sv("filter", { id: k + "glow", x: "-100%", y: "-100%", width: "300%", height: "300%" }, sv("feGaussianBlur", { stdDeviation: 3 })),
    sv("linearGradient", { id: k + "fade", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: 0, "stop-color": "#fff" }), sv("stop", { offset: 0.75, "stop-color": "#fff", "stop-opacity": 0.15 }), sv("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0 })),
    sv("mask", { id: k + "base", maskUnits: "userSpaceOnUse", x: 0, y: 0, width: GW, height: GH }, sv("rect", { width: GW, height: GH, fill: "url(#" + k + "fade)" })),
    sv("linearGradient", { id: k + "sky", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: 0, "stop-color": C.sky[0] }), sv("stop", { offset: 1, "stop-color": C.sky[1] })),
    sv("radialGradient", { id: k + "halo" }, sv("stop", { offset: 0, "stop-color": "#f6efd9", "stop-opacity": 0.55 }), sv("stop", { offset: 1, "stop-color": "#f6efd9", "stop-opacity": 0 })),
    sv("linearGradient", { id: k + "fall", x1: 0, y1: 0, x2: 0, y2: 1 }, sv("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0.95 }), sv("stop", { offset: 1, "stop-color": "#fff", "stop-opacity": 0.55 })),
    sv("clipPath", { id: k + "fallclip" }, P("M176 26 Q180 23 188 25 L190 120 L174 120 Q176 70 176 26 Z"))));
  o.push(sv("rect", { width: GW, height: GH, fill: "url(#" + k + "sky)" }));
  // the night sky: stars, then the moon
  if (night) o.push(sv("g", {}, [[40, 20], [88, 12], [150, 26], [200, 10], [250, 22], [330, 30], [18, 44], [118, 40]].map(([x, y], i) =>
    sv("circle", { cx: x, cy: y, r: 0.9, fill: "#f4ecd4", class: "g-twinkle", style: "animation-delay: " + (-i * 0.7) + "s" }))));
  if (stage >= 19) o.push(g(19, [sv("circle", { cx: 292, cy: 40, r: 30, fill: "url(#" + k + "halo)" }), sv("circle", { cx: 292, cy: 40, r: 13, fill: "#f4ecd4" })]));
  // far and near ranges, fading into mist at their feet
  o.push(sv("g", { mask: "url(#" + k + "base)", filter: "url(#" + k + "wash)" },
    P(gRidge(1, 92, 2.5, [[40, 34, 30], [110, 22, 26], [250, 40, 36], [330, 26, 24]]), { fill: C.far, opacity: 0.55 })));
  o.push(sv("g", { mask: "url(#" + k + "base)", filter: "url(#" + k + "wash)" }, P(gRidge(2, 104, 2, [[20, 26, 22], [300, 30, 30], [350, 18, 16]]), { fill: C.mid, opacity: 0.6 })));
  o.push(sv("rect", { x: 0, y: 92, width: GW, height: 22, fill: C.mist, opacity: 0.55, filter: "url(#" + k + "soft)" }));
  // the painted rock: two ink tones and short texture strokes (皴)
  o.push(sv("g", { filter: "url(#" + k + "brush)" },
    P("M126 126 L131 98 Q127 74 140 60 Q147 44 158 46 Q163 26 178 20 Q194 16 202 32 Q216 38 216 58 Q228 70 224 96 L232 126 Z", { fill: C.ink, opacity: 0.9 }),
    P("M140 64 Q150 52 158 54 L154 92 Q146 80 140 64 Z M204 40 Q214 48 212 66 L222 98 L206 80 Z M164 34 Q170 28 176 30 L172 58 Z", { fill: C.rock2, opacity: 0.9 })));
  const r = gRand(21), tex = [];
  for (let i = 0; i < 16; i++) {
    const x = 136 + r() * 86, y = 50 + r() * 68, a = 2 + r() * 3, b = 2 + r() * 3, c = 1 + r() * 2, d = 6 + r() * 4;
    if (x > 172 && x < 192) continue;
    tex.push("M" + x.toFixed(0) + " " + y.toFixed(0) + " q" + a.toFixed(1) + " " + b.toFixed(1) + " " + c.toFixed(1) + " " + d.toFixed(1));
  }
  o.push(P(tex.join(" "), { stroke: C.tex, "stroke-width": 0.9, fill: "none", "stroke-linecap": "round", opacity: 0.8 }));
  // the water: a trickle at first, then a full fall with moving streaks
  if (stage >= 1) {
    const streaks = [];
    for (let i = 0; i < 5; i++) for (const off of [0, 48]) streaks.push(sv("rect", { x: 177 + i * 2.6, y: 4 + off + (i % 3) * 14, width: 0.7, height: 22, fill: C.fall, opacity: 0.8 }));
    o.push(g(1, [sv("g", { filter: "url(#" + k + "brush)" }, P("M176 26 Q180 23 188 25 L190 120 L174 120 Q176 70 176 26 Z", { fill: "url(#" + k + "fall)" })),
      sv("g", { "clip-path": "url(#" + k + "fallclip)" }, sv("g", { class: "g-fall" }, streaks))]));
  } else o.push(P("M181 30 Q182 70 182 118", { stroke: "#fff", "stroke-width": 1.4, fill: "none", opacity: 0.8 }));
  // pond: a wash with horizontal strokes, and rings where the fall lands
  if (stage >= 2) {
    const r2 = gRand(4), strokes = [];
    for (let i = 0; i < 14; i++) { const y = 124 + i * 2, x = 50 + r2() * 40 - 10, w = 40 + r2() * 80; strokes.push("M" + x.toFixed(0) + " " + y + " q" + (w / 2).toFixed(0) + " " + (r2() * 2.4 - 1.2).toFixed(1) + " " + w.toFixed(0) + " 0"); }
    o.push(g(2, [sv("g", { filter: "url(#" + k + "brush)" }, P("M28 132 Q90 116 180 120 Q280 116 336 132 Q300 150 180 152 Q60 152 28 132 Z", { fill: C.pond, opacity: 0.75 })),
      P(strokes.join(" "), { stroke: C.ripple, "stroke-width": 0.6, fill: "none", opacity: 0.55 }),
      ...[0, 1, 2].map(i => sv("ellipse", { cx: 182, cy: 122, rx: 12, ry: 2.6, fill: "none", stroke: "#fff", "stroke-width": 0.8, class: "g-ripple", style: "animation-delay: " + (-i * 0.8) + "s" }))]));
  } else o.push(sv("ellipse", { cx: 182, cy: 120, rx: 12, ry: 2.6, fill: C.pond, opacity: 0.8 }));
  if (stage >= 1) o.push(sv("ellipse", { cx: 182, cy: 120, rx: 18, ry: 5, fill: "#fff", opacity: 0.6, filter: "url(#" + k + "soft)" }));
  // banks
  o.push(sv("g", { filter: "url(#" + k + "brush)" }, P("M0 140 Q30 126 64 138 Q40 156 0 158 Z M360 136 Q324 128 300 142 Q330 158 360 158 Z", { fill: C.ink, opacity: 0.7 }),
    sv("rect", { x: 0, y: 154, width: GW, height: 6, fill: C.ink, opacity: 0.55 })));
  if (stage >= 3) o.push(g(3, [[10, 140], [26, 138], [318, 138], [334, 140], [300, 150], [60, 152]].map(([x, y]) =>
    P("M" + x + " " + y + " q1 -8 5 -12 q-2 6 -3 12 Z M" + (x + 5) + " " + y + " q2 -10 7 -13 q-3 7 -4 13 Z", { fill: C.grass, opacity: 0.9 }))));
  if (stage >= 4) o.push(g(4, [sv("g", { filter: "url(#" + k + "brush)" }, [[100, 138, 1], [238, 142, 0.9], [214, 130, 0.8]].map(([x, y, k]) =>
    sv("ellipse", { cx: x, cy: y, rx: 12 * k, ry: 4 * k, fill: C.pad, opacity: 0.85 })))]));
  const koi = (col, spot, dur, reverse) => {
    const fish = sv("g", {}, P("M-8 0 Q-2 -3.6 7 0 Q-2 3.6 -8 0 Z", { fill: col }), P("M-8 0 Q-13 -5 -16 -3 Q-12 -1 -13 0 Q-12 1 -16 3 Q-13 5 -8 0 Z", { fill: col, opacity: 0.85 }),
      sv("circle", { cx: 1, cy: -0.6, r: 1.6, fill: spot }));
    const path = "M80 138 C120 128 170 132 220 134 C270 136 300 140 280 146 C240 150 140 150 100 146 C70 144 64 140 80 138 Z";
    if (calm) fish.setAttribute("transform", reverse ? "translate(262 136) rotate(168)" : "translate(140 140) rotate(-8)");
    else fish.append(sv("animateMotion", { dur: dur + "s", repeatCount: "indefinite", rotate: "auto", keyPoints: reverse ? "1;0" : "0;1", keyTimes: "0;1", calcMode: "linear", path }));
    return fish;
  };
  if (stage >= 5) o.push(g(5, [koi("#d9502a", "#f2ead8", 16)]));
  if (stage >= 6) o.push(g(6, [sv("g", { transform: "translate(214 128)" },
    [-50, -22, 0, 22, 50].map((a, i) => P("M0 0 Q" + (-3 + i * 1.5) + " -7 " + (-1 + i * 0.5) + " -9 Q" + (1 + i * 0.2) + " -6 0 0 Z", { fill: "#e48aa6", opacity: 0.9, transform: "rotate(" + a + ")" })),
    sv("circle", { r: 1.3, cy: -2, fill: "#d7a43b" }))]));
  if (stage >= 7) {
    const culms = [], leaves = [];
    [[16, 40], [27, 54], [36, 66]].forEach(([x, top], i) => { for (let y = top; y < 154; y += 18) culms.push(sv("rect", { x, y, width: 3.2, height: Math.min(18, 154 - y) - 1.2, rx: 1.2, fill: C.bamboo, opacity: 0.9 - i * 0.15 })); });
    for (const [x, y, a, l] of [[19, 44, -30, 18], [19, 47, -10, 15], [19, 50, 200, 16], [19, 53, 175, 13], [30, 60, -20, 16], [30, 63, 5, 13], [30, 64, 210, 14], [39, 72, -40, 14], [39, 75, -15, 12], [19, 70, 15, 15], [38, 90, 195, 13], [38, 93, 170, 11]])
      leaves.push(P("M0 0 Q" + (l * 0.45).toFixed(1) + " -2.6 " + l + " 0 Q" + (l * 0.45).toFixed(1) + " 1.6 0 0 Z", { fill: C.bamboo, opacity: 0.9, transform: "translate(" + x + " " + y + ") rotate(" + a + ")" }));
    o.push(g(7, [sv("g", { class: "g-sway", style: "transform-origin: 26px 154px" }, sv("g", { filter: "url(#" + k + "brush)" }, culms), leaves)]));
  }
  if (stage >= 8) o.push(g(8, [koi("#f3ecdc", "#d9502a", 21, true)]));
  if (stage >= 9) o.push(g(9, [sv("g", { filter: "url(#" + k + "brush)" }, P("M322 142 Q318 118 308 104 Q298 92 284 88 M310 108 Q324 94 342 92 M300 96 Q294 80 300 68 M316 122 Q332 116 348 106",
    { stroke: C.ink, "stroke-width": 3.2, fill: "none", "stroke-linecap": "round" }))]));
  if (stage >= 10) {
    const r3 = gRand(11);
    o.push(g(10, [[284, 88], [290, 84], [342, 92], [334, 96], [300, 68], [303, 76], [348, 106], [340, 110], [322, 100], [280, 92], [326, 90], [296, 92], [312, 84]].map(([x, y]) =>
      sv("g", {}, sv("circle", { cx: (x + r3() * 2 - 1).toFixed(1), cy: (y + r3() * 2 - 1).toFixed(1), r: (2 + r3()).toFixed(1), fill: "#c8384a", opacity: (0.75 + r3() * 0.2).toFixed(2) }),
        sv("circle", { cx: x, cy: y, r: 0.6, fill: "#f1d27a" })))));
  }
  if (stage >= 11) o.push(g(11, [0, 1, 2, 3, 4, 5].map(i => sv("ellipse", { cx: 290 + (i % 3) * 18, cy: 86 + (i % 2) * 14, rx: 1.7, ry: 1.1, fill: "#c8384a", opacity: 0.85,
    class: "g-petal", style: "animation-delay: " + (-i * 1.3) + "s; animation-duration: " + (7 + (i % 3)) + "s" }))));
  if (stage >= 12) o.push(g(12, [sv("ellipse", { cx: 190, cy: 112, rx: 50, ry: 7, fill: "#fff", opacity: night ? 0.22 : 0.45, filter: "url(#" + k + "soft)", class: "g-mist" }),
    sv("ellipse", { cx: 120, cy: 104, rx: 40, ry: 5, fill: "#fff", opacity: night ? 0.15 : 0.35, filter: "url(#" + k + "soft)", class: "g-mist", style: "animation-delay: -3s" })]));
  if (stage >= 13) o.push(g(13, [sv("g", { transform: "translate(78 132)" }, P("M0 0 l-1 12 M2 0 l1 12", { stroke: "#222", "stroke-width": 0.7 }),
    P("M-6 -2 Q0 -10 6 -4 Q2 2 -6 -2 Z", { fill: "#f4f0e6" }), P("M4 -6 Q6 -16 2 -20 Q6 -21 7 -19 l5 1 l-5 1 Q8 -14 6 -5 Z", { fill: "#f4f0e6" }),
    sv("circle", { cx: 5.6, cy: -19.4, r: 0.5, fill: "#222" }))]));
  if (stage >= 14) o.push(g(14, [[110, 100, 0], [258, 92, -1.5]].map(([x, y, d]) => sv("g", { class: "g-fly", style: "animation-delay: " + d + "s" },
    sv("g", { transform: "translate(" + x + " " + y + ")" }, P("M0 0 q-5 -6 -7 -1 q2 3 7 1 Z", { fill: night ? "#9aa6c4" : C.ink, opacity: 0.8, class: "g-wing" }),
      P("M0 0 q5 -6 7 -1 q-2 3 -7 1 Z", { fill: night ? "#9aa6c4" : C.ink, opacity: 0.8, class: "g-wing r" }))))));
  if (stage >= 15) o.push(g(15, [sv("g", { filter: "url(#" + k + "brush)" }, P("M54 146 Q92 118 130 146 L126 148 Q92 126 58 148 Z", { fill: C.bridge }))]));
  if (stage >= 15 && typeof chapterDone === "function" && chapterDone(4)) o.push(sv("g", { class: "g-reward" },   // Journey chapter 4
    P("M92 126 V132", { stroke: "#2b2a28", "stroke-width": 0.6 }), sv("circle", { cx: 92, cy: 136, r: 6, fill: "#ff6a3c", opacity: 0.35, filter: "url(#" + k + "glow)", class: "g-glow" }),
    sv("ellipse", { cx: 92, cy: 136, rx: 2.4, ry: 3, fill: "#e0452b" })));
  if (stage >= 16) o.push(g(16, [sv("g", { transform: "translate(250 108)", filter: "url(#" + k + "brush)" },
    sv("rect", { x: -16, y: -4, width: 2.6, height: 20, fill: C.ink }), sv("rect", { x: 13.4, y: -4, width: 2.6, height: 20, fill: C.ink }),
    P("M-26 -3 Q-14 -6 0 -18 Q14 -6 26 -3 Q14 -6 0 -10 Q-14 -6 -26 -3 Z", { fill: C.ink }), sv("rect", { x: -18, y: 15, width: 36, height: 3, fill: C.ink }))]));
  if (stage >= 17) o.push(g(17, [238, 262].map(x => sv("g", {}, sv("circle", { cx: x, cy: 114, r: 8, fill: "#ff6a3c", opacity: 0.35, filter: "url(#" + k + "glow)", class: "g-glow" }),
    sv("ellipse", { cx: x, cy: 114, rx: 3, ry: 3.8, fill: "#e0452b" })))));
  if (stage >= 19) o.push(g(19, [sv("ellipse", { cx: 292, cy: 144, rx: 14, ry: 1.6, fill: "#f4ecd4", opacity: 0.45, class: "g-twinkle" })]));
  if (stage >= 20) o.push(g(20, [[70, 112], [110, 100], [150, 140], [220, 96], [300, 146], [196, 92], [40, 130]].map(([x, y], i) => sv("g", { class: "g-firefly", style: "animation-delay: " + (-i * 0.9) + "s" },
    sv("circle", { cx: x, cy: y, r: 3, fill: "#f6ee9a", opacity: 0.35, filter: "url(#" + k + "glow)" }), sv("circle", { cx: x, cy: y, r: 1, fill: "#fbf6c2" })))));
  // the red seal with this stage's name, then the paper grain over everything
  const name = [...GARDEN[stage][1]], sz = name.length > 2 ? 6 : 7.4, line = sz + 0.6, sealH = Math.max(20, 6 + name.length * line), top = (sealH - name.length * line) / 2;
  o.push(sv("g", { class: "g-seal", transform: "translate(332 18)" }, sv("rect", { width: 20, height: sealH, rx: 2, fill: "#b8322a", opacity: 0.92 }),
    name.map((ch, i) => sv("text", { x: 10, y: (top + (i + 1) * line - 1.2).toFixed(1), "font-size": sz, "text-anchor": "middle", fill: "#f6eedd", "font-family": "serif" }, document.createTextNode(ch)))));
  o.push(sv("rect", { width: GW, height: GH, filter: "url(#" + k + "paper)", "pointer-events": "none" }));
  return sv("svg", { viewBox: "0 0 " + GW + " " + GH, preserveAspectRatio: "xMidYMid slice", class: "garden-svg", role: "img",
    "aria-label": "Your water garden, an ink painting: " + GARDEN.slice(0, stage + 1).map(x => x[0].toLowerCase()).join(", ") }, o);
}

/** The garden box beside the tone trainer. */
function gardenBox() {
  const pts = gardenPoints(), stage = gardenStage(pts), st = GARDEN[stage];
  const done = stage >= GARDEN.length - 1;
  const into = pts - stage * GARDEN_STEP;
  const bar = h("div", { class: "bar" }, h("i"));
  bar.firstChild.style.width = (done ? 100 : Math.round((into / GARDEN_STEP) * 100)) + "%";
  const isNew = ui.gardenNew === stage;
  const bonus = ui.gardenBonus;
  ui.gardenNew = null; ui.gardenBonus = 0;
  return h("div", { class: "card garden-card" + (isNew ? " grew" : "") },
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, "Water garden"), h("span", { class: "muted small num" }, "Stage " + (stage + 1) + " of " + GARDEN.length)),
    h("div", { class: "garden-screen" }, gardenScene(stage, isNew ? stage : -1),
      bonus ? h("div", { class: "garden-bonus", "aria-hidden": "true" }, "+" + bonus) : null),
    h("div", { class: "garden-name" }, rubyHz(st[1], st[2]), h("b", null, st[0])),
    h("p", { class: "muted small garden-line" }, st[3]),
    bar,
    h("p", { class: "muted small" }, done ? (progress.garden[1] + " correct tones in all. Keep training to keep it glowing.")
      : (GARDEN_STEP - into) + " more to grow: " + GARDEN[stage + 1][0].toLowerCase() + ". Five right in a row gives a bonus."));
}
