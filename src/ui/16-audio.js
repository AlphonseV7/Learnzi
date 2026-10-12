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
const bucketOf = (key, n) => { let t = 0; for (const ch of key) t += ch.codePointAt(0); return t % n; };
// Same sum as the packer: the code point of every character.
function audioIndex() {
  if (!AUDIO.index) {
    AUDIO.index = fetch("audio/index.txt").then(r => (r.ok ? r.text() : "")).then(t => {
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
/** One recording, decoded and with the silence trimmed off both ends. */
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
    return trimSilence(ctx, audio);
  })().catch(() => null);
  AUDIO.decoded.set(id, job);
  const res = await job;
  if (!res) AUDIO.decoded.delete(id);
  return res;
}
function trimSilence(ctx, b) {
  const d = b.getChannelData(0), limit = 0.02, pad = Math.round(b.sampleRate * 0.012);
  let s = 0, e = d.length - 1;
  while (s < e && Math.abs(d[s]) < limit) s++;
  while (e > s && Math.abs(d[e]) < limit) e--;
  s = Math.max(0, s - pad); e = Math.min(d.length - 1, e + pad);
  if (e - s < b.sampleRate * 0.05) return b;
  const out = ctx.createBuffer(1, e - s + 1, b.sampleRate);
  out.getChannelData(0).set(d.subarray(s, e + 1));
  return out;
}
function stopRecordings() {
  for (const src of AUDIO.playing) { try { src.stop(); } catch { /* already finished */ } }
  AUDIO.playing = [];
}
/** Plays buffers one after another, overlapping each join a little so syllables run together. */
function playBuffers(list, slow) {
  const ctx = audioCtxNow();
  stopRecordings();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  const rate = slow ? 0.8 : 1;
  let t = ctx.currentTime + 0.03;
  list.forEach(({ buf, gain }, i) => {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate;
    g.gain.value = gain || 1;
    src.connect(g); g.connect(ctx.destination);
    src.start(t);
    AUDIO.playing.push(src);
    const len = buf.duration / rate;
    t += i < list.length - 1 ? Math.max(0.12, len - (slow ? 0.02 : 0.06)) : len;
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
    if ([...clean].length < 2) return false;
    const simp = ui.dict === "ready" && !p ? (Engine.lookup(clean)[0] || {}).s || clean : clean;
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
/** The order to try sources in, from your Voice setting and the length of the text. */
function sourceOrder(n) {
  if (state.voice === "browser") return ["browser", "word", "syllables"];
  // Long sentences sound smoother in the browser's voice, when the device has a Chinese one.
  if (n > 6 && zhVoice) return ["browser", "word", "syllables"];
  return ["word", "syllables", "browser"];
}

let speakSeq = 0;
/** Say Chinese text. p (numbered pinyin) picks the reading of a word with more than one.
 *  opts.source starts with a particular source (the "Change" button on the now-playing bar). */
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
        if (seq === speakSeq && !opts.quiet) nowPlaying({ text: clean, p, slow: opts.slow, src });
        return src;
      }
    }
    clearTimeout(slowNote);
    if (seq === speakSeq) toast(hasTTS() ? "No recording for this, and the browser voice didn't start." : "No recording for this, and this app can't use the browser voice.");
    return null;
  })();
}
/** Every source that can say this text: whole-word recording, syllables, browser voice. */
async function sourcesFor(text, p) {
  const clean = text.replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, "") || text;
  const idx = await audioIndex(), out = [];
  if ([...clean].length > 1) {
    const simp = ui.dict === "ready" && !p ? (Engine.lookup(clean)[0] || {}).s || clean : clean;
    if (idx.has("w|" + simp)) out.push("word");
  }
  const keys = pinyinFor(clean, p).flatMap(x => syllableKeys(x.p, x.form));
  if (keys.length && keys.every(k => idx.has("s|" + k.key))) out.push("syllables");
  if (hasTTS()) out.push("browser");
  return out;
}

// ---------- the now-playing bar: what you're hearing, and a button to hear it another way ----------
let npTimer = 0;
async function otherSources(text, p, current) {
  const out = [], all = ["word", "syllables", "browser"], at = all.indexOf(current);
  // In turn after the one playing now, so "Try …" walks through every source and back round.
  for (const src of [...all.slice(at + 1), ...all.slice(0, at)]) {
    if (src === "browser") { if (hasTTS()) out.push(src); continue; }
    if (src === "word") {
      if ([...text].length < 2) continue;
      const simp = ui.dict === "ready" && !p ? (Engine.lookup(text)[0] || {}).s || text : text;
      if ((await audioIndex()).has("w|" + simp)) out.push(src);
      continue;
    }
    const keys = pinyinFor(text, p).flatMap(x => syllableKeys(x.p, x.form));
    const idx = await audioIndex();
    if (keys.length && keys.every(k => idx.has("s|" + k.key))) out.push(src);
  }
  return out;
}
async function nowPlaying(info) {
  const others = await otherSources(info.text, info.p, info.src);
  let bar = $("#nowplaying");
  if (!bar) { bar = h("div", { class: "nowplaying", id: "nowplaying", role: "status", "aria-live": "polite" }); document.body.append(bar); }
  const s = VOICE_SOURCES[info.src];
  const next = others[0];
  bar.replaceChildren(
    h("span", { class: "np-ico", "aria-hidden": "true" }, icon("play")),
    h("span", { class: "np-text" }, h("b", null, s.label), h("span", { class: "muted small" }, h("span", { class: "hz" }, info.text), " · " + s.who)),
    next ? h("button", { class: "btn small", type: "button", title: "Hear it as: " + VOICE_SOURCES[next].label,
      onclick: () => speak(info.text, info.p, { slow: info.slow, source: next }) }, "Try " + VOICE_SOURCES[next].label.toLowerCase().replace("built from ", "")) : null,
    h("button", { class: "btn icon np-close", type: "button", "aria-label": "Close", onclick: () => bar.classList.remove("show") }, icon("close")));
  requestAnimationFrame(() => bar.classList.add("show"));
  clearTimeout(npTimer);
  npTimer = setTimeout(() => bar.classList.remove("show"), 6000);
}

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
