/* LearnZì UI, part 9b: an Easter egg. Hold Settings → Glitch → "Glitch out" for 7 seconds: the screen goes black and
 * a code-rain lock appears with three sigils. Each tap turns a sigil 45°. Turn them the right way
 * (the faint 三 · 六 · 一 is the clue: 3, 6 and 1 turns) and the app glitches, goes offline, reboots
 * and opens Special mode. Special mode itself comes later; for now it says so. */

const SECRET_HOLD = 7000;    // the button starts to tremble at 4 seconds
const SECRET_SOLUTION = [3, 6, 1];

/** The Glitch out button: a tap glitches as before; holding it for 7 seconds opens the secret. */
function glitchButton() {
  const b = h("button", { class: "btn danger glitch-btn", type: "button" }, "Glitch out");
  let timer = 0, shake = 0, held = false;
  const cancel = () => { clearTimeout(timer); clearTimeout(shake); b.classList.remove("trembling"); };
  b.addEventListener("contextmenu", ev => ev.preventDefault());       // no long-press menu on phones
  b.addEventListener("pointerdown", ev => {
    if (ev.button !== 0) return;
    held = true;
    shake = setTimeout(() => b.classList.add("trembling"), 4000);      // a hint that something is happening
    timer = setTimeout(() => { held = false; cancel(); openSecret(); }, SECRET_HOLD);
  });
  const release = () => { if (!held) return; held = false; cancel(); startGlitch(); };
  b.addEventListener("pointerup", release);
  b.addEventListener("pointercancel", () => { held = false; cancel(); });
  b.addEventListener("pointerleave", () => { if (held) { held = false; cancel(); } });
  // Keyboard: Enter or Space glitches as before.
  b.addEventListener("click", ev => { if (ev.detail === 0) startGlitch(); });
  return b;
}

// ---------- code rain ----------
const RAIN_CHARS = "汉字学习声调天地人山水火木金土日月零一二三四五六七八九十龙风云雨花鸟鱼心中国说听读写0110";
function codeRain(canvas, opts) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let cols = [], size = 16, raf = 0, last = 0;
  const fit = () => {
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    size = innerWidth < 500 ? 14 : 18;
    cols = Array.from({ length: Math.ceil(innerWidth / size) }, () => Math.random() * -40);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, innerWidth, innerHeight);
  };
  fit();
  addEventListener("resize", fit);
  const step = t => {
    if (!canvas.isConnected) { removeEventListener("resize", fit); return; }
    raf = requestAnimationFrame(step);
    if (t - last < (opts.fast ? 30 : 55)) return;
    last = t;
    ctx.fillStyle = opts.red ? "rgba(20, 0, 0, 0.18)" : "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    ctx.font = size + "px " + getComputedStyle(document.documentElement).getPropertyValue("--font-hanzi");
    cols.forEach((y, i) => {
      const ch = RAIN_CHARS[Math.floor(Math.random() * RAIN_CHARS.length)];
      ctx.fillStyle = opts.red ? (Math.random() > 0.9 ? "#fff" : "#ff2a3a") : (Math.random() > 0.94 ? "#d8ffe0" : "#18e05a");
      ctx.fillText(ch, i * size, y * size);
      cols[i] = y * size > innerHeight && Math.random() > 0.97 ? 0 : y + 1;
    });
  };
  raf = requestAnimationFrame(step);
  return { stop: () => cancelAnimationFrame(raf) };
}

// ---------- the lock ----------
const SIGILS = [
  // a pointer, a hook and a moon with a star: each looks different at every 45° turn
  () => [sv("path", { d: "M40 8 L62 60 L40 48 L18 60 Z" }), sv("circle", { cx: 40, cy: 34, r: 4 })],
  () => [sv("path", { d: "M24 12 V60 H58" }), sv("path", { d: "M24 12 L34 22 M58 60 L48 50" })],
  () => [sv("path", { d: "M52 14 A28 28 0 1 0 52 66 A22 22 0 1 1 52 14 Z" }), sv("path", { d: "M58 36 l3 7 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" })],
];
let secret = null;
function openSecret() {
  closeSecret();
  endGlitch();
  const rot = [0, 0, 0];
  const canvas = h("canvas", { class: "secret-rain", "aria-hidden": "true" });
  const sigils = SIGILS.map((draw, i) => {
    const g = sv("g", { class: "sigil-shape" }, draw());
    const btn = h("button", { class: "sigil", type: "button", "aria-label": "Sigil " + (i + 1) + ", turned 0 degrees" },
      sv("svg", { viewBox: "0 0 80 80", width: 80, height: 80, "aria-hidden": "true" }, g));
    btn.addEventListener("click", () => {
      if (secret.solved) return;
      rot[i] = (rot[i] + 1) % 8;
      g.style.transform = "rotate(" + rot[i] * 45 + "deg)";
      btn.setAttribute("aria-label", "Sigil " + (i + 1) + ", turned " + rot[i] * 45 + " degrees");
      secretBeep(330 + i * 110 + rot[i] * 20);
      if (rot.every((r, k) => r === SECRET_SOLUTION[k])) solveSecret();
    });
    return btn;
  });
  const panel = h("div", { class: "secret-panel", role: "dialog", "aria-modal": "true", "aria-label": "Secret lock" },
    h("p", { class: "secret-title" }, h("span", { class: "hz" }, "访问"), " · ACCESS"),
    h("div", { class: "sigils" }, sigils),
    h("p", { class: "secret-hint" }, h("span", { class: "hz" }, "三 · 六 · 一")),
    h("button", { class: "secret-exit", type: "button", onclick: closeSecret }, "exit"));
  const layer = h("div", { class: "secret", id: "secret" }, canvas, panel);
  document.body.append(layer);
  secret = { layer, rain: codeRain(canvas, {}), solved: false, timers: [] };
  sigils[0].focus({ preventScroll: true });
}
function closeSecret() {
  if (!secret) return false;
  secret.rain.stop();
  secret.timers.forEach(clearTimeout);
  secret.layer.remove();
  document.body.classList.remove("secret-manic");
  secret = null;
  return true;
}
const later = (ms, fn) => secret.timers.push(setTimeout(fn, ms));

function solveSecret() {
  secret.solved = true;
  const { layer } = secret;
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  layer.classList.add("solved");
  // 1. manic glitch
  later(600, () => {
    secret.rain.stop();
    const red = h("canvas", { class: "secret-rain", "aria-hidden": "true" });
    layer.replaceChildren(red,
      h("div", { class: "secret-tears", "aria-hidden": "true" }, Array.from({ length: 9 }, (_, i) => { const t = h("i"); t.style.setProperty("--y", (5 + i * 11) + "%"); t.style.setProperty("--d", (i * 0.05) + "s"); return t; })),
      h("div", { class: "secret-errors", "aria-hidden": "true" }, ["错误 ERROR 0x汉字", "TONE CORE OVERFLOW", "声调 声调 声调 声调", "SEGFAULT IN 瀑布", "!!! 字 !!! 字 !!!"].map(t => h("p", null, t))));
    secret.rain = codeRain(red, { red: true, fast: true });
    layer.classList.add("manic");
    if (!calm) document.body.classList.add("secret-manic");
    secretNoise(2.4);
  });
  // 2. offline
  later(3200, () => {
    secret.rain.stop();
    document.body.classList.remove("secret-manic");
    layer.className = "secret offline";
    layer.replaceChildren(h("div", { class: "secret-center" },
      h("p", { class: "secret-big blink" }, "OFFLINE"), h("p", { class: "hz secret-mid" }, "离线"), h("p", { class: "secret-small" }, "signal lost · 信号丢失")));
  });
  // 3. reboot
  const lines = ["LEARNZÌ BIOS v1.0 (c) 汉字 Systems", "Memory check ............ 8,569 words OK", "Tone core ................ 1 2 3 4 OK",
    "Stroke engine ............ 9,574 characters OK", "Mounting water garden .... 瀑布 OK", "Waking avatar ............ 熊猫 OK", "", "Booting SPECIAL MODE …"];
  later(5200, () => {
    layer.className = "secret reboot";
    const term = h("div", { class: "secret-term", role: "log" });
    layer.replaceChildren(term);
    lines.forEach((t, i) => later(260 + i * 330, () => { term.append(h("p", null, t || " ")); secretBeep(880, 0.03); }));
  });
  // 4. special mode
  later(5200 + 260 + lines.length * 330 + 700, () => {
    layer.className = "secret special";
    layer.replaceChildren(h("div", { class: "secret-center special-card" },
      h("p", { class: "secret-small" }, "WELCOME TO"),
      h("p", { class: "secret-big" }, "SPECIAL MODE"),
      h("p", { class: "secret-mid" }, rubyHz("特殊模式", "te4 shu1 mo2 shi4")),
      h("p", { class: "secret-mid" }, "MLE MODE UNLOCKED"),
      h("p", { class: "secret-small" }, "Multicultural London English. Wagwan."),
      h("div", { class: "row special-btns" },
        h("button", { class: "btn primary", type: "button", onclick: () => { closeSecret(); enterMle(); toast("Wagwan! Welcome to MLE mode"); } }, "Enter MLE mode"),
        h("button", { class: "btn", type: "button", onclick: () => { closeSecret(); setMle({ unlocked: true }); go("debug"); toast("MLE mode is waiting in Debug settings"); } }, "Not now"))));
    if (state.sounds) synthSwell(0);
    const b = layer.querySelector(".btn"); if (b) b.focus({ preventScroll: true });
  });
}

// ---------- little sounds (made in the browser) ----------
function secretBeep(freq, len = 0.07) {
  if (!state.sounds) return;
  try {
    const ctx = audioCtxNow(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
    o.type = "square"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + len + 0.02);
  } catch { /* no sound here */ }
}
function secretNoise(seconds) {
  if (!state.sounds) return;
  try {
    const ctx = audioCtxNow(); if (!ctx) return;
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.floor(i / 2400) % 3 === 0 ? 0.9 : 0.15);
    const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
    g.gain.value = 0.08;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
  } catch { /* no sound here */ }
}
