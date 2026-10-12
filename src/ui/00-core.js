/* LearnZì UI, part 0: helpers, settings data and saved state. MIT licence.
 * Security: every piece of text from the dictionary, the user, imported files or the sync store
 * goes into the page as a text node (textContent). There is no innerHTML anywhere in this app. */

const DICT_URL = "dict.txt";
const DICT_BYTES = Number("__DICT_BYTES__") || 9500000;
const LS_KEY = "learnzi.state.v1";
const READER_KEY = "learnzi.reader.v1";
const PROGRESS_KEY = "learnzi.progress.v1";
const READER_MAX = 75000; // characters; keeps the synced reader document under the store's size limit
const VIEWS = ["home", "lookup", "reader", "photo", "watch", "myzi", "decks", "deck", "stats", "study", "tones", "me", "settings", "debug"];
const DECK_ID = /^(starred|welcome|hsk[1-6]|u[0-9a-z]{4,24})$/;
const SAMPLE = "你好！我叫小明。我是学生，我在北京学习汉语。今天天气很好，我和朋友去公园喝茶。你喜欢喝茶吗？";
const BUILD = "Day 4 build · avatars";

// ---------- debug clock (Debug settings → Time). Kept on this device only. ----------
const CLOCK_KEY = "learnzi.debugclock.v1";
let clockShift = 0;
try { clockShift = Math.max(0, Math.min(3650 * 864e5, Number(localStorage.getItem(CLOCK_KEY)) || 0)); } catch { clockShift = 0; }
/** "Now" for flashcards, streaks and XP days: real time plus any debug skip. */
const clock = () => Date.now() + clockShift;

// ---------- DOM helpers ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const $ = (sel) => document.querySelector(sel);

const ICONS = {
  search: [["circle", { cx: 11, cy: 11, r: 7 }], ["path", { d: "M20 20l-3.6-3.6" }]],
  play: [["path", { d: "M7 5l12 7-12 7z", fill: "currentColor" }]],
  star: [["path", { d: "M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" }]],
  close: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
  back: [["path", { d: "M15 5l-7 7 7 7" }]],
  next: [["path", { d: "M9 5l7 7-7 7" }]],
  dice: [["rect", { x: 3.5, y: 3.5, width: 17, height: 17, rx: 4 }], ["circle", { cx: 8.5, cy: 8.5, r: 1.2, fill: "currentColor" }],
    ["circle", { cx: 15.5, cy: 15.5, r: 1.2, fill: "currentColor" }], ["circle", { cx: 12, cy: 12, r: 1.2, fill: "currentColor" }]],
  camera: [["path", { d: "M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" }], ["circle", { cx: 12, cy: 13, r: 3.6 }]],
  image: [["rect", { x: 3.5, y: 4.5, width: 17, height: 15, rx: 2 }], ["circle", { cx: 9, cy: 10, r: 1.6 }], ["path", { d: "M4 17l5-4.5 4 3.5 3-2.5 4.5 3.5" }]],
  rotate: [["path", { d: "M20 11a8 8 0 1 0-2.3 5.7" }], ["path", { d: "M20 4v7h-7" }]],
  lock: [["rect", { x: 5, y: 11, width: 14, height: 10, rx: 2 }], ["path", { d: "M8 11V8a4 4 0 0 1 8 0v3" }]],
  file: [["path", { d: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" }], ["path", { d: "M14 3v5h5M12 17v-6M9 14l3-3 3 3" }]],
  gear: [["path", { d: "M19.26 9.75L21.86 10.31L21.86 13.69L19.26 14.25L18.72 15.55L20.17 17.77L17.77 20.17L15.55 18.72L14.25 19.26L13.69 21.86L10.31 21.86L9.75 19.26L8.45 18.72L6.23 20.17L3.83 17.77L5.28 15.55L4.74 14.25L2.14 13.69L2.14 10.31L4.74 9.75L5.28 8.45L3.83 6.23L6.23 3.83L8.45 5.28L9.75 4.74L10.31 2.14L13.69 2.14L14.25 4.74L15.55 5.28L17.77 3.83L20.17 6.23L18.72 8.45Z" }], ["circle", { cx: 12, cy: 12, r: 3 }]],
};
function icon(name, filled) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of [["viewBox", "0 0 24 24"], ["width", "18"], ["height", "18"], ["aria-hidden", "true"], ["fill", filled ? "currentColor" : "none"],
    ["stroke", "currentColor"], ["stroke-width", "2"], ["stroke-linecap", "round"], ["stroke-linejoin", "round"]]) svg.setAttribute(k, v);
  for (const [tag, at] of ICONS[name] || []) {
    const s = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(at)) s.setAttribute(k, String(v));
    svg.append(s);
  }
  return svg;
}

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.remove("with-action");
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// ---------- settings data ----------
// mode: the theme's own look ("auto" = follows the device). alt: the colour dots of its other mode.
const PRESETS = {
  ink: { label: "Ink", note: "Brush and paper", mode: "auto", dots: ["#f6f7f4", "#c2362b", "#24894a", "#2a62c9"], alt: ["#121513", "#ef5a4c", "#4cc477", "#6b9bff"] },
  jade: { label: "Jade", note: "Polished stone", mode: "light", dots: ["#eef4f1", "#23735f", "#c8352b", "#2a5fc0"], alt: ["#0d1613", "#5cc4a4", "#ff6b5f", "#6b9bff"] },
  porcelain: { label: "Porcelain", note: "Blue and white", mode: "light", dots: ["#f4f6fb", "#1f45a8", "#c9302c", "#23874a"], alt: ["#0c111f", "#86a3ff", "#ff6f66", "#52c983"] },
  lantern: { label: "Lantern", note: "Warm glow", mode: "dark", dots: ["#1d1312", "#e9a945", "#ff7a66", "#82a8ff"], alt: ["#fbf3e7", "#a85a12", "#c8352b", "#2f5fc4"] },
  nightmarket: { label: "Night Market", note: "Neon signs", mode: "dark", dots: ["#0f1220", "#ff5c8a", "#5fe0a0", "#6fb2ff"], alt: ["#f6f4fb", "#d3205f", "#1d8a4f", "#2a5fc8"] },
  peach: { label: "Peach Blossom", note: "Unlocks at level 4", mode: "light", dots: ["#fbf1f1", "#c2456b", "#7a9a3a", "#3f6fb5"], alt: ["#1b1115", "#ff8db0", "#9ccc5a", "#7ea8ff"] },
  imperial: { label: "Imperial", note: "Unlocks at level 8", mode: "dark", dots: ["#1a0f0d", "#d9a93f", "#e05a4a", "#7fb0ff"], alt: ["#f8f0e0", "#946512", "#c0392b", "#2f5bb8"] },
  arcade: { label: "Retro Arcade", note: "Pixels", mode: "dark", dots: ["#07071a", "#ffd23f", "#ff4f64", "#3ef07a"], alt: ["#eceeff", "#c8155f", "#4040b8", "#12894a"] },
  cyber: { label: "Cyberedge", note: "Neon polygons", mode: "dark", dots: ["#05070d", "#00f0ff", "#ff2bd6", "#ffb000"], alt: ["#edf2f6", "#007f9e", "#c0168f", "#b07000"] },
  custom: { label: "Custom", note: "Your own colours", mode: "own", dots: [] },
};
const MODES = [["theme", "Theme's own"], ["light", "Light"], ["dark", "Dark"], ["auto", "Match device"]];
const BONUS_THEMES = { peach: { lv: 4 }, imperial: { lv: 8 } };
const SHAPE_BASES = ["ink", "jade", "porcelain", "lantern", "nightmarket", "arcade", "cyber"];
// Themes with their own English fonts (used unless you pick another English font in Settings).
const THEME_FONTS = {
  ink: "LXGW+WenKai+TC:wght@400;700",
  ends: "Permanent+Marker&family=Barlow:wght@400;500;600;700",
  jade: "Quicksand:wght@600;700",
  porcelain: "Cormorant+Garamond:ital,wght@1,600;1,700&family=Literata:opsz,wght@7..72,400;7..72,600;7..72,700",
  lantern: "Alegreya:wght@700;800&family=Alegreya+Sans:wght@400;500;700;800",
  nightmarket: "Monoton&family=Bungee",
  peach: "Fraunces:ital,wght@1,600;1,700",
  imperial: "Cinzel:wght@600;700&family=EB+Garamond:wght@400;500;600;700",
  arcade: "Press+Start+2P&family=Tiny5",
  cyber: "Orbitron:wght@600;800&family=Chakra+Petch:wght@400;600;700",
};
const HEX = /^#[0-9a-f]{6}$/i;
// Chinese fonts (characters only).
const FONTS = {
  sans: { label: "Sans", css: null, stack: '"Noto Sans SC", "Noto Sans TC", "PingFang SC", "Microsoft YaHei", sans-serif' },
  serif: { label: "Serif", css: "Noto+Serif+SC:wght@400;600&family=Noto+Serif+TC:wght@400;600", stack: '"Noto Serif SC", "Noto Serif TC", "Songti SC", SimSun, serif' },
  kai: { label: "Kai (handwritten)", css: "LXGW+WenKai+TC", stack: '"LXGW WenKai TC", KaiTi, STKaiti, serif' },
  brush: { label: "Brush", css: "Ma+Shan+Zheng", stack: '"Ma Shan Zheng", KaiTi, STKaiti, serif' },
  playful: { label: "Playful", css: "ZCOOL+KuaiLe", stack: '"ZCOOL KuaiLe", "Noto Sans SC", sans-serif' },
};
// Tone colour sets (tone 1, 2, 3, 4, neutral). "theme" uses the theme's own colours.
const TONE_PALETTES = {
  theme: { label: "Theme colours", colors: null },
  pleco: { label: "Classic (red, green, blue, purple)", colors: ["#e3322b", "#1e9e3e", "#2f63d8", "#8a3fc4", "#8a8f8b"] },
  cb: { label: "Colour-blind friendly", colors: ["#d55e00", "#009e73", "#0072b2", "#cc79a7", "#8a8f8b"] },
};
// English fonts (all other text: menus, buttons, headings, meanings).
const UIFONTS = {
  standard: { label: "Figtree + Bricolage (standard)", css: null,
    body: '"Figtree", system-ui, -apple-system, "Segoe UI", sans-serif', display: '"Bricolage Grotesque", "Figtree", system-ui, sans-serif' },
  nunito: { label: "Nunito (rounded)", css: "Nunito:wght@400;600;700;800", body: '"Nunito", system-ui, sans-serif' },
  lexend: { label: "Lexend (easy reading)", css: "Lexend:wght@400;600;700", body: '"Lexend", system-ui, sans-serif' },
  atkinson: { label: "Atkinson Hyperlegible", css: "Atkinson+Hyperlegible:wght@400;700", body: '"Atkinson Hyperlegible", system-ui, sans-serif' },
  lora: { label: "Lora (serif)", css: "Lora:wght@400;600;700", body: '"Lora", Georgia, serif' },
  system: { label: "Device default", css: null, body: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
};
// Recent updates, newest first (Debug settings → Updates).
const UPDATES = [
  ["12 Oct", "Watch: videos with tappable subtitles, side by side on a computer; flashcards that play the moment from the video"],
  ["12 Oct", "Photo to words: read Chinese in photos and screenshots on your device, then make a deck"],
  ["12 Oct", "Built-in samples to try Watch and Photo to words"],
  ["12 Oct", "Light and dark looks for every theme; calmer Ink boxes"],
  ["12 Oct", "Moving boxes shows a ghost and where the box will land"],
  ["12 Oct", "MLE mode behind the secret lock"],
  ["12 Oct", "Page headers; fold, move and remove any box; clock layouts"],
  ["12 Oct", "Desktop layout with sliding side bars"],
  ["12 Oct", "Tone trainer water garden; real-voice recordings"],
  ["12 Oct", "New tabs and menus, clock, sentence of the day"],
  ["11 Oct", "Themes with their own shapes, fonts and scenes; avatars; tone trainer"],
  ["11 Oct", "Flashcards, decks, levels, stroke order and word details"],
  ["11 Oct", "Dictionary, Reader, voice and the first themes"],
];

// ---------- saved state (validated whenever it comes from storage or sync) ----------
const DEFAULTS = {
  v: 2, nickname: "", script: "s", pinyin: true, tones: true, preset: "ink", accent: "", font: "sans", uiFont: "standard",
  scale: 1, rate: 0.9, voice: "real", newPerDay: 10, listen: true, autoplay: true, sounds: true, tonePalette: "theme", toneColors: [],
  zen: true, shapes: true, mode: "theme", subSize: "m", writing: false, strokeSpeed: 1, radical: true, details: {}, notes: {}, folds: {}, clock: {}, order: {}, hidden: {}, mle: null,
  saved: [], recent: [], decks: [], activeDecks: ["starred", "welcome"], updatedAt: 0,
};
const num = (v, lo, hi, d) => { v = Number(v); return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
const obj = raw => (raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {});
const cleanLine = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");

function sanitize(raw) {
  const o = obj(raw);
  const s = { ...DEFAULTS };
  s.nickname = cleanLine(o.nickname, 24);
  s.script = o.script === "t" ? "t" : "s";
  s.pinyin = o.pinyin !== false;
  s.tones = o.tones !== false;
  s.preset = Object.hasOwn(PRESETS, o.preset) ? o.preset : "ink";
  s.accent = typeof o.accent === "string" && /^#[0-9a-f]{6}$/i.test(o.accent) ? o.accent.toLowerCase() : "";
  s.font = Object.hasOwn(FONTS, o.font) ? o.font : "sans";
  s.uiFont = Object.hasOwn(UIFONTS, o.uiFont) ? o.uiFont : "standard";
  s.scale = num(o.scale, 0.85, 1.3, 1);
  s.rate = num(o.rate, 0.5, 1.3, 0.9);
  s.newPerDay = [5, 10, 15, 20, 30].includes(o.newPerDay) ? o.newPerDay : 10;
  s.listen = o.listen !== false;
  s.autoplay = o.autoplay !== false;
  s.sounds = o.sounds !== false;
  s.tonePalette = Object.hasOwn(TONE_PALETTES, o.tonePalette) || o.tonePalette === "custom" ? o.tonePalette : "theme";
  s.toneColors = Array.isArray(o.toneColors) && o.toneColors.length === 5 && o.toneColors.every(c => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))
    ? o.toneColors.map(c => c.toLowerCase()) : [];
  if (s.tonePalette === "custom" && !s.toneColors.length) s.tonePalette = "theme";
  s.saved = Array.isArray(o.saved)
    ? o.saved.filter(x => x && typeof x.s === "string" && typeof x.p === "string").slice(0, 3000)
      .map(x => ({ s: x.s.slice(0, 32), p: x.p.slice(0, 120), at: num(x.at, 0, 1e13, 0) }))
    : [];
  s.recent = Array.isArray(o.recent) ? o.recent.filter(x => typeof x === "string").slice(0, 16).map(x => x.slice(0, 32)) : [];
  const c = obj(o.custom);
  s.custom = ["bg", "surface", "ink", "accent"].every(k => typeof c[k] === "string" && HEX.test(c[k]))
    ? { bg: c.bg.toLowerCase(), surface: c.surface.toLowerCase(), ink: c.ink.toLowerCase(), accent: c.accent.toLowerCase(), base: SHAPE_BASES.includes(c.base) ? c.base : "ink" }
    : null;
  if (s.preset === "custom" && !s.custom) s.preset = "ink";
  // Avatar choices (checked against the unlock list when shown).
  const av = obj(o.avatar);
  s.avatar = {};
  for (const k of ["animal", "expr", "eyes", "aura"]) if (typeof av[k] === "string" && /^[a-z]{1,16}$/.test(av[k])) s.avatar[k] = av[k];
  const accs = Array.isArray(av.accs) ? av.accs : typeof av.acc === "string" ? [av.acc] : [];
  s.avatar.accs = [...new Set(accs.filter(x => typeof x === "string" && /^[a-z]{1,16}$/.test(x) && x !== "none"))].slice(0, 8);
  // Blush is on unless you turned it off after it became the default (avatar version 2).
  s.avatar.blush = av.v === 2 ? av.blush !== false : true;
  s.avatar.sparkles = av.sparkles === true;
  s.avatar.style = ["auto", "cute", "pixel", "neon", "ink"].includes(av.style) ? av.style : "auto";
  s.avatar.v = 2;
  s.zen = o.zen !== false;
  s.mode = MODES.some(m => m[0] === o.mode) ? o.mode : "theme";
  s.subSize = ["s", "m", "l", "xl"].includes(o.subSize) ? o.subSize : "m";
  s.shapes = o.shapes !== false;
  s.writing = o.writing === true;
  s.strokeSpeed = [0.5, 1, 2].includes(o.strokeSpeed) ? o.strokeSpeed : 1;
  s.radical = o.radical !== false;
  s.details = {};
  for (const k of ["tips", "write", "story", "words", "freq", "examples", "notes"]) if (obj(o.details)[k] === false) s.details[k] = false;
  s.voice = o.voice === "browser" ? "browser" : "real";
  s.unlockAll = o.unlockAll === true;
  // MLE mode (the secret): on/off, unlocked, rude words, its own flashcards, quiz XP and daily counts.
  const m = obj(o.mle), mc = {}, ma = {};
  for (const [k, a] of Object.entries(obj(m.cards)).slice(0, 600)) {
    if (/^[a-z0-9-]{1,40}\|[mr]$/.test(k) && Array.isArray(a) && a.length === 9 && a.every(n => typeof n === "number" && Number.isFinite(n))) mc[k] = a;
  }
  for (const [k, a] of Object.entries(obj(m.act)).slice(-60)) if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(a)) ma[k] = [0, 1].map(i => Math.floor(num(a[i], 0, 1e5, 0)));
  s.mle = { on: m.on === true, unlocked: m.unlocked === true, rude: m.rude === true, cards: mc, quizXp: Math.floor(num(m.quizXp, 0, 1e8, 0)), act: ma };
  s.toneSource = ["word", "syllables", "browser"].includes(o.toneSource) ? o.toneSource : "";
  // The Home clock (checked in full when drawn, see 29-clock).
  s.clock = {};
  for (const [k, v] of Object.entries(obj(o.clock))) {
    if (["face", "fx", "layout", "show"].includes(k) && typeof v === "string" && /^[a-z]{1,16}$/.test(v)) s.clock[k] = v;
    else if (["h24", "secs", "zhDate"].includes(k) && typeof v === "boolean") s.clock[k] = v;
  }
  // The order you arranged boxes in, by page: { home: ["home-clock", ...] }.
  s.order = {};
  for (const [k, v] of Object.entries(obj(o.order)).slice(0, 30)) {
    if (/^[a-z]{1,16}$/.test(k) && Array.isArray(v)) s.order[k] = v.filter(x => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 40);
  }
  // Boxes you removed, by page: { home: ["home-greeting", ...] }.
  s.hidden = {};
  for (const [k, v] of Object.entries(obj(o.hidden)).slice(0, 30)) {
    if (/^[a-z]{1,16}$/.test(k) && Array.isArray(v)) s.hidden[k] = v.filter(x => typeof x === "string" && /^[a-z0-9-]{1,40}$/.test(x)).slice(0, 40);
  }
  // Boxes you folded away (1) or opened (0), by box name.
  s.folds = {};
  for (const [k, v] of Object.entries(obj(o.folds)).slice(0, 120)) if (/^[a-z0-9-]{1,40}$/.test(k) && (v === 0 || v === 1)) s.folds[k] = v;
  s.notes = {};
  for (const [k, v] of Object.entries(obj(o.notes)).slice(0, 300)) {
    if (/^[^|]{1,32}\|[^|]{1,120}$/.test(k) && typeof v === "string" && v.trim()) s.notes[k] = v.slice(0, 300);
  }
  // Your own decks (at most 50 decks and 6,000 words in all, to keep the synced document small).
  let room = 6000;
  let clipRoom = 120000;   // keeps the synced settings small: about 1,000 video moments
  s.decks = Array.isArray(o.decks)
    ? o.decks.filter(d => d && typeof d.id === "string" && /^u[0-9a-z]{4,24}$/.test(d.id)).slice(0, 50).map(d => {
      // A deck made in Watch remembers its videos (name and size, to find the file again) and, per word,
      // the moment it's said: v = [start, end, which video], x = the line (shown as plain text).
      const videos = Array.isArray(d.videos) ? d.videos.filter(x => x && typeof x.name === "string").slice(0, 20)
        .map(x => ({ name: cleanLine(x.name, 120), size: Math.floor(num(x.size, 0, 1e13, 0)) })) : [];
      const words = Array.isArray(d.words) ? d.words.filter(w => w && typeof w.s === "string" && typeof w.p === "string").slice(0, Math.max(0, room))
        .map(w => {
          const out = { s: w.s.slice(0, 32), p: w.p.slice(0, 120) };
          if (Array.isArray(w.v) && w.v.length === 3 && clipRoom > 0 && Number.isInteger(w.v[2]) && w.v[2] >= 0 && w.v[2] < videos.length) {
            const st = num(w.v[0], 0, 86400, 0), en = num(w.v[1], 0, 86400, 0);
            if (en > st) { out.v = [Math.round(st * 100) / 100, Math.round(en * 100) / 100, w.v[2]]; out.x = cleanLine(w.x, 80); clipRoom -= 20 + out.x.length; }
          }
          return out;
        }) : [];
      room -= words.length;
      const deck = { id: d.id, name: cleanLine(d.name, 40) || "Deck", words, at: num(d.at, 0, 1e13, 0) };
      if (videos.length) deck.videos = videos;
      return deck;
    })
    : [];
  s.activeDecks = Array.isArray(o.activeDecks)
    ? [...new Set(o.activeDecks.filter(x => typeof x === "string" && DECK_ID.test(x)))].slice(0, 60)
    : ["starred", "welcome"];
  s.updatedAt = num(o.updatedAt, 0, 1e13, 0);
  return s;
}
function sanitizeReader(raw) {
  const o = obj(raw);
  return {
    text: typeof o.text === "string" ? o.text.slice(0, READER_MAX) : "",
    title: cleanLine(o.title, 120),
    page: Math.floor(num(o.page, 0, 100000, 0)),
    updatedAt: num(o.updatedAt, 0, 1e13, 0),
  };
}
// Study progress: one compact array per card (see srs.js) plus daily activity
// act["YYYY-MM-DD"] = [bonus XP from lookups and new words, cards reviewed, new cards started, cards forgotten (Again), tone trainer XP,
//   XP from watching videos].
const CARD_KEY = /^[^|]{1,32}\|[^|]{1,120}\|[mlrw]$/;
function sanitizeProgress(raw) {
  const o = obj(raw), src = obj(o.cards), srcAct = obj(o.act);
  const cards = {}, act = {};
  for (const k of Object.keys(src).sort().slice(0, 6000)) {
    const a = src[k];
    if (!CARD_KEY.test(k) || !Array.isArray(a) || a.length !== 9 || !a.every(n => typeof n === "number" && Number.isFinite(n))) continue;
    cards[k] = [num(a[0], 0.01, 36500, 1), num(a[1], 1, 10, 5), Math.floor(num(a[2], 0, 1e9, 0)), Math.floor(num(a[3], 0, 1e9, 0)),
      Math.floor(num(a[4], 0, 1e6, 0)), Math.floor(num(a[5], 0, 1e6, 0)), Math.floor(num(a[6], 0, 1e8, 0)), [1, 2, 3].includes(a[7]) ? a[7] : 2,
      Math.floor(num(a[8], 0, 10, 0))];
  }
  for (const k of Object.keys(srcAct).sort().slice(-1000)) {
    const a = srcAct[k];
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && Array.isArray(a)) act[k] = [0, 1, 2, 3, 4, 5].map(i => Math.floor(num(a[i], 0, 1e6, 0)));
  }
  // XP adjustment from Debug settings: [when it was set, XP added or removed]. Latest one wins.
  const adj = Array.isArray(o.adj) && o.adj.length === 2 ? [num(o.adj[0], 0, 1e13, 0), Math.round(num(o.adj[1], -1e9, 1e9, 0))] : [0, 0];
  // The tone trainer's water garden: [growth points, correct tones], counted over your whole lifetime.
  const garden = Array.isArray(o.garden) ? [0, 1].map(i => Math.floor(num(o.garden[i], 0, 1e7, 0))) : [0, 0];
  // epoch: when progress was last reset from Debug settings; older reviews never come back after it.
  return { cards, act, adj, garden, epoch: num(o.epoch, 0, 1e13, 0), updatedAt: num(o.updatedAt, 0, 1e13, 0) };
}
/** Combine two copies card by card (the most recent review of each card wins), so studying on
 *  two devices never loses a review. Daily counts keep the larger value. */
function mergeProgress(a, b) {
  if (a.epoch !== b.epoch) { // one copy was reset: keep only what happened after the newer reset
    let [newer, older] = a.epoch > b.epoch ? [a, b] : [b, a];
    const keep = {};
    for (const [k, c] of Object.entries(older.cards)) if (c[3] * 60000 >= newer.epoch) keep[k] = c;
    older = { ...older, cards: keep, act: {}, garden: [0, 0], epoch: newer.epoch };
    [a, b] = a.epoch > b.epoch ? [newer, older] : [older, newer];
  }
  const cards = { ...a.cards };
  for (const [k, c] of Object.entries(b.cards)) {
    const mine = cards[k];
    if (!mine || c[3] > mine[3] || (c[3] === mine[3] && c[4] > mine[4])) cards[k] = c;
  }
  const act = { ...a.act };
  for (const [k, v] of Object.entries(b.act)) act[k] = act[k] ? [0, 1, 2, 3, 4, 5].map(i => Math.max(act[k][i] || 0, v[i] || 0)) : v;
  const adj = b.adj[0] > a.adj[0] ? b.adj : a.adj;
  const garden = [0, 1].map(i => Math.max((a.garden || [0, 0])[i], (b.garden || [0, 0])[i]));
  return sanitizeProgress({ cards, act, adj, garden, epoch: Math.max(a.epoch, b.epoch), updatedAt: Math.max(a.updatedAt, b.updatedAt) });
}
const progressSig = p => JSON.stringify([Object.entries(p.cards).sort(), Object.entries(p.act).sort(), p.adj, p.garden, p.epoch]);

function readJSON(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage blocked or full: fine */ } }

let state = sanitize(readJSON(LS_KEY));
let reader = sanitizeReader(readJSON(READER_KEY));
let progress = sanitizeProgress(readJSON(PROGRESS_KEY));
// Day 1 kept reader text inside the settings document; move it to its own document once.
migrateReaderText(readJSON(LS_KEY));
function migrateReaderText(raw) {
  const old = obj(raw).readerText;
  if (typeof old === "string" && old && !reader.text) {
    reader = sanitizeReader({ text: old, updatedAt: Date.now() });
    writeJSON(READER_KEY, reader);
    return true;
  }
  return false;
}

function commit(patch) {
  Object.assign(state, patch);
  state.updatedAt = Date.now();
  writeJSON(LS_KEY, state);
  Sync.queue("state");
  updateTopbar();
}
function commitProgress() {
  progress.updatedAt = Date.now();
  writeJSON(PROGRESS_KEY, progress);
  Sync.queue("progress");
  updateTopbar();
}
function commitReader(patch) {
  Object.assign(reader, patch);
  reader.updatedAt = Date.now();
  writeJSON(READER_KEY, reader);
  Sync.queue("reader");
}
