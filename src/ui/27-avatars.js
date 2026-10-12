/* LearnZì UI, part 4b: animated avatars, drawn in code (SVG) and animated with CSS.
 * Twelve animals unlock from Zì level 1 to 50; eyes, accessories, auras and extras unlock with
 * levels and study streaks. The face isn't chosen: it reacts to what you do (see "moods" below).
 * Everything here is original artwork. */

const AV = {
  animal: {
    panda: { label: "Panda", zh: "熊猫", lv: 1 }, cat: { label: "Lucky cat", zh: "招财猫", lv: 2 }, tiger: { label: "Tiger", zh: "老虎", lv: 3 },
    rabbit: { label: "Jade rabbit", zh: "玉兔", lv: 4 }, dragon: { label: "Dragon", zh: "龙", lv: 5 },
    redpanda: { label: "Red panda", zh: "小熊猫", lv: 8 }, koi: { label: "Koi", zh: "锦鲤", lv: 12 }, crane: { label: "Crane", zh: "仙鹤", lv: 16 },
    monkey: { label: "Golden monkey", zh: "金丝猴", lv: 20 }, fox: { label: "Nine-tailed fox", zh: "九尾狐", lv: 30 },
    qilin: { label: "Qilin", zh: "麒麟", lv: 40 }, phoenix: { label: "Phoenix", zh: "凤凰", lv: 50 },
  },
  // Moods, used for drawing only: the avatar shows them by itself (calm, happy on XP, surprised on a
  // level up, sleepy when left alone, wink when tapped, oops on a forgotten card).
  expr: { calm: { label: "Calm" }, happy: { label: "Happy" }, wink: { label: "Wink" }, sleepy: { label: "Sleepy" }, surprised: { label: "Surprised" }, oops: { label: "Oops" } },
  eyes: { normal: { label: "Normal", lv: 1 }, glow: { label: "Glowing", lv: 5 }, star: { label: "Starry", streak: 7 } },
  acc: { none: { label: "None", lv: 1 }, scarf: { label: "Red scarf", lv: 2 }, bamboo: { label: "Bamboo sprig", lv: 4 }, lantern: { label: "Lantern", lv: 6 }, phones: { label: "Headphones", lv: 8 }, crown: { label: "Crown", lv: 10 } },
  aura: { none: { label: "None", lv: 1 }, ring: { label: "Gold ring", lv: 7 }, petals: { label: "Falling petals", lv: 9 } },
  sparkles: { on: { label: "Sparkles", streak: 3 } },
  halo: { on: { label: "Halo", lv: 15 } },
};
const BIRDS = new Set(["crane", "phoenix"]);
const AV_DEFAULT = { animal: "panda", expr: "calm", eyes: "normal", accs: [], aura: "none", sparkles: false, halo: false };
function sanitizeAvatar(raw) {
  const o = obj(raw);
  const a = { ...AV_DEFAULT };
  for (const k of ["animal", "eyes", "aura"]) if (typeof o[k] === "string" && Object.hasOwn(AV[k], o[k])) a[k] = o[k];
  a.accs = Array.isArray(o.accs) ? o.accs.filter(x => Object.hasOwn(AV.acc, x) && x !== "none") : [];
  a.sparkles = o.sparkles === true;
  a.halo = o.halo === true;
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
/** Locked items are a shadow with ??? for a name (and the level or streak that unlocks them),
 *  unless Debug settings → Show locked items is on. */
const keepSecret = item => !state.showLocked && !unlocked(item);
const secretName = (item, name) => (keepSecret(item) ? "???" : name || item.label);
const secretLabel = item => (keepSecret(item) ? "Locked item, unlocks at " : item.label + ", locked until ") + lockText(item);
/** The avatar to show: anything no longer unlocked (e.g. after a level reset) falls back. */
function wornAvatar() {
  const a = sanitizeAvatar(state.avatar);
  for (const k of ["animal", "eyes", "aura"]) if (!unlocked(AV[k][a[k]])) a[k] = AV_DEFAULT[k];
  a.accs = a.accs.filter(x => unlocked(AV.acc[x]));
  if (a.sparkles && !unlocked(AV.sparkles.on)) a.sparkles = false;
  if (a.halo && !unlocked(AV.halo.on)) a.halo = false;
  a.expr = avMood;
  return a;
}

// ---------- moods: the face reacts to what you do ----------
let avMood = "calm", avMoodTimer = 0, avIdleTimer = 0;
const AV_IDLE_MS = 120000;   // two minutes with no taps or keys and your avatar dozes off
/** Show a mood for `ms` (then back to calm), or until something else happens when `ms` is 0. */
function setMood(m, ms) {
  // A level up beats a little XP; a forgotten card doesn't interrupt a level up either.
  if (avMood === "surprised" && m !== "surprised" && m !== "calm" && avMoodTimer) return;
  clearTimeout(avMoodTimer); avMoodTimer = 0;
  if (m !== avMood) { avMood = m; refreshAvatars(); }
  if (ms) avMoodTimer = setTimeout(() => { avMoodTimer = 0; avMood = "calm"; refreshAvatars(); }, ms);
}
/** An avatar that shows your current mood and redraws when it changes. */
function liveAvatar(size, label) {
  const svg = avatarSvg(wornAvatar(), size, label);
  svg.dataset.live = String(size);
  return svg;
}
function refreshAvatars() {
  for (const old of document.querySelectorAll("svg.avatar[data-live]")) {
    const svg = liveAvatar(+old.dataset.live, old.getAttribute("aria-label"));
    old.replaceWith(svg);
  }
  if (typeof updateTopbar === "function") updateTopbar();
}
const mediaPlaying = () => [...document.querySelectorAll("video, audio")].some(m => !m.paused && !m.ended);
function armIdle() {
  clearTimeout(avIdleTimer);
  avIdleTimer = setTimeout(() => {
    if (document.hidden || mediaPlaying()) { armIdle(); return; }   // not while a video or recording plays
    setMood("sleepy", 0);
  }, AV_IDLE_MS);
}
/** Any tap, key or scroll: wake up (with a stretch) and start counting again. */
function nudgeAvatar() {
  if (avMood === "sleepy") setMood("calm", 0);
  armIdle();
}
/** Tapping your own avatar gets a wink. */
const winkAvatar = () => setMood("wink", 1600);

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
  if (kind === "redpanda") {
    const rust = "#cf5f2c", cream = "#fff4e4";
    P.push(p("M17 45 Q13 14 42 25 Z", rust, line), p("M83 45 Q87 14 58 25 Z", rust, line));
    P.push(p("M22 38 Q21 23 36 27 Z", cream), p("M78 38 Q79 23 64 27 Z", cream));
    P.push(c(50, 57, 33, rust, line));
    P.push(e(20, 62, 5, 10, cream), e(80, 62, 5, 10, cream));
    P.push(e(37, 43, 5.5, 3.6, cream), e(63, 43, 5.5, 3.6, cream));
    P.push(p("M50 54 q-17 1 -17 13 q0 11 17 11 q17 0 17 -11 q0 -12 -17 -13 Z", cream));
    P.push(e(50, 63, 3.6, 2.5, "#2b2523"));
    return { parts: P, eye: "#2b2523", mouthY: 69 };
  }
  if (kind === "koi") {
    const red = "#e5532c", white = "#fffaf3", fin = { stroke: "#b8401f", "stroke-width": 1.2 };
    P.push(sv("g", { class: "av-fin-l" }, p("M22 58 q-16 -6 -18 8 q8 6 18 2 Z", red, fin)));
    P.push(sv("g", { class: "av-fin-r" }, p("M78 58 q16 -6 18 8 q-8 6 -18 2 Z", red, fin)));
    P.push(p("M38 28 q10 -18 26 -6 q-10 -1 -12 6 Z", red, fin));
    P.push(c(50, 57, 32, white, line));
    P.push(p("M21 52 q-2 -20 16 -25 q16 -4 20 6 q2 9 -10 11 q-10 1 -14 6 q-5 5 -12 2 Z", red));
    P.push(p("M63 30 q12 -2 15 10 q1 8 -8 8 q-9 -1 -9 -9 q0 -6 2 -9 Z", red));
    P.push(p("M40 82 q4 -4 8 0 q4 -4 8 0 q4 -4 8 0", "none", { stroke: "#efcdb6", "stroke-width": 1.2, "stroke-linecap": "round" }));
    P.push(p("M44 72 q-4 6 -10 7 M56 72 q4 6 10 7", "none", { stroke: "#d6a77a", "stroke-width": 1.6, "stroke-linecap": "round" }));
    P.push(sv("g", { class: "av-bubbles" }, [[84, 30, 2.6, 0], [80, 22, 1.8, 0.9], [87, 14, 1.4, 1.8]].map(([x, y, r, d]) =>
      c(x, y, r, "none", { stroke: "#8cc7e8", "stroke-width": 1.1, class: "av-bubble", style: "animation-delay: " + d + "s" }))));
    return { parts: P, eye: "#2b2523", mouthY: 69 };
  }
  if (kind === "crane") {
    P.push(c(50, 58, 31, "#fbfaf6", line));
    P.push(p("M25 76 q25 18 50 0 q2 10 -4 18 L29 94 q-6 -8 -4 -18 Z", "#2b2523"));
    P.push(e(50, 31, 9, 6.5, "#d8342b"));
    return { parts: P, eye: "#2b2523", mouthY: 64, beak: "#d9c27a" };
  }
  if (kind === "monkey") {
    const gold = "#eaa83c", fur = { stroke: "#b8741d", "stroke-width": 1.2 };
    P.push(sv("g", { class: "av-tuft" }, p("M42 26 q2 -12 8 -16 q6 4 8 16 q-8 -4 -16 0 Z", gold, fur)));
    P.push(p("M24 38 q-16 18 -8 46 q4 -8 9 -8 q-3 8 3 14 q2 -10 8 -12 Z", gold, fur), p("M76 38 q16 18 8 46 q-4 -8 -9 -8 q3 8 -3 14 q-2 -10 -8 -12 Z", gold, fur));
    P.push(c(50, 55, 32, gold, line));
    P.push(p("M28 40 q22 -22 44 0 q-22 -10 -44 0 Z", "#9a6424"));
    P.push(p("M50 41 q-20 0 -20 20 q0 20 20 20 q20 0 20 -20 q0 -20 -20 -20 Z", "#a9cfe8"));
    P.push(e(50, 70, 10, 7, "#d9ebf6"));
    P.push(p("M46 63 q4 -5 8 0", "none", { stroke: "#6f9fbf", "stroke-width": 1.6, "stroke-linecap": "round" }));
    P.push(c(47.5, 65, 1.4, "#3b4a58"), c(52.5, 65, 1.4, "#3b4a58"));
    return { parts: P, eye: "#2b2523", mouthY: 72 };
  }
  if (kind === "fox") {
    const orange = "#f08a3c", tip = "#fff6ec";
    const tails = [];
    for (let i = 0; i < 9; i++) {
      const ang = -100 + i * 25;
      tails.push(sv("g", { transform: "rotate(" + ang + " 50 64)" },
        p("M50 64 q-20 -16 -11 -42 q9 -10 18 -1 q7 20 -7 43 Z", orange, { stroke: "#b85d1f", "stroke-width": 1 }),
        p("M39 22 q9 -10 18 -1 q-9 4 -18 1 Z", tip)));
    }
    P.push(sv("g", { class: "av-tails" }, tails));
    P.push(p("M26 44 L29 16 L46 34 Z", orange, line), p("M74 44 L71 16 L54 34 Z", orange, line));
    P.push(p("M29 19 L30 26 L35 23 Z M71 19 L70 26 L65 23 Z", "#4a2a1a"));
    P.push(c(50, 58, 30, orange, line));
    P.push(p("M21 60 Q50 98 79 60 Q65 70 50 66 Q35 70 21 60 Z", tip));
    P.push(p("M50 34 q-4 5 0 10 q4 -5 0 -10 Z", "#d8342b"));
    P.push(e(50, 66, 3, 2.2, "#2b2523"));
    return { parts: P, eye: "#2b2523", mouthY: 72 };
  }
  if (kind === "qilin") {
    const gold = "#f1c04f", mane = "#2fa59a", antler = { stroke: "#9b6a1e", "stroke-width": 3, "stroke-linecap": "round", fill: "none" };
    P.push(sv("g", { class: "av-mane" }, [[15, 44, -30], [12, 62, -10], [17, 79, 20], [85, 44, 30], [88, 62, 10], [83, 79, -20]].map(([x, y, r]) =>
      p("M" + x + " " + (y + 8) + " q-6 -10 0 -18 q2 8 7 6 q-2 6 -7 12 Z", mane, { transform: "rotate(" + r + " " + x + " " + y + ")" }))));
    P.push(p("M38 30 q-6 -10 -4 -22 M36 20 l-8 -6 M64 30 q6 -10 4 -22 M66 20 l8 -6", "none", antler));
    P.push(c(50, 57, 32, gold, { stroke: "#9b6a1e", "stroke-width": 1.6 }));
    P.push(p("M38 34 q4 -4 8 0 M54 34 q4 -4 8 0 M46 40 q4 -4 8 0", "none", { stroke: "#d49a2c", "stroke-width": 1.4, "stroke-linecap": "round" }));
    P.push(e(50, 70, 16, 11, "#fbe3a4", { stroke: "#9b6a1e", "stroke-width": 1 }));
    P.push(c(45, 67, 1.5, "#7a4e12"), c(55, 67, 1.5, "#7a4e12"));
    P.push(c(50, 44, 3, mane));
    return { parts: P, eye: "#2b2523", mouthY: 74 };
  }
  if (kind === "phoenix") {
    const red = "#e2452e", gold = "#f5b93a";
    P.push(sv("g", { class: "av-plume" },
      p("M50 30 q-2 -16 -12 -24", "none", { stroke: gold, "stroke-width": 2, "stroke-linecap": "round" }), c(38, 6, 3.4, gold), c(38, 6, 1.5, "#2f8fbf"),
      p("M50 30 q0 -18 0 -26", "none", { stroke: gold, "stroke-width": 2, "stroke-linecap": "round" }), c(50, 4, 3.4, gold), c(50, 4, 1.5, "#2f8fbf"),
      p("M50 30 q2 -16 12 -24", "none", { stroke: gold, "stroke-width": 2, "stroke-linecap": "round" }), c(62, 6, 3.4, gold), c(62, 6, 1.5, "#2f8fbf")));
    P.push(p("M22 52 q-14 10 -12 28 q8 -12 16 -14 Z M78 52 q14 10 12 28 q-8 -12 -16 -14 Z", gold, { stroke: "#b8741d", "stroke-width": 1 }));
    P.push(c(50, 58, 31, red, { stroke: "#8f1d17", "stroke-width": 1.6 }));
    P.push(p("M28 40 q22 -14 44 0 q-22 -6 -44 0 Z", gold));
    P.push(p("M30 72 q20 16 40 0 q-20 8 -40 0 Z", gold, { opacity: 0.8 }));
    return { parts: P, eye: "#2b2523", mouthY: 64, beak: "#f5c542" };
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
  if (a.expr === "oops") return [openEye(L, false, " av-blink"), openEye(R, false, " av-blink"),
    sv("path", { d: "M32 45 L42 42 M58 42 L68 45", fill: "none", stroke: a.animal === "panda" ? "#222" : OUT, "stroke-width": 2, "stroke-linecap": "round" })];
  return [openEye(L, false, " av-blink"), openEye(R, false, " av-blink")];
}
/** Birds have a beak instead of a mouth: closed, or open when happy, surprised or caught out. */
function beakFor(a, y, col) {
  const edge = { stroke: "#8a6a1e", "stroke-width": 1, "stroke-linejoin": "round" };
  if (a.expr === "happy" || a.expr === "surprised" || a.expr === "oops") {
    const gap = a.expr === "surprised" ? 6 : a.expr === "happy" ? 4.5 : 3;
    return [sv("path", { d: "M45 " + (y + 1) + " L55 " + (y + 1) + " L50 " + (y + 4 + gap) + " Z", fill: "#7a2e2e" }),
      sv("path", Object.assign({ d: "M43.5 " + y + " L56.5 " + y + " L50 " + (y + 5) + " Z", fill: col }, edge)),
      sv("path", Object.assign({ d: "M46 " + (y + 2 + gap) + " L54 " + (y + 2 + gap) + " L50 " + (y + 7 + gap) + " Z", fill: col }, edge))];
  }
  return [sv("path", Object.assign({ d: "M43.5 " + y + " L56.5 " + y + " L50 " + (y + 10) + " Z", fill: col }, edge)),
    sv("path", { d: "M45.5 " + (y + 3.5) + " L54.5 " + (y + 3.5), stroke: "#8a6a1e", "stroke-width": 0.8 })];
}
function mouthFor(a, y) {
  const m = { stroke: OUT, "stroke-width": 1.8, fill: "none", "stroke-linecap": "round" };
  if (a.expr === "oops") return [sv("path", Object.assign({ d: "M44 " + (y + 1) + " q2 -3 4 0 q2 3 4 0 q2 -3 4 0" }, m))];
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
    const y = animal === "rabbit" ? 58 : animal === "crane" || animal === "phoenix" || animal === "fox" ? 58 : 55;
    return sv("g", {}, sv("path", { d: "M17 " + y + " q0 -40 33 -40 q33 0 33 40", fill: "none", stroke: "#2d2f36", "stroke-width": 4, "stroke-linecap": "round" }),
      sv("rect", { x: 11, y: y - 7, width: 10, height: 16, rx: 4, fill: "#2d2f36" }), sv("rect", { x: 79, y: y - 7, width: 10, height: 16, rx: 4, fill: "#2d2f36" }),
      sv("rect", { x: 13.5, y: y - 4, width: 5, height: 10, rx: 2, style: "fill: var(--accent)" }), sv("rect", { x: 81.5, y: y - 4, width: 5, height: 10, rx: 2, style: "fill: var(--accent)" }));
  }
  if (kind === "crown") {
    const y = { dragon: 16, rabbit: 26, crane: 26, phoenix: 30, fox: 30, qilin: 22, monkey: 18, koi: 22 }[animal] || 20;
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
const THEME_AVSTYLE = { arcade: "pixel", cyber: "neon", ink: "ink" };
/** The art style an avatar is drawn in: the theme's own look when "Avatar matches theme" is on
 *  (Customise → Theme), otherwise the standard one. */
function avStyle() {
  if (!state.avMatch) return "cute";
  return THEME_AVSTYLE[document.documentElement.getAttribute("data-shape")] || "cute";
}
function halo(animal) {
  const y = { rabbit: 7, fox: 9, phoenix: 9, crane: 9, qilin: 9, cat: 10 }[animal] || 12;
  return sv("g", { class: "av-halo" },
    sv("ellipse", { cx: 50, cy: y, rx: 15, ry: 4.2, fill: "none", stroke: "#fff3b0", "stroke-width": 4.4, opacity: 0.55 }),
    sv("ellipse", { cx: 50, cy: y, rx: 15, ry: 4.2, fill: "none", stroke: "#f5c542", "stroke-width": 2.4 }));
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
    sv("feColorMatrix", { in: "wobble", type: "saturate", values: 0.55 }));
  return null;
}
function avatarSvg(a, size, label) {
  const id = "avc" + (++avatarSeq);
  const { parts, eye, mouthY, beak } = animalParts(a.animal);
  const face = sv("g", { class: "av-body av-" + a.expr },
    parts, eyesFor(a, eye), beak ? beakFor(a, mouthY, beak) : mouthFor(a, mouthY),
    [sv("ellipse", { cx: 29, cy: 65, rx: 5, ry: 3, fill: "#ff8fa3", opacity: 0.55 }), sv("ellipse", { cx: 71, cy: 65, rx: 5, ry: 3, fill: "#ff8fa3", opacity: 0.55 })],
    a.expr === "oops" ? sv("path", { class: "av-sweat", d: "M79 30 q-4 6 0 8 q4 -2 0 -8 Z", fill: "#8cc7e8", stroke: "#4f95bd", "stroke-width": 0.8 }) : null,
    ["scarf", "bamboo", "lantern", "phones", "crown"].filter(x => a.accs.includes(x)).map(x => accessory(x, a.animal)),
    a.halo ? halo(a.animal) : null);
  const sparks = a.sparkles ? sv("g", {}, [[16, 22, 0], [84, 18, 0.7], [88, 70, 1.4], [12, 74, 2.1]].map(([x, y, d]) =>
    sv("path", { class: "av-sparkle", d: "M" + x + " " + (y - 5) + " L" + (x + 1.4) + " " + (y - 1.4) + " L" + (x + 5) + " " + y + " L" + (x + 1.4) + " " + (y + 1.4) + " L" + x + " " + (y + 5) + " L" + (x - 1.4) + " " + (y + 1.4) + " L" + (x - 5) + " " + y + " L" + (x - 1.4) + " " + (y - 1.4) + " Z", fill: "#f5c542", style: "animation-delay: " + d + "s" }))) : null;
  const z = a.expr === "sleepy" ? sv("g", { class: "av-zs" }, ["z", "z", "Z"].map((t, i) => sv("text", { x: 70 + i * 6, y: 30 - i * 7, class: "av-z", style: "animation-delay: " + i * 0.8 + "s; fill: var(--ink-soft)", "font-size": 8 + i * 2, "font-weight": 700 }, document.createTextNode(t)))) : null;
  const style = a.plain ? "cute" : avStyle();   // plain: locked tiles are a simple shadow in every theme
  return sv("svg", { viewBox: "0 0 100 100", width: size, height: size, class: "avatar avs-" + style, role: "img", "aria-label": label || (AV.animal[a.animal].label + " avatar") },
    sv("defs", {}, sv("clipPath", { id }, sv("circle", { cx: 50, cy: 50, r: 49 })), avFilter(style, id + "f", size)),
    sv("g", { class: "av-art", filter: style === "cute" ? null : "url(#" + id + "f)" }, sv("g", { "clip-path": "url(#" + id + ")" },
      sv("circle", { class: "av-bg", cx: 50, cy: 50, r: 49, style: "fill: var(--surface-2)" }),
      aura(a.aura), face, z, sparks)));
}
/** What a new level unlocks, for the level-up screen. */
function unlocksAt(level) {
  const out = [];
  for (const k of ["animal", "eyes", "acc", "aura", "halo"]) for (const item of Object.values(AV[k])) if (item.lv === level && item.label !== "None") out.push(item.label);
  for (const [id, t] of Object.entries(BONUS_THEMES)) if (t.lv === level) out.push(PRESETS[id].label + " theme");
  for (const item of Object.values(CLOCK.face)) if (item.lv === level) out.push(item.label + " clock");
  for (const item of Object.values(CLOCK.fx)) if (item.lv === level) out.push(item.label + " clock effect");
  return out;
}
