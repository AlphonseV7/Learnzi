/* LearnZì UI, part 6d: the tone trainer's water garden, a little pet that grows as your ears do.
 * Every correct tone is a growth point (runs of 5 in a row give bonus points); every 5 points the
 * garden reaches its next stage. Counted over your whole lifetime and synced (progress.garden).
 * Drawn in code in its own natural colours; the box around it follows the theme. */

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

// ---------- drawing ----------
const G = { // natural colours, the same in every theme
  sky1: "#bfe3f2", sky2: "#eef8f1", dusk1: "#2a2c5c", dusk2: "#e8a06a", rock: "#7d8a86", rock2: "#5f6b69", rockHi: "#a3b0aa",
  water: "#5fb2d6", water2: "#8fd0ea", foam: "#ffffff", bank: "#7cb35a", bank2: "#5b9442", grass: "#4f8f3a", pad: "#3f9a4f",
  koi: "#f08a24", koi2: "#ffffff", koiRed: "#e2463a", lotus: "#f49ac1", bamboo: "#5fa04e", trunk: "#6b4a34", blossom: "#f7a8c4",
  egret: "#ffffff", bridge: "#a39c92", roof: "#b8342b", pillar: "#8a2a22", lantern: "#ff5a3c", moon: "#fff6c8",
};
function gardenScene(stage, newStage) {
  const evening = stage >= 18;
  const g = (s, kids, cls) => sv("g", { class: "gs" + (s === newStage ? " g-new" : "") + (cls ? " " + cls : "") }, kids);
  const out = [];
  out.push(sv("defs", {},
    sv("linearGradient", { id: "gsky", x1: 0, y1: 0, x2: 0, y2: 1 },
      sv("stop", { offset: 0, "stop-color": evening ? G.dusk1 : G.sky1 }), sv("stop", { offset: 1, "stop-color": evening ? G.dusk2 : G.sky2 })),
    sv("clipPath", { id: "gfall" }, sv("rect", { x: 106, y: 30, width: stage >= 1 ? 28 : 6, height: 86 }))));
  out.push(sv("rect", { x: 0, y: 0, width: 240, height: 160, fill: "url(#gsky)" }));
  if (stage >= 18) out.push(g(18, [[30, 18], [60, 30], [180, 14], [210, 34], [150, 24], [95, 12]].map(([x, y], i) =>
    sv("circle", { cx: x, cy: y, r: 1.1, fill: "#fff", class: "g-twinkle", style: "animation-delay: " + (-i * 0.7) + "s" }))));
  if (stage >= 19) out.push(g(19, [sv("circle", { cx: 196, cy: 30, r: 13, fill: G.moon, class: "g-moonglow" })]));
  // hills and the cliff the water falls from
  out.push(sv("path", { d: "M0 92 Q40 60 80 78 Q120 40 170 70 Q210 52 240 74 V160 H0 Z", fill: evening ? "#3d4a5a" : "#a9cdb5" }));
  out.push(sv("path", { d: "M78 118 L84 52 Q96 26 120 24 Q146 26 156 50 L164 118 Z", fill: G.rock }));
  out.push(sv("path", { d: "M84 60 Q100 40 112 46 L108 80 Z M150 56 L160 100 L138 76 Z", fill: G.rockHi, opacity: 0.6 }));
  out.push(sv("path", { d: "M86 112 L92 86 L104 104 Z M140 100 L150 84 L158 112 Z", fill: G.rock2 }));
  // water: a trickle, then a full fall with moving streaks
  const streaks = [];
  for (let i = 0; i < 7; i++) streaks.push(sv("rect", { x: 108 + i * 4, y: 10 + (i % 3) * 12, width: 1.6, height: 16, fill: G.foam, opacity: 0.7, rx: 0.8 }));
  out.push(sv("g", { "clip-path": "url(#gfall)" },
    sv("rect", { x: 104, y: 28, width: 32, height: 90, fill: G.water2 }),
    sv("g", { class: "g-fall" }, streaks, streaks.map(s => { const c = s.cloneNode(); c.setAttribute("y", String(+s.getAttribute("y") + 44)); return c; }))));
  if (stage >= 1) out.push(g(1, [sv("rect", { x: 106, y: 28, width: 28, height: 4, rx: 2, fill: G.foam, opacity: 0.8 })]));
  // pond
  if (stage >= 2) {
    out.push(g(2, [
      sv("ellipse", { cx: 120, cy: 132, rx: 104, ry: 22, fill: G.water }),
      sv("ellipse", { cx: 120, cy: 128, rx: 92, ry: 14, fill: G.water2, opacity: 0.45 }),
      ...[0, 1, 2].map(i => sv("ellipse", { cx: 120, cy: 120, rx: 16, ry: 4, fill: "none", stroke: G.foam, "stroke-width": 1, class: "g-ripple", style: "animation-delay: " + (-i * 0.8) + "s" })),
    ]));
  } else out.push(sv("ellipse", { cx: 120, cy: 120, rx: 10, ry: 3, fill: G.water }));
  // banks
  out.push(sv("path", { d: "M0 128 Q20 118 30 130 Q22 150 0 152 Z M240 124 Q214 118 206 132 Q220 152 240 152 Z", fill: G.bank }));
  out.push(sv("rect", { x: 0, y: 150, width: 240, height: 10, fill: G.bank2 }));
  if (stage >= 3) out.push(g(3, [[8, 128], [20, 126], [212, 124], [226, 127], [196, 146], [40, 148]].map(([x, y]) =>
    sv("path", { d: "M" + x + " " + y + " q2 -8 4 -10 M" + (x + 3) + " " + y + " q1 -9 5 -12 M" + (x + 6) + " " + y + " q0 -7 -2 -9", stroke: G.grass, "stroke-width": 1.4, fill: "none", "stroke-linecap": "round" }))));
  if (stage >= 4) out.push(g(4, [[64, 136], [168, 140], [150, 128]].map(([x, y]) =>
    sv("path", { d: "M" + x + " " + y + " m-8 0 a8 3.4 0 1 0 16 0 a8 3.4 0 1 0 -16 0 M" + x + " " + y + " l8 -1.2 l0 2.4 Z", fill: G.pad }))));
  const koi = (color, spot, dur, reverse) => {
    const fish = sv("g", {},
      sv("path", { d: "M-7 0 Q-2 -3.4 5 0 Q-2 3.4 -7 0 Z M-7 0 l-4 -3 l1 3 l-1 3 Z", fill: color }),
      spot ? sv("circle", { cx: 0, cy: 0, r: 1.5, fill: spot }) : null);
    fish.append(sv("animateMotion", { dur: dur + "s", repeatCount: "indefinite", rotate: "auto", keyPoints: reverse ? "1;0" : "0;1", keyTimes: "0;1", calcMode: "linear",
      path: "M60 132 C80 122 110 124 140 128 C170 132 190 136 180 142 C160 148 100 146 70 142 C52 140 48 136 60 132 Z" }));
    return fish;
  };
  if (stage >= 5) out.push(g(5, [koi(G.koi, G.koi2, 14)]));
  if (stage >= 6) out.push(g(6, [sv("g", { transform: "translate(150 126)" },
    [-40, -15, 15, 40, 0].map(a => sv("ellipse", { cx: 0, cy: -3.4, rx: 1.8, ry: 4, fill: G.lotus, transform: "rotate(" + a + ")" })),
    sv("circle", { cx: 0, cy: -1.5, r: 1.3, fill: "#ffe17a" }))]));
  if (stage >= 7) out.push(g(7, [sv("g", { class: "g-sway", style: "transform-origin: 14px 150px" },
    [8, 16, 23].map((x, i) => sv("g", {},
      sv("rect", { x, y: 58 + i * 10, width: 3, height: 92 - i * 10, fill: G.bamboo, rx: 1.4 }),
      [74, 96, 118].map(y => sv("rect", { x: x - 0.5, y: y + i * 6, width: 4, height: 1.2, fill: G.grass })),
      sv("path", { d: "M" + (x + 2) + " " + (64 + i * 10) + " q10 -2 16 4 q-9 1 -16 -4 Z M" + (x + 1) + " " + (84 + i * 8) + " q-9 -4 -13 1 q8 2 13 -1 Z", fill: G.grass }))))]));
  if (stage >= 8) out.push(g(8, [koi(G.koi2, G.koiRed, 18, true)]));
  if (stage >= 9) out.push(g(9, [sv("path", { d: "M214 132 Q212 110 206 96 Q200 86 190 82 M207 100 Q216 88 228 86 M200 90 Q196 76 200 66 M210 112 Q222 106 232 100",
    stroke: G.trunk, "stroke-width": 3.4, fill: "none", "stroke-linecap": "round" })]));
  if (stage >= 10) out.push(g(10, [[190, 82], [196, 78], [228, 86], [222, 90], [200, 66], [203, 72], [232, 100], [226, 104], [212, 96], [186, 86], [216, 84]].map(([x, y], i) =>
    sv("circle", { cx: x, cy: y, r: 2.6 + (i % 3) * 0.6, fill: G.blossom, opacity: 0.95 }))));
  if (stage >= 11) out.push(g(11, [0, 1, 2, 3, 4, 5].map(i =>
    sv("ellipse", { cx: 196 + (i % 3) * 12, cy: 78 + (i % 2) * 10, rx: 1.6, ry: 1, fill: G.blossom, class: "g-petal", style: "animation-delay: " + (-i * 1.3) + "s; animation-duration: " + (6 + (i % 3)) + "s" }))));
  if (stage >= 12) out.push(g(12, [sv("ellipse", { cx: 120, cy: 116, rx: 34, ry: 8, fill: "#fff", opacity: 0.55, class: "g-mist", style: "filter: blur(3px)" }),
    sv("ellipse", { cx: 136, cy: 110, rx: 22, ry: 5, fill: "#fff", opacity: 0.4, class: "g-mist", style: "filter: blur(3px); animation-delay: -3s" })]));
  if (stage >= 13) out.push(g(13, [sv("g", { transform: "translate(42 126)" },
    sv("path", { d: "M0 0 l-1 12 M2 0 l1 12", stroke: "#3b3b3b", "stroke-width": 0.8 }),
    sv("path", { d: "M-6 -2 Q0 -10 6 -4 Q2 2 -6 -2 Z", fill: G.egret }),
    sv("path", { d: "M4 -6 Q6 -16 2 -20 Q6 -21 7 -19 l5 1 l-5 1 Q8 -14 6 -5 Z", fill: G.egret }),
    sv("circle", { cx: 5.6, cy: -19.4, r: 0.5, fill: "#222" }))]));
  if (stage >= 14) out.push(g(14, [[50, 100, 0], [176, 112, -1.5]].map(([x, y, d]) => sv("g", { class: "g-fly", style: "animation-delay: " + d + "s" },
    sv("g", { transform: "translate(" + x + " " + y + ")" },
      sv("path", { d: "M0 0 q-5 -5 -6 0 q2 3 6 0 Z", fill: "#f6c445", class: "g-wing" }),
      sv("path", { d: "M0 0 q5 -5 6 0 q-2 3 -6 0 Z", fill: "#f6c445", class: "g-wing r" }))))));
  if (stage >= 15) out.push(g(15, [sv("path", { d: "M26 140 Q60 112 94 140 L90 142 Q60 120 30 142 Z", fill: G.bridge }),
    sv("path", { d: "M28 136 Q60 108 92 136", stroke: "#7c766d", "stroke-width": 1, fill: "none" })]));
  if (stage >= 16) out.push(g(16, [sv("g", { transform: "translate(186 108)" },
    sv("rect", { x: -14, y: -4, width: 2.4, height: 18, fill: G.pillar }), sv("rect", { x: 11.6, y: -4, width: 2.4, height: 18, fill: G.pillar }),
    sv("rect", { x: -16, y: 13, width: 32, height: 3, fill: "#6d5a4a" }),
    sv("path", { d: "M-22 -3 Q-12 -6 0 -16 Q12 -6 22 -3 Q12 -6 0 -9 Q-12 -6 -22 -3 Z", fill: G.roof }),
    sv("path", { d: "M-20 -3 H20 L18 -1 H-18 Z", fill: G.pillar }))]));
  if (stage >= 17) out.push(g(17, [[174, 108], [198, 108]].map(([x, y]) => sv("g", {},
    sv("circle", { cx: x, cy: y + 4, r: 7, fill: G.lantern, opacity: 0.25, class: "g-glow" }),
    sv("line", { x1: x, y1: y - 4, x2: x, y2: y, stroke: "#3b2b22", "stroke-width": 0.6 }),
    sv("ellipse", { cx: x, cy: y + 4, rx: 3, ry: 3.8, fill: G.lantern })))));
  if (stage >= 19) out.push(g(19, [sv("ellipse", { cx: 196, cy: 138, rx: 9, ry: 2, fill: G.moon, opacity: 0.6, class: "g-twinkle" })]));
  if (stage >= 20) out.push(g(20, [[40, 110], [70, 96], [100, 140], [160, 100], [210, 140], [130, 90], [24, 140]].map(([x, y], i) =>
    sv("circle", { cx: x, cy: y, r: 1.3, fill: "#f8f19a", class: "g-firefly", style: "animation-delay: " + (-i * 0.9) + "s" }))));
  return sv("svg", { viewBox: "0 0 240 160", class: "garden-svg", role: "img", "aria-label": "Your water garden: " + GARDEN.slice(0, stage + 1).map(x => x[0].toLowerCase()).join(", ") }, out);
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
