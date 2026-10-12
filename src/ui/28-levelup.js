/* LearnZì UI, part 5: the level-up moment. A red seal stamps your new level (in Chinese) onto
 * the page with an ink splash, lanterns or neon depending on the theme, and a soft gong made
 * in the browser (no audio file). Calm version when the device asks for reduced motion. */

const ZH_DIGITS = "零一二三四五六七八九";
const ZH_PINYIN = { 零: "líng", 一: "yī", 二: "èr", 三: "sān", 四: "sì", 五: "wǔ", 六: "liù", 七: "qī", 八: "bā", 九: "jiǔ", 十: "shí", 百: "bǎi" };
/** 3 → 三, 12 → 十二, 23 → 二十三, 105 → 一百零五 */
function zhNum(n) {
  if (n < 10) return ZH_DIGITS[n];
  if (n < 20) return "十" + (n % 10 ? ZH_DIGITS[n % 10] : "");
  if (n < 100) return ZH_DIGITS[Math.floor(n / 10)] + "十" + (n % 10 ? ZH_DIGITS[n % 10] : "");
  if (n < 1000) {
    const rest = n % 100;
    const tail = rest === 0 ? "" : rest < 10 ? "零" + ZH_DIGITS[rest] : rest < 20 ? "一" + zhNum(rest) : zhNum(rest);
    return ZH_DIGITS[Math.floor(n / 100)] + "百" + tail;
  }
  return String(n);
}
const zhNumPinyin = zh => [...zh].map(c => ZH_PINYIN[c] || c).join(" ");

let audioCtx = null;
function gong(delay) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + (delay || 0);
    const master = audioCtx.createGain();
    master.gain.value = 0.2;
    master.connect(audioCtx.destination);
    // A few slightly out-of-tune partials that fade at different speeds sound like a small gong.
    for (const [ratio, amp, decay] of [[1, 1, 3.4], [1.48, 0.5, 2.5], [2.03, 0.32, 1.9], [2.74, 0.2, 1.3], [3.9, 0.1, 0.9]]) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(196 * ratio, t);
      o.frequency.exponentialRampToValueAtTime(196 * ratio * 0.985, t + decay);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(amp, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + decay + 0.1);
    }
  } catch { /* no sound available here: fine */ }
}

/** Retro Arcade: a quick square-wave fanfare, like an old game console. */
function chiptune(delay) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + (delay || 0);
    const notes = [[523, 0], [659, 0.09], [784, 0.18], [1047, 0.27], [784, 0.36], [1047, 0.45]];
    notes.forEach(([f, at], i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      const len = i === notes.length - 1 ? 0.45 : 0.085;
      o.type = "square";
      o.frequency.setValueAtTime(f, t0 + at);
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + at + 0.005);
      g.gain.setValueAtTime(0.06, t0 + at + len * 0.7);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + len);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(t0 + at); o.stop(t0 + at + len + 0.02);
    });
  } catch { /* no sound available here: fine */ }
}
/** Cyberedge: a synth chord that opens up as a filter sweeps upwards. */
function synthSwell(delay) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t = audioCtx.currentTime + (delay || 0);
    const lp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    lp.type = "lowpass"; lp.Q.value = 6;
    lp.frequency.setValueAtTime(180, t); lp.frequency.exponentialRampToValueAtTime(4200, t + 0.7); lp.frequency.exponentialRampToValueAtTime(600, t + 1.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    lp.connect(g); g.connect(audioCtx.destination);
    for (const f of [110, 110.8, 164.8, 220, 277.2]) {
      const o = audioCtx.createOscillator();
      o.type = "sawtooth"; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(t + 2.05);
    }
  } catch { /* no sound available here: fine */ }
}

/** Jade and Peach Blossom: a little wind chime on a five-note scale. */
function chime(delay) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + (delay || 0);
    [1047, 1319, 1175, 1568, 1760, 2093].forEach((f, i) => {
      const t = t0 + i * 0.12 + (i % 2) * 0.03;
      for (const [ratio, amp] of [[1, 0.07], [2.76, 0.015]]) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = "sine"; o.frequency.value = f * ratio;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
        o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 1.7);
      }
    });
  } catch { /* no sound available here: fine */ }
}

function levelEffects(kind) {
  const fx = [];
  const add = (cls, vars) => { const el = h("span", { class: cls }); for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v); fx.push(el); };
  if (kind === "lanterns") {
    for (let i = 0; i < 9; i++) add("lantern", { "--x": (6 + i * 11 + (i % 3) * 2) + "%", "--delay": (i * 0.12 + (i % 2) * 0.2) + "s", "--dur": (3.4 + (i % 4) * 0.5) + "s", "--r": ((i % 2 ? 1 : -1) * (4 + i)) + "deg", "--sz": (0.75 + (i % 3) * 0.2) });
  } else {
    // Ink blots spread out behind the seal (also used under neon, tinted by the theme).
    const spots = [[18, 22, 140], [74, 18, 110], [12, 70, 120], [80, 66, 160], [44, 84, 90], [56, 10, 70], [30, 45, 60], [88, 40, 54]];
    spots.forEach(([x, y, s], i) => add("blot", { "--x": x + "%", "--y": y + "%", "--s": s + "px", "--delay": (0.25 + i * 0.05) + "s" }));
  }
  for (let i = 0; i < 14; i++) add("lu-spark", { "--a": (i * (360 / 14)) + "deg", "--d": (90 + (i % 3) * 40) + "px", "--delay": (0.45 + (i % 4) * 0.03) + "s" });
  return fx;
}

function showLevelUp(level, from) {
  closeLevelUp();
  const zh = zhNum(level);
  const lv = levelNow();
  const newStuff = [];
  for (let l = (from || level - 1) + 1; l <= level; l++) newStuff.push(...unlocksAt(l));
  const shape = document.documentElement.getAttribute("data-shape");
  const base = shape && shape !== "plain" ? shape : state.preset;
  const kind = { arcade: "pixel", lantern: "lanterns", nightmarket: "neon", cyber: "neon", jade: "ripple", porcelain: "blue", peach: "petals", imperial: "gold" }[base] || "ink";
  const ov = h("div", { class: "levelup", id: "levelup", "data-fx": kind, role: "dialog", "aria-modal": "true", "aria-labelledby": "lu-title" },
    h("div", { class: "lu-fx", "aria-hidden": "true" }, levelEffects(kind)),
    h("div", { class: "lu-card" },
      h("div", { class: "lu-seal" + ([...zh].length > 2 ? " long" : ""), "aria-hidden": "true" },
        h("span", { class: "lu-num" }, zh), h("span", { class: "lu-ji" }, "级")),
      h("p", { class: "lu-py" }, zhNumPinyin(zh) + " jí"),
      h("h2", { id: "lu-title" }, h("span", { class: "hz" }, "升级"), " Level up!"),
      h("p", { class: "lu-sub" }, "You're now Zì level " + level + "."),
      h("p", { class: "muted small" }, (lv.need - lv.into) + " XP to level " + (level + 1)),
      newStuff.length ? h("div", { class: "lu-unlocks" }, h("span", { class: "eyebrow" }, "Unlocked"),
        h("div", { class: "row" }, newStuff.map(t => h("span", { class: "chip" }, t)))) : null,
      h("div", { class: "row lu-buttons" },
        newStuff.length ? h("button", { class: "btn", type: "button", onclick: () => { closeLevelUp(); go("me"); } }, "Try it on") : null,
        h("button", { class: "btn primary big-btn", type: "button", onclick: closeLevelUp }, "Continue"))));
  ov.addEventListener("click", ev => { if (ev.target === ov) closeLevelUp(); });
  document.body.append(ov);
  requestAnimationFrame(() => ov.classList.add("show"));
  const btn = ov.querySelector(".lu-card .btn.primary");
  if (btn) btn.focus({ preventScroll: true });
  if (state.sounds) (kind === "pixel" ? chiptune : kind === "neon" ? synthSwell : (kind === "ripple" || kind === "petals") ? chime : gong)(0.35);
}
function closeLevelUp() {
  const ov = $("#levelup");
  if (!ov) return false;
  ov.remove();
  return true;
}
