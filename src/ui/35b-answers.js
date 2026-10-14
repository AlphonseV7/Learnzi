/* LearnZì UI, part 6b: typed answers (Settings → Flashcards → Type your answers).
 * Checks what you type on a card and says exactly what was off:
 *  - pinyin with tone numbers (ni3hao3), tone marks (nǐhǎo) or no tones; v, ü or u: for ü; spaces optional
 *  - characters (simplified or traditional)
 *  - an English meaning (Meaning cards), against the dictionary's senses
 * A small typo counts ("Almost!"). Tone changes you'd hear in speech count as right: two third tones
 * (nǐ hǎo said ní hǎo), 一 yī and 不 bù changing before other tones, and any tone on a neutral syllable.
 * Pure functions on plain data (plus Engine.isCJK): tested in tools/test_answers.js. */

const ANS_TONED = {};
for (const [base, row] of Object.entries({ a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", v: "ǖǘǚǜ" })) [...row].forEach((ch, k) => { ANS_TONED[ch] = [base, k + 1]; });

/** Edit distance (insert, delete, change, swap two neighbours), stopping early above `max`. */
function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev2 = null, prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let low = i;
    for (let j = 1; j <= b.length; j++) {
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, prev2[j - 2] + 1);
      cur.push(d); low = Math.min(low, d);
    }
    if (low > max) return max + 1;
    prev2 = prev; prev = cur;
  }
  return prev[b.length];
}
/** How many slips still count as a typo for an answer this long. */
const typoAllowance = n => (n >= 9 ? 2 : n >= 4 ? 1 : 0);

/** The answer's syllables from dictionary pinyin ("ni3 hao3"): [{l: letters, t: tone 1-5, 0 = any}]. */
function ansSyllables(p) {
  const out = [];
  for (const x of String(p).split(/\s+/)) {
    const m = /^([a-zü:]+)([1-5])?$/i.exec(x);
    if (m) out.push({ l: m[1].toLowerCase().replace(/u:|ü/g, "v"), t: m[2] ? +m[2] : 0 });
  }
  return out;
}
/** What was typed, as letters (ü → v) with tones from numbers or marks. */
function ansTokens(text) {
  const out = [];
  const s = String(text).normalize("NFC").toLowerCase().replace(/u:/g, "v").replace(/ü/g, "v");
  for (const ch of s) {
    if (ch >= "a" && ch <= "z") out.push({ c: ch });
    else if (ch >= "0" && ch <= "5") out.push({ t: +ch });
    else if (ANS_TONED[ch]) out.push({ c: ANS_TONED[ch][0], mark: ANS_TONED[ch][1] });
  }
  return out;
}
/** Is tone `got` fine for syllable i? "sandhi" when it's a spoken tone change. */
function toneOk(syl, i, got) {
  const want = syl[i].t, next = syl[i + 1] ? syl[i + 1].t : 0;
  if (!want || got === want) return true;
  if (want === 5) return true;                                   // neutral: any tone is fine
  if ((got === 5 || got === 0) && want !== 5) return false;
  if (want === 3 && got === 2 && next === 3) return "sandhi";    // 你好 said ní hǎo
  if (syl[i].l === "yi" && want === 1 && ((got === 2 && next === 4) || (got === 4 && next >= 1 && next <= 3))) return "sandhi";
  if (syl[i].l === "bu" && want === 4 && got === 2 && next === 4) return "sandhi";
  return false;
}
/** Check typed pinyin against numbered pinyin p.
 *  kind: right | typo | notones | tones | wrong | empty; wrong: indexes of syllables with a wrong tone. */
function checkPinyin(text, p) {
  const syl = ansSyllables(p), toks = ansTokens(text);
  const letters = toks.filter(x => x.c).map(x => x.c).join("");
  const want = syl.map(x => x.l).join("");
  if (!letters) return { kind: "empty" };
  if (!syl.length) return { kind: "wrong" };
  if (letters !== want) {
    const d = editDistance(letters, want, 2);
    return { kind: d <= typoAllowance(want.length) ? "typo" : "wrong" };
  }
  // Same letters: line the tones up with the answer's syllables.
  const ends = []; let n = 0;
  for (const x of syl) { n += x.l.length; ends.push(n); }
  const sylAt = pos => { let i = 0; while (i < ends.length - 1 && pos >= ends[i]) i++; return i; };
  const got = syl.map(() => null);
  let pos = 0;
  for (const x of toks) {
    if (x.c) { if (x.mark) got[sylAt(pos)] = x.mark; pos++; }
    else if (pos > 0) { const i = sylAt(pos - 1); if (got[i] == null) got[i] = x.t; }
  }
  const toned = syl.map((x, i) => x.t && x.t !== 5 ? i : -1).filter(i => i >= 0);
  if (toned.length && toned.every(i => got[i] == null)) return { kind: "notones" };
  const wrong = []; let sandhi = false;
  syl.forEach((x, i) => {
    if (got[i] == null) { if (x.t && x.t !== 5) wrong.push(i); return; }
    const ok = toneOk(syl, i, got[i]);
    if (!ok) wrong.push(i); else if (ok === "sandhi") sandhi = true;
  });
  return wrong.length ? { kind: "tones", wrong } : { kind: "right", sandhi };
}
/** Check typed characters against the word's forms (simplified, traditional). */
function checkHanzi(text, forms) {
  const typed = [...String(text).normalize("NFC")].filter(c => Engine.isCJK(c)).join("");
  if (!typed) return { kind: "empty" };
  if (forms.includes(typed)) return { kind: "right" };
  for (const f of forms) {
    const a = [...typed], b = [...f];
    if (a.length === b.length && a.length >= 2) {
      const wrong = a.map((c, i) => (c === b[i] ? -1 : i)).filter(i => i >= 0);
      if (wrong.length === 1) return { kind: "close", wrong };
    }
  }
  return { kind: "wrong" };
}
/** Pinyin or characters, whichever was typed, for a word entry {s, t, p}. */
function checkReading(text, e) {
  return Engine.isCJK(String(text)) ? checkHanzi(text, [e.s, e.t].filter(Boolean)) : checkPinyin(text, e.p);
}

// English meanings
const EN_STOP = new Set(["a", "an", "the", "to", "of", "be", "is", "are", "it", "sb", "sth", "sb's", "one's", "oneself", "someone", "something", "somebody", "etc"]);
// Words that may ride along without changing the meaning ("thank you" for "thanks"); never "not".
const EN_FILLER = new Set(["you", "me", "very", "really", "much", "so", "please", "up", "out"]);
function enWords(str) {
  return String(str).toLowerCase().replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/[^a-z0-9']+/g, " ").split(" ")
    .filter(w => w && !EN_STOP.has(w)).map(w => (w.length > 3 && /[^s]s$/.test(w) ? w.slice(0, -1) : w));
}
/** Check a typed meaning against the dictionary's senses (plain strings).
 *  Right when every word typed is in one of the meanings (spelling slips allowed) and covers at least
 *  half of it: "like" or "fond" for "to like; to be fond of". kind: right | typo | nomatch | empty. */
function checkMeaning(text, senses) {
  const typed = enWords(text);
  if (!typed.length) return { kind: "empty" };
  let typo = null;
  for (const sense of senses) for (const part of String(sense).split(/[;,/]/)) {
    const words = enWords(part);
    if (!words.length) continue;
    let fuzzy = false, all = true;
    const used = new Set();
    for (const w of typed) {
      let hit = words.findIndex((x, j) => !used.has(j) && x === w);
      if (hit < 0) { hit = words.findIndex((x, j) => !used.has(j) && x.length >= 4 && editDistance(w, x, 2) <= typoAllowance(x.length)); if (hit >= 0) fuzzy = true; }
      if (hit < 0) { if (EN_FILLER.has(w) && typed.length > 1) continue; all = false; break; }
      used.add(hit);
    }
    if (all && used.size && used.size * 2 >= words.length) {
      if (!fuzzy) return { kind: "right", match: part.trim() };
      typo = typo || { kind: "typo", match: part.trim() };
    }
  }
  return typo || { kind: "nomatch" };
}

/** What a result means for the card: a short title, a line of detail, and the grade to suggest
 *  (1 Again … 4 Easy, 0 = none: grade yourself). */
function verdictOf(res) {
  switch (res.kind) {
    case "right": return { title: "Correct!", line: res.sandhi ? "With the tone change you'd hear when it's spoken, so it counts." : "", grade: 3, tone: "good" };
    case "typo": return { title: "Almost! A small typo, but it counts.", line: "", grade: 3, tone: "good" };
    case "notones": return { title: "Right sounds! Now add the tones.", line: "Type a number after each syllable (ni3hao3), or use tone marks.", grade: 2, tone: "near" };
    case "tones": return { title: res.wrong.length === 1 ? "Nearly: one tone is off." : "Nearly: some tones are off.", line: "", grade: 2, tone: "near" };
    case "close": return { title: "Nearly: one character is different.", line: "", grade: 2, tone: "near" };
    case "nomatch": return { title: "Not one of the dictionary's meanings.", line: "If yours means the same thing, give yourself Good.", grade: 0, tone: "unsure" };
    case "empty": return { title: "", line: "", grade: 0, tone: "unsure" };
    default: return { title: "Not quite.", line: "", grade: 1, tone: "bad" };
  }
}
