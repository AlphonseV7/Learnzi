/* LearnZì UI, part 6c: Watch. Play a video from this device with its Chinese subtitle file (.srt, .vtt or
 * .lrc). The current line shows under the video like the Reader: tap a word and the video pauses on it.
 * Replay, step and loop lines, slow down, pause after each line, hide the subtitles to practise listening,
 * nudge subtitles that are early or late. LearnZì remembers where you stopped in each video (by its name)
 * on this device. Each line you watch to the end earns 1 XP, up to MEDIA_CAP a day.
 * The video and subtitles are opened from your device only; nothing is uploaded, and subtitles are shown
 * as plain text, never run. */

const MEDIA_CAP = 30;
const WATCH_KEY = "learnzi.watch.v1";
const SUB_EXT = /\.(srt|vtt|lrc|txt)$/i;
const VIDEO_EXT = /\.(mp4|m4v|mkv|webm|mov|ogv)$/i;
const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac|weba)$/i;
// Two players share all the code below: the Video tab and the Audio tab (audiobooks). `watch` points at the one
// on screen; `.video` is its media element (a <video> or an <audio>).
const newPlayer = kind => ({ kind, file: null, url: "", key: "", name: "", video: null, cues: [], subName: "", offset: 0, speed: 1, loop: false,
  autoPause: false, hide: false, cur: -1, shown: -1, earned: new Set(), pausedAt: -1, error: "", raf: 0, saveAt: 0, untimed: false, tap: 0 });
const players = { video: newPlayer("video"), audio: newPlayer("audio") };
let watch = players.video;
const isAudio = () => watch.kind === "audio";
/** Flip between the Video and Audio tabs; whatever is playing on the other one pauses. */
function setWatchTab(kind) {
  if (watch.kind === kind) return;
  if (watch.video) watch.video.pause();
  cancelAnimationFrame(watch.raf);
  watch = players[kind];
  watch.shown = -2;
}

// ---------- subtitles ----------
function subTime(t) {
  const m = t.trim().replace(",", ".").match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/);
  return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) : NaN;
}
const cleanCue = t => t.replace(/<[^>\n]*>/g, "").replace(/\{\\[^}]*\}/g, "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/[ \t]+\n/g, "\n").trim();
/** Read .srt or .vtt (a time line "start --> end" then text) or .lrc ("[mm:ss.xx] text") into timed lines. */
function parseSubs(text) {
  const t = text.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  const cues = [];
  if (/^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/m.test(t) && !/-->/.test(t)) {
    for (const line of t.split("\n")) {
      const stamps = [...line.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const words = cleanCue(line.replace(/\[[^\]\n]*\]/g, ""));
      for (const m of stamps) cues.push({ start: +m[1] * 60 + +m[2] + (m[3] ? +("0." + m[3]) : 0), end: 0, text: words });
    }
    cues.sort((a, b) => a.start - b.start);
    cues.forEach((c, i) => { c.end = i + 1 < cues.length ? cues[i + 1].start : c.start + 5; });
  } else {
    for (const block of t.split(/\n\s*\n/)) {
      const lines = block.split("\n");
      const at = lines.findIndex(l => l.includes("-->"));
      if (at < 0) continue;
      const [a, b] = lines[at].split("-->");
      const start = subTime(a), end = subTime((b || "").trim().split(/\s+/)[0] || "");
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const words = cleanCue(lines.slice(at + 1).join("\n"));
      if (words) cues.push({ start, end, text: words.slice(0, 500) });
    }
    cues.sort((a, b) => a.start - b.start);
  }
  return cues.filter(c => c.text).slice(0, 5000);
}
/** The line on screen at time t (seconds), or -1. Subtitles are moved by watch.offset. */
function cueAt(t) {
  const cs = watch.cues, x = t - watch.offset;
  let lo = 0, hi = cs.length - 1, found = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (cs[mid].start <= x) { found = mid; lo = mid + 1; } else hi = mid - 1; }
  return found >= 0 && x < cs[found].end ? found : -1;
}
const fmtTime = s => { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };

// ---------- remembering your place (this device only) ----------
function watchSaved() { try { return JSON.parse(localStorage.getItem(WATCH_KEY) || "{}") || {}; } catch { return {}; } }
function watchSave(P = watch) {
  if (!P.key || !P.video) return;
  const all = watchSaved();
  all[P.key] = { t: Math.floor(P.video.currentTime || 0), off: P.offset, at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 30);
  try { localStorage.setItem(WATCH_KEY, JSON.stringify(Object.fromEntries(keep))); } catch { /* storage full or blocked: fine */ }
}

// ---------- opening files ----------
/** A quick look at the first bytes: is this really a video container the browser can play (MP4/MOV, Matroska/WebM,
 *  Ogg)? A program renamed to .mp4 is turned away before the browser's player ever sees it. */
async function looksLikeVideo(f) {
  try {
    const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
    const tag = String.fromCharCode(...b.slice(4, 8));
    if (["ftyp", "moov", "mdat", "wide", "free", "skip"].includes(tag)) return true;          // MP4, M4V, MOV
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return true;          // MKV, WebM
    if (String.fromCharCode(...b.slice(0, 4)) === "OggS") return true;                          // Ogg video
  } catch { /* unreadable: treat as not a video */ }
  return false;
}
/** The same for sound files: MP3 (ID3 tag or frame sync), M4A/AAC in MP4, Ogg/Opus, WAV, FLAC, WebM audio. */
async function looksLikeAudio(f) {
  try {
    const b = new Uint8Array(await f.slice(0, 12).arrayBuffer());
    const s4 = String.fromCharCode(...b.slice(0, 4)), tag = String.fromCharCode(...b.slice(4, 8));
    if (s4.startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return true;          // MP3 (and ADTS AAC)
    if (["ftyp", "moov", "mdat", "free"].includes(tag) || s4 === "OggS" || s4 === "fLaC") return true;
    if (s4 === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WAVE") return true;
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return true;
  } catch { /* unreadable */ }
  return false;
}
function watchUseVideo(vid, P = watch) {
  if (P.url) URL.revokeObjectURL(P.url);
  if (P.video) { P.video.pause(); P.video.removeAttribute("src"); P.video.load(); }
  Object.assign(P, { file: vid, url: URL.createObjectURL(vid), key: vid.name + "|" + vid.size, name: cleanLine(vid.name, 120), video: null,
    cur: -1, shown: -1, earned: new Set(), pausedAt: -1, error: "", offset: 0, picked: null });
  const saved = watchSaved()[P.key];
  if (saved) P.offset = num(saved.off, -60, 60, 0);
  if (P.untimed) applyTapTimes(P);
}
async function watchOpen(files) {
  const list = [...files], audio = isAudio();
  let vid = audio ? list.find(f => /^audio\//.test(f.type) || AUDIO_EXT.test(f.name)) : list.find(f => /^video\//.test(f.type) || VIDEO_EXT.test(f.name));
  let refused = false;
  if (vid && !(await (audio ? looksLikeAudio(vid) : looksLikeVideo(vid)))) {
    toast(cleanLine(vid.name, 60) + (audio ? " isn't a sound file LearnZì can play (MP3, M4A, OGG, WAV)." : " isn't a video LearnZì can play (MP4, MKV, WebM or MOV)."));
    vid = null; refused = true;
  }
  const sub = list.find(f => SUB_EXT.test(f.name) && f !== vid);
  if (vid) { watchUseVideo(vid); if (!sub && !watch.untimed) { watch.cues = []; watch.subName = ""; } }
  if (sub) await watchSubs(sub);
  if (!vid && !sub && !refused) toast(audio ? "Choose a sound file (MP3, M4A, OGG, WAV) or its text (.lrc, .srt or .txt)." : "Choose a video (MP4, MKV, WebM) or a subtitle file (.srt, .vtt, .lrc).");
  if (ui.view === "watch") render(false); else go("watch");
}
async function watchSubs(f) {
  if (f.size > 4 * 1024 * 1024) { toast("That subtitle file is too big."); return; }
  let text;
  try { text = decodeText(new Uint8Array(await f.arrayBuffer())); } catch { text = null; }
  let cues = text ? parseSubs(text) : [];
  watch.untimed = false;
  if (!cues.length && text && isAudio()) {
    // Plain text with no timings: split it into sentences and time them once by tapping along.
    cues = splitSentences(text).map(t => ({ start: NaN, end: NaN, text: t }));
    if (cues.length) { watch.untimed = true; watch.textSig = text.length + ":" + cues.length + ":" + cues[0].text.slice(0, 12); }
  }
  if (!cues.length) { toast("Couldn't find any timed lines in " + f.name + (isAudio() ? ". Use .lrc, .srt or plain .txt." : ". Use an .srt, .vtt or .lrc file.")); return; }
  watch.cues = cues; watch.subName = cleanLine(f.name, 120); watch.cur = -1; watch.shown = -1; watch.picked = null; watch.tap = 0;
  if (watch.untimed) applyTapTimes(watch);
  if (!cues.some(c => Engine.isCJK(c.text))) toast("These subtitles have no Chinese in them.");
}

// ---------- tap along: timing plain text by tapping as each sentence starts ----------
const TAP_KEY = "learnzi.tap.v1";
function splitSentences(text) {
  const out = [];
  for (const para of text.replace(/\r\n?/g, "\n").split(/\n+/)) {
    for (const piece of para.split(/(?<=[。！？!?；…]+[”」』"]?)/)) {
      const t = cleanCue(piece);
      if (!t) continue;
      if (out.length && t.length < 3 && !/[\u4e00-\u9fff]{2}/.test(t)) out[out.length - 1] += t; else out.push(t.slice(0, 300));
    }
  }
  return out.slice(0, 3000);
}
const tapSaved = () => { try { return JSON.parse(localStorage.getItem(TAP_KEY) || "{}") || {}; } catch { return {}; } };
/** Use timings tapped earlier for this sound file and text (this device only). */
function applyTapTimes(P) {
  if (!P.key || !P.untimed) return;
  const t = tapSaved()[P.key + "|" + P.textSig];
  P.cues.forEach(c => { c.start = NaN; c.end = NaN; });
  P.tap = 0;
  if (!t || !Array.isArray(t.s)) return;
  t.s.slice(0, P.cues.length).forEach((x, i) => { P.cues[i].start = x; });
  P.tap = Math.min(P.cues.length, t.s.length);
  for (let i = 0; i < P.tap; i++) P.cues[i].end = i + 1 < P.tap ? P.cues[i + 1].start : (t.end || P.cues[i].start + 8);
  if (P.tap >= P.cues.length) P.untimed = false;
}
function saveTapTimes(P, done) {
  const all = tapSaved();
  all[P.key + "|" + P.textSig] = { s: P.cues.slice(0, P.tap).map(c => Math.round(c.start * 100) / 100), end: done ? Math.round((P.video.duration || 0) * 100) / 100 : 0, at: Date.now() };
  const keep = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 10);
  try { localStorage.setItem(TAP_KEY, JSON.stringify(Object.fromEntries(keep))); } catch { /* storage full: fine */ }
}
/** "Now!": the next sentence starts at this moment. */
function tapNow() {
  const P = watch, v = P.video;
  if (!v || !P.untimed || P.tap >= P.cues.length) return;
  if (v.paused) { v.play().catch(() => {}); if (P.tap > 0) return; }
  const t = v.currentTime;
  if (P.tap > 0) P.cues[P.tap - 1].end = t;
  P.cues[P.tap].start = t; P.cues[P.tap].end = t + 600;
  P.tap++;
  saveTapTimes(P, false);
  P.shown = -2; P.cur = P.tap - 1; watchShow(P.tap - 1);
  drawTap();
}
function tapUndo() {
  const P = watch;
  if (!P.tap) return;
  P.tap--;
  P.cues[P.tap].start = NaN; P.cues[P.tap].end = NaN;
  if (P.tap > 0) { P.cues[P.tap - 1].end = P.cues[P.tap - 1].start + 600; if (P.video) P.video.currentTime = Math.max(0, P.cues[P.tap - 1].start); }
  else if (P.video) P.video.currentTime = 0;
  saveTapTimes(P, false); P.shown = -2; drawTap();
}
function tapFinish() {
  const P = watch;
  if (P.tap > 0) P.cues[P.tap - 1].end = Math.max(P.cues[P.tap - 1].start + 1, P.video && P.video.duration ? P.video.duration : P.cues[P.tap - 1].start + 8);
  P.cues = P.cues.slice(0, P.tap);
  P.untimed = false;
  saveTapTimes(P, true);
  toast("Timings saved on this device. Next time this file and text open ready to follow along.");
  render(false);
}
function drawTap() {
  const box = $("#tap-box");
  if (!box) return;
  const P = watch, next = P.cues[P.tap];
  box.querySelector(".tap-next").replaceChildren(next ? next.text : "That was the last sentence.");
  box.querySelector(".tap-count").textContent = P.tap + " of " + P.cues.length + " sentences timed";
  box.querySelector(".tap-now").disabled = !next;
  box.querySelector(".tap-done").disabled = !!next;
}

// ---------- the player ----------
function watchVideo() {
  if (watch.video) return watch.video;
  const P = watch;
  const v = h(P.kind === "audio" ? "audio" : "video", { class: "watch-video" + (P.kind === "audio" ? " watch-audio" : ""), playsinline: true, controls: true, preload: "metadata" });
  v.src = P.url;
  v.playbackRate = P.speed;
  v.addEventListener("loadedmetadata", () => {
    const saved = watchSaved()[P.key];
    if (saved && saved.t > 5 && saved.t < v.duration - 5 && !v.currentTime) {
      v.currentTime = saved.t;
      actionToast("Picked up where you left off (" + fmtTime(saved.t) + ")", "Start over", () => { v.currentTime = 0; });
    }
  });
  v.addEventListener("error", () => {
    P.error = P.kind === "audio" ? "This browser can't play this sound file. MP3 plays everywhere." : "This browser can't play this video. MP4 videos (H.264 with AAC sound) play almost everywhere; MKV works in Chrome only with some codecs.";
    if (ui.view === "watch" && watch === P) render(false);
  });
  v.addEventListener("play", () => { v.playbackRate = P.speed; if (watch === P) watchTick(); });
  v.addEventListener("pause", () => watchSave(P));
  v.addEventListener("seeking", () => { P.pausedAt = -1; });
  v.addEventListener("seeked", () => { if (v.paused && watch === P) { const i = cueAt(v.currentTime); P.cur = i; if (i >= 0) watchShow(i); } });
  P.video = v;
  return v;
}
/** Runs while the video plays: keeps the line in step, pauses or loops at line ends, counts XP. */
function watchTick() {
  cancelAnimationFrame(watch.raf);
  const v = watch.video;
  if (!v || !v.isConnected) return;
  const t = v.currentTime, i = cueAt(t);
  const prev = watch.cur;
  if (prev >= 0 && i !== prev && !v.seeking) {
    const c = watch.cues[prev];
    if (t - watch.offset >= c.end - 0.05) {
      if (watch.loop) { v.currentTime = c.start + watch.offset; watch.raf = requestAnimationFrame(watchTick); return; }
      watchEarn(prev);
      if (watch.autoPause && watch.pausedAt !== prev) { watch.pausedAt = prev; v.pause(); watchShow(prev); return; }
    }
  }
  if (i >= 0 || prev < 0 || t - watch.offset > watch.cues[prev].end + 1.5) { watch.cur = i; watchShow(i >= 0 ? i : watch.shown); }
  if (Date.now() - watch.saveAt > 5000) { watch.saveAt = Date.now(); watchSave(); }
  if (!v.paused && !v.ended) watch.raf = requestAnimationFrame(watchTick);
}
function watchEarn(i) {
  if (watch.earned.has(i) || !Engine.isCJK(watch.cues[i].text)) return;
  watch.earned.add(i);
  const a = dayAct();
  if (a[5] >= MEDIA_CAP) return;
  a[5] += 1;
  commitProgress();
  const xp = $("#watch-xp");
  if (xp) xp.textContent = "Today: " + a[5] + " / " + MEDIA_CAP + " XP from watching and listening";
  updateTopbar();
}
/** Draw line i (tappable words) under the video, in the full-screen overlay and in the transcript. */
function watchShow(i) {
  if (i === watch.shown) return;
  watch.shown = i;
  const cue = watch.cues[i];
  for (const box of document.querySelectorAll(".watch-line")) {
    box.replaceChildren();
    box.classList.toggle("hidden-line", watch.hide);
    if (!cue) { box.append(h("span", { class: "muted watch-gap" }, watch.cues.length ? "…" : "")); continue; }
    const inner = h("span", { class: "line-in" });
    drawLine(inner, cue.text);
    box.append(inner);
  }
  const list = $("#watch-list");
  if (list) {
    list.querySelectorAll(".wl.now").forEach(x => x.classList.remove("now"));
    const row = list.querySelector('[data-i="' + i + '"]');
    if (row) {
      row.classList.add("now");
      const lr = list.getBoundingClientRect(), rr = row.getBoundingClientRect();
      if (rr.top < lr.top || rr.bottom > lr.bottom) list.scrollTop += rr.top - lr.top - lr.height / 3;
    }
  }
}
function drawLine(box, text) {
  if (ui.dict !== "ready") { box.append(h("span", { class: "plain" }, text)); return; }
  text.split("\n").forEach((part, n) => {
    if (n) box.append(h("br"));
    for (const seg of Engine.segment(part)) {
      if (!seg.word || !seg.entries.length) { box.append(h("span", { class: "plain" }, seg.text)); continue; }
      const e = seg.entries[0];
      const shown = seg.text === e.s || seg.text === e.t ? disp(e) : seg.text;
      box.append(h("button", { class: "w", type: "button", "data-form": seg.text }, h("ruby", null, hzEl(shown, e.p, ""), h("rt", null, pyEl(e.p)))));
    }
  });
}
function watchJump(i, play = true) {
  const v = watch.video, c = watch.cues[i];
  if (!v || !c || !Number.isFinite(c.start)) return;
  watch.pausedAt = -1; watch.cur = i;
  v.currentTime = Math.max(0, c.start + watch.offset + 0.01);
  watchShow(i);
  if (play) v.play().catch(() => {});
}
function watchStep(d) {
  if (!watch.cues.length || !watch.video || watch.untimed) return;
  const t = watch.video.currentTime - watch.offset;
  let i = watch.cur >= 0 ? watch.cur : watch.cues.findIndex(c => c.start > t) - (d > 0 ? 1 : 0);
  if (i < -1) i = watch.cues.length - 1;
  watchJump(Math.min(watch.cues.length - 1, Math.max(0, i + d)));
}
const watchReplay = () => { const i = watch.cur >= 0 ? watch.cur : watch.shown; if (i >= 0) watchJump(i); };
function watchFrame() {
  const v = watch.video;
  if (!v || !v.videoWidth) { toast("Play the video first, then pause on the picture you want."); return; }
  v.pause();
  const c = document.createElement("canvas");
  const s = Math.min(1, PHOTO_MAX / Math.max(v.videoWidth, v.videoHeight));
  c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
  c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
  photoUse(c, { x: 0.05, y: 0.62, w: 0.9, h: 0.34 });   // subtitles usually sit along the bottom
}
function watchKeys(ev) {
  if (ui.view !== "watch" || !watch.video || ev.ctrlKey || ev.metaKey || ev.altKey) return false;
  const tag = (ev.target.tagName || "").toLowerCase();
  if (["input", "textarea", "select"].includes(tag)) return false;
  const v = watch.video;
  if (ev.key === "Enter" && watch.untimed && tag !== "button") { ev.preventDefault(); tapNow(); return true; }
  if (ev.key === " " && tag !== "button") { ev.preventDefault(); if (v.paused) v.play().catch(() => {}); else v.pause(); return true; }
  if (ev.key === "ArrowLeft") { ev.preventDefault(); watchStep(-1); return true; }
  if (ev.key === "ArrowRight") { ev.preventDefault(); watchStep(1); return true; }
  if (ev.key === "r" || ev.key === "R") { watchReplay(); return true; }
  return false;
}

// ---------- words from the subtitles, and their moments ----------
/** Every dictionary word in the subtitles (first 300), each with the first line it's said in. */
function watchWords() {
  const out = [], first = new Map();
  if (ui.dict !== "ready") return out;
  watch.cues.forEach((c, i) => {
    for (const seg of Engine.segment(c.text)) {
      if (!seg.word || !seg.entries.length) continue;
      const e = seg.entries[0], k = keyOf(e);
      if (first.has(k) || out.length >= 300) continue;
      first.set(k, i); out.push(e);
    }
  });
  watch.firstLine = first;
  return out;
}
const watchClip = e => {
  const i = (watch.firstLine || new Map()).get(keyOf(e)), c = watch.cues[i];
  return c && Number.isFinite(c.start) && Number.isFinite(c.end) && c.end - c.start < 120 ? { v: [Math.max(0, c.start + watch.offset), c.end + watch.offset], x: c.text.replace(/\n/g, " ") } : null;
};
/** The video moments saved with a word in your decks: [{ video: {name, size}, start, end, line, deck }]. */
function wordClips(e) {
  const out = [];
  for (const d of state.decks) {
    for (const w of d.words) if (w.v && w.s === e.s && w.p === e.p && d.videos && d.videos[w.v[2]]) out.push({ video: d.videos[w.v[2]], start: w.v[0], end: w.v[1], line: w.x || "", deck: d.name });
  }
  return out;
}
const playerFor = v => players[v.a ? "audio" : "video"];
const watchHas = v => { const P = playerFor(v); return !!(P.file && P.name === v.name && P.file.size === v.size); };
/** "From your video": the line a word came from, and a button that plays just that moment — straight away
 *  if the video is open in Watch on this device, otherwise after you pick the file again. Null if none. */
function clipBlock(e, asBox) {
  const clips = wordClips(e);
  if (!clips.length) return null;
  const c = clips[0];
  const form = disp(e), line = c.line;
  const at = line.indexOf(e.s) >= 0 ? line.indexOf(e.s) : line.indexOf(e.t || "\u0000");
  const text = h("p", { class: "clip-line hz", lang: "zh" }, at >= 0 ? [line.slice(0, at), h("mark", null, line.slice(at, at + e.s.length)), line.slice(at + e.s.length)] : line);
  const spot = h("div", { class: "clip-spot" });
  const audio = !!c.video.a, P = playerFor(c.video), kind = audio ? "recording" : "video";
  const pick = h("input", { type: "file", accept: audio ? "audio/*,.mp3,.m4a,.m4b,.ogg,.opus,.wav,.flac" : "video/*,.mkv,.mp4,.webm,.mov", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const playBtn = h("button", { class: "btn small", type: "button" }, icon("play"), watchHas(c.video) ? "Play the clip" : "Open the " + kind + " to play the clip");
  const play = () => {
    spot.replaceChildren();
    const v = h(audio ? "audio" : "video", { class: "clip-video" + (audio ? " clip-audio" : ""), playsinline: true, preload: "auto", controls: audio });
    v.src = P.url; v.muted = false;
    spot.append(v);
    const stop = () => { if (v.currentTime >= c.end) { v.pause(); return; } if (!v.paused) requestAnimationFrame(stop); };
    v.addEventListener("loadedmetadata", () => { v.currentTime = c.start; v.play().then(() => requestAnimationFrame(stop)).catch(() => {}); }, { once: true });
    v.addEventListener("error", () => { spot.replaceChildren(h("p", { class: "muted small" }, "This browser can't play that " + kind + ".")); });
    playBtn.lastChild.textContent = "Play again";
  };
  pick.addEventListener("change", async () => {
    const f = pick.files && pick.files[0]; pick.value = "";
    if (!f) return;
    if (cleanLine(f.name, 120) !== c.video.name) { toast("That's a different " + kind + ". Choose " + c.video.name + "."); return; }
    if (!(await (audio ? looksLikeAudio(f) : looksLikeVideo(f)))) { toast("That file isn't a " + kind + " LearnZì can play."); return; }
    watchUseVideo(f, P);
    P.cues = []; P.subName = ""; P.untimed = false;
    play();
  });
  playBtn.addEventListener("click", () => { if (watchHas(c.video)) play(); else pick.click(); });
  const head = h(asBox ? "h2" : "span", { class: asBox ? "h-card" : "eyebrow" }, audio ? "From your recording" : "From your video");
  return h("div", { class: "clip-block" + (asBox ? "" : " fc-clip") },
    head,
    text,
    h("p", { class: "muted small clip-meta" }, c.video.name + " · " + fmtTime(c.start) + (clips.length > 1 ? " · in " + clips.length + " files" : "")),
    h("div", { class: "row" }, playBtn, pick),
    spot);
}

// ---------- the page ----------
const SUB_SIZES = [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]];
/** The words for each tab. */
const WL = {
  video: { media: "Video", another: "Another video", text: "Subtitles", otherText: "Other subtitles", addText: "Add subtitles", lines: "All lines", count: "lines",
    hide: "Hide subtitles", prev: "Previous line", replay: "Replay line", next: "Next line", pause: "Pause after each line", loop: "Loop line",
    accept: "video/*,.mkv,.mp4,.webm,.mov,.srt,.vtt,.lrc", textAccept: ".srt,.vtt,.lrc,.txt,text/plain", reader: "Open the subtitles in the Reader", what: "these subtitles" },
  audio: { media: "Audio", another: "Another sound file", text: "Now reading", otherText: "Other text", addText: "Add the text", lines: "All sentences", count: "sentences",
    hide: "Hide the text", prev: "Previous sentence", replay: "Replay sentence", next: "Next sentence", pause: "Pause after each sentence", loop: "Loop sentence",
    accept: "audio/*,.mp3,.m4a,.m4b,.ogg,.opus,.wav,.flac,.lrc,.srt,.vtt,.txt", textAccept: ".lrc,.srt,.vtt,.txt,text/plain", reader: "Open the text in the Reader", what: "this text" },
};
function viewWatch() {
  const v = h("section", { class: "view watch-view" + (isAudio() ? " listen-view" : "") });
  const L = WL[watch.kind];
  // Video | Audio: two tabs on the same page
  v.append(h("div", { class: "seg media-tabs", role: "tablist", "aria-label": "Watch or listen" }, [["video", "🎬 Video"], ["audio", "🎧 Audio"]].map(([k, label]) =>
    h("button", { type: "button", role: "tab", "aria-selected": String(watch.kind === k), "aria-pressed": String(watch.kind === k), onclick: () => { setWatchTab(k); render(false); } }, label))));
  const pickAll = h("input", { type: "file", accept: L.accept, multiple: true, class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const pickSub = h("input", { type: "file", accept: L.textAccept, class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  pickAll.addEventListener("change", () => { const f = [...(pickAll.files || [])]; pickAll.value = ""; if (f.length) watchOpen(f); });
  pickSub.addEventListener("change", async () => { const f = pickSub.files && pickSub.files[0]; pickSub.value = ""; if (f) { await watchSubs(f); render(false); } });
  const has = watch.cues.length > 0, timed = has && !watch.untimed;

  if (!watch.file) {
    const audio = isAudio();
    const card = h("div", { class: "card watch-start" },
      h("h2", { class: "h-card" }, L.media),
      h("p", null, audio
        ? "Choose an audiobook or any Chinese recording (MP3, M4A, OGG, WAV) and its text. Timed text (.lrc or .srt) follows along straight away; plain text (.txt) you time once by tapping along. You can pick both at once. They stay on this device: nothing is uploaded."
        : "Choose a video and its Chinese subtitle file (.srt, .vtt or .lrc). You can pick both at once. They stay on this device: nothing is uploaded."),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onclick: () => pickAll.click() }, icon("file"), audio ? "Choose sound file" : "Choose video"),
        h("button", { class: "btn", type: "button", onclick: () => pickSub.click() }, icon("file"), has ? L.otherText : L.addText), pickAll, pickSub),
      watch.subName ? h("p", { class: "muted small" }, "Text ready: " + watch.subName) : null,
      h("button", { class: "plain-btn build-link small", type: "button", onclick: async () => {
        const [vid, sub] = audio
          ? await Promise.all([sampleFile("sample-audio.mp3", "sample-audio.mp3", "audio/mpeg"), sampleFile("sample-audio-text.txt", "sample-audio.lrc", "text/plain")])
          : await Promise.all([sampleFile("sample-video.mp4", "sample-video.mp4", "video/mp4"), sampleFile("sample-subs.txt", "sample-video.srt", "text/plain")]);
        if (vid && sub) watchOpen([vid, sub]);
      } }, audio ? "No audiobook handy? Try the sample recording" : "No video handy? Try the sample video (a short job interview, 35 seconds)"),
      h("ul", { class: "muted small photo-tips" }, (audio ? [
        "The sentence being read is highlighted and its words are tappable; the recording pauses on the word you tap.",
        "No timings in your text? Tap along once as each sentence starts; LearnZì remembers the timings on this device.",
        "Make flashcards from the text. Each card can play the moment its word is spoken.",
        "LibriVox (librivox.org) has free public-domain Chinese audiobooks.",
        "The Claude app can't open files: use Chrome for this page.",
      ] : [
        "Tap any word in the subtitles: the video pauses and the word opens.",
        "Make flashcards from the subtitles. Each card can play the moment its word is said.",
        "Subtitles burned into the picture? Pause, then use Read the picture (Photo to words).",
        "MP4 plays almost everywhere. MKV plays in Chrome with most, but not all, codecs.",
        "The Claude app can't open files: use Chrome for this page.",
      ]).map(t => h("li", null, t))));
    card.addEventListener("dragover", ev => { ev.preventDefault(); card.classList.add("drag"); });
    card.addEventListener("dragleave", () => card.classList.remove("drag"));
    card.addEventListener("drop", ev => { ev.preventDefault(); card.classList.remove("drag"); if (ev.dataTransfer?.files?.length) watchOpen(ev.dataTransfer.files); });
    v.append(card);
    return v;
  }

  // 1. the player
  const video = watchVideo();
  const overlay = h("div", { class: "watch-line watch-overlay reader-text hz sub-" + state.subSize, lang: "zh" });
  const stage = h("div", { class: "watch-stage" + (isAudio() ? " listen-stage" : "") }, isAudio() ? h("span", { class: "listen-icon hz", "aria-hidden": "true" }, "听") : null, video, isAudio() ? null : overlay);
  const onWord = ev => {
    if (ev.currentTarget.classList.contains("hidden-line")) { ev.currentTarget.classList.remove("hidden-line"); return; }   // first tap peeks
    const b = ev.target.closest(".w");
    if (!b) return;
    video.pause();
    if (b.classList.contains("sel")) { speak(b.dataset.form); return; }
    document.querySelectorAll(".watch-line .w.sel").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    openWord(b.dataset.form);
  };
  overlay.addEventListener("click", onWord);
  const toggle = (key, label, note) => h("button", { class: "btn small chip-toggle", type: "button", "aria-pressed": String(watch[key]), title: note, onclick: ev => {
    watch[key] = !watch[key]; ev.currentTarget.setAttribute("aria-pressed", String(watch[key]));
    if (key === "hide") document.querySelectorAll(".watch-line").forEach(x => x.classList.toggle("hidden-line", watch.hide));
    if (key === "autoPause") watch.pausedAt = -1;
  } }, label);
  const speeds = h("div", { class: "seg watch-speed", role: "group", "aria-label": "Speed" }, [0.5, 0.75, 1].map(sp =>
    h("button", { type: "button", "aria-pressed": String(watch.speed === sp), onclick: ev => {
      watch.speed = sp; video.playbackRate = sp;
      ev.currentTarget.parentNode.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === ev.currentTarget)));
    } }, sp === 1 ? "1×" : sp + "×")));
  const fileChip = (ico, label, title) => h("span", { class: "file-chip", title }, icon(ico), h("span", { class: "file-chip-name" }, label));
  v.append(h("div", { class: "card watch-card" },
    h("div", { class: "row spread watch-head" }, h("h2", { class: "h-card" }, L.media),
      h("div", { class: "row watch-files-btns" },
        h("button", { class: "btn small", type: "button", onclick: () => pickAll.click() }, L.another),
        h("button", { class: "btn small", type: "button", onclick: () => pickSub.click() }, has ? L.otherText : L.addText), pickAll, pickSub)),
    h("div", { class: "row watch-files" }, fileChip(isAudio() ? "play" : "image", watch.name, L.media),
      watch.subName ? fileChip("file", watch.subName, L.text) : h("span", { class: "muted small" }, isAudio() ? "No text yet" : "No subtitles yet")),
    watch.error ? h("p", { class: "watch-error" }, watch.error) : null,
    stage,
    timed ? h("div", { class: "row watch-transport" },
      h("div", { class: "row watch-steps" },
        h("button", { class: "btn icon", type: "button", "aria-label": L.prev, title: L.prev + " (←)", onclick: () => watchStep(-1) }, icon("back")),
        h("button", { class: "btn", type: "button", title: L.replay + " (R)", onclick: watchReplay }, icon("rotate"), L.replay),
        h("button", { class: "btn icon", type: "button", "aria-label": L.next, title: L.next + " (→)", onclick: () => watchStep(1) }, icon("next"))),
      speeds) : h("div", { class: "row watch-transport" }, h("span"), speeds),
    h("div", { class: "row watch-options" },
      timed ? toggle("autoPause", L.pause, "Stop at the end of every one, so you can read it") : null,
      timed ? toggle("loop", L.loop, "Play the same one over and over") : null,
      isAudio() ? null : h("button", { class: "btn small", type: "button", onclick: () => { (stage.requestFullscreen ? stage.requestFullscreen() : Promise.reject()).catch(() => toast("Full screen isn't available here.")); } }, "Full screen"),
      isAudio() ? null : h("button", { class: "btn small", type: "button", title: "Read the Chinese in this frame with Photo to words", onclick: watchFrame }, icon("camera"), "Read the picture")),
    h("p", { class: "muted small", id: "watch-xp" }, "Today: " + getAct()[5] + " / " + MEDIA_CAP + " XP from watching and listening")));

  // 2a. tap along (plain text with no timings yet)
  if (has && watch.untimed) {
    v.append(h("div", { class: "card watch-subs tap-card", id: "tap-box" },
      h("h2", { class: "h-card" }, "Tap along"),
      h("p", { class: "muted small" }, "This text has no timings yet. Tap Now to start the recording, then tap Now each time a new sentence starts (or press Enter). Every tap is saved, so you can stop and carry on later. You only do this once: LearnZì remembers the timings for this file on this device."),
      h("span", { class: "eyebrow" }, "Next sentence"),
      h("p", { class: "tap-next hz", lang: "zh" }),
      h("div", { class: "row tap-btns" },
        h("button", { class: "btn primary big-btn tap-now", type: "button", onclick: tapNow }, "Now!"),
        h("button", { class: "btn", type: "button", onclick: tapUndo }, "Undo"),
        h("button", { class: "btn tap-done", type: "button", title: "Finish once every sentence is timed", onclick: tapFinish }, "Done")),
      h("p", { class: "muted small tap-count" })));
    setTimeout(drawTap, 0);
  }
  // 2b. the current line or sentence, in its own box
  if (has) {
    const line = h("div", { class: "watch-line reader-text hz sub-" + state.subSize, lang: "zh", "aria-live": "polite" });
    line.addEventListener("click", onWord);
    const sizes = h("div", { class: "seg sub-sizes", role: "group", "aria-label": "Text size" }, SUB_SIZES.map(([k, label]) =>
      h("button", { type: "button", "aria-pressed": String(state.subSize === k), title: "Text size " + label, onclick: () => {
        commit({ subSize: k });
        document.querySelectorAll(".watch-line").forEach(x => { x.className = x.className.replace(/\bsub-\w+/, "sub-" + k); });
        sizes.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent === label)));
      } }, label)));
    const offsetOut = h("span", { class: "small num muted" });
    const showOffset = () => { offsetOut.textContent = watch.offset ? (watch.offset > 0 ? "+" : "") + watch.offset.toFixed(1) + " s" : "in step"; };
    showOffset();
    const nudge = d => { watch.offset = Math.round((watch.offset + d) * 10) / 10; showOffset(); watch.shown = -2; watchShow(cueAt(video.currentTime)); watchSave(); };
    v.append(h("div", { class: "card " + (watch.untimed ? "watch-now" : "watch-subs") },
      h("div", { class: "row spread" }, h("h2", { class: "h-card" }, L.text), sizes),
      line,
      timed ? h("div", { class: "row watch-options" },
        toggle("hide", L.hide, "Listen first; tap the line to peek"),
        h("span", { class: "watch-timing row" }, h("span", { class: "small muted" }, "Early or late?"),
          h("button", { class: "btn small", type: "button", title: "Show the text half a second earlier", onclick: () => nudge(-0.5) }, "−0.5 s"),
          h("button", { class: "btn small", type: "button", title: "Show the text half a second later", onclick: () => nudge(0.5) }, "+0.5 s"), offsetOut)) : null));
  } else v.append(h("div", { class: "card watch-subs-empty" }, h("h2", { class: "h-card" }, L.text),
    h("p", { class: "muted small" }, isAudio() ? "Add the text to follow along: timed (.lrc, .srt) or plain (.txt)."
      : "Add a subtitle file to see the words here. No subtitle file? Pause on a frame with subtitles and use Read the picture.")));

  // 3. every line, tap to jump
  if (has) {
    const list = h("div", { class: "watch-list", id: "watch-list" }, watch.cues.map((c, i) =>
      h("button", { class: "wl", type: "button", "data-i": String(i), disabled: !Number.isFinite(c.start), onclick: () => watchJump(i) },
        h("span", { class: "wl-t num" }, Number.isFinite(c.start) ? fmtTime(c.start + watch.offset) : "–"), h("span", { class: "wl-x hz", lang: "zh" }, c.text.replace(/\n/g, " ")))));
    v.append(h("div", { class: "card watch-lines" },
      h("div", { class: "row spread" }, h("h2", { class: "h-card" }, L.lines), h("span", { class: "muted small" }, watch.cues.length + " " + L.count)),
      list,
      h("button", { class: "btn small", type: "button", onclick: () => {
        commitReader({ text: watch.cues.map(c => c.text).join("\n").slice(0, READER_MAX), title: watch.subName || watch.name, page: 0 }); go("reader");
      } }, L.reader)));
    // 4. the offer: flashcards from the words
    const words = watchWords();
    if (words.length) v.append(wordDeckCard({ id: "watch-deck", words, holder: watch, name: (watch.name.replace(/\.[a-z0-9]{2,4}$/i, "") || L.media).slice(0, 30), what: L.what,
      clip: watchClip, video: { name: watch.name, size: watch.file.size, a: isAudio() } }));
  }
  // Two columns on wide screens: the player (and the flashcard maker) on the left, the text and every line
  // on the right. On phones the columns melt away (CSS display: contents) and the boxes stack in order.
  const left = h("div", { class: "watch-col watch-left" }), right = h("div", { class: "watch-col watch-right" });
  for (const c of [...v.children]) if (c.matches(".card")) (c.matches(".watch-card, .photo-deck") ? left : right).append(c);
  v.append(h("div", { class: "watch-cols" }, left, right));
  setTimeout(() => { watch.shown = -2; watchShow(cueAt(video.currentTime || 0)); if (!video.paused) watchTick(); }, 0);
  return v;
}
