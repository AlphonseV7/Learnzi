/* LearnZì UI, part 6a: reading Chinese text in a photo, entirely on this device.
 * Models: PP-OCRv5 mobile text detection and recognition (PaddleOCR, Apache-2.0; the recognition model's
 * last layers stored as 8-bit numbers to halve its size, see tools/build_ocr.py), run by ONNX Runtime Web
 * (MIT, pinned 1.23.2). Every file is served with the app from ocr/ (the runtime and both models packed,
 * see fetchPacked) and kept, unpacked, in the browser's cache after the first use. The photo never
 * leaves the device. */

const OCR = { base: "ocr/", files: { det: "det.ort", rec: "rec.onnx", keys: "keys.txt", wasm: "ort-wasm-simd-threaded.wasm" }, packed: ["det.ort", "rec.onnx", "ort-wasm-simd-threaded.wasm"],
  cache: "learnzi-ocr-2", oldCaches: ["learnzi-ocr-1"], approxMB: 20.5 };
let ocrEngine = null;   // a promise of { det, rec, keys }

function loadScriptOnce(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector('script[data-src="' + src + '"]')) return ok();
    const s = document.createElement("script");
    s.src = src; s.dataset.src = src; s.async = true;
    s.onload = () => ok(); s.onerror = () => fail(new Error("load " + src));
    document.head.append(s);
  });
}
/** Fetch a file as bytes, from the browser's cache when we have it, reporting bytes as they arrive.
 *  Packed files are unpacked once and cached unpacked. */
async function ocrFetch(name, onBytes) {
  const url = new URL(OCR.base + name, document.baseURI).href;
  let cache = null;
  try {
    for (const old of OCR.oldCaches) await caches.delete(old);   // the earlier, unpacked copies
    cache = await caches.open(OCR.cache); const hit = await cache.match(url);
    if (hit) { const b = await hit.arrayBuffer(); onBytes(b.byteLength / 2); return b; }
  } catch { cache = null; }
  if (OCR.packed.includes(name)) {
    const bytes = await fetchPacked(OCR.base + name, onBytes);
    const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    if (cache) try { await cache.put(url, new Response(buf.slice(0))); } catch { /* storage full or not allowed: fine */ }
    return buf;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch " + name + " " + res.status);
  let buf;
  if (res.body && res.body.getReader) {
    const reader = res.body.getReader(), parts = [];
    let n = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
    const all = new Uint8Array(n); let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    buf = all.buffer;
  } else { buf = await res.arrayBuffer(); onBytes(buf.byteLength); }
  if (cache) try { await cache.put(url, new Response(buf.slice(0))); } catch { /* storage full or not allowed: fine */ }
  return buf;
}
/** Get the reader ready (first time: download about 20 MB). onProgress(fraction) while downloading. */
function ocrLoad(onProgress = () => {}) {
  if (!ocrEngine) {
    ocrEngine = (async () => {
      let got = 0; const want = OCR.approxMB * 1024 * 1024;
      const tick = n => { got += n; onProgress(Math.min(0.99, got / want)); };
      await loadScriptOnce(OCR.base + "ort.wasm.min.js");
      const ort = window.ort;
      if (!ort) throw new Error("runtime missing");
      const [wasm, det, rec, keys] = await Promise.all([OCR.files.wasm, OCR.files.det, OCR.files.rec, OCR.files.keys].map(f => ocrFetch(f, tick)));
      ort.env.logLevel = "error";            // no console chatter about CPU details
      ort.env.wasm.numThreads = 1;          // no worker threads: works without special page headers
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = new URL(OCR.base, document.baseURI).href;
      ort.env.wasm.wasmBinary = wasm;
      const opts = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
      const sDet = await ort.InferenceSession.create(new Uint8Array(det), opts);
      const sRec = await ort.InferenceSession.create(new Uint8Array(rec), opts);
      // The key list already holds the "blank" (first line) and the space (last line).
      const list = new TextDecoder().decode(keys).split("\n");
      if (list.length && list[list.length - 1] === "" && list.length > 18385) list.pop();
      onProgress(1);
      return { ort, det: sDet, rec: sRec, keys: list };
    })().catch(err => { ocrEngine = null; throw err; });
  }
  return ocrEngine;
}

// ---------- detection: where is the text? ----------
const DET_MAX = 1280;
function toTensorBGR(ort, ctx, w, h, mean, std) {
  const px = ctx.getImageData(0, 0, w, h).data, n = w * h, out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    out[i] = (b - mean[0]) / std[0]; out[n + i] = (g - mean[1]) / std[1]; out[2 * n + i] = (r - mean[2]) / std[2];
  }
  return new ort.Tensor("float32", out, [1, 3, h, w]);
}
async function ocrDetect(eng, src) {
  const W = src.width, H = src.height;
  const s = Math.min(1, DET_MAX / Math.max(W, H));
  const nw = Math.max(32, Math.round(W * s / 32) * 32), nh = Math.max(32, Math.round(H * s / 32) * 32);
  const c = document.createElement("canvas"); c.width = nw; c.height = nh;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, nw, nh);
  const t = toTensorBGR(eng.ort, ctx, nw, nh, [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]);
  const out = await eng.det.run({ [eng.det.inputNames[0]]: t });
  const prob = out[eng.det.outputNames[0]].data;
  // Join neighbouring "text" pixels into blobs (4-connected), one box per blob.
  const n = nw * nh, lab = new Int32Array(n), stack = new Int32Array(n), boxes = [];
  let id = 0;
  for (let i = 0; i < n; i++) {
    if (lab[i] || prob[i] <= 0.3) continue;
    id++; let sp = 0, x0 = nw, y0 = nh, x1 = 0, y1 = 0, area = 0, sum = 0;
    stack[sp++] = i; lab[i] = id;
    while (sp) {
      const k = stack[--sp], x = k % nw, y = (k - x) / nw;
      area++; sum += prob[k];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x > 0 && !lab[k - 1] && prob[k - 1] > 0.3) { lab[k - 1] = id; stack[sp++] = k - 1; }
      if (x < nw - 1 && !lab[k + 1] && prob[k + 1] > 0.3) { lab[k + 1] = id; stack[sp++] = k + 1; }
      if (y > 0 && !lab[k - nw] && prob[k - nw] > 0.3) { lab[k - nw] = id; stack[sp++] = k - nw; }
      if (y < nh - 1 && !lab[k + nw] && prob[k + nw] > 0.3) { lab[k + nw] = id; stack[sp++] = k + nw; }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (Math.min(bw, bh) < 3 || sum / area < 0.6) continue;
    const d = area * 1.5 / (2 * (bw + bh));               // grow the box a little, like PaddleOCR's "unclip"
    const sx = W / nw, sy = H / nh;
    boxes.push({
      x: Math.max(0, (x0 - d) * sx), y: Math.max(0, (y0 - d) * sy),
      w: Math.min(W, (x1 + 1 + d) * sx) - Math.max(0, (x0 - d) * sx), h: Math.min(H, (y1 + 1 + d) * sy) - Math.max(0, (y0 - d) * sy),
    });
  }
  return boxes;
}

// ---------- recognition: what does each box say? ----------
const isCol = b => b.h >= 1.5 * b.w && b.h > 40;
/** turn: "ccw" reads a tall box as a top-to-bottom column; "cw" as a sideways line that runs bottom to top. */
async function ocrRecognise(eng, src, b, turn = isCol(b) ? "ccw" : "") {
  const side = turn === "ccw" || turn === "cw";
  const bw = side ? b.h : b.w, bh = side ? b.w : b.h;
  const tw = Math.max(16, Math.min(3200, Math.round(48 * bw / bh)));
  const c = document.createElement("canvas"); c.width = tw; c.height = 48;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingQuality = "high";
  if (turn === "ccw") { ctx.translate(0, 48); ctx.rotate(-Math.PI / 2); ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, 48, tw); }
  else if (turn === "180") { ctx.translate(tw, 48); ctx.rotate(Math.PI); ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, tw, 48); }
  else if (turn === "cw") { ctx.translate(tw, 0); ctx.rotate(Math.PI / 2); ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, 48, tw); }
  else ctx.drawImage(src, b.x, b.y, b.w, b.h, 0, 0, tw, 48);
  const t = toTensorBGR(eng.ort, ctx, tw, 48, [0.5, 0.5, 0.5], [0.5, 0.5, 0.5]);
  const out = (await eng.rec.run({ [eng.rec.inputNames[0]]: t }))[eng.rec.outputNames[0]];
  const [, T, C] = out.dims, p = out.data;
  const chars = [], conf = [];
  let prev = -1;
  for (let i = 0; i < T; i++) {
    let best = 0, bv = -1;
    for (let k = 0, o = i * C; k < C; k++) if (p[o + k] > bv) { bv = p[o + k]; best = k; }
    if (best !== prev && best !== 0) { chars.push(eng.keys[best] || ""); conf.push(bv); }
    prev = best;
  }
  return { text: chars.join(""), chars, conf, box: b };
}
const sureness = r => (r.conf.length ? r.conf.reduce((a, c) => a + c, 0) / r.conf.length * Math.min(1, r.conf.length / 3) : 0);
function turned(src, half) {
  const c = document.createElement("canvas");
  c.width = half ? src.width : src.height; c.height = half ? src.height : src.width;
  const x = c.getContext("2d");
  if (half) { x.translate(c.width, c.height); x.rotate(Math.PI); } else { x.translate(c.width, 0); x.rotate(Math.PI / 2); }
  x.drawImage(src, 0, 0);
  return c;
}
/** Read all the text in a canvas or image. onStep(done, total) after each line; stop() true ends early. */
async function ocrRead(src, onStep = () => {}, stop = () => false) {
  const eng = await ocrLoad();
  let boxes = await ocrDetect(eng, src);
  // Vertical page? Vote by box area so small punctuation boxes don't decide it.
  const area = list => list.reduce((t, b) => t + b.w * b.h, 0);
  let vertical = boxes.length > 0 && area(boxes.filter(isCol)) > area(boxes) / 2;
  if (vertical) {
    // Tall boxes are either Chinese columns or a sideways photo. Try the biggest few both ways round;
    // if they read better turned clockwise, turn the whole picture and start again.
    const big = boxes.filter(isCol).sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 3);
    let col = 0, side = 0;
    for (const b of big) { col += sureness(await ocrRecognise(eng, src, b, "ccw")); side += sureness(await ocrRecognise(eng, src, b, "cw")); }
    if (side > col + 0.1 * big.length) {
      src = turned(src, false);
      boxes = await ocrDetect(eng, src);
      vertical = boxes.length > 0 && area(boxes.filter(isCol)) > area(boxes) / 2;
    }
  }
  if (!vertical && boxes.length) {
    // Upside down? Only checked when the biggest lines read poorly the right way up.
    const big = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 3);
    let up = 0;
    for (const b of big) up += sureness(await ocrRecognise(eng, src, b, ""));
    if (up / big.length < 0.8) {
      let down = 0;
      for (const b of big) down += sureness(await ocrRecognise(eng, src, b, "180"));
      if (down > up + 0.1 * big.length) { src = turned(src, true); boxes = await ocrDetect(eng, src); }
    }
  }
  // Reading order: rows top to bottom, left to right inside a row; for vertical text, columns right to left,
  // top to bottom inside a column. A box joins a row (column) when it overlaps it by half its height (width).
  const [p0, ps, q0] = vertical ? ["x", "w", "y"] : ["y", "h", "x"];
  boxes.sort((a, b) => a[p0] - b[p0]);
  const groups = [];
  for (const b of boxes) {
    const g = groups.find(r => Math.min(r.at + r.size, b[p0] + b[ps]) - Math.max(r.at, b[p0]) > 0.5 * Math.min(r.size, b[ps]));
    if (g) { g.items.push(b); const end = Math.max(g.at + g.size, b[p0] + b[ps]); g.at = Math.min(g.at, b[p0]); g.size = end - g.at; }
    else groups.push({ at: b[p0], size: b[ps], items: [b] });
  }
  if (vertical) groups.reverse();
  const order = [];
  groups.forEach(g => { g.items.sort((a, b) => a[q0] - b[q0]); g.items.forEach((b, i) => { b.join = i > 0; order.push(b); }); });
  const lines = [];
  for (let i = 0; i < order.length; i++) {
    if (stop()) break;
    const r = await ocrRecognise(eng, src, order[i]);
    if (r.text.trim()) { r.join = !!order[i].join; lines.push(r); }
    onStep(i + 1, order.length);
    await new Promise(ok => setTimeout(ok, 0));   // let the page breathe between lines
  }
  return lines;
}
