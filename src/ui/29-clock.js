/* LearnZì UI, part 5a: the Home clock. Like the avatar, it has faces and effects that unlock with
 * levels and streaks. The date (and the 汉字 face) are written in Chinese with pinyin, a tiny lesson. */

const CLOCK = {
  face: {
    digital: { label: "Digital" },
    analogue: { label: "Analogue" },
    hanzi: { label: "汉字 words", lv: 3 },
    pixel: { label: "Pixel LED", lv: 4 },
    flip: { label: "Flip", lv: 6 },
    neon: { label: "Neon", lv: 8 },
    seal: { label: "Ink seal", quest: 3 },
  },
  fx: {
    none: { label: "None" },
    glow: { label: "Glow", lv: 2 },
    pulse: { label: "Heartbeat", lv: 5 },
    orbit: { label: "Comet", lv: 7 },
    rainbow: { label: "Rainbow", lv: 9 },
    sparkle: { label: "Sparkles", streak: 3 },
  },
};
const CLOCK_DEFAULT = { face: "digital", fx: "none", h24: true, secs: false, zhDate: true, layout: "side", show: "both" };
function sanitizeClock(raw) {
  const o = obj(raw), c = { ...CLOCK_DEFAULT };
  if (Object.hasOwn(CLOCK.face, o.face)) c.face = o.face;
  if (Object.hasOwn(CLOCK.fx, o.fx)) c.fx = o.fx;
  for (const k of ["h24", "secs", "zhDate"]) if (typeof o[k] === "boolean") c[k] = o[k];
  if (["stack", "side"].includes(o.layout)) c.layout = o.layout;
  if (["both", "time", "date"].includes(o.show)) c.show = o.show;
  return c;
}
/** What the clock shows: anything no longer unlocked falls back to the default. */
function wornClock() {
  const c = sanitizeClock(state.clock);
  if (!unlocked(CLOCK.face[c.face])) c.face = CLOCK_DEFAULT.face;
  if (!unlocked(CLOCK.fx[c.fx])) c.fx = "none";
  return c;
}
function setClock(patch) { commit({ clock: { ...sanitizeClock(state.clock), ...patch } }); render(false); }

// ---------- Chinese time and date, with numbered pinyin for the ruby above the characters ----------
const ZH_NUM_PY = { 零: "ling2", 一: "yi1", 二: "er4", 两: "liang3", 三: "san1", 四: "si4", 五: "wu3", 六: "liu4", 七: "qi1", 八: "ba1", 九: "jiu3", 十: "shi2" };
const zhPy = (text, extra) => [...text].map(ch => (extra && extra[ch]) || ZH_NUM_PY[ch] || "").join(" ");
function zhTime(d) {
  const h = d.getHours(), m = d.getMinutes();
  const part = h < 5 ? ["凌晨", "ling2 chen2"] : h < 11 ? ["上午", "shang4 wu3"] : h < 13 ? ["中午", "zhong1 wu3"] : h < 18 ? ["下午", "xia4 wu3"] : ["晚上", "wan3 shang5"];
  const h12 = h % 12 || 12;
  const hour = h12 === 2 ? "两" : zhNum(h12);            // 2 o'clock is 两点, not 二点
  const min = m === 0 ? "" : m < 10 ? "零" + zhNum(m) : zhNum(m);
  const text = hour + "点" + (min ? min + "分" : "整");
  return { part, text, py: zhPy(text, { 点: "dian3", 分: "fen1", 整: "zheng3" }) };
}
const ZH_WEEK = ["日", "一", "二", "三", "四", "五", "六"];
function zhDate(d) {
  const text = zhNum(d.getMonth() + 1) + "月" + zhNum(d.getDate()) + "日";
  const week = "星期" + ZH_WEEK[d.getDay()];
  return { text, py: zhPy(text, { 月: "yue4", 日: "ri4" }), week, weekPy: zhPy(week, { 星: "xing1", 期: "qi1", 日: "ri4" }) };
}
const pad2 = n => String(n).padStart(2, "0");

// ---------- faces: each returns an element and an update(date) function ----------
function sevenSeg(ch) {
  // Segments a–g for each digit, drawn as small blocks; dim ones show the "off" LEDs.
  const on = { 0: "abcdef", 1: "bc", 2: "abdeg", 3: "abcdg", 4: "bcfg", 5: "acdfg", 6: "acdefg", 7: "abc", 8: "abcdefg", 9: "abcdfg" }[ch] || "";
  const seg = { a: [2, 0, 8, 2], b: [10, 2, 2, 8], c: [10, 12, 2, 8], d: [2, 20, 8, 2], e: [0, 12, 2, 8], f: [0, 2, 2, 8], g: [2, 10, 8, 2] };
  return Object.entries(seg).map(([k, [x, y, w, hh]]) => sv("rect", { x, y, width: w, height: hh, class: on.includes(k) ? "led on" : "led" }));
}
const CLOCK_FACES = {
  digital(c) {
    const main = h("span", { class: "cl-hm num" }), sec = h("span", { class: "cl-sec num" }), ampm = h("span", { class: "cl-ampm" });
    const el = h("div", { class: "cl-digital" }, main, sec, ampm);
    return { el, update(d) {
      const hh = c.h24 ? pad2(d.getHours()) : String(d.getHours() % 12 || 12);
      main.textContent = hh + ":" + pad2(d.getMinutes());
      sec.textContent = c.secs ? pad2(d.getSeconds()) : "";
      ampm.textContent = c.h24 ? "" : d.getHours() < 12 ? "AM" : "PM";
    } };
  },
  analogue(c, neon) {
    const marks = [];
    for (let i = 1; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      marks.push(sv("text", { x: (50 + 37 * Math.sin(a)).toFixed(1), y: (50 - 37 * Math.cos(a) + 3.2).toFixed(1), "text-anchor": "middle", class: "cl-num" + (i % 3 ? " small" : "") }, document.createTextNode(zhNum(i))));
    }
    const hand = (cls, len, w) => sv("line", { x1: 50, y1: 50, x2: 50, y2: 50 - len, class: cls, "stroke-width": w, "stroke-linecap": "round" });
    const hr = hand("cl-hour", 20, 3.6), mi = hand("cl-min", 29, 2.4), se = hand("cl-secd", 32, 1);
    const svg = sv("svg", { viewBox: "0 0 100 100", class: "cl-analogue" + (neon ? " neon" : ""), "aria-hidden": "true" },
      sv("circle", { cx: 50, cy: 50, r: 47, class: "cl-rim" }), marks, hr, mi, c.secs ? se : null, sv("circle", { cx: 50, cy: 50, r: 2.6, class: "cl-pin" }));
    return { el: svg, update(d) {
      const s = d.getSeconds(), m = d.getMinutes() + s / 60, hh = (d.getHours() % 12) + m / 60;
      hr.setAttribute("transform", "rotate(" + (hh * 30).toFixed(2) + " 50 50)");
      mi.setAttribute("transform", "rotate(" + (m * 6).toFixed(2) + " 50 50)");
      se.setAttribute("transform", "rotate(" + s * 6 + " 50 50)");
    } };
  },
  neon(c) { return CLOCK_FACES.analogue(c, true); },
  seal(c) {   // Journey chapter 3: the time carved into a red seal, with 时 in the corner
    const main = h("span", { class: "cl-seal-time num" }), sec = h("span", { class: "cl-seal-sec num" });
    const el = h("div", { class: "cl-seal" }, h("span", { class: "cl-seal-zh hz", "aria-hidden": "true" }, "时"), main, sec);
    return { el, update(d) {
      main.textContent = (c.h24 ? pad2(d.getHours()) : String(d.getHours() % 12 || 12)) + ":" + pad2(d.getMinutes());
      sec.textContent = c.secs ? pad2(d.getSeconds()) : "";
    } };
  },
  hanzi(c) {
    const part = h("span", { class: "cl-part" }), main = h("span", { class: "cl-zh" }), sec = h("span", { class: "muted small num" });
    const el = h("div", { class: "cl-hanzi" }, part, main, sec);
    let last = "";
    return { el, update(d) {
      const t = zhTime(d);
      if (t.text + t.part[0] !== last) {
        last = t.text + t.part[0];
        part.replaceChildren(rubyHz(t.part[0], t.part[1]));
        main.replaceChildren(rubyHz(t.text, t.py));
      }
      sec.textContent = c.secs ? pad2(d.getSeconds()) + " 秒" : "";
    } };
  },
  pixel(c) {
    const svg = sv("svg", { class: "cl-pixel", "aria-hidden": "true" });
    return { el: svg, update(d) {
      const hh = c.h24 ? pad2(d.getHours()) : pad2(d.getHours() % 12 || 12);
      const txt = hh + ":" + pad2(d.getMinutes()) + (c.secs ? ":" + pad2(d.getSeconds()) : "");
      const kids = [];
      let x = 0;
      for (const ch of txt) {
        if (ch === ":") { kids.push(sv("rect", { x: x + 1, y: 6, width: 2, height: 2, class: "led on" + (d.getSeconds() % 2 ? "" : " blink") }), sv("rect", { x: x + 1, y: 14, width: 2, height: 2, class: "led on" + (d.getSeconds() % 2 ? "" : " blink") })); x += 5; continue; }
        kids.push(sv("g", { transform: "translate(" + x + " 0)" }, sevenSeg(ch)));
        x += 15;
      }
      svg.setAttribute("viewBox", "-1 -1 " + (x + 1) + " 24");
      svg.replaceChildren(...kids);
    } };
  },
  flip(c) {
    const el = h("div", { class: "cl-flip num" });
    let shown = "";
    return { el, update(d) {
      const hh = c.h24 ? pad2(d.getHours()) : pad2(d.getHours() % 12 || 12);
      const txt = hh + ":" + pad2(d.getMinutes()) + (c.secs ? ":" + pad2(d.getSeconds()) : "");
      if (txt.length !== shown.length) { el.replaceChildren(...[...txt].map(ch => ch === ":" ? h("span", { class: "flip-sep" }, ":") : h("span", { class: "flip-card" }, h("span", null, ch)))); shown = txt; return; }
      [...txt].forEach((ch, i) => {
        if (ch === shown[i] || ch === ":") return;
        const card = el.children[i];
        const inner = h("span", null, ch);
        card.replaceChildren(inner);
        card.classList.remove("flipping"); void card.offsetWidth; card.classList.add("flipping");
      });
      shown = txt;
    } };
  },
};

// ---------- one ticker keeps every clock on screen up to date ----------
const liveClocks = new Set();
let clockTimer = 0;
function tickClocks() {
  const d = new Date(clock());
  for (const lc of liveClocks) { if (!lc.el.isConnected) { liveClocks.delete(lc); continue; } lc.update(d); }
  if (!liveClocks.size) { clearInterval(clockTimer); clockTimer = 0; }
}
function clockFace(c) {
  const face = (CLOCK_FACES[c.face] || CLOCK_FACES.digital)(c);
  const box = h("div", { class: "clock-face face-" + c.face + " fx-" + c.fx, role: "timer", "aria-live": "off" }, face.el,
    c.fx === "orbit" ? h("span", { class: "cl-comet", "aria-hidden": "true" }) : null,
    c.fx === "sparkle" ? h("span", { class: "cl-sparks", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")) : null);
  const lc = { el: box, update: d => { face.update(d); box.setAttribute("aria-label", "Time " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: !c.h24 })); } };
  lc.update(new Date(clock()));
  liveClocks.add(lc);
  if (!clockTimer) clockTimer = setInterval(tickClocks, 1000);
  return box;
}
function dateLine(c) {
  const d = new Date(clock());
  const z = zhDate(d);
  return h("div", { class: "cl-date" },
    c.zhDate ? h("span", { class: "cl-zhdate" }, rubyHz(z.text, z.py), " ", rubyHz(z.week, z.weekPy)) : null,
    h("span", { class: "muted small" }, d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })));
}
/** Home: the clock box. */
function clockBox() {
  const c = wornClock();
  return h("div", { class: "card clock-card", "data-fold-id": "home-clock" },   // same box whether it shows the time, the date or both
    h("div", { class: "row spread" }, h("span", { class: "eyebrow" }, c.show === "date" ? "Date" : "Clock"),
      null),
    clockBody(c));
}
/** The face and the date, stacked or side by side, or just one of them. */
function clockBody(c) {
  return h("div", { class: "clock-body layout-" + c.layout + " show-" + c.show },
    c.show !== "date" ? clockFace(c) : null, c.show !== "time" ? dateLine(c) : null);
}

function switchCtl(id, on, change) {
  const inp = h("input", { type: "checkbox", id, role: "switch" });
  inp.checked = on;
  inp.addEventListener("change", () => change(inp.checked));
  return h("span", { class: "toggle" }, inp, h("span"));
}
/** Profile → Clock: faces, effects and options. */
/** Shrink each clock preview so the whole face fits its tile (wide faces like 汉字 words need more). */
function fitClockMinis() {
  for (const box of document.querySelectorAll(".clock-mini")) {
    const face = box.querySelector(".clock-face");
    if (!face || !box.clientWidth) continue;
    const s = Math.min(0.42, (box.clientWidth - 10) / face.offsetWidth, (box.clientHeight - 4) / face.offsetHeight);
    box.style.setProperty("--mini", String(Math.max(0.15, s)));
  }
}
function clockEditor(v) {
  const c = sanitizeClock(state.clock), worn = wornClock();
  v.append(h("div", { class: "card clock-card clock-preview" }, clockBody(worn)));
  for (const [key, title] of [["face", "Face"], ["fx", "Effect"]]) {
    const grid = h("div", { class: "av-grid clock-grid" });
    for (const [id, item] of Object.entries(CLOCK[key])) {
      const open = unlocked(item);
      const preview = { ...worn, [key]: id, secs: false };
      grid.append(h("button", { class: "av-tile clock-tile" + (keepSecret(item) ? " is-secret" : ""), type: "button", disabled: !open, "aria-pressed": String(c[key] === id),
        "aria-label": open ? item.label : secretLabel(item), onclick: () => setClock({ [key]: id }) },
        h("div", { class: "clock-mini" }, clockFace(preview)), h("b", { class: "small" }, secretName(item)),
        open ? null : h("span", { class: "lock small" }, icon("lock"), lockText(item))));
    }
    v.append(h("div", { class: "card stack" }, h("h2", { class: "h-card" }, title), grid));
  }
  const opt = (id, label, on, note) => h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("label", { for: id }, label), note ? h("span", { class: "muted small" }, note) : null),
    switchCtl(id, on, val => setClock({ [id.replace("clk-", "")]: val })));
  const pickSeg = (id, label, opts, val) => h("div", { class: "set-row" }, h("div", { class: "set-label" }, h("b", null, label)),
    h("div", { class: "seg", role: "group", "aria-label": label }, opts.map(([k, l]) =>
      h("button", { type: "button", "aria-pressed": String(val === k), onclick: () => setClock({ [id]: k }) }, l))));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Layout"),
    pickSeg("show", "Show", [["both", "Time and date"], ["time", "Time"], ["date", "Date"]], c.show),
    c.show === "both" ? pickSeg("layout", "Arrange", [["stack", "Stacked"], ["side", "Side by side"]], c.layout) : null,
    h("p", { class: "muted small" }, "To hide the clock altogether, remove its box on Home with the ×. The ↺ button in Home's header brings it back.")));
  v.append(h("div", { class: "card set" }, h("h2", { class: "h-card" }, "Options"),
    opt("clk-h24", "24-hour time", c.h24), opt("clk-secs", "Show seconds", c.secs),
    opt("clk-zhDate", "Date in Chinese", c.zhDate, "十月十二日 星期一, with pinyin")));
  v.append(h("p", { class: "muted small" }, "More faces and effects unlock as my Zì level grows."));
  requestAnimationFrame(fitClockMinis);
}
