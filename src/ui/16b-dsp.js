/* LearnZì UI, part 2b: tidying recordings before they play (pure number crunching, no page access).
 * - Trim: cut the silence at each end, judged against each recording's own background noise, keeping
 *   the voice's natural fade at the end (the old trim chopped it), with a short fade in and out so
 *   nothing clicks.
 * - Level: bring every recording to the same loudness (the two speakers and individual words differ
 *   by up to 12 dB), never letting a peak go past 0.95.
 * - Stretch: slow a recording down without lowering its pitch (WSOLA: overlapping 30 ms slices,
 *   each one lined up with the last so the voice stays smooth), so "Listen slowly" keeps the tones true. */

const DSP_TARGET_DB = -16;   // loudness of the voiced part after levelling

/** Trim and level one recording. Returns a new Float32Array. */
function tidySamples(d, sr) {
  const F = Math.max(1, Math.round(sr / 100));            // 10 ms frames
  const n = Math.floor(d.length / F);
  if (n < 5) return d.slice();
  const e = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = i * F; j < (i + 1) * F; j++) s += d[j] * d[j]; e[i] = Math.sqrt(s / F); }
  let emax = 0; for (const v of e) if (v > emax) emax = v;
  if (emax < 1e-4) return d.slice();
  const quiet = a => { const s = Array.from(a).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const noise = Math.max(5e-4, Math.min(quiet(e.subarray(0, 5)), quiet(e.subarray(n - 5))));
  const thr = Math.max(noise * 3, emax * 0.004);
  let a = 0, b = n - 1;
  while (a < b && e[a] < thr) a++;
  while (b > a && e[b] < thr) b--;
  const start = Math.max(0, a * F - Math.round(sr * 0.015));
  const end = Math.min(d.length, (b + 1) * F + Math.round(sr * 0.04));
  const out = d.slice(start, end);
  // level: loudness of the voiced frames, then a peak limit
  let sum = 0, cnt = 0;
  for (let i = a; i <= b; i++) if (e[i] > emax * 0.1) { sum += e[i] * e[i]; cnt++; }
  const rms = Math.sqrt(sum / Math.max(1, cnt));
  let gain = Math.min(3, Math.max(0.5, Math.pow(10, DSP_TARGET_DB / 20) / rms));
  let peak = 0; for (const v of out) { const m = Math.abs(v); if (m > peak) peak = m; }
  if (peak * gain > 0.95) gain = 0.95 / peak;
  // short raised-cosine fades: 5 ms in, 40 ms out
  const fi = Math.min(out.length, Math.round(sr * 0.005)), fo = Math.min(out.length, Math.round(sr * 0.04));
  for (let i = 0; i < out.length; i++) {
    let g = gain;
    if (i < fi) g *= 0.5 - 0.5 * Math.cos(Math.PI * i / fi);
    const k = out.length - 1 - i;
    if (k < fo) g *= 0.5 - 0.5 * Math.cos(Math.PI * k / fo);
    out[i] *= g;
  }
  return out;
}

/** Make a recording `factor` times longer (1.25 = slower) at the same pitch. */
function stretchSamples(x, sr, factor) {
  if (factor === 1 || x.length < sr * 0.05) return x.slice();
  const N = Math.round(sr * 0.03), Hs = Math.round(N / 2), Ha = Hs / factor, tol = Math.round(sr * 0.008);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const outLen = Math.ceil(x.length * factor) + N;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  const at = i => (i >= 0 && i < x.length ? x[i] : 0);
  let prev = 0;
  for (let k = 0; k * Hs < outLen - N; k++) {
    const nominal = Math.round(k * Ha);
    if (nominal >= x.length) break;
    let pos = nominal;
    if (k > 0) {
      // find the slice near `nominal` that best continues the previous one
      const nat = prev + Hs;
      let best = -Infinity;
      for (let dlt = -tol; dlt <= tol; dlt += 2) {
        const p = nominal + dlt;
        let c = 0;
        for (let j = 0; j < N; j += 3) c += at(nat + j) * at(p + j);
        if (c > best) { best = c; pos = p; }
      }
    }
    const o = k * Hs;
    for (let j = 0; j < N; j++) { out[o + j] += win[j] * at(pos + j); norm[o + j] += win[j]; }
    prev = pos;
  }
  const len = Math.min(outLen, Math.round(x.length * factor));
  const y = new Float32Array(len);
  for (let i = 0; i < len; i++) y[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return y;
}
