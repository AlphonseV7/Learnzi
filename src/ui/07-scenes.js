/* LearnZì UI, part 1b: zen background scenes, one per theme, drawn in code (no image files).
 * They sit behind everything, very faint, and only use the theme's colour tokens. */

const SVGNS = "http://www.w3.org/2000/svg";
function sv(tag, attrs, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, String(v));
  for (const k of kids.flat(Infinity)) if (k != null) el.append(k);
  return el;
}
/** A small repeatable random generator, so every scene looks the same each time. */
function seeded(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; }

/** A soft mountain ridge from x=0 to 1200, smoothed through midpoints. */
function ridge(base, amp, seed) {
  const r = seeded(seed);
  const pts = [];
  for (let x = -40; x <= 1240; x += 80) pts.push([x, base - amp * (0.35 + 0.65 * r()) * Math.abs(Math.sin(x / 210 + seed))]);
  let d = "M-40 800 L" + pts[0][0] + " " + pts[0][1].toFixed(1);
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    d += " Q" + x0 + " " + y0.toFixed(1) + " " + ((x0 + x1) / 2) + " " + ((y0 + y1) / 2).toFixed(1);
  }
  return d + " L1240 " + pts[pts.length - 1][1].toFixed(1) + " L1240 800 Z";
}
// --zen-k (set per theme in CSS) makes a theme's scene stronger or fainter without redrawing it.
const fill = (token, opacity) => "fill: var(" + token + "); opacity: calc(" + opacity + " * var(--zen-k, 1))";

const SCENES = {
  ink() {
    const birds = [[860, 170], [905, 150], [940, 182]].map(([x, y], i) =>
      sv("path", { d: "M" + x + " " + y + " q8 -8 16 0 q8 -8 16 0", class: "zen-bird", style: "stroke: var(--ink); opacity: calc(.22 * var(--zen-k, 1)); animation-delay: " + (-i * 2) + "s" }));
    return [
      sv("circle", { cx: 960, cy: 230, r: 70, style: fill("--accent", 0.09) }),
      sv("path", { d: ridge(560, 160, 2), style: fill("--ink", 0.035) }),
      sv("path", { d: ridge(640, 130, 5), style: fill("--ink", 0.055) }),
      sv("path", { d: ridge(730, 90, 9), style: fill("--ink", 0.08) }),
      sv("g", { class: "zen-birds" }, birds),
      sv("ellipse", { cx: 420, cy: 600, rx: 520, ry: 38, class: "zen-mist", style: "fill: var(--surface); opacity: .55; filter: blur(18px)" }),
      sv("ellipse", { cx: 900, cy: 690, rx: 420, ry: 30, class: "zen-mist", style: "fill: var(--surface); opacity: .45; filter: blur(16px); animation-delay: -14s" }),
    ];
  },
  jade() {
    const r = seeded(7);
    const stalk = (x, w, top, delay) => {
      const g = sv("g", { class: "zen-sway", style: "transform-origin: " + x + "px 800px; animation-delay: " + delay + "s" });
      for (let y = 800; y > top; y -= 118) {
        g.append(sv("rect", { x: x - w / 2, y: y - 112, width: w, height: 112, rx: w / 2.5, style: fill("--accent", 0.13) }));
        if (r() > 0.45) {
          const dir = r() > 0.5 ? 1 : -1;
          for (let k = 0; k < 3; k++) {
            g.append(sv("path", {
              d: "M" + x + " " + (y - 112) + " q" + dir * 40 + " " + (-18 + k * 14) + " " + dir * (90 + k * 14) + " " + (6 + k * 16) + " q" + (-dir * 46) + " " + (-2) + " " + (-dir * (90 + k * 14)) + " " + (-(6 + k * 16)) + "Z",
              style: fill("--accent", 0.12),
            }));
          }
        }
      }
      return g;
    };
    const leaves = [];
    for (let i = 0; i < 9; i++) leaves.push(sv("ellipse", { cx: (300 + r() * 900).toFixed(0), cy: -20, rx: 11, ry: 3.5, class: "zen-fall", style: fill("--accent", 0.22) + "; animation-delay: " + (-r() * 16).toFixed(1) + "s; animation-duration: " + (14 + r() * 8).toFixed(1) + "s" }));
    return [stalk(1080, 22, 40, 0), stalk(1150, 16, 160, -2), stalk(990, 14, 300, -4), stalk(70, 14, 420, -1), sv("g", {}, leaves)];
  },
  porcelain() {
    const waves = [];
    for (let row = 0; row < 4; row++) {
      for (let i = -1; i < 26; i++) {
        const cx = i * 50 + (row % 2 ? 25 : 0), cy = 680 + row * 34;
        for (const rad of [24, 17, 10]) waves.push(sv("path", { d: "M" + (cx - rad) + " " + cy + " a" + rad + " " + rad + " 0 0 1 " + rad * 2 + " 0", style: "fill: none; stroke: var(--accent); stroke-width: 2; opacity: calc(.13 * var(--zen-k, 1))" }));
      }
    }
    const cloud = (x, y, s) => sv("g", { transform: "translate(" + x + " " + y + ") scale(" + s + ")", style: "fill: none; stroke: var(--accent); stroke-width: 3; opacity: calc(.14 * var(--zen-k, 1))" },
      sv("path", { d: "M0 40 a30 30 0 0 1 52 -22 a26 26 0 0 1 46 6 a22 22 0 0 1 20 36 Z" }),
      sv("path", { d: "M30 34 a10 10 0 1 1 14 8" }), sv("path", { d: "M74 30 a9 9 0 1 1 12 7" }));
    return [sv("g", { class: "zen-wave" }, waves), sv("g", { class: "zen-birds" }, cloud(880, 90, 1.6), cloud(1040, 210, 1)), sv("g", { class: "zen-birds", style: "animation-delay: -20s" }, cloud(60, 140, 1.1))];
  },
  lantern() {
    const out = [];
    const r = seeded(3);
    for (let i = 0; i < 40; i++) out.push(sv("circle", { cx: (r() * 1200).toFixed(0), cy: (r() * 420).toFixed(0), r: (0.8 + r() * 1.6).toFixed(1), class: "zen-twinkle", style: "fill: var(--ink); opacity: calc(.25 * var(--zen-k, 1)); animation-delay: " + (-r() * 4).toFixed(1) + "s" }));
    [[180, 120, 1], [420, 70, 0.8], [760, 150, 1.15], [1000, 90, 0.9], [1120, 210, 0.7]].forEach(([x, len, s], i) => {
      out.push(sv("g", { class: "zen-sway", style: "transform-origin: " + x + "px 0px; animation-delay: " + (-i * 1.3) + "s" },
        sv("line", { x1: x, y1: 0, x2: x, y2: len, style: "stroke: var(--ink-soft); stroke-width: 1.5; opacity: calc(.3 * var(--zen-k, 1))" }),
        sv("ellipse", { cx: x, cy: len + 36 * s, rx: 40 * s, ry: 30 * s, style: "fill: var(--accent); opacity: calc(.14 * var(--zen-k, 1)); filter: blur(14px)" }),
        sv("rect", { x: x - 12 * s, y: len, width: 24 * s, height: 7 * s, rx: 2, style: fill("--accent", 0.3) }),
        sv("ellipse", { cx: x, cy: len + 36 * s, rx: 30 * s, ry: 29 * s, style: fill("--accent", 0.26) }),
        sv("path", { d: "M" + (x - 30 * s) + " " + (len + 36 * s) + " h" + 60 * s + " M" + x + " " + (len + 8 * s) + " v" + 56 * s, style: "stroke: var(--bg); stroke-width: 1.5; opacity: calc(.35 * var(--zen-k, 1))" }),
        sv("line", { x1: x, y1: len + 65 * s, x2: x, y2: len + 90 * s, style: "stroke: var(--accent); stroke-width: 2; opacity: calc(.3 * var(--zen-k, 1))" })));
    });
    for (let i = 0; i < 7; i++) {
      const x = 80 + r() * 1040, sz = 10 + r() * 10;
      out.push(sv("g", { class: "zen-rise", style: "animation-duration: " + (34 + r() * 24).toFixed(0) + "s; animation-delay: " + (-r() * 50).toFixed(0) + "s" },
        sv("ellipse", { cx: x, cy: 860, rx: sz * 1.6, ry: sz * 1.6, style: "fill: var(--accent); opacity: .12; filter: blur(8px)" }),
        sv("rect", { x: x - sz / 2, y: 860 - sz * 0.7, width: sz, height: sz * 1.3, rx: sz * 0.3, style: fill("--accent", 0.45) })));
    }
    return out;
  },
  peach() {
    const r = seeded(21);
    const branch = sv("path", { d: "M1210 120 Q1040 150 940 240 Q880 290 800 300 M1040 168 Q1000 90 930 70 M940 240 Q930 330 980 400", style: "fill: none; stroke: var(--ink-soft); stroke-width: 9; stroke-linecap: round; opacity: calc(.18 * var(--zen-k, 1))" });
    const blossoms = [];
    for (let i = 0; i < 26; i++) {
      const t = r();
      const x = 800 + t * 410, y = 70 + r() * 330;
      blossoms.push(sv("g", { transform: "translate(" + x.toFixed(0) + " " + y.toFixed(0) + ")" },
        [0, 72, 144, 216, 288].map(a => sv("ellipse", { cx: 0, cy: -7, rx: 5, ry: 7, transform: "rotate(" + a + ")", style: fill("--accent", 0.16) }))));
    }
    const petals = [];
    for (let i = 0; i < 14; i++) petals.push(sv("ellipse", { cx: (200 + r() * 1000).toFixed(0), cy: -20, rx: 6, ry: 4, class: "zen-fall", style: fill("--accent", 0.22) + "; animation-delay: " + (-r() * 14).toFixed(1) + "s; animation-duration: " + (11 + r() * 8).toFixed(1) + "s" }));
    return [branch, sv("g", {}, blossoms), sv("g", {}, petals)];
  },
  imperial() {
    const roof = (x, w, y) => sv("path", { d: "M" + x + " " + y + " q" + w * 0.12 + " -10 " + w * 0.2 + " -40 h" + w * 0.6 + " q" + w * 0.08 + " 30 " + w * 0.2 + " 40 Z M" + (x + w * 0.12) + " " + y + " h" + w * 0.76 + " v120 h-" + w * 0.76 + " Z", style: fill("--accent", 0.09) });
    const cloud = (x, y, s) => sv("path", { d: "M" + x + " " + y + " q" + 20 * s + " -" + 30 * s + " " + 50 * s + " -" + 6 * s + " q" + 26 * s + " -" + 26 * s + " " + 50 * s + " 2 q" + 22 * s + " 2 " + 14 * s + " " + 20 * s + " Z", style: "fill: none; stroke: var(--accent); stroke-width: 3; opacity: calc(.16 * var(--zen-k, 1))" });
    return [roof(120, 360, 690), roof(560, 520, 650), roof(1000, 300, 710), sv("g", { class: "zen-birds" }, cloud(80, 160, 2), cloud(820, 110, 2.6)), sv("g", { class: "zen-birds", style: "animation-delay: -18s" }, cloud(560, 260, 1.4))];
  },
  nightmarket() {
    const r = seeded(11);
    const out = [];
    let x = -10;
    while (x < 1210) {
      const w = 50 + r() * 90, hgt = 90 + r() * 230;
      out.push(sv("rect", { x: x.toFixed(0), y: (800 - hgt).toFixed(0), width: w.toFixed(0), height: hgt.toFixed(0), style: fill("--surface", 0.85) }));
      for (let wy = 800 - hgt + 14; wy < 780; wy += 22) {
        for (let wx = x + 10; wx < x + w - 12; wx += 18) {
          if (r() > 0.72) out.push(sv("rect", { x: wx.toFixed(0), y: wy.toFixed(0), width: 7, height: 9, class: r() > 0.6 ? "zen-twinkle" : null, style: fill(r() > 0.5 ? "--t2" : "--accent", 0.35) + "; animation-delay: " + (-r() * 4).toFixed(1) + "s" }));
        }
      }
      x += w + 4;
    }
    const bulbs = [];
    const tokens = ["--accent", "--t2", "--t4", "--t3"];
    for (let i = 0; i <= 24; i++) {
      const bx = i * 50, by = 40 + 60 * Math.sin((i / 24) * Math.PI);
      bulbs.push(sv("circle", { cx: bx, cy: by.toFixed(1), r: 4, class: "zen-twinkle", style: fill(tokens[i % 4], 0.6) + "; animation-delay: " + (-(i % 5) * 0.7) + "s; filter: drop-shadow(0 0 6px var(" + tokens[i % 4] + "))" }));
    }
    return [sv("path", { d: "M0 40 Q600 160 1200 40", style: "fill: none; stroke: var(--ink-soft); stroke-width: 1.5; opacity: calc(.3 * var(--zen-k, 1))" }), sv("g", {}, bulbs), sv("g", {}, out)];
  },
};

let sceneKey = "";
function renderScene() {
  const host = $("#zen");
  if (!host) return;
  const p = usablePreset();
  const base = state.mle && state.mle.on ? "ends" : p === "custom" && state.custom ? state.custom.base : p;
  const kind = state.zen ? (SCENES[base] ? base : "ink") : "";
  if (kind === sceneKey) return;
  sceneKey = kind;
  host.replaceChildren();
  if (!kind) return;
  host.append(sv("svg", { viewBox: "0 0 1200 800", preserveAspectRatio: "xMidYMax slice", class: "zen-svg", "data-scene": kind }, SCENES[kind]()));
}
