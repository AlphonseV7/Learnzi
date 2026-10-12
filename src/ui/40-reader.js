/* LearnZì UI, part 5: the Reader (paste or import text, pages, tap a word). */

const PAGE_CHARS = 1500;
const ACCEPT = ".txt,.text,.md,.markdown,.srt,.lrc,.csv,.tsv,text/plain";

/** The page of the Reader you're on, for Listen and its voice button. */
function readerPageText() { const ps = pagesOf(reader.text || readerSample()); return ps[Math.min(reader.page, ps.length - 1)] || ""; }
function pagesOf(text) {
  const pages = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(text.length, i + PAGE_CHARS);
    if (end < text.length) {
      const slice = text.slice(i, end);
      let cut = slice.lastIndexOf("\n");
      if (cut < PAGE_CHARS / 2) cut = Math.max(...["。", "！", "？", "!", "?", "…", "；"].map(p => slice.lastIndexOf(p)));
      if (cut >= PAGE_CHARS / 2) end = i + cut + 1;
      const c = text.charCodeAt(end - 1);
      if (c >= 0xd800 && c <= 0xdbff) end++; // never split a character in two
    }
    pages.push(text.slice(i, end));
    i = end;
  }
  return pages.length ? pages : [""];
}

// ---------- file import (plain text only; parsed as text, never run) ----------
function decodeText(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return new TextDecoder("utf-8").decode(buf.subarray(3));
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));
  if (buf.subarray(0, 4096).includes(0)) return null; // binary file (or UTF-16 without a marker)
  for (const enc of ["utf-8", "gb18030", "big5"]) {
    try { return new TextDecoder(enc, { fatal: true }).decode(buf); } catch { /* try the next encoding */ }
  }
  return new TextDecoder("utf-8").decode(buf);
}
function cleanImported(text, ext) {
  let t = text.replace(/\r\n?/g, "\n");
  if (ext === "srt") {
    t = t.split("\n").filter(l => !/^\s*\d+\s*$/.test(l) && !/^\s*\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(l)).join("\n").replace(/<[^>\n]*>/g, "");
  } else if (ext === "lrc") {
    t = t.replace(/\[[^\]\n]*\]/g, "");
  }
  return t.replace(/[\u0000-\u0008\u000b-\u001f\u007f﻿]/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
async function importFile(f) {
  if (f.size > 8 * 1024 * 1024) { toast("That file is over 8 MB. Try a shorter text."); return; }
  let buf;
  try { buf = new Uint8Array(await f.arrayBuffer()); } catch { toast("Couldn't open that file."); return; }
  let text = decodeText(buf);
  if (text == null) { toast("That doesn't look like a text file. Try a .txt file."); return; }
  text = cleanImported(text, (f.name.split(".").pop() || "").toLowerCase());
  if (!Engine.isCJK(text)) { toast("No Chinese characters found in that file."); return; }
  const cut = text.length > READER_MAX;
  if (cut) text = text.slice(0, READER_MAX);
  commitReader({ text, title: cleanLine(f.name, 120), page: 0 });
  render(false);
  window.scrollTo({ top: 0 });
  toast(cut ? "Imported the first 75,000 characters of " + f.name : "Imported " + f.name);
}

// ---------- the view ----------
let readerTimer = 0;
function viewReader() {
  const v = h("section", { class: "view" });
  const ta = h("textarea", { id: "reader-input", placeholder: "Paste or type Chinese here, or import a text file", lang: "zh", "aria-label": "Text to read" });
  ta.value = reader.text;
  const fileIn = h("input", { type: "file", accept: ACCEPT, id: "reader-file", class: "visually-hidden", tabindex: "-1", "aria-hidden": "true" });
  fileIn.addEventListener("change", () => { const f = fileIn.files && fileIn.files[0]; fileIn.value = ""; if (f) importFile(f); });

  const pinyin = h("button", { class: "btn", type: "button", id: "reader-pinyin", "aria-pressed": String(state.pinyin), title: "Show or hide pinyin above the characters" }, "Pinyin");
  pinyin.addEventListener("click", () => {
    commit({ pinyin: !state.pinyin });
    pinyin.setAttribute("aria-pressed", String(state.pinyin));
    applyLook();
  });

  const label = h("span", { class: "eyebrow" });
  const out = h("div", { class: "card reader-text hz", id: "reader-out", lang: "zh" });
  const navTop = h("div", { class: "pager" });
  const navBottom = h("div", { class: "pager" });
  const draw = () => {
    const text = reader.text || readerSample();
    const pages = pagesOf(text);
    const page = Math.min(reader.page, pages.length - 1);
    label.textContent = !reader.text ? "Sample text" : reader.title ? reader.title : "Your text";
    drawReader(out, pages[page]);
    for (const nav of [navTop, navBottom]) {
      nav.replaceChildren();
      if (pages.length < 2) continue;
      const turn = d => { commitReader({ page: page + d }); draw(); if (nav === navBottom) out.scrollIntoView({ block: "start" }); };
      nav.append(
        h("button", { class: "btn", type: "button", disabled: page === 0, onclick: () => turn(-1) }, icon("back"), "Previous"),
        h("span", { class: "muted small num" }, "Page " + (page + 1) + " of " + pages.length),
        h("button", { class: "btn", type: "button", disabled: page >= pages.length - 1, onclick: () => turn(1) }, "Next", icon("next")));
    }
  };
  ta.addEventListener("input", () => {
    clearTimeout(readerTimer);
    readerTimer = setTimeout(() => {
      if (ta.value.length > READER_MAX) toast("The Reader keeps the first 75,000 characters.");
      const text = ta.value.slice(0, READER_MAX);
      commitReader({ text, page: Math.min(reader.page, pagesOf(text || readerSample()).length - 1), title: text ? reader.title : "" });
      draw();
    }, 450);
  });
  out.addEventListener("click", ev => {
    const b = ev.target.closest(".w");
    if (!b) return;
    earnBadge("read");
    if (b.classList.contains("sel")) { speak(b.dataset.form); return; }
    out.querySelectorAll(".w.sel").forEach(x => x.classList.remove("sel"));
    b.classList.add("sel");
    openWord(b.dataset.form);
  });

  v.append(ta);
  v.append(h("div", { class: "row" },
    h("button", { class: "btn", type: "button", onclick: () => fileIn.click() }, icon("file"), "Import file"), fileIn,
    h("button", { class: "btn", type: "button", onclick: () => { ta.value = readerSample(); commitReader({ text: readerSample(), title: "", page: 0 }); draw(); } }, "Use sample"),
    h("button", { class: "btn", type: "button", onclick: () => { ta.value = ""; commitReader({ text: "", title: "", page: 0 }); draw(); ta.focus(); } }, "Clear")));
  v.append(h("div", { class: "stack-tight" },
    h("div", { class: "row spread" }, label, h("div", { class: "row" },
      withVoice(h("button", { class: "btn primary", type: "button", onclick: () => speak(readerPageText()) }, icon("play"), "Listen"), { text: readerPageText }),
      h("button", { class: "btn", type: "button", onclick: () => { if ("speechSynthesis" in window) speechSynthesis.cancel(); } }, "Stop"),
      pinyin)),
    navTop, out, navBottom));
  if (ui.dict === "ready") draw(); else out.append(loadingBlock());
  return v;
}
function drawReader(out, text) {
  out.replaceChildren();
  if (ui.dict !== "ready") { out.append(loadingBlock()); return; }
  for (const seg of Engine.segment(text)) {
    if (!seg.word || !seg.entries.length) { out.append(h("span", { class: "plain" }, seg.text)); continue; }
    const e = seg.entries[0];
    const shown = seg.text === e.s || seg.text === e.t ? disp(e) : seg.text;
    out.append(h("button", { class: "w", type: "button", "data-form": seg.text },
      h("ruby", null, hzEl(shown, e.p, ""), h("rt", null, pyEl(e.p)))));
  }
}
function onReaderChangedElsewhere() {
  const active = document.activeElement;
  if (ui.view === "reader" && !(active && active.id === "reader-input")) render(false);
}
