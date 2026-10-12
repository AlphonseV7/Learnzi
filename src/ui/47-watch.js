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
const watch = { file: null, url: "", key: "", name: "", video: null, cues: [], subName: "", offset: 0, speed: 1, loop: false, autoPause: false,
  hide: false, cur: -1, shown: -1, earned: new Set(), pausedAt: -1, error: "", raf: 0, saveAt: 0 };

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
function watchSave() {
  if (!watch.key || !watch.video) return;
  const all = watchSaved();
  all[watch.key] = { t: Math.floor(watch.video.currentTime || 0), off: watch.offset, at: Date.now() };
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
function watchUseVideo(vid) {
  if (watch.url) URL.revokeObjectURL(watch.url);
  if (watch.video) { watch.video.pause(); watch.video.removeAttribute("src"); watch.video.load(); }
  Object.assign(watch, { file: vid, url: URL.createObjectURL(vid), key: vid.name + "|" + vid.size, name: cleanLine(vid.name, 120), video: null,
    cur: -1, shown: -1, earned: new Set(), pausedAt: -1, error: "", offset: 0, picked: null });
  const saved = watchSaved()[watch.key];
  if (saved) watch.offset = num(saved.off, -60, 60, 0);
}
async function watchOpen(files) {
  const list = [...files];
  let vid = list.find(f => /^video\//.test(f.type) || VIDEO_EXT.test(f.name));
  let refused = false;
  if (vid && !(await looksLikeVideo(vid))) { toast(cleanLine(vid.name, 60) + " isn't a video LearnZì can play (MP4, MKV, WebM or MOV)."); vid = null; refused = true; }
  const sub = list.find(f => SUB_EXT.test(f.name) && f !== vid);
  if (vid) { watchUseVideo(vid); if (!sub) { watch.cues = []; watch.subName = ""; } }
  if (sub) await watchSubs(sub);
  if (!vid && !sub && !refused) toast("Choose a video (MP4, MKV, WebM) or a subtitle file (.srt, .vtt, .lrc).");
  if (ui.view === "watch") render(false); else go("watch");
}
async function watchSubs(f) {
  if (f.size > 4 * 1024 * 1024) { toast("That subtitle file is too big."); return; }
  let text;
  try { text = decodeText(new Uint8Array(await f.arrayBuffer())); } catch { text = null; }
  const cues = text ? parseSubs(text) : [];
  if (!cues.length) { toast("Couldn't find any timed lines in " + f.name + ". Use an .srt, .vtt or .lrc file."); return; }
  watch.cues = cues; watch.subName = cleanLine(f.name, 120); watch.cur = -1; watch.shown = -1; watch.picked = null;
  if (!cues.some(c => Engine.isCJK(c.text))) toast("These subtitles have no Chinese in them.");
}

// ---------- the player ----------
function watchVideo() {
  if (watch.video) return watch.video;
  const v = h("video", { class: "watch-video", playsinline: true, controls: true, preload: "metadata" });
  v.src = watch.url;
  v.playbackRate = watch.speed;
  v.addEventListener("loadedmetadata", () => {
    const saved = watchSaved()[watch.key];
    if (saved && saved.t > 5 && saved.t < v.duration - 5 && !v.currentTime) {
      v.currentTime = saved.t;
      actionToast("Picked up where you left off (" + fmtTime(saved.t) + ")", "Start over", () => { v.currentTime = 0; });
    }
  });
  v.addEventListener("error", () => {
    watch.error = "This browser can't play this video. MP4 videos (H.264 with AAC sound) play almost everywhere; MKV works in Chrome only with some codecs.";
    if (ui.view === "watch") render(false);
  });
  v.addEventListener("play", () => { v.playbackRate = watch.speed; watchTick(); });
  v.addEventListener("pause", watchSave);
  v.addEventListener("seeking", () => { watch.pausedAt = -1; });
  v.addEventListener("seeked", () => { if (v.paused) { const i = cueAt(v.currentTime); watch.cur = i; if (i >= 0) watchShow(i); } });
  watch.video = v;
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
  if (xp) xp.textContent = "Today: " + a[5] + " / " + MEDIA_CAP + " XP from watching";
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
  if (!v || !c) return;
  watch.pausedAt = -1; watch.cur = i;
  v.currentTime = Math.max(0, c.start + watch.offset + 0.01);
  watchShow(i);
  if (play) v.play().catch(() => {});
}
function watchStep(d) {
  if (!watch.cues.length || !watch.video) return;
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
  return c ? { v: [Math.max(0, c.start + watch.offset), c.end + watch.offset], x: c.text.replace(/\n/g, " ") } : null;
};
/** The video moments saved with a word in your decks: [{ video: {name, size}, start, end, line, deck }]. */
function wordClips(e) {
  const out = [];
  for (const d of state.decks) {
    for (const w of d.words) if (w.v && w.s === e.s && w.p === e.p && d.videos && d.videos[w.v[2]]) out.push({ video: d.videos[w.v[2]], start: w.v[0], end: w.v[1], line: w.x || "", deck: d.name });
  }
  return out;
}
const watchHas = v => !!(watch.file && watch.name === v.name && watch.file.size === v.size);
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
  const pick = h("input", { type: "file", accept: "video/*,.mkv,.mp4,.webm,.mov", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const playBtn = h("button", { class: "btn small", type: "button" }, icon("play"), watchHas(c.video) ? "Play the clip" : "Open the video to play the clip");
  const play = () => {
    spot.replaceChildren();
    const v = h("video", { class: "clip-video", playsinline: true, preload: "auto" });
    v.src = watch.url; v.muted = false;
    spot.append(v);
    const stop = () => { if (v.currentTime >= c.end) { v.pause(); return; } if (!v.paused) requestAnimationFrame(stop); };
    v.addEventListener("loadedmetadata", () => { v.currentTime = c.start; v.play().then(() => requestAnimationFrame(stop)).catch(() => {}); }, { once: true });
    v.addEventListener("error", () => { spot.replaceChildren(h("p", { class: "muted small" }, "This browser can't play that video.")); });
    playBtn.lastChild.textContent = "Play again";
  };
  pick.addEventListener("change", async () => {
    const f = pick.files && pick.files[0]; pick.value = "";
    if (!f) return;
    if (cleanLine(f.name, 120) !== c.video.name) { toast("That's a different video. Choose " + c.video.name + "."); return; }
    if (!(await looksLikeVideo(f))) { toast("That file isn't a video LearnZì can play."); return; }
    watchUseVideo(f);
    watch.cues = []; watch.subName = "";
    play();
  });
  playBtn.addEventListener("click", () => { if (watchHas(c.video)) play(); else pick.click(); });
  const head = h(asBox ? "h2" : "span", { class: asBox ? "h-card" : "eyebrow" }, "From your video");
  return h("div", { class: "clip-block" + (asBox ? "" : " fc-clip") },
    head,
    text,
    h("p", { class: "muted small clip-meta" }, c.video.name + " · " + fmtTime(c.start) + (clips.length > 1 ? " · in " + clips.length + " videos" : "")),
    h("div", { class: "row" }, playBtn, pick),
    spot);
}

// ---------- the page ----------
const SUB_SIZES = [["s", "S"], ["m", "M"], ["l", "L"], ["xl", "XL"]];
function viewWatch() {
  const v = h("section", { class: "view watch-view" });
  const pickAll = h("input", { type: "file", accept: "video/*,.mkv,.mp4,.webm,.mov,.srt,.vtt,.lrc", multiple: true, class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const pickSub = h("input", { type: "file", accept: ".srt,.vtt,.lrc,.txt,text/plain", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  pickAll.addEventListener("change", () => { const f = [...(pickAll.files || [])]; pickAll.value = ""; if (f.length) watchOpen(f); });
  pickSub.addEventListener("change", async () => { const f = pickSub.files && pickSub.files[0]; pickSub.value = ""; if (f) { await watchSubs(f); render(false); } });
  const has = watch.cues.length > 0;

  if (!watch.file) {
    const card = h("div", { class: "card watch-start" },
      h("h2", { class: "h-card" }, "Video"),
      h("p", null, "Choose a video and its Chinese subtitle file (.srt, .vtt or .lrc). You can pick both at once. They stay on this device: nothing is uploaded."),
      h("div", { class: "row" },
        h("button", { class: "btn primary", type: "button", onclick: () => pickAll.click() }, icon("file"), "Choose video"),
        h("button", { class: "btn", type: "button", onclick: () => pickSub.click() }, icon("file"), has ? "Other subtitles" : "Add subtitles"), pickAll, pickSub),
      h("button", { class: "plain-btn build-link small", type: "button", onclick: async () => {
        const [vid, sub] = await Promise.all([sampleFile("sample-video.mp4", "sample-video.mp4", "video/mp4"), sampleFile("sample-subs.txt", "sample-video.srt", "text/plain")]);
        if (vid && sub) watchOpen([vid, sub]);
      } }, "No video handy? Try the sample video (a short job interview, 35 seconds)"),
      h("ul", { class: "muted small photo-tips" },
        h("li", null, "Tap any word in the subtitles: the video pauses and the word opens."),
        h("li", null, "Make flashcards from the subtitles. Each card can play the moment its word is said."),
        h("li", null, "Subtitles burned into the picture? Pause, then use Read the picture (Photo to words)."),
        h("li", null, "MP4 plays almost everywhere. MKV plays in Chrome with most, but not all, codecs."),
        h("li", null, "The Claude app can't open files: use Chrome for this page.")));
    card.addEventListener("dragover", ev => { ev.preventDefault(); card.classList.add("drag"); });
    card.addEventListener("dragleave", () => card.classList.remove("drag"));
    card.addEventListener("drop", ev => { ev.preventDefault(); card.classList.remove("drag"); if (ev.dataTransfer?.files?.length) watchOpen(ev.dataTransfer.files); });
    v.append(card);
    return v;
  }

  // 1. the video
  const video = watchVideo();
  const overlay = h("div", { class: "watch-line watch-overlay reader-text hz sub-" + state.subSize, lang: "zh" });
  const stage = h("div", { class: "watch-stage" }, video, overlay);
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
    h("div", { class: "row spread watch-head" }, h("h2", { class: "h-card" }, "Video"),
      h("div", { class: "row watch-files-btns" },
        h("button", { class: "btn small", type: "button", onclick: () => pickAll.click() }, "Another video"),
        h("button", { class: "btn small", type: "button", onclick: () => pickSub.click() }, has ? "Other subtitles" : "Add subtitles"), pickAll, pickSub)),
    h("div", { class: "row watch-files" }, fileChip("image", watch.name, "Video"), watch.subName ? fileChip("file", watch.subName, "Subtitles") : h("span", { class: "muted small" }, "No subtitles yet")),
    watch.error ? h("p", { class: "watch-error" }, watch.error) : null,
    stage,
    has ? h("div", { class: "row watch-transport" },
      h("div", { class: "row watch-steps" },
        h("button", { class: "btn icon", type: "button", "aria-label": "Previous line", title: "Previous line (←)", onclick: () => watchStep(-1) }, icon("back")),
        h("button", { class: "btn", type: "button", title: "Replay this line (R)", onclick: watchReplay }, icon("rotate"), "Replay line"),
        h("button", { class: "btn icon", type: "button", "aria-label": "Next line", title: "Next line (→)", onclick: () => watchStep(1) }, icon("next"))),
      speeds) : null,
    h("div", { class: "row watch-options" },
      has ? toggle("autoPause", "Pause after each line", "Stop at the end of every line, so you can read it") : null,
      has ? toggle("loop", "Loop line", "Play the same line over and over") : null,
      h("button", { class: "btn small", type: "button", onclick: () => { (stage.requestFullscreen ? stage.requestFullscreen() : Promise.reject()).catch(() => toast("Full screen isn't available here.")); } }, "Full screen"),
      h("button", { class: "btn small", type: "button", title: "Read the Chinese in this frame with Photo to words", onclick: watchFrame }, icon("camera"), "Read the picture")),
    h("p", { class: "muted small", id: "watch-xp" }, "Today: " + getAct()[5] + " / " + MEDIA_CAP + " XP from watching")));

  // 2. the subtitles, in their own box
  if (has) {
    const line = h("div", { class: "watch-line reader-text hz sub-" + state.subSize, lang: "zh", "aria-live": "polite" });
    line.addEventListener("click", onWord);
    const sizes = h("div", { class: "seg sub-sizes", role: "group", "aria-label": "Subtitle size" }, SUB_SIZES.map(([k, label]) =>
      h("button", { type: "button", "aria-pressed": String(state.subSize === k), title: "Subtitle size " + label, onclick: () => {
        commit({ subSize: k });
        document.querySelectorAll(".watch-line").forEach(x => { x.className = x.className.replace(/\bsub-\w+/, "sub-" + k); });
        sizes.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.textContent === label)));
      } }, label)));
    const offsetOut = h("span", { class: "small num muted" });
    const showOffset = () => { offsetOut.textContent = watch.offset ? (watch.offset > 0 ? "+" : "") + watch.offset.toFixed(1) + " s" : "in step"; };
    showOffset();
    const nudge = d => { watch.offset = Math.round((watch.offset + d) * 10) / 10; showOffset(); watch.shown = -2; watchShow(cueAt(video.currentTime)); watchSave(); };
    v.append(h("div", { class: "card watch-subs" },
      h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Subtitles"), sizes),
      line,
      h("div", { class: "row watch-options" },
        toggle("hide", "Hide subtitles", "Listen first; tap the line to peek"),
        h("span", { class: "watch-timing row" }, h("span", { class: "small muted" }, "Early or late?"),
          h("button", { class: "btn small", type: "button", title: "Show subtitles half a second earlier", onclick: () => nudge(-0.5) }, "−0.5 s"),
          h("button", { class: "btn small", type: "button", title: "Show subtitles half a second later", onclick: () => nudge(0.5) }, "+0.5 s"), offsetOut))));
  } else v.append(h("div", { class: "card watch-subs-empty" }, h("h2", { class: "h-card" }, "Subtitles"),
    h("p", { class: "muted small" }, "Add a subtitle file to see the words here. No subtitle file? Pause on a frame with subtitles and use Read the picture.")));

  // 3. every line, tap to jump
  if (has) {
    const list = h("div", { class: "watch-list", id: "watch-list" }, watch.cues.map((c, i) =>
      h("button", { class: "wl", type: "button", "data-i": String(i), onclick: () => watchJump(i) },
        h("span", { class: "wl-t num" }, fmtTime(c.start + watch.offset)), h("span", { class: "wl-x hz", lang: "zh" }, c.text.replace(/\n/g, " ")))));
    v.append(h("div", { class: "card watch-lines" },
      h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "All lines"), h("span", { class: "muted small" }, watch.cues.length + " lines")),
      list,
      h("button", { class: "btn small", type: "button", onclick: () => {
        commitReader({ text: watch.cues.map(c => c.text).join("\n").slice(0, READER_MAX), title: watch.subName || watch.name, page: 0 }); go("reader");
      } }, "Open the subtitles in the Reader")));
    // 4. the offer: flashcards from the subtitles
    const words = watchWords();
    if (words.length) v.append(wordDeckCard({ id: "watch-deck", words, holder: watch, name: (watch.name.replace(/\.[a-z0-9]{2,4}$/i, "") || "Video").slice(0, 30), what: "these subtitles",
      clip: watchClip, video: { name: watch.name, size: watch.file.size } }));
  }
  // Two columns on wide screens: the video (and the flashcard maker) on the left, the subtitles and every line
  // on the right. On phones the columns melt away (CSS display: contents) and the boxes stack in order.
  const left = h("div", { class: "watch-col watch-left" }), right = h("div", { class: "watch-col watch-right" });
  for (const c of [...v.children]) (c.matches(".watch-card, .photo-deck") ? left : right).append(c);
  v.append(h("div", { class: "watch-cols" }, left, right));
  setTimeout(() => { watch.shown = -2; watchShow(cueAt(video.currentTime || 0)); if (!video.paused) watchTick(); }, 0);
  return v;
}
