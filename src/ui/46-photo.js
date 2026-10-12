/* LearnZì UI, part 6b: Photo to words. Take or choose a photo, drag a box round the text, read it on this
 * device (45-ocr), fix anything it misread, then tick the words you want and make them into a deck.
 * The photo is never uploaded or saved; only the words you pick are kept (in your decks). */

const photo = { stop: false, stopped: false, total: 0, src: null, crop: null, stage: "pick", lines: null, text: "", unsure: new Set(), edit: false, picked: null, note: "", progress: 0 };
const PHOTO_MAX = 2400;              // longest side kept in memory, in pixels
const OCR_READY_KEY = "learnzi.ocr.ready";
const ocrWasReady = () => { try { return localStorage.getItem(OCR_READY_KEY) === "1"; } catch { return false; } };

/** Turn a picked or pasted image file into a canvas (upright, at most PHOTO_MAX on its longest side). */
async function photoFromFile(file) {
  if (!file || !/^image\//.test(file.type)) { toast("That isn't a picture. Choose a photo or screenshot."); return; }
  if (file.size > 40 * 1024 * 1024) { toast("That picture is too big (over 40 MB)."); return; }
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { try { bmp = await createImageBitmap(file); } catch { toast("Couldn't open that picture."); return; } }
  const s = Math.min(1, PHOTO_MAX / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  photoUse(c);
}
/** Start Photo to words with a picture already drawn on a canvas (a photo, or a paused video frame). */
function photoUse(c, crop) {
  Object.assign(photo, { src: c, crop: crop || { x: 0.03, y: 0.03, w: 0.94, h: 0.94 }, stage: "crop", lines: null, text: "", edit: false, picked: null, stopped: false, total: 0 });
  if (!crop && c.width < 400 && c.height < 400) photo.crop = { x: 0, y: 0, w: 1, h: 1 };
  if (ui.view === "photo") render(false); else go("photo");
}
function rotatePhoto() {
  const s = photo.src, c = document.createElement("canvas");
  c.width = s.height; c.height = s.width;
  const x = c.getContext("2d");
  x.translate(c.width, 0); x.rotate(Math.PI / 2); x.drawImage(s, 0, 0);
  const { x: cx, y: cy, w, h: ch } = photo.crop;
  photo.src = c; photo.crop = { x: 1 - cy - ch, y: cx, w: ch, h: w };
  render(false);
}
/** The part of the photo inside the box, enlarged when small so little text still gets read. */
function croppedCanvas() {
  const s = photo.src, k = photo.crop;
  const sx = Math.round(k.x * s.width), sy = Math.round(k.y * s.height);
  const sw = Math.max(8, Math.round(k.w * s.width)), sh = Math.max(8, Math.round(k.h * s.height));
  const up = Math.min(3, Math.max(1, 960 / Math.max(sw, sh)));
  const c = document.createElement("canvas");
  c.width = Math.round(sw * up); c.height = Math.round(sh * up);
  const x = c.getContext("2d");
  x.imageSmoothingQuality = "high";
  x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
  x.drawImage(s, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

async function readPhoto() {
  photo.stage = "reading"; photo.progress = 0; photo.note = ocrWasReady() ? "Getting the reader ready…" : "Downloading the text reader (first time only)…";
  render(false);
  const bar = () => { const i = $("#photo-bar"); const t = $("#photo-step"); if (i) i.style.width = Math.round(photo.progress * 100) + "%"; if (t) t.textContent = photo.note; };
  try {
    await ocrLoad(f => { photo.progress = f; photo.note = ocrWasReady() ? "Getting the reader ready…" : "Downloading the text reader (first time only)… " + Math.round(f * 100) + "%"; bar(); });
    try { localStorage.setItem(OCR_READY_KEY, "1"); } catch { /* fine */ }
    photo.note = "Looking for text…"; photo.progress = 0.05; bar();
    await new Promise(ok => setTimeout(ok, 30));
    photo.stop = false; photo.total = 0;
    const lines = await ocrRead(croppedCanvas(), (d, n) => { photo.total = n; photo.progress = 0.05 + 0.95 * d / n; photo.note = "Reading line " + d + " of " + n + "…"; bar(); }, () => photo.stop);
    photo.stopped = photo.stop; photo.stop = false;
    setPhotoText(lines);
    photo.stage = "done";
  } catch (err) {
    photo.stage = "crop";
    toast("Couldn't start the text reader here. Check your connection, or try Chrome.");
    console.error(err);
  }
  if (ui.view === "photo") { render(false); const r = $("#photo-results"); if (r) r.scrollIntoView({ block: "start", behavior: "smooth" }); }
}
/** Put the read lines together as text and remember which characters it wasn't sure about. */
function setPhotoText(lines) {
  let text = "";
  const unsure = new Set();
  lines.forEach((l, i) => {
    if (i > 0) text += l.join ? "" : "\n";
    l.chars.forEach((ch, k) => { if (l.conf[k] < 0.85 && /\p{Script=Han}/u.test(ch)) unsure.add(text.length); text += ch; });
  });
  photo.lines = lines; photo.text = text; photo.unsure = unsure; photo.picked = null;
}

// ---------- the words in the text ----------
function photoWords() {
  const out = [], seen = new Set();
  if (ui.dict !== "ready") return out;
  for (const seg of Engine.segment(photo.text)) {
    if (!seg.word || !seg.entries.length) continue;
    const e = seg.entries[0], k = keyOf(e);
    if (seen.has(k)) continue;
    seen.add(k); out.push(e);
    if (out.length >= 300) break;
  }
  return out;
}

// ---------- the page ----------
function viewPhoto() {
  const v = h("section", { class: "view photo-view" });
  const take = h("input", { type: "file", accept: "image/*", capture: "environment", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  const pick = h("input", { type: "file", accept: "image/*", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  for (const inp of [take, pick]) inp.addEventListener("change", () => { const f = inp.files && inp.files[0]; inp.value = ""; if (f) photoFromFile(f); });
  const choose = h("div", { class: "row photo-pick" },
    h("button", { class: "btn" + (photo.src ? "" : " primary"), type: "button", onclick: () => take.click() }, icon("camera"), "Take a photo"),
    h("button", { class: "btn", type: "button", onclick: () => pick.click() }, icon("image"), photo.src ? "Choose another" : "Choose a picture"), take, pick);

  if (!photo.src) {
    const drop = h("div", { class: "card photo-drop" },
      h("h2", { class: "h-card" }, "Photo"),
      h("p", null, "Take a photo of Chinese text, or choose a picture or screenshot. LearnZì reads it on this device: the photo is never uploaded or saved."),
      choose,
      h("button", { class: "plain-btn build-link small", type: "button", onclick: async () => { const f = await sampleFile("sample-photo.jpg", "sample-photo.jpg", "image/jpeg"); if (f) photoFromFile(f); } }, "No picture handy? Try a sample newspaper photo"),
      h("p", { class: "muted small desk-only" }, "On a computer you can also paste a screenshot (Ctrl+V) or drop a picture here."),
      h("ul", { class: "muted small photo-tips" },
        h("li", null, "Works best on printed text and screenshots, held straight, in good light."),
        h("li", null, "Simplified and traditional characters, across or top to bottom."),
        h("li", null, "Handwriting and brush calligraphy usually won't work."),
        h("li", null, "The Claude app can't open photos: use Chrome for this page.")));
    wireDrop(drop);
    v.append(drop);
    return v;
  }

  // the photo, with a box to drag round the text
  const crop = cropper();
  const busy = photo.stage === "reading";
  const card = h("div", { class: "card photo-card" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Photo"), choose),
    h("p", { class: "muted small" }, "Drag the box round the text you want. A tight box reads best."),
    crop,
    h("div", { class: "row" },
      h("button", { class: "btn primary", type: "button", disabled: busy, onclick: readPhoto }, photo.stage === "done" ? "Read again" : "Read text"),
      h("button", { class: "btn", type: "button", disabled: busy, onclick: rotatePhoto }, icon("rotate"), "Rotate"),
      h("button", { class: "btn", type: "button", disabled: busy, onclick: () => { photo.crop = { x: 0, y: 0, w: 1, h: 1 }; render(false); } }, "Whole picture")),
    !ocrWasReady() && !busy ? h("p", { class: "muted small" }, "The first time, LearnZì downloads its text reader (about " + OCR.approxMB + " MB). After that it's kept on this device.") : null,
    busy ? h("div", { class: "stack-tight photo-progress", role: "status" },
      h("div", { class: "row spread" }, h("span", { id: "photo-step", class: "small" }, photo.note),
        h("button", { class: "btn small", type: "button", onclick: ev => { photo.stop = true; ev.currentTarget.disabled = true; ev.currentTarget.textContent = "Stopping…"; } }, "Stop")),
      h("div", { class: "bar" }, h("i", { id: "photo-bar", style: "width:" + Math.round(photo.progress * 100) + "%" }))) : null);
  wireDrop(card);
  v.append(card);
  if (photo.stage === "done") v.append(...photoResults());
  return v;
}
function wireDrop(el) {
  el.addEventListener("dragover", ev => { if ([...(ev.dataTransfer?.items || [])].some(i => i.kind === "file")) { ev.preventDefault(); el.classList.add("drag"); } });
  el.addEventListener("dragleave", () => el.classList.remove("drag"));
  el.addEventListener("drop", ev => { ev.preventDefault(); el.classList.remove("drag"); const f = ev.dataTransfer?.files?.[0]; if (f) photoFromFile(f); });
}
/** Paste a screenshot anywhere on the Photo page (or on Look up, which takes you there). */
function photoPaste(ev) {
  if (!["photo", "lookup"].includes(ui.view)) return;
  const item = [...(ev.clipboardData?.items || [])].find(i => i.kind === "file" && i.type.startsWith("image/"));
  if (!item) return;
  ev.preventDefault();
  photoFromFile(item.getAsFile());
}

/** The photo with a draggable, resizable box. The box is kept as fractions of the picture. */
function cropper() {
  const s = photo.src;
  const show = document.createElement("canvas");
  const k = Math.min(1, 1100 / Math.max(s.width, s.height));
  show.width = Math.round(s.width * k); show.height = Math.round(s.height * k);
  show.getContext("2d").drawImage(s, 0, 0, show.width, show.height);
  show.className = "crop-img";
  show.setAttribute("role", "img"); show.setAttribute("aria-label", "Your photo");
  const box = h("div", { class: "crop-box", "aria-hidden": "true" }, ["nw", "ne", "sw", "se"].map(c => h("i", { class: "crop-h " + c, "data-h": c })));
  const wrap = h("div", { class: "crop-wrap" }, show, box);
  const place = () => { const c = photo.crop; Object.assign(box.style, { left: c.x * 100 + "%", top: c.y * 100 + "%", width: c.w * 100 + "%", height: c.h * 100 + "%" }); };
  place();
  let drag = null;
  box.addEventListener("pointerdown", ev => {
    if (photo.stage === "reading") return;
    ev.preventDefault();
    const r = wrap.getBoundingClientRect();
    drag = { mode: ev.target.dataset.h || "move", x: ev.clientX, y: ev.clientY, r, start: { ...photo.crop } };
    box.setPointerCapture(ev.pointerId);
  });
  box.addEventListener("pointermove", ev => {
    if (!drag) return;
    const dx = (ev.clientX - drag.x) / drag.r.width, dy = (ev.clientY - drag.y) / drag.r.height, s0 = drag.start, MIN = 0.05;
    let { x, y, w, h: hh } = s0;
    if (drag.mode === "move") { x = Math.min(1 - w, Math.max(0, x + dx)); y = Math.min(1 - hh, Math.max(0, y + dy)); }
    else {
      if (drag.mode.includes("w")) { const nx = Math.min(s0.x + s0.w - MIN, Math.max(0, s0.x + dx)); w = s0.w + (s0.x - nx); x = nx; }
      if (drag.mode.includes("e")) w = Math.min(1 - s0.x, Math.max(MIN, s0.w + dx));
      if (drag.mode.includes("n")) { const ny = Math.min(s0.y + s0.h - MIN, Math.max(0, s0.y + dy)); hh = s0.h + (s0.y - ny); y = ny; }
      if (drag.mode.includes("s")) hh = Math.min(1 - s0.y, Math.max(MIN, s0.h + dy));
    }
    photo.crop = { x, y, w, h: hh };
    place();
  });
  const end = () => { drag = null; };
  box.addEventListener("pointerup", end);
  box.addEventListener("pointercancel", end);
  return wrap;
}

function photoResults() {
  const chars = [...photo.text].filter(c => /\p{Script=Han}/u.test(c)).length;
  // 1. the text it found, tappable like the Reader, with unsure characters marked
  const out = h("div", { class: "reader-text hz photo-text", lang: "zh" });
  const ta = h("textarea", { class: "photo-edit", lang: "zh", "aria-label": "Text found in the photo" });
  ta.value = photo.text;
  if (!photo.text.trim()) out.append(h("p", { class: "muted" }, "No Chinese text found. Try a tighter box round the text, rotate the photo, or take it again in better light."));
  else drawPhotoText(out);
  out.addEventListener("click", ev => {
    const b = ev.target.closest(".w");
    if (!b) return;
    if (b.classList.contains("sel")) { speak(b.dataset.form); return; }
    out.querySelectorAll(".w.sel").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
    openWord(b.dataset.form);
  });
  const editBtn = h("button", { class: "btn", type: "button", "aria-pressed": String(photo.edit), onclick: () => {
    if (photo.edit) { photo.text = ta.value.slice(0, READER_MAX); photo.unsure = new Set(); photo.picked = null; }
    photo.edit = !photo.edit; render(false);
  } }, photo.edit ? "Done" : "Fix text");
  const unsureN = photo.unsure.size;
  const textCard = h("div", { class: "card", id: "photo-results" },
    h("div", { class: "row spread" }, h("h2", { class: "h-card" }, "Text found"),
      h("span", { class: "muted small" }, chars + (chars === 1 ? " character" : " characters"))),
    photo.stopped ? h("p", { class: "muted small" }, "Stopped early: this is the text read so far.") : null,
    (photo.total || 0) > 60 && !photo.edit ? h("p", { class: "muted small" }, "That's a lot of text. For a faster, tidier result, drag the box round one article or column and read again.") : null,
    unsureN && !photo.edit ? h("p", { class: "muted small" }, h("span", { class: "unsure-key" }, "字"), " Dotted characters may be misread (" + unsureN + "). Check them against the photo, and use Fix text to correct them.") : null,
    photo.edit ? ta : out,
    h("div", { class: "row" }, editBtn,
      withVoice(h("button", { class: "btn", type: "button", disabled: !photo.text.trim(), onclick: () => speak(photo.text) }, icon("play"), "Listen"), { text: () => photo.text }),
      h("button", { class: "btn", type: "button", disabled: !photo.text.trim(), onclick: () => {
        commitReader({ text: photo.text.slice(0, READER_MAX), title: "Photo · " + photoDay(), page: 0 }); go("reader");
      } }, "Open in Reader")));
  if (photo.edit) setTimeout(() => ta.focus(), 0);

  // 2. the offer: make flashcards from the words
  const words = photoWords();
  if (!words.length || photo.edit) return [textCard];
  return [textCard, wordDeckCard({ id: "photo-deck", words, holder: photo, name: "Photo · " + photoDay(), what: "this photo" })];
}
const photoDay = () => new Date(clock()).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
function drawPhotoText(out) {
  out.replaceChildren();
  if (ui.dict !== "ready") { out.append(loadingBlock()); return; }
  let at = 0;
  const marked = (s, from) => { for (let i = 0; i < s.length; i++) if (photo.unsure.has(from + i)) return true; return false; };
  for (const seg of Engine.segment(photo.text)) {
    const from = at; at += seg.text.length;
    if (!seg.word || !seg.entries.length) {
      // keep line breaks; mark unsure characters that aren't dictionary words too
      seg.text.split(/(\n)/).forEach((part, i, all) => {
        if (part === "\n") out.append(h("br"));
        else if (part) out.append(h("span", { class: "plain" + (marked(part, from + all.slice(0, i).join("").length) ? " unsure" : "") }, part));
      });
      continue;
    }
    const e = seg.entries[0];
    const shown = seg.text === e.s || seg.text === e.t ? disp(e) : seg.text;
    out.append(h("button", { class: "w" + (marked(seg.text, from) ? " unsure" : ""), type: "button", "data-form": seg.text },
      h("ruby", null, hzEl(shown, e.p, ""), h("rt", null, pyEl(e.p)))));
  }
}
