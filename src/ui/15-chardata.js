/* LearnZì UI, part 2b: character data and the stroke-order writer.
 * Stroke shapes (Arphic Public License, via Make Me a Hanzi / hanzi-writer-data) live in 48 small
 * packed files next to the page (see fetchPacked) and are fetched only when a character is opened. The animation and
 * practice come from Hanzi Writer (MIT), pinned to 3.7.3 and checked with a security fingerprint. */

const CharData = {
  chunks: new Map(), stories: null, sentences: null,
  /** Stroke data for one character, or null if there isn't any. */
  strokes(ch) {
    if (!ch || [...ch].length !== 1) return Promise.resolve(null);
    const i = ch.codePointAt(0) % 48;
    if (!this.chunks.has(i)) {
      this.chunks.set(i, fetchPackedJSON("strokes/s" + String(i).padStart(2, "0") + ".json").catch(() => { this.chunks.delete(i); return {}; }));
    }
    return this.chunks.get(i).then(c => {
      const d = c && Object.hasOwn(c, ch) ? c[ch] : null;
      const ok = d && Array.isArray(d.strokes) && d.strokes.every(s => typeof s === "string") && Array.isArray(d.medians);
      return ok ? d : null;
    });
  },
  /** [type, hint, semantic part, sound part, radical, decomposition] or null. */
  story(ch) {
    if (!this.stories) this.stories = fetchPackedJSON("chars.json").catch(() => { this.stories = null; return {}; });
    return this.stories.then(all => {
      const s = all && Object.hasOwn(all, ch) ? all[ch] : null;
      return Array.isArray(s) && s.length === 6 && s.every(x => typeof x === "string") ? s : null;
    });
  },
  /** All example sentences as [zhId, chinese, enId, english], shortest first. */
  allSentences() {
    if (!this.sentences) {
      this.sentences = fetchPackedText("sentences.txt").catch(() => { this.sentences = null; return ""; }).then(t => t.split("\n").map(l => l.split("\t"))
        .filter(c => c.length === 4 && /^\d+$/.test(c[0]) && /^\d+$/.test(c[2])).map(c => [c[0], c[1], c[2], c[3]])).catch(() => []);
    }
    return this.sentences;
  },
};

/** A theme colour as a plain rgb()/hex string (the writer can't read CSS variables). */
function cssColor(token, fallback) {
  const probe = h("span", { style: "position:absolute;visibility:hidden;color:var(" + token + ")" });
  document.body.append(probe);
  let c = getComputedStyle(probe).color;
  probe.remove();
  const m = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(c);
  if (m) c = "rgb(" + [m[1], m[2], m[3]].map(x => Math.round(Number(x) * 255)).join(", ") + ")";
  return /^(rgb|#)/.test(c) ? c : fallback;
}
const writerReady = () => typeof window.HanziWriter === "function" || (window.HanziWriter && typeof window.HanziWriter.create === "function");

/** Draw one character in `box` in ink. Returns the writer, or null if Hanzi Writer didn't load. */
function makeWriter(box, ch, size, extra) {
  if (!writerReady()) return null;
  const ink = cssColor("--ink", "#1c211e");
  const speed = state.strokeSpeed || 1;
  return window.HanziWriter.create(box, ch, Object.assign({
    width: size, height: size, padding: Math.round(size * 0.06),
    showOutline: true, showCharacter: true,
    strokeColor: ink,
    radicalColor: state.radical ? cssColor("--accent", "#c2362b") : null,
    outlineColor: cssColor("--line", "#d9ddd5"),
    highlightColor: cssColor("--accent", "#c2362b"),
    drawingColor: cssColor("--ink-soft", "#5d655f"),
    drawingWidth: Math.max(4, Math.round(size / 40)),
    strokeAnimationSpeed: speed,
    delayBetweenStrokes: Math.round(320 / speed),
    delayBetweenLoops: 1600,
    charDataLoader: (c, onLoad, onError) => { CharData.strokes(c).then(d => (d ? onLoad(d) : onError("No stroke data"))); },
  }, extra || {}));
}
