/* LearnZì UI, part 4b: animated avatars, drawn in code (SVG) and animated with CSS.
 * Five animals unlock at Zì levels 1–5; expressions, eyes, accessories and auras unlock with
 * higher levels and study streaks. Everything here is original artwork. */

const AV = {
  animal: {
    panda: { label: "Panda", zh: "熊猫", lv: 1 }, cat: { label: "Lucky cat", zh: "招财猫", lv: 2 }, tiger: { label: "Tiger", zh: "老虎", lv: 3 },
    rabbit: { label: "Jade rabbit", zh: "玉兔", lv: 4 }, dragon: { label: "Dragon", zh: "龙", lv: 5 },
  },
  expr: { calm: { label: "Calm", lv: 1 }, happy: { label: "Happy", lv: 2 }, wink: { label: "Wink", lv: 3 }, sleepy: { label: "Sleepy", lv: 4 }, surprised: { label: "Surprised", lv: 6 } },
  eyes: { normal: { label: "Normal", lv: 1 }, glow: { label: "Glowing", lv: 5 }, star: { label: "Starry", streak: 7 } },
  acc: { none: { label: "None", lv: 1 }, scarf: { label: "Red scarf", lv: 2 }, bamboo: { label: "Bamboo sprig", lv: 4 }, lantern: { label: "Lantern", lv: 6 }, phones: { label: "Headphones", lv: 8 }, crown: { label: "Crown", lv: 10 } },
  aura: { none: { label: "None", lv: 1 }, ring: { label: "Gold ring", lv: 7 }, petals: { label: "Falling petals", lv: 9 } },
  sparkles: { on: { label: "Sparkles", streak: 3 } },
};
const AV_DEFAULT = { animal: "panda", expr: "calm", eyes: "normal", accs: [], aura: "none", blush: true, sparkles: false, style: "auto" };
function sanitizeAvatar(raw) {
  const o = obj(raw);
  const a = { ...AV_DEFAULT };
  for (const k of ["animal", "expr", "eyes", "aura"]) if (typeof o[k] === "string" && Object.hasOwn(AV[k], o[k])) a[k] = o[k];
  a.accs = Array.isArray(o.accs) ? o.accs.filter(x => Object.hasOwn(AV.acc, x) && x !== "none") : [];
  a.blush = o.blush !== false;
  a.sparkles = o.sparkles === true;
  a.style = Object.hasOwn(AV_STYLES, o.style) ? o.style : "auto";
  return a;
}
const bestStreak = () => Math.max(streak(), totals().best);
function unlocked(item) {
  if (state.unlockAll) return true;      // Debug settings → Unlock everything
  if (item.lv) return levelNow().level >= item.lv;
  if (item.streak) return bestStreak() >= item.streak;
  return true;
}
const lockText = item => (item.lv ? "Level " + item.lv : item.streak + "-day streak");
/** The avatar to show: anything no longer unlocked (e.g. after a level reset) falls back. */
function wornAvatar() {
  const a = sanitizeAvatar(state.avatar);
  for (const k of ["animal", "expr", "eyes", "aura"]) if (!unlocked(AV[k][a[k]])) a[k] = AV_DEFAULT[k];
  a.accs = a.accs.filter(x => unlocked(AV.acc[x]));
  if (a.sparkles && !unlocked(AV.sparkles.on)) a.sparkles = false;
  return a;
}

// ---------- drawing ----------
const OUT = "#2b2523";
function animalParts(kind) {
  const P = [];
  const c = (cx, cy, r, f, extra) => sv("circle", Object.assign({ cx, cy, r, fill: f }, extra || {}));
  const e = (cx, cy, rx, ry, f, extra) => sv("ellipse", Object.assign({ cx, cy, rx, ry, fill: f }, extra || {}));
  const p = (d, f, extra) => sv("path", Object.assign({ d, fill: f }, extra || {}));
  const line = { stroke: OUT, "stroke-width": 1.6 };
  if (kind === "panda") {
    P.push(c(25, 27, 10.5, "#222"), c(75, 27, 10.5, "#222"));
    P.push(c(50, 56, 34, "#fbfbf8", line));
    P.push(e(37, 54, 9, 11.5, "#222", { transform: "rotate(-28 37 54)" }), e(63, 54, 9, 11.5, "#222", { transform: "rotate(28 63 54)" }));
    P.push(e(50, 63.5, 3.8, 2.6, "#222"));
    return { parts: P, eye: "#fff", mouthY: 68 };
  }
  if (kind === "cat") {
    P.push(sv("g", { class: "av-wave" }, e(86, 74, 7, 9, "#fff8ee", line), p("M83 68 v5 M86 67 v5 M89 68 v5", "none", { stroke: "#e2a4a0", "stroke-width": 1.2 })));
    P.push(p("M18 44 L25 13 L45 30 Z", "#fff8ee", line), p("M82 44 L75 13 L55 30 Z", "#fff8ee", line));
    P.push(p("M24 34 L27 21 L36 29 Z", "#f2b3b0"), p("M76 34 L73 21 L64 29 Z", "#f2b3b0"));
    P.push(c(50, 57, 33, "#fff8ee", line));
    P.push(e(33, 36, 11, 7.5, "#f2a24a", { transform: "rotate(-20 33 36)" }), e(68, 33, 6, 4.5, "#3a2a20", { transform: "rotate(15 68 33)" }));
    P.push(p("M47.5 62 h5 l-2.5 3 Z", "#e88a8a"));
    P.push(p("M18 60 l14 2 M18 66 l14 -1 M82 60 l-14 2 M82 66 l-14 -1", "none", { stroke: "#8a7a70", "stroke-width": 1.1, "stroke-linecap": "round" }));
    return { parts: P, eye: "#2b2523", mouthY: 68 };
  }
  if (kind === "tiger") {
    P.push(c(26, 28, 10, "#f39a2e", line), c(74, 28, 10, "#f39a2e", line), c(26, 28, 5, "#fff3e0"), c(74, 28, 5, "#fff3e0"));
    P.push(c(50, 56, 34, "#f39a2e", line));
    P.push(e(50, 68, 17, 12, "#fff3e0"));
    P.push(p("M44 30 h12 M42 35 h16 M44 40 h12 M50 30 v10", "none", { stroke: "#3a2416", "stroke-width": 2.4, "stroke-linecap": "round" }));
    P.push(p("M17 50 q8 2 12 7 M16 60 q8 0 11 4 M83 50 q-8 2 -12 7 M84 60 q-8 0 -11 4", "none", { stroke: "#3a2416", "stroke-width": 2.4, "stroke-linecap": "round" }));
    P.push(p("M46.5 61 h7 l-3.5 3.5 Z", "#3a2416"));
    return { parts: P, eye: "#2b2523", mouthY: 69 };
  }
  if (kind === "rabbit") {
    P.push(sv("g", { class: "av-ears" }, e(37, 19, 7.5, 20, "#f4fbf7", line), e(63, 19, 7.5, 20, "#f4fbf7", line), e(37, 20, 3.5, 14, "#f6c1c6"), e(63, 20, 3.5, 14, "#f6c1c6")));
    P.push(c(50, 59, 31, "#f4fbf7", line));
    P.push(e(50, 64, 3, 2.2, "#e98a96"));
    P.push(p("M50 66 v3", "none", { stroke: OUT, "stroke-width": 1.2 }));
    P.push(c(73, 40, 3.2, "#7cc7a4"), c(27, 40, 3.2, "#7cc7a4"));
    return { parts: P, eye: "#2b2523", mouthY: 71 };
  }
  // dragon
  P.push(p("M36 30 q-6 -14 -14 -16 q8 6 8 18 Z", "#e9b949", line), p("M64 30 q6 -14 14 -16 q-8 6 -8 18 Z", "#e9b949", line));
  P.push(p("M40 25 l4 -8 l4 7 l4 -8 l4 8 l4 -7 l2 9", "#e9b949", line));
  P.push(c(50, 54, 33, "#3fb08c", { stroke: "#1f4d40", "stroke-width": 1.6 }));
  P.push(e(50, 68, 19, 12, "#8fdcc0", { stroke: "#1f4d40", "stroke-width": 1.2 }));
  P.push(c(44, 66, 1.6, "#1f4d40"), c(56, 66, 1.6, "#1f4d40"));
  P.push(sv("g", { class: "av-whisk" }, p("M32 68 q-14 2 -18 -8 q-2 -6 3 -6", "none", { stroke: "#e9b949", "stroke-width": 2, "stroke-linecap": "round" }),
    p("M68 68 q14 2 18 -8 q2 -6 -3 -6", "none", { stroke: "#e9b949", "stroke-width": 2, "stroke-linecap": "round" })));
  return { parts: P, eye: "#1f2b26", mouthY: 73 };
}

function eyesFor(a, eyeColor) {
  const L = [38, 54], R = [62, 54];
  const glow = a.eyes === "glow", star = a.eyes === "star";
  const col = glow ? "var(--accent)" : eyeColor;
  const cls = glow ? " av-glow" : "";
  const openEye = ([x, y], big, extraCls) => {
    if (star) {
      const s = big ? 6 : 5;
      return sv("path", { class: "av-star" + (extraCls || ""), d: "M" + x + " " + (y - s) + " L" + (x + s * 0.3) + " " + (y - s * 0.3) + " L" + (x + s) + " " + y + " L" + (x + s * 0.3) + " " + (y + s * 0.3) + " L" + x + " " + (y + s) + " L" + (x - s * 0.3) + " " + (y + s * 0.3) + " L" + (x - s) + " " + y + " L" + (x - s * 0.3) + " " + (y - s * 0.3) + " Z", fill: "#f5c542" });
    }
    return sv("g", { class: "av-eye" + (extraCls || "") + cls },
      sv("ellipse", { cx: x, cy: y, rx: big ? 5 : 3.7, ry: big ? 5.6 : 4.3, fill: col }),
      glow ? null : sv("circle", { cx: x + 1.3, cy: y - 1.6, r: big ? 1.7 : 1.2, fill: "#fff" }));
  };
  const arc = ([x, y], up) => sv("path", { d: up ? "M" + (x - 4.5) + " " + (y + 1.5) + " q4.5 -6 9 0" : "M" + (x - 4.5) + " " + (y - 1) + " q4.5 5 9 0", fill: "none", stroke: glow ? "var(--accent)" : eyeColor, "stroke-width": 2.6, "stroke-linecap": "round", class: glow ? "av-glow" : null });
  if (a.expr === "happy") return [arc(L, true), arc(R, true)];
  if (a.expr === "sleepy") return [arc(L, false), arc(R, false)];
  if (a.expr === "wink") return [openEye(L, false, " av-blink"), openEye(R, false, " av-winker")];
  if (a.expr === "surprised") return [openEye(L, true, " av-blink"), openEye(R, true, " av-blink")];
  return [openEye(L, false, " av-blink"), openEye(R, false, " av-blink")];
}
function mouthFor(a, y) {
  const m = { stroke: OUT, "stroke-width": 1.8, fill: "none", "stroke-linecap": "round" };
  if (a.expr === "happy") return [sv("path", { d: "M43 " + (y - 2) + " q7 9 14 0 Z", fill: "#7a2e2e" }), sv("path", { d: "M46.5 " + (y + 2.2) + " q3.5 2.6 7 0 q-3.5 -2 -7 0", fill: "#f08a8a" })];
  if (a.expr === "wink") return [sv("path", Object.assign({ d: "M44 " + (y - 1) + " q6 5 12 0" }, m)), sv("path", { d: "M51 " + (y + 1) + " q2.5 5 5 0 Z", fill: "#f08a8a" })];
  if (a.expr === "sleepy") return [sv("ellipse", { cx: 50, cy: y, rx: 2, ry: 2.4, fill: "#7a2e2e" })];
  if (a.expr === "surprised") return [sv("ellipse", { cx: 50, cy: y + 1, rx: 3.4, ry: 4.4, fill: "#7a2e2e" })];
  return [sv("path", Object.assign({ d: "M45 " + (y - 1) + " q2.5 3 5 0 q2.5 3 5 0" }, m))];
}
function accessory(kind, animal) {
  if (kind === "scarf") {
    return sv("g", {}, sv("path", { d: "M24 84 q26 12 52 0 l1 7 q-27 12 -54 0 Z", fill: "#d8342b", stroke: "#8f1d17", "stroke-width": 1 }),
      sv("path", { class: "av-flutter", d: "M64 90 l8 14 l7 -3 l-6 -13 Z", fill: "#d8342b", stroke: "#8f1d17", "stroke-width": 1 }));
  }
  if (kind === "bamboo") {
    return sv("g", { transform: "translate(12 4) rotate(-18 14 20)" }, sv("rect", { x: 12, y: 4, width: 4, height: 26, rx: 2, fill: "#4c9a5b" }),
      sv("path", { d: "M14 12 q-12 -4 -14 2 q8 2 14 -2 Z M16 18 q12 -6 15 0 q-8 4 -15 0 Z", fill: "#6cc07a" }));
  }
  if (kind === "lantern") {
    return sv("g", { class: "av-swing" }, sv("line", { x1: 82, y1: 30, x2: 82, y2: 38, stroke: OUT, "stroke-width": 1 }),
      sv("ellipse", { cx: 82, cy: 46, rx: 8, ry: 8.5, fill: "#e0412f", stroke: "#8f1d17", "stroke-width": 1 }),
      sv("rect", { x: 78.5, y: 37, width: 7, height: 2.5, fill: "#e9b949" }), sv("rect", { x: 78.5, y: 53.5, width: 7, height: 2.5, fill: "#e9b949" }),
      sv("path", { d: "M82 56 v6", stroke: "#e9b949", "stroke-width": 1.5 }));
  }
  if (kind === "phones") {
    const y = animal === "rabbit" ? 58 : 55;
    return sv("g", {}, sv("path", { d: "M17 " + y + " q0 -40 33 -40 q33 0 33 40", fill: "none", stroke: "#2d2f36", "stroke-width": 4, "stroke-linecap": "round" }),
      sv("rect", { x: 11, y: y - 7, width: 10, height: 16, rx: 4, fill: "#2d2f36" }), sv("rect", { x: 79, y: y - 7, width: 10, height: 16, rx: 4, fill: "#2d2f36" }),
      sv("rect", { x: 13.5, y: y - 4, width: 5, height: 10, rx: 2, style: "fill: var(--accent)" }), sv("rect", { x: 81.5, y: y - 4, width: 5, height: 10, rx: 2, style: "fill: var(--accent)" }));
  }
  if (kind === "crown") {
    const y = animal === "dragon" ? 16 : animal === "rabbit" ? 26 : 20;
    return sv("g", { class: "av-crown" }, sv("path", { d: "M38 " + y + " l3 -11 l5 6 l4 -9 l4 9 l5 -6 l3 11 Z", fill: "#f5c542", stroke: "#a87b12", "stroke-width": 1 }),
      sv("circle", { cx: 50, cy: y - 5, r: 1.6, fill: "#e0412f" }));
  }
  return null;
}
function aura(kind) {
  if (kind === "ring") {
    return sv("g", {}, sv("circle", { cx: 50, cy: 50, r: 46, fill: "none", stroke: "#e9b949", "stroke-width": 2.5 }),
      sv("circle", { class: "av-spin", cx: 50, cy: 50, r: 42, fill: "none", stroke: "#e9b949", "stroke-width": 1.2, "stroke-dasharray": "3 6", opacity: 0.8 }));
  }
  if (kind === "petals") {
    return sv("g", {}, [[18, 0], [42, -1.5], [66, -0.7], [84, -2.4], [30, -3.2]].map(([x, d]) =>
      sv("ellipse", { class: "av-petal", cx: x, cy: -6, rx: 3.2, ry: 2, fill: "#f6a7b9", style: "animation-delay: " + d + "s" })));
  }
  return null;
}
let avatarSeq = 0;
/** An animated avatar as an <svg>. `a` is a sanitized avatar; `size` in CSS pixels. */
// ---------- avatar art styles ----------
const AV_STYLES = { auto: "Match theme", cute: "Cute", pixel: "Pixel", neon: "Neon", ink: "Ink sketch" };
const THEME_AVSTYLE = { arcade: "pixel", cyber: "neon" };
/** The art style an avatar is drawn in: your choice, or the theme's own when set to "Match theme". */
function avStyle(a) {
  if (a.style && a.style !== "auto") return a.style;
  return THEME_AVSTYLE[document.documentElement.getAttribute("data-shape")] || "cute";
}
/** The SVG filter for a style, kept inside each avatar so it always travels with it. Units are the
 *  avatar's own 0–100 grid, so Pixel is always a 25 × 25 sprite whatever size the avatar is shown at. */
function avFilter(style, id, size) {
  const box = { id, filterUnits: "userSpaceOnUse", x: 0, y: 0, width: 100, height: 100, "color-interpolation-filters": "sRGB" };
  if (style === "pixel") {
    // Small avatars get bigger blocks: a sample dot smaller than a screen pixel would vanish.
    const B = size >= 100 ? 4 : size >= 56 ? 5 : 8;
    return sv("filter", box,
      sv("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 0.7, result: "soft" }),
      sv("feFlood", { x: B / 4, y: B / 4, width: B / 2, height: B / 2, "flood-color": "#000" }),
      sv("feComposite", { width: B, height: B }),
      sv("feTile", { result: "dots" }),
      sv("feComposite", { in: "soft", in2: "dots", operator: "in" }),
      sv("feMorphology", { operator: "dilate", radius: B / 4 }));
  }
  if (style === "neon") return sv("filter", box,
    sv("feConvolveMatrix", { in: "SourceGraphic", order: 3, kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true", result: "edges" }),
    sv("feColorMatrix", { in: "edges", type: "matrix", values: "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2 2 2 0 0", result: "mask" }),
    sv("feFlood", { style: "flood-color: var(--accent)" }),
    sv("feComposite", { in2: "mask", operator: "in" }),
    sv("feMorphology", { operator: "dilate", radius: 0.35, result: "line" }),
    sv("feGaussianBlur", { in: "line", stdDeviation: 1.6, result: "glow" }),
    sv("feMerge", {}, sv("feMergeNode", { in: "glow" }), sv("feMergeNode", { in: "glow" }), sv("feMergeNode", { in: "line" })));
  if (style === "ink") return sv("filter", box,
    sv("feTurbulence", { type: "fractalNoise", baseFrequency: 0.07, numOctaves: 2, seed: 4, result: "noise" }),
    sv("feDisplacementMap", { in: "SourceGraphic", in2: "noise", scale: 3.2, xChannelSelector: "R", yChannelSelector: "G", result: "wobble" }),
    sv("feColorMatrix", { in: "wobble", type: "saturate", values: 0.12 }));
  return null;
}
function avatarSvg(a, size, label) {
  const id = "avc" + (++avatarSeq);
  const { parts, eye, mouthY } = animalParts(a.animal);
  const face = sv("g", { class: "av-body av-" + a.expr },
    parts, eyesFor(a, eye), mouthFor(a, mouthY),
    a.blush ? [sv("ellipse", { cx: 29, cy: 65, rx: 5, ry: 3, fill: "#ff8fa3", opacity: 0.55 }), sv("ellipse", { cx: 71, cy: 65, rx: 5, ry: 3, fill: "#ff8fa3", opacity: 0.55 })] : null,
    ["scarf", "bamboo", "lantern", "phones", "crown"].filter(x => a.accs.includes(x)).map(x => accessory(x, a.animal)));
  const sparks = a.sparkles ? sv("g", {}, [[16, 22, 0], [84, 18, 0.7], [88, 70, 1.4], [12, 74, 2.1]].map(([x, y, d]) =>
    sv("path", { class: "av-sparkle", d: "M" + x + " " + (y - 5) + " L" + (x + 1.4) + " " + (y - 1.4) + " L" + (x + 5) + " " + y + " L" + (x + 1.4) + " " + (y + 1.4) + " L" + x + " " + (y + 5) + " L" + (x - 1.4) + " " + (y + 1.4) + " L" + (x - 5) + " " + y + " L" + (x - 1.4) + " " + (y - 1.4) + " Z", fill: "#f5c542", style: "animation-delay: " + d + "s" }))) : null;
  const z = a.expr === "sleepy" ? sv("g", { class: "av-zs" }, ["z", "z", "Z"].map((t, i) => sv("text", { x: 70 + i * 6, y: 30 - i * 7, class: "av-z", style: "animation-delay: " + i * 0.8 + "s; fill: var(--ink-soft)", "font-size": 8 + i * 2, "font-weight": 700 }, document.createTextNode(t)))) : null;
  const style = avStyle(a);
  return sv("svg", { viewBox: "0 0 100 100", width: size, height: size, class: "avatar avs-" + style, role: "img", "aria-label": label || (AV.animal[a.animal].label + " avatar") },
    sv("defs", {}, sv("clipPath", { id }, sv("circle", { cx: 50, cy: 50, r: 49 })), avFilter(style, id + "f", size)),
    sv("g", { class: "av-art", filter: style === "cute" ? null : "url(#" + id + "f)" }, sv("g", { "clip-path": "url(#" + id + ")" },
      sv("circle", { cx: 50, cy: 50, r: 49, style: "fill: var(--surface-2)" }),
      aura(a.aura), face, z, sparks)));
}
/** What a new level unlocks, for the level-up screen. */
function unlocksAt(level) {
  const out = [];
  for (const k of ["animal", "expr", "eyes", "acc", "aura"]) for (const item of Object.values(AV[k])) if (item.lv === level && item.label !== "None") out.push(item.label);
  for (const [id, t] of Object.entries(BONUS_THEMES)) if (t.lv === level) out.push(PRESETS[id].label + " theme");
  for (const item of Object.values(CLOCK.face)) if (item.lv === level) out.push(item.label + " clock");
  for (const item of Object.values(CLOCK.fx)) if (item.lv === level) out.push(item.label + " clock effect");
  return out;
}
