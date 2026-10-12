// Checks the recording tidy-up (src/ui/16b-dsp.js) on real recordings from dist/audio:
// even loudness, no peaks over 0.95, endings that fade to silence, and slow playback that keeps the pitch.
// Needs ffmpeg to decode the MP3s. Usage: node tools/test_dsp.js
const fs = require("fs"), path = require("path"), { execFileSync } = require("child_process");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "src/ui/16b-dsp.js"), "utf8");
const { tidySamples, stretchSamples } = new Function(src + "\nreturn { tidySamples, stretchSamples };")();
const SR = 24000;
const idx = new Map();
for (const line of fs.readFileSync(path.join(root, "dist/audio/index.txt"), "utf8").split("\n")) {
  const c = line.split("\t");
  if (c.length === 5) idx.set(c[0] + "|" + c[1], [+c[2], +c[3], +c[4]]);
}
function load(id) {
  const [f, off, len] = idx.get(id);
  const buf = fs.readFileSync(path.join(root, "dist/audio", id[0] + String(f).padStart(2, "0") + ".mp3")).subarray(off, off + len);
  const pcm = execFileSync("ffmpeg", ["-v", "quiet", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", String(SR), "pipe:1"], { input: buf });
  return new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / 4);
}
const db = v => 20 * Math.log10(v + 1e-12);
function voicedRms(x) {
  const F = SR / 100, n = Math.floor(x.length / F), e = [];
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * F; j < (i + 1) * F; j++) s += x[j] * x[j]; e.push(Math.sqrt(s / F)); }
  const m = Math.max(...e); let s = 0, c = 0;
  for (const v of e) if (v > m * 0.1) { s += v * v; c++; }
  return Math.sqrt(s / c);
}
/** Median pitch (Hz) of the voiced 40 ms frames, by autocorrelation between 80 and 400 Hz. */
function pitch(x) {
  const N = Math.round(SR * 0.04), out = [];
  let m = 0; for (const v of x) m = Math.max(m, Math.abs(v));
  for (let o = 0; o + N < x.length; o += N / 2) {
    let en = 0; for (let j = 0; j < N; j++) en += x[o + j] * x[o + j];
    if (Math.sqrt(en / N) < m * 0.15) continue;
    let best = 0, lag = 0;
    for (let L = Math.round(SR / 400); L <= Math.round(SR / 80); L++) {
      let c = 0; for (let j = 0; j + L < N; j++) c += x[o + j] * x[o + j + L];
      if (c > best) { best = c; lag = L; }
    }
    if (lag) out.push(SR / lag);
  }
  out.sort((a, b) => a - b);
  return out[Math.floor(out.length / 2)];
}
let pass = 0, fail = 0;
const check = (ok, msg) => { if (ok) pass++; else { fail++; console.log("FAIL", msg); } };
const keys = [...idx.keys()];
const pick = (kind, n) => { const k = keys.filter(x => x[0] === kind); return Array.from({ length: n }, (_, i) => k[Math.floor((i + 0.5) * k.length / n)]); };
const sample = [...pick("w", 30), ...pick("s", 30)];
const before = [], after = [];
for (const id of sample) {
  const x = load(id), y = tidySamples(x, SR);
  before.push(db(voicedRms(x))); after.push(db(voicedRms(y)));
  let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
  check(peak <= 0.951, id + " peak " + peak.toFixed(3));
  check(Math.abs(y[y.length - 1]) < 1e-3 && Math.abs(y[0]) < 1e-3, id + " ends are not silent");
  check(y.length > SR * 0.1, id + " too short after trim");
}
const spread = a => Math.max(...a) - Math.min(...a);
console.log("loudness spread before " + spread(before).toFixed(1) + " dB, after " + spread(after).toFixed(1) + " dB");
check(spread(after) < 4, "loudness still uneven");
// slow playback keeps the pitch
for (const id of [...pick("w", 6), ...pick("s", 6)]) {
  const x = tidySamples(load(id), SR), y = stretchSamples(x, SR, 1.25);
  const p0 = pitch(x), p1 = pitch(y);
  check(Math.abs(y.length / x.length - 1.25) < 0.02, id + " length ratio " + (y.length / x.length).toFixed(3));
  check(Math.abs(p1 / p0 - 1) < 0.04, id + " pitch " + p0.toFixed(0) + " → " + p1.toFixed(0) + " Hz");
}
console.log("pass=" + pass + " fail=" + fail);
process.exitCode = fail ? 1 : 0;
