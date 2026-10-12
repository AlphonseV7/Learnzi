/* LearnZì engine: dictionary loading, pinyin, search and word splitting.
 * No DOM access here; the UI file does all rendering. MIT licence. */
const Engine = (() => {
  "use strict";

  // ---------- data ----------
  // Each entry: { i, t, s, p (numbered pinyin), d (defs, " / " joined), h (HSK 0-6), f (frequency) }
  let entries = [];
  const byForm = new Map();   // simplified or traditional form -> [entry index]
  const formFreq = new Map(); // form -> best frequency (for word splitting)
  const pyLoose = new Map();  // toneless pinyin key -> [entry index]
  let pyKeys = [];            // [key, index] for prefix search
  let enIndex = null;         // built on first English search
  let maxLen = 1;
  let logTotal = 0;
  let ready = false;

  const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ebef}]/u;
  const CJK_RUN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u{20000}-\u{2ebef}\u3007]+/gu;

  function addTo(map, key, val) {
    const a = map.get(key);
    if (a) { if (a[a.length - 1] !== val) a.push(val); } else map.set(key, [val]);
  }

  function parse(text) {
    entries = [];
    byForm.clear(); formFreq.clear(); pyLoose.clear(); enIndex = null;
    const lines = text.split("\n");
    let total = 0;
    for (const line of lines) {
      if (!line) continue;
      const c = line.split("\t");
      if (c.length !== 6) continue;
      const s = c[1];
      const t = c[0] || s;
      const e = { i: entries.length, t, s, p: c[2], d: c[3], h: +c[4] || 0, f: +c[5] || 0 };
      entries.push(e);
      addTo(byForm, s, e.i);
      if (t !== s) addTo(byForm, t, e.i);
      for (const form of t === s ? [s] : [s, t]) {
        const len = [...form].length;
        if (len > maxLen && len <= 12) maxLen = len;
        if (e.f > (formFreq.get(form) || 0)) formFreq.set(form, e.f);
        else if (!formFreq.has(form)) formFreq.set(form, 0);
      }
      total += e.f;
      addTo(pyLoose, looseKey(e.p), e.i);
    }
    pyKeys = [...pyLoose.keys()].sort();
    logTotal = Math.log(total || 1);
    ready = true;
    return entries.length;
  }

  // ---------- pinyin ----------
  const MARKS = { a: "āáǎàa", e: "ēéěèe", i: "īíǐìi", o: "ōóǒòo", u: "ūúǔùu", "ü": "ǖǘǚǜü" };
  const UNMARK = {};
  for (const [base, row] of Object.entries(MARKS)) [...row].forEach((ch, k) => { UNMARK[ch] = [base, k + 1]; });

  function markSyllable(syl) {
    const m = /^([A-Za-zÜü:]+?)([1-5])$/.exec(syl);
    if (!m) return { text: syl.replace(/u:/g, "ü").replace(/U:/g, "Ü"), tone: 0 };
    let body = m[1].replace(/u:/g, "ü").replace(/U:/g, "Ü").replace(/v/g, "ü").replace(/V/g, "Ü");
    const tone = +m[2];
    if (tone === 5 || /^r$/i.test(body)) return { text: body, tone: 5 };
    const low = body.toLowerCase();
    let at = low.indexOf("a");
    if (at < 0) at = low.indexOf("e");
    if (at < 0) at = low.indexOf("ou");
    if (at < 0) for (let k = low.length - 1; k >= 0; k--) if ("aeiouü".includes(low[k])) { at = k; break; }
    if (at < 0) return { text: body, tone };
    const ch = low[at];
    let marked = MARKS[ch][tone - 1];
    if (body[at] !== ch) marked = marked.toUpperCase();
    return { text: body.slice(0, at) + marked + body.slice(at + 1), tone };
  }

  /** Numbered pinyin -> [{text, tone}] per syllable (tone 0 = not a syllable). */
  function syllables(numbered) {
    return numbered.split(/\s+/).filter(Boolean).map(markSyllable);
  }
  function toMarks(numbered) { return syllables(numbered).map(x => x.text).join(" "); }

  function stripMarks(str) {
    let out = "";
    for (const ch of str.normalize("NFC")) out += UNMARK[ch] ? UNMARK[ch][0] : ch;
    return out;
  }
  function hasMarks(str) { for (const ch of str.normalize("NFC")) if (UNMARK[ch] && UNMARK[ch][1] < 5) return true; return false; }

  function looseKey(p) {
    return stripMarks(p.toLowerCase()).replace(/u:|ü/g, "v").replace(/[^a-z]/g, "");
  }
  function numberedKey(p) { return p.toLowerCase().replace(/u:|ü/g, "v").replace(/[^a-z0-9]/g, ""); }
  function markedKey(p) { return toMarks(p).toLowerCase().replace(/[^\p{L}]/gu, ""); }

  // "ni3hao" matches "ni3hao3": digits in the query must agree, missing digits are wildcards.
  function tonesAgree(q, key) {
    let i = 0, j = 0;
    while (i < q.length && j < key.length) {
      const a = q[i], b = key[j];
      const ad = a >= "0" && a <= "9", bd = b >= "0" && b <= "9";
      if (bd) { if (ad) { if (a !== b && !(a === "5" && b === "5")) return false; i++; } j++; }
      else if (ad) return false;
      else if (a === b) { i++; j++; }
      else return false;
    }
    while (j < key.length && key[j] >= "0" && key[j] <= "9") j++;
    return i === q.length && j === key.length;
  }

  // ---------- helpers ----------
  function get(i) { return entries[i]; }
  function senses(e) { return e.d.split(" / ").filter(x => !x.startsWith("CL:")); }
  function measureWords(e) {
    const out = [];
    for (const sense of e.d.split(" / ")) {
      if (!sense.startsWith("CL:")) continue;
      for (const part of sense.slice(3).split(",")) {
        const m = /^([^\[|]+)(?:\|([^\[]+))?\[([^\]]+)\]/.exec(part.trim());
        if (m) out.push({ t: m[1], s: m[2] || m[1], p: m[3] });
      }
    }
    return out;
  }
  function hasSorted(arr, x) {
    let lo = 0, hi = arr.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m] === x) return true; if (arr[m] < x) lo = m + 1; else hi = m - 1; }
    return false;
  }
  // Names (capitalised pinyin), surnames and variant pointers come after everyday readings.
  const minor = e => (/^[A-Z]/.test(e.p) || /^(surname |variant of|old variant of|see )/i.test(e.d) ? 1 : 0);
  function rankCmp(a, b) {
    const ha = a.h || 9, hb = b.h || 9;
    if (ha !== hb) return ha - hb;
    const ma = minor(a), mb = minor(b);
    if (ma !== mb) return ma - mb;
    return b.f - a.f;
  }
  function lookup(form) { return (byForm.get(form) || []).map(get).sort(rankCmp); }
  function isCJK(str) { return CJK.test(str); }

  // ---------- search ----------
  function searchChars(q) {
    const groups = [];
    const exact = lookup(q);
    if (exact.length) groups.push({ title: "Exact match", items: exact });
    const seen = new Set(exact.map(e => e.i));
    const starts = [], contains = [];
    for (const e of entries) {
      if (seen.has(e.i)) continue;
      const hit = e.s.includes(q) ? e.s : (e.t.includes(q) ? e.t : null);
      if (!hit) continue;
      (hit.startsWith(q) ? starts : contains).push(e);
      if (starts.length + contains.length > 400) break;
    }
    if (!exact.length && [...q].length > 1) {
      const parts = segment(q).filter(x => x.word);
      if (parts.length > 1) groups.push({ title: "Words in your text", items: parts.map(x => x.entries[0]) });
    }
    const more = starts.sort(rankCmp).concat(contains.sort(rankCmp)).slice(0, 40);
    if (more.length) groups.push({ title: "Words containing it", items: more });
    return groups;
  }

  function searchPinyin(raw) {
    const q = raw.toLowerCase().trim();
    const loose = looseKey(q);
    if (!loose || !/^[a-zü:v\d\s'āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+$/i.test(q)) return { exact: [], prefix: [] };
    let exact = (pyLoose.get(loose) || []).map(get);
    if (/\d/.test(q)) {
      const nq = numberedKey(q);
      exact = exact.filter(e => tonesAgree(nq, numberedKey(e.p)));
    } else if (hasMarks(q)) {
      const mq = q.normalize("NFC").replace(/[^\p{L}]/gu, "");
      const strict = exact.filter(e => markedKey(e.p) === mq);
      if (strict.length) exact = strict;
    }
    exact.sort(rankCmp);
    const prefix = [];
    if (loose.length >= 2 && !/\d/.test(q)) {
      let lo = 0, hi = pyKeys.length;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (pyKeys[mid] < loose) lo = mid + 1; else hi = mid; }
      for (let k = lo; k < pyKeys.length && pyKeys[k].startsWith(loose); k++) {
        if (pyKeys[k] === loose) continue;
        for (const i of pyLoose.get(pyKeys[k])) prefix.push(get(i));
        if (prefix.length > 3000) break;
      }
      prefix.sort(rankCmp);
    }
    return { exact: exact.slice(0, 60), prefix: prefix.slice(0, 30) };
  }

  const STOP = new Set(["a", "an", "the", "to", "of", "sb", "sth", "one's", "oneself"]);
  function words(str) { return str.toLowerCase().replace(/\([^)]*\)/g, " ").split(/[^a-z0-9'-]+/).filter(Boolean); }
  function buildEnglish() {
    enIndex = new Map();
    for (const e of entries) {
      const seen = new Set();
      for (const w of words(e.d)) {
        if (w.length < 2 && w !== "i") continue;
        if (seen.has(w)) continue;
        seen.add(w);
        addTo(enIndex, w, e.i);
      }
    }
  }
  const WEAK = /^(variant of|old variant of|see |surname |used in |\(old\)|\(literary\)|\(archaic\)|\(dialect\)|\(classical\)|japanese variant|archaic variant)/;
  function normSense(s) {
    return s.toLowerCase().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim()
      .replace(/^(to|a|an|the) /, "").replace(/[.!?]+$/, "");
  }
  function searchEnglish(raw) {
    if (!enIndex) buildEnglish();
    const q = normSense(raw);
    const qw = words(q).filter(w => !STOP.has(w));
    const keys = qw.length ? qw : words(q);
    if (!keys.length) return [];
    let cand = null;
    for (const w of keys) {
      const list = enIndex.get(w) || [];
      cand = cand ? cand.filter(i => hasSorted(list, i)) : list.slice();
      if (!cand.length) return [];
    }
    const re = new RegExp("(^|[^a-z0-9])" + keys.map(k => k.replace(/[-']/g, "\\$&")).join("[^a-z0-9]+(?:\\w+[^a-z0-9]+){0,2}") + "($|[^a-z0-9])");
    const scored = [];
    for (const i of cand) {
      const e = get(i);
      let best = 9;
      senses(e).forEach((sense, k) => {
        const n = normSense(sense);
        const parts = n.split(/[;,]\s*/).map(normSense);
        let cls = 9;
        if (n === q || parts.includes(q)) cls = 0;
        else if (re.test(n)) cls = 2;
        else return;
        if (k > 0) cls += 1;                       // later senses rank below the main meaning
        if (WEAK.test(sense.toLowerCase())) cls += 4;
        if (cls < best) best = cls;
      });
      if (best < 9) scored.push([best, e, senses(e).length === 1 ? 0 : 1]);
    }
    // main meaning first, then HSK level, then single-meaning words, then frequency
    scored.sort((a, b) => a[0] - b[0] || (a[1].h || 9) - (b[1].h || 9) || a[2] - b[2] || b[1].f - a[1].f);
    return scored.slice(0, 60).map(x => x[1]);
  }

  /** Returns groups [{title, items}] for any query. */
  function search(raw) {
    const q = (raw || "").trim();
    if (!q || !ready) return [];
    if (isCJK(q)) return searchChars(q.replace(/\s+/g, ""));
    const py = searchPinyin(q);
    const toned = /\d/.test(q) || hasMarks(q);
    const en = toned ? [] : searchEnglish(q);
    const groups = [];
    const pyGroup = py.exact.length ? { title: "Pinyin", items: py.exact } : null;
    const enGroup = en.length ? { title: "English", items: en } : null;
    const enStrong = en.length && normSense(senses(en[0])[0] || "") === normSense(q);
    if (pyGroup && (toned || !enStrong)) groups.push(pyGroup);
    if (enGroup) groups.push(enGroup);
    if (pyGroup && !groups.includes(pyGroup)) groups.push(pyGroup);
    if (py.prefix.length && groups.length < 3) groups.push({ title: "Pinyin starting with “" + q + "”", items: py.prefix });
    return groups;
  }

  // ---------- word splitting ----------
  /** Splits text into [{text, word: bool, entries}] using the most probable route (as in jieba). */
  function segment(text) {
    const out = [];
    let last = 0;
    for (const m of text.matchAll(CJK_RUN)) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), word: false, entries: [] });
      for (const w of splitRun(m[0])) out.push({ text: w, word: true, entries: lookup(w) });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ text: text.slice(last), word: false, entries: [] });
    return out;
  }
  function splitRun(run) {
    const ch = [...run];
    const n = ch.length;
    const best = new Float64Array(n + 1).fill(-Infinity);
    const from = new Int32Array(n + 1);
    best[0] = 0;
    for (let i = 0; i < n; i++) {
      if (best[i] === -Infinity) continue;
      let w = "";
      for (let L = 1; L <= maxLen && i + L <= n; L++) {
        w += ch[i + L - 1];
        const known = formFreq.has(w);
        if (!known && L > 1) continue;
        const f = formFreq.get(w) || 0;
        const score = best[i] + Math.log(f + 1) - logTotal;
        if (score > best[i + L]) { best[i + L] = score; from[i + L] = i; }
      }
    }
    const parts = [];
    for (let j = n; j > 0; j = from[j]) parts.unshift(ch.slice(from[j], j).join(""));
    return parts;
  }

  // ---------- extras ----------
  /** Common words that use a character (HSK words first, then by frequency). */
  function wordsWith(ch, n) {
    const out = [];
    for (const e of entries) {
      if (e.s === ch || !(e.s.includes(ch) || e.t.includes(ch))) continue;
      const len = [...e.s].length;
      if (len < 2 || len > 4 || WEAK.test(e.d.toLowerCase()) || /^[A-Z]/.test(e.p)) continue;
      out.push(e);
      if (out.length >= 400) break;
    }
    const seen = new Set();
    return out.sort(rankCmp).filter(e => !seen.has(e.s) && seen.add(e.s)).slice(0, n || 8);
  }
  /** How common a word is, from its place in the frequency-sorted dictionary. */
  function commonness(e) {
    // Frequencies come from written text, so everyday spoken words (你好) also count their HSK level.
    let level = !e.f ? 1 : e.i < 1500 ? 4 : e.i < 6000 ? 3 : e.i < 20000 ? 2 : 1;
    if (e.h) level = Math.max(level, e.h === 1 ? 4 : e.h <= 4 ? 3 : 2);
    return { level, label: ["", "Rare", "Less common", "Common", "Very common"][level] };
  }
  function chars(word) {
    return [...new Set([...word])].filter(isCJK).map(c => ({ ch: c, entry: lookup(c)[0] || null }));
  }
  function hskWords(level) { return entries.filter(e => e.h === level); }
  /** One word a day from an HSK level (1 unless you chose a higher Chinese level in the welcome). */
  function wordOfDay(date, level) {
    const list = hskWords(level || 1).filter(e => !WEAK.test(e.d.toLowerCase()));
    if (!list.length) return null;
    const d = date || new Date();
    const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    return list[(day * 7919) % list.length];
  }

  return {
    parse, get, lookup, search, segment, chars, senses, measureWords, syllables, toMarks,
    wordOfDay, hskWords, wordsWith, commonness, warm() { if (ready && !enIndex) buildEnglish(); }, isCJK, get size() { return entries.length; }, get ready() { return ready; },
  };
})();

if (typeof module !== "undefined") module.exports = Engine;
