/* LearnZì UI, part 1: themes, fonts and voice. */

const loadedFonts = new Set();
function loadFontCss(css) {
  if (!css || loadedFonts.has(css)) return;
  loadedFonts.add(css);
  document.head.append(h("link", { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=" + css + "&display=swap" }));
}
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? "#16110f" : "#ffffff";
}
const CUSTOM_VARS = ["--bg", "--surface", "--surface-2", "--ink", "--ink-soft", "--line", "--accent", "--accent-soft", "--accent-ink", "--shadow", "--t1", "--t2", "--t3", "--t4", "--t5"];
const DARK_TONES = ["#ff6b5f", "#f5a344", "#4cc477", "#6b9bff", "#9aa29c"];
function lum(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
/** The custom theme: four colours chosen by you, the rest worked out from them. */
function applyCustom(r) {
  const c = state.custom;
  const dark = lum(c.bg) < 0.2;
  const mix = (a, b, pct) => "color-mix(in srgb, " + a + " " + pct + "%, " + b + ")";
  const set = {
    "--bg": c.bg, "--surface": c.surface, "--ink": c.ink, "--accent": c.accent,
    "--surface-2": mix(c.ink, c.surface, 7), "--line": mix(c.ink, c.surface, 16), "--ink-soft": mix(c.ink, c.surface, 64),
    "--accent-soft": mix(c.accent, c.surface, 20), "--accent-ink": inkFor(c.accent),
    "--shadow": dark ? "0 1px 2px rgb(0 0 0 / .35), 0 8px 24px rgb(0 0 0 / .4)" : "0 1px 2px rgb(0 0 0 / .06), 0 8px 24px rgb(0 0 0 / .08)",
  };
  if (dark && state.tonePalette === "theme") DARK_TONES.forEach((t, i) => { set["--t" + (i + 1)] = t; });
  for (const [k, v] of Object.entries(set)) r.style.setProperty(k, v);
  r.style.colorScheme = dark ? "dark" : "light";
}
// ---------- light and dark ----------
const deviceDark = window.matchMedia("(prefers-color-scheme: dark)");
/** "light" or "dark" for a theme, following the Light or dark setting. */
function modeFor(key) {
  if (key === "custom") return state.custom && lum(state.custom.bg) < 0.2 ? "dark" : "light";
  const own = key === "ends" ? "dark" : (PRESETS[key] || PRESETS.ink).mode;
  const m = state.mode === "theme" ? own : state.mode;
  return m === "auto" ? (deviceDark.matches ? "dark" : "light") : m;
}
/** Whether a theme is showing its other look (its alt colours). */
function isAltMode(key) {
  const own = (PRESETS[key] || {}).mode;
  if (!own || own === "own") return false;
  return own === "auto" ? modeFor(key) === "dark" : modeFor(key) !== own;
}
deviceDark.addEventListener("change", () => { if (state.mode === "auto" || (state.mode === "theme" && state.preset === "ink")) { applyLook(); if (ui.view === "settings") render(false); } });

/** The theme to show: your choice, or Ink while that theme is still locked (Silver River before level 40, say). */
function usablePreset() {
  const b = BONUS_THEMES[state.preset];
  return b && !unlocked(b) ? "ink" : state.preset;
}
function applyLook() {
  const r = document.documentElement;
  const mle = state.mle && state.mle.on;
  const preset = usablePreset();
  if (mle) r.setAttribute("data-preset", "ends");
  else if (preset === "ink") r.removeAttribute("data-preset"); else r.setAttribute("data-preset", preset);
  r.classList.toggle("mle-mode", !!mle);
  r.setAttribute("data-mode", modeFor(mle ? "ends" : preset));
  CUSTOM_VARS.forEach(p => r.style.removeProperty(p));
  r.style.colorScheme = "";
  if (state.accent) {
    r.style.setProperty("--accent", state.accent);
    r.style.setProperty("--accent-soft", "color-mix(in srgb, " + state.accent + " 20%, var(--surface))");
    r.style.setProperty("--accent-ink", inkFor(state.accent));
  } else ["--accent", "--accent-soft", "--accent-ink"].forEach(p => r.style.removeProperty(p));
  r.style.setProperty("--font-hanzi", FONTS[state.font].stack);
  loadFontCss(FONTS[state.font].css);
  // The standard English font lets a theme bring its own (Retro Arcade, Cyberedge); any other choice wins.
  const uf = UIFONTS[state.uiFont];
  if (state.uiFont === "standard") ["--font-body", "--font-display"].forEach(p => r.style.removeProperty(p));
  else { r.style.setProperty("--font-body", uf.body); r.style.setProperty("--font-display", uf.display || uf.body); }
  loadFontCss(uf.css);
  r.style.setProperty("--scale", String(state.scale));
  const tones = state.tonePalette === "custom" ? state.toneColors : (TONE_PALETTES[state.tonePalette] || {}).colors;
  for (let i = 0; i < 5; i++) {
    if (tones) r.style.setProperty("--t" + (i + 1), tones[i]); else r.style.removeProperty("--t" + (i + 1));
  }
  if (state.preset === "custom" && state.custom && !mle) applyCustom(r);
  const base = mle ? "ends" : preset === "custom" && state.custom ? state.custom.base : preset;
  const shape = state.shapes ? base : "plain";
  r.setAttribute("data-shape", shape);
  if (state.uiFont === "standard") loadFontCss(THEME_FONTS[shape]);
  renderScene();
  if (typeof mleChrome === "function" && document.querySelector(".nav")) mleChrome();
  document.body.classList.toggle("no-pinyin", !state.pinyin);
  document.body.classList.toggle("no-tones", !state.tones);
}

// ---------- voice (the browser's own speech, Chinese voice) ----------
let zhVoice = null, voicesKnown = false;
function pickVoice() {
  if (!("speechSynthesis" in window)) return;
  const vs = speechSynthesis.getVoices();
  voicesKnown = vs.length > 0;
  zhVoice = vs.find(v => /^zh[-_]CN/i.test(v.lang)) || vs.find(v => /^(zh|cmn)/i.test(v.lang)) || null;
  const el = $("#voice-note");
  if (el) el.textContent = voiceNote();
}
function voiceNote() {
  if (!("speechSynthesis" in window)) return "This browser has no speech support.";
  if (zhVoice) return "Chinese voice: " + zhVoice.name;
  if (!voicesKnown) return "Checking for a Chinese voice…";
  return "No Chinese voice found. On Android: Settings → Text-to-speech → install Chinese (Mandarin).";
}
/** The browser's own Chinese voice (used for long sentences, or when recordings are off or missing). */
function speakTTS(text, rate) {
  if (!("speechSynthesis" in window)) { toast("This browser can't speak. Try Chrome."); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.slice(0, 3000));
  u.lang = "zh-CN";
  if (zhVoice) u.voice = zhVoice;
  u.rate = rate || state.rate;
  speechSynthesis.speak(u);
  if (voicesKnown && !zhVoice) toast("No Chinese voice on this device yet. See Settings → Voice.");
}
