/* LearnZì UI, part 1e: real voices. Recordings of native speakers from audio-cmn (CC BY-SA):
 * HSK words by Yue Tan, every syllable in every tone by Chen Wang. Listen plays, in order of preference:
 *   1. the recording of the whole word,
 *   2. the word built from recorded syllables (a little choppy, but every tone is real),
 *   3. the browser's voice (used straight away for long sentences when the device has a Chinese voice).
 * Files are packed by tools/build_audio.py and loaded a piece at a time, only when needed. */

const AUDIO = {
  index: null,               // Promise of Map "w|key" or "s|key" → [file, offset, length]
  files: new Map(),          // "w07" → Promise<ArrayBuffer>
  decoded: new Map(),        // "w|你好" → Promise<AudioBuffer>
  playing: [],
  NW: 48, NS: 8,
};
/** Where each recording sits in the packed audio files: "w|word" or "s|syllable" → [file, start, length]. */
function audioIndex() {
  if (!AUDIO.index) {
    AUDIO.index = fetchPackedText("audio/index.txt").catch(() => { AUDIO.index = null; return ""; }).then(t => {
      const m = new Map();
      for (const line of t.split("\n")) {
        const c = line.split("\t");
        if (c.length === 5 && (c[0] === "w" || c[0] === "s")) m.set(c[0] + "|" + c[1], [+c[2], +c[3], +c[4]]);
      }
      return m;
    }).catch(() => new Map());
  }
  return AUDIO.index;
}
function audioCtxNow() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = audioCtx || new AC();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
/** One recording, decoded, trimmed and levelled (tidySamples in 16b-dsp). */
async function recording(kind, key) {
  const id = kind + "|" + key;
  if (AUDIO.decoded.has(id)) return AUDIO.decoded.get(id);
  const job = (async () => {
    const idx = await audioIndex();
    const at = idx.get(id);
    if (!at) return null;
    const fname = kind + String(at[0]).padStart(2, "0");
    if (!AUDIO.files.has(fname)) AUDIO.files.set(fname, fetch("audio/" + fname + ".mp3").then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
    const buf = await AUDIO.files.get(fname);
    if (!buf) { AUDIO.files.delete(fname); return null; }
    const ctx = audioCtxNow();
    if (!ctx) return null;
    const audio = await ctx.decodeAudioData(buf.slice(at[1], at[1] + at[2]));
    const d = tidySamples(audio.getChannelData(0), audio.sampleRate);
    const out = ctx.createBuffer(1, d.length, audio.sampleRate);
    out.getChannelData(0).set(d);
    return out;
  })().catch(() => null);
  AUDIO.decoded.set(id, job);
  const res = await job;
  if (!res) AUDIO.decoded.delete(id);
  return res;
}
/** Stop what's playing with a quick fade (a hard stop clicks). */
function stopRecordings() {
  const ctx = audioCtx;
  for (const { src, g } of AUDIO.playing) {
    try {
      if (ctx) { const t = ctx.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.03); src.stop(t + 0.035); }
      else src.stop();
    } catch { /* already finished */ }
  }
  AUDIO.playing = [];
}
const slowCache = new WeakMap();
/** The same recording 25% slower at the same pitch (made once, then kept). */
function slowed(ctx, buf) {
  if (!slowCache.has(buf)) {
    const d = stretchSamples(buf.getChannelData(0), buf.sampleRate, 1.25);
    const out = ctx.createBuffer(1, d.length, buf.sampleRate);
    out.getChannelData(0).set(d);
    slowCache.set(buf, out);
  }
  return slowCache.get(buf);
}
/** Plays buffers one after another, overlapping each join a little so syllables run together.
 *  Slow plays them 25% slower without changing the pitch, so the tones stay true. */
function playBuffers(list, slow) {
  const ctx = audioCtxNow();
  stopRecordings();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  let t = ctx.currentTime + 0.04;
  list.forEach(({ buf, gain }, i) => {
    const b = slow ? slowed(ctx, buf) : buf;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = b;
    g.gain.value = gain || 1;
    src.connect(g); g.connect(ctx.destination);
    src.start(t);
    AUDIO.playing.push({ src, g });
    // Each recording now keeps ~40 ms of natural fade at the end, so joins overlap by that much more.
    t += i < list.length - 1 ? Math.max(0.12, b.duration - (slow ? 0.06 : 0.1)) : b.duration;
  });
}

// ---------- which syllables a word is made of ----------
/** Numbered pinyin → recording keys, with the everyday tone changes: 3+3 → 2+3, 不 before 4th → bú, 一 → yí / yì. */
function syllableKeys(p, form) {
  const sy = p.toLowerCase().replace(/u:|ü/g, "v").split(/[\s·,]+/).filter(x => /^[a-z]+[1-5]$/.test(x) && !/^r[1-5]$/.test(x));
  const chars = [...(form || "")];
  const tones = sy.map(x => +x.slice(-1));
  for (let i = 0; i < sy.length - 1; i++) {
    const next = tones[i + 1];
    if (tones[i] === 3 && next === 3) tones[i] = 2;
    else if (sy[i] === "bu4" && chars[i] === "不" && next === 4) tones[i] = 2;
    else if (sy[i] === "yi1" && chars[i] === "一" && next >= 1 && next <= 4) tones[i] = next === 4 ? 2 : 4;
  }
  return sy.map((x, i) => ({ key: x.slice(0, -1) + (tones[i] === 5 ? 1 : tones[i]), neutral: tones[i] === 5 }));
}
/** The pinyin for a piece of text: the given reading, or the dictionary's best guess word by word. */
function pinyinFor(text, p) {
  if (p) return [{ p, form: text }];
  if (ui.dict !== "ready") return [];
  return Engine.segment(text).filter(sg => sg.entries && sg.entries.length).map(sg => ({ p: sg.entries[0].p, form: sg.text }));
}

// ---------- the three sources, and choosing between them ----------
const VOICE_SOURCES = {
  word: { label: "Recording", who: "Yue Tan, native speaker" },
  syllables: { label: "Built from syllables", who: "Chen Wang, native speaker" },
  browser: { label: "Browser voice", who: "Your device's speech" },
};
const hasTTS = () => "speechSynthesis" in window;
/** Plays one source. Resolves true if it played. */
async function playSource(src, clean, p, slow) {
  if (src === "browser") {
    if (!hasTTS()) return false;
    stopRecordings();
    speakTTS(clean, slow ? Math.max(0.5, state.rate * 0.65) : 0);
    return true;
  }
  if (src === "word") {
    const simp = wordRecKey(clean, p);
    if (!simp) return false;
    const whole = await recording("w", simp);
    if (!whole) return false;
    playBuffers([{ buf: whole }], slow);
    return true;
  }
  const parts = pinyinFor(clean, p);
  const keys = parts.flatMap(x => syllableKeys(x.p, x.form));
  if (!keys.length) return false;
  const bufs = await Promise.all(keys.map(k => recording("s", k.key)));
  if (bufs.some(b => !b)) return false;
  playBuffers(bufs.map((buf, i) => ({ buf, gain: keys[i].neutral ? 0.7 : 1 })), slow);
  return true;
}
/** The order to try sources in: your chosen voice first (Settings → Voice, or the voice button next
 *  to any Listen button), then the rest. Automatic: whole-word recording, then syllables, then the
 *  browser; long sentences go to the browser's voice first when the device has a Chinese one. */
function sourceOrder(n) {
  const base = n > 6 && zhVoice ? ["browser", "word", "syllables"] : ["word", "syllables", "browser"];
  const pick = state.voiceSrc;
  return pick && pick !== "auto" ? [pick, ...base.filter(x => x !== pick)] : base;
}

let speakSeq = 0;
/** Say Chinese text. p (numbered pinyin) picks the reading of a word with more than one.
 *  opts.source starts with a particular source (the voice button beside Listen, or the tone trainer's). */
function speak(text, p, opts = {}) {
  if (!text) return Promise.resolve(null);
  const clean = text.replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, "") || text;
  const seq = ++speakSeq;
  audioCtxNow();   // unlock sound now, while we're still inside the tap
  const order = sourceOrder([...clean].length);
  const tries = opts.source ? [opts.source, ...order.filter(x => x !== opts.source)] : order;
  const slowNote = setTimeout(() => { if (seq === speakSeq) toast("Loading the recording…"); }, 900);
  // Resolves to the source that played (or null), so callers can show it.
  return (async () => {
    for (const src of tries) {
      if (seq !== speakSeq) return null;      // a newer Listen tap won
      if (await playSource(src, clean, p, opts.slow)) {
        clearTimeout(slowNote);
        if (seq === speakSeq) syncVoiceBtns(clean, src);
        return src;
      }
    }
    clearTimeout(slowNote);
    if (seq === speakSeq) toast(hasTTS() ? "No recording for this, and the browser voice didn't start." : "No recording for this, and this app can't use the browser voice.");
    return null;
  })();
}
/** The key of a whole-word recording that's safe to play for this text, or null. Single characters
 *  only when the dictionary knows one reading for them: a character like 行 (háng or xíng) could be
 *  recorded in the other reading, so it uses the syllable recording of the exact pinyin instead. */
function wordRecKey(clean, p) {
  const chars = [...clean];
  if (chars.length > 1) return ui.dict === "ready" && !p ? (Engine.lookup(clean)[0] || {}).s || clean : clean;
  if (chars.length !== 1 || ui.dict !== "ready") return null;
  const list = Engine.lookup(clean);
  const readings = new Set(list.map(e => e.p.toLowerCase()));
  if (readings.size !== 1 || (p && !readings.has(p.toLowerCase()))) return null;
  return list[0].s || clean;
}
/** Every source that can say this text: whole-word recording, syllables, browser voice. */
async function sourcesFor(text, p) {
  const clean = text.replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, "") || text;
  const idx = await audioIndex(), out = [];
  const simp = wordRecKey(clean, p);
  if (simp && idx.has("w|" + simp)) out.push("word");
  const keys = pinyinFor(clean, p).flatMap(x => syllableKeys(x.p, x.form));
  if (keys.length && keys.every(k => idx.has("s|" + k.key))) out.push("syllables");
  if (hasTTS()) out.push("browser");
  return out;
}

// ---------- the voice button: a speaker beside each Listen button; tap it to hear the next voice ----------
const VOICE_SHORT = { word: "Recording", syllables: "Syllables", browser: "Browser" };
const zhOnly = text => text.replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, "") || text;
/** A speaker that shows which voice speaks: smooth waves for a person's whole-word recording,
 *  dotted waves for a word built from recorded syllables, a zigzag for the device's own voice. */
function voiceIcon(src) {
  const line = { fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" };
  const cone = sv("path", { d: "M3.5 9.2h3.6L12 5.2v13.6l-4.9-4H3.5z", fill: "currentColor" });
  const waves = src === "syllables"
    ? [[15.6, 9.4], [16.4, 12], [15.6, 14.6], [18.6, 7.4], [20.2, 12], [18.6, 16.6]].map(([cx, cy], i) => sv("circle", { cx, cy, r: i < 3 ? 1.4 : 1.5, fill: "currentColor" }))
    : src === "browser"
      ? [sv("path", Object.assign({ d: "M14.5 12h1.6l1.3-3.6 2.2 7.2 1.3-3.6h1.6" }, line))]
      : [sv("path", Object.assign({ d: "M15.5 8.6a4.6 4.6 0 0 1 0 6.8" }, line)), sv("path", Object.assign({ d: "M18.3 5.8a8.6 8.6 0 0 1 0 12.4" }, line))];
  return sv("svg", { class: "voice-ico vi-" + (src || "none"), viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true" }, cone, waves);
}
/** Which voice will speak this text: your pick if it can, else the next one that can. */
async function firstVoice(text, p, pickKey) {
  const avail = await sourcesFor(text, p);
  const pick = pickKey === "voiceSrc" ? null : state[pickKey];
  return [pick, ...sourceOrder([...text].length)].find(x => x && avail.includes(x)) || avail[0] || null;
}
function drawVoice(b, src, turn) {
  b.dataset.src = src || "";
  const name = src ? VOICE_SHORT[src] : "Voice";
  const label = src ? "Voice: " + VOICE_SOURCES[src].label + " (" + VOICE_SOURCES[src].who + "). Tap to hear the next voice" : "Voice";
  b.setAttribute("aria-label", label);
  b.title = label;
  b.replaceChildren(...[voiceIcon(src), b.classList.contains("icon") ? null : h("span", { class: "voice-name" }, name)].filter(Boolean));
  if (turn) { b.classList.remove("turn"); void b.offsetWidth; b.classList.add("turn"); }
}
/** opts: { text (string or function), p, slow, compact, pickKey ("voiceSrc", or "toneSource" for the
 *  tone trainer's own choice), play(src) to play it some other way }. */
function voiceBtn(opts) {
  const pickKey = opts.pickKey || "voiceSrc";
  const textNow = () => zhOnly(typeof opts.text === "function" ? opts.text() : opts.text || "");
  const b = h("button", { class: "btn voice-src " + (opts.compact ? "icon" : "small"), type: "button", "data-pick": pickKey });
  b.dataset.vtext = textNow();
  drawVoice(b, null);
  const show = () => { const t = textNow(); b.dataset.vtext = t; if (t) firstVoice(t, opts.p, pickKey).then(src => drawVoice(b, src)); };
  b.voiceShow = show;
  setTimeout(show, 0);
  b.addEventListener("click", async () => {
    const t = textNow();
    if (!t) return;
    const all = await sourcesFor(t, opts.p);
    if (!all.length) { toast("No voice can say this on this device."); return; }
    const cur = b.dataset.src;
    const next = all[(all.indexOf(cur) + 1) % all.length];
    if (all.length === 1) toast("Only one voice can say this: " + VOICE_SOURCES[next].label.toLowerCase() + ".");
    commit({ [pickKey]: next });
    drawVoice(b, next, true);
    if (opts.play) opts.play(next); else speak(t, opts.p, { slow: opts.slow, source: next });
    for (const o of document.querySelectorAll(".voice-src")) if (o !== b && o.dataset.pick === pickKey && o.voiceShow) o.voiceShow();
  });
  return b;
}
/** After something plays, voice buttons for that text show the voice you actually heard. */
function syncVoiceBtns(text, src) {
  for (const b of document.querySelectorAll(".voice-src")) if (b.dataset.vtext === text && b.dataset.src !== src) drawVoice(b, src);
}
/** A Listen button with its voice button beside it. */
const withVoice = (btn, opts) => h("span", { class: "listen-pair" }, btn, voiceBtn(opts));

/** Plays exact numbered pinyin from the syllable recordings (no tone changes), e.g. "ma3" or "xue2 xi2".
 *  Resolves false when a syllable doesn't exist in Mandarin (there's no recording of it). */
async function speakPinyin(p) {
  audioCtxNow();
  const keys = p.toLowerCase().replace(/u:|ü/g, "v").split(/\s+/).filter(Boolean).map(x => x.replace(/5$/, "1"));
  const idx = await audioIndex();
  if (!keys.length || !keys.every(k => idx.has("s|" + k))) return false;
  const bufs = await Promise.all(keys.map(k => recording("s", k)));
  if (bufs.some(b => !b)) return false;
  ++speakSeq;
  playBuffers(bufs.map(buf => ({ buf })), false);
  return true;
}
