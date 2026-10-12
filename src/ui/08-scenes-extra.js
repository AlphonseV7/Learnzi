/* LearnZì UI, part 1c: background scenes for Retro Arcade (pixel night city) and Cyberedge (neon grid city). */

/** Turns rows of "#" into little squares: a hand-made pixel sprite. */
function sprite(rows, x, y, size, style) {
  const out = [];
  rows.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch !== ".") out.push(sv("rect", { x: x + i * size, y: y + j * size, width: size, height: size, style: style(ch) }));
  }));
  return out;
}

SCENES.arcade = function () {
  const r = seeded(23);
  const out = [];
  // stars
  for (let i = 0; i < 80; i++) {
    const big = r() > 0.85;
    out.push(sv("rect", { x: Math.round(r() * 300) * 4, y: Math.round(r() * 130) * 4, width: big ? 8 : 4, height: big ? 8 : 4,
      class: r() > 0.5 ? "zen-blink" : null, style: fill(r() > 0.8 ? "--accent" : "--ink", big ? 0.45 : 0.3) + "; animation-delay: " + (-r() * 2.4).toFixed(1) + "s" }));
  }
  // a blocky crescent moon
  const B = 8, mx = 960, my = 150, R = 52;
  for (let y = -R; y <= R; y += B) for (let x = -R; x <= R; x += B) {
    const inMoon = x * x + y * y <= R * R, inShadow = (x + 26) ** 2 + (y - 10) ** 2 <= (R - 6) ** 2;
    if (inMoon && !inShadow) out.push(sv("rect", { x: mx + x, y: my + y, width: B, height: B, style: fill("--accent", 0.4) }));
  }
  // a little rocket crossing the sky now and then
  const ship = ["..##.......", "..####.....", ".#######...", "###########", "###########", ".#######...", "..####.....", "..##......."];
  const flame = ["##", "#.", "##"];
  out.push(sv("g", { class: "zen-ship" }, sv("g", { transform: "translate(0 70)" },
    sprite(ship, 18, 0, 6, () => fill("--t4", 0.45)),
    sprite(flame, 0, 18, 6, () => fill("--t2", 0.5)))));
  // stepped mountains, then a pixel city in front
  const hills = (base, amp, tok, op, seed) => {
    const q = seeded(seed);
    let hgt = amp / 2;
    for (let x = 0; x < 1200; x += 16) {
      hgt = Math.max(16, Math.min(amp, hgt + (q() - 0.5) * 48));
      const top = base - Math.round(hgt / 8) * 8;
      out.push(sv("rect", { x, y: top, width: 16, height: 800 - top, style: fill(tok, op) }));
    }
  };
  hills(600, 200, "--surface-2", 0.55, 4);
  let x = 0;
  while (x < 1200) {
    const w = 48 + Math.round(r() * 6) * 16, hgt = 64 + Math.round(r() * 12) * 16;
    out.push(sv("rect", { x, y: 800 - hgt, width: w, height: hgt, style: fill("--surface", 0.95) }));
    for (let wy = 800 - hgt + 12; wy < 784; wy += 20) for (let wx = x + 8; wx < x + w - 12; wx += 16) {
      if (r() > 0.7) out.push(sv("rect", { x: wx, y: wy, width: 8, height: 8, class: r() > 0.7 ? "zen-blink" : null,
        style: fill(r() > 0.5 ? "--accent" : "--t4", 0.4) + "; animation-delay: " + (-r() * 2.4).toFixed(1) + "s" }));
    }
    x += w + 8;
  }
  out.push(sv("rect", { x: 0, y: 792, width: 1200, height: 8, style: fill("--line", 0.9) }));
  return out;
};

SCENES.cyber = function () {
  const r = seeded(41);
  const out = [];
  const HZ = 520;
  // a huge broken octagon low in the sky
  const oct = [];
  for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; oct.push((600 + 190 * Math.cos(a)).toFixed(0) + "," + (360 + 190 * Math.sin(a)).toFixed(0)); }
  out.push(sv("polygon", { points: oct.join(" "), style: "fill: var(--accent-2); opacity: .06" }));
  out.push(sv("polygon", { points: oct.join(" "), style: "fill: none; stroke: var(--accent-2); stroke-width: 2; opacity: .3; stroke-dasharray: 160 18 40 18" }));
  for (let i = 0; i < 5; i++) out.push(sv("rect", { x: 380, y: 400 + i * 22, width: 440, height: 4 + i * 2, style: fill("--bg", 1) }));
  // the floor: lines rushing towards you
  out.push(sv("rect", { x: 0, y: HZ, width: 1200, height: 280, style: fill("--bg", 1) }));
  for (let gx = -1800; gx <= 3000; gx += 160) out.push(sv("line", { x1: 600, y1: HZ, x2: gx, y2: 800, style: "stroke: var(--accent); stroke-width: 1.5; opacity: .22" }));
  const floor = sv("g", { style: "opacity: .3" });
  for (let i = 0; i < 7; i++) floor.append(sv("line", { x1: 0, y1: HZ, x2: 1200, y2: HZ, class: "zen-grid-line", style: "stroke: var(--accent); stroke-width: 1.5; animation-delay: " + (-i * 3.2 / 7).toFixed(2) + "s" }));
  out.push(floor);
  // the city on the horizon: slanted roofs, antennas, strip windows
  let x = -20;
  while (x < 1220) {
    const w = 40 + r() * 70, hgt = 80 + r() * 250, slant = (r() - 0.5) * 40;
    const top = HZ - hgt;
    const pts = [[x, HZ], [x, top + Math.max(0, slant)], [x + w, top + Math.max(0, -slant)], [x + w, HZ]];
    out.push(sv("polygon", { points: pts.map(p => p.map(n => n.toFixed(0)).join(",")).join(" "), style: fill("--surface", 0.97) }));
    if (r() > 0.6) out.push(sv("rect", { x: (x + w * 0.4).toFixed(0), y: (top - 40).toFixed(0), width: 2, height: 44, style: fill("--ink-soft", 0.35) }));
    for (let wy = top + 24; wy < HZ - 10; wy += 16) if (r() > 0.55) {
      out.push(sv("rect", { x: (x + 6).toFixed(0), y: wy.toFixed(0), width: Math.max(6, w * (0.3 + r() * 0.5) - 6).toFixed(0), height: 2,
        class: r() > 0.85 ? "zen-flicker" : null, style: fill(r() > 0.5 ? "--accent" : "--accent-2", 0.45) + "; animation-delay: " + (-r() * 5).toFixed(1) + "s" }));
    }
    x += w + 2;
  }
  // neon signs with real characters
  const sign = (sx, sy, text, tok, delay) => {
    const g = sv("g", { class: "zen-flicker", style: "animation-delay: " + delay + "s; filter: drop-shadow(0 0 6px var(" + tok + "))" });
    g.append(sv("rect", { x: sx, y: sy, width: 56, height: 40 + text.length * 50, style: "fill: var(--bg); opacity: .8; stroke: var(" + tok + "); stroke-width: 2" }));
    [...text].forEach((ch, i) => g.append(sv("text", { x: sx + 28, y: sy + 62 + i * 50, "text-anchor": "middle", "font-size": 40, style: "fill: var(" + tok + "); font-family: var(--font-hanzi); opacity: .9" }, document.createTextNode(ch))));
    return g;
  };
  out.push(sign(150, 250, "学习", "--accent-2", 0), sign(1010, 210, "汉字", "--accent", -2.3));
  // rain
  for (let i = 0; i < 46; i++) {
    const rx = r() * 1300, ry = r() * 200 - 150;
    out.push(sv("line", { x1: rx.toFixed(0), y1: ry.toFixed(0), x2: (rx - 7).toFixed(0), y2: (ry + 26).toFixed(0), class: "zen-rain",
      style: "stroke: var(--ink); stroke-width: 1; opacity: .13; animation-duration: " + (1 + r()).toFixed(2) + "s; animation-delay: " + (-r() * 2).toFixed(2) + "s" }));
  }
  return out;
};

/* MLE mode: London at night. Tower blocks with lit windows, street lamps, a wall with tags,
 * a fox on the wall, and a red night bus going past. Its own colours (it's MLE mode's scene only). */
SCENES.ends = function () {
  const r = seeded(77);
  const out = [];
  out.push(sv("circle", { cx: 980, cy: 120, r: 46, style: "fill: var(--e-sky, #f4f1de); opacity: .55; filter: drop-shadow(0 0 30px var(--e-sky, #f4f1de))" }));
  // tower blocks
  let x = -20;
  while (x < 1220) {
    const w = 70 + r() * 90, hgt = 220 + r() * 330, top = 640 - hgt;
    out.push(sv("rect", { x: x.toFixed(0), y: top.toFixed(0), width: w.toFixed(0), height: hgt.toFixed(0), style: "fill: var(--e-block, #1b1d24)" }));
    for (let wy = top + 16; wy < 620; wy += 26) for (let wx = x + 10; wx < x + w - 14; wx += 20) {
      if (r() > 0.62) out.push(sv("rect", { x: wx.toFixed(0), y: wy.toFixed(0), width: 9, height: 12, class: r() > 0.8 ? "zen-twinkle" : null,
        style: "fill: " + (r() > 0.3 ? "#ffd27a" : "#7fd3ff") + "; opacity: var(--e-win, .55); animation-delay: " + (-r() * 4).toFixed(1) + "s" }));
    }
    x += w + 10;
  }
  // the wall, with tags
  out.push(sv("rect", { x: 0, y: 640, width: 1200, height: 160, style: "fill: var(--e-wall, #2a2c33)" }));
  for (let i = 0; i < 24; i++) out.push(sv("line", { x1: i * 50, y1: 640, x2: i * 50, y2: 700, style: "stroke: var(--e-mortar, #22242a); stroke-width: 2" }));
  out.push(sv("line", { x1: 0, y1: 670, x2: 1200, y2: 670, style: "stroke: var(--e-mortar, #22242a); stroke-width: 2" }));
  out.push(sv("path", { d: "M120 690 q20 -40 40 0 t40 0 t40 -10 M150 700 l60 -40", style: "fill: none; stroke: #ff4fa3; stroke-width: 6; stroke-linecap: round; opacity: .6" }));
  out.push(sv("path", { d: "M760 694 c10 -30 30 -30 30 0 s20 30 30 0 s20 -30 34 -4 M770 706 h80", style: "fill: none; stroke: #31d0ff; stroke-width: 6; stroke-linecap: round; opacity: .55" }));
  // street lamps
  for (const lx of [300, 640, 1080]) {
    out.push(sv("rect", { x: lx, y: 470, width: 5, height: 170, style: "fill: var(--e-lamp, #3a3d46)" }));
    out.push(sv("ellipse", { cx: lx + 2, cy: 480, rx: 60, ry: 40, style: "fill: #ffcf6e; opacity: calc(.18 * var(--e-glow, 1)); filter: blur(14px)" }));
    out.push(sv("rect", { x: lx - 8, y: 466, width: 21, height: 8, rx: 3, style: "fill: #ffd27a; opacity: .8" }));
  }
  // a fox on the wall
  out.push(sv("g", { transform: "translate(520 616)", style: "opacity: .9" },
    sv("path", { d: "M0 24 q10 -22 34 -18 l10 -10 l4 10 q8 4 6 14 z", style: "fill: #d9732f" }),
    sv("path", { d: "M0 24 q-20 -6 -30 6 q16 2 30 -2 z", style: "fill: #d9732f" }),
    sv("path", { d: "M-30 30 q4 -4 8 -2", style: "stroke: #fff; stroke-width: 3; fill: none" })));
  // the night bus
  const bus = sv("g", { class: "zen-bus" },
    sv("rect", { x: 0, y: 676, width: 200, height: 96, rx: 10, style: "fill: #d6262e" }),
    sv("rect", { x: 0, y: 720, width: 200, height: 4, style: "fill: #a51c22" }),
    [0, 1, 2, 3, 4].map(i => sv("rect", { x: 14 + i * 36, y: 686, width: 28, height: 24, rx: 3, style: "fill: #ffe6a6; opacity: .85" })),
    [0, 1, 2, 3].map(i => sv("rect", { x: 50 + i * 36, y: 730, width: 28, height: 22, rx: 3, style: "fill: #ffe6a6; opacity: .75" })),
    sv("rect", { x: 10, y: 728, width: 30, height: 40, rx: 3, style: "fill: #1b1d24" }),
    sv("circle", { cx: 44, cy: 774, r: 14, style: "fill: #111" }), sv("circle", { cx: 160, cy: 774, r: 14, style: "fill: #111" }),
    sv("rect", { x: 196, y: 690, width: 6, height: 10, style: "fill: #fff4b8" }));
  out.push(bus);
  return out;
};

/* Silver River (银河, the Milky Way): a night sky full of stars, the Milky Way sweeping across, and the
 * two stars of the Qixi legend on either bank: Vega, the Weaver Girl (织女), and Altair, the Cowherd
 * (牛郎), who may cross only once a year on a bridge of magpies. Now and then a shooting star. */
SCENES.silver = function () {
  const r = seeded(77);
  const band = [], sky = [], out = [];
  // the Milky Way: soft overlapping glows along a diagonal band, then dense star dust inside it
  const along = (t, w) => [80 + t * 1040, 760 - t * 700 + Math.sin(t * 5) * 30, w];
  for (let i = 0; i <= 22; i++) {
    const t = i / 22, [x, y, w] = along(t, 120 + 60 * Math.sin(t * 3.1));
    band.push(sv("ellipse", { cx: x.toFixed(0), cy: y.toFixed(0), rx: (w * 1.6).toFixed(0), ry: (w * 0.55).toFixed(0), transform: "rotate(-34 " + x.toFixed(0) + " " + y.toFixed(0) + ")",
      style: fill(i % 3 ? "--accent" : "--t4", 0.05) + "; filter: blur(18px)" }));
  }
  for (let i = 0; i < 260; i++) {
    const t = r(), [x, y, w] = along(t, 110);
    const dx = (r() - 0.5) * w * 2.2, dy = (r() - 0.5) * w * 0.9;
    band.push(sv("circle", { cx: (x + dx * 0.83 + dy * 0.56).toFixed(1), cy: (y - dx * 0.56 + dy * 0.83).toFixed(1), r: (0.4 + r() * 0.9).toFixed(2), style: fill("--ink", 0.18 + r() * 0.25) }));
  }
  // the rest of the sky
  for (let i = 0; i < 150; i++) {
    const big = r() > 0.88;
    sky.push(sv("circle", { cx: (r() * 1200).toFixed(0), cy: (r() * 800).toFixed(0), r: (big ? 1.4 + r() : 0.5 + r() * 0.8).toFixed(2),
      class: r() > 0.55 ? "zen-twinkle" : null, style: fill(big && r() > 0.5 ? "--t4" : "--ink", big ? 0.55 : 0.3) + "; animation-delay: " + (-r() * 4).toFixed(2) + "s" }));
  }
  // Vega and Altair, each with a four-point glint and its name
  const star = (x, y, label) => sv("g", { class: "zen-star", transform: "translate(" + x + " " + y + ")" },
    sv("circle", { r: 14, style: fill("--accent", 0.12) + "; filter: blur(6px)" }),
    sv("path", { d: "M0 -16 L2 -2 L16 0 L2 2 L0 16 L-2 2 L-16 0 L-2 -2 Z", style: fill("--ink", 0.75) }),
    sv("circle", { r: 2.6, style: fill("--ink", 0.95) }),
    sv("text", { x: 20, y: 5, "font-size": 15, style: fill("--ink-soft", 0.5) + "; font-family: var(--font-hanzi)" }, label));
  out.push(star(455, 230, "织女"), star(700, 590, "牛郎"));
  // the magpie bridge: little birds in an arc across the river between them
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const t = 0.2 + 0.6 * i / 6, x = 455 + (700 - 455) * t, y = 230 + (590 - 230) * t - Math.sin(t * Math.PI) * 120;
    birds.push(sv("path", { d: "M" + (x - 7).toFixed(0) + " " + y.toFixed(0) + " q7 -6 7 0 q0 -6 7 0", style: "fill: none; stroke: var(--ink-soft); stroke-width: 1.4; opacity: calc(.32 * var(--zen-k, 1))" }));
  }
  out.push(sv("g", { class: "zen-magpies" }, birds));
  // a shooting star
  out.push(sv("g", { class: "zen-shoot" }, sv("path", { d: "M0 0 L-120 -46", style: "stroke: var(--ink); stroke-width: 1.6; stroke-linecap: round; opacity: calc(.6 * var(--zen-k, 1))" }),
    sv("circle", { r: 2, style: fill("--ink", 0.9) })));
  // three layers: the Milky Way breathes, the far stars drift very slowly, the legend stays put
  return { layers: [["zen-river", band], ["zen-far", sky], ["", out]] };
};
